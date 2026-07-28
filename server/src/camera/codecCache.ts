import type { AudioCodec, VideoCodec } from '@camera.ui/sdk';

export interface SourceCodecInfo {
  videoCodec?: VideoCodec;
  audioCodecs?: AudioCodec[];
  backchannelAudioCodec?: AudioCodec;
}

const sourceCodecs = new Map<string, SourceCodecInfo>();

export function getSourceCodecInfo(sourceId: string): SourceCodecInfo | undefined {
  return sourceCodecs.get(sourceId);
}

export function setSourceCodecInfo(sourceId: string, info: SourceCodecInfo): void {
  sourceCodecs.set(sourceId, info);
}

export function deleteSourceCodecInfo(sourceId: string): void {
  sourceCodecs.delete(sourceId);
}

export function clearSourceCodecInfos(): void {
  sourceCodecs.clear();
}
