import type { DetectionEvent } from '@camera.ui/sdk';

export function eventAnchorTime(event: DetectionEvent): number {
  const at = event.thumbnailAt;
  if (at) {
    let anchor = 0;
    for (const s of event.segments ?? []) {
      if (s && s.firstSeen <= at && s.firstSeen > anchor) anchor = s.firstSeen;
    }
    return anchor || at;
  }
  return event.startTime;
}

export function segmentLabel(event: DetectionEvent, segIndex: number | string): string {
  const seg = event.segments?.[Number(segIndex)];
  return seg?.detections?.[0]?.label ?? 'scene';
}
