import type { ClipDetectionPluginResponse } from '@camera.ui/sdk';

export interface PluginClipInterfaceProps {
  src: HTMLMediaElement['src'];
  response: ClipDetectionPluginResponse;
  onTextSearch: (text: string) => Promise<{ score: number }>;
}

export interface PluginClipInterfaceResult {
  query: string;
  rawScore: number;
  displayScore: number;
}
