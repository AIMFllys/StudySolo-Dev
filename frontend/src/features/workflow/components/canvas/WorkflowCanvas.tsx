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
  reconnectEdge,
  type Edge,
  type EdgeMouseHandler,
} from '@xyflow/react';
import type { Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import ExecutionTraceDrawer from '@/features/workflow/components/execution/ExecutionTraceDrawer';
import FloatingToolbar from '@/features/workflow/components/toolbar/FloatingToolbar';
import type { CanvasTool } from '@/features/workflow/components/toolbar/FloatingToolbar';
import AnimatedEdge from '@/features/workflow/components/canvas/edges/AnimatedEdge';
import SequentialEdge from '@/features/workflow/components/canvas/edges/SequentialEdge';
import AIStepNode from '@/features/workflow/components/nodes/AIStepNode';
import GeneratingNode from '@/features/workflow/components/nodes/GeneratingNode';
import AnnotationNode from '@/features/workflow/components/nodes/AnnotationNode';
import LoopGroupNode from '@/features/workflow/components/nodes/LoopGroupNode';
import CanvasModal from '@/features/workflow/components/canvas/CanvasModal';
import CanvasMiniMap from '@/features/workflow/components/canvas/CanvasMiniMap';
import CanvasContextMenu, { buildCanvasMenuItems } from '@/features/workflow/components/canvas/CanvasContextMenu';
import NodeContextMenu, { buildNodeMenuGroups } from '@/features/workflow/components/canvas/NodeContextMenu';
import EdgeContextMenu from '@/features/workflow/components/canvas/EdgeContextMenu';
import NodeConfigDrawer from '@/features/workflow/components/node-config/NodeConfigDrawer';
import type { NodeConfigAnchorRect } from '@/features/workflow/components/node-config/popover-position';
import { useLoopGroupDrop } from '@/features/workflow/hooks/use-loop-group-drop';
import { NODE_TYPE_META } from '@/features/workflow/constants/workflow-meta';
import { useWorkflowStore } from '@/stores/use-workflow-store';
import type { NodeType } from '@/types';

type WorkflowCanvasNodeData = Record<string, unknown> & { hideSlip?: boolean };

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
  ai_step: AIStepNode, // 兼容历史数据兜底
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
  // ── 循环容器块 ──
  loop_group: LoopGroupNode,
};

const edgeTypes: EdgeTypes = {
  default: AnimatedEdge,
  sequential: SequentialEdge,
};

/** Create default node data for any node type. */
function createDefaultNodeData(nodeType: string): Record<string, unknown> {
  if (nodeType === 'loop_group') {
    return { label: '循环块', maxIterations: 3, intervalSeconds: 0 };
  }
  const meta = NODE_TYPE_META[nodeType as NodeType];
  return {
    label: meta?.label ?? nodeType,
    type: nodeType,
    system_prompt: '',
    model_route: '',
    status: 'pending',
    output: '',
    config: {},
  };
}

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

  const edges = useWorkflowStore((state) => state.edges);
  const nodes = useWorkflowStore((state) => state.nodes);
  const onConnect = useWorkflowStore((state) => state.onConnect);
  const onEdgesChange = useWorkflowStore((state) => state.onEdgesChange);
  const onNodesChange = useWorkflowStore((state) => state.onNodesChange);
  const setSelectedNodeId = useWorkflowStore((state) => state.setSelectedNodeId);
  const setNodes = useWorkflowStore((state) => state.setNodes);
  const [canvasTool, setCanvasTool] = useState<CanvasTool>('pan');
  const [modal, setModal] = useState<{ title: string; message: string } | null>(null);
  const [placementMode, setPlacementMode] = useState<string | null>(null);
  const [configNodeId, setConfigNodeId] = useState<string | null>(null);
  const [configAnchorRect, setConfigAnchorRect] = useState<NodeConfigAnchorRect | null>(null);
  const reactFlowInstance = useReactFlow();
  const annotationCountRef = useRef(0);
  const handleNodeDragStop = useLoopGroupDrop();

  // ── Node store drag-and-drop ──────────────────────────────────────────────
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const nodeType = e.dataTransfer.getData('application/studysolo-node-type');
      if (!nodeType) return;

      const flowPos = reactFlowInstance.screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      });

      const store = useWorkflowStore.getState();
      store.takeSnapshot();

      const isLoop = nodeType === 'loop_group';
      const nodeId = `${nodeType}-${Date.now().toString(36)}`;

      const newNode: Node = {
        id: nodeId,
        type: nodeType,
        position: {
          x: flowPos.x - (isLoop ? 250 : 176),
          y: flowPos.y - (isLoop ? 175 : 70),
        },
        data: createDefaultNodeData(nodeType),
        ...(isLoop ? { style: { width: 500, height: 350 } } : {}),
      };

      store.setNodes([...store.nodes, newNode]);
      setSelectedNodeId(nodeId);
    },
    [reactFlowInstance, setSelectedNodeId]
  );

  // ── Context menu state ────────────────────────────────────────────────────
  const [canvasMenu, setCanvasMenu] = useState<{ x: number; y: number } | null>(null);
  const [nodeMenu, setNodeMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null);

  // ── Background theme ──────────────────────────────────────────────────────
  const [bgIndex, setBgIndex] = useState(0);

  // ── Fullscreen state ──────────────────────────────────────────────────────
  const [isFullscreen, setIsFullscreen] = useState(false);
  const canvasContainerRef = useRef<HTMLDivElement>(null);

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
    },
    [setSelectedNodeId]
  );

  const handlePaneClick = useCallback(
    (event: React.MouseEvent) => {
      setCanvasMenu(null);
      setNodeMenu(null);
      setEdgeMenu(null);

      // Placement mode: place a node on canvas click
      if (placementMode && (placementMode === 'logic_switch' || placementMode === 'loop_group')) {
        const flowPos = reactFlowInstance.screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });
        const store = useWorkflowStore.getState();
        store.takeSnapshot();

        const nodeId = `${placementMode}-${Date.now().toString(36)}`;
        const isLoop = placementMode === 'loop_group';

        const newNode: Node = {
          id: nodeId,
          type: placementMode,
          position: { x: flowPos.x - (isLoop ? 150 : 176), y: flowPos.y - (isLoop ? 100 : 70) },
          data: isLoop
            ? { label: '循环块', maxIterations: 3, intervalSeconds: 0 }
            : { label: '逻辑分支', type: 'logic_switch', system_prompt: '', model_route: '', status: 'pending', output: '', config: {} },
          ...(isLoop ? { style: { width: 500, height: 350 } } : {}),
        };

        store.setNodes([...store.nodes, newNode]);
        setSelectedNodeId(nodeId);
        setPlacementMode(null);
        return;
      }

      setSelectedNodeId(null);
      useWorkflowStore.getState().cancelClickConnect();
    },
    [setSelectedNodeId, placementMode, reactFlowInstance]
  );

  const handleSelectionChange = useCallback(
    ({ nodes: selectedNodes }: { nodes: { id: string }[] }) => {
      const nextId = selectedNodes[0]?.id ?? null;
      setSelectedNodeId(nextId);
    },
    [setSelectedNodeId]
  );

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
  // ── Edge reconnection handler ──────────────────────────────────────────────
  const edgeReconnectSuccessful = useRef(false);

  const handleReconnectStart = useCallback(() => {
    edgeReconnectSuccessful.current = false;
  }, []);

  const handleEdgeReconnect = useCallback(
    (oldEdge: Edge, newConnection: { source: string; target: string; sourceHandle: string | null; targetHandle: string | null }) => {
      edgeReconnectSuccessful.current = true;
      useWorkflowStore.getState().takeSnapshot();
      const currentEdges = useWorkflowStore.getState().edges;
      const updatedEdges = reconnectEdge(oldEdge, newConnection, currentEdges);
      useWorkflowStore.getState().setEdges(updatedEdges);
    },
    []
  );

  const handleReconnectEnd = useCallback((_event: MouseEvent | TouchEvent, edge: Edge) => {
    if (!edgeReconnectSuccessful.current) {
      // Dropped on empty space - delete the edge
      useWorkflowStore.getState().takeSnapshot();
      const currentEdges = useWorkflowStore.getState().edges;
      useWorkflowStore.getState().setEdges(currentEdges.filter((e) => e.id !== edge.id));
    }
    edgeReconnectSuccessful.current = false;
  }, []);

  // ── Edge click handler ────────────────────────────────────────────────────
  const handleEdgeClick: EdgeMouseHandler = useCallback(() => {
    // Edge selection is handled natively by React Flow
    setCanvasMenu(null);
    setNodeMenu(null);
  }, []);

  // ── Edge right-click handler ──────────────────────────────────────────────
  const [edgeMenu, setEdgeMenu] = useState<{ x: number; y: number; edgeId: string } | null>(null);

  const handleEdgeContextMenu = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      event.preventDefault();
      setCanvasMenu(null);
      setNodeMenu(null);
      setEdgeMenu({ x: event.clientX, y: event.clientY, edgeId: edge.id });
    },
    []
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

      // Escape: cancel click-to-connect
      if (e.key === 'Escape') {
        const store = useWorkflowStore.getState();
        if (store.clickConnectState.phase !== 'idle') {
          store.cancelClickConnect();
          e.preventDefault();
          return;
        }
      }

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

  // ── Listen for placement mode events ────────────────────────────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      const { mode } = (e as CustomEvent).detail as { mode: string };
      setPlacementMode(mode === 'connect' ? null : mode);
    };
    window.addEventListener('canvas:placement-mode', handler);
    return () => window.removeEventListener('canvas:placement-mode', handler);
  }, []);

  // ── Listen for node-store click-to-add events ─────────────────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      const { nodeType } = (e as CustomEvent).detail as { nodeType: string };
      if (!nodeType) return;

      const store = useWorkflowStore.getState();
      store.takeSnapshot();

      const isLoop = nodeType === 'loop_group';
      const nodeId = `${nodeType}-${Date.now().toString(36)}`;
      const canvasCenter = reactFlowInstance.screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      });

      const newNode: Node = {
        id: nodeId,
        type: nodeType,
        position: {
          x: canvasCenter.x - (isLoop ? 250 : 176),
          y: canvasCenter.y - (isLoop ? 175 : 70),
        },
        data: createDefaultNodeData(nodeType),
        ...(isLoop ? { style: { width: 500, height: 350 } } : {}),
      };

      store.setNodes([...store.nodes, newNode]);
      setSelectedNodeId(nodeId);
    };
    window.addEventListener('node-store:add-node', handler);
    return () => window.removeEventListener('node-store:add-node', handler);
  }, [reactFlowInstance, setSelectedNodeId]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        nodeId?: string;
        anchorRect?: NodeConfigAnchorRect | null;
      };
      if (detail?.nodeId) {
        setConfigNodeId(detail.nodeId);
        setConfigAnchorRect(detail.anchorRect ?? null);
      }
    };
    window.addEventListener('workflow:open-node-config', handler);
    return () => window.removeEventListener('workflow:open-node-config', handler);
  }, []);

  useEffect(() => {
    const handler = () => {
      setConfigNodeId(null);
      setConfigAnchorRect(null);
    };
    window.addEventListener('workflow:close-node-config', handler);
    return () => window.removeEventListener('workflow:close-node-config', handler);
  }, []);

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
      onDrop={handleDrop}
      onDragOver={handleDragOver}
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
        edgesReconnectable
        reconnectRadius={25}
        onReconnectStart={handleReconnectStart}
        onReconnect={handleEdgeReconnect}
        onReconnectEnd={handleReconnectEnd}
        onEdgeClick={handleEdgeClick}
        onEdgeContextMenu={handleEdgeContextMenu}
        onNodeDragStart={() => {
          useWorkflowStore.getState().takeSnapshot();
        }}
        onNodeDragStop={handleNodeDragStop}
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

      <ExecutionTraceDrawer />

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
            onConfigure: () => {
              setConfigNodeId(nodeMenu.nodeId);
              setConfigAnchorRect({
                top: nodeMenu.y,
                left: nodeMenu.x,
                right: nodeMenu.x,
                bottom: nodeMenu.y,
                width: 0,
                height: 0,
              });
            },
            onDelete: () => handleDeleteNode(nodeMenu.nodeId),
            onToggleSlip: () => {
              const node = useWorkflowStore.getState().nodes.find(n => n.id === nodeMenu.nodeId);
              const hideSlip = (node?.data as WorkflowCanvasNodeData | undefined)?.hideSlip === true;
              useWorkflowStore.getState().updateNodeData(nodeMenu.nodeId, { hideSlip: !hideSlip });
            },
            onToggleGlobalSlips: () => useWorkflowStore.getState().toggleGlobalNodeSlips(),
            isSlipHidden:
              (useWorkflowStore.getState().nodes.find(n => n.id === nodeMenu.nodeId)?.data as WorkflowCanvasNodeData | undefined)?.hideSlip === true,
            isGlobalSlipsHidden: !useWorkflowStore.getState().showAllNodeSlips,
          })}
          onClose={() => setNodeMenu(null)}
        />
      )}

      <NodeConfigDrawer
        key={configNodeId ?? 'node-config-drawer'}
        nodeId={configNodeId}
        anchorRect={configAnchorRect}
        onClose={() => {
          setConfigNodeId(null);
          setConfigAnchorRect(null);
        }}
      />

      {/* ── Edge right-click context menu ── */}
      {edgeMenu && (
        <EdgeContextMenu
          x={edgeMenu.x}
          y={edgeMenu.y}
          edgeId={edgeMenu.edgeId}
          onClose={() => setEdgeMenu(null)}
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
