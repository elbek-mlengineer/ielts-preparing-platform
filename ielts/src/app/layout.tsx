import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "IELTS AI Prep Platform",
  description: "AI-powered preparation platform for IELTS candidates",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900">
        {children}
      </body>
    </html>
  );
}