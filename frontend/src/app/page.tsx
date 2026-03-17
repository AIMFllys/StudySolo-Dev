"use client";

import Link from 'next/link';
import { motion, useScroll, useTransform } from 'framer-motion';
import {
  Cpu,
  Microscope,
  Database,
  Network,
  ArrowRight,
  TerminalSquare
} from 'lucide-react';
import { useEffect, useState } from 'react';

/* ─── Feature data ─── */
const features = [
  {
    icon: Network,
    id: 'SYS.01',
    title: '智能大纲计算',
    description: '输入目标，AI 深入分析并生成逻辑严密的结构化学习大纲，建立基础认知拓扑。',
  },
  {
    icon: Cpu,
    id: 'SYS.02',
    title: '知识提炼网络',
    description: '穿透海量信息噪音，锁定核心概念并构建高维动态知识图谱。',
  },
  {
    icon: Database,
    id: 'SYS.03',
    title: '高维特征归纳',
    description: '自动化繁为简，生成多层级压缩笔记与总结，实现深度内化重组。',
  },
  {
    icon: Microscope,
    id: 'SYS.04',
    title: '间隔重复投影',
    description: '基于记忆遗忘曲线模型，无损转换笔记为高保真复习闪卡架构。',
  }
];

export default function LandingPage() {
  const { scrollY } = useScroll();
  const yOffset = useTransform(scrollY, [0, 500], [0, 100]);

  return (
    <main className="relative min-h-screen bg-[#070707] text-white selection:bg-lime-400/30 selection:text-lime-400 overflow-x-hidden font-mono antialiased">
      
      {/* ─── Brutalist Grid System Overlay ─── */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-[0.04]">
        <div className="w-full h-full" style={{ backgroundImage: 'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)', backgroundSize: '100px 100px' }} />
      </div>
      
      {/* Noise Texture */}
      <div className="fixed inset-0 z-[1] pointer-events-none opacity-[0.03]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }} />

      {/* ─── Technical Navigation ─── */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-[#070707]/90 backdrop-blur-md">
        <div className="flex items-center justify-between h-16 w-full">
          {/* Brand */}
          <div className="flex-1 flex items-center h-full border-r border-white/10 px-6 max-w-[280px]">
            <TerminalSquare className="w-5 h-5 text-lime-400 mr-3" />
            <span className="text-sm font-bold tracking-[0.2em] text-white uppercase">
              STUDY/SOLO_
            </span>
          </div>

          {/* Status Bar (Fake) */}
          <div className="hidden lg:flex flex-1 items-center h-full px-6 border-r border-white/10 text-[10px] text-white/40 tracking-widest space-x-8">
            <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-lime-400" /> SYS: ONLINE</span>
            <span>MEM: ALLOCATED</span>
            <span>LATENCY: 12MS</span>
          </div>

          {/* Actions */}
          <div className="flex items-center h-full">
            <Link
              href="/login"
              className="h-full px-8 flex items-center text-xs font-bold tracking-widest text-white/50 hover:text-white border-l border-white/10 transition-colors uppercase hover:bg-white/5"
            >
              Auth_
            </Link>
            <Link
              href="/register"
              className="h-full px-8 flex items-center text-xs font-bold tracking-widest bg-lime-400 text-black border-l border-white/10 hover:bg-white transition-colors uppercase"
            >
              Init_Sequence
            </Link>
          </div>
        </div>
      </nav>

      {/* ─── Brutalist Hero Section ─── */}
      <section className="relative z-10 pt-32 pb-24 border-b border-white/10">
        <div className="grid grid-cols-1 lg:grid-cols-12 max-w-[100vw]">
          
          <motion.div 
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="col-span-1 border-r border-white/10 hidden lg:flex items-end justify-center pb-12"
          >
            <div className="writing-vertical text-[10px] tracking-[0.3em] text-white/20 uppercase rotate-180" style={{ writingMode: 'vertical-rl' }}>
              V.2.0_COGNITIVE_ENGINE // AWAITING_INPUT
            </div>
          </motion.div>

          <div className="col-span-1 lg:col-span-11 px-6 lg:px-12 py-12 flex flex-col justify-center">
            {/* Minimal metadata tag */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="flex items-center gap-4 mb-10"
            >
              <div className="w-2 h-2 bg-lime-400 animate-pulse" />
              <span className="text-[10px] text-lime-400 font-bold tracking-[0.2em] uppercase bg-lime-400/10 px-3 py-1 border border-lime-400/20">
                AI_WORKFLOW_ARCHITECTURE // ACTIVATE
              </span>
            </motion.div>

            {/* Massive Tyrannical Typography */}
            <motion.h1 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="text-6xl md:text-8xl lg:text-[10rem] font-black tracking-tighter leading-[0.85] text-white mb-16 uppercase"
            >
              Cognitive<br />
              <span className="text-transparent" style={{ WebkitTextStroke: '2px rgba(255,255,255,0.8)' }}>
                Productivity.
              </span>
            </motion.h1>

            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="grid grid-cols-1 md:grid-cols-12 gap-12 mt-8 lg:w-4/5 border-t border-white/10 pt-12"
            >
              <div className="md:col-span-7">
                <p className="text-sm md:text-base text-white/50 leading-relaxed font-sans">
                  摒弃消费级 SaaS 的平淡。StudySolo 是一款为极客与重度脑力工作者打造的研究引擎。通过完全可编程的 AI 工作流网络，穿透信息噪音，重塑你的知识拓扑边界。
                </p>
              </div>
              <div className="md:col-span-5 flex flex-col gap-4">
                <Link
                  href="/login"
                  className="group relative flex items-center justify-between px-6 py-5 border border-white/20 bg-[#111] hover:bg-lime-400 hover:border-lime-400 hover:text-black transition-all overflow-hidden"
                >
                  <span className="relative z-10 text-sm font-bold tracking-[0.15em] uppercase">EXECUTE_SYSTEM</span>
                  <ArrowRight className="relative z-10 w-5 h-5 group-hover:translate-x-2 transition-transform" />
                  {/* Glitch hover effect background */}
                  <div className="absolute inset-0 bg-white/20 -translate-x-full group-hover:translate-x-0 transition-transform duration-300 ease-out" />
                </Link>
                <div className="text-[10px] text-white/30 uppercase tracking-[0.1em] text-right">
                  ACCESS REQUIRES AUTHORIZATION // VER 2.0.4
                </div>
              </div>
            </motion.div>

          </div>
        </div>
      </section>

      {/* ─── Broken Grid Features Section ─── */}
      <section id="features" className="relative z-10 border-b border-white/10 block">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 w-full">
          {features.map((feature, idx) => (
            <motion.div
              key={feature.id}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ delay: idx * 0.1, duration: 0.4 }}
              className={`group relative p-8 lg:p-12 border-b border-r border-white/10 hover:bg-white/[0.02] hover:border-white/30 transition-all cursor-crosshair flex flex-col justify-between min-h-[360px] ${
                idx === features.length - 1 ? 'border-r-0 lg:border-r-0' : ''
              } ${
                idx % 2 === 1 ? 'md:border-r-0 lg:border-r' : ''
              }`}
            >
              {/* Top Meta */}
              <div className="flex items-start justify-between mb-16">
                <span className="text-[10px] text-lime-400 font-bold tracking-[0.15em] bg-lime-400/5 px-2 py-1 border border-lime-400/20">{feature.id}</span>
                <feature.icon className="w-6 h-6 text-white/20 group-hover:text-lime-400 group-hover:scale-110 transition-all" strokeWidth={1} />
              </div>

              {/* Bottom Content */}
              <div>
                <h3 className="text-xl font-bold text-white mb-4 tracking-tight uppercase">
                  {feature.title}
                </h3>
                <p className="text-white/40 text-sm font-sans leading-relaxed">
                  {feature.description}
                </p>
              </div>

              {/* Crosshair markers on corners (aesthetic only) */}
              <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-lime-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-lime-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            </motion.div>
          ))}
        </div>
      </section>

      {/* ─── Technical Footer ─── */}
      <footer className="relative z-10 px-6 py-8 flex flex-col md:flex-row items-center justify-between text-[10px] text-white/30 tracking-widest uppercase font-mono">
        <div>SYS.RENDER // {new Date().getFullYear()} © STUDYSOLO CORE</div>
        <div className="flex gap-8 mt-4 md:mt-0">
          <span className="hover:text-lime-400 transition-colors cursor-pointer">DOCS</span>
          <span className="hover:text-lime-400 transition-colors cursor-pointer">API_SPECS</span>
          <span className="hover:text-lime-400 transition-colors cursor-pointer">PROTOCOL</span>
        </div>
        <div className="mt-4 md:mt-0 opacity-50">END_OF_FILE.</div>
      </footer>
    </main>
  );
}
