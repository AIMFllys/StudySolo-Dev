import { motion } from 'framer-motion';
import { LANDING_FEATURES } from './landing-content';

export function LandingFeatureGrid() {
  return (
    <section className="relative z-10 py-24 px-6 md:px-12 lg:px-24 max-w-7xl mx-auto border-t border-slate-200/60 bg-white/50">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="mb-12"
      >
        <h2 className="text-3xl md:text-4xl font-bold text-slate-900 font-serif tracking-tight">平台核心能力</h2>
        <p className="mt-3 text-slate-500 font-serif text-lg">不是单一智能体，而是让你创建、运行、共享智能体流程的完整平台</p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {LANDING_FEATURES.map((feature, idx) => (
          <motion.div
            key={feature.id}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: idx * 0.08, duration: 0.5 }}
            className="group bg-white p-8 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-200 transition-all flex flex-col justify-between"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 text-slate-600 flex items-center justify-center group-hover:bg-blue-50 group-hover:text-blue-600 group-hover:border-blue-100 transition-all">
                <feature.icon className="w-5 h-5 stroke-[1.5]" />
              </div>
              <span className="text-2xl font-light text-slate-300 font-mono group-hover:text-blue-200 transition-colors">
                {feature.id}
              </span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 mb-2 tracking-tight font-serif">
                {feature.title}
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed font-serif">
                {feature.description}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
