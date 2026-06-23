import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Client Portal | The Independence Law Firm",
    template: "%s | The Independence Law Firm",
  },
  description:
    "Secure client portal for The Independence Law Firm. Access your case documents, communications, and legal resources.",
  keywords: ["independence law firm", "client portal", "legal documents", "student loan relief", "bankruptcy attorney"],
  authors: [{ name: "The Independence Law Firm" }],
  robots: {
    index: false, // portal should not be indexed by search engines
    follow: false,
  },
  openGraph: {
    title: "Client Portal | The Independence Law Firm",
    description: "Secure client portal for The Independence Law Firm.",
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
