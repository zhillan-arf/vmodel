import type { IncomingMessage, ServerResponse } from 'node:http';
export interface OutputLayout {
  id: string; title: string; kind: 'output' | 'clean'; orientation: 'landscape' | 'portrait';
  viewport: { width: number; height: number }; canvas: { left: number; top: number; width: number; height: number }; observedAt: number;
}
export function createOutputLayoutHandler(port: number, options?: { now?: () => number; ttl?: number; origins?: string[] }): (req: IncomingMessage, res: ServerResponse) => Promise<boolean>;
export function captureCrop(width: number, height: number, layout: OutputLayout): { cropLeft: number; cropRight: number; cropTop: number; cropBottom: number };
