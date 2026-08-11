import type { GridRegion } from './types.js';
import type { BoundingBox } from '@camera.ui/sdk';

export const GRID_COLS = 10;
export const GRID_ROWS = 11;

export function boxOverlapsRegions(box: BoundingBox, regions: GridRegion[]): boolean {
  const cellW = 1 / GRID_COLS;
  const cellH = 1 / GRID_ROWS;
  const bCol1 = box.x / cellW;
  const bCol2 = (box.x + box.width) / cellW;
  const bRow1 = box.y / cellH;
  const bRow2 = (box.y + box.height) / cellH;
  for (const r of regions) {
    if (bCol2 > r.col && bCol1 < r.col + r.w && bRow2 > r.row && bRow1 < r.row + r.h) {
      return true;
    }
  }
  return false;
}
