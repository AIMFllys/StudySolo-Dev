import type { Metadata } from "next";
import ThemeProvider from "@/components/layout/ThemeProvider";
import { AuthSessionBridge } from "@/features/auth/components";
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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="dark" suppressHydrationWarning>
      <body className="antialiased" style={fontVars}>
        <AuthSessionBridge />
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
