/**
 * Node renderer registry — maps node types to their renderer components.
 *
 * The frontend equivalent of the backend's NODE_REGISTRY.
 * AIStepNode uses getRenderer(nodeType) to dynamically select the
 * correct renderer, eliminating the need for hardcoded switch/case.
 */

import React from "react";
import { MarkdownRenderer } from "./renderers/MarkdownRenderer";
import { FlashcardRenderer } from "./renderers/FlashcardRenderer";
import { OutlineRenderer } from "./renderers/OutlineRenderer";
import { JsonRenderer } from "./renderers/JsonRenderer";
import { PassthroughRenderer } from "./renderers/PassthroughRenderer";
import { CompareRenderer } from "./renderers/CompareRenderer";
import { MindMapRenderer } from "./renderers/MindMapRenderer";
import { QuizRenderer } from "./renderers/QuizRenderer";
import ExportRenderer from "./renderers/ExportRenderer";

/**
 * Props passed to every node renderer.
 */
export interface NodeRendererProps {
    output: string;
    format: string;
    nodeType: string;
    isStreaming: boolean;
    compact?: boolean;
}

/**
 * Registry: node type string → React renderer component.
 *
 * To add a new renderer, simply add an entry here and create
 * the renderer file in ./renderers/. Zero changes needed in
 * AIStepNode or anywhere else.
 */
const RENDERER_REGISTRY: Record<string, React.FC<NodeRendererProps>> = {
    // Special renderers
    flashcard: FlashcardRenderer,
    outline_gen: OutlineRenderer,

    // JSON renderers
    ai_analyzer: JsonRenderer,
    ai_planner: JsonRenderer,

    // Markdown renderers
    summary: MarkdownRenderer,
    content_extract: MarkdownRenderer,
    chat_response: MarkdownRenderer,

    // Passthrough (no output display)
    trigger_input: PassthroughRenderer,
    write_db: PassthroughRenderer,

    // ── P1 新增节点渲染器 ──
    compare: CompareRenderer,
    mind_map: MindMapRenderer,
    quiz_gen: QuizRenderer,
    merge_polish: MarkdownRenderer,
    knowledge_base: MarkdownRenderer,
    web_search: MarkdownRenderer,
    export_file: ExportRenderer,

    // ── P2 引擎增强节点渲染器 ──
    logic_switch: JsonRenderer,
    loop_map: JsonRenderer,
};

/**
 * Look up the renderer for a node type, with MarkdownRenderer as fallback.
 */
export function getRenderer(
    nodeType: string
): React.FC<NodeRendererProps> {
    return RENDERER_REGISTRY[nodeType] || MarkdownRenderer;
}
