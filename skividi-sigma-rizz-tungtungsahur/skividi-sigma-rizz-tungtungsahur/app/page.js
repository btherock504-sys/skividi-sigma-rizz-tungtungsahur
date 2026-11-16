 "use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSupabase, getSupabaseSetupError } from "../lib/supabase";

// Change this one value to 5 if you want five logo clicks to reveal the form.
// Keep it at 1 for the requested simple click-to-reveal behavior.
const LOGO_CLICKS_TO_REVEAL = 1;
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);
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
    const next = logoClicks + 1;
    setLogoClicks(next);
    if (next >= LOGO_CLICKS_TO_REVEAL) {
      setEntryVisible((visible) => !visible);
      setLogoClicks(0);
      setLoginError("");
    }
  };

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
    if (!user || !supabase) return undefined;
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
  }, [user?.id, supabase]);

  // Poll every four seconds whenever Realtime is not connected.
  useEffect(() => {
    if (!user || !supabase || realtimeState === "connected") return undefined;
    const timer = setInterval(() => loadMessages(false), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [user, supabase, realtimeState, loadMessages]);

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
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoginBusy(false);
    if (error) setLoginError("Unable to sign in. Check your details or contact the site administrator.");
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

  if (user) {
    return (
      <main className="workspace">
        <aside className="sidebar">
          <div className="sidebar-brand"><span className="terminal-glyph">⌘</span><div><strong>SKIVIDI</strong><small>MEMBERS TERMINAL</small></div></div>
          <div className="sidebar-section-label">WORKSPACE</div>
          <div className="sidebar-room active-room"><span className="room-symbol">#</span><span>general</span><span className="room-pill">LIVE</span></div>
          <div className="sidebar-section-label members-label">ONLINE MEMBERS <span>{onlineMembers.length + 1}</span></div>
          <div className="sidebar-member"><span className="online-dot"/><span>You</span><small>online</small></div>
          {onlineMembers.map((member) => <div className="sidebar-member" key={member.user_id}><span className="online-dot"/><span>{member.display_name || "Member"}</span></div>)}
          {onlineMembers.length === 0 && <p className="sidebar-empty">Others will appear when they connect.</p>}
          <div className="sidebar-bottom"><div className="account-avatar">{initials(user.user_metadata?.display_name || user.email || "Member")}</div><div className="account-details"><strong>{user.user_metadata?.display_name || user.email?.split("@")[0] || "Member"}</strong><small>Authenticated member</small></div><button type="button" className="sidebar-logout" onClick={signOut} title="Sign out" aria-label="Sign out">↪</button></div>
        </aside>
        <section className="chat-column">
          <header className="topbar"><div className="topbar-title"><span className="topbar-hash">#</span><strong>general</strong><span className="topbar-description">Private members conversation</span></div><div className="topbar-actions"><span className={`connection-status ${realtimeState === "connected" ? "is-connected" : ""}`}><i />{realtimeState === "connected" ? "Connected" : "Reconnecting"}</span><button type="button" className="topbar-sound" onClick={() => {setSoundReady(true);setSoundEnabled((v) => !v);}} aria-pressed={soundEnabled} title="Toggle notification sounds">{soundEnabled ? "♫ On" : "♫ Off"}</button><button type="button" className="mobile-logout" onClick={signOut}>Sign out</button></div></header>
          <div className="conversation-body">
            <div className="message-list" ref={listRef}>
              <div className="conversation-inner">
                <div className="conversation-intro"><div className="intro-mark">⌘</div><div className="eyebrow">ENCRYPTION NOT ENABLED · MEMBERS ONLY</div><h1>Welcome to the terminal.</h1><p>A quiet space for your crew. Messages here are shared with signed-in members.</p></div>
                {groupedMessages.map((item) => item.type === "day" ? <div className="day-divider" key={item.id}><span>{item.label}</span></div> : <ChatMessage key={item.message.id} message={item.message} previous={item.previous} currentUserId={user.id} onDelete={deleteMessage}/>)}
                <div ref={bottomRef}/>
              </div>
            </div>
            {!atLatest && <button className="latest-button" type="button" onClick={scrollToLatest}>↓ Latest {unread > 0 ? `· ${unread} new` : ""}</button>}
            <div className="composer-wrap"><div className="composer-inner">
              {typingMembers.length > 0 && <div className="typing-line"><span className="typing-dots">•••</span> {typingMembers.map((member) => member.display_name || "Someone").join(", ")} {typingMembers.length === 1 ? "is" : "are"} typing</div>}
              {chatError && <div className="inline-error" role="status">{chatError}</div>}
              <div className="composer"><span className="prompt-symbol">›</span><textarea value={draft} onChange={(event) => handleDraftChange(event.target.value)} onKeyDown={(event) => {if (event.key === "Enter" && !event.shiftKey) {event.preventDefault();sendMessage();}}} placeholder="Message #general..." rows={2} maxLength={5000} aria-label="Write a message"/><button className="send-button" type="button" onClick={sendMessage} disabled={!draft.trim() || sending} aria-label="Send message">{sending ? "…" : "↑"}</button></div>
              <div className="composer-hint"><span>ENTER to send · SHIFT + ENTER for newline</span><span>{draft.length}/5000</span></div>
            </div></div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="landing">
      <div className="landing-center">
        <button className="logo-trigger" type="button" onClick={revealEntry} aria-label="Open the private entrance">
          <LogoMark />
        </button>
        {entryVisible && (
          <form className="login-form" onSubmit={signIn}>
            <label htmlFor="email">Email</label>
            <input id="email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required />
            <label htmlFor="password">Password</label>
            <input id="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
            {loginError && <p className="login-error" role="alert">{loginError}</p>}
            <button className="login-button" type="submit" disabled={loginBusy}>{loginBusy ? "Please wait…" : "Continue"}</button>
          </form>
        )}
      </div>
      <span className="setup-notice" aria-live="polite">{!supabase ? getSupabaseSetupError() : ""}</span>
    </main>
  );
}