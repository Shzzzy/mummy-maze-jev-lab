export function createMetrics() {
  return {
    decisions: [],
    levels: [],
    sessionStartedAt: new Date().toISOString(),
  };
}

export function recordDecision(metrics, decision) {
  metrics.decisions.push({
    ...structuredClone(decision),
    recordedAt: new Date().toISOString(),
  });
}

export function recordLevelResult(metrics, result) {
  metrics.levels.push({
    ...structuredClone(result),
    recordedAt: new Date().toISOString(),
  });
}

function usageTokens(usage) {
  return Number(usage?.input_tokens || usage?.prompt_tokens || 0)
    + Number(usage?.output_tokens || usage?.completion_tokens || 0);
}

export function summarizeMetrics(metrics) {
  const count = metrics.decisions.length;
  const totalConfidence = metrics.decisions.reduce(
    (sum, item) => sum + Number(item.confidence || 0),
    0,
  );
  const totalLatency = metrics.decisions.reduce(
    (sum, item) => sum + Number(item.latencyMs || 0),
    0,
  );
  const totalTokens = metrics.decisions.reduce(
    (sum, item) => sum
      + usageTokens(item.analysisUsage)
      + usageTokens(item.scoringUsage)
      + usageTokens(item.usage),
    0,
  );

  return {
    decisionCount: count,
    averageConfidence: count ? totalConfidence / count : null,
    averageLatencyMs: count ? Math.round(totalLatency / count) : null,
    totalTokens,
  };
}

export function createExport(metrics) {
  return {
    model: 'jev-latest',
    exportedAt: new Date().toISOString(),
    sessionStartedAt: metrics.sessionStartedAt,
    summary: summarizeMetrics(metrics),
    decisions: structuredClone(metrics.decisions),
    levels: structuredClone(metrics.levels),
  };
}
