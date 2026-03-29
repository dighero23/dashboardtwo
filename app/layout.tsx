import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Personal Dashboard",
  description: "Personal Dashboard 2.0",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-slate-900 text-slate-100">
        {children}
      </body>
    </html>
  );
}
