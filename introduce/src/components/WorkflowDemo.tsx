import { useState, useEffect, useRef } from 'react';
import { useInView } from '../hooks/useInView';

// Accurate node data from competition spec
const DAG_NODES = [
  { id: 'trigger', label: 'trigger_input', type: '输入节点', icon: '▸', category: 'input' },
  { id: 'analyzer', label: 'ai_analyzer', type: '分析节点', icon: '◈', category: 'analyze' },
  { id: 'outline', label: 'outline_gen', type: '生成节点', icon: '⊞', category: 'generate' },
  { id: 'summary', label: 'summary', type: '生成节点', icon: '◉', category: 'generate' },
  { id: 'flashcard', label: 'flashcard', type: '生成节点', icon: '⊹', category: 'generate' },
  { id: 'export', label: 'export_file', type: '输出节点', icon: '↓', category: 'output' },
];

const LOG_SEQUENCE = [
  { ts: '00:00.000', type: 'info', msg: 'DAG Executor initialized' },
  { ts: '00:00.012', type: 'info', msg: 'Topo sort: 6 nodes, 5 edges' },
  { ts: '00:00.015', type: 'info', msg: '[trigger_input] → RUNNING' },
  { ts: '00:00.089', type: 'ok',   msg: '[trigger_input] → DONE (74ms)' },
  { ts: '00:00.091', type: 'info', msg: '[ai_analyzer] → RUNNING' },
  { ts: '00:00.093', type: 'model', msg: 'Router: DeepSeek-V3 (native_first)' },
  { ts: '00:02.341', type: 'ok',   msg: '[ai_analyzer] → DONE (2250ms, 847 tokens)' },
  { ts: '00:02.343', type: 'info', msg: '[outline_gen] → RUNNING' },
  { ts: '00:02.344', type: 'model', msg: 'Router: Qwen-MAX (capability_fixed)' },
  { ts: '00:04.891', type: 'ok',   msg: '[outline_gen] → DONE (2548ms)' },
  { ts: '00:04.892', type: 'info', msg: '[summary] → RUNNING' },
  { ts: '00:07.234', type: 'ok',   msg: '[summary] → DONE (2342ms)' },
  { ts: '00:07.235', type: 'info', msg: '[flashcard] → RUNNING' },
  { ts: '00:09.102', type: 'ok',   msg: '[flashcard] → DONE (JSON structured output)' },
  { ts: '00:09.104', type: 'info', msg: '[export_file] → RUNNING' },
  { ts: '00:09.287', type: 'ok',   msg: '[export_file] → DONE (Markdown exported)' },
  { ts: '00:09.290', type: 'info', msg: 'workflow_done · total: 9.29s · nodes: 6/6' },
];

const NODE_COLORS: Record<string, string> = {
  input: 'var(--green)',
  analyze: 'var(--ice)',
  generate: 'var(--orange)',
  output: 'var(--green)',
};

type NodeStatus = 'pending' | 'running' | 'done';

export default function WorkflowDemo() {
  const [ref, inView] = useInView<HTMLDivElement>(0.15);
  const [isRunning, setIsRunning] = useState(false);
  const [nodeStatuses, setNodeStatuses] = useState<Record<string, NodeStatus>>(
    Object.fromEntries(DAG_NODES.map(n => [n.id, 'pending']))
  );
  const [nodeBars, setNodeBars] = useState<Record<string, number>>(
    Object.fromEntries(DAG_NODES.map(n => [n.id, 0]))
  );
  const [logs, setLogs] = useState<typeof LOG_SEQUENCE>([]);
  const logRef = useRef<HTMLDivElement>(null);
  const timeoutRefs = useRef<ReturnType<typeof setTimeout>[]>([]);

  const reset = () => {
    timeoutRefs.current.forEach(clearTimeout);
    timeoutRefs.current = [];
    setIsRunning(false);
    setNodeStatuses(Object.fromEntries(DAG_NODES.map(n => [n.id, 'pending'])));
    setNodeBars(Object.fromEntries(DAG_NODES.map(n => [n.id, 0])));
    setLogs([]);
  };

  const run = () => {
    reset();
    setIsRunning(true);

    const nodeTimings = [
      { id: 'trigger',   start: 100,  end: 600   },
      { id: 'analyzer',  start: 700,  end: 3200  },
      { id: 'outline',   start: 3300, end: 5500  },
      { id: 'summary',   start: 5600, end: 7800  },
      { id: 'flashcard', start: 7900, end: 9800  },
      { id: 'export',    start: 9900, end: 10500 },
    ];

    nodeTimings.forEach(({ id, start, end }) => {
      const t1 = setTimeout(() => {
        setNodeStatuses(prev => ({ ...prev, [id]: 'running' }));
        // Progress bar
        const step = 50;
        const steps = Math.floor((end - start) / step);
        for (let s = 1; s <= steps; s++) {
          const tp = setTimeout(() => {
            setNodeBars(prev => ({ ...prev, [id]: Math.min(100, (s / steps) * 100) }));
          }, s * step);
          timeoutRefs.current.push(tp);
        }
      }, start);

      const t2 = setTimeout(() => {
        setNodeStatuses(prev => ({ ...prev, [id]: 'done' }));
        setNodeBars(prev => ({ ...prev, [id]: 100 }));
      }, end);

      timeoutRefs.current.push(t1, t2);
    });

    // Logs
    let logDelay = 100;
    LOG_SEQUENCE.forEach((log, i) => {
      const delay = 100 + i * 580;
      logDelay = delay;
      const t = setTimeout(() => {
        setLogs(prev => [...prev, log]);
        if (logRef.current) {
          logRef.current.scrollTop = logRef.current.scrollHeight;
        }
      }, delay);
      timeoutRefs.current.push(t);
    });

    const tDone = setTimeout(() => setIsRunning(false), logDelay + 600);
    timeoutRefs.current.push(tDone);
  };

  useEffect(() => {
    return () => timeoutRefs.current.forEach(clearTimeout);
  }, []);

  return (
    <section className="section workflow-section" id="workflow" ref={ref}>
      <div className="container">
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1.5rem', marginBottom: '2.5rem' }}>
          <div className={`section-header reveal${inView ? ' visible' : ''}`} style={{ marginBottom: 0 }}>
            <div className="signal-tag">Live Demo</div>
            <h2 className="section-title">DAG 执行引擎实况</h2>
            <p className="section-desc" style={{ maxWidth: 480 }}>
              自研执行引擎将工作流图拓扑排序，通过 ExecutionContext 黑板模型在节点间传递结果，SSE 全程流式推送。
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexShrink: 0 }}>
            <button
              className="btn btn-primary"
              onClick={run}
              disabled={isRunning}
              style={{ opacity: isRunning ? 0.6 : 1 }}
            >
              {isRunning ? (
                <>
                  <span style={{ display: 'inline-block', animation: 'rotate 0.8s linear infinite' }}>⟳</span>
                  执行中...
                </>
              ) : '▶  运行工作流'}
            </button>
            <button className="btn btn-outline" onClick={reset}>↺ 重置</button>
          </div>
        </div>

        {/* Main layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          {/* DAG Canvas */}
          <div className={`dag-canvas reveal${inView ? ' visible' : ''} reveal-delay-1`}>
            <div className="dag-header">
              <div className="dag-dot" style={{ background: '#ff5f57' }} />
              <div className="dag-dot" style={{ background: '#febc2e' }} />
              <div className="dag-dot" style={{ background: '#28c840' }} />
              <span className="dag-title">workflow_canvas.dag</span>
              {isRunning && (
                <span style={{
                  marginLeft: 'auto',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.65rem',
                  color: 'var(--green)',
                }}>
                  ◉ EXECUTING
                </span>
              )}
            </div>

            <div className="dag-body">
              {DAG_NODES.map((node, i) => {
                const status = nodeStatuses[node.id];
                const bar = nodeBars[node.id];
                return (
                  <div key={node.id}>
                    <div className={`dag-node ${status}`}>
                      <span className="dag-node-icon" style={{ color: NODE_COLORS[node.category] }}>
                        {node.icon}
                      </span>
                      <div className="dag-node-info">
                        <div className="dag-node-name">{node.label}</div>
                        <div className="dag-node-type">{node.type}</div>
                      </div>
                      <div className={`dag-node-status ${status}`}>
                        {status === 'running' ? 'RUNNING' : status === 'done' ? 'DONE' : 'PENDING'}
                      </div>
                      {status !== 'pending' && (
                        <div className="dag-node-bar" style={{ width: `${bar}%` }} />
                      )}
                    </div>

                    {/* Connector */}
                    {i < DAG_NODES.length - 1 && (
                      <div className="dag-connector">
                        {[0,1,2].map(d => (
                          <div
                            key={d}
                            className={`dag-connector-dot${status === 'done' ? ' active' : ''}`}
                            style={{ transitionDelay: `${d * 100}ms` }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Terminal log */}
          <div className={`reveal reveal-delay-2${inView ? ' visible' : ''}`}>
            <div className="terminal" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <div className="terminal-header">
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  {['#ff5f57','#febc2e','#28c840'].map(c => (
                    <div key={c} style={{ width: 8, height: 8, borderRadius: '50%', background: c }} />
                  ))}
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                  executor.log — SSE Stream
                </span>
                {isRunning && (
                  <span style={{
                    marginLeft: 'auto',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.65rem',
                    color: 'var(--green)',
                  }}>● LIVE</span>
                )}
              </div>

              <div
                className="terminal-body"
                ref={logRef}
                style={{ flex: 1, height: 'auto', maxHeight: 480 }}
              >
                {logs.length === 0 && (
                  <div style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                    {'// 点击"运行工作流"开始演示'}
                  </div>
                )}
                {logs.map((log, i) => (
                  <div key={i} className="terminal-line">
                    <span className="ts">[{log.ts}]</span>{' '}
                    <span className={log.type}>
                      {log.type === 'ok' ? '✓' : log.type === 'model' ? '⟳' : '·'}
                    </span>{' '}
                    <span className="text">{log.msg}</span>
                  </div>
                ))}
                {isRunning && (
                  <div className="terminal-line">
                    <span className="ts">[--:--.---]</span>{' '}
                    <span className="info">{'>'}</span>{' '}
                    <span className="terminal-cursor">_</span>
                  </div>
                )}
                {!isRunning && logs.length > 0 && (
                  <div className="terminal-line" style={{ marginTop: '0.5rem' }}>
                    <span style={{ color: 'var(--green)' }}>✓ Workflow completed successfully</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Info note */}
        <div style={{
          marginTop: '1.5rem',
          padding: '0.85rem 1.25rem',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          background: 'rgba(255,255,255,0.02)',
        }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}>ⓘ</span>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            以上为前端演示动画，真实执行引擎位于{' '}
            <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--ice)', fontSize: '0.78rem' }}>
              backend/app/engine/executor.py
            </code>
            ，可在{' '}
            <a href="https://StudyFlow.1037solo.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--green)' }}>
              StudyFlow.1037solo.com
            </a>{' '}
            体验真实工作流执行。
          </span>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .workflow-grid { grid-template-columns: 1fr !important; }
        }
        .dag-node-status.running { color: var(--green); background: rgba(0,232,122,0.1); }
        .dag-node-status.done { color: var(--ice); background: rgba(0,212,255,0.1); }
        .dag-node-status.pending { color: var(--text-muted); background: rgba(255,255,255,0.04); }
        .terminal-line .ts { color: var(--text-muted); }
        .terminal-line .info { color: var(--ice); }
        .terminal-line .model { color: var(--orange); }
        .terminal-line .ok { color: var(--green); }
        .terminal-line .text { color: var(--text-secondary); }
      `}</style>
    </section>
  );
}
