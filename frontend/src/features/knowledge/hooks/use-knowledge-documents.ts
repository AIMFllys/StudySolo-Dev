'use client';

import { useCallback, useEffect, useState } from 'react';
import type { KBDocument, KnowledgeApiError } from '../types';
import { getErrorMessage } from '../utils';
import { authedFetch } from '@/services/api-client';

async function parseJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export function useKnowledgeDocuments() {
  const [documents, setDocuments] = useState<KBDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    try {
      const response = await authedFetch('/api/knowledge', {});
      if (!response.ok) {
        throw new Error('加载知识库失败');
      }
      const data = await response.json();
      setDocuments(data);
    } catch (fetchError) {
      setError(getErrorMessage(fetchError, '加载知识库失败'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchDocuments();
  }, [fetchDocuments]);

  useEffect(() => {
    if (!documents.some((document) => document.status === 'processing')) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      void fetchDocuments();
    }, 4000);

    return () => window.clearInterval(timer);
  }, [documents, fetchDocuments]);

  const uploadFile = useCallback(async (file: File) => {
    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await authedFetch('/api/knowledge/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await parseJson<KnowledgeApiError>(response);
        throw new Error(data?.detail ?? '上传失败');
      }

      await fetchDocuments();
    } catch (uploadError) {
      setError(getErrorMessage(uploadError, '上传失败'));
    } finally {
      setUploading(false);
    }
  }, [fetchDocuments]);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);
    const files = event.dataTransfer.files;
    if (files.length > 0) {
      void uploadFile(files[0]);
    }
  }, [uploadFile]);

  const handleFileInput = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      void uploadFile(files[0]);
    }
  }, [uploadFile]);

  const handleDelete = useCallback(async (documentId: string) => {
    try {
      const response = await authedFetch(`/api/knowledge/${documentId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('删除失败');
      }
      setDocuments((previous) => previous.filter((document) => document.id !== documentId));
    } catch (deleteError) {
      setError(getErrorMessage(deleteError, '删除失败'));
    } finally {
      setDeleteConfirm(null);
    }
  }, []);

  return {
    documents,
    loading,
    uploading,
    dragOver,
    error,
    deleteConfirm,
    setDragOver,
    setDeleteConfirm,
    clearError: () => setError(null),
    refreshDocuments: fetchDocuments,
    handleDrop,
    handleFileInput,
    handleDelete,
  };
}
