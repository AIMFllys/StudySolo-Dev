import Link from 'next/link';
import { motion } from 'framer-motion';
import { UserPlus, ArrowRight, LogIn, Info } from 'lucide-react';

export function LandingCta() {
  return (
    <section className="relative z-10 py-24 px-6 md:px-12 lg:px-24 max-w-7xl mx-auto border-t border-slate-200/60 text-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
      >
        <h2 className="text-3xl md:text-4xl font-bold text-slate-900 font-serif tracking-tight mb-4">
          开始构建你的学习工作流
        </h2>
        <p className="text-slate-500 font-serif text-lg mb-10 max-w-xl mx-auto">
          免费注册，用自然语言描述学习目标，让 AI 为你编排智能体工作流
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/register"
            className="group flex items-center gap-2 bg-slate-900 text-white px-8 py-4 rounded-xl font-medium hover:bg-slate-800 transition-all hover:shadow-lg hover:-translate-y-0.5"
          >
            <UserPlus className="w-4 h-4" />
            免费注册
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link
            href="/login"
            className="flex items-center gap-2 text-slate-600 px-8 py-4 rounded-xl font-medium border border-slate-200 hover:border-blue-300 hover:text-blue-600 transition-all"
          >
            <LogIn className="w-4 h-4" />
            登录
          </Link>
          <a
            href="https://StudyFlow.1037solo.com/introduce"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-slate-500 px-6 py-4 rounded-xl font-medium hover:text-blue-600 transition-colors"
          >
            <Info className="w-4 h-4" />
            了解更多
          </a>
        </div>
      </motion.div>
    </section>
  );
}
