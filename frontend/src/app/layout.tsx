import type { Metadata } from "next";
import ThemeProvider from "@/components/layout/ThemeProvider";
import { AuthSessionBridge } from "@/features/auth/components";
import { SafeErrorBoundary } from "@/components/ui/SafeErrorBoundary";
import { ConsentManager } from "@/components/ui/ConsentManager";
import NextTopLoader from "nextjs-toploader";
import { Toaster } from "sonner";
import "./globals.css";


/**
 * Font CSS variables — powered by @fontsource (local, no Google CDN).
 * Family names match the @fontsource-variable package output.
 */
const fontVars = {
  "--font-sans": "'Inter Variable', system-ui, sans-serif",
  "--font-sans-sc": "'Noto Sans SC Variable', 'Inter Variable', sans-serif",
  "--font-mono": "'JetBrains Mono Variable', monospace",
  "--font-serif-sc": "'Noto Serif SC Variable', serif",
} as React.CSSProperties;

export const metadata: Metadata = {
  title: "StudySolo - AI Learning Workflow Platform",
  description:
    "Generate complete learning workflows with AI, from outlines to key concepts.",
  icons: {
    icon: [{ url: "/StudySolo.png", type: "image/png" }],
    shortcut: [{ url: "/StudySolo.png", type: "image/png" }],
    apple: [{ url: "/StudySolo.png", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="dark" suppressHydrationWarning>
      <body className="antialiased" style={fontVars}>
        {/* ── Runtime env injection ──
             MUST be in <body>, NOT <head>!
             Next.js App Router manages <head> via metadata API and silently
             strips custom content placed inside <head>.
             This synchronous script injects env vars into window.__ENV__
             BEFORE any client component hydrates (including AuthSessionBridge). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__ENV__=${JSON.stringify({
              NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
              NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
              NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL ?? "",
              NEXT_PUBLIC_COOKIE_DOMAIN: process.env.NEXT_PUBLIC_COOKIE_DOMAIN ?? "",
            })};`,
          }}
        />
        <SafeErrorBoundary>
          <AuthSessionBridge />
        </SafeErrorBoundary>
        <NextTopLoader
          color="#6366F1"
          initialPosition={0.08}
          crawlSpeed={200}
          height={3}
          crawl
          showSpinner={false}
          easing="ease"
          speed={200}
          shadow="0 0 15px rgba(99, 102, 241, 0.6), 0 0 5px rgba(99, 102, 241, 0.4)"
        />
        <ThemeProvider>{children}</ThemeProvider>
        <ConsentManager />
        <Toaster
          richColors
          position="top-center"
          theme="system"
          closeButton
          toastOptions={{
            style: {
              background: "var(--card)",
              backdropFilter: "blur(12px)",
              border: "1px solid var(--border)",
              color: "var(--foreground)",
            },
            className: "glass-card shadow-glow",
          }}
        />
      </body>
    </html>
  );
}
