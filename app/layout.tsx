import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import { AppShell } from "@/components/app-shell";
import { StudyProvider } from "@/components/providers/study-provider";
import { AccountProvider } from "@/components/providers/account-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const incoming = await headers();
  const host = incoming.get("x-forwarded-host") ?? incoming.get("host") ?? "localhost:3000";
  const protocol = incoming.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  const image = `${protocol}://${host}/og.png`;
  return {
    title: { default: "Fokusplan", template: "%s · Fokusplan" },
    description: "Dein realistischer Lernplan – wissenschaftlich sinnvoll, konkret und anpassbar.",
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: { title: "Fokusplan", description: "Lernen, das in dein Leben passt.", type: "website", images: [{ url: image, width: 1792, height: 921, alt: "Fokusplan Wochenplan" }] },
    twitter: { card: "summary_large_image", title: "Fokusplan", description: "Lernen, das in dein Leben passt.", images: [image] },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AccountProvider><StudyProvider><AppShell>{children}</AppShell></StudyProvider></AccountProvider>
      </body>
    </html>
  );
}
