import type { NodeConfigFieldSchema, NodeConfigFieldSchemaOption } from '@/types';
import { authedFetch } from '@/services/api-client';

export function buildDefaultConfig(schema: NodeConfigFieldSchema[]) {
  return Object.fromEntries(
    schema
      .filter((field) => field.default !== undefined)
      .map((field) => [field.key, field.default]),
  );
}

export async function fetchDynamicOptions(
  nodeType: string,
  fieldKey: string,
): Promise<NodeConfigFieldSchemaOption[]> {
  try {
    const res = await authedFetch(`/api/nodes/config-options/${nodeType}/${fieldKey}`);
    if (!res.ok) return [];
    const data = (await res.json()) as { options: NodeConfigFieldSchemaOption[] };
    return data.options ?? [];
  } catch {
    return [];
  }
}
