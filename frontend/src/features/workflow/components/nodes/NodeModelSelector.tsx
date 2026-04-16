'use client';

import React from 'react';
import type { NodeModelSource } from '@/types';
import { CatalogNodeModelSelector } from './CatalogNodeModelSelector';
import { AgentNodeModelSelector } from './AgentNodeModelSelector';

interface NodeModelSelectorProps {
  nodeId: string;
  nodeType: string;
  currentModel: string;
  nodeThemeColor: string;
  modelSource?: NodeModelSource;
  agentName?: string | null;
}

export const NodeModelSelector: React.FC<NodeModelSelectorProps> = ({
  nodeId,
  currentModel,
  modelSource,
  agentName,
}) => {
  if (modelSource === 'none') return null;

  if (modelSource === 'agent' && agentName) {
    return <AgentNodeModelSelector nodeId={nodeId} currentModel={currentModel} agentName={agentName} />;
  }

  return <CatalogNodeModelSelector nodeId={nodeId} currentModel={currentModel} />;
};
