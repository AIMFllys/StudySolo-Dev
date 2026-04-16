export function getNodeTheme(nodeType: string) {
  // 1. RAW_DATA (数据源/输入) - 灰色打孔纸质感
  if (['trigger_input'].includes(nodeType)) {
    return {
      category: 'RAW_DATA',
      borderClass: 'border border-dashed border-slate-400 dark:border-slate-500',
      innerBorderClass: 'border-none',
      headerTextColor: 'text-slate-600 dark:text-slate-400',
    };
  }
  // 2. ANALYSIS (逻辑分析) - 墨绿双线审阅质感
  if (['ai_analyzer', 'content_extract', 'compare'].includes(nodeType)) {
    return {
      category: 'ANALYSIS',
      borderClass: 'border-2 border-emerald-800 dark:border-emerald-600',
      innerBorderClass: 'border-[0.5px] border-dashed border-emerald-800/60 dark:border-emerald-500/60',
      headerTextColor: 'text-emerald-800 dark:text-emerald-500',
    };
  }
  // 3. GENERATION (内容生成) - 靛蓝厚重书写质感
  if (['outline_gen', 'summary'].includes(nodeType)) {
    return {
      category: 'GENERATION',
      borderClass: 'border-[3px] border-indigo-900 dark:border-indigo-400',
      innerBorderClass: 'border-[0.5px] border-solid border-indigo-900/40 dark:border-indigo-400/40',
      headerTextColor: 'text-indigo-900 dark:text-indigo-400',
    };
  }
  // 4. FINAL_REPORT (正式报告/终稿) - 沉稳藏青带内嵌缝线
  if (['chat_response', 'merge_polish'].includes(nodeType)) {
    return {
      category: 'FINAL_REPORT',
      borderClass: 'border-[2px] border-slate-800 dark:border-slate-300 ring-4 ring-slate-800/5 dark:ring-slate-300/5',
      innerBorderClass: 'border-[1px] border-dashed border-slate-800/30 dark:border-slate-300/30 m-1',
      headerTextColor: 'text-slate-800 dark:text-slate-300',
    };
  }
  // 5. EXTERNAL_TOOL (外部检索) - 青色胶布贴边质感
  if (['knowledge_base', 'web_search'].includes(nodeType)) {
    return {
      category: 'EXTERNAL_TOOL',
      borderClass: 'border-l-4 border-y border-r border-cyan-700 dark:border-cyan-500',
      innerBorderClass: 'border-none',
      headerTextColor: 'text-cyan-800 dark:text-cyan-500',
    };
  }
  // 6. ACTION_IO (系统读写) - 工业灰点线排版
  if (['write_db', 'export_file'].includes(nodeType)) {
    return {
      category: 'ACTION_IO',
      borderClass: 'border-[1.5px] border-dotted border-zinc-500 dark:border-zinc-400',
      innerBorderClass: 'border-[0.5px] border-solid border-zinc-500/20 dark:border-zinc-400/20',
      headerTextColor: 'text-zinc-600 dark:text-zinc-400',
    };
  }
  // 7. CONTROL_FLOW (逻辑控制) - 琥珀色警告线质感
  if (nodeType === 'logic_switch') {
    return {
      category: 'CONTROL_FLOW_BRANCH',
      borderClass: 'border-[2.5px] border-amber-500 dark:border-amber-400 shadow-[0_0_0_2px_rgba(245,158,11,0.08)] bg-[linear-gradient(135deg,rgba(245,158,11,0.06),transparent_55%)]',
      innerBorderClass: 'border-[1px] border-dashed border-amber-500/55 dark:border-amber-400/50',
      headerTextColor: 'text-amber-700 dark:text-amber-300',
    };
  }
  if (['loop_map', 'loop_group'].includes(nodeType)) {
    return {
      category: 'CONTROL_FLOW',
      borderClass: 'border-2 border-amber-600 dark:border-amber-500',
      innerBorderClass: 'border-[0.5px] border-dashed border-amber-600/50 dark:border-amber-500/50',
      headerTextColor: 'text-amber-700 dark:text-amber-500',
    };
  }
  if (nodeType === 'community_node') {
    return {
      category: 'COMMUNITY',
      borderClass: 'border-2 border-teal-700 dark:border-teal-500 shadow-[0_0_0_2px_rgba(13,148,136,0.08)]',
      innerBorderClass: 'border-[0.5px] border-dashed border-teal-700/45 dark:border-teal-500/40',
      headerTextColor: 'text-teal-800 dark:text-teal-400',
    };
  }
  if ([
    'agent_code_review',
    'agent_deep_research',
    'agent_news',
    'agent_study_tutor',
    'agent_visual_site',
  ].includes(nodeType)) {
    return {
      category: 'AGENT',
      borderClass: 'border-[2.5px] border-rose-700 dark:border-rose-400 shadow-[0_0_0_2px_rgba(190,24,93,0.08)] bg-[linear-gradient(135deg,rgba(244,63,94,0.06),transparent_55%)]',
      innerBorderClass: 'border-[1px] border-dashed border-rose-700/40 dark:border-rose-400/40',
      headerTextColor: 'text-rose-800 dark:text-rose-300',
    };
  }
  // 8. VISUALIZE (图表渲染) - 紫色相框质感
  if (['mind_map'].includes(nodeType)) {
    return {
      category: 'VISUALIZE',
      borderClass: 'border border-fuchsia-800 dark:border-fuchsia-500 shadow-[inset_0_0_0_2px_rgba(134,25,143,0.1)]',
      innerBorderClass: 'border-[0.5px] border-solid border-fuchsia-800/30 dark:border-fuchsia-500/30 m-2',
      headerTextColor: 'text-fuchsia-800 dark:text-fuchsia-400',
    };
  }
  // 9. ASSESSMENT (考核测试) - 玫瑰红考卷质感
  if (['quiz_gen', 'flashcard'].includes(nodeType)) {
    return {
      category: 'ASSESSMENT',
      borderClass: 'border-2 border-rose-800 dark:border-rose-400',
      innerBorderClass: 'border-t-[0.5px] border-b-[0.5px] border-solid border-rose-800/30 dark:border-rose-400/30 my-4',
      headerTextColor: 'text-rose-800 dark:text-rose-400',
    };
  }
  // 10. FEEDBACK (评估反馈) - 青绿色批改笔迹质感 (Fallback / 预留)
  return {
    category: 'FEEDBACK',
    borderClass: 'border-[1.5px] border-teal-700 dark:border-teal-500',
    innerBorderClass: 'border-[1px] border-dotted border-teal-700/40 dark:border-teal-500/40',
    headerTextColor: 'text-teal-800 dark:text-teal-400',
  };
}
