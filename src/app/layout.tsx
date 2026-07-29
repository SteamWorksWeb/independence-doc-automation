import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Client Portal | Liberty",
    template: "%s | Liberty",
  },
  description:
    "Secure client portal for Liberty. Access your case documents, communications, and legal resources.",
  keywords: ["independence law firm", "client portal", "legal documents", "student loan relief", "bankruptcy attorney"],
  authors: [{ name: "Liberty" }],
  robots: {
    index: false, // portal should not be indexed by search engines
    follow: false,
  },
  openGraph: {
    title: "Client Portal | Liberty",
    description: "Secure client portal for Liberty.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1, // prevent zoom on mobile input fields
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head />
      <body>{children}</body>
    </html>
  );
}
