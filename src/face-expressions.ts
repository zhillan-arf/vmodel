export const faceChannels = [
  'eyeBlinkLeft', 'eyeBlinkRight', 'jawOpen', 'mouthSmileLeft', 'mouthSmileRight',
  'mouthFunnel', 'mouthPucker', 'mouthStretchLeft', 'mouthStretchRight', 'mouthClose',
  'mouthFrownLeft', 'mouthFrownRight', 'browInnerUp', 'browOuterUpLeft', 'browOuterUpRight',
  'browDownLeft', 'browDownRight', 'eyeWideLeft', 'eyeWideRight',
] as const;

export const faceExpressions = [
  'blinkLeft', 'blinkRight', 'aa', 'ih', 'ou', 'ee', 'oh', 'happy', 'surprised',
  'vmodelBrowUpLeft', 'vmodelBrowUpRight', 'vmodelBrowDownLeft', 'vmodelBrowDownRight',
  'vmodelBrowWorry', 'vmodelMouthSmile', 'vmodelMouthFrown', 'vmodelEyeWideLeft', 'vmodelEyeWideRight',
] as const;

const unit = (value: number | undefined) => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;

export function hasFaceBinding(expression: unknown): boolean {
  if (!expression) return false;
  const binds = (expression as { binds?: readonly unknown[] }).binds;
  return !Array.isArray(binds) || binds.length > 0;
}

export function captureFaceNeutral(face: Record<string, number>): Record<string, number> {
  return Object.fromEntries(faceChannels.filter(name => Number.isFinite(face[name])).map(name =>
    [name, Math.min(name.startsWith('eyeBlink') ? .3 : .8, unit(face[name]))]));
}

export function relativeFaceValue(value: number, neutral = 0): number {
  const base = Math.min(.8, unit(neutral));
  return unit((unit(value) - base) / (1 - base));
}

export function solveFaceExpressions(face: Record<string, number>, mouthGain: number, extended: boolean,
  available: (name: string) => boolean): Record<string, number> {
  const c = (name: string) => unit(face[name]);
  const blinkLeft = c('eyeBlinkLeft'), blinkRight = c('eyeBlinkRight');
  const jaw = unit(c('jawOpen') * mouthGain);
  const smile = Math.min(c('mouthSmileLeft'), c('mouthSmileRight'));
  if (!extended) return { blinkLeft, blinkRight, aa: jaw, happy: smile * .55 };

  const result: Record<string, number> = { blinkLeft, blinkRight };
  const pucker = c('mouthPucker'), funnel = c('mouthFunnel');
  const stretch = Math.min(c('mouthStretchLeft'), c('mouthStretchRight'));
  const opening = jaw * (1 - c('mouthClose'));
  const budget = Math.max(opening, pucker * .45);
  const weights: Record<string, number> = {
    aa: opening * (1 - Math.max(pucker, funnel)) * (1 - stretch),
    ou: Math.max(opening * pucker, pucker * .45), oh: opening * funnel,
    ih: opening * stretch * .5, ee: opening * stretch * .5,
  };
  const total = Object.values(weights).reduce((sum, value) => sum + value, 0);
  for (const [name, weight] of Object.entries(weights)) {
    const target = available(name) ? name : 'aa';
    result[target] = (result[target] ?? 0) + (total > 0 ? weight * budget / total : 0);
  }
  const smileName = available('vmodelMouthSmile') ? 'vmodelMouthSmile' : 'happy';
  result[smileName] = smile * .55 * (1 - budget);
  result.vmodelMouthFrown = Math.min(c('mouthFrownLeft'), c('mouthFrownRight')) * .65 * (1 - budget) * (1 - smile);
  const worry = c('browInnerUp') * .5;
  const brows: Record<string, number> = { vmodelBrowWorry: worry };
  for (const side of ['Left', 'Right']) {
    brows[`vmodelBrowUp${side}`] = c(`browOuterUp${side}`) * .7;
    brows[`vmodelBrowDown${side}`] = c(`browDown${side}`) * .7;
    const blink = side === 'Left' ? blinkLeft : blinkRight;
    result[`vmodelEyeWide${side}`] = c(`eyeWide${side}`) * .65 * (1 - blink);
  }
  const browTotal = Math.max(1,
    worry + brows.vmodelBrowUpLeft + brows.vmodelBrowDownLeft,
    worry + brows.vmodelBrowUpRight + brows.vmodelBrowDownRight);
  for (const [name, value] of Object.entries(brows)) result[name] = value / browTotal;
  return result;
}
