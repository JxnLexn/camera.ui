import { ImageProcessor } from '@camera.ui/rust-detector';

import type { BoundingBox } from '@camera.ui/sdk';

export interface GrayFrame {
  data: Buffer;
  width: number;
  height: number;
}

const THRESHOLD = 25;
const BLUR_RADIUS = 13;
const DILATE_SIZE = 5;
const MIN_CLUSTER_AREA = 250;
const REFERENCE_REFRESH_MS = 10_000;

export class MotionLocalizer {
  private processor?: ImageProcessor;
  private width = 0;
  private height = 0;
  private referenceAt = 0;

  public localize(gray: GrayFrame): BoundingBox[] {
    const processor = this.ensureProcessor(gray.width, gray.height);

    const now = Date.now();
    const updateReference = now - this.referenceAt >= REFERENCE_REFRESH_MS;
    if (updateReference) this.referenceAt = now;

    const boxes = processor.processImage(
      new Uint8Array(gray.data.buffer, gray.data.byteOffset, gray.data.byteLength),
      THRESHOLD,
      BLUR_RADIUS,
      DILATE_SIZE,
      MIN_CLUSTER_AREA,
      updateReference,
    );

    return boxes.map(([x1, y1, x2, y2]) => ({
      x: x1 / gray.width,
      y: y1 / gray.height,
      width: (x2 - x1) / gray.width,
      height: (y2 - y1) / gray.height,
    }));
  }

  public seedReference(gray: GrayFrame): void {
    const processor = this.ensureProcessor(gray.width, gray.height);

    processor.resetState();
    processor.processImage(new Uint8Array(gray.data.buffer, gray.data.byteOffset, gray.data.byteLength), THRESHOLD, BLUR_RADIUS, DILATE_SIZE, MIN_CLUSTER_AREA, true);
    this.referenceAt = Date.now();
  }

  public reset(): void {
    this.processor?.resetState();
    this.referenceAt = 0;
  }

  private ensureProcessor(width: number, height: number): ImageProcessor {
    if (!this.processor) {
      this.processor = new ImageProcessor(width, height);
    } else if (this.width !== width || this.height !== height) {
      this.processor.reconfigure(width, height);
      this.referenceAt = 0;
    }

    this.width = width;
    this.height = height;
    return this.processor;
  }
}
