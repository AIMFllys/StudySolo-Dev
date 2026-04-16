import { describe, expect, it } from 'vitest';
import {
  buildExecutionRequestBody,
  getExecutionFailureMessage,
  shouldFinalizeExecutionAsInterrupted,
} from '@/features/workflow/utils/execution-state';
import {
  buildLoopGroupConfigPatch,
  buildMergedConfigPatch,
} from '@/features/workflow/components/node-config/config-patch';

describe('execution state closure helpers', () => {
  it('builds POST execution payload from in-memory graph', () => {
    const body = buildExecutionRequestBody(
      [{ id: 'n1' }] as never[],
      [{ id: 'e1' }] as never[],
    );

    expect(body).toEqual({
      nodes_json: [{ id: 'n1' }],
      edges_json: [{ id: 'e1' }],
    });
  });

  it('maps execution errors to stable user-facing messages', () => {
    expect(getExecutionFailureMessage(new Error('HTTP 403'))).toBe('启动执行失败：HTTP 403');
    expect(getExecutionFailureMessage(new Error('boom'))).toBe('执行流异常中断，请手动重新运行');
    expect(getExecutionFailureMessage('bad')).toBe('执行流异常中断，请手动重新运行');
  });

  it('marks interrupted execution only when stream did not complete and was not aborted', () => {
    expect(shouldFinalizeExecutionAsInterrupted(false, false, 30_000, 0)).toBe(true);
    expect(shouldFinalizeExecutionAsInterrupted(false, false, 9_000, 0)).toBe(false);
    expect(shouldFinalizeExecutionAsInterrupted(true, false, 30_000, 0)).toBe(false);
    expect(shouldFinalizeExecutionAsInterrupted(false, true, 30_000, 0)).toBe(false);
  });

  it('builds config patches for generic nodes and loop groups', () => {
    expect(buildMergedConfigPatch({ temperature: 0.7 }, { maxTokens: 2048 })).toEqual({
      temperature: 0.7,
      maxTokens: 2048,
    });
    expect(buildMergedConfigPatch({ temperature: 0.7 }, { maxTokens: 2048 }, true)).toEqual({
      maxTokens: 2048,
    });
    expect(buildLoopGroupConfigPatch({
      maxIterations: 5,
      intervalSeconds: 2,
      description: '批处理',
      ignored: true,
    })).toEqual({
      maxIterations: 5,
      intervalSeconds: 2,
      description: '批处理',
    });
  });
});
