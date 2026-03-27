export function buildMergedConfigPatch(
  baseConfig: Record<string, unknown>,
  patch: Record<string, unknown>,
  replace = false,
) {
  return {
    ...(replace ? {} : baseConfig),
    ...patch,
  };
}

export function buildLoopGroupConfigPatch(patch: Record<string, unknown>) {
  return {
    maxIterations: patch.maxIterations,
    intervalSeconds: patch.intervalSeconds,
    description: patch.description,
  };
}
