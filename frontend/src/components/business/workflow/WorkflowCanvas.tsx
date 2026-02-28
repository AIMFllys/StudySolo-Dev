'use client';

import { useCallback, useState } from 'react';
import {
  ReactFlow,
  Controls,
  type NodeTypes,
  type EdgeTypes,
  type NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useWorkflowStore } from '@/stores/use-workflow-store';
import AIStepNode from '@/components/business/workflow/nodes/AIStepNode';
import AnimatedEdge from '@/components/business/workflow/edges/AnimatedEdge';
import BottomDrawer from '@/components/business/workflow/BottomDrawer';
import type { AIStepNodeData } from '@/types';

// Node type registry
const nodeTypes: NodeTypes = {
  ai_analyzer: AIStepNode,
  ai_planner: AIStepNode,
  outline_gen: AIStepNode,
  content_extract: AIStepNode,
  summary: AIStepNode,
  flashcard: AIStepNode,
  chat_response: AIStepNode,
  write_db: AIStepNode,
  trigger_input: AIStepNode,
};

// Edge type registry
const edgeTypes: EdgeTypes = {
  default: AnimatedEdge,
};

export default function WorkflowCanvas() {
  const { nodes, edges, onNodesChange, onEdgesChange } = useWorkflowStore();

  const handleNodesChange = useCallback(onNodesChange, [onNodesChange]);
  const handleEdgesChange = useCallback(onEdgesChange, [onEdgesChange]);

  // BottomDrawer state for mobile node click
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNodeData, setSelectedNodeData] = useState<AIStepNodeData | null>(null);

  const handleNodeClick: NodeMouseHandler = useCallback((_event, node) => {
    // Only open drawer on mobile viewports (< 768px)
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setSelectedNodeId(node.id);
      setSelectedNodeData((node.data as AIStepNodeData) ?? null);
      setDrawerOpen(true);
    }
  }, []);

  const handleDrawerClose = useCallback(() => {
    setDrawerOpen(false);
  }, []);

  return (
    <div
      className="w-full h-full bg-[#050B1D] bg-grid-pattern-canvas workflow-canvas"
      style={{ touchAction: 'none' }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={{
          type: 'default',
          animated: false,
        }}
        fitView
        panOnScroll={false}
        zoomOnPinch={true}
        panOnDrag={true}
        nodeDragThreshold={4}
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        {/* Zoom controls — bottom-right capsule */}
        <Controls
          showInteractive={false}
          className="workflow-controls"
          position="bottom-right"
        />
      </ReactFlow>

      {/* Mobile bottom drawer for node details */}
      <BottomDrawer
        open={drawerOpen}
        onClose={handleDrawerClose}
        nodeId={selectedNodeId}
        nodeData={selectedNodeData}
      />
    </div>
  );
}
