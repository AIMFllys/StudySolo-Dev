import Link from 'next/link';

/* ─── Feature data ─── */
const features = [
  {
    icon: 'auto_awesome',
    title: '智能大纲',
    description: '一句话输入学习目标，AI 自动生成结构化学习大纲',
  },
  {
    icon: 'psychology',
    title: '知识提炼',
    description: '从海量信息中提取核心知识点，构建知识图谱',
  },
  {
    icon: 'summarize',
    title: '总结归纳',
    description: '自动生成学习笔记和要点总结，加深理解记忆',
  },
  {
    icon: 'style',
    title: '闪卡生成',
    description: '智能生成间隔重复闪卡，科学高效地巩固知识',
  },
];

/* ─── Deterministic star positions for starfield ─── */
const stars = Array.from({ length: 80 }, (_, i) => ({
  id: i,
  left: `${(i * 17 + 7) % 100}%`,
  top: `${(i * 23 + 13) % 100}%`,
  size: i % 4 === 0 ? 2 : 1,
  opacity: 0.15 + (i % 5) * 0.08,
}));

export default function LandingPage() {
  return (
    <main className="relative min-h-screen bg-[#020617] overflow-hidden">
      {/* ─── Starfield background ─── */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        {stars.map((star) => (
          <div
            key={star.id}
            className="absolute rounded-full bg-white"
            style={{
              left: star.left,
              top: star.top,
              width: star.size,
              height: star.size,
              opacity: star.opacity,
            }}
          />
        ))}
      </div>

      {/* ─── Decorative glow orbs ─── */}
      <div
        className="absolute top-[-10%] left-[15%] w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{ background: 'rgba(99, 102, 241, 0.15)', filter: 'blur(120px)' }}
        aria-hidden="true"
      />
      <div
        className="absolute bottom-[-5%] right-[10%] w-[400px] h-[400px] rounded-full pointer-events-none"
        style={{ background: 'rgba(16, 185, 129, 0.08)', filter: 'blur(100px)' }}
        aria-hidden="true"
      />
      <div
        className="absolute top-[40%] right-[25%] w-[300px] h-[300px] rounded-full pointer-events-none"
        style={{ background: 'rgba(99, 102, 241, 0.08)', filter: 'blur(80px)' }}
        aria-hidden="true"
      />

      {/* ─── Grid pattern overlay ─── */}
      <div className="absolute inset-0 bg-grid-pattern pointer-events-none" aria-hidden="true" />

      {/* ─── Content ─── */}
      <div className="relative z-10 flex flex-col min-h-screen">
        {/* ─── Nav ─── */}
        <nav className="flex items-center justify-between px-6 md:px-12 py-5">
          <div className="flex items-center gap-2.5">
            <span
              className="material-symbols-outlined text-2xl text-primary"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              bolt
            </span>
            <span className="text-xl font-bold bg-gradient-to-r from-primary to-[#818CF8] bg-clip-text text-transparent">
              StudySolo
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm text-white/60 hover:text-white transition-colors"
            >
              登录
            </Link>
            <Link
              href="/register"
              className="text-sm font-medium text-white bg-primary hover:bg-[#4F46E5] px-4 py-2 rounded-full shadow-glow transition-all active:scale-[0.98]"
            >
              免费注册
            </Link>
          </div>
        </nav>

        {/* ─── Hero Section ─── */}
        <section className="flex-1 flex flex-col items-center justify-center px-6 text-center pb-12 pt-8 md:pt-0">
          {/* Badge */}
          <div className="mb-6 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs text-white/50">
            <span
              className="material-symbols-outlined text-sm text-primary"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              rocket_launch
            </span>
            AI 驱动的下一代学习工具
          </div>

          {/* Headline */}
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight mb-5 max-w-3xl">
            AI 驱动的
            <br />
            <span className="bg-gradient-to-r from-primary via-[#818CF8] to-[#A78BFA] bg-clip-text text-transparent">
              学习工作流平台
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-base md:text-lg text-white/50 leading-relaxed mb-10 max-w-xl">
            一句话，生成完整的学习工作流。从大纲到知识提炼，
            <br className="hidden md:block" />
            从总结到闪卡，全程 AI 驱动。
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 mb-16">
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 px-8 py-3 rounded-full bg-primary text-white text-sm font-semibold hover:bg-[#4F46E5] shadow-glow transition-all active:scale-[0.98]"
            >
              <span
                className="material-symbols-outlined text-lg"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                bolt
              </span>
              开始使用
            </Link>
            <Link
              href="#features"
              className="inline-flex items-center justify-center gap-2 px-8 py-3 rounded-full border border-white/[0.12] text-white/70 text-sm font-semibold hover:bg-white/[0.05] hover:border-white/[0.2] transition-all active:scale-[0.98]"
            >
              了解更多
              <span className="material-symbols-outlined text-lg">
                arrow_downward
              </span>
            </Link>
          </div>

          {/* ─── Feature Cards ─── */}
          <div id="features" className="w-full max-w-4xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 px-2">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="glass-card rounded-xl p-5 text-left group cursor-default"
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <span className="material-symbols-outlined text-xl text-primary">
                    {feature.icon}
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-white mb-1.5">
                  {feature.title}
                </h3>
                <p className="text-xs text-white/40 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ─── Footer ─── */}
        <footer className="py-6 text-center border-t border-white/[0.05]">
          <p className="text-xs text-white/30">
            © {new Date().getFullYear()} StudySolo. All rights reserved.
          </p>
        </footer>
      </div>
    </main>
  );
}
