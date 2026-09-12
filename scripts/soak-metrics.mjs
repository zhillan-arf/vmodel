// Numerical summaries for a fixed-duration fixture soak; no device or OBS access.
export function distribution(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return { count: 0, min: null, p50: null, p95: null, p99: null, max: null, mean: null };
  const percentile = p => sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)];
  return { count: sorted.length, min: sorted[0], p50: percentile(.5), p95: percentile(.95), p99: percentile(.99), max: sorted.at(-1), mean: sorted.reduce((sum, n) => sum + n, 0) / sorted.length };
}

export function counterDifference(first, last, key) {
  const a = first?.[key], b = last?.[key];
  return Number.isFinite(a) && Number.isFinite(b) && b >= a ? b - a : null;
}

export function memoryTrend(samples, key) {
  const points = samples.map(sample => [sample.atMs / 60000, sample.memory?.[key]]).filter(point => point.every(Number.isFinite));
  if (points.length < 2) return { count: points.length, slopeMiBPerMinute: null, firstMedianMiB: null, lastMedianMiB: null, changeMiB: null };
  const meanX = points.reduce((sum, point) => sum + point[0], 0) / points.length;
  const meanY = points.reduce((sum, point) => sum + point[1], 0) / points.length;
  const denominator = points.reduce((sum, point) => sum + (point[0] - meanX) ** 2, 0);
  const slope = denominator ? points.reduce((sum, point) => sum + (point[0] - meanX) * (point[1] - meanY), 0) / denominator : null;
  const start = points[0][0], end = points.at(-1)[0], span = (end - start) / 3;
  const first = distribution(points.filter(point => point[0] <= start + span).map(point => point[1])).p50;
  const last = distribution(points.filter(point => point[0] >= end - span).map(point => point[1])).p50;
  return { count: points.length, slopeMiBPerMinute: slope, firstMedianMiB: first, lastMedianMiB: last, changeMiB: last - first,
    interpretation: 'Observed process/heap trend without forced GC; not proof of a leak or thermal behavior.' };
}

function performanceWindow(renders, inferences, start, end) {
  const draw = renders.filter(sample => sample.atMs >= start && sample.atMs < end);
  const infer = inferences.filter(sample => sample.atMs >= start && sample.atMs < end);
  const intervals = distribution(draw.map(sample => sample.intervalMs));
  return { durationMs: end - start, renderFrameIntervalMs: intervals,
    renderDrawCpuWallMs: distribution(draw.map(sample => sample.drawMs)),
    medianCadenceFps: intervals.p50 > 0 ? 1000 / intervals.p50 : null,
    observedRenderHz: draw.length * 1000 / (end - start), observedInferenceHz: infer.length * 1000 / (end - start),
    inferenceMs: distribution(infer.map(sample => sample.inferenceMs)),
    fullTaskInferenceMs: distribution(infer.filter(sample => sample.allEnabledTasksFresh).map(sample => sample.inferenceMs)),
    taskMs: Object.fromEntries(['face', 'pose', 'hands'].map(task => [task, distribution(infer.filter(sample => sample.fresh[task] && sample.taskMs[task] > 0).map(sample => sample.taskMs[task]))])),
    positiveFreshResults: Object.fromEntries(['face', 'pose', 'hands'].map(task => [task, infer.filter(sample => sample.fresh[task] && sample.present[task]).length])),
    simultaneousFacePoseHands: infer.filter(sample => ['face', 'pose', 'hands'].every(task => sample.present[task])).length,
    feetVisiblePoseResults: infer.filter(sample => sample.fresh.pose && sample.feetVisible).length };
}

export function summarizePhase({ renders, inferences, samples, durationMs }) {
  const all = performanceWindow(renders, inferences, 0, durationMs);
  const first = performanceWindow(renders, inferences, 0, durationMs / 3);
  const last = performanceWindow(renders, inferences, durationMs * 2 / 3, durationMs);
  const initial = samples[0]?.obs, final = samples.at(-1)?.obs;
  const counters = Object.fromEntries(['renderSkippedFrames', 'renderTotalFrames', 'outputSkippedFrames', 'outputTotalFrames'].map(key => [key, counterDifference(initial, final, key)]));
  // OBS may reset during a session and later exceed its original count. Checking
  // only the endpoints would silently accept that incomplete measurement.
  const countersMonotonic = samples.length >= 2 && samples.slice(1).every((sample, index) => Object.keys(counters).every(key => counterDifference(samples[index].obs, sample.obs, key) !== null));
  const ratio = (later, earlier) => Number.isFinite(later) && earlier > 0 ? later / earlier : null;
  return { ...all, firstFiveMinutes: first, lastFiveMinutes: last,
    lastVersusFirst: { renderIntervalP95Ratio: ratio(last.renderFrameIntervalMs.p95, first.renderFrameIntervalMs.p95),
      inferenceP95Ratio: ratio(last.inferenceMs.p95, first.inferenceMs.p95),
      fullTaskInferenceP95Ratio: ratio(last.fullTaskInferenceMs.p95, first.fullTaskInferenceMs.p95),
      renderRateRatio: ratio(last.observedRenderHz, first.observedRenderHz), inferenceRateRatio: ratio(last.observedInferenceHz, first.observedInferenceHz),
      interpretation: 'Same-preset time comparison; clocks, temperatures and end-to-end latency are not measured.' },
    obs: { counters, countersValid: countersMonotonic && Object.values(counters).every(value => value !== null),
      renderSkipFraction: countersMonotonic && counters.renderTotalFrames > 0 && counters.renderSkippedFrames !== null ? counters.renderSkippedFrames / counters.renderTotalFrames : null,
      encodeSkipFraction: countersMonotonic && counters.outputTotalFrames > 0 && counters.outputSkippedFrames !== null ? counters.outputSkippedFrames / counters.outputTotalFrames : null,
      sampledRenderMs: distribution(samples.map(sample => sample.obs?.averageFrameRenderTime)), sampledActiveFps: distribution(samples.map(sample => sample.obs?.activeFps)) },
    memory: Object.fromEntries(['chromePrivateMiB', 'chromeWorkingSetMiB', 'jsHeapUsedMiB', 'obsPrivateMiB', 'obsWorkingSetMiB'].map(key => [key, memoryTrend(samples, key)])),
    proposedRenderGatePassed: all.medianCadenceFps >= 30 && all.renderFrameIntervalMs.p95 <= 50,
    taskAcceptance: false };
}

export function withinOwnedDirectory(root, candidate, path) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative !== '' && relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
}
