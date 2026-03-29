import React, { useEffect, useRef } from 'react';

// Use import.meta.env.BASE_URL so images resolve correctly under any deploy path
const heroBg = `${import.meta.env.BASE_URL}images/dashboard_login.png`;
const dashboard1 = `${import.meta.env.BASE_URL}images/dashboard_workspace.png`;

interface HeroProps {
    onStart: () => void;
    onGuide: () => void;
}

/* Particle canvas — lightweight ambient background */
const ParticleBackground: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animId: number;
        const particles: { x: number; y: number; vx: number; vy: number; size: number; alpha: number }[] = [];
        const particleCount = 60;

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        resize();
        window.addEventListener('resize', resize);

        for (let i = 0; i < particleCount; i++) {
            particles.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                vx: (Math.random() - 0.5) * 0.4,
                vy: (Math.random() - 0.5) * 0.4,
                size: Math.random() * 2 + 0.5,
                alpha: Math.random() * 0.5 + 0.1,
            });
        }

        const draw = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            particles.forEach((p, i) => {
                p.x += p.vx;
                p.y += p.vy;
                if (p.x < 0) p.x = canvas.width;
                if (p.x > canvas.width) p.x = 0;
                if (p.y < 0) p.y = canvas.height;
                if (p.y > canvas.height) p.y = 0;

                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(139, 92, 246, ${p.alpha})`;
                ctx.fill();

                // Connect nearby particles
                for (let j = i + 1; j < particles.length; j++) {
                    const dx = particles[j].x - p.x;
                    const dy = particles[j].y - p.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 120) {
                        ctx.beginPath();
                        ctx.moveTo(p.x, p.y);
                        ctx.lineTo(particles[j].x, particles[j].y);
                        ctx.strokeStyle = `rgba(96, 165, 250, ${0.08 * (1 - dist / 120)})`;
                        ctx.lineWidth = 0.5;
                        ctx.stroke();
                    }
                }
            });

            animId = requestAnimationFrame(draw);
        };
        draw();

        return () => {
            cancelAnimationFrame(animId);
            window.removeEventListener('resize', resize);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: 0,
            }}
        />
    );
};

const Hero: React.FC<HeroProps> = ({ onStart, onGuide }) => {
    return (
        <section style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            position: 'relative',
            overflow: 'hidden',
            paddingTop: '80px',
        }}>
            {/* Background image layer */}
            <div style={{
                position: 'absolute',
                inset: 0,
                zIndex: 0,
                opacity: 0.2,
                backgroundImage: `url(${heroBg})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                filter: 'blur(1px)',
            }} />

            {/* Gradient overlay */}
            <div style={{
                position: 'absolute',
                inset: 0,
                zIndex: 1,
                background: `
          radial-gradient(ellipse 80% 50% at 50% -20%, rgba(96, 165, 250, 0.15), transparent),
          radial-gradient(ellipse 60% 40% at 70% 80%, rgba(139, 92, 246, 0.1), transparent),
          linear-gradient(to bottom, transparent 60%, var(--bg-primary))
        `,
            }} />

            {/* Particles */}
            <ParticleBackground />

            {/* Floating decorative elements */}
            <div style={{
                position: 'absolute',
                top: '15%',
                right: '10%',
                width: 120,
                height: 120,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(96,165,250,0.15) 0%, transparent 70%)',
                filter: 'blur(30px)',
                animation: 'float 6s ease-in-out infinite',
                zIndex: 1,
            }} />
            <div style={{
                position: 'absolute',
                bottom: '20%',
                left: '8%',
                width: 160,
                height: 160,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)',
                filter: 'blur(40px)',
                animation: 'float 8s ease-in-out infinite 2s',
                zIndex: 1,
            }} />

            <div className="container" style={{ position: 'relative', zIndex: 10 }}>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr',
                    gap: '4rem',
                    alignItems: 'center',
                }}>
                    {/* Left content */}
                    <div style={{ textAlign: 'center', maxWidth: '860px', margin: '0 auto' }}>
                        {/* Badge */}
                        <div className="animate-fade-in-up" style={{ animationDelay: '0ms', opacity: 0 }}>
                            <span className="section-label" style={{ marginBottom: '2rem' }}>
                                <span style={{ fontSize: '1rem' }}>🚀</span>
                                全新一代 AI 学习赋能平台
                            </span>
                        </div>

                        {/* Headline */}
                        <h1 className="animate-fade-in-up" style={{
                            marginBottom: '1.5rem',
                            lineHeight: 1.08,
                            animationDelay: '100ms',
                            opacity: 0,
                        }}>
                            自然语言生成
                            <br />
                            <span className="text-gradient" style={{ display: 'inline-block' }}>
                                专属 AI 学习工作流
                            </span>
                        </h1>

                        {/* Subtitle */}
                        <p className="animate-fade-in-up" style={{
                            fontSize: 'clamp(1.05rem, 2.5vw, 1.25rem)',
                            color: 'var(--text-secondary)',
                            marginBottom: '2.5rem',
                            maxWidth: '640px',
                            margin: '0 auto 2.5rem auto',
                            lineHeight: 1.9,
                            animationDelay: '200ms',
                            opacity: 0,
                        }}>
                            StudySolo 能将你的学习目标，自动拆解为专业的结构化工作流。
                            DAG 引擎调度<strong style={{ color: 'var(--brand-blue)' }}>18种学习节点</strong>，
                            <strong style={{ color: 'var(--brand-purple)' }}>多模型智能路由</strong>与
                            <strong style={{ color: 'var(--brand-emerald)' }}>SSE 流式追踪</strong>，
                            帮你实现从零到一的体系化知识构建。
                        </p>

                        {/* CTA Buttons */}
                        <div className="animate-fade-in-up" style={{
                            display: 'flex',
                            gap: '1rem',
                            justifyContent: 'center',
                            flexWrap: 'wrap',
                            marginBottom: '3rem',
                            animationDelay: '300ms',
                            opacity: 0,
                        }}>
                            <button
                                className="btn btn-primary"
                                style={{
                                    fontSize: '1.1rem',
                                    padding: '1rem 2.5rem',
                                    borderRadius: 'var(--radius-2xl)',
                                }}
                                onClick={onStart}
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polygon points="5 3 19 12 5 21 5 3" />
                                </svg>
                                开启学习之旅
                            </button>
                            <button
                                className="btn btn-outline"
                                style={{
                                    fontSize: '1.1rem',
                                    padding: '1rem 2.5rem',
                                    borderRadius: 'var(--radius-2xl)',
                                }}
                                onClick={onGuide}
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                                    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                                </svg>
                                阅读使用指南
                            </button>
                        </div>

                        {/* Trust badges */}
                        <div className="animate-fade-in-up" style={{
                            display: 'flex',
                            justifyContent: 'center',
                            flexWrap: 'wrap',
                            gap: '2rem',
                            animationDelay: '400ms',
                            opacity: 0,
                        }}>
                            {[
                                { icon: '🤖', text: '自然语言驱动编排' },
                                { icon: '🔀', text: '统一模型智能路由' },
                                { icon: '👁️', text: '全面可视执行追踪' },
                                { icon: '🛠️', text: '18+ 专业预置节点' },
                            ].map((badge, i) => (
                                <div key={i} style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    fontSize: '0.9rem',
                                    color: 'var(--text-muted)',
                                    fontWeight: 500,
                                }}>
                                    <span style={{ fontSize: '1.1rem' }}>{badge.icon}</span>
                                    <span>{badge.text}</span>
                                </div>
                            ))}
                        </div>

                        {/* Stats bar */}
                        <div className="animate-fade-in-up" style={{
                            display: 'flex',
                            justifyContent: 'center',
                            gap: '3rem',
                            marginTop: '4rem',
                            paddingTop: '3rem',
                            borderTop: '1px solid var(--border-color)',
                            flexWrap: 'wrap',
                            animationDelay: '500ms',
                            opacity: 0,
                        }}>
                            {[
                                { number: '18', label: '种专属学习节点' },
                                { number: '8', label: '个全球 AI 模型平台' },
                                { number: '7', label: '类流式追踪事件' },
                                { number: '社区', label: '沉淀共建生态' },
                            ].map((stat, i) => (
                                <div key={i} style={{ textAlign: 'center' }}>
                                    <div className="stat-number" style={{ fontSize: '2rem' }}>{stat.number}</div>
                                    <div className="stat-label">{stat.label}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right/Bottom Image Area (Hero Mockup) */}
                    <div className="animate-fade-in-up delay-600" style={{
                        maxWidth: '1000px',
                        margin: '0 auto',
                        width: '100%',
                        position: 'relative',
                        zIndex: 2,
                    }}>
                        <div className="hero-image-wrapper">
                            <img src={dashboard1} alt="StudySolo Dashboard" />
                            {/* Decorative glowing orb behind image */}
                            <div style={{
                                position: 'absolute',
                                top: '50%',
                                left: '50%',
                                width: '100%',
                                height: '50%',
                                background: 'var(--brand-blue)',
                                opacity: 0.15,
                                transform: 'translate(-50%, -50%)',
                                filter: 'blur(100px)',
                                zIndex: -1,
                                borderRadius: '50%'
                            }} />
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default Hero;
