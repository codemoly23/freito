import type { Metadata } from "next";
import { AuthSessionProvider } from "@/components/providers/session-provider";
import { HydrationMarker } from "@/components/providers/hydration-marker";
import { SplashScreen } from "@/components/splash-screen";
import "./globals.css";

export const metadata: Metadata = {
  title: "Freito",
  description: "Freight Forwarding Operating System for Bangladesh logistics teams.",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body
        className="min-h-full bg-slate-50 text-slate-950"
        suppressHydrationWarning
      >
        <script async src="/js/theme.js" />
        <AuthSessionProvider>
          <HydrationMarker />
          <SplashScreen />
          {children}
        </AuthSessionProvider>
      </body>
    </html>
  );
}
