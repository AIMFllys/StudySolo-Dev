/**
 * Property tests for node-type-meta.ts — node type metadata registry.
 */
import { describe, it, expect } from 'vitest';
import { NODE_TYPE_META, getNodeTypeMeta } from '@/features/workflow/constants/node-type-meta';

describe('NODE_TYPE_META', () => {
  const allTypes = Object.keys(NODE_TYPE_META);

  it('has entries for all expected node types', () => {
    const expected = [
      'trigger_input', 'ai_analyzer', 'ai_planner', 'summary', 'flashcard',
      'outline_gen', 'mind_map', 'quiz_gen', 'compare', 'content_extract',
      'merge_polish', 'chat_response', 'write_db', 'knowledge_base',
      'web_search', 'export_file', 'logic_switch', 'loop_map', 'loop_group',
      'community_node',
      'agent_code_review', 'agent_deep_research', 'agent_news',
      'agent_study_tutor', 'agent_visual_site',
    ];
    for (const t of expected) {
      expect(NODE_TYPE_META).toHaveProperty(t);
    }
  });

  it.each(allTypes)('%s has required fields', (type) => {
    const meta = NODE_TYPE_META[type as keyof typeof NODE_TYPE_META];
    expect(meta.label).toBeTruthy();
    expect(meta.description).toBeTruthy();
    expect(meta.icon).toBeDefined();
    expect(typeof meta.requiresModel).toBe('boolean');
    expect(Array.isArray(meta.inputs)).toBe(true);
    expect(Array.isArray(meta.outputs)).toBe(true);
  });

  it('non-LLM nodes have requiresModel=false', () => {
    const nonLlm = ['trigger_input', 'knowledge_base', 'web_search', 'write_db', 'export_file', 'loop_group'];
    for (const t of nonLlm) {
      expect(NODE_TYPE_META[t as keyof typeof NODE_TYPE_META].requiresModel).toBe(false);
    }
  });

  it('LLM nodes have requiresModel=true', () => {
    const llm = ['summary', 'flashcard', 'ai_analyzer', 'chat_response', 'compare'];
    for (const t of llm) {
      expect(NODE_TYPE_META[t as keyof typeof NODE_TYPE_META].requiresModel).toBe(true);
    }
  });
});

describe('getNodeTypeMeta', () => {
  it('returns meta for known type', () => {
    const meta = getNodeTypeMeta('summary');
    expect(meta.label).toBe('总结归纳');
  });

  it('falls back to chat_response for unknown type', () => {
    const meta = getNodeTypeMeta('nonexistent');
    expect(meta.label).toBe('学习回复');
  });

  it('falls back for undefined', () => {
    const meta = getNodeTypeMeta(undefined);
    expect(meta.label).toBe('学习回复');
  });
});
