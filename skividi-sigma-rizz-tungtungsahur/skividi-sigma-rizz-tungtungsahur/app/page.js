 "use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSupabase, getSupabaseSetupError } from "../lib/supabase";

// Hidden entry is only a discovery mechanism, never a substitute for authentication or RLS.
const LOGO_CLICKS_TO_REVEAL = 5;
const SECRET_KEY_SEQUENCE = "knock"; // Change this to your own private phrase before deployment.
const POLL_INTERVAL_MS = 4000;
const MAX_INITIAL_MESSAGES = 100;

function LogoMark() {
  return (
    <svg viewBox="0 0 240 240" role="img" aria-label="Site logo" className="logo-svg">
      <defs>
        <linearGradient id="logoGradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#9b8cff" />
          <stop offset="100%" stopColor="#58d6c5" />
        </linearGradient>
      </defs>
      <path d="M120 15 213 69v102l-93 54-93-54V69z" fill="none" stroke="url(#logoGradient)" strokeWidth="7" />
      <path d="M75 91c0-17 14-31 31-31h28c17 0 31 14 31 31v10c0 17-14 31-31 31h-6l-29 23v-23c-14-2-24-15-24-30z" fill="url(#logoGradient)" />
      <path d="M103 99h34M103 116h22" stroke="#10131b" strokeWidth="7" strokeLinecap="round" />
    </svg>
  );
}

function initials(name) {
  return (name || "M").trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function colorFor(value) {
  let hash = 0;
  for (let i = 0; i < (value || "").length; i += 1) hash = value.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${Math.abs(hash) % 360} 58% 43%)`;
}

function formatTime(value) {
  return new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function dayLabel(value) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" });
}

function LinkifiedText({ text }) {
  const urlPattern = /(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi;
  const pieces = text.split(urlPattern);
  return (
    <>
      {pieces.map((piece, index) => {
        if (/^(https?:\/\/|www\.)/i.test(piece)) {
          const href = piece.startsWith("www.") ? `https://${piece}` : piece;
          return <a key={`${piece}-${index}`} href={href} target="_blank" rel="noopener noreferrer">{piece}</a>;
        }
        return <span key={index}>{piece}</span>;
      })}
    </>
  );
}

function ChatMessage({ message, previous, currentUserId, onDelete }) {
  const mine = message.user_id === currentUserId;
  const sameAuthor = previous && previous.user_id === message.user_id &&
    new Date(message.created_at).getTime() - new Date(previous.created_at).getTime() < 5 * 60 * 1000;
  return (
    <div className={`message-row ${mine ? "mine" : ""} ${sameAuthor ? "same-author" : ""}`}>
      {!sameAuthor && (
        <div className="avatar" style={{ background: colorFor(message.user_id) }}>
          {initials(message.display_name || message.email || "Member")}
        </div>
      )}
      {sameAuthor && <div className="avatar-spacer" />}
      <div className="message-content">
        {!sameAuthor && <div className="message-author">{mine ? "You" : (message.display_name || message.email || "Member")}</div>}
        <div className="bubble">
          <div className="message-text"><LinkifiedText text={message.body} /></div>
          <div className="message-meta">
            <time dateTime={message.created_at}>{formatTime(message.created_at)}</time>
            {mine && (
              <button className="delete-message" type="button" onClick={() => onDelete(message.id)} aria-label="Delete your message" title="Delete message">×</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const [entryVisible, setEntryVisible] = useState(false);
  const [logoClicks, setLogoClicks] = useState(0);
  const [gateUnlocked, setGateUnlocked] = useState(false);
  const secretBufferRef = useRef("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [displayNameInput, setDisplayNameInput] = useState("");
  const [profile, setProfile] = useState(null);
  const [adminMembers, setAdminMembers] = useState([]);
  const [adminBusy, setAdminBusy] = useState(false);
  const [adminError, setAdminError] = useState("");
  const [showAdmin, setShowAdmin] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [user, setUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [chatError, setChatError] = useState("");
  const [sending, setSending] = useState(false);
  const [onlineMembers, setOnlineMembers] = useState([]);
  const [typingMembers, setTypingMembers] = useState([]);
  const [realtimeState, setRealtimeState] = useState("connecting");
  const [atLatest, setAtLatest] = useState(true);
  const [unread, setUnread] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [soundReady, setSoundReady] = useState(false);
  const listRef = useRef(null);
  const bottomRef = useRef(null);
  const channelRef = useRef(null);
  
  
  const typingTimeoutRef = useRef(null);
  const audioContextRef = useRef(null);
  const supabase = useMemo(() => getSupabase(), []);

  const revealEntry = () => {
    if (gateUnlocked) {
      setEntryVisible((visible) => !visible);
      setLoginError("");
      return;
    }
    setLogoClicks((clicks) => {
      const next = clicks + 1;
      if (next >= LOGO_CLICKS_TO_REVEAL) {
        setGateUnlocked(true);
        setEntryVisible(true);
        return 0;
      }
      return next;
    });
  };

  useEffect(() => {
    const onSecretKey = (event) => {
      if (event.ctrlKey || event.altKey || event.metaKey || event.key.length !== 1) return;
      const target = event.target;
      if (target?.closest?.("input, textarea, [contenteditable='true']")) return;
      secretBufferRef.current = (secretBufferRef.current + event.key.toLowerCase()).slice(-SECRET_KEY_SEQUENCE.length);
      if (secretBufferRef.current === SECRET_KEY_SEQUENCE) {
        setGateUnlocked(true);
        setEntryVisible(true);
        secretBufferRef.current = "";
      }
    };
    window.addEventListener("keydown", onSecretKey);
    return () => window.removeEventListener("keydown", onSecretKey);
  }, []);

  const scrollToLatest = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    setAtLatest(true);
    setUnread(0);

  }, []);

  const playSound = useCallback(() => {
    if (!soundEnabled || !soundReady) return;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      if (!audioContextRef.current) audioContextRef.current = new AudioContextClass();
      const context = audioContextRef.current;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = 660;
      gain.gain.setValueAtTime(0.045, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.12);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.12);
    } catch (_) {
      // Sound is optional; silently ignore browser audio restrictions.
    }
  }, [soundEnabled, soundReady]);

  const mergeMessages = useCallback((incoming, notify = false) => {
    setMessages((current) => {
      const byId = new Map(current.map((item) => [item.id, item]));
      incoming.forEach((item) => byId.set(item.id, item));
      const merged = Array.from(byId.values()).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      if (notify) {
        const newIncoming = incoming.filter((item) => item.user_id !== user?.id && !current.some((old) => old.id === item.id));
        if (newIncoming.length) {
          if (document.hidden || !atLatest) setUnread((count) => count + newIncoming.length);
          playSound();
        }
      }
      return merged;
    });
  }, [atLatest, playSound, user]);

  const loadMessages = useCallback(async (isInitial = false) => {
    if (!supabase || !user) return;
    const { data, error } = await supabase
      .from("messages")
      .select("id,user_id,display_name,body,created_at")
      .order("created_at", { ascending: false })
      .limit(MAX_INITIAL_MESSAGES);
    if (error) {
      setChatError("Messages could not be loaded. Please refresh or try again.");
      return;
    }
    if (isInitial) {
      setMessages([...(data || [])].reverse());

      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "auto" }), 50);
    } else {
      mergeMessages([...(data || [])].reverse(), true);
    }
  }, [supabase, user, mergeMessages]);

  useEffect(() => {
    if (!supabase) return undefined;
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user || null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      if (!session) {
        setMessages([]);
        setOnlineMembers([]);
        setTypingMembers([]);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (!user || !supabase) { setProfile(null); return; }
    let live = true;
    const refresh = async () => {
      const { data, error } = await supabase.from("profiles").select("id,display_name,status,role").eq("id", user.id).maybeSingle();
      if (live) { setProfile(error ? null : data); if (error) setAdminError("Membership configuration is missing. Run the new schema.sql in Supabase."); }
    };
    refresh();
    const timer = setInterval(refresh, 12000);
    return () => { live = false; clearInterval(timer); };
  }, [user?.id, supabase]);

  const loadMembers = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from("profiles").select("id,display_name,status,role,created_at").order("created_at", {ascending:false});
    if (error) setAdminError(error.message);
    else {setAdminError("");setAdminMembers(data || []);}
  }, [supabase]);

  useEffect(() => { if (profile?.role === "admin" && showAdmin) loadMembers(); }, [profile?.role, showAdmin, loadMembers]);

  const changeMember = async (member, status) => {
    setAdminBusy(true);
    const { error } = await supabase.from("profiles").update({status}).eq("id", member.id);
    setAdminBusy(false);
    if (error) setAdminError(error.message);
    else await loadMembers();
  };

  useEffect(() => {
    if (!user || !supabase || profile?.status !== "approved") return undefined;
    let active = true;
    let channel;
    setChatError("");
    setRealtimeState("connecting");
    loadMessages(true);

    const displayName = user.user_metadata?.display_name || user.user_metadata?.full_name || user.email?.split("@")[0] || "Member";
    channel = supabase.channel("private-room", {
      config: { presence: { key: user.id } }
    });

    channel
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, (payload) => {
        if (payload.eventType === "INSERT") mergeMessages([payload.new], true);
        if (payload.eventType === "DELETE") setMessages((current) => current.filter((item) => item.id !== payload.old.id));
      })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const members = Object.values(state).flat().filter((member) => member.user_id !== user.id);
        setOnlineMembers(members);
      })
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (!payload || payload.user_id === user.id) return;
        setTypingMembers((current) => {
          const without = current.filter((item) => item.user_id !== payload.user_id);
          return payload.typing ? [...without, payload] : without;
        });
        if (payload.typing) {
          setTimeout(() => setTypingMembers((current) => current.filter((item) => item.user_id !== payload.user_id)), 3000);
        }
      })
      .subscribe(async (status) => {
        if (!active) return;
        setRealtimeState(status === "SUBSCRIBED" ? "connected" : status.toLowerCase());
        if (status === "SUBSCRIBED") {
          await channel.track({ user_id: user.id, display_name: displayName, online_at: new Date().toISOString() });
        }
      });

    channelRef.current = channel;
    return () => {
      active = false;
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, supabase, profile?.status]);

  // Poll every four seconds whenever Realtime is not connected.
  useEffect(() => {
    if (!user || !supabase || profile?.status !== "approved" || realtimeState === "connected") return undefined;
    const timer = setInterval(() => loadMessages(false), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [user, supabase, profile?.status, realtimeState, loadMessages]);

  useEffect(() => {
    if (!user) {
      document.title = "Welcome";
      return;
    }
    document.title = unread > 0 ? `(${unread}) Skividi Terminal` : "Skividi Terminal";
  }, [user, unread]);

  useEffect(() => {
    const element = listRef.current;
    if (!element) return undefined;
    const onScroll = () => {
      const nearBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 100;
      setAtLatest(nearBottom);
      if (nearBottom) setUnread(0);
    };
    element.addEventListener("scroll", onScroll);
    return () => element.removeEventListener("scroll", onScroll);
  }, [user]);

  const sendTyping = (typing) => {
    if (channelRef.current) {
      channelRef.current.send({
        type: "broadcast",
        event: "typing",
        payload: {
          user_id: user.id,
          display_name: user.user_metadata?.display_name || user.email?.split("@")[0] || "Member",
          typing
        }
      });
    }
  };

  const handleDraftChange = (value) => {
    setDraft(value);
    sendTyping(value.trim().length > 0);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => sendTyping(false), 1800);
  };

  const signIn = async (event) => {
    event.preventDefault();
    if (!supabase) {
      setLoginError(getSupabaseSetupError());
      return;
    }
    setLoginBusy(true);
    setLoginError("");
    try {
      if (authMode === "register") {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: {data: {display_name: displayNameInput.trim().slice(0, 60)}} });
        if (error) setLoginError(error.message);
        else if (!data.session) setLoginError("Account request received. Check your email to confirm it, then sign in. An administrator must approve access.");
        else setLoginError("Account created. Your access is pending administrator approval.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) setLoginError(error.message);
      }
    } catch (error) {setLoginError(error.message || "Something went wrong.");}
    setLoginBusy(false);
  };

  const signOut = async () => {
    if (supabase) await supabase.auth.signOut();
    setUser(null);
    setMessages([]);
    setUnread(0);
  };

  const sendMessage = async () => {
    const body = draft.trim();
    if (!body || !supabase || !user || sending) return;
    setSending(true);
    setChatError("");
    const displayName = user.user_metadata?.display_name || user.user_metadata?.full_name || user.email?.split("@")[0] || "Member";
    const { data, error } = await supabase.from("messages").insert({
      user_id: user.id,
      display_name: displayName,
      body
    }).select("id,user_id,display_name,body,created_at").single();
    setSending(false);
    if (error) {
      setChatError("Your message could not be sent. Please try again.");
      return;
    }
    setDraft("");
    sendTyping(false);
    if (data) mergeMessages([data]);
    scrollToLatest();
  };

  const deleteMessage = async (id) => {
    if (!supabase || !user) return;
    const { error } = await supabase.from("messages").delete().eq("id", id);
    if (error) setChatError("That message could not be deleted.");
    else setMessages((current) => current.filter((item) => item.id !== id));
  };

  const groupedMessages = useMemo(() => {
    const output = [];
    let previousDay = "";
    messages.forEach((message, index) => {
      const day = new Date(message.created_at).toDateString();
      if (day !== previousDay) {
        output.push({ type: "day", id: `day-${day}`, label: dayLabel(message.created_at) });
        previousDay = day;
      }
      output.push({ type: "message", message, previous: index > 0 ? messages[index - 1] : null });
    });
    return output;
  }, [messages]);

  if (user && profile?.status !== "approved") {
    return <main className="landing"><div className="access-state"><LogoMark /><h1>{profile?.status === "rejected" ? "Access declined" : profile?.status === "suspended" ? "Access suspended" : "Request pending"}</h1><p>{!profile ? "Checking membership status…" : profile.status === "pending" ? "Your account exists. An administrator needs to approve your request before you can join the chat. This page checks for approval automatically." : "Contact the site administrator if you need help."}</p>{adminError && <p className="login-error">{adminError}</p>}<button className="login-button" onClick={signOut}>Sign out</button></div></main>;
  }

  if (user) {
    return (
      <main className="workspace">
        <aside className="sidebar">
          <div className="sidebar-brand"><span className="terminal-glyph">⌘</span><div><strong>SKIVIDI</strong><small>PRIVATE CHAT</small></div></div>
          <div className="sidebar-section-label">CHATS</div>
          {profile?.role === "admin" && <button className="sidebar-room" type="button" onClick={() => setShowAdmin(v=>!v)}>{showAdmin ? "← Back to chat" : "Member approvals"}</button>}
          <div className="sidebar-room active-room"><span className="room-symbol">#</span><span>general</span><span className="room-pill">LIVE</span></div>
          <div className="sidebar-section-label members-label">ONLINE MEMBERS <span>{onlineMembers.length + 1}</span></div>
          <div className="sidebar-member"><span className="online-dot"/><span>You</span><small>online</small></div>
          {onlineMembers.map((member) => <div className="sidebar-member" key={member.user_id}><span className="online-dot"/><span>{member.display_name || "Member"}</span></div>)}
          {onlineMembers.length === 0 && <p className="sidebar-empty">Others will appear when they connect.</p>}
          <div className="sidebar-bottom"><div className="account-avatar">{initials(user.user_metadata?.display_name || user.email || "Member")}</div><div className="account-details"><strong>{user.user_metadata?.display_name || user.email?.split("@")[0] || "Member"}</strong><small>Authenticated member</small></div><button type="button" className="sidebar-logout" onClick={signOut} title="Sign out" aria-label="Sign out">↪</button></div>
        </aside>
        <section className="chat-column">
          {showAdmin && profile?.role === "admin" ? <div className="admin-panel"><div className="admin-heading"><div><small>ADMINISTRATION</small><h1>Member access</h1><p>Approve requests before anyone can enter the room.</p></div><button onClick={loadMembers}>Refresh</button></div>{adminError && <p className="login-error">{adminError}</p>}<div className="member-table">{adminMembers.map(member=><div className="member-admin-row" key={member.id}><div><strong>{member.display_name || "Member"}</strong><small>{member.role} · {member.status}</small></div><div className="member-actions">{member.role !== "admin" && <><button disabled={adminBusy || member.status === "approved"} onClick={()=>changeMember(member,"approved")}>Approve</button><button disabled={adminBusy || member.status === "rejected"} onClick={()=>changeMember(member,"rejected")}>Reject</button><button disabled={adminBusy || member.status === "suspended"} onClick={()=>changeMember(member,"suspended")}>Suspend</button></>}</div></div>)}</div></div> : <>
          <header className="topbar"><div className="topbar-title"><span className="topbar-hash">#</span><strong>general</strong><span className="topbar-description">Members-only conversation</span></div><div className="topbar-actions"><span className={`connection-status ${realtimeState === "connected" ? "is-connected" : ""}`}><i />{realtimeState === "connected" ? "Connected" : "Reconnecting"}</span><button type="button" className="topbar-sound" onClick={() => {setSoundReady(true);setSoundEnabled((v) => !v);}} aria-pressed={soundEnabled} title="Toggle notification sounds">{soundEnabled ? "♫ On" : "♫ Off"}</button><button type="button" className="mobile-logout" onClick={signOut}>Sign out</button></div></header>
          <div className="conversation-body">
            <div className="message-list" ref={listRef}>
              <div className="conversation-inner">
                <div className="conversation-intro"><div className="intro-mark">⌘</div><div className="eyebrow">PRIVATE MEMBERS CHAT · NOT END-TO-END ENCRYPTED</div><h1>Welcome to your space.</h1><p>A quiet space for your crew. Messages here are shared with signed-in members.</p></div>
                {groupedMessages.map((item) => item.type === "day" ? <div className="day-divider" key={item.id}><span>{item.label}</span></div> : <ChatMessage key={item.message.id} message={item.message} previous={item.previous} currentUserId={user.id} onDelete={deleteMessage}/>)}
                <div ref={bottomRef}/>
              </div>
            </div>
            {!atLatest && <button className="latest-button" type="button" onClick={scrollToLatest}>↓ Latest {unread > 0 ? `· ${unread} new` : ""}</button>}
            <div className="composer-wrap"><div className="composer-inner">
              {typingMembers.length > 0 && <div className="typing-line"><span className="typing-dots">•••</span> {typingMembers.map((member) => member.display_name || "Someone").join(", ")} {typingMembers.length === 1 ? "is" : "are"} typing</div>}
              {chatError && <div className="inline-error" role="status">{chatError}</div>}
              <div className="composer"><textarea value={draft} onChange={(event) => handleDraftChange(event.target.value)} onKeyDown={(event) => {if (event.key === "Enter" && !event.shiftKey) {event.preventDefault();sendMessage();}}} placeholder="Message your crew..." rows={2} maxLength={5000} aria-label="Write a message"/><button className="send-button" type="button" onClick={sendMessage} disabled={!draft.trim() || sending} aria-label="Send message">{sending ? "…" : "↑"}</button></div>
              <div className="composer-hint"><span>ENTER to send · SHIFT + ENTER for newline</span><span>{draft.length}/5000</span></div>
            </div></div>
          </div>
          </>}
        </section>
      </main>
    );
  }

  return (
    <main className="encyclopedia" id="top">
      <header className="wiki-header">
        <div className="wiki-brand"><div className="wiki-globe" aria-hidden="true">◈</div><div><strong>THE SLOP gazetteer.</strong><small>The free reference collection</small></div></div>
        <form className="wiki-search" onSubmit={(e) => { e.preventDefault(); const q = e.currentTarget.elements.namedItem("wikiQuery")?.value?.toLowerCase() || ""; const target = q.includes("crazy") || q.includes("rat") ? "crazy" : q.includes("sigma") || q.includes("rizz") ? "sigma" : q.includes("skibidi") ? "skibidi" : q.includes("sahur") || q.includes("tung") ? "sahur" : q.includes("triple") || q.includes("incident") ? "overview" : "references"; document.getElementById(target)?.scrollIntoView({behavior:"smooth"}); }} role="search"><span aria-hidden="true">⌕</span><input name="wikiQuery" aria-label="Search the THE SLOP gazetteer." placeholder="Search the THE SLOP gazetteer."/><button type="submit">Search</button></form>
        <div className="wiki-account"><span>Contribute</span><span>Languages</span></div>
      </header>
      <div className="wiki-layout">
        <aside className="wiki-toc" aria-label="Contents"><strong>Contents</strong><div className="wiki-rule"/><a href="#top">(Top)</a><a href="#overview">Overview</a><a href="#origins">Origins</a><a href="#sahur">Tung Tung Tung Sahur</a><a href="#crazy">The rubber room</a><a href="#sigma">Sigma protocol</a><a href="#skibidi">Related phenomena</a><a href="#references">References</a></aside>
        <article className="wiki-article">
          <div className="wiki-titleline"><h1>The Triple T Incident</h1><span>42 languages⌄</span></div>
          <nav className="wiki-tabs" aria-label="Article navigation"><div><span className="selected">Article</span><span>Discussion</span></div><div><span className="selected">Read</span><span>View source</span><span>History</span></div></nav>
          <p className="wiki-from">From THE SLOP gazetteer., the free reference collection</p>
          <div className="wiki-notice"><span className="wiki-notice-icon">ⓘ</span><p><b>This article is part of the Unusual Topics collection.</b> It describes fictional events, internet memes, and an alarming quantity of unverified lore. Please do not cite this page in a history exam.</p></div>
          <p id="overview"><b>The Triple T Incident</b> (abbreviated <b>TTT</b>), sometimes called the <i>Great Tung Tung Tung Sahur Catastrophe</i>, is an alleged internet phenomenon associated with spontaneous chanting, excessive sigma energy, and the disappearance of approximately 47 brain cells. Its precise date, location, and existence remain subjects of considerable scholarly disagreement.</p>
          <div className="wiki-infobox"><div className="wiki-infobox-heading">The Triple T Incident</div><div className="wiki-infobox-illustration" aria-hidden="true"><span>✦</span><span>◌</span><span>✧</span></div><div className="wiki-infobox-caption">Artist's interpretation of the incident (no witnesses were available)</div><div className="wiki-info-row"><b>Also known as</b><span>TTT; The Great Sahur Event</span></div><div className="wiki-info-row"><b>Classification</b><span>Internet folklore / brainrot</span></div><div className="wiki-info-row"><b>First reported</b><span>At an unspecified 3:00 a.m.</span></div><div className="wiki-info-row"><b>Status</b><span>Extremely unserious</span></div></div>
          <p>Although generally dismissed by mainstream researchers, the incident continues to appear in comment sections, group chats, and conversations that began with a completely unrelated topic. Participants frequently report the urge to say "bro" before presenting any evidence.</p>
          <h2 id="origins">Origins</h2><p>According to the most widely circulated account, the phenomenon began when an unidentified individual asked a simple question and received the response, "Tung Tung Tung Sahur." Subsequent attempts to establish context were unsuccessful. The phrase was repeated three times, at which point the discussion allegedly achieved maximum brainrot.</p>
          <h2 id="sahur">Tung Tung Tung Sahur</h2><p><b>Tung Tung Tung Sahur</b> is a recurring figure in the folklore surrounding the incident. Its appearances are commonly described as sudden, dramatic, and entirely unrelated to the topic at hand. Some versions of the story attribute to it the power to interrupt normal conversations with rhythmic knocking.</p><p>The so-called <i>Triple T Principle</i> proposes that any sufficiently long conversation will eventually return to Tung Tung Tung Sahur, regardless of how it began. No peer-reviewed evidence supports this principle.</p>
          <h2 id="crazy">The rubber room hypothesis</h2><p>A separate school of thought links the incident to the repetitive internet monologue beginning, <i>"Crazy? I was crazy once."</i> The account describes a rubber room, the presence of rats, and a circular chain of reasoning that returns the narrator to the beginning. Researchers of fictional nonsense classify this as a <i>self-sustaining meme loop</i>.</p><p>Attempts to document the number of repetitions have failed because every researcher eventually started the story over.</p>
          <h2 id="sigma">The Sigma Protocol</h2><p>The <b>Sigma Protocol</b> is a purported emergency procedure for those exposed to the Triple T Incident. It consists of maintaining a mysterious expression, claiming to have "infinite aura," and refusing to elaborate. The protocol has never been approved by any recognized scientific institution.</p><p>Its supporters maintain that the correct response to an unexpected rizz event is to stand silently and let the lore develop. Critics have described this approach as "literally doing nothing."</p>
          <h2 id="skibidi">Related phenomena</h2><p>Related entries in the unofficial brainrot taxonomy include <b>Skibidi Sigma</b>, <b>the Rizzler</b>, <b>Tralalero Tralala</b>, and <b>Bombardiro Crocodilo</b>. These terms share a tendency to spread through short-form videos, ironic repetition, and the inability of bystanders to explain what is happening.</p>
          <h2 id="references">References</h2><ol><li>THE SLOP gazetteer. Department of Questionable Research. <i>The Triple T Files</i>. Fictional archive, undated.</li><li>Institute for Advanced Brainrot Studies. <i>Proceedings of the Rubber Room Symposium</i>. Fictional publication.</li><li>Anonymous group chat. <i>Bro trust me</i>. Unverified oral history.</li></ol>
          <div className="wiki-footnote">This is a parody encyclopedia article on an independent website. It is not Wikipedia; the events and references are fictional.</div>
          <button className="wiki-secret-mark" type="button" onClick={revealEntry} aria-label="Article page marker" aria-expanded={entryVisible} aria-controls="access-form">✣</button>
        </article>
        <aside className="wiki-appearance" aria-label="Appearance"><strong>Appearance</strong><div className="wiki-rule"/><small>Text</small><p>◉ Standard</p><p>◯ Large</p><small>Width</small><p>◉ Standard</p><p>◯ Wide</p><small>Color</small><p>◉ Light</p><p>◯ Dark</p></aside>
      </div>
      {entryVisible && <div className="wiki-access-backdrop" onClick={()=>setEntryVisible(false)}><section className="wiki-access-modal" role="dialog" aria-modal="true" aria-label="Member access" onClick={e=>e.stopPropagation()}><div className="wiki-access-heading"><span>MEMBER ACCESS</span><button type="button" onClick={()=>setEntryVisible(false)} aria-label="Close access">×</button></div><form id="access-form" className="login-form" onSubmit={signIn}><div className="auth-switch"><button type="button" className={authMode === "login" ? "selected" : ""} onClick={()=>{setAuthMode("login");setLoginError("");}}>Sign in</button><button type="button" className={authMode === "register" ? "selected" : ""} onClick={()=>{setAuthMode("register");setLoginError("");}}>Request access</button></div>{authMode === "register" && <><label htmlFor="display-name">Display name</label><input id="display-name" value={displayNameInput} onChange={e=>setDisplayNameInput(e.target.value)} maxLength={60} minLength={2} required autoComplete="nickname" /></>}<label htmlFor="email">Email</label><input id="email" type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} required /><label htmlFor="password">Password</label><input id="password" type="password" autoComplete={authMode === "register" ? "new-password" : "current-password"} minLength={6} value={password} onChange={e=>setPassword(e.target.value)} required />{loginError && <p className="login-error" role="alert">{loginError}</p>}<button className="login-button" type="submit" disabled={loginBusy}>{loginBusy ? "Please wait…" : authMode === "register" ? "Create account & request access" : "Sign in"}</button></form></section></div>}
      {gateUnlocked && !entryVisible && <button className="wiki-access-shortcut" type="button" onClick={()=>setEntryVisible(true)}>Member access</button>}
      {!supabase && <div className="wiki-setup" role="status">{getSupabaseSetupError()}</div>}
    </main>
  );
}
