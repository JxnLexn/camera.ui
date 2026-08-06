import type { BoundingBox } from '@camera.ui/sdk';

const UNCONFIRMED_TTL_MS = 15_000;
const PERSON_HEAD_MARGIN = 0.06;
const PERSON_CROP_HEIGHT = 0.55;
const PERSON_MIN_ASPECT = 0.75;
const FACE_CROP_HEIGHT = 2.2;
const FACE_TOP_MARGIN = 0.25;
const FACE_MIN_WIDTH = 2;
const FACE_MIN_ASPECT = 0.4;

export interface BestShot {
  jpeg: Buffer;
  score: number;
  capturedAt: number;
  label: string;
  box: BoundingBox;
}

export function compositionBox(label: string, box: BoundingBox): BoundingBox {
  if (label === 'person') {
    const height = box.height * PERSON_CROP_HEIGHT;
    const width = Math.max(box.width * 1.4, height * PERSON_MIN_ASPECT);
    const centerX = box.x + box.width / 2;
    const top = box.y - box.height * PERSON_HEAD_MARGIN;
    return clamp({ x: centerX - width / 2, y: top, width, height });
  }
  const padX = box.width * 0.15;
  const padY = box.height * 0.15;
  return clamp({ x: box.x - padX, y: box.y - padY, width: box.width + padX * 2, height: box.height + padY * 2 });
}

export function faceCompositionBox(box: BoundingBox, minWidth = 0, minHeight = 0): BoundingBox {
  let height = box.height * FACE_CROP_HEIGHT;
  let width = Math.max(box.width * FACE_MIN_WIDTH, height * FACE_MIN_ASPECT);
  const centerX = box.x + box.width / 2;
  let top = box.y - box.height * FACE_TOP_MARGIN;
  if (height < minHeight) {
    const faceCenterY = box.y + box.height / 2;
    const anchorRatio = (faceCenterY - top) / height;
    height = minHeight;
    top = faceCenterY - anchorRatio * height;
  }
  if (width < minWidth) width = minWidth;
  return clamp({ x: centerX - width / 2, y: top, width, height });
}

function clamp(box: BoundingBox): BoundingBox {
  const x = Math.max(0, box.x);
  const y = Math.max(0, box.y);
  return {
    x,
    y,
    width: Math.min(box.width - (x - box.x), 1 - x),
    height: Math.min(box.height - (y - box.y), 1 - y),
  };
}

export class BestShotStore {
  private shots = new Map<number, BestShot>();
  private confirmed = new Set<number>();
  private touched = new Map<number, number>();

  public put(trackId: number, shot: BestShot): void {
    this.shots.set(trackId, shot);
    this.touched.set(trackId, shot.capturedAt);
  }

  public get(trackId: number): BestShot | undefined {
    return this.shots.get(trackId);
  }

  public bestOf(trackIds: Iterable<number>, label?: string): BestShot | undefined {
    let best: BestShot | undefined;
    for (const trackId of trackIds) {
      const shot = this.shots.get(trackId);
      if (!shot) continue;
      if (label !== undefined && shot.label !== label) continue;
      if (!best || shot.score > best.score) best = shot;
    }
    return best;
  }

  public confirm(trackId: number): void {
    this.confirmed.add(trackId);
  }

  public release(trackId: number): void {
    this.confirmed.delete(trackId);
    if (this.shots.has(trackId)) this.touched.set(trackId, Date.now());
  }

  public prune(now: number): void {
    for (const [trackId, shot] of this.shots) {
      if (this.confirmed.has(trackId)) continue;
      if (now - (this.touched.get(trackId) ?? shot.capturedAt) > UNCONFIRMED_TTL_MS) {
        this.shots.delete(trackId);
        this.touched.delete(trackId);
      }
    }
  }
}
