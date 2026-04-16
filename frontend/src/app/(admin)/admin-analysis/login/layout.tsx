// Standalone layout for the login page — no sidebar or topbar
export default function AdminLoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
        rel="stylesheet"
      />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;700;900&family=Work+Sans:wght@300;400;600&family=JetBrains+Mono:wght@400;700&display=swap"
        rel="stylesheet"
      />
      <div className="min-h-screen bg-[#f4f4f0] text-[#1b1c1a]">
        {children}
      </div>
    </>
  )
}
