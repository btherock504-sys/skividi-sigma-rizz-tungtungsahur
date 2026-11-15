import "./globals.css";

export const metadata = {
  title: "Skividi sigma rizz tungtungsahur",
  description: "Members-only realtime chat.",
  robots: {
    index: false,
    follow: false,
    nocache: true
  }
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#10131b"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}