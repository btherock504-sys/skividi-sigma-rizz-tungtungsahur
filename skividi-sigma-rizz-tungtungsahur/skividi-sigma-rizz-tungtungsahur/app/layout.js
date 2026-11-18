import "./globals.css";

export const metadata = {
  title: "The Triple T Incident — THE SLOP gazetteer.",
  description: "A fictional encyclopedia of strange internet folklore and unusual topics.",
  robots: {
    index: false,
    follow: false,
    nocache: true
  }
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}