import {
  AV_PIX_FMT_NV12,
  AV_PIX_FMT_YUV420P,
  AV_PIX_FMT_YUV422P,
  AV_PIX_FMT_YUV444P,
  AV_PIX_FMT_YUVJ420P,
  AV_PIX_FMT_YUVJ422P,
  AV_PIX_FMT_YUVJ444P,
} from 'node-av/constants';

import type { Logger } from '@camera.ui/common/logger';
import type { CameraZones, PrivacyFallback } from '@camera.ui/sdk';
import type { Frame } from 'node-av/lib';

type Span = [number, number, number];

export interface Region {
  x: number;
  y: number;
  width: number;
  height: number;
}

const BLACK_LUMA = 16;
const NEUTRAL_CHROMA = 128;

// pixel format → [chroma shift x, chroma shift y]
const PLANAR_CHROMA_SHIFT = new Map<number, [number, number]>([
  [AV_PIX_FMT_YUV420P, [1, 1]],
  [AV_PIX_FMT_YUVJ420P, [1, 1]],
  [AV_PIX_FMT_YUV422P, [1, 0]],
  [AV_PIX_FMT_YUVJ422P, [1, 0]],
  [AV_PIX_FMT_YUV444P, [0, 0]],
  [AV_PIX_FMT_YUVJ444P, [0, 0]],
]);

export class PrivacyMask {
  private zones: CameraZones['privacy'] = [];
  private spans = new Map<string, Span[]>();
  private signature = '';
  private version = 0;
  private fallback: PrivacyFallback = 'send';
  private warned = false;

  constructor(
    private logger?: Logger,
    private subject = 'pictures',
  ) {}

  public get active(): boolean {
    return this.zones.length > 0;
  }

  public get revision(): number {
    return this.version;
  }

  public update(zones: CameraZones | undefined): void {
    const privacy = zones?.privacy ?? [];
    const signature = JSON.stringify(privacy);

    this.fallback = zones?.privacyFallback ?? 'send';
    if (signature === this.signature) return;

    this.signature = signature;
    this.version++;
    this.zones = privacy.filter((zone) => zone.points.length >= 3);
    this.spans.clear();
  }

  public reportFailure(): PrivacyFallback {
    if (!this.warned) {
      this.warned = true;
      const outcome = this.fallback === 'drop' ? 'they are dropped' : 'they ship unmasked';
      this.logger?.warn(`Privacy zones could not be applied to this camera's ${this.subject}, ${outcome}`);
    }

    return this.fallback;
  }

  public covers(region: Region, width: number, height: number): boolean {
    if (!this.active) return false;

    const spans = this.spansFor(width, height);
    if (spans.length === 0) return false;

    const left = Math.max(0, region.x);
    const right = Math.min(width - 1, region.x + region.width - 1);
    const top = Math.max(0, region.y);
    const bottom = Math.min(height - 1, region.y + region.height - 1);
    if (right < left || bottom < top) return false;

    const rows = new Map<number, [number, number][]>();
    for (const [row, start, end] of spans) {
      if (row < top || row > bottom || end < left || start > right) continue;
      const list = rows.get(row) ?? [];
      list.push([Math.max(start, left), Math.min(end, right)]);
      rows.set(row, list);
    }

    if (rows.size < bottom - top + 1) return false;

    for (const list of rows.values()) {
      list.sort((a, b) => a[0] - b[0]);
      let reached = left;
      for (const [start, end] of list) {
        if (start > reached) return false;
        reached = Math.max(reached, end + 1);
      }
      if (reached <= right) return false;
    }

    return true;
  }

  public apply(frame: Frame): boolean {
    if (!this.active) return true;
    if (frame.isHwFrame()) return false;

    const planes = frame.data;
    if (!planes || planes.length === 0) return false;

    const { width, height, format, linesize } = frame;
    if (width < 2 || height < 2) return false;

    const spans = this.spansFor(width, height);
    if (spans.length === 0) return true;

    const shift = PLANAR_CHROMA_SHIFT.get(format);
    if (shift) {
      const [shiftX, shiftY] = shift;
      const [y, u, v] = planes;
      if (!y || !u || !v) return false;
      for (const [row, start, end] of spans) {
        y.fill(BLACK_LUMA, row * linesize[0] + start, row * linesize[0] + end + 1);
        if (shiftY === 1 && row % 2 !== 0) continue;
        const cRow = row >> shiftY;
        const cStart = start >> shiftX;
        const cEnd = end >> shiftX;
        u.fill(NEUTRAL_CHROMA, cRow * linesize[1] + cStart, cRow * linesize[1] + cEnd + 1);
        v.fill(NEUTRAL_CHROMA, cRow * linesize[2] + cStart, cRow * linesize[2] + cEnd + 1);
      }
      return true;
    }

    if (format === AV_PIX_FMT_NV12) {
      const [y, uv] = planes;
      if (!y || !uv) return false;
      for (const [row, start, end] of spans) {
        y.fill(BLACK_LUMA, row * linesize[0] + start, row * linesize[0] + end + 1);
        if (row % 2 === 0) {
          // interleaved chroma: two bytes per sample pair
          const cRow = row >> 1;
          const cStart = (start >> 1) * 2;
          const cEnd = (end >> 1) * 2 + 1;
          uv.fill(NEUTRAL_CHROMA, cRow * linesize[1] + cStart, cRow * linesize[1] + cEnd + 1);
        }
      }
      return true;
    }

    return false;
  }

  private spansFor(width: number, height: number): Span[] {
    const key = `${width}x${height}`;
    const cached = this.spans.get(key);
    if (cached) return cached;

    const spans: Span[] = [];
    for (const zone of this.zones) {
      const points = zone.points.map(([x, y]) => [(x / 100) * width, (y / 100) * height] as [number, number]);
      spans.push(...polygonSpans(points, width, height));
    }

    this.spans.set(key, spans);
    return spans;
  }
}

function polygonSpans(points: [number, number][], width: number, height: number): Span[] {
  const spans: Span[] = [];
  let minY = height;
  let maxY = 0;
  for (const [, y] of points) {
    minY = Math.min(minY, Math.floor(y));
    maxY = Math.max(maxY, Math.ceil(y));
  }
  minY = Math.max(0, minY);
  maxY = Math.min(height - 1, maxY);

  const crossings: number[] = [];
  for (let row = minY; row <= maxY; row++) {
    const center = row + 0.5;
    crossings.length = 0;

    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const [xi, yi] = points[i];
      const [xj, yj] = points[j];
      if (yi === yj) continue;
      if (center < Math.min(yi, yj) || center >= Math.max(yi, yj)) continue;
      crossings.push(xi + ((center - yi) / (yj - yi)) * (xj - xi));
    }
    if (crossings.length < 2) continue;

    crossings.sort((a, b) => a - b);
    for (let i = 0; i + 1 < crossings.length; i += 2) {
      // a pixel counts as covered when its center lies inside the polygon
      const start = Math.max(0, Math.ceil(crossings[i] - 0.5));
      const end = Math.min(width - 1, Math.ceil(crossings[i + 1] - 0.5) - 1);
      if (end >= start) spans.push([row, start, end]);
    }
  }

  return spans;
}
