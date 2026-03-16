"use client";

import Link from 'next/link';
import { motion, useScroll, useTransform } from 'framer-motion';
import {
  Sparkles,
  Brain,
  BookOpen,
  Layers,
  ArrowRight,
  Zap,
  ChevronRight
} from 'lucide-react';
import { useEffect, useState } from 'react';

/* ─── Feature data ─── */
const features = [
  {
    icon: Sparkles,
    title: '智能大纲',
    description: '输入目标，AI 深入分析并生成逻辑严密的结构化学习大纲。',
    color: 'from-blue-500/20 to-indigo-500/20',
    iconColor: 'text-blue-400'
  },
  {
    icon: Brain,
    title: '知识提炼',
    description: '锁定核心概念，从繁杂信息中提取关键路径，构建动态知识图谱。',
    color: 'from-emerald-500/20 to-teal-500/20',
    iconColor: 'text-emerald-400'
  },
  {
    icon: BookOpen,
    title: '总结归纳',
    description: '自动化繁为简，生成多维度笔记与总结，深度重塑理解链路。',
    color: 'from-purple-500/20 to-violet-500/20',
    iconColor: 'text-purple-400'
  },
  {
    icon: Layers,
    title: '闪卡生成',
    description: '结合 Ebbinghaus 曲线，智能转换笔记为高效复习的间隔重复闪卡。',
    color: 'from-orange-500/20 to-amber-500/20',
    iconColor: 'text-orange-400'
  }
];

export default function LandingPage() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const { scrollY } = useScroll();
  const opacity = useTransform(scrollY, [0, 200], [1, 0]);
  const scale = useTransform(scrollY, [0, 200], [1, 0.95]);

  return (
    <main className="relative min-h-screen bg-background text-foreground selection:bg-primary/30 overflow-x-hidden">
      {/* ─── Dynamic Background ─── */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        {/* Animated Glow */}
        <motion.div
          animate={{
            x: mousePosition.x - 250,
            y: mousePosition.y - 250,
          }}
          transition={{ type: 'spring', damping: 30, stiffness: 50 }}
          className="absolute w-[500px] h-[500px] rounded-full bg-indigo-500/10 blur-[100px] opacity-50"
        />

        {/* Static Background Orbs */}
        <div className="absolute top-[-10%] left-[15%] w-[600px] h-[600px] rounded-full bg-blue-600/10 blur-[120px]" />
        <div className="absolute bottom-[-5%] right-[10%] w-[500px] h-[500px] rounded-full bg-purple-600/10 blur-[100px]" />

        {/* Grid Overlay */}
        <div className="absolute inset-0 bg-grid-pattern opacity-40" />
      </div>

      {/* ─── Navigation ─── */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-background/50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 md:px-12 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 group cursor-pointer">
            <div className="relative">
              <div className="absolute inset-0 bg-indigo-500 blur-lg opacity-40 group-hover:opacity-100 transition-opacity" />
              <Zap className="relative w-7 h-7 text-indigo-400 fill-indigo-400/20" />
            </div>
            <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
              StudySolo
            </span>
          </div>

          <div className="flex items-center gap-6">
            <Link
              href="/login"
              className="text-sm font-medium text-slate-400 hover:text-white transition-colors"
            >
              登录
            </Link>
            <Link
              href="/register"
              className="group relative px-5 py-1.5 overflow-hidden rounded-full bg-white text-black text-sm font-semibold transition-all hover:scale-105 active:scale-95"
            >
              <span className="relative z-10">免费注册</span>
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500 opacity-0 group-hover:opacity-10 transition-opacity" />
            </Link>
          </div>
        </div>
      </nav>

      {/* ─── Hero Section ─── */}
      <section className="relative z-10 pt-44 pb-32 px-6 flex flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ opacity, scale }}
          className="flex flex-col items-center"
        >
          {/* Badge */}
          <div className="mb-8 p-px rounded-full bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-pink-500/20">
            <div className="px-5 py-1.5 rounded-full bg-background border border-white/5 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-xs font-medium text-indigo-300/80 tracking-wide uppercase">AI 驱动的下一代学习工作法</span>
            </div>
          </div>

          {/* Headline */}
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tight text-white mb-8">
            <span className="inline-block">掌控你的</span>
            <br />
            <span className="bg-gradient-to-b from-indigo-300 via-indigo-400 to-indigo-600 bg-clip-text text-transparent">
              认知生产力
            </span>
          </h1>

          {/* Subtitle */}
          <p className="max-w-2xl text-lg md:text-xl text-slate-400/80 leading-relaxed mb-12">
            StudySolo 重新定义了学习。从海量信息到内化知识，
            <br className="hidden md:block" />
            AI 助你构建一套完整且自动化的认知闭环。
          </p>

          {/* CTA Group */}
          <div className="flex flex-col sm:flex-row items-center gap-5">
            <Link
              href="/login"
              className="group w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_30px_rgba(79,70,229,0.5)] transition-all hover:-translate-y-0.5"
            >
              立刻开启
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="#features"
              className="w-full sm:w-auto px-8 py-4 rounded-2xl border border-white/10 text-white/80 font-semibold hover:bg-white/5 transition-colors"
            >
              查看特性
            </Link>
          </div>
        </motion.div>
      </section>

      {/* ─── Features Grid ─── */}
      <section id="features" className="relative z-10 max-w-7xl mx-auto px-6 pb-40">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, idx) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              whileHover={{ y: -8, transition: { duration: 0.2 } }}
              className="group relative p-8 rounded-3xl bg-white/[0.02] border border-white/[0.05] hover:border-indigo-500/30 transition-all cursor-default overflow-hidden"
            >
              {/* Blur Background */}
              <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full blur-[40px] opacity-0 group-hover:opacity-40 transition-opacity bg-gradient-to-br ${feature.color}`} />

              {/* Icon Container */}
              <div className={`w-14 h-14 rounded-2xl mb-8 flex items-center justify-center bg-gradient-to-br ${feature.color} border border-white/10`}>
                <feature.icon className={`w-7 h-7 ${feature.iconColor}`} />
              </div>

              <h3 className="text-xl font-bold text-white mb-3">
                {feature.title}
              </h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                {feature.description}
              </p>

              <div className="mt-8 flex items-center gap-2 text-xs font-bold text-indigo-400 opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0">
                了解更多 <ChevronRight className="w-4 h-4" />
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ─── Simple Footer ─── */}
      <footer className="relative z-10 py-12 border-t border-white/5 text-center">
        <div className="flex items-center justify-center gap-2 mb-4 opacity-50">
          <Zap className="w-4 h-4" />
          <span className="text-sm font-bold tracking-widest uppercase">StudySolo</span>
        </div>
        <p className="text-xs text-slate-500 font-medium">
          © {new Date().getFullYear()} StudySolo. Crafted for the bright minds.
        </p>
      </footer>
    </main>
  );
}
