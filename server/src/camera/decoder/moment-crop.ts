import type { BoundingBox } from '@camera.ui/sdk';

export type MomentFormatName = 'card' | 'strip';

export interface MomentFormat {
  name: MomentFormatName;
  width: number;
  height: number;
}

export interface CropWindow {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Direction {
  x: number;
  y: number;
}

export interface MomentTarget {
  subject: BoundingBox;
  base?: BoundingBox;
  hint?: Direction;
}

export const MOMENT_FORMATS: readonly MomentFormat[] = [
  { name: 'card', width: 640, height: 640 },
  { name: 'strip', width: 640, height: 360 },
];

export const MOMENT_QUALITY = 82;

const PADDING = 1.15;
const PROMINENCE = 0.3;
const MAX_UPSCALE = 2;
const ANCHOR_SHIFT = 0.1;

export const FULL_FRAME: BoundingBox = { x: 0, y: 0, width: 1, height: 1 };

export function momentFormat(name: MomentFormatName): MomentFormat {
  return MOMENT_FORMATS.find((f) => f.name === name)!;
}

export function unionBox(boxes: readonly BoundingBox[]): BoundingBox | undefined {
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;

  for (const box of boxes) {
    left = Math.min(left, box.x);
    top = Math.min(top, box.y);
    right = Math.max(right, box.x + box.width);
    bottom = Math.max(bottom, box.y + box.height);
  }

  if (!Number.isFinite(left)) return undefined;
  return { x: left, y: top, width: right - left, height: bottom - top };
}

export function directionBetween(from: BoundingBox, to: BoundingBox): Direction | undefined {
  return normalize(to.x + to.width / 2 - (from.x + from.width / 2), to.y + to.height / 2 - (from.y + from.height / 2));
}

export function directionOf(velocityX: number, velocityY: number): Direction | undefined {
  return normalize(velocityX, velocityY);
}

export function momentWindow(target: MomentTarget, frameWidth: number, frameHeight: number, format: MomentFormat): CropWindow | null {
  const aspect = format.width / format.height;
  const subject = toPixels(target.subject, frameWidth, frameHeight);
  const base = toPixels(target.base ?? target.subject, frameWidth, frameHeight);

  const contain = span(base, aspect) * PADDING;
  let width = Math.max(contain, format.width);

  const prominenceLimit = span(subject, aspect) / PROMINENCE;
  if (width > prominenceLimit) {
    width = Math.max(prominenceLimit, format.width / MAX_UPSCALE, contain);
  }

  let height = width / aspect;
  if (width > frameWidth) {
    width = frameWidth;
    height = width / aspect;
  }
  if (height > frameHeight) {
    height = frameHeight;
    width = height * aspect;
  }

  width = even(width);
  height = even(height);
  if (width < 2 || height < 2) return null;

  const hint = target.hint;
  const centerX = subject.x + subject.width / 2 + (hint ? hint.x * width * ANCHOR_SHIFT : 0);
  const centerY = subject.y + subject.height / 2 + (hint ? hint.y * height * ANCHOR_SHIFT : 0);

  return {
    x: clamp(Math.round(centerX - width / 2), 0, frameWidth - width),
    y: clamp(Math.round(centerY - height / 2), 0, frameHeight - height),
    width,
    height,
  };
}

function toPixels(box: BoundingBox, frameWidth: number, frameHeight: number): CropWindow {
  return { x: box.x * frameWidth, y: box.y * frameHeight, width: box.width * frameWidth, height: box.height * frameHeight };
}

function span(rect: CropWindow, aspect: number): number {
  return Math.max(rect.width, rect.height * aspect);
}

function normalize(x: number, y: number): Direction | undefined {
  const length = Math.hypot(x, y);
  if (length < 1e-6) return undefined;
  return { x: x / length, y: y / length };
}

function even(value: number): number {
  return Math.max(0, Math.round(value)) & ~1;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
