import Link from 'next/link';
import { motion } from 'framer-motion';
import { UserPlus, ArrowRight, BookOpen, LogIn } from 'lucide-react';

export function LandingHero() {
  return (
    <section className="relative z-10 pt-40 pb-24 md:pt-48 md:pb-32 px-6 md:px-12 lg:px-24 max-w-7xl mx-auto">
      <div className="flex flex-col items-start gap-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 px-4 py-1.5 rounded-full border border-slate-200 bg-white text-xs font-medium text-slate-500 shadow-sm"
        >
          <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
          <span>面向学习场景的智能体可视化编排平台</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.8 }}
          className="text-5xl md:text-7xl lg:text-[5.5rem] font-bold tracking-tight text-slate-900 leading-[1.15] font-serif"
        >
          用自然语言<br />
          <span className="text-blue-600 relative">
            编排学习工作流
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
            StudySolo 是一个让学习智能体可以被任何人创建、执行、分享和持续进化的开放平台。
          </p>
          <p>
            描述你的学习目标，AI 自动生成多步骤工作流。18 种智能体节点覆盖从大纲生成到测验评估的完整学习链路，全程可视化、可编辑、可复用。
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="flex flex-wrap items-center gap-4 mt-8"
        >
          <Link
            href="/register"
            className="group flex items-center justify-center gap-2 bg-slate-900 text-white px-8 py-4 rounded-xl font-medium hover:bg-slate-800 transition-all hover:shadow-lg hover:-translate-y-0.5"
          >
            <UserPlus className="w-4 h-4" />
            <span>免费注册</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
          <a
            href="https://StudyFlow.1037solo.com/introduce"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center justify-center gap-2 bg-white text-slate-700 px-8 py-4 rounded-xl font-medium border border-slate-200 hover:border-blue-300 hover:text-blue-600 transition-all hover:shadow-md hover:-translate-y-0.5"
          >
            <BookOpen className="w-4 h-4" />
            <span>项目介绍</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </a>
          <Link
            href="/login"
            className="flex items-center justify-center gap-2 text-slate-600 px-6 py-4 rounded-xl font-medium hover:text-blue-600 transition-colors"
          >
            <LogIn className="w-4 h-4" />
            <span>已有账号？登录</span>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
