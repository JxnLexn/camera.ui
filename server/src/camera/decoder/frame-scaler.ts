import { Scaler } from 'node-av/api';

import type { Logger } from '@camera.ui/common/logger';
import type { Detection, VideoFrameData, VideoInputSpec } from '@camera.ui/sdk';
import type { HardwareContext, ScalerCrop } from 'node-av/api';
import type { Frame } from 'node-av/lib';
import type { CroppedRegion } from '../../rpc/interfaces/detection.js';

type ScaledFormat = 'rgb' | 'nv12' | 'gray';

export interface JpegCrop {
  index: number;
  jpeg: Buffer;
}

export type CropFit = 'stretch' | 'expand';

export interface ConsumerSpec {
  key: string;
  triggerLabels: string[];
  input: VideoInputSpec;
  fit: CropFit;
}

export interface ScaleTarget {
  key: string;
  width: number;
  height: number;
  format: ScaledFormat;
  fit?: CropFit;
}

export interface ScaledFrame {
  data: Buffer;
  width: number;
  height: number;
  format: ScaledFormat;
}

export interface LetterboxGeometry {
  padX: number;
  padY: number;
  innerWidth: number;
  innerHeight: number;
  targetWidth: number;
  targetHeight: number;
}

export interface LetterboxedFrame {
  padded: ScaledFrame;
  inner: ScaledFrame;
  geometry: LetterboxGeometry;
}

const LETTERBOX_FILL = 114;

export class FrameScaler {
  private readonly MIN_THUMBNAIL_CROP = 64;

  private scaler?: Scaler;

  constructor(
    private hardwareContext?: HardwareContext | null,
    private logger?: Logger,
  ) {}

  public async scale(frame: Frame, targetWidth: number, targetHeight: number, format: ScaledFormat = 'rgb'): Promise<ScaledFrame | null> {
    if (targetWidth < 2 || targetHeight < 2) return null;
    const data = await this.getScaler().toBuffer(frame, { resize: { width: targetWidth, height: targetHeight }, format });
    return { data, width: targetWidth, height: targetHeight, format };
  }

  public async scaleToSpec(frame: Frame, spec: VideoInputSpec): Promise<ScaledFrame | null> {
    return this.scale(frame, spec.width, spec.height, spec.format);
  }

  public async letterboxToSpec(frame: Frame, spec: VideoInputSpec): Promise<LetterboxedFrame | null> {
    // nv12 is semi-planar, padding it row by row would tear the chroma plane apart
    if (spec.format === 'nv12') {
      const stretched = await this.scaleToSpec(frame, spec);
      return stretched ? { padded: stretched, inner: stretched, geometry: this.identityGeometry(spec) } : null;
    }

    const ratio = Math.min(spec.width / frame.width, spec.height / frame.height);
    const innerWidth = Math.max(2, Math.round((frame.width * ratio) / 2) * 2);
    const innerHeight = Math.max(2, Math.round((frame.height * ratio) / 2) * 2);

    const inner = await this.scale(frame, Math.min(innerWidth, spec.width), Math.min(innerHeight, spec.height), spec.format);
    if (!inner) return null;

    const geometry: LetterboxGeometry = {
      padX: Math.floor((spec.width - inner.width) / 2),
      padY: Math.floor((spec.height - inner.height) / 2),
      innerWidth: inner.width,
      innerHeight: inner.height,
      targetWidth: spec.width,
      targetHeight: spec.height,
    };

    if (geometry.padX === 0 && geometry.padY === 0 && inner.width === spec.width && inner.height === spec.height) {
      return { padded: inner, inner, geometry };
    }

    const channels = spec.format === 'gray' ? 1 : 3;
    const data = Buffer.alloc(spec.width * spec.height * channels, LETTERBOX_FILL);
    const rowBytes = inner.width * channels;

    for (let y = 0; y < inner.height; y++) {
      const target = ((geometry.padY + y) * spec.width + geometry.padX) * channels;
      inner.data.copy(data, target, y * rowBytes, (y + 1) * rowBytes);
    }

    return { padded: { data, width: spec.width, height: spec.height, format: spec.format }, inner, geometry };
  }

  public static undoLetterbox(detections: Detection[], geometry: LetterboxGeometry): Detection[] {
    if (geometry.padX === 0 && geometry.padY === 0 && geometry.innerWidth === geometry.targetWidth && geometry.innerHeight === geometry.targetHeight) {
      return detections;
    }

    const clamp = (value: number): number => Math.min(1, Math.max(0, value));

    return detections.map((detection) => {
      const x = clamp((detection.box.x * geometry.targetWidth - geometry.padX) / geometry.innerWidth);
      const y = clamp((detection.box.y * geometry.targetHeight - geometry.padY) / geometry.innerHeight);
      const width = clamp((detection.box.width * geometry.targetWidth) / geometry.innerWidth);
      const height = clamp((detection.box.height * geometry.targetHeight) / geometry.innerHeight);

      return { ...detection, box: { x, y, width: Math.min(width, 1 - x), height: Math.min(height, 1 - y) } };
    });
  }

  public async scaleProportional(frame: Frame, maxWidth: number, format: ScaledFormat = 'gray'): Promise<ScaledFrame | null> {
    const { width, height } = this.proportionalSize(frame.width, frame.height, maxWidth);
    return this.scale(frame, width, height, format);
  }

  public toVideoFrameData(scaled: ScaledFrame, id = 'scaled'): VideoFrameData {
    return {
      id,
      data: scaled.data,
      width: scaled.width,
      height: scaled.height,
      format: scaled.format,
    };
  }

  public async cropToJPEG(
    frame: Frame,
    detections: Detection[],
    options: { maxWidth?: number; quality?: number; padding?: number; minCrop?: number } = {},
  ): Promise<JpegCrop[]> {
    const { maxWidth = 320, quality = 90, padding = 0.15, minCrop = this.MIN_THUMBNAIL_CROP } = options;
    const results: JpegCrop[] = [];

    for (const [index, detection] of detections.entries()) {
      const crop = this.paddedCrop(detection.box, frame.width, frame.height, padding, minCrop);
      if (!crop) continue;

      const resize = this.scaledSize(crop.width, crop.height, maxWidth);
      try {
        const jpeg = await this.getScaler().toJpeg(frame, { crop, resize, quality });
        results.push({ index, jpeg });
      } catch (error) {
        this.logger?.debug(`Thumbnail crop failed for ${detection.label}: ${error}`);
      }
    }

    return results;
  }

  public async cropWindowToJPEG(frame: Frame, crop: ScalerCrop, width: number, height: number, quality: number): Promise<Buffer | null> {
    try {
      return await this.getScaler().toJpeg(frame, { crop, resize: { width, height }, quality });
    } catch (error) {
      this.logger?.debug(`Moment crop failed: ${error}`);
      return null;
    }
  }

  public async frameToJPEG(frame: Frame, maxWidth = 320, quality = 90): Promise<Buffer | null> {
    if (frame.width < 2 || frame.height < 2) return null;
    const resize = this.scaledSize(frame.width, frame.height, maxWidth);
    if (resize.width < 2 || resize.height < 2) return null;
    try {
      return await this.getScaler().toJpeg(frame, { resize, quality });
    } catch (error) {
      this.logger?.debug(`Full-frame JPEG failed: ${error}`);
      return null;
    }
  }

  public async cropAndScaleMulti(frame: Frame, detection: Detection, targets: ScaleTarget[], padding = 0.1): Promise<Map<string, CroppedRegion>> {
    const results = new Map<string, CroppedRegion>();
    if (targets.length === 0) return results;

    const baseCrop = this.paddedCrop(detection.box, frame.width, frame.height, padding, 0, 32);
    if (!baseCrop) return results;

    const scaler = this.getScaler();
    for (const t of targets) {
      const fitted = t.fit === 'expand' ? this.expandCropToAspect(baseCrop, frame.width, frame.height, t.width / t.height) : baseCrop;
      const crop = this.quantizeCrop(fitted, frame.width, frame.height);
      const data = await scaler.toBuffer(frame, { crop, resize: { width: t.width, height: t.height }, format: t.format });
      results.set(t.key, {
        frame: { id: `crop:${detection.label}:${t.key}`, data, width: t.width, height: t.height, format: t.format },
        detection,
        offset: { x: crop.x, y: crop.y },
        cropSize: { width: crop.width, height: crop.height },
        originalSize: { width: frame.width, height: frame.height },
      });
    }

    return results;
  }

  public clearCache(): void {
    this.scaler?.[Symbol.dispose]();
    this.scaler = undefined;
  }

  public updateHardwareContext(context: HardwareContext | null | undefined): void {
    if (this.hardwareContext !== context) {
      this.clearCache();
      this.hardwareContext = context;
    }
  }

  public dispose(): void {
    this.clearCache();
  }

  private expandCropToAspect(crop: ScalerCrop, frameWidth: number, frameHeight: number, aspect: number): ScalerCrop {
    let { x, y, width, height } = crop;

    if (width / height < aspect) {
      const grow = Math.round(height * aspect) - width;
      x -= Math.floor(grow / 2);
      width += grow;
    } else {
      const grow = Math.round(width / aspect) - height;
      y -= Math.floor(grow / 2);
      height += grow;
    }

    x = Math.max(0, Math.min(x, frameWidth - width));
    y = Math.max(0, Math.min(y, frameHeight - height));
    width = Math.min(width, frameWidth - x);
    height = Math.min(height, frameHeight - y);

    return { x, y, width, height };
  }

  private quantizeCrop(crop: ScalerCrop, frameWidth: number, frameHeight: number, grid = 32): ScalerCrop {
    const width = Math.min(frameWidth, Math.ceil(crop.width / grid) * grid);
    const height = Math.min(frameHeight, Math.ceil(crop.height / grid) * grid);
    const x = Math.max(0, Math.min(crop.x - Math.floor((width - crop.width) / 2), frameWidth - width));
    const y = Math.max(0, Math.min(crop.y - Math.floor((height - crop.height) / 2), frameHeight - height));
    return { x, y, width, height };
  }

  private identityGeometry(spec: VideoInputSpec): LetterboxGeometry {
    return { padX: 0, padY: 0, innerWidth: spec.width, innerHeight: spec.height, targetWidth: spec.width, targetHeight: spec.height };
  }

  private paddedCrop(
    box: { x: number; y: number; width: number; height: number },
    frameWidth: number,
    frameHeight: number,
    padding: number,
    minCrop: number,
    minValid = 2,
  ): ScalerCrop | null {
    const x = Math.floor(box.x * frameWidth);
    const y = Math.floor(box.y * frameHeight);
    const w = Math.floor(box.width * frameWidth);
    const h = Math.floor(box.height * frameHeight);

    const extraPadX = minCrop > 0 ? Math.max(0, Math.ceil((minCrop - w) / 2)) : 0;
    const extraPadY = minCrop > 0 ? Math.max(0, Math.ceil((minCrop - h) / 2)) : 0;
    const padX = Math.floor(w * padding) + extraPadX;
    const padY = Math.floor(h * padding) + extraPadY;

    const cropX = Math.max(0, x - padX);
    const cropY = Math.max(0, y - padY);
    const cropW = Math.min(frameWidth - cropX, w + 2 * padX);
    const cropH = Math.min(frameHeight - cropY, h + 2 * padY);

    if (cropW < minValid || cropH < minValid) return null;
    return { x: cropX, y: cropY, width: cropW, height: cropH };
  }

  private scaledSize(width: number, height: number, maxWidth: number): { width: number; height: number } {
    const scaleW = width > maxWidth ? maxWidth : width & ~1;
    const scaleH = width > maxWidth ? Math.round((height * maxWidth) / width) & ~1 : height & ~1;
    return { width: scaleW, height: scaleH };
  }

  private proportionalSize(frameWidth: number, frameHeight: number, maxWidth: number): { width: number; height: number } {
    if (frameWidth <= maxWidth) {
      return { width: frameWidth & ~1, height: frameHeight & ~1 };
    }
    const scale = maxWidth / frameWidth;
    return { width: maxWidth & ~1, height: Math.round(frameHeight * scale) & ~1 };
  }

  private getScaler(): Scaler {
    this.scaler ??= new Scaler(this.hardwareContext ? { hardware: this.hardwareContext } : {});
    return this.scaler;
  }
}
