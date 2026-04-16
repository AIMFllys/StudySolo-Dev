import { motion } from 'framer-motion';
import { LANDING_TECH_STACK } from './landing-content';

export function LandingTechStack() {
  return (
    <section className="relative z-10 py-20 px-6 md:px-12 lg:px-24 max-w-7xl mx-auto border-t border-slate-200/60 bg-white/50">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center mb-12"
      >
        <h2 className="text-3xl md:text-4xl font-bold text-slate-900 font-serif tracking-tight">技术架构</h2>
        <p className="mt-3 text-slate-500 font-serif text-lg">生产级全栈架构，已上线运行</p>
      </motion.div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
        {LANDING_TECH_STACK.map((item, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: idx * 0.05 }}
            className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm"
          >
            <div className="text-xl font-bold text-blue-600 font-mono">{item.value}</div>
            <div className="text-xs text-slate-500 mt-1 font-serif">{item.label}</div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
