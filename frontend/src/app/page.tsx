"use client";

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Brain,
  FileText,
  Network,
  ArrowRight,
  BookOpen,
  PenTool
} from 'lucide-react';

/* ─── Feature data ─── */
const features = [
  {
    icon: Network,
    id: '01',
    title: '智能大纲计算',
    description: '输入目标，AI 深入分析并生成逻辑严密的结构化学习大纲，建立基础认知拓扑。',
  },
  {
    icon: Brain,
    id: '02',
    title: '知识提炼网络',
    description: '穿透海量信息噪音，锁定核心概念并构建高维动态知识图谱。',
  },
  {
    icon: FileText,
    id: '03',
    title: '高维特征归纳',
    description: '自动化繁为简，生成多层级压缩笔记与总结，实现深度内化重组。',
  },
  {
    icon: BookOpen,
    id: '04',
    title: '间隔重复投影',
    description: '基于记忆遗忘曲线模型，无损转换笔记为高保真复习闪卡架构。',
  }
];

export default function LandingPage() {

  return (
    <main className="relative min-h-screen bg-[#fcfbf9] text-slate-800 selection:bg-blue-100 selection:text-blue-900 overflow-x-hidden antialiased font-sans">
      
      {/* ─── Grid System Overlay (Notebook Style) ─── */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-[0.6]">
        <div className="w-full h-full" style={{ backgroundImage: 'linear-gradient(to right, #e2e8f0 1px, transparent 1px), linear-gradient(to bottom, #e2e8f0 1px, transparent 1px)', backgroundSize: '1.5rem 1.5rem' }} />
      </div>
      
      {/* ─── Paper Margins ─── */}
      <div className="fixed top-0 bottom-0 left-6 md:left-12 w-[2px] bg-red-400/20 z-0" />
      <div className="fixed top-0 bottom-0 left-[28px] md:left-[52px] w-px bg-red-400/20 z-0" />

      {/* ─── Navigation ─── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#fcfbf9]/80 backdrop-blur-md border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto flex items-center justify-between h-16 px-6 md:px-12 lg:px-24">
          <div className="flex items-center gap-2">
            <PenTool className="w-5 h-5 text-blue-600" />
            <span className="text-lg font-bold tracking-tight text-slate-900">
              StudySolo
            </span>
          </div>

          <div className="flex items-center h-full gap-4 md:gap-8">
            <Link
              href="/login"
              className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors"
            >
              登录
            </Link>
            <Link
              href="/register"
              className="text-sm font-medium bg-slate-900 text-white px-5 py-2 rounded-lg hover:bg-slate-800 transition-colors shadow-sm"
            >
              开始做笔记
            </Link>
          </div>
        </div>
      </nav>

      {/* ─── Hero Section ─── */}
      <section className="relative z-10 pt-40 pb-24 md:pt-48 md:pb-32 px-6 md:px-12 lg:px-24 max-w-7xl mx-auto">
        <div className="flex flex-col items-start gap-8">
          {/* Tag */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 px-4 py-1.5 rounded-full border border-slate-200 bg-white text-xs font-medium text-slate-500 shadow-sm"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            <span>AI 驱动的学习工作流</span>
          </motion.div>

          {/* Title */}
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.8 }}
            className="text-5xl md:text-7xl lg:text-[5.5rem] font-bold tracking-tight text-slate-900 leading-[1.15]"
          >
            重塑你的<br />
            <span className="text-blue-600 relative">
              知识拓扑边界
              <svg className="absolute w-full h-3 -bottom-2 left-0 text-blue-200 -z-10" viewBox="0 0 100 10" preserveAspectRatio="none">
                <path d="M0 5 Q 50 10 100 5" stroke="currentColor" strokeWidth="8" fill="transparent" />
              </svg>
            </span>
          </motion.h1>

          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-6 flex flex-col gap-4 max-w-2xl font-serif text-lg md:text-xl text-slate-600 leading-relaxed"
          >
            <p>
              摒弃消费级应用的信息碎片。
            </p>
            <p>
              StudySolo 是一款为极客与重度脑力工作者打造的研究引擎。
              通过结构化的工作流辅助，化繁为简，让学习重新获得穿透噪音的力量。
            </p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="flex items-center gap-4 mt-8"
          >
            <Link
              href="/register"
              className="group flex items-center justify-center gap-2 bg-slate-900 text-white px-8 py-4 rounded-xl font-medium hover:bg-slate-800 transition-all hover:shadow-lg hover:-translate-y-0.5"
            >
              <span>开启学习之旅</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ─── Features Section ─── */}
      <section className="relative z-10 py-24 px-6 md:px-12 lg:px-24 max-w-7xl mx-auto border-t border-slate-200/60 bg-white/50">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-10">
          {features.map((feature, idx) => (
            <motion.div
              key={feature.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1, duration: 0.5 }}
              className="group bg-white p-8 lg:p-10 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-200 transition-all flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 text-slate-600 flex items-center justify-center group-hover:bg-blue-50 group-hover:text-blue-600 group-hover:border-blue-100 transition-all">
                  <feature.icon className="w-5 h-5 stroke-[1.5]" />
                </div>
                <span className="text-2xl font-light text-slate-300 font-mono group-hover:text-blue-200 transition-colors">
                  {feature.id}
                </span>
              </div>
              
              <div>
                <h3 className="text-xl font-bold text-slate-900 mb-3 tracking-tight">
                  {feature.title}
                </h3>
                <p className="text-slate-600 leading-relaxed font-serif">
                  {feature.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="relative z-10 px-6 py-12 border-t border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between text-sm text-slate-500">
          <div>{new Date().getFullYear()} © StudySolo. All rights reserved.</div>
          <div className="flex gap-8 mt-4 md:mt-0 font-medium">
            <span className="hover:text-slate-900 transition-colors cursor-pointer">使用文档</span>
            <span className="hover:text-slate-900 transition-colors cursor-pointer">服务条款</span>
            <span className="hover:text-slate-900 transition-colors cursor-pointer">关于我们</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
