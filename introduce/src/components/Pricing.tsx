import { useInView } from '../hooks/useInView';

// Pricing based on README tier system
const TIERS = [
  {
    id: 'free',
    tier: 'FREE',
    price: '¥0',
    period: '/月',
    desc: '适合初步了解和轻度体验平台能力的用户。',
    featured: false,
    cta: '免费开始',
    ctaUrl: 'https://StudyFlow.1037solo.com',
    features: [
      '基础工作流创建与执行',
      '社区工作流浏览与收藏',
      '标准节点（15种）',
      '有限的 AI 模型调用配额',
      '单一工作流上限',
    ],
    note: null,
  },
  {
    id: 'pro',
    tier: 'PRO',
    price: '¥29',
    period: '/月',
    desc: '适合日常学习自动化需求的个人用户和学生。',
    featured: true,
    cta: '立即升级',
    ctaUrl: 'https://StudyFlow.1037solo.com',
    features: [
      '所有免费功能',
      '全部 18 种节点解锁',
      '更高 AI 调用配额',
      '工作流发布至社区',
      '自定义并发布节点',
      '优先模型路由（能力固定策略）',
      '知识库文件上传',
    ],
    note: '最受欢迎',
  },
  {
    id: 'pro_plus',
    tier: 'PRO+',
    price: '¥79',
    period: '/月',
    desc: '适合高频使用、重度学习场景和教师用户。',
    featured: false,
    cta: '联系了解',
    ctaUrl: 'mailto:contact@1037solo.com',
    features: [
      '所有 PRO 功能',
      '最高级别调用配额',
      '管理后台访问权限',
      '使用量统计与审计日志',
      '多端同步优先保障',
      '优先客服支持',
    ],
    note: null,
  },
];

export default function Pricing() {
  const [ref, inView] = useInView<HTMLDivElement>(0.1);

  return (
    <section className="section" id="pricing" ref={ref}>
      <div className="container">
        {/* Header */}
        <div className={`section-header center reveal${inView ? ' visible' : ''}`}>
          <div className="signal-tag">Pricing</div>
          <h2 className="section-title">透明定价，按需选择</h2>
          <p className="section-desc">
            基于 SKU 的模型调用成本核算，会员分层覆盖不同使用场景。平台生产环境已上线：{' '}
            <a href="https://StudyFlow.1037solo.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--green)' }}>
              StudyFlow.1037solo.com
            </a>
          </p>
        </div>

        {/* Pricing grid */}
        <div className={`pricing-grid reveal reveal-delay-2${inView ? ' visible' : ''}`}>
          {TIERS.map(tier => (
            <div key={tier.id} className={`pricing-card${tier.featured ? ' featured' : ''}`}>
              {/* Tier label */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <div className="pricing-tier">{tier.tier}</div>
                  {tier.note && (
                    <div style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.65rem',
                      color: 'var(--green)',
                      background: 'rgba(0,232,122,0.1)',
                      border: '1px solid var(--border-green)',
                      padding: '0.15rem 0.5rem',
                      borderRadius: 'var(--radius-sm)',
                    }}>
                      {tier.note}
                    </div>
                  )}
                </div>
                <div className="pricing-price">
                  {tier.price}
                  <span className="unit">{tier.period}</span>
                </div>
              </div>

              <p className="pricing-desc">{tier.desc}</p>

              <div className="pricing-divider" />

              {/* Features */}
              <div className="pricing-features">
                {tier.features.map(f => (
                  <div key={f} className="pricing-feature">
                    <span className="check">✓</span>
                    <span>{f}</span>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <a
                href={tier.ctaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`btn ${tier.featured ? 'btn-primary' : 'btn-outline'} w-full`}
                style={{ marginTop: 'auto' }}
              >
                {tier.cta}
              </a>
            </div>
          ))}
        </div>

        {/* Footer note */}
        <div className={`reveal reveal-delay-3${inView ? ' visible' : ''}`} style={{
          marginTop: '2rem',
          padding: '1rem 1.5rem',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.75rem',
        }}>
          <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', flexShrink: 0 }}>ⓘ</span>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.7 }}>
            定价方案仍在优化中，以平台实际展示为准。计费基于 AI 模型调用 SKU 成本，精确到模型调用次数。管理后台提供完整的使用量统计和费用明细。如有合作或定制需求，欢迎{' '}
            <a href="mailto:contact@1037solo.com" style={{ color: 'var(--green)' }}>联系我们</a>。
          </p>
        </div>
      </div>
    </section>
  );
}
