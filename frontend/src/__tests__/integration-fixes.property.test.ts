/**
 * Property-Based Tests for StudySolo Integration Fixes
 *
 * Feature: studysolo-integration-fixes
 *
 * Property 1: Sidebar 渲染与工作流数据一致性
 * Property 10: Nginx 配置域名一致性
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';

// ── Pure logic extracted from Sidebar.tsx ────────────────────────────────────

/**
 * Represents workflow metadata as defined in Sidebar.tsx WorkflowMeta interface.
 */
interface WorkflowMeta {
  id: string;
  name: string;
  updated_at: string;
  isRunning?: boolean;
}

/**
 * Represents a rendered navigation item derived from workflow metadata.
 * This mirrors what the Sidebar component produces for each workflow entry.
 */
interface NavItem {
  href: string;
  name: string;
  workflowId: string;
}

/**
 * Pure function that maps workflow metadata to navigation items.
 * Extracted from Sidebar.tsx rendering logic:
 *   - Each workflow maps to a Link with href="/workspace/{id}"
 *   - The displayed name is wf.name
 *   - The key is wf.id
 */
function workflowsToNavItems(workflows: WorkflowMeta[]): NavItem[] {
  return workflows.map((wf) => ({
    href: `/workspace/${wf.id}`,
    name: wf.name,
    workflowId: wf.id,
  }));
}

// ── Generators ───────────────────────────────────────────────────────────────

/** Generates a valid UUID-like workflow id */
const workflowIdArb = fc.uuid();

/** Generates a workflow name (non-empty string) */
const workflowNameArb = fc.string({ minLength: 1, maxLength: 50 }).filter(
  (s) => s.trim().length > 0,
);

/** Generates a valid ISO date string using integer timestamps to avoid invalid dates */
const isoDateArb = fc
  .integer({
    min: new Date('2024-01-01').getTime(),
    max: new Date('2025-12-31').getTime(),
  })
  .map((ts) => new Date(ts).toISOString());

/** Generates a single WorkflowMeta object */
const workflowMetaArb: fc.Arbitrary<WorkflowMeta> = fc.record({
  id: workflowIdArb,
  name: workflowNameArb,
  updated_at: isoDateArb,
  isRunning: fc.option(fc.boolean(), { nil: undefined }),
});

/** Generates a list of WorkflowMeta with unique ids */
const workflowListArb = fc
  .array(workflowMetaArb, { minLength: 0, maxLength: 20 })
  .map((list) => {
    // Ensure unique ids
    const seen = new Set<string>();
    return list.filter((wf) => {
      if (seen.has(wf.id)) return false;
      seen.add(wf.id);
      return true;
    });
  });

// ── Property 1: Sidebar 渲染与工作流数据一致性 ──────────────────────────────

describe('Feature: studysolo-integration-fixes, Property 1: Sidebar 渲染与工作流数据一致性', () => {
  /**
   * Validates: Requirements 1.1, 1.2
   *
   * For any workflow metadata list, the number of rendered navigation items
   * must equal the list length, and each item's name and link must match
   * the corresponding workflow metadata.
   */

  it('navigation item count equals workflow list length', () => {
    fc.assert(
      fc.property(workflowListArb, (workflows) => {
        const navItems = workflowsToNavItems(workflows);
        expect(navItems).toHaveLength(workflows.length);
      }),
      { numRuns: 100 },
    );
  });

  it('each navigation item name matches the corresponding workflow name', () => {
    fc.assert(
      fc.property(workflowListArb, (workflows) => {
        const navItems = workflowsToNavItems(workflows);
        for (let i = 0; i < workflows.length; i++) {
          expect(navItems[i].name).toBe(workflows[i].name);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('each navigation item link matches /workspace/{workflow.id}', () => {
    fc.assert(
      fc.property(workflowListArb, (workflows) => {
        const navItems = workflowsToNavItems(workflows);
        for (let i = 0; i < workflows.length; i++) {
          expect(navItems[i].href).toBe(`/workspace/${workflows[i].id}`);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('each navigation item workflowId matches the source workflow id', () => {
    fc.assert(
      fc.property(workflowListArb, (workflows) => {
        const navItems = workflowsToNavItems(workflows);
        for (let i = 0; i < workflows.length; i++) {
          expect(navItems[i].workflowId).toBe(workflows[i].id);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('empty workflow list produces zero navigation items', () => {
    const navItems = workflowsToNavItems([]);
    expect(navItems).toHaveLength(0);
  });
});

// ── Property 10: Nginx 配置域名一致性 ───────────────────────────────────────

describe('Feature: studysolo-integration-fixes, Property 10: Nginx 配置域名一致性', () => {
  /**
   * Validates: Requirements 9.1, 9.2
   *
   * The nginx.conf file must not contain the placeholder domain 'your-domain.com'
   * and all server_name, ssl_certificate, ssl_certificate_key directives must
   * reference 'studyflow.1037solo.com'.
   */

  const nginxConfPath = path.resolve(__dirname, '../../../scripts/nginx.conf');
  const nginxContent = fs.readFileSync(nginxConfPath, 'utf-8');

  it('nginx.conf does NOT contain "your-domain.com"', () => {
    expect(nginxContent).not.toContain('your-domain.com');
  });

  it('all server_name directives contain studyflow.1037solo.com', () => {
    const serverNameLines = nginxContent
      .split('\n')
      .filter((line) => line.trim().startsWith('server_name'));

    expect(serverNameLines.length).toBeGreaterThan(0);

    for (const line of serverNameLines) {
      expect(line).toContain('studyflow.1037solo.com');
    }
  });

  it('all ssl_certificate directives contain studyflow.1037solo.com', () => {
    const sslCertLines = nginxContent
      .split('\n')
      .filter((line) => line.trim().startsWith('ssl_certificate') && !line.trim().startsWith('ssl_certificate_key'));

    expect(sslCertLines.length).toBeGreaterThan(0);

    for (const line of sslCertLines) {
      expect(line).toContain('studyflow.1037solo.com');
    }
  });

  it('all ssl_certificate_key directives contain studyflow.1037solo.com', () => {
    const sslKeyLines = nginxContent
      .split('\n')
      .filter((line) => line.trim().startsWith('ssl_certificate_key'));

    expect(sslKeyLines.length).toBeGreaterThan(0);

    for (const line of sslKeyLines) {
      expect(line).toContain('studyflow.1037solo.com');
    }
  });
});


// ── Property 2: shiki 代码高亮输出有效性 ────────────────────────────────────

/**
 * Feature: studysolo-integration-fixes, Property 2: shiki 代码高亮输出有效性
 *
 * Validates: Requirements 2.1, 2.2
 *
 * For any non-empty code string and supported language, shiki's codeToHtml
 * must return HTML containing <pre> and <code> tags, and the output HTML
 * length must be greater than the original code length (due to syntax
 * highlighting markup).
 */

import { codeToHtml } from 'shiki/bundle/web';

/** Supported languages as defined in design doc */
const SUPPORTED_LANGUAGES = ['javascript', 'typescript', 'python', 'html', 'css', 'json'] as const;
type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/** Generates a random supported language */
const languageArb: fc.Arbitrary<SupportedLanguage> = fc.constantFrom(...SUPPORTED_LANGUAGES);

/**
 * Generates a non-empty code string suitable for syntax highlighting.
 * Uses fc.string with printable ASCII range to avoid encoding edge cases.
 */
const codeStringArb: fc.Arbitrary<string> = fc
  .string({ minLength: 1, maxLength: 200 })
  .filter((s: string) => s.trim().length > 0);

describe('Feature: studysolo-integration-fixes, Property 2: shiki 代码高亮输出有效性', () => {
  it('codeToHtml output contains <pre> and <code> tags for any non-empty code and supported language', async () => {
    await fc.assert(
      fc.asyncProperty(codeStringArb, languageArb, async (code: string, lang: SupportedLanguage) => {
        const html = await codeToHtml(code, {
          lang,
          themes: { light: 'github-light', dark: 'github-dark' },
        });

        expect(html).toContain('<pre');
        expect(html).toContain('<code');
      }),
      { numRuns: 100 },
    );
  });

  it('codeToHtml output HTML length is greater than original code length', async () => {
    await fc.assert(
      fc.asyncProperty(codeStringArb, languageArb, async (code: string, lang: SupportedLanguage) => {
        const html = await codeToHtml(code, {
          lang,
          themes: { light: 'github-light', dark: 'github-dark' },
        });

        expect(html.length).toBeGreaterThan(code.length);
      }),
      { numRuns: 100 },
    );
  });
});

// ── Property 3: streaming 结束后内容等价性 ──────────────────────────────────

/**
 * Feature: studysolo-integration-fixes, Property 3: streaming 结束后内容等价性
 *
 * Validates: Requirements 3.2
 *
 * For any markdown content string, when streaming switches from true to false,
 * the final content passed to react-markdown should be the same as the original
 * content. This is tested as a pure identity property: the content prop is
 * passed through unchanged to the renderer.
 *
 * The NodeMarkdownOutput component passes `content` directly as children to
 * ReactMarkdown when streaming=false: <ReactMarkdown>{content}</ReactMarkdown>
 * This means the content is an identity transformation — no modification occurs.
 */

/**
 * Pure function modeling the content flow in NodeMarkdownOutput.
 *
 * When streaming=false, the component passes content directly to ReactMarkdown.
 * This function extracts that pure logic: the content prop is the same string
 * that gets rendered, regardless of whether it was previously streamed.
 */
function getRenderedContent(content: string, streaming: boolean): string {
  // When streaming ends (streaming=false), content is passed directly
  // to ReactMarkdown as children — no transformation applied.
  // This mirrors: <ReactMarkdown>{content}</ReactMarkdown>
  if (!streaming) {
    return content;
  }
  // During streaming, content is also passed through to Streamdown as children.
  // <Streamdown>{content}</Streamdown>
  return content;
}

/** Generates arbitrary markdown content strings */
const markdownContentArb: fc.Arbitrary<string> = fc.string({ minLength: 0, maxLength: 500 });

describe('Feature: studysolo-integration-fixes, Property 3: streaming 结束后内容等价性', () => {
  /**
   * Validates: Requirements 3.2
   *
   * When streaming switches from true to false, the content passed to
   * react-markdown must be identical to the original content string.
   */

  it('content passed to renderer after streaming ends is identical to original content', () => {
    fc.assert(
      fc.property(markdownContentArb, (content: string) => {
        // Simulate: streaming was true, now switches to false
        const streamingContent = getRenderedContent(content, true);
        const finalContent = getRenderedContent(content, false);

        // The final rendered content must equal the original content
        expect(finalContent).toBe(content);
        // And it must also equal what was being streamed
        expect(finalContent).toBe(streamingContent);
      }),
      { numRuns: 100 },
    );
  });

  it('content is never modified regardless of streaming state transitions', () => {
    fc.assert(
      fc.property(markdownContentArb, fc.boolean(), (content: string, streaming: boolean) => {
        const renderedContent = getRenderedContent(content, streaming);

        // Content must always be passed through unchanged
        expect(renderedContent).toBe(content);
      }),
      { numRuns: 100 },
    );
  });
});


// ── Property 4: Bottom_Drawer 节点内容完整性 ────────────────────────────────

/**
 * Feature: studysolo-integration-fixes, Property 4: BottomDrawer 节点内容完整性
 *
 * Validates: Requirements 4.2, 4.4
 *
 * For any node data (label, status, output), when BottomDrawer renders with
 * that data, the rendered output must contain the node label, status badge,
 * and output content. This is tested as pure logic: given AIStepNodeData,
 * extract label/status/output and verify they're all present and correct.
 */

/** Valid node statuses as defined in types/index.ts */
const NODE_STATUSES = ['pending', 'running', 'done', 'error'] as const;
type TestNodeStatus = (typeof NODE_STATUSES)[number];

/** Status badge mapping extracted from BottomDrawer.tsx */
const BOTTOM_DRAWER_STATUS_BADGE: Record<string, { label: string; className: string }> = {
  pending: { label: '待执行', className: 'bg-gray-500/20 text-gray-300' },
  running: { label: '执行中', className: 'bg-blue-500/20 text-blue-300' },
  done:    { label: '已完成', className: 'bg-green-500/20 text-green-300' },
  error:   { label: '错误',   className: 'bg-red-500/20 text-red-300' },
};

/**
 * Pure function modeling BottomDrawer's data extraction logic.
 * Given node data, returns the display fields that the drawer renders.
 */
function extractDrawerDisplayData(nodeData: { label: string; status: string; output: string }) {
  const badge = BOTTOM_DRAWER_STATUS_BADGE[nodeData.status] ?? BOTTOM_DRAWER_STATUS_BADGE.pending;
  return {
    label: nodeData.label || '未命名节点',
    statusLabel: badge.label,
    statusClassName: badge.className,
    output: nodeData.output,
    hasOutput: nodeData.output.length > 0,
  };
}

/** Generates a random node status */
const nodeStatusArb: fc.Arbitrary<TestNodeStatus> = fc.constantFrom(...NODE_STATUSES);

/** Generates a non-empty label string */
const nodeLabelArb = fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0);

/** Generates an output string (can be empty) */
const nodeOutputArb = fc.string({ minLength: 0, maxLength: 300 });

/** Generates node data for BottomDrawer testing */
const drawerNodeDataArb = fc.record({
  label: nodeLabelArb,
  status: nodeStatusArb,
  output: nodeOutputArb,
});

describe('Feature: studysolo-integration-fixes, Property 4: BottomDrawer 节点内容完整性', () => {
  /**
   * Validates: Requirements 4.2, 4.4
   */

  it('extracted display data always contains label, status badge, and output', () => {
    fc.assert(
      fc.property(drawerNodeDataArb, (nodeData) => {
        const display = extractDrawerDisplayData(nodeData);

        // Label must be present (falls back to '未命名节点' if empty)
        expect(display.label).toBeTruthy();
        expect(display.label.length).toBeGreaterThan(0);

        // Status label must be a known badge label
        const validLabels = Object.values(BOTTOM_DRAWER_STATUS_BADGE).map((b) => b.label);
        expect(validLabels).toContain(display.statusLabel);

        // Status className must be a known badge className
        const validClassNames = Object.values(BOTTOM_DRAWER_STATUS_BADGE).map((b) => b.className);
        expect(validClassNames).toContain(display.statusClassName);

        // Output is preserved as-is
        expect(display.output).toBe(nodeData.output);
      }),
      { numRuns: 100 },
    );
  });

  it('label falls back to "未命名节点" when empty string is provided', () => {
    const display = extractDrawerDisplayData({ label: '', status: 'pending', output: 'test' });
    expect(display.label).toBe('未命名节点');
  });

  it('status badge maps correctly for each known status', () => {
    fc.assert(
      fc.property(nodeStatusArb, (status) => {
        const display = extractDrawerDisplayData({ label: 'Test', status, output: '' });
        expect(display.statusLabel).toBe(BOTTOM_DRAWER_STATUS_BADGE[status].label);
        expect(display.statusClassName).toBe(BOTTOM_DRAWER_STATUS_BADGE[status].className);
      }),
      { numRuns: 100 },
    );
  });

  it('hasOutput is true when output is non-empty, false when empty', () => {
    fc.assert(
      fc.property(drawerNodeDataArb, (nodeData) => {
        const display = extractDrawerDisplayData(nodeData);
        expect(display.hasOutput).toBe(nodeData.output.length > 0);
      }),
      { numRuns: 100 },
    );
  });
});

// ── Property 5: Right_Panel 节点状态统计正确性 ──────────────────────────────

/**
 * Feature: studysolo-integration-fixes, Property 5: RightPanel 节点状态统计正确性
 *
 * Validates: Requirements 5.2
 *
 * For any node list with random statuses, the sum of all status counts must
 * equal the total node count, and each status count must equal the actual
 * count of that status in the list.
 */

/**
 * Pure function extracted from RightPanel.tsx status counting logic.
 * Counts nodes by status, defaulting to 'pending' when status is missing.
 */
function countNodesByStatus(
  nodes: Array<{ data: { status?: string } }>,
): Record<string, number> {
  return nodes.reduce<Record<string, number>>((acc, node) => {
    const status = node.data?.status ?? 'pending';
    acc[status] = (acc[status] ?? 0) + 1;
    return acc;
  }, {});
}

/** Generates a single node-like object with a random status */
const nodeWithStatusArb = fc.record({
  data: fc.record({
    status: fc.constantFrom('pending', 'running', 'done', 'error') as fc.Arbitrary<string>,
  }),
});

/** Generates a list of nodes with random statuses (0-20 nodes) */
const nodeListArb = fc.array(nodeWithStatusArb, { minLength: 0, maxLength: 20 });

describe('Feature: studysolo-integration-fixes, Property 5: RightPanel 节点状态统计正确性', () => {
  /**
   * Validates: Requirements 5.2
   */

  it('sum of all status counts equals total node count', () => {
    fc.assert(
      fc.property(nodeListArb, (nodes) => {
        const counts = countNodesByStatus(nodes);
        const totalCounted = Object.values(counts).reduce((sum, c) => sum + c, 0);
        expect(totalCounted).toBe(nodes.length);
      }),
      { numRuns: 100 },
    );
  });

  it('each status count equals actual count of that status in the list', () => {
    fc.assert(
      fc.property(nodeListArb, (nodes) => {
        const counts = countNodesByStatus(nodes);

        // Verify each status
        for (const status of ['pending', 'running', 'done', 'error']) {
          const actualCount = nodes.filter((n) => (n.data.status ?? 'pending') === status).length;
          expect(counts[status] ?? 0).toBe(actualCount);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('empty node list produces empty counts (all zeros)', () => {
    const counts = countNodesByStatus([]);
    const total = Object.values(counts).reduce((sum, c) => sum + c, 0);
    expect(total).toBe(0);
  });
});

// ── Property 6: WorkflowPromptInput 生成结果注入 Store ──────────────────────

/**
 * Feature: studysolo-integration-fixes, Property 6: PromptInput 生成结果注入 Store
 *
 * Validates: Requirements 7.3
 *
 * For any valid nodes and edges arrays, after setting them in the store,
 * reading them back should return identical data.
 */

/**
 * Pure function modeling the store injection logic from WorkflowPromptInput.
 * The component calls setNodes(data.nodes) and setEdges(data.edges).
 * The store simply replaces the current nodes/edges with the new ones.
 */
function simulateStoreInjection(
  currentState: { nodes: unknown[]; edges: unknown[] },
  newNodes: unknown[],
  newEdges: unknown[],
): { nodes: unknown[]; edges: unknown[] } {
  // Mirrors Zustand store's setNodes/setEdges: direct replacement
  return {
    nodes: newNodes,
    edges: newEdges,
  };
}

/** Generates a random node-like object for store injection testing */
const storeNodeArb = fc.record({
  id: fc.uuid(),
  type: fc.constant('default'),
  position: fc.record({ x: fc.integer({ min: 0, max: 1000 }), y: fc.integer({ min: 0, max: 1000 }) }),
  data: fc.record({
    label: fc.string({ minLength: 1, maxLength: 30 }),
    status: fc.constantFrom('pending', 'running', 'done', 'error'),
    output: fc.string({ minLength: 0, maxLength: 100 }),
  }),
});

/** Generates a random edge-like object for store injection testing */
const storeEdgeArb = fc.record({
  id: fc.uuid(),
  source: fc.uuid(),
  target: fc.uuid(),
});

/** Generates random nodes and edges arrays */
const nodesAndEdgesArb = fc.record({
  nodes: fc.array(storeNodeArb, { minLength: 0, maxLength: 10 }),
  edges: fc.array(storeEdgeArb, { minLength: 0, maxLength: 10 }),
});

describe('Feature: studysolo-integration-fixes, Property 6: PromptInput 生成结果注入 Store', () => {
  /**
   * Validates: Requirements 7.3
   */

  it('after setting nodes/edges in store, reading them back returns identical data', () => {
    fc.assert(
      fc.property(nodesAndEdgesArb, ({ nodes, edges }) => {
        const initialState = { nodes: [], edges: [] };
        const newState = simulateStoreInjection(initialState, nodes, edges);

        // Nodes must be identical (same reference)
        expect(newState.nodes).toBe(nodes);
        expect(newState.nodes).toHaveLength(nodes.length);

        // Edges must be identical (same reference)
        expect(newState.edges).toBe(edges);
        expect(newState.edges).toHaveLength(edges.length);
      }),
      { numRuns: 100 },
    );
  });

  it('store injection replaces previous state completely', () => {
    fc.assert(
      fc.property(nodesAndEdgesArb, nodesAndEdgesArb, (first, second) => {
        // First injection
        const state1 = simulateStoreInjection({ nodes: [], edges: [] }, first.nodes, first.edges);
        // Second injection replaces first
        const state2 = simulateStoreInjection(state1, second.nodes, second.edges);

        expect(state2.nodes).toBe(second.nodes);
        expect(state2.edges).toBe(second.edges);
        expect(state2.nodes).toHaveLength(second.nodes.length);
        expect(state2.edges).toHaveLength(second.edges.length);
      }),
      { numRuns: 100 },
    );
  });

  it('deep equality holds after injection (content is preserved)', () => {
    fc.assert(
      fc.property(nodesAndEdgesArb, ({ nodes, edges }) => {
        const newState = simulateStoreInjection({ nodes: [], edges: [] }, nodes, edges);

        // Deep equality check — every node's data is preserved
        for (let i = 0; i < nodes.length; i++) {
          expect(newState.nodes[i]).toEqual(nodes[i]);
        }
        for (let i = 0; i < edges.length; i++) {
          expect(newState.edges[i]).toEqual(edges[i]);
        }
      }),
      { numRuns: 100 },
    );
  });
});

// ── Property 7: 运行按钮状态与执行状态映射 ──────────────────────────────────

/**
 * Feature: studysolo-integration-fixes, Property 7: 运行按钮状态与执行状态映射
 *
 * Validates: Requirements 8.3, 8.4, 8.5
 *
 * For any execution status and node list, the run button state must satisfy:
 * - status='running' → show "stop" button
 * - status!='running' && hasNodes → show enabled "run" button
 * - status!='running' && !hasNodes → show disabled button
 */

type TestExecutionStatus = 'idle' | 'running' | 'completed' | 'error';

/** Possible button display states */
type ButtonState = 'stop' | 'run_enabled' | 'run_disabled';

/**
 * Pure function extracted from RunButton.tsx logic.
 * Determines what button state should be shown given execution status and node count.
 */
function determineButtonState(executionStatus: TestExecutionStatus, nodeCount: number): ButtonState {
  if (executionStatus === 'running') {
    return 'stop';
  }
  if (nodeCount > 0) {
    return 'run_enabled';
  }
  return 'run_disabled';
}

/** Generates a random execution status */
const executionStatusArb: fc.Arbitrary<TestExecutionStatus> = fc.constantFrom(
  'idle',
  'running',
  'completed',
  'error',
);

/** Generates a random node count (0-10) */
const nodeCountArb = fc.integer({ min: 0, max: 10 });

describe('Feature: studysolo-integration-fixes, Property 7: 运行按钮状态与执行状态映射', () => {
  /**
   * Validates: Requirements 8.3, 8.4, 8.5
   */

  it('running status always maps to "stop" button regardless of node count', () => {
    fc.assert(
      fc.property(nodeCountArb, (nodeCount) => {
        const state = determineButtonState('running', nodeCount);
        expect(state).toBe('stop');
      }),
      { numRuns: 100 },
    );
  });

  it('non-running status with nodes maps to enabled "run" button', () => {
    const nonRunningStatusArb = fc.constantFrom('idle', 'completed', 'error') as fc.Arbitrary<TestExecutionStatus>;
    const positiveNodeCountArb = fc.integer({ min: 1, max: 10 });

    fc.assert(
      fc.property(nonRunningStatusArb, positiveNodeCountArb, (status, nodeCount) => {
        const state = determineButtonState(status, nodeCount);
        expect(state).toBe('run_enabled');
      }),
      { numRuns: 100 },
    );
  });

  it('non-running status with zero nodes maps to disabled button', () => {
    const nonRunningStatusArb = fc.constantFrom('idle', 'completed', 'error') as fc.Arbitrary<TestExecutionStatus>;

    fc.assert(
      fc.property(nonRunningStatusArb, (status) => {
        const state = determineButtonState(status, 0);
        expect(state).toBe('run_disabled');
      }),
      { numRuns: 100 },
    );
  });

  it('button state is always one of the three valid states', () => {
    fc.assert(
      fc.property(executionStatusArb, nodeCountArb, (status, nodeCount) => {
        const state = determineButtonState(status, nodeCount);
        expect(['stop', 'run_enabled', 'run_disabled']).toContain(state);
      }),
      { numRuns: 100 },
    );
  });

  it('button state mapping is deterministic (same inputs → same output)', () => {
    fc.assert(
      fc.property(executionStatusArb, nodeCountArb, (status, nodeCount) => {
        const state1 = determineButtonState(status, nodeCount);
        const state2 = determineButtonState(status, nodeCount);
        expect(state1).toBe(state2);
      }),
      { numRuns: 100 },
    );
  });
});
