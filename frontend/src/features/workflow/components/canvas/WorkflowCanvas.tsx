'use client';

import { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { Undo, Redo } from 'lucide-react';
import {
  Controls,
  type ConnectionLineType,
  MarkerType,
  ReactFlow,
  type EdgeTypes,
  type NodeMouseHandler,
  type NodeTypes,
  useReactFlow,
  SelectionMode,
  ReactFlowProvider,
} from '@xyflow/react';
import type { Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import BottomDrawer from '@/features/workflow/components/panel/BottomDrawer';
import FloatingToolbar from '@/features/workflow/components/toolbar/FloatingToolbar';
import type { CanvasTool } from '@/features/workflow/components/toolbar/FloatingToolbar';
import AnimatedEdge from '@/features/workflow/components/canvas/edges/AnimatedEdge';
import AIStepNode from '@/features/workflow/components/nodes/AIStepNode';
import GeneratingNode from '@/features/workflow/components/nodes/GeneratingNode';
import AnnotationNode from '@/features/workflow/components/nodes/AnnotationNode';
import CanvasModal from '@/features/workflow/components/canvas/CanvasModal';
import CanvasMiniMap from '@/features/workflow/components/canvas/CanvasMiniMap';
import CanvasContextMenu, { buildCanvasMenuItems } from '@/features/workflow/components/canvas/CanvasContextMenu';
import NodeContextMenu, { buildNodeMenuGroups } from '@/features/workflow/components/canvas/NodeContextMenu';
import { useWorkflowStore } from '@/stores/use-workflow-store';
import type { AIStepNodeData } from '@/types';

/* ── Canvas background presets ── */
const BG_PRESETS = [
  { key: 'grid', className: 'bg-background bg-grid-pattern-canvas', label: '网格' },
  { key: 'paper', className: 'bg-[#faf9f6] dark:bg-[#1a1b1e]', label: '暖纸' },
  { key: 'slate', className: 'bg-slate-100 dark:bg-slate-900', label: '石板' },
  { key: 'clean', className: 'bg-white dark:bg-black', label: '纯净' },
] as const;

const nodeTypes: NodeTypes = {
  // ── 原始节点 (9) ──
  trigger_input: AIStepNode,
  ai_analyzer: AIStepNode,
  ai_planner: AIStepNode,
  outline_gen: AIStepNode,
  content_extract: AIStepNode,
  summary: AIStepNode,
  flashcard: AIStepNode,
  chat_response: AIStepNode,
  write_db: AIStepNode,
  // ── P1 节点 (7) ──
  compare: AIStepNode,
  mind_map: AIStepNode,
  quiz_gen: AIStepNode,
  merge_polish: AIStepNode,
  knowledge_base: AIStepNode,
  web_search: AIStepNode,
  export_file: AIStepNode,
  // ── P2 引擎节点 (2) ──
  logic_switch: AIStepNode,
  loop_map: AIStepNode,
  // ── 状态节点 (1) ──
  generating: GeneratingNode,
  // ── 标注节点 ──
  annotation: AnnotationNode,
};

const edgeTypes: EdgeTypes = {
  default: AnimatedEdge,
};

function HistoryControls() {
  const undo = useWorkflowStore((s) => s.undo);
  const redo = useWorkflowStore((s) => s.redo);
  const pastLength = useWorkflowStore((s) => s.past.length);
  const futureLength = useWorkflowStore((s) => s.future.length);

  return (
    <div className="absolute top-4 left-4 z-10 flex items-center gap-1.5 p-1 bg-background/50 backdrop-blur-md rounded-xl border border-border/50 shadow-sm text-muted-foreground">
      <button 
        onClick={undo} 
        disabled={pastLength === 0}
        className="p-1.5 rounded-lg hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
        title="撤销 Undo (Ctrl+Z)"
      >
        <Undo strokeWidth={2} size={16} />
      </button>
      <button 
        onClick={redo} 
        disabled={futureLength === 0}
        className="p-1.5 rounded-lg hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
        title="重做 Redo (Ctrl+Y)"
      >
        <Redo strokeWidth={2} size={16} />
      </button>
    </div>
  );
}

function WorkflowCanvasInner() {
  const {
    edges,
    nodes,
    onConnect,
    onEdgesChange,
    onNodesChange,
    selectedNodeId,
    setSelectedNodeId,
    setNodes,
  } = useWorkflowStore();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [canvasTool, setCanvasTool] = useState<CanvasTool>('pan');
  const [modal, setModal] = useState<{ title: string; message: string } | null>(null);
  const reactFlowInstance = useReactFlow();
  const annotationCountRef = useRef(0);

  // ── Context menu state ────────────────────────────────────────────────────
  const [canvasMenu, setCanvasMenu] = useState<{ x: number; y: number } | null>(null);
  const [nodeMenu, setNodeMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null);

  // ── Background theme ──────────────────────────────────────────────────────
  const [bgIndex, setBgIndex] = useState(0);

  // ── Fullscreen state ──────────────────────────────────────────────────────
  const [isFullscreen, setIsFullscreen] = useState(false);
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  const selectedNodeData = useMemo(
    () =>
      ((selectedNodeId
        ? nodes.find((node) => node.id === selectedNodeId)?.data
        : null) as unknown as AIStepNodeData | null) ?? null,
    [nodes, selectedNodeId]
  );

  const defaultEdgeOptions = useMemo(
    () => ({
      type: 'default',
      animated: false,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 16,
        height: 16,
        color: 'var(--edge-marker-color, #78716c)',
      },
    }),
    []
  );

  const fitViewOptions = useMemo(() => ({ padding: 0.18 }), []);
  const proOptions = useMemo(() => ({ hideAttribution: true }), []);

  const handleNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      setSelectedNodeId(node.id);
      if (typeof window !== 'undefined' && window.innerWidth < 768) {
        setDrawerOpen(true);
      }
    },
    [setSelectedNodeId]
  );

  const handlePaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setCanvasMenu(null);
    setNodeMenu(null);
  }, [setSelectedNodeId]);

  const handleSelectionChange = useCallback(
    ({ nodes: selectedNodes }: { nodes: { id: string }[] }) => {
      const nextId = selectedNodes[0]?.id ?? null;
      setSelectedNodeId(nextId);
    },
    [setSelectedNodeId]
  );

  const handleDrawerClose = useCallback(() => {
    setDrawerOpen(false);
  }, []);

  // ── Canvas right-click handler ────────────────────────────────────────────
  const handlePaneContextMenu = useCallback((event: MouseEvent | React.MouseEvent) => {
    event.preventDefault();
    setNodeMenu(null);
    setCanvasMenu({ x: (event as MouseEvent).clientX, y: (event as MouseEvent).clientY });
  }, []);

  // ── Node right-click handler ──────────────────────────────────────────────
  const handleNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      setCanvasMenu(null);
      setSelectedNodeId(node.id);
      setNodeMenu({ x: event.clientX, y: event.clientY, nodeId: node.id });
    },
    [setSelectedNodeId]
  );

  // ── Toggle background ─────────────────────────────────────────────────────
  const handleToggleBg = useCallback(() => {
    setBgIndex((prev) => (prev + 1) % BG_PRESETS.length);
  }, []);

  // ── Fullscreen toggle ─────────────────────────────────────────────────────
  const handleToggleFullscreen = useCallback(() => {
    const el = canvasContainerRef.current;
    if (!el) return;

    if (!document.fullscreenElement) {
      void el.requestFullscreen().then(() => setIsFullscreen(true));
    } else {
      void document.exitFullscreen().then(() => setIsFullscreen(false));
    }
  }, []);

  // Listen for fullscreen exit (Esc is handled natively by the browser)
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // ── Paste from clipboard (shared logic for menu & shortcut) ───────────────
  const handlePasteFromClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      const data = JSON.parse(text);
      if (data && data.source === 'studysolo-canvas' && Array.isArray(data.nodes)) {
        const store = useWorkflowStore.getState();
        store.takeSnapshot();

        let flowPos = { x: 0, y: 0 };
        if (reactFlowInstance && canvasMenu) {
          flowPos = reactFlowInstance.screenToFlowPosition({ x: canvasMenu.x, y: canvasMenu.y });
        } else if (reactFlowInstance) {
          flowPos = reactFlowInstance.screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
        }

        let minX = Infinity, minY = Infinity;
        data.nodes.forEach((n: Node) => {
          if (n.position.x < minX) minX = n.position.x;
          if (n.position.y < minY) minY = n.position.y;
        });

        const newNodes = data.nodes.map((n: Node) => {
          const newId = `${n.type}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
          return {
            ...n,
            id: newId,
            selected: true,
            position: {
              x: flowPos.x + (n.position.x - minX),
              y: flowPos.y + (n.position.y - minY),
            },
          };
        });

        const currentNodes = store.nodes.map(n => ({ ...n, selected: false }));
        store.setNodes([...currentNodes, ...newNodes]);
      }
    } catch (err) {
      console.warn('Failed to paste from clipboard or invalid format', err);
    }
  }, [reactFlowInstance, canvasMenu]);

  // ── Copy node to clipboard (shared logic for menu & shortcut) ─────────────
  const handleCopyNode = useCallback(async (nodeId?: string) => {
    const targetNodes = nodeId
      ? useWorkflowStore.getState().nodes.filter((n) => n.id === nodeId)
      : useWorkflowStore.getState().nodes.filter((n) => n.selected);
    if (targetNodes.length > 0) {
      const payload = JSON.stringify({ source: 'studysolo-canvas', nodes: targetNodes });
      try {
        await navigator.clipboard.writeText(payload);
      } catch (err) {
        console.warn('Failed to copy to clipboard', err);
      }
    }
  }, []);

  // ── Delete node ───────────────────────────────────────────────────────────
  const handleDeleteNode = useCallback((nodeId: string) => {
    const store = useWorkflowStore.getState();
    store.takeSnapshot();
    store.setNodes(store.nodes.filter((n) => n.id !== nodeId));
  }, []);

  // ── Track Mouse Position for Paste ──────────────────────────────────────────
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // ── Keyboard Shortcuts (Undo/Redo/Copy/Paste) ────────────────────────────
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const isCmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;
      const activeTagName = document.activeElement?.tagName.toLowerCase();
      if (activeTagName === 'input' || activeTagName === 'textarea') return;

      if (isCmdOrCtrl && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          useWorkflowStore.getState().redo();
        } else {
          useWorkflowStore.getState().undo();
        }
        e.preventDefault();
        return;
      }
      
      if (isCmdOrCtrl && e.key.toLowerCase() === 'y') {
        useWorkflowStore.getState().redo();
        e.preventDefault();
        return;
      }

      if (isCmdOrCtrl && e.key.toLowerCase() === 'c') {
        await handleCopyNode();
        return;
      }

      if (isCmdOrCtrl && e.key.toLowerCase() === 'v') {
        try {
          const text = await navigator.clipboard.readText();
          const data = JSON.parse(text);
          if (data && data.source === 'studysolo-canvas' && Array.isArray(data.nodes)) {
            const store = useWorkflowStore.getState();
            store.takeSnapshot();

            let flowPos = { x: 0, y: 0 };
            if (reactFlowInstance) {
              flowPos = reactFlowInstance.screenToFlowPosition({ x: mousePos.x, y: mousePos.y });
            }

            let minX = Infinity, minY = Infinity;
            data.nodes.forEach((n: Node) => {
              if (n.position.x < minX) minX = n.position.x;
              if (n.position.y < minY) minY = n.position.y;
            });

            const newNodes = data.nodes.map((n: Node) => {
              const newId = `${n.type}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
              return {
                ...n,
                id: newId,
                selected: true,
                position: {
                  x: flowPos.x + (n.position.x - minX),
                  y: flowPos.y + (n.position.y - minY),
                },
              };
            });

            const currentNodes = store.nodes.map(n => ({ ...n, selected: false }));
            store.setNodes([...currentNodes, ...newNodes]);
          }
        } catch (err) {
          console.warn('Failed to paste from clipboard or invalid format', err);
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mousePos, reactFlowInstance, handleCopyNode]);

  // ── Listen for tool change events ──────────────────────────────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { tool: CanvasTool };
      setCanvasTool(detail.tool);
    };
    window.addEventListener('canvas:tool-change', handler);
    return () => window.removeEventListener('canvas:tool-change', handler);
  }, []);

  // ── Listen for modal events ────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { title: string; message: string };
      setModal(detail);
    };
    window.addEventListener('canvas:show-modal', handler);
    return () => window.removeEventListener('canvas:show-modal', handler);
  }, []);

  // ── Listen for focus-node events (from search) ────────────────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      const { nodeId } = (e as CustomEvent).detail as { nodeId: string };
      const node = nodes.find((n) => n.id === nodeId);
      if (node && reactFlowInstance) {
        reactFlowInstance.setCenter(
          node.position.x + 160,
          node.position.y + 60,
          { zoom: 1.2, duration: 400 }
        );
      }
    };
    window.addEventListener('canvas:focus-node', handler);
    return () => window.removeEventListener('canvas:focus-node', handler);
  }, [nodes, reactFlowInstance]);

  // ── Listen for annotation add events ───────────────────────────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      const { emoji } = (e as CustomEvent).detail as { emoji: string };
      annotationCountRef.current += 1;

      // Place annotation at viewport center
      const canvasCenter = reactFlowInstance.screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      });

      const newNode = {
        id: `annotation-${Date.now()}-${annotationCountRef.current}`,
        type: 'annotation',
        position: { x: canvasCenter.x, y: canvasCenter.y - 100 },
        data: { emoji, label: emoji },
        draggable: true,
        selectable: true,
      };

      const currentNodes = useWorkflowStore.getState().nodes;
      setNodes([...currentNodes, newNode]);
    };
    window.addEventListener('canvas:add-annotation', handler);
    return () => window.removeEventListener('canvas:add-annotation', handler);
  }, [reactFlowInstance, setNodes]);

  // ── Listen for annotation delete events ────────────────────────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      const { nodeId } = (e as CustomEvent).detail as { nodeId: string };
      const currentNodes = useWorkflowStore.getState().nodes;
      setNodes(currentNodes.filter((n) => n.id !== nodeId));
    };
    window.addEventListener('canvas:delete-annotation', handler);
    return () => window.removeEventListener('canvas:delete-annotation', handler);
  }, [setNodes]);

  // ── Compute React Flow props based on active tool ──────────────────────────
  const isSelectMode = canvasTool === 'select';
  const bgPreset = BG_PRESETS[bgIndex];

  return (
    <div
      ref={canvasContainerRef}
      className={`workflow-canvas relative h-full w-full ${bgPreset.className} ${
        isSelectMode ? 'cursor-crosshair' : ''
      }`}
      style={{ touchAction: 'none' }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        onSelectionChange={handleSelectionChange}
        onNodeContextMenu={handleNodeContextMenu}
        onPaneContextMenu={handlePaneContextMenu}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        connectionLineType={'smoothstep' as ConnectionLineType}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        fitViewOptions={fitViewOptions}
        onNodeDragStart={() => {
          useWorkflowStore.getState().takeSnapshot();
        }}
        // Interaction mode:
        //   select: panOnDrag=false, selectionOnDrag=true, nodesDraggable=true
        //   pan:    panOnDrag=true, selectionOnDrag=false, nodesDraggable=true
        panOnScroll={false}
        zoomOnPinch
        panOnDrag={!isSelectMode}
        nodesDraggable
        selectionOnDrag={isSelectMode}
        selectionMode={isSelectMode ? SelectionMode.Partial : SelectionMode.Full}
        nodeDragThreshold={4}
        minZoom={0.2}
        maxZoom={2}
        proOptions={proOptions}
      >
        <CanvasMiniMap />
        <HistoryControls />
        <Controls showInteractive={false} className="workflow-controls" position="bottom-right" />
      </ReactFlow>

      <FloatingToolbar />

      <BottomDrawer
        open={drawerOpen}
        onClose={handleDrawerClose}
        nodeId={selectedNodeId}
        nodeData={selectedNodeData}
      />

      {/* Canvas modal for edit/upload messages */}
      {modal && (
        <CanvasModal
          title={modal.title}
          message={modal.message}
          onClose={() => setModal(null)}
        />
      )}

      {/* ── Canvas right-click context menu ── */}
      {canvasMenu && (
        <CanvasContextMenu
          x={canvasMenu.x}
          y={canvasMenu.y}
          items={buildCanvasMenuItems({
            onPaste: () => void handlePasteFromClipboard(),
            onToggleBg: handleToggleBg,
            isFullscreen,
            onToggleFullscreen: handleToggleFullscreen,
          })}
          onClose={() => setCanvasMenu(null)}
        />
      )}

      {/* ── Node right-click context menu ── */}
      {nodeMenu && (
        <NodeContextMenu
          x={nodeMenu.x}
          y={nodeMenu.y}
          groups={buildNodeMenuGroups({
            onCopy: () => void handleCopyNode(nodeMenu.nodeId),
            onDelete: () => handleDeleteNode(nodeMenu.nodeId),
          })}
          onClose={() => setNodeMenu(null)}
        />
      )}
    </div>
  );
}

/**
 * WorkflowCanvas with ReactFlowProvider wrapper.
 * Required so useReactFlow() hook works inside.
 */
export default function WorkflowCanvas() {
  return (
    <ReactFlowProvider>
      <WorkflowCanvasInner />
    </ReactFlowProvider>
  );
}
