'use client';

import { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import {
  Controls,
  type ConnectionLineType,
  MarkerType,
  ReactFlow,
  type NodeMouseHandler,
  useReactFlow,
  SelectionMode,
  ReactFlowProvider,
  reconnectEdge,
  type Edge,
  type EdgeMouseHandler,
} from '@xyflow/react';
import type { Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import FloatingToolbar from '@/features/workflow/components/toolbar/FloatingToolbar';
import type { CanvasTool } from '@/features/workflow/components/toolbar/FloatingToolbar';
import CanvasModal from '@/features/workflow/components/canvas/CanvasModal';
import CanvasMiniMap from '@/features/workflow/components/canvas/CanvasMiniMap';
import CanvasContextMenu, { buildCanvasMenuItems } from '@/features/workflow/components/canvas/CanvasContextMenu';
import NodeContextMenu, { buildNodeMenuGroups } from '@/features/workflow/components/canvas/NodeContextMenu';
import EdgeContextMenu from '@/features/workflow/components/canvas/EdgeContextMenu';
import NodeConfigDrawer from '@/features/workflow/components/node-config/NodeConfigDrawer';
import type { NodeConfigAnchorRect } from '@/features/workflow/components/node-config/popover-position';
import { HistoryControls } from '@/features/workflow/components/canvas/HistoryControls';
import { nodeTypes, edgeTypes, BG_PRESETS } from '@/features/workflow/components/canvas/canvas-constants';
import { useLoopGroupDrop } from '@/features/workflow/hooks/use-loop-group-drop';
import { useCanvasClipboard } from '@/features/workflow/hooks/use-canvas-clipboard';
import { useCanvasKeyboard } from '@/features/workflow/hooks/use-canvas-keyboard';
import { useCanvasEventListeners } from '@/features/workflow/hooks/use-canvas-event-listeners';
import { useCanvasDnd } from '@/features/workflow/hooks/use-canvas-dnd';
import { useCanvasTouch } from '@/features/workflow/hooks/use-canvas-touch';
import { useIsTouchDevice } from '@/hooks/mobile';
import { useWorkflowStore } from '@/stores/workflow/use-workflow-store';
import { eventBus } from '@/lib/events/event-bus';

type WorkflowCanvasNodeData = Record<string, unknown> & { hideSlip?: boolean };

function WorkflowCanvasInner() {
  const edges = useWorkflowStore((s) => s.edges);
  const nodes = useWorkflowStore((s) => s.nodes);
  const onConnect = useWorkflowStore((s) => s.onConnect);
  const onEdgesChange = useWorkflowStore((s) => s.onEdgesChange);
  const onNodesChange = useWorkflowStore((s) => s.onNodesChange);
  const setSelectedNodeId = useWorkflowStore((s) => s.setSelectedNodeId);
  const setNodes = useWorkflowStore((s) => s.setNodes);

  const [canvasTool, setCanvasTool] = useState<CanvasTool>('pan');
  const [modal, setModal] = useState<{ title: string; message: string } | null>(null);
  const [placementMode, setPlacementMode] = useState<string | null>(null);
  const [configNodeId, setConfigNodeId] = useState<string | null>(null);
  const [configAnchorRect, setConfigAnchorRect] = useState<NodeConfigAnchorRect | null>(null);
  const [canvasMenu, setCanvasMenu] = useState<{ x: number; y: number } | null>(null);
  const [nodeMenu, setNodeMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null);
  const [edgeMenu, setEdgeMenu] = useState<{ x: number; y: number; edgeId: string } | null>(null);
  const [allSlipsExpanded, setAllSlipsExpanded] = useState(false);
  const [bgIndex, setBgIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const reactFlowInstance = useReactFlow();
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const handleNodeDragStop = useLoopGroupDrop();

  // #region agent log
  useEffect(() => {
    if (!nodes.length) return;
    const xs = nodes.map((n) => n.position?.x ?? 0);
    const ys = nodes.map((n) => n.position?.y ?? 0);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const viewport = reactFlowInstance.getViewport?.() as { x?: number; y?: number; zoom?: number } | undefined;
    fetch('/api/debug/log',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'f04052'},body:JSON.stringify({sessionId:'f04052',runId:'pre-fix',hypothesisId:'H6',location:'WorkflowCanvas.tsx:71',message:'canvas viewport + node bbox (post render)',data:{nodeCount:nodes.length,bbox:{minX,maxX,minY,maxY,width:maxX-minX,height:maxY-minY},sample:nodes.slice(0,6).map((n)=>({id:n.id,x:n.position?.x,y:n.position?.y,type:n.type})),viewport},timestamp:Date.now()})}).catch(()=>{});
  }, [nodes, reactFlowInstance]);
  // #endregion

  // ── Extracted hooks ─────────────────────────────────────────────────────
  const { copyNodes, pasteAtScreen, deleteNode } = useCanvasClipboard(reactFlowInstance);
  const { handleDragOver, handleDrop } = useCanvasDnd(reactFlowInstance, setSelectedNodeId);
  useCanvasKeyboard({ reactFlowInstance, copyNodes, pasteAtScreen });
  useCanvasEventListeners({
    reactFlowInstance, nodes, setCanvasTool, setModal, setPlacementMode,
    setConfigNodeId, setConfigAnchorRect, setNodes, setSelectedNodeId,
  });

  // ── Mobile touch support ─────────────────────────────────────────────────
  const isTouchDevice = useIsTouchDevice();

  // Handle long press for context menus on mobile
  const handleNodeLongPress = useCallback((nodeId: string, position: { x: number; y: number }) => {
    setCanvasMenu(null);
    setSelectedNodeId(nodeId);
    setNodeMenu({ x: position.x, y: position.y, nodeId });
  }, [setSelectedNodeId]);

  const handleCanvasLongPress = useCallback((position: { x: number; y: number }) => {
    setNodeMenu(null);
    setCanvasMenu({ x: position.x, y: position.y });
  }, []);

  const { touchHandlers } = useCanvasTouch({
    reactFlowInstance,
    enablePinchZoom: true,
    enablePan: true,
    onNodeLongPress: handleNodeLongPress,
    onCanvasLongPress: handleCanvasLongPress,
  });

  // ── Fullscreen ──────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const handleToggleFullscreen = useCallback(() => {
    const el = canvasContainerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      void el.requestFullscreen().then(() => setIsFullscreen(true));
    } else {
      void document.exitFullscreen().then(() => setIsFullscreen(false));
    }
  }, []);

  const handleToggleBg = useCallback(() => {
    setBgIndex((prev) => (prev + 1) % BG_PRESETS.length);
  }, []);

  // ── Edge reconnection ──────────────────────────────────────────────────
  const edgeReconnectSuccessful = useRef(false);
  const handleReconnectStart = useCallback(() => { edgeReconnectSuccessful.current = false; }, []);
  const handleEdgeReconnect = useCallback(
    (oldEdge: Edge, conn: { source: string; target: string; sourceHandle: string | null; targetHandle: string | null }) => {
      edgeReconnectSuccessful.current = true;
      useWorkflowStore.getState().takeSnapshot();
      useWorkflowStore.getState().setEdges(reconnectEdge(oldEdge, conn, useWorkflowStore.getState().edges));
    }, [],
  );
  const handleReconnectEnd = useCallback((_ev: MouseEvent | TouchEvent, edge: Edge) => {
    if (!edgeReconnectSuccessful.current) {
      useWorkflowStore.getState().takeSnapshot();
      useWorkflowStore.getState().setEdges(useWorkflowStore.getState().edges.filter((e) => e.id !== edge.id));
    }
    edgeReconnectSuccessful.current = false;
  }, []);

  // ── Click handlers ─────────────────────────────────────────────────────
  const handleNodeClick: NodeMouseHandler = useCallback((_ev, node) => setSelectedNodeId(node.id), [setSelectedNodeId]);
  const handleEdgeClick: EdgeMouseHandler = useCallback(() => { setCanvasMenu(null); setNodeMenu(null); }, []);

  const handlePaneClick = useCallback(
    (event: React.MouseEvent) => {
      setCanvasMenu(null); setNodeMenu(null); setEdgeMenu(null);
      if (placementMode && (placementMode === 'logic_switch' || placementMode === 'loop_group')) {
        const flowPos = reactFlowInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY });
        const store = useWorkflowStore.getState();
        store.takeSnapshot();
        const nodeId = `${placementMode}-${Date.now().toString(36)}`;
        const isLoop = placementMode === 'loop_group';
        const newNode: Node = {
          id: nodeId, type: placementMode,
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
    [setSelectedNodeId, placementMode, reactFlowInstance],
  );

  const handleSelectionChange = useCallback(
    ({ nodes: sel }: { nodes: { id: string }[] }) => setSelectedNodeId(sel[0]?.id ?? null),
    [setSelectedNodeId],
  );

  // ── Context menu handlers ──────────────────────────────────────────────
  const handlePaneContextMenu = useCallback((event: MouseEvent | React.MouseEvent) => {
    event.preventDefault(); setNodeMenu(null);
    setCanvasMenu({ x: (event as MouseEvent).clientX, y: (event as MouseEvent).clientY });
  }, []);

  const handleNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault(); setCanvasMenu(null); setSelectedNodeId(node.id);
      setNodeMenu({ x: event.clientX, y: event.clientY, nodeId: node.id });
    }, [setSelectedNodeId],
  );

  const handleEdgeContextMenu = useCallback((event: React.MouseEvent, edge: Edge) => {
    event.preventDefault(); setCanvasMenu(null); setNodeMenu(null);
    setEdgeMenu({ x: event.clientX, y: event.clientY, edgeId: edge.id });
  }, []);

  // ── Memoized options ───────────────────────────────────────────────────
  const defaultEdgeOptions = useMemo(() => ({
    type: 'default', animated: false,
    markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: 'var(--edge-marker-color, #78716c)' },
  }), []);
  const proOptions = useMemo(() => ({ hideAttribution: true }), []);

  const isSelectMode = canvasTool === 'select';
  const bgPreset = BG_PRESETS[bgIndex];

  // Fit view on demand (avoid constant fitView recalculation on every render)
  useEffect(() => {
    return eventBus.on('workflow:fit-view-request', () => {
      // Defer one frame to ensure nodes have mounted & measured.
      requestAnimationFrame(() => {
        reactFlowInstance.fitView({ padding: 0.18, duration: 260 });
      });
    });
  }, [reactFlowInstance]);

  return (
    <div ref={canvasContainerRef}
      className={`workflow-canvas relative h-full w-full ${bgPreset.className} ${isSelectMode ? 'cursor-crosshair' : ''}`}
      style={{ touchAction: 'none' }} onDrop={handleDrop} onDragOver={handleDragOver}
    >
      <ReactFlow
        nodes={nodes} edges={edges}
        onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}
        onNodeClick={handleNodeClick} onPaneClick={handlePaneClick}
        onSelectionChange={handleSelectionChange}
        onNodeContextMenu={handleNodeContextMenu} onPaneContextMenu={handlePaneContextMenu}
        nodeTypes={nodeTypes} edgeTypes={edgeTypes}
        connectionLineType={'smoothstep' as ConnectionLineType}
        defaultEdgeOptions={defaultEdgeOptions}
        edgesReconnectable reconnectRadius={isTouchDevice ? 35 : 25}
        onReconnectStart={handleReconnectStart} onReconnect={handleEdgeReconnect} onReconnectEnd={handleReconnectEnd}
        onEdgeClick={handleEdgeClick} onEdgeContextMenu={handleEdgeContextMenu}
        onNodeDragStart={() => useWorkflowStore.getState().takeSnapshot()}
        onNodeDragStop={handleNodeDragStop}
        // Mobile optimized settings
        panOnScroll={false}
        zoomOnPinch={true}
        zoomOnScroll={false}
        zoomOnDoubleClick={!isTouchDevice}
        panOnDrag={!isSelectMode}
        nodesDraggable
        selectionOnDrag={isSelectMode}
        selectionMode={isSelectMode ? SelectionMode.Partial : SelectionMode.Full}
        nodeDragThreshold={isTouchDevice ? 8 : 4}
        minZoom={0.2}
        maxZoom={2}
        proOptions={proOptions}
        // Touch event handlers
        {...touchHandlers}
      >
        <CanvasMiniMap />
        <HistoryControls />
        <Controls showInteractive={false} className="workflow-controls" position="bottom-right" />
      </ReactFlow>

      <FloatingToolbar />

      {modal && (
        <CanvasModal title={modal.title} message={modal.message} onClose={() => setModal(null)} />
      )}

      {canvasMenu && (
        <CanvasContextMenu x={canvasMenu.x} y={canvasMenu.y}
          items={buildCanvasMenuItems({
            onPaste: () => void pasteAtScreen(canvasMenu.x, canvasMenu.y),
            onToggleBg: handleToggleBg, isFullscreen, onToggleFullscreen: handleToggleFullscreen,
            allSlipsExpanded,
            onToggleAllSlips: () => {
              const next = !allSlipsExpanded;
              setAllSlipsExpanded(next);
              eventBus.emit('workflow:toggle-all-slips', { expanded: next });
            },
          })}
          onClose={() => setCanvasMenu(null)}
        />
      )}

      {nodeMenu && (
        <NodeContextMenu x={nodeMenu.x} y={nodeMenu.y}
          groups={buildNodeMenuGroups({
            onCopy: () => void copyNodes(nodeMenu.nodeId),
            onConfigure: () => {
              setConfigNodeId(nodeMenu.nodeId);
              setConfigAnchorRect({ top: nodeMenu.y, left: nodeMenu.x, right: nodeMenu.x, bottom: nodeMenu.y, width: 0, height: 0 });
            },
            onDelete: () => deleteNode(nodeMenu.nodeId),
            onToggleSlip: () => {
              const node = useWorkflowStore.getState().nodes.find(n => n.id === nodeMenu.nodeId);
              const hideSlip = (node?.data as WorkflowCanvasNodeData | undefined)?.hideSlip === true;
              useWorkflowStore.getState().updateNodeData(nodeMenu.nodeId, { hideSlip: !hideSlip });
            },
            onToggleGlobalSlips: () => useWorkflowStore.getState().toggleGlobalNodeSlips(),
            isSlipHidden: (useWorkflowStore.getState().nodes.find(n => n.id === nodeMenu.nodeId)?.data as WorkflowCanvasNodeData | undefined)?.hideSlip === true,
            isGlobalSlipsHidden: !useWorkflowStore.getState().showAllNodeSlips,
            allSlipsExpanded,
            onToggleAllSlipsExpand: () => {
              const next = !allSlipsExpanded;
              setAllSlipsExpanded(next);
              eventBus.emit('workflow:toggle-all-slips', { expanded: next });
            },
          })}
          onClose={() => setNodeMenu(null)}
        />
      )}

      <NodeConfigDrawer key={configNodeId ?? 'node-config-drawer'} nodeId={configNodeId} anchorRect={configAnchorRect}
        onClose={() => { setConfigNodeId(null); setConfigAnchorRect(null); }}
      />

      {edgeMenu && (
        <EdgeContextMenu x={edgeMenu.x} y={edgeMenu.y} edgeId={edgeMenu.edgeId} onClose={() => setEdgeMenu(null)} />
      )}
    </div>
  );
}

export default function WorkflowCanvas() {
  return (
    <ReactFlowProvider>
      <WorkflowCanvasInner />
    </ReactFlowProvider>
  );
}
