'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { X, ChevronUp, ChevronDown } from 'lucide-react';
import { useWorkflowStore } from '@/stores/workflow/use-workflow-store';
import type { AIStepNodeData } from '@/types';
import { eventBus } from '@/lib/events/event-bus';

interface SearchBarProps {
  onClose: () => void;
}

/**
 * Small search bar that pops above the toolbar.
 * Highlights matching nodes by name, Enter cycles through results.
 * Supports Ctrl+P shortcut to open.
 */
export default function SearchBar({ onClose }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const nodes = useWorkflowStore((s) => s.nodes);
  const setSelectedNodeId = useWorkflowStore((s) => s.setSelectedNodeId);

  // Find matching nodes
  const matchingNodes = useMemo(() => {
    if (!query.trim()) {
      return [];
    }
    return nodes.filter((n) => {
      const data = n.data as unknown as AIStepNodeData;
      const label = data?.label ?? '';
      return label.toLowerCase().includes(query.toLowerCase());
    });
  }, [nodes, query]);

  const totalMatches = matchingNodes.length;

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Highlight and navigate to matched node
  useEffect(() => {
    if (totalMatches > 0 && matchingNodes[currentIndex]) {
      const node = matchingNodes[currentIndex];
      setSelectedNodeId(node.id);

      // Dispatch event to center the canvas on this node
      eventBus.emit('canvas:focus-node', { nodeId: node.id });
    }
  }, [currentIndex, totalMatches, matchingNodes, setSelectedNodeId]);

  const goNext = useCallback(() => {
    if (totalMatches > 0) {
      setCurrentIndex((prev) => (prev + 1) % totalMatches);
    }
  }, [totalMatches]);

  const goPrev = useCallback(() => {
    if (totalMatches > 0) {
      setCurrentIndex((prev) => (prev - 1 + totalMatches) % totalMatches);
    }
  }, [totalMatches]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) {
          goPrev();
        } else {
          goNext();
        }
      }
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [goNext, goPrev, onClose]
  );

  return (
    <div className="canvas-search-bar">
      <input
        ref={inputRef}
        type="text"
        className="canvas-search-input"
        placeholder="搜索节点名称..."
        value={query}
        onChange={(e) => {
          setCurrentIndex(0);
          setQuery(e.target.value);
        }}
        onKeyDown={handleKeyDown}
      />

      {query.trim() && (
        <span className="canvas-search-count">
          {totalMatches > 0 ? `${currentIndex + 1}/${totalMatches}` : '0 结果'}
        </span>
      )}

      <button
        type="button"
        className="canvas-search-nav"
        onClick={goPrev}
        disabled={totalMatches === 0}
        title="上一个 (Shift+Enter)"
      >
        <ChevronUp className="h-3.5 w-3.5" />
      </button>

      <button
        type="button"
        className="canvas-search-nav"
        onClick={goNext}
        disabled={totalMatches === 0}
        title="下一个 (Enter)"
      >
        <ChevronDown className="h-3.5 w-3.5" />
      </button>

      <button
        type="button"
        className="canvas-search-close"
        onClick={onClose}
        title="关闭 (Esc)"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
