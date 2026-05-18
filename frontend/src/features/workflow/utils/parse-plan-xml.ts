/**
 * 解析 Plan 模式生成的 XML 响应 (三级降级策略)
 * 行业标准分析设计, 保证 AI 幻觉和语法错误时的健壮性。
 */

export interface PlanStep {
  id: string; // 前端生成的唯一 key
  priority: 'high' | 'medium' | 'low';
  action: string; // ADD_NODE | DELETE_NODE | UPDATE_NODE
  description: string;
  nodeType?: string;
  anchor?: string;
  selected: boolean; // 默认优先级高为 true, 其他为 false
}

export interface ParsedPlan {
  analysis: {
    currentState: string;
    strengths: string;
    gaps: string;
  } | null;
  recommendations: PlanStep[];
  response: string;
  parseLevel: 'xml' | 'regex' | 'raw'; // 让 UI 知道解析质量以渲染不同视图
}

function extractBetweenTags(text: string, tag: string): string | null {
  // eslint-disable-next-line
  // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const match = text.match(regex);
  return match ? match[1].trim() : null;
}

function parseStepsFromRegex(recommendationsText: string): PlanStep[] {
  const stepRegex = /<step[^>]*>([\s\S]*?)<\/step>/gi;
  const steps: PlanStep[] = [];
  let match;
  
  while ((match = stepRegex.exec(recommendationsText)) !== null) {
    const stepContent = match[1];
    
    // priority: <step priority="high">
    let priority: 'high' | 'medium' | 'low' = 'medium';
    const tagMatch = match[0].match(/priority="([^"]+)"/i);
    if (tagMatch && tagMatch[1]) {
      const p = tagMatch[1].toLowerCase();
      if (p === 'high' || p === 'medium' || p === 'low') {
        priority = p;
      }
    }

    const action = extractBetweenTags(stepContent, 'action') || 'UNKNOWN';
    const description = extractBetweenTags(stepContent, 'description') || '';
    const nodeType = extractBetweenTags(stepContent, 'node_type');
    const anchor = extractBetweenTags(stepContent, 'anchor');

    if (action !== 'UNKNOWN' && description) {
      steps.push({
        id: crypto.randomUUID(),
        priority,
        action,
        description,
        ...(nodeType ? { nodeType } : {}),
        ...(anchor ? { anchor } : {}),
        selected: priority === 'high',
      });
    }
  }
  return steps;
}

export function parsePlanResponse(raw: string): ParsedPlan {
  // ── Level 1: Standard DOMParser ──
  try {
    const xmlContent = extractBetweenTags(raw, 'plan');
    if (xmlContent) {
      const doc = new DOMParser().parseFromString(`<root>${xmlContent}</root>`, 'text/xml');
      // 如果没有解析错误 或只有无关的 parsing warning
      if (!doc.querySelector('parsererror')) {
        
        let analysis = null;
        const analysisNode = doc.querySelector('analysis');
        if (analysisNode) {
          analysis = {
            currentState: analysisNode.querySelector('current_state')?.textContent?.trim() || '',
            strengths: analysisNode.querySelector('strengths')?.textContent?.trim() || '',
            gaps: analysisNode.querySelector('gaps')?.textContent?.trim() || '',
          };
        }

        const recommendations: PlanStep[] = [];
        const stepNodes = doc.querySelectorAll('recommendations > step');
        stepNodes.forEach((stepNode) => {
          const rawPriority = stepNode.getAttribute('priority')?.toLowerCase();
          const priority = (rawPriority === 'high' || rawPriority === 'low' || rawPriority === 'medium') ? rawPriority : 'medium';
          const action = stepNode.querySelector('action')?.textContent?.trim() || 'UNKNOWN';
          const description = stepNode.querySelector('description')?.textContent?.trim() || '';
          const nodeType = stepNode.querySelector('node_type')?.textContent?.trim();
          const anchor = stepNode.querySelector('anchor')?.textContent?.trim();

          if (action !== 'UNKNOWN' && description) {
            recommendations.push({
              id: crypto.randomUUID(),
              priority,
              action,
              description,
              ...(nodeType ? { nodeType } : {}),
              ...(anchor ? { anchor } : {}),
              selected: priority === 'high',
            });
          }
        });

        const response = doc.querySelector('response')?.textContent?.trim() || '';

        return {
          analysis: analysis?.currentState ? analysis : null,
          recommendations,
          response,
          parseLevel: 'xml',
        };
      }
    }
  } catch {
    // Fall through
  }

  // ── Level 2: Regex tag extraction (Fallback) ──
  try {
    const analysisStr = extractBetweenTags(raw, 'analysis');
    const recommendationsStr = extractBetweenTags(raw, 'recommendations');
    const responseStr = extractBetweenTags(raw, 'response');

    if (analysisStr || recommendationsStr) {
      let analysis = null;
      if (analysisStr) {
        analysis = {
          currentState: extractBetweenTags(analysisStr, 'current_state') || '',
          strengths: extractBetweenTags(analysisStr, 'strengths') || '',
          gaps: extractBetweenTags(analysisStr, 'gaps') || '',
        };
      }

      return {
        analysis: analysis?.currentState ? analysis : null,
        recommendations: recommendationsStr ? parseStepsFromRegex(recommendationsStr) : [],
        response: responseStr ?? raw,
        parseLevel: 'regex',
      };
    }
  } catch {
    // Fall through
  }

  // ── Level 3: Raw Text (Graceful Degradation) ──
  return {
    analysis: null,
    recommendations: [],
    response: raw,
    parseLevel: 'raw',
  };
}
