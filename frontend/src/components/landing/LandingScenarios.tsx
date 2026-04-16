import { motion } from 'framer-motion';
import { LANDING_SCENARIOS } from './landing-content';

export function LandingScenarios() {
  return (
    <section className="relative z-10 py-24 px-6 md:px-12 lg:px-24 max-w-7xl mx-auto border-t border-slate-200/60">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="mb-12"
      >
        <h2 className="text-3xl md:text-4xl font-bold text-slate-900 font-serif tracking-tight">应用场景</h2>
        <p className="mt-3 text-slate-500 font-serif text-lg">面向大学生及终身学习者，覆盖学习全流程</p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {LANDING_SCENARIOS.map((s, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: idx * 0.1, duration: 0.5 }}
            className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all"
          >
            <h3 className="text-lg font-bold text-slate-900 mb-3 font-serif">{s.title}</h3>
            <p className="text-sm text-slate-600 leading-relaxed font-serif">{s.desc}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
