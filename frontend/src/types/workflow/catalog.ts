import type { Edge, Node } from '@xyflow/react';

export interface WorkflowMeta {
  id: string;
  name: string;
  description: string | null;
  status: string;
  isRunning?: boolean;
  tags: string[];
  is_public: boolean;
  is_featured: boolean;
  is_official: boolean;
  likes_count: number;
  favorites_count: number;
  owner_name: string | null;
  is_liked: boolean;
  is_favorited: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkflowContent {
  id: string;
  name: string;
  description: string | null;
  nodes_json: Node[];
  edges_json: Edge[];
  annotations_json?: Record<string, unknown>[];
  status: string;
  tags: string[];
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkflowPublicView {
  id: string;
  name: string;
  description: string | null;
  nodes_json: Node[];
  edges_json: Edge[];
  tags: string[];
  is_featured: boolean;
  is_official: boolean;
  likes_count: number;
  favorites_count: number;
  owner_name: string | null;
  is_liked: boolean;
  is_favorited: boolean;
  is_owner: boolean;
  created_at: string;
}

export interface InteractionToggleResponse {
  toggled: boolean;
  count: number;
}
