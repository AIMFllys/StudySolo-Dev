import { ArrowLeft, Trash2 } from 'lucide-react';
import { SchemaEditor } from '@/features/community-nodes/components/SchemaEditor';
import {
  COMMUNITY_NODE_CATEGORIES,
  COMMUNITY_NODE_ICON_OPTIONS,
} from '@/features/community-nodes/constants/catalog';
import { formatFileSize } from '@/features/knowledge/utils';
import type { CommunityNodeMine, CommunityNodeOutputFormat } from '@/types';

type CommunityNodeManageEditorProps = {
  node: CommunityNodeMine;
  name: string;
  description: string;
  category: string;
  icon: string;
  prompt: string;
  inputHint: string;
  outputFormat: CommunityNodeOutputFormat;
  schemaText: string;
  exampleText: string;
  modelPreference: string;
  isGeneratingSchema: boolean;
  saving: boolean;
  deleting: boolean;
  onBack: () => void;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onIconChange: (value: string) => void;
  onPromptChange: (value: string) => void;
  onInputHintChange: (value: string) => void;
  onOutputFormatChange: (value: CommunityNodeOutputFormat) => void;
  onSchemaTextChange: (value: string) => void;
  onExampleTextChange: (value: string) => void;
  onModelPreferenceChange: (value: string) => void;
  onGeneratingChange: (value: boolean) => void;
  onDelete: () => void;
  onSave: () => void;
  onSchemaError: (message: string) => void;
};

export function CommunityNodeManageEditor(props: CommunityNodeManageEditorProps) {
  const {
    node,
    name,
    description,
    category,
    icon,
    prompt,
    inputHint,
    outputFormat,
    schemaText,
    exampleText,
    modelPreference,
    isGeneratingSchema,
    saving,
    deleting,
    onBack,
    onNameChange,
    onDescriptionChange,
    onCategoryChange,
    onIconChange,
    onPromptChange,
    onInputHintChange,
    onOutputFormatChange,
    onSchemaTextChange,
    onExampleTextChange,
    onModelPreferenceChange,
    onGeneratingChange,
    onDelete,
    onSave,
    onSchemaError,
  } = props;

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            返回工作台
          </button>
          <h1 className="text-2xl font-semibold text-foreground">管理共享节点</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            修改节点参数、Prompt 与输出约束，或删除共享。
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card px-4 py-3 text-right text-sm">
          <p className="font-medium text-foreground">{node.name}</p>
          <p className="mt-1 text-xs text-muted-foreground">状态：{node.status}</p>
        </div>
      </div>

      <div className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm">
            <span className="font-medium text-foreground">节点名称</span>
            <input
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/40"
            />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium text-foreground">分类</span>
            <select
              value={category}
              onChange={(event) => onCategoryChange(event.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/40"
            >
              {COMMUNITY_NODE_CATEGORIES.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="space-y-2 text-sm">
          <span className="font-medium text-foreground">描述</span>
          <textarea
            value={description}
            onChange={(event) => onDescriptionChange(event.target.value)}
            className="min-h-[96px] w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/40"
          />
        </label>

        <div className="grid gap-4 md:grid-cols-3">
          <label className="space-y-2 text-sm">
            <span className="font-medium text-foreground">图标</span>
            <select
              value={icon}
              onChange={(event) => onIconChange(event.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/40"
            >
              {COMMUNITY_NODE_ICON_OPTIONS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium text-foreground">输出格式</span>
            <select
              value={outputFormat}
              onChange={(event) => onOutputFormatChange(event.target.value as CommunityNodeOutputFormat)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/40"
            >
              <option value="markdown">Markdown</option>
              <option value="json">JSON</option>
            </select>
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium text-foreground">推荐模型</span>
            <select
              value={modelPreference}
              onChange={(event) => onModelPreferenceChange(event.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/40"
            >
              <option value="auto">自动</option>
              <option value="fast">快速</option>
              <option value="powerful">强力</option>
            </select>
          </label>
        </div>

        <label className="space-y-2 text-sm">
          <span className="font-medium text-foreground">System Prompt</span>
          <textarea
            value={prompt}
            onChange={(event) => onPromptChange(event.target.value)}
            className="min-h-[220px] w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm outline-none focus:border-primary/40"
          />
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium text-foreground">输入提示</span>
          <input
            value={inputHint}
            onChange={(event) => onInputHintChange(event.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/40"
          />
        </label>

        {node.knowledge_file_name ? (
          <div className="rounded-xl border border-border bg-muted/20 p-4 text-sm">
            <p className="font-medium text-foreground">已绑定知识文件</p>
            <p className="mt-1 text-muted-foreground">
              {node.knowledge_file_name} · {formatFileSize(node.knowledge_file_size)}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              当前版本支持保留与删除共享；如需替换知识文件，可在后续迭代补充。
            </p>
          </div>
        ) : null}

        {outputFormat === 'json' ? (
          <SchemaEditor
            name={name}
            description={description}
            prompt={prompt}
            schemaText={schemaText}
            exampleText={exampleText}
            isGenerating={isGeneratingSchema}
            onSchemaTextChange={onSchemaTextChange}
            onExampleTextChange={onExampleTextChange}
            onGeneratingChange={onGeneratingChange}
            onError={onSchemaError}
          />
        ) : null}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onDelete}
          disabled={deleting}
          className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Trash2 className="h-4 w-4" />
          {deleting ? '删除中...' : '删除共享'}
        </button>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="rounded-lg border border-border px-4 py-2 text-sm text-foreground transition-colors hover:bg-muted"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="rounded-lg border border-primary/30 bg-primary px-4 py-2 text-sm text-primary-foreground transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? '保存中...' : '保存修改'}
          </button>
        </div>
      </div>
    </div>
  );
}
