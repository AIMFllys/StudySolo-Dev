import React, { useState, useEffect, useCallback } from 'react';

interface WorkflowNode {
    id: number;
    status: 'pending' | 'running' | 'done';
    label: string;
    subtitle: string;
    type: 'trigger' | 'llm' | 'action';
    x: number;
    y: number;
    color: string;
    icon: string;
}

const initialNodes: WorkflowNode[] = [
    { id: 1, status: 'pending', label: '联网检索 (Search)', subtitle: '搜集最新资讯与文献', type: 'trigger', x: 60, y: 160, color: '#6366F1', icon: 'travel_explore' },
    { id: 2, status: 'pending', label: '多模型协同 (LLM)', subtitle: '交叉比对分析数据...', type: 'llm', x: 380, y: 160, color: '#10B981', icon: 'psychology' },
    { id: 3, status: 'pending', label: '知识图谱 (Graph)', subtitle: '生成可视化结构导图', type: 'action', x: 740, y: 60, color: '#8B5CF6', icon: 'account_tree' },
    { id: 4, status: 'pending', label: '文件导出 (Export)', subtitle: '输出 PDF 学习报告', type: 'action', x: 740, y: 260, color: '#F59E0B', icon: 'picture_as_pdf' },
];

const logMessages = [
    { id: 1, title: '初始化 DAG 引擎', time: '200ms', text: 'DAG Engine started. Dispatching task to node_web_search...' },
    { id: 2, title: '联网检索节点', time: '1.2s', text: '成功: 检索到 5 篇权威文献。知识库抽取信息完毕...' },
    { id: 3, title: '大模型分析节点', time: '处理中...', text: '> 融合知识库与联网数据...\n> [DeepSeek-R1] 深度推理中...' },
    { id: 4, title: '多端输出完成', time: '800ms', text: '✓ 知识图谱渲染完成.\n✓ PDF 学习报告导出完成.' },
];

const WorkflowDemo: React.FC = () => {
    const [nodes, setNodes] = useState<WorkflowNode[]>(initialNodes);
    const [currentNode, setCurrentNode] = useState(-1);
    const [isRunning, setIsRunning] = useState(false);
    const [logs, setLogs] = useState<typeof logMessages>([]);

    const runWorkflow = useCallback(() => {
        setNodes(initialNodes.map(n => ({ ...n, status: 'pending' })));
        setLogs([]);
        setIsRunning(true);
        setCurrentNode(0);
    }, []);

    useEffect(() => {
        if (!isRunning || currentNode < 0 || currentNode > initialNodes.length) return;

        // If at the end, mark all as done
        if (currentNode === initialNodes.length) {
            setIsRunning(false);
            setCurrentNode(-1);
            return;
        }

        // Branching logic: node 3 and 4 execute simultaneously after node 2
        let nodesToActivate = [currentNode];
        if (currentNode === 2) {
            nodesToActivate = [2, 3]; // activate 3 and 4 together
        }

        setNodes(prev => prev.map((n, i) => nodesToActivate.includes(i) ? { ...n, status: 'running' } : n));

        // Add log entry
        if (currentNode < logMessages.length) {
            // only add if not already added (for branch step)
            if (currentNode !== 3) {
                setLogs(prev => [...prev, logMessages[currentNode]]);
            }
        }

        const delay = currentNode === 1 ? 2500 : 1200; // LLM takes longer
        const timer = setTimeout(() => {
            setNodes(prev => prev.map((n, i) => nodesToActivate.includes(i) ? { ...n, status: 'done' } : n));

            if (currentNode === 1) { // Node 2 finished, move to Node 3 & 4 (which is step 2 in array logic)
                setCurrentNode(2);
            } else if (currentNode === 2) { // Node 3 & 4 finished, end
                // We add the final log
                setLogs(prev => [...prev, logMessages[3]]);
                setCurrentNode(initialNodes.length);
            } else {
                setCurrentNode(prev => prev + 1);
            }
        }, delay);

        return () => clearTimeout(timer);
    }, [currentNode, isRunning]);

    // Calculate dynamic paths for SVG
    // Node center basically: x + 120, y + 40
    const paths = [
        { id: 'p1', from: 0, to: 1, c1x: 250, c2x: 250 },
        { id: 'p2', from: 1, to: 2, c1x: 650, c2x: 650 },
        { id: 'p3', from: 1, to: 3, c1x: 650, c2x: 650 }
    ];

    const allDone = nodes.every(n => n.status === 'done');

    return (
        <section className="section" id="workflow" style={{ position: 'relative', overflow: 'hidden' }}>
            <div className="container" style={{ position: 'relative', zIndex: 1, maxWidth: '1400px' }}>
                <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
                    <span className="section-label">🎬 工作空间仪表盘</span>
                    <h2 className="section-title">工作流引擎实况</h2>
                    <p className="section-subtitle">
                        所见即所得的节点拓扑编排。随时监控执行状态、Tokens开销与执行日志。
                    </p>
                </div>

                {/* Dashboard Window UI  */}
                <div style={{
                    width: '100%', height: '700px',
                    margin: '0 auto',
                    background: '#020617', // Enforced dark high-tech background for immersive realism
                    borderRadius: '16px',
                    border: '1px solid rgba(255,255,255,0.08)',
                    boxShadow: '0 30px 60px -15px rgba(0,0,0,0.6), 0 0 100px -20px rgba(99,102,241,0.15)',
                    overflow: 'hidden',
                    display: 'flex', flexDirection: 'column',
                    color: '#F8FAFC',
                    fontFamily: 'var(--font-sans)',
                }}>
                    {/* Header Top Bar */}
                    <header style={{
                        height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '0 1rem', background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(12px)',
                        borderBottom: '1px solid rgba(255,255,255,0.08)', zIndex: 30
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{
                                width: '32px', height: '32px', background: 'rgba(99,102,241,0.2)', color: '#6366f1',
                                border: '1px solid rgba(99,102,241,0.2)', borderRadius: '8px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                boxShadow: '0 0 15px rgba(99,102,241,0.3)'
                            }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>bolt</span>
                            </div>
                            <h1 style={{ fontSize: '1.125rem', fontWeight: 600, letterSpacing: '-0.025em', background: 'linear-gradient(to right, #ffffff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>StudySolo</h1>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{
                                display: 'none', // hide on small, show on md logically, we simulate desktop here
                                alignItems: 'center', background: 'rgba(15,23,42,0.5)',
                                padding: '6px 12px', borderRadius: '999px', border: '1px solid rgba(255,255,255,0.05)',
                                width: '250px'
                            }} className="md-flex flex">
                                <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#64748b' }}>search</span>
                                <span style={{ marginLeft: '8px', fontSize: '0.875rem', color: '#64748b' }}>搜索工作流...</span>
                            </div>
                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                                <button
                                    onClick={runWorkflow}
                                    disabled={isRunning}
                                    style={{
                                        background: isRunning ? 'rgba(99,102,241,0.2)' : '#6366f1',
                                        color: '#fff', fontSize: '0.875rem', fontWeight: 500,
                                        padding: '6px 16px', borderRadius: '999px',
                                        border: isRunning ? '1px solid rgba(99,102,241,0.4)' : '1px solid rgba(99,102,241,0.2)',
                                        display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: isRunning ? 'wait' : 'pointer',
                                        boxShadow: isRunning ? 'none' : '0 4px 15px rgba(99,102,241,0.3)',
                                        transition: 'all 0.2s', fontFamily: 'inherit'
                                    }}>
                                    <span style={{ fontSize: '1.125rem' }} className="material-symbols-outlined">{isRunning ? 'sync' : allDone ? 'refresh' : 'play_arrow'}</span>
                                    {isRunning ? '引擎运行中' : allDone ? '重新执行' : '启动执行'}
                                </button>
                            </div>
                        </div>
                    </header>

                    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                        {/* Left Sidebar - Hidden on small, visible on large */}
                        <aside style={{
                            width: '280px', background: '#020617', borderRight: '1px solid rgba(255,255,255,0.08)',
                            display: 'flex', flexDirection: 'column', zIndex: 20
                        }} className="hidden lg-flex">
                            <div style={{ padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                    <h2 style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em' }}>我的工作流</h2>
                                    <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#64748b', cursor: 'pointer' }}>filter_list</span>
                                </div>
                                {/* Active Item */}
                                <div style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: '0.5rem', background: 'rgba(99,102,241,0.1)', borderRadius: '8px',
                                    border: '1px solid rgba(99,102,241,0.3)', boxShadow: '0 0 15px rgba(99,102,241,0.1)',
                                    cursor: 'pointer'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', overflow: 'hidden' }}>
                                        <div style={{ padding: '6px', borderRadius: '6px', background: 'rgba(99,102,241,0.2)', color: '#6366f1' }}>
                                            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>smart_toy</span>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#fff' }}>演示执行流</span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: isRunning ? '#10b981' : '#f59e0b', animation: isRunning ? 'pulse 2s infinite' : 'none' }}></span>
                                                <span style={{ fontSize: '0.625rem', color: isRunning ? '#10b981' : '#f59e0b', fontWeight: 500 }}>{isRunning ? '运行中' : '空闲'}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div style={{ flex: 1, padding: '0.5rem', overflowY: 'auto' }}>
                                {/* Inactive Item */}
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem',
                                    borderRadius: '8px', cursor: 'pointer', border: '1px solid transparent',
                                }}>
                                    <span className="material-symbols-outlined" style={{ color: '#64748b' }}>description</span>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#e2e8f0' }}>研究助手</span>
                                        <span style={{ fontSize: '0.6875rem', color: '#475569' }}>上次运行: 2小时前</span>
                                    </div>
                                </div>
                            </div>
                        </aside>

                        {/* Center Canvas */}
                        <main style={{ flex: 1, position: 'relative', background: '#050b1d', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                            {/* Toolbar Map Controls */}
                            <div style={{
                                position: 'absolute', top: '1rem', left: '1rem', zIndex: 10,
                                display: 'flex', gap: '0.5rem', background: 'rgba(15,23,42,0.8)',
                                backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.1)',
                                padding: '6px', borderRadius: '8px', boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
                            }}>
                                <button style={{ padding: '6px', borderRadius: '4px', color: '#fff', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' }}><span className="material-symbols-outlined" style={{ fontSize: '20px' }}>near_me</span></button>
                                <button style={{ padding: '6px', borderRadius: '4px', color: '#94a3b8', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' }}><span className="material-symbols-outlined" style={{ fontSize: '20px' }}>pan_tool</span></button>
                            </div>

                            {/* Canvas Grid Background & Elements */}
                            <div style={{
                                flex: 1, position: 'relative', overflow: 'hidden',
                                backgroundImage: 'radial-gradient(circle, rgba(255, 255, 255, 0.05) 1px, transparent 1px)',
                                backgroundSize: '40px 40px', cursor: 'grab'
                            }}>
                                {/* SVG Connections Layer */}
                                <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0, overflow: 'visible' }}>
                                    {paths.map(p => {
                                        const src = nodes[p.from];
                                        const dst = nodes[p.to];
                                        const startX = src.x + 240; // width of node roughly 240
                                        const startY = src.y + 45;  // mid height
                                        const endX = dst.x;
                                        const endY = dst.y + 45;

                                        const isActiveLine = (src.status === 'done' || src.status === 'running') && dst.status !== 'pending';

                                        return (
                                            <g key={p.id}>
                                                <path
                                                    d={`M${startX},${startY} C${p.c1x},${startY} ${p.c2x},${endY} ${endX},${endY}`}
                                                    fill="none" stroke={isActiveLine ? src.color : '#334155'} strokeWidth="2"
                                                    strokeOpacity={isActiveLine ? "0.6" : "0.3"}
                                                    strokeDasharray={!isActiveLine ? "5,5" : "none"}
                                                    style={{ transition: 'all 0.5s ease' }}
                                                />
                                                {/* Animated dots running along the curve if running */}
                                                {src.status === 'done' && dst.status === 'running' && (
                                                    <circle r="4" fill={dst.color} style={{ filter: `drop-shadow(0 0 6px ${dst.color})` }}>
                                                        <animateMotion dur="2s" repeatCount="indefinite" path={`M${startX},${startY} C${p.c1x},${startY} ${p.c2x},${endY} ${endX},${endY}`} />
                                                    </circle>
                                                )}
                                            </g>
                                        );
                                    })}
                                </svg>

                                {/* Nodes Layer */}
                                {nodes.map((node) => {
                                    const isPending = node.status === 'pending';
                                    const isRunning = node.status === 'running';
                                    const isDone = node.status === 'done';

                                    const bgStyle = isRunning
                                        ? `linear-gradient(145deg, ${node.color}15 0%, rgba(15,23,42,0.9) 100%)`
                                        : isPending
                                            ? 'rgba(15,23,42,0.6)'
                                            : `linear-gradient(145deg, rgba(30,41,59,0.8) 0%, rgba(15,23,42,0.95) 100%)`;

                                    const borderStyle = isRunning
                                        ? `1px solid ${node.color}`
                                        : isPending
                                            ? '1px dashed rgba(255,255,255,0.15)'
                                            : '1px solid rgba(255,255,255,0.1)';

                                    const shadowStyle = isRunning ? `0 0 25px ${node.color}30` : '0 10px 20px rgba(0,0,0,0.4)';

                                    return (
                                        <div key={node.id} style={{
                                            position: 'absolute', left: node.x, top: node.y, width: '240px',
                                            background: bgStyle, backdropFilter: 'blur(12px)',
                                            border: borderStyle, borderRadius: '12px',
                                            boxShadow: shadowStyle, zIndex: isRunning ? 10 : 1,
                                            opacity: isPending ? 0.6 : 1, transition: 'all 0.4s ease',
                                            pointerEvents: 'auto'
                                        }}>
                                            {/* Input/Output Ports */}
                                            <div style={{ position: 'absolute', left: '-6px', top: '50%', transform: 'translateY(-50%)', width: '10px', height: '10px', borderRadius: '50%', background: isRunning || isDone ? node.color : '#334155', border: '2px solid #0f172a', transition: 'all 0.3s' }} />
                                            <div style={{ position: 'absolute', right: '-6px', top: '50%', transform: 'translateY(-50%)', width: '10px', height: '10px', borderRadius: '50%', background: isDone ? node.color : '#334155', border: '2px solid #0f172a', transition: 'all 0.3s' }} />

                                            {/* Node Header */}
                                            <div style={{
                                                padding: '0.75rem 1rem', borderBottom: isPending ? '1px solid transparent' : '1px solid rgba(255,255,255,0.06)',
                                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                background: isRunning ? `${node.color}10` : 'transparent', borderTopLeftRadius: '12px', borderTopRightRadius: '12px'
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span className="material-symbols-outlined" style={{ fontSize: '16px', color: isRunning ? node.color : isDone ? '#94a3b8' : '#475569', animation: isRunning && node.type === 'llm' ? 'spin 3s linear infinite' : 'none' }}>
                                                        {node.icon}
                                                    </span>
                                                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#fff', letterSpacing: '-0.01em' }}>{node.label}</span>
                                                </div>
                                                {/* Mini Status Badge */}
                                                <span style={{
                                                    fontSize: '0.55rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px',
                                                    background: isRunning ? `${node.color}20` : 'rgba(255,255,255,0.05)',
                                                    color: isRunning ? node.color : '#64748b', border: isRunning ? `1px solid ${node.color}40` : '1px solid transparent'
                                                }}>
                                                    {isRunning ? 'RUNNING' : isDone ? 'DONE' : 'WAITING'}
                                                </span>
                                            </div>

                                            {/* Node Body */}
                                            <div style={{ padding: '0.75rem 1rem' }}>
                                                <p style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: isRunning ? '0.75rem' : '0' }}>{node.subtitle}</p>

                                                {isRunning && (
                                                    <div style={{ height: '4px', width: '100%', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                                                        <div style={{ height: '100%', width: '60%', background: `linear-gradient(90deg, transparent, ${node.color})`, animation: 'shimmer 1.5s infinite' }} />
                                                    </div>
                                                )}

                                                {isDone && node.type === 'llm' && (
                                                    <div style={{ marginTop: '0.5rem', background: 'rgba(0,0,0,0.3)', padding: '6px', borderRadius: '4px', fontSize: '0.65rem', color: '#a78bfa', fontFamily: 'var(--font-mono)' }}>
                                                        &gt; 推理完成: Token 耗时 1.8s
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Zoom/Minimap Mock */}
                            <div style={{
                                position: 'absolute', bottom: '1.5rem', right: '1.5rem',
                                display: 'flex', alignItems: 'center', background: 'rgba(15,23,42,0.8)',
                                backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '999px', padding: '4px', boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
                            }}>
                                <button style={{ width: '30px', height: '30px', borderRadius: '50%', color: '#94a3b8', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' }}><span className="material-symbols-outlined" style={{ fontSize: '18px' }}>remove</span></button>
                                <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', width: '48px', textAlign: 'center', color: '#cbd5e1' }}>100%</span>
                                <button style={{ width: '30px', height: '30px', borderRadius: '50%', color: '#94a3b8', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' }}><span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span></button>
                            </div>
                        </main>

                        {/* Right Sidebar - Execution Log */}
                        <aside style={{
                            width: '340px', background: '#020617', borderLeft: '1px solid rgba(255,255,255,0.08)',
                            display: 'flex', flexDirection: 'column', zIndex: 20, boxShadow: '-10px 0 30px rgba(0,0,0,0.3)'
                        }} className="hidden md-flex flex">
                            <div style={{
                                padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.08)',
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#050b1d'
                            }}>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <h2 style={{ fontSize: '0.75rem', fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.05em' }}>执行日志</h2>
                                    <span style={{ fontSize: '0.625rem', color: '#64748b', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>ID: 8823-AF</span>
                                </div>
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px',
                                    borderRadius: '4px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)',
                                    boxShadow: '0 0 10px rgba(16,185,129,0.1)'
                                }}>
                                    <span style={{ width: '6px', height: '6px', background: '#10b981', borderRadius: '50%', animation: 'pulse 2s infinite' }}></span>
                                    <span style={{ fontSize: '0.625rem', color: '#10b981', fontWeight: 700 }}>实时监控</span>
                                </div>
                            </div>

                            {/* Log Items Stream */}
                            <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                {logs.length === 0 && (
                                    <div style={{ textAlign: 'center', color: '#475569', fontSize: '0.8rem', marginTop: '2rem' }}>
                                        {isRunning ? '引擎启动中...' : '等待工作流触发...'}
                                    </div>
                                )}

                                {logs.map((log, index) => {
                                    const isLast = index === logs.length - 1;
                                    const isProcessing = isLast && isRunning;

                                    return (
                                        <div key={log.id} style={{ position: 'relative', paddingLeft: '1.5rem', borderLeft: `1px solid ${isProcessing ? 'rgba(99,102,241,0.5)' : '#334155'}` }}>
                                            <div style={{
                                                position: 'absolute', left: '-6px', top: '0', width: '11px', height: '11px', borderRadius: '50%',
                                                background: isProcessing ? '#fff' : '#6366f1', border: '3px solid #020617',
                                                boxShadow: isProcessing ? '0 0 15px rgba(99,102,241,0.8)' : '0 0 8px rgba(99,102,241,0.3)',
                                                animation: isProcessing ? 'pulse 1.5s infinite' : 'none'
                                            }} />

                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: isProcessing ? '#6366f1' : '#fff' }}>{log.title}</span>
                                                <span style={{ fontSize: '0.625rem', color: isProcessing ? '#94a3b8' : '#6366f1', fontFamily: 'var(--font-mono)', background: isProcessing ? 'transparent' : 'rgba(99,102,241,0.1)', padding: '2px 4px', borderRadius: '4px' }}>
                                                    {log.time}
                                                </span>
                                            </div>

                                            <div style={{
                                                background: isProcessing ? 'rgba(0,0,0,0.3)' : '#0b1221', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)',
                                                padding: '0.75rem', fontSize: '0.6875rem', fontFamily: 'var(--font-mono)', color: '#cbd5e1',
                                                boxShadow: isProcessing ? 'inset 0 2px 10px rgba(0,0,0,0.4)' : 'inset 0 2px 4px rgba(0,0,0,0.2)',
                                                whiteSpace: 'pre-wrap' as const, lineHeight: 1.6
                                            }}>
                                                {isProcessing && log.id === 3 ? (
                                                    <React.Fragment>
                                                        <div style={{ color: '#94a3b8', marginBottom: '0.5rem' }}>融合知识库与联网数据...</div>
                                                        <div style={{ color: '#fff' }}>&gt; 路由平台: <span style={{ color: '#60a5fa' }}>[DeepSeek-R1, Qwen-Max]</span></div>
                                                        <div style={{ color: '#6366f1', marginTop: '0.25rem' }}>&gt; 深度推理中<span style={{ display: 'inline-block', width: '4px', height: '10px', background: '#6366f1', marginLeft: '4px', animation: 'blink 1s infinite' }} /></div>
                                                    </React.Fragment>
                                                ) : (
                                                    log.text
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Bottom Stats */}
                            <div style={{ padding: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.08)', background: '#050b1d' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.5rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                        <p style={{ fontSize: '0.5625rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Token数</p>
                                        <p style={{ fontSize: '0.875rem', fontFamily: 'var(--font-mono)', fontWeight: 500, color: '#fff', marginTop: '4px' }}>
                                            {isRunning && currentNode === 1 ? '512' : isRunning && currentNode > 1 ? '1,240' : allDone ? '2,890' : '0'} <span style={{ fontSize: '0.5625rem', color: '#64748b' }}>/ 8k</span>
                                        </p>
                                    </div>
                                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.5rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                        <p style={{ fontSize: '0.5625rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>预估成本</p>
                                        <p style={{ fontSize: '0.875rem', fontFamily: 'var(--font-mono)', fontWeight: 500, color: '#fff', marginTop: '4px' }}>
                                            ${isRunning && currentNode === 1 ? '0.001' : isRunning && currentNode > 1 ? '0.004' : allDone ? '0.009' : '0.000'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </aside>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default WorkflowDemo;
