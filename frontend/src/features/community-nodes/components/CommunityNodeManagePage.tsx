'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { CommunityNodeManageEditor } from '@/features/community-nodes/components/CommunityNodeManageEditor';
import {
  deleteCommunityNode,
  getMyCommunityNode,
  updateCommunityNode,
} from '@/services/community-nodes.service';
import type {
  CommunityNodeCategory,
  CommunityNodeMine,
  CommunityNodeModelPreference,
  CommunityNodeOutputFormat,
} from '@/types';

interface CommunityNodeManagePageProps {
  nodeId: string;
}

export function CommunityNodeManagePage({
  nodeId,
}: CommunityNodeManagePageProps) {
  const router = useRouter();
  const [node, setNode] = useState<CommunityNodeMine | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('other');
  const [icon, setIcon] = useState('Bot');
  const [prompt, setPrompt] = useState('');
  const [inputHint, setInputHint] = useState('');
  const [outputFormat, setOutputFormat] = useState<CommunityNodeOutputFormat>('markdown');
  const [schemaText, setSchemaText] = useState('');
  const [exampleText, setExampleText] = useState('');
  const [modelPreference, setModelPreference] = useState('auto');
  const [isGeneratingSchema, setIsGeneratingSchema] = useState(false);

  const parsedSchema = useMemo(() => {
    if (!schemaText.trim()) {
      return null;
    }
    try {
      return JSON.parse(schemaText) as Record<string, unknown>;
    } catch {
      return null;
    }
  }, [schemaText]);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    void getMyCommunityNode(nodeId)
      .then((result) => {
        if (cancelled) {
          return;
        }
        setNode(result);
        setName(result.name);
        setDescription(result.description);
        setCategory(result.category);
        setIcon(result.icon);
        setPrompt(result.prompt);
        setInputHint(result.input_hint);
        setOutputFormat(result.output_format as CommunityNodeOutputFormat);
        setSchemaText(
          result.output_schema
            ? JSON.stringify(result.output_schema, null, 2)
            : '',
        );
        setExampleText('');
        setModelPreference(result.model_preference);
      })
      .catch((error) => {
        const message =
          error instanceof Error ? error.message : '加载节点管理信息失败';
        toast.error(message);
        router.push('/workspace');
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [nodeId, router]);

  const handleSave = async () => {
    if (!name.trim() || !description.trim() || !prompt.trim()) {
      toast.error('请先填写完整的名称、描述和 Prompt');
      return;
    }
    if (outputFormat === 'json' && !parsedSchema) {
      toast.error('JSON 输出模式下需要合法的 JSON Schema');
      return;
    }

    setSaving(true);
    try {
      const updated = await updateCommunityNode(nodeId, {
        name: name.trim(),
        description: description.trim(),
        category: category as CommunityNodeCategory,
        icon,
        prompt,
        input_hint: inputHint.trim(),
        output_format: outputFormat,
        output_schema: outputFormat === 'json' ? parsedSchema : null,
        model_preference: modelPreference as CommunityNodeModelPreference,
      });
      setNode(updated);
      setSchemaText(
        updated.output_schema
          ? JSON.stringify(updated.output_schema, null, 2)
          : '',
      );
      toast.success('共享节点已更新');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '更新共享节点失败';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!node) {
      return;
    }

    const confirmed = window.confirm(
      `确认删除共享节点“${node.name}”？该操作不可恢复。`,
    );
    if (!confirmed) {
      return;
    }

    setDeleting(true);
    try {
      await deleteCommunityNode(nodeId);
      toast.success('共享节点已删除');
      router.push('/workspace');
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '删除共享节点失败';
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-10">
        <p className="text-sm text-muted-foreground">加载节点管理信息中...</p>
      </div>
    );
  }

  if (!node) {
    return null;
  }

  return (
    <CommunityNodeManageEditor
      node={node}
      name={name}
      description={description}
      category={category}
      icon={icon}
      prompt={prompt}
      inputHint={inputHint}
      outputFormat={outputFormat}
      schemaText={schemaText}
      exampleText={exampleText}
      modelPreference={modelPreference}
      isGeneratingSchema={isGeneratingSchema}
      saving={saving}
      deleting={deleting}
      onBack={() => router.push('/workspace')}
      onNameChange={setName}
      onDescriptionChange={setDescription}
      onCategoryChange={setCategory}
      onIconChange={setIcon}
      onPromptChange={setPrompt}
      onInputHintChange={setInputHint}
      onOutputFormatChange={setOutputFormat}
      onSchemaTextChange={setSchemaText}
      onExampleTextChange={setExampleText}
      onModelPreferenceChange={setModelPreference}
      onGeneratingChange={setIsGeneratingSchema}
      onDelete={() => void handleDelete()}
      onSave={() => void handleSave()}
      onSchemaError={(message) => toast.error(message)}
    />
  );
}
