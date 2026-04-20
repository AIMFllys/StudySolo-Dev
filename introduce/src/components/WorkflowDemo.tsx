import { useState, useEffect, useRef, useCallback } from 'react';
import { useInView } from '../hooks/useInView';

/* ── Themes ─────────────────────────────────────────────────────────────── */
const T: Record<string,{cat:string;hc:string;ac:string;bd:React.CSSProperties;in?:React.CSSProperties}> = {
  trigger_input:{cat:'INPUT',     hc:'#475569',ac:'#64748b',bd:{border:'1px dashed #94a3b8'}},
  ai_analyzer:  {cat:'ANALYSIS',  hc:'#065f46',ac:'#059669',bd:{border:'2px solid #065f46'},  in:{border:'0.5px dashed rgba(6,95,70,0.5)'}},
  outline_gen:  {cat:'GENERATION',hc:'#1e1b4b',ac:'#4338ca',bd:{border:'3px solid #1e1b4b'},  in:{border:'0.5px solid rgba(30,27,75,0.35)'}},
  flashcard:    {cat:'ASSESSMENT',hc:'#9f1239',ac:'#e11d48',bd:{border:'2px solid #9f1239'},  in:{borderTop:'0.5px solid rgba(159,18,57,0.3)',borderBottom:'0.5px solid rgba(159,18,57,0.3)'}},
  web_search:   {cat:'SEARCH',    hc:'#155e75',ac:'#0891b2',bd:{borderTop:'1px solid #0e7490',borderRight:'1px solid #0e7490',borderBottom:'1px solid #0e7490',borderLeft:'4px solid #0e7490'}},
  quiz_gen:     {cat:'QUIZ',      hc:'#92400e',ac:'#d97706',bd:{border:'2px solid #b45309'},  in:{borderTop:'1px solid rgba(180,83,9,0.25)',borderBottom:'1px solid rgba(180,83,9,0.25)'}},
  export_file:  {cat:'OUTPUT',    hc:'#52525b',ac:'#71717a',bd:{border:'1.5px dotted #71717a'},in:{border:'0.5px solid rgba(113,113,122,0.2)'}},
};
const IC:Record<string,string>={trigger_input:'▶',ai_analyzer:'◎',outline_gen:'≡',flashcard:'♦',web_search:'⌖',quiz_gen:'?',export_file:'↓'};

/* ── Quiz Data ──────────────────────────────────────────────────────────── */
const QZ=[
  {q:'在 AI Agent 框架中，"工具调用（Tool Use）"的核心作用是？',
   opts:['让 LLM 直接与外部世界交互，扩展能力边界','压缩模型参数以加快推理速度','将自然语言翻译为可执行代码','用于 API 接口的身份验证'],ans:0},
  {q:'DAG（有向无环图）在 Agentic 工作流中的核心优势是？',
   opts:['允许工作流循环执行任意次数','保证执行顺序与数据依赖关系一致，防止死锁','减少 LLM 的 API 调用次数','使工作流只能串行运行'],ans:1},
  {q:'ReAct（Reasoning + Acting）模式中，Agent 的核心执行循环是？',
   opts:['Plan → Execute → Validate → Report','Observe → Think → Act（循环直到完成）','Input → Process → Output','Query → Retrieve → Generate'],ans:1},
];

/* ── Node Data ──────────────────────────────────────────────────────────── */
const NW=272;
interface N{id:string;t:string;x:number;y:number;h:number;label:string;desc:string;model?:string;log:string[];out:string;dur:string;editable?:boolean}
const NODES:N[]=[
  {id:'n01',t:'trigger_input', x:16,  y:210,h:148,label:'学习目标输入',   desc:'接收用户学习目标与约束条件，作为整个工作流的推导入口',log:['Parsing user intent...','Extracting constraints depth=4...','Building context payload...','goal: "AI Agent技术基础" ✓'],out:'{\n  "goal": "AI Agent技术基础",\n  "depth": 4,\n  "style": "academic"\n}',dur:'12ms',editable:true},
  {id:'n02',t:'ai_analyzer',   x:348, y:210,h:132,label:'需求深度分析',   desc:'调用 DeepSeek-V3 分析目标，提取结构化知识图谱',model:'DeepSeek-V3',log:['→ DeepSeek-V3 tokens: 312 in','Streaming response chunks...','Parsing structured JSON...','chapters: 4 topics: 10 ✓'],out:'{\n  "chapters": 4,\n  "topics": [\n    "Agent基础",\n    "Tool Use",\n    "ReAct模式",\n    "工作流编排"\n  ]\n}',dur:'721ms'},
  {id:'n03',t:'outline_gen',   x:680, y:210,h:132,label:'学习大纲生成',   desc:'形成清晰的知识结构与章节顺序，输出多级嵌套大纲',model:'Qwen-MAX', log:['→ Qwen-MAX API call','Generating structured outline...','Validating chapter depth (4)...','大纲结构生成完成 ✓'],out:'{\n  "outline": [\n    {"ch": 1, "title": "Agent基础概念"},\n    {"ch": 2, "title": "工具调用"},\n    {"ch": 3, "title": "ReAct框架"},\n    {"ch": 4, "title": "DAG工作流"}\n  ]\n}',dur:'1.1s'},
  {id:'n04',t:'flashcard',     x:1012,y:50, h:128,label:'闪卡生成',        desc:'提取关键概念，生成 Agent 领域 Q&A 记忆闪卡包',model:'DeepSeek-V3',log:['Processing chapters...','Extracting concepts (24)...','Building Q&A index...','24 flashcards ✓'],out:'[\n  {"front": "什么是ReAct模式?", "back": "Reasoning+..."},\n  {"front": "DAG的作用?", "back": "管理执行依赖"},\n  ... 22 more cards\n]',dur:'534ms'},
  {id:'n05',t:'web_search',    x:1012,y:210,h:128,label:'Agent 资料检索', desc:'搜索 AI Agent 权威技术资料，补充前沿研究来源',log:['Query: "AI Agent ReAct Tool Use"','Fetching top 5 results...','Deduplicating sources...','4 quality sources ✓'],out:'{\n  "sources": 4,\n  "content_tokens": 3120,\n  "quality_score": 0.94\n}',dur:'1.8s'},
  {id:'n07',t:'quiz_gen',      x:1012,y:370,h:148,label:'AI Agent 测验',  desc:'基于大纲生成 Agent 技术测验，支持画布内可展开作答',model:'Qwen-MAX', log:['Analyzing outline chapters...','Generating 3 MCQ questions...','Calibrating difficulty level...','Quiz pack ready ✓'],out:'▸ 3 道 AI Agent 测验题已生成\n▸ 请在下方展开测验面板进行作答',dur:'891ms'},
  {id:'n06',t:'export_file',   x:1344,y:210,h:132,label:'学习文档导出',   desc:'整合所有输出，导出 Txt 文本摘要并归档',log:['Merging chapter outputs...','Appending flashcard index...','Formatting Plain Text (8,940 tokens)...','→ /exports/AI-Agent技术基础_2026.txt ✓'],out:'📄 /exports/AI-Agent技术基础_2026.txt\n✓ 8,940 tokens | Plain Text Format',dur:'78ms'},
];
const NM=Object.fromEntries(NODES.map(n=>[n.id,n]));
const EDGES=[
  {id:'e1',f:'n01',t:'n02'},{id:'e2',f:'n02',t:'n03'},
  {id:'e3',f:'n03',t:'n04'},{id:'e4',f:'n03',t:'n05'},{id:'e8',f:'n03',t:'n07'},
  {id:'e5',f:'n04',t:'n06'},{id:'e6',f:'n05',t:'n06'},{id:'e9',f:'n07',t:'n06'},
];
const sh=(n:N)=>({x:n.x+NW,y:n.y+n.h/2});
const th=(n:N)=>({x:n.x,     y:n.y+n.h/2});
const bez=(sx:number,sy:number,tx:number,ty:number)=>{
  const dx=Math.abs(tx-sx)*0.42;
  return `M ${sx} ${sy} C ${sx+dx} ${sy}, ${tx-dx} ${ty}, ${tx} ${ty}`;
};

/* ── LogStream ──────────────────────────────────────────────────────────── */
function LogStream({lines,active}:{lines:string[];active:boolean}){
  const [cnt,setCnt]=useState(0);
  useEffect(()=>{
    if(!active){setCnt(0);return;}
    let i=0;
    const iv=setInterval(()=>{i++;setCnt(i);if(i>=lines.length)clearInterval(iv);},420);
    return()=>clearInterval(iv);
  },[active,lines]);
  return(
    <div>
      {lines.slice(0,cnt).map((l,i)=>(
        <div key={i} style={{fontFamily:'var(--font-mono)',fontSize:11,lineHeight:'20px',color:l.includes('✓')?'#10b981':'#64748b'}}>{l}</div>
      ))}
      {active&&cnt<lines.length&&<div style={{fontFamily:'var(--font-mono)',fontSize:11,color:'#94a3b8',animation:'wfBlink 0.9s step-end infinite'}}>▌</div>}
    </div>
  );
}

/* ── QuizSlip ───────────────────────────────────────────────────────────── */
function QuizSlip(){
  const [ans,setAns]=useState<Record<number,number>>({});
  const [rev,setRev]=useState<Record<number,boolean>>({});
  const labels=['A','B','C','D'];
  return(
    <div style={{padding:'12px 14px',display:'flex',flexDirection:'column',gap:14}}>
      {QZ.map((q,qi)=>(
        <div key={qi} style={{paddingBottom:qi<QZ.length-1?12:0,borderBottom:qi<QZ.length-1?'1px dashed #fde68a':undefined}}>
          <div style={{fontFamily:'Georgia,serif',fontSize:12,fontWeight:600,color:'#1c1917',marginBottom:8,lineHeight:1.5}}>Q{qi+1}. {q.q}</div>
          <div style={{display:'flex',flexDirection:'column',gap:4}}>
            {q.opts.map((opt,oi)=>{
              const sel=ans[qi]===oi, ok=oi===q.ans;
              let bg='transparent',bc='#e7e5e4',tc='#44403c';
              if(sel&&!rev[qi]){bg='#eff6ff';bc='#93c5fd';tc='#1d4ed8';}
              if(rev[qi]&&sel&&ok){bg='#f0fdf4';bc='#86efac';tc='#166534';}
              if(rev[qi]&&sel&&!ok){bg='#fff1f2';bc='#fca5a5';tc='#991b1b';}
              if(rev[qi]&&!sel&&ok){bg='#f0fdf4';bc='#86efac';tc='#166534';}
              return(
                <button key={oi} onClick={()=>{
                  if(rev[qi])return;
                  setAns(p=>({...p,[qi]:oi}));
                  setTimeout(()=>setRev(p=>({...p,[qi]:true})),350);
                }} style={{display:'flex',alignItems:'flex-start',gap:8,padding:'6px 10px',borderRadius:5,border:`1px solid ${bc}`,background:bg,cursor:rev[qi]?'default':'pointer',textAlign:'left',transition:'all 0.2s',width:'100%'}}>
                  <span style={{fontFamily:'var(--font-mono)',fontSize:10,fontWeight:700,color:tc,minWidth:14,marginTop:1}}>{labels[oi]}</span>
                  <span style={{fontFamily:'Georgia,serif',fontSize:11.5,color:tc,lineHeight:1.4,flex:1}}>{opt}</span>
                  {rev[qi]&&ok&&<span style={{marginLeft:'auto',fontSize:11,color:'#16a34a',flexShrink:0}}>✓</span>}
                  {rev[qi]&&sel&&!ok&&<span style={{marginLeft:'auto',fontSize:11,color:'#dc2626',flexShrink:0}}>✗</span>}
                </button>
              );
            })}
          </div>
          {rev[qi]&&<div style={{marginTop:5,fontFamily:'var(--font-mono)',fontSize:10,color:ans[qi]===q.ans?'#16a34a':'#dc2626'}}>
            {ans[qi]===q.ans?'✓ 回答正确！':'✗ 正确答案: '+labels[q.ans]}
          </div>}
        </div>
      ))}
    </div>
  );
}

/* ── ResultSlip ─────────────────────────────────────────────────────────── */
function ResultSlip({node,running,done}:{node:N;running:boolean;done:boolean}){
  const [exp,setExp]=useState(false);
  const th_=T[node.t];
  useEffect(()=>{if(done&&node.t==='quiz_gen')setExp(true);},[done,node.t]);
  if(!running&&!done)return null;
  return(
    <div onMouseDown={e=>e.stopPropagation()} style={{marginTop:6,width:'100%',background:'rgba(255,253,247,0.95)',border:'1px dashed #e7e5e4',borderRadius:6,overflow:'hidden',boxShadow:'0 2px 8px rgba(0,0,0,0.05)'}}>
      <div onClick={e=>{e.stopPropagation();setExp(p=>!p);}}
        style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'6px 12px',cursor:'pointer',userSelect:'none'}}>
        <div style={{display:'flex',alignItems:'center',gap:7}}>
          <div style={{width:7,height:7,borderRadius:'50%',background:running?'#3b82f6':'#10b981',animation:running?'wfPulse 1s ease infinite':undefined,flexShrink:0}}/>
          <span style={{fontFamily:'var(--font-mono)',fontSize:10,color:running?'#3b82f6':'#059669'}}>{running?'执行中...':'运行成功 · '+node.dur}</span>
        </div>
        <span style={{fontSize:11,color:'#a8a29e',userSelect:'none'}}>{exp?'▴':'▾'}</span>
      </div>
      {exp&&<div style={{borderTop:'1px solid #f5f5f4'}}>
        {node.t==='quiz_gen'&&done?<QuizSlip/>:(
          <div style={{padding:'10px 12px'}}>
            <div style={{fontFamily:'var(--font-mono)',fontSize:9.5,color:'#a8a29e',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:6}}>Output Payload</div>
            <div style={{fontFamily:'var(--font-mono)',fontSize:10,color:th_.hc,lineHeight:1.6,wordBreak:'break-all',whiteSpace:'pre-wrap',background:`${th_.ac}12`,border:`1px solid ${th_.ac}30`,borderRadius:6,padding:'8px 10px',maxHeight:140,overflowY:'auto'}}>{node.out}</div>
          </div>
        )}
      </div>}
    </div>
  );
}

/* ── NodeGroup (card + slip) ────────────────────────────────────────────── */
function NodeGroup({n,running,done,selected,goal,onGoal,onSelect}:{n:N;running:boolean;done:boolean;selected:boolean;goal:string;onGoal:(v:string)=>void;onSelect:()=>void}){
  const t=T[n.t];
  return(
    <div style={{position:'absolute',left:n.x,top:n.y,width:NW}}>
      <div onClick={onSelect} style={{background:'#fff',borderRadius:6,padding:'14px 16px',cursor:'pointer',boxShadow:selected?`0 0 0 2.5px ${t.ac}50,0 8px 28px rgba(0,0,0,0.09)`:'0 2px 10px rgba(0,0,0,0.06)',transform:running?'translateY(-3px) scale(1.01)':'translateY(0)',transition:'box-shadow 0.2s,transform 0.25s',position:'relative',...t.bd}}>
        {t.in&&<div style={{position:'absolute',inset:n.t==='flashcard'?'14px 4px':4,pointerEvents:'none',...t.in}}/>}
        <div style={{position:'absolute',left:-5,top:'50%',transform:'translateY(-50%)',width:10,height:10,borderRadius:'50%',background:t.hc,border:'2px solid white',boxShadow:running?`0 0 0 4px ${t.ac}30`:'none',transition:'box-shadow 0.3s'}}/>
        <div style={{position:'absolute',right:-5,top:'50%',transform:'translateY(-50%)',width:10,height:10,borderRadius:'50%',background:t.hc,border:'2px solid white',boxShadow:done?`0 0 0 4px ${t.ac}30`:'none',transition:'box-shadow 0.3s'}}/>
        <div style={{position:'relative',zIndex:1}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
            <div style={{display:'flex',alignItems:'center',gap:5}}>
              <span style={{fontSize:11,color:t.hc}}>{IC[n.t]}</span>
              <span style={{fontFamily:'var(--font-mono)',fontSize:9.5,fontWeight:700,color:t.hc,letterSpacing:'0.07em',textTransform:'uppercase'}}>#{n.id}_{t.cat}</span>
              {n.model&&<span style={{fontFamily:'var(--font-mono)',fontSize:8.5,background:'#f0fdf4',color:'#15803d',border:'1px solid #bbf7d0',borderRadius:3,padding:'1px 4px'}}>{n.model}</span>}
            </div>
            {running&&<span style={{fontFamily:'var(--font-mono)',fontSize:8.5,background:'#e0f2fe',color:'#0284c7',border:'1px solid #bae6fd',borderRadius:3,padding:'1px 6px',animation:'wfPulse 1.4s ease infinite'}}>ACTIVE</span>}
            {done&&!running&&<span style={{fontFamily:'var(--font-mono)',fontSize:8.5,background:'#ecfdf5',color:'#16a34a',border:'1px solid #bbf7d0',borderRadius:3,padding:'1px 6px'}}>✓ DONE</span>}
          </div>
          <h3 style={{fontFamily:'Georgia,"Times New Roman",serif',fontSize:15,fontWeight:700,color:'#0f172a',marginBottom:6,lineHeight:1.25}}>{n.label}</h3>
          {n.editable?(
            <textarea value={goal} onChange={e=>onGoal(e.target.value)} onClick={e=>e.stopPropagation()} onMouseDown={e=>e.stopPropagation()} rows={2} style={{width:'100%',fontFamily:'var(--font-mono)',fontSize:10.5,color:'#334155',background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:4,padding:'5px 8px',resize:'none',outline:'none',lineHeight:1.55,boxSizing:'border-box'}}/>
          ):(
            <p style={{fontFamily:'Georgia,serif',fontSize:11.5,color:'#64748b',lineHeight:1.5,margin:0}}>{n.desc}</p>
          )}
          {running&&<div style={{marginTop:8,height:2,background:'#e2e8f0',borderRadius:1,overflow:'hidden'}}><div style={{height:'100%',background:t.ac,borderRadius:1,animation:'wfProgress 2.1s linear forwards'}}/></div>}
          {done&&!running&&(
            <div style={{marginTop:8,paddingTop:7,borderTop:'1px dashed #e2e8f0',display:'flex',justifyContent:'space-between'}}>
              <span style={{fontFamily:'var(--font-mono)',fontSize:9.5,color:'#10b981'}}>✓ {n.dur}</span>
              <span style={{fontFamily:'var(--font-mono)',fontSize:9.5,color:'#94a3b8',maxWidth:155,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{n.out.slice(0,35)}…</span>
            </div>
          )}
        </div>
      </div>
      <ResultSlip node={n} running={running} done={done}/>
    </div>
  );
}

/* ── DraggableCanvas ────────────────────────────────────────────────────── */
const CW=1344+NW+24, CH=600;
function DraggableCanvas({children,eset,dset}:{children:React.ReactNode;eset:Set<string>;dset:Set<string>}){
  const [pan,setPan]=useState({x:-160,y:0});
  const dr=useRef(false);
  const ds=useRef({sx:0,sy:0,px:0,py:0});
  const raf=useRef<number|null>(null);
  const nextPan=useRef(pan);
  const moved=useRef(false);
  const onDown=(e:React.MouseEvent)=>{dr.current=true;moved.current=false;ds.current={sx:e.clientX,sy:e.clientY,px:pan.x,py:pan.y};};
  const onMove=(e:React.MouseEvent)=>{
    if(!dr.current)return;
    const dx=e.clientX-ds.current.sx,dy=e.clientY-ds.current.sy;
    if(Math.abs(dx)>3||Math.abs(dy)>3)moved.current=true;
    nextPan.current={x:ds.current.px+dx,y:ds.current.py+dy};
    if(raf.current===null){
      raf.current=window.requestAnimationFrame(()=>{
        setPan(nextPan.current);
        raf.current=null;
      });
    }
  };
  const onUp=()=>{dr.current=false;};
  useEffect(()=>()=>{if(raf.current!==null)window.cancelAnimationFrame(raf.current);},[]);
  return(
    <div onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
      style={{background:'#f8fafc',backgroundImage:'linear-gradient(rgba(148,163,184,0.18) 1px,transparent 1px),linear-gradient(90deg,rgba(148,163,184,0.18) 1px,transparent 1px)',backgroundSize:'28px 28px',borderRadius:12,border:'1px solid #e2e8f0',minHeight:580,height:'100%',overflow:'hidden',cursor:'grab',position:'relative',userSelect:'none',touchAction:'none'}}>
      <div style={{position:'absolute',bottom:12,right:14,fontFamily:'var(--font-mono)',fontSize:10,color:'#94a3b8',zIndex:20,pointerEvents:'none'}}>
        ✦ 拖拽平移画布 · 点击节点查看详情 · 展开测验节点作答
      </div>
      <div style={{position:'absolute',transform:`translate(${pan.x}px,${pan.y}px)`,width:CW,height:CH,willChange:'transform'}}>
        <svg style={{position:'absolute',inset:0,width:'100%',height:'100%',overflow:'visible',pointerEvents:'none'}}>
          <defs>
            {['g','b','gr'].map(k=>(
              <marker key={k} id={`a-${k}`} markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
                <path d="M0 0 L6 3.5 L0 7Z" fill={k==='b'?'#3b82f6':k==='gr'?'#059669':'#94a3b8'}/>
              </marker>
            ))}
          </defs>
          {EDGES.map(e=>{
            const fN=NM[e.f],tN=NM[e.t];
            const s=sh(fN),t2=th(tN),d=bez(s.x,s.y,t2.x,t2.y);
            const act=eset.has(e.id),dn=dset.has(e.f)&&dset.has(e.t);
            return <path key={e.id} d={d} fill="none"
              stroke={dn?'#059669':act?'#3b82f6':'#cbd5e1'}
              strokeWidth={act||dn?2:1.5}
              strokeDasharray={act?'8 4':undefined}
              style={act?{animation:'wfFlow 0.5s linear infinite'}:{}}
              markerEnd={`url(#a-${dn?'gr':act?'b':'g'})`}/>;
          })}
        </svg>
        {children}
      </div>
    </div>
  );
}

/* ── Main ───────────────────────────────────────────────────────────────── */
export default function WorkflowDemo(){
  const [wRef,inView]=useInView<HTMLDivElement>(0.1);
  const [selId,setSelId]=useState('n01');
  const [runSet,setRun]=useState(new Set<string>());
  const [doneSet,setDone]=useState(new Set<string>());
  const [edgeSet,setEdge]=useState(new Set<string>());
  const [running,setRunning]=useState(false);
  const [goal,setGoal]=useState('帮我系统学习 AI Agent 技术基础，重点理解工具调用与 ReAct 框架。');
  const tms=useRef<ReturnType<typeof setTimeout>[]>([]);
  const clr=useCallback(()=>{tms.current.forEach(clearTimeout);tms.current=[];},[]);
  const push=(fn:()=>void,ms:number)=>tms.current.push(setTimeout(fn,ms));
  const reset=useCallback(()=>{clr();setRun(new Set());setDone(new Set());setEdge(new Set());setRunning(false);},[clr]);

  const runDemo=useCallback(()=>{
    if(running)return;
    reset(); setRunning(true);
    setRun(new Set(['n01'])); setSelId('n01');
    push(()=>{setDone(new Set(['n01']));setEdge(new Set(['e1']));setRun(new Set(['n02']));setSelId('n02');},1800);
    push(()=>{setDone(p=>new Set([...p,'n02']));setEdge(new Set(['e2']));setRun(new Set(['n03']));setSelId('n03');},3900);
    push(()=>{setDone(p=>new Set([...p,'n03']));setEdge(new Set(['e3','e4','e8']));setRun(new Set(['n04','n05','n07']));setSelId('n07');},6100);
    push(()=>{setDone(p=>new Set([...p,'n04','n05','n07']));setEdge(new Set(['e5','e6','e9']));setRun(new Set(['n06']));setSelId('n06');},9800);
    push(()=>{setDone(p=>new Set([...p,'n06']));setEdge(new Set());setRun(new Set());setRunning(false);},11600);
  },[running,reset]);

  useEffect(()=>()=>clr(),[clr]);
  const sel=NM[selId], st=T[sel.t];

  return(
    <section ref={wRef} id="workflow-demo" style={{padding:'100px 0'}}>
      <style>{`
        @keyframes wfBlink{0%,100%{opacity:1}50%{opacity:0}}
        @keyframes wfPulse{0%,100%{opacity:1}50%{opacity:.45}}
        @keyframes wfProgress{from{width:0%}to{width:100%}}
        @keyframes wfFlow{0%{stroke-dashoffset:20}100%{stroke-dashoffset:0}}
      `}</style>
      <div style={{maxWidth:1280,margin:'0 auto',padding:'0 32px'}}>
        {/* Header */}
        <div style={{textAlign:'center',marginBottom:52}}>
          <div style={{display:'inline-flex',alignItems:'center',gap:8,fontFamily:'var(--font-mono)',fontSize:11,color:'var(--text-dim)',letterSpacing:'0.12em',textTransform:'uppercase',border:'1px solid var(--border-subtle)',borderRadius:4,padding:'4px 14px',marginBottom:20}}>WORKFLOW CANVAS</div>
          <h2 style={{fontFamily:'var(--font-display)',fontWeight:800,fontSize:'clamp(30px,4.5vw,52px)',color:'var(--text-primary)',letterSpacing:'-0.03em',lineHeight:1.1,marginBottom:18}}>
            透明可见的思维链路<br/>
            <span className="marker-highlight" style={{fontSize:'clamp(26px,3.8vw,44px)'}}>真实工作流可视化</span>
          </h2>
          <p style={{fontSize:16,color:'var(--text-secondary)',maxWidth:600,margin:'0 auto',lineHeight:1.65}}>
            节点样式与执行状态和实际产品画布完全一致。运行后展开 <strong>AI Agent 测验</strong> 节点结果条，在画布内直接作答。
          </p>
        </div>
        {/* Controls */}
        <div style={{display:'flex',justifyContent:'center',gap:12,marginBottom:28}}>
          <button onClick={runDemo} disabled={running} className="btn-primary" style={{padding:'10px 28px',opacity:running?.65:1}}>
            {running?'▶ 执行中...':'▶ 运行演示'}
          </button>
          <button onClick={reset} className="btn-secondary" style={{padding:'10px 28px'}}>↺ 重置</button>
        </div>
        {/* Layout */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 336px',gap:24,opacity:inView?1:0,transform:inView?'none':'translateY(24px)',transition:'opacity 0.7s,transform 0.7s'}}>
          <DraggableCanvas eset={edgeSet} dset={doneSet}>
            {NODES.map(n=>(
              <NodeGroup key={n.id} n={n} running={runSet.has(n.id)} done={doneSet.has(n.id)} selected={selId===n.id} goal={goal} onGoal={setGoal} onSelect={()=>setSelId(n.id)}/>
            ))}
          </DraggableCanvas>
          {/* Inspector */}
          <div style={{position:'sticky',top:90,height:'fit-content'}}>
            <div style={{background:'#fff',borderRadius:12,border:`1.5px solid ${st.ac}30`,boxShadow:'0 8px 24px rgba(0,0,0,0.07)',overflow:'hidden'}}>
              <div style={{background:st.hc,padding:'12px 18px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <span style={{fontFamily:'var(--font-mono)',fontSize:11,fontWeight:700,color:'rgba(255,255,255,0.95)',letterSpacing:'0.08em',textTransform:'uppercase'}}>{IC[sel.t]} {st.cat}</span>
                {sel.model&&<span style={{fontFamily:'var(--font-mono)',fontSize:9.5,background:'rgba(255,255,255,0.2)',color:'white',borderRadius:3,padding:'2px 7px'}}>{sel.model}</span>}
              </div>
              <div style={{padding:'16px 18px 20px'}}>
                <h3 style={{fontFamily:'Georgia,serif',fontSize:17,fontWeight:700,color:'#0f172a',marginBottom:5,lineHeight:1.2}}>{sel.label}</h3>
                <p style={{fontFamily:'Georgia,serif',fontSize:12,color:'#64748b',lineHeight:1.6,marginBottom:14}}>{sel.desc}</p>
                <div style={{marginBottom:14}}>
                  <div style={{fontFamily:'var(--font-mono)',fontSize:10,color:'#94a3b8',letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:7}}>Execution Log</div>
                  <div style={{background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:6,padding:'10px 12px',minHeight:88}}>
                    <LogStream lines={sel.log} active={runSet.has(selId)}/>
                    {!running&&!doneSet.has(selId)&&<div style={{fontFamily:'var(--font-mono)',fontSize:10.5,color:'#cbd5e1'}}>等待执行…</div>}
                  </div>
                </div>
                <div>
                  <div style={{fontFamily:'var(--font-mono)',fontSize:10,color:'#94a3b8',letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:7}}>Output Payload</div>
                  <div style={{background:doneSet.has(selId)?`${st.ac}10`:'#f8fafc',border:`1px dashed ${doneSet.has(selId)?`${st.ac}50`:'#e2e8f0'}`,borderRadius:6,padding:'10px 12px',fontFamily:'var(--font-mono)',fontSize:10.5,color:doneSet.has(selId)?st.hc:'#94a3b8',lineHeight:1.7,wordBreak:'break-all',whiteSpace:'pre-wrap',transition:'all 0.4s',maxHeight:220,overflowY:'auto'}}>
                    {doneSet.has(selId)?sel.out:(runSet.has(selId)?'Streaming output…':'Awaiting data…')}
                  </div>
                </div>
                {doneSet.has(selId)&&(
                  <div style={{marginTop:10,display:'flex',alignItems:'center',gap:6}}>
                    <div style={{width:7,height:7,borderRadius:'50%',background:'#10b981',flexShrink:0}}/>
                    <span style={{fontFamily:'var(--font-mono)',fontSize:10.5,color:'#10b981',fontWeight:600}}>运行成功 · {sel.dur}</span>
                  </div>
                )}
              </div>
            </div>
            {/* Mini node nav */}
            <div style={{marginTop:14,display:'flex',flexDirection:'column',gap:3}}>
              {NODES.map(n=>{
                const t=T[n.t];
                return(
                  <button key={n.id} onClick={()=>setSelId(n.id)} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 12px',borderRadius:6,border:`1px solid ${selId===n.id?t.ac+'60':'#e2e8f0'}`,background:selId===n.id?t.ac+'10':'transparent',cursor:'pointer',textAlign:'left',transition:'all 0.15s'}}>
                    <span style={{fontFamily:'var(--font-mono)',fontSize:10,color:t.hc,width:14,textAlign:'center'}}>{IC[n.t]}</span>
                    <span style={{fontFamily:'var(--font-mono)',fontSize:10.5,color:selId===n.id?t.hc:'#64748b',fontWeight:selId===n.id?600:400,flex:1}}>{n.label}</span>
                    {doneSet.has(n.id)&&<span style={{fontSize:10,color:'#10b981'}}>✓</span>}
                    {runSet.has(n.id)&&<div style={{width:6,height:6,borderRadius:'50%',background:'#3b82f6',animation:'wfPulse 1s ease infinite'}}/>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <style>{`@media(max-width:900px){#workflow-demo>div>div:last-child{display:block!important}}`}</style>
      </div>
    </section>
  );
}
