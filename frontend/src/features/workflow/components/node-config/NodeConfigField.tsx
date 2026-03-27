'use client';

import type { NodeConfigFieldSchema } from '@/types';

interface NodeConfigFieldProps {
  field: NodeConfigFieldSchema;
  value: unknown;
  onChange: (value: unknown) => void;
}

const commonClassName =
  'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary/40';

function MultiSelectField({
  field,
  value,
  onChange,
}: NodeConfigFieldProps) {
  const selected: string[] = Array.isArray(value) ? (value as string[]) : [];
  const options = field.options ?? [];

  function toggle(optionValue: string) {
    if (selected.includes(optionValue)) {
      onChange(selected.filter((v) => v !== optionValue));
    } else {
      onChange([...selected, optionValue]);
    }
  }

  if (options.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">
        {field.dynamic_options ? '（选项将根据您的数据动态加载）' : '暂无可选项'}
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const isSelected = selected.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => toggle(option.value)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              isSelected
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function NodeConfigField({ field, value, onChange }: NodeConfigFieldProps) {
  return (
    <label className="block space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-foreground">{field.label}</span>
        {field.description ? (
          <span className="text-[11px] text-muted-foreground">{field.description}</span>
        ) : null}
      </div>

      {field.type === 'textarea' ? (
        <textarea
          value={String(value ?? '')}
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.placeholder}
          className={`${commonClassName} min-h-24 resize-y`}
        />
      ) : null}

      {field.type === 'text' ? (
        <input
          type="text"
          value={String(value ?? '')}
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.placeholder}
          className={commonClassName}
        />
      ) : null}

      {field.type === 'number' ? (
        <input
          type="number"
          value={typeof value === 'number' ? value : Number(value ?? field.default ?? 0)}
          onChange={(event) => onChange(Number(event.target.value))}
          min={field.min}
          max={field.max}
          step={field.step ?? 1}
          className={commonClassName}
        />
      ) : null}

      {field.type === 'select' ? (
        <select
          value={String(value ?? field.default ?? '')}
          onChange={(event) => onChange(event.target.value)}
          className={commonClassName}
        >
          {(field.options ?? []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : null}

      {field.type === 'boolean' ? (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
          <input
            id={`cfg-${field.key}`}
            type="checkbox"
            checked={Boolean(value)}
            onChange={(event) => onChange(event.target.checked)}
          />
          <span className="text-sm text-foreground">启用</span>
        </div>
      ) : null}

      {field.type === 'multi_select' ? (
        <MultiSelectField field={field} value={value} onChange={onChange} />
      ) : null}
    </label>
  );
}
