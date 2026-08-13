import type { TopbarPosition } from '@/composables/useCuiTopbarSlots.js';

const { isElectronApp } = useElectron();

export const TOPBAR_SIZE = {
  HEIGHT: 60,
  ELECTRON_OFFSET: isElectronApp ? 30 : 0,
};

export type CuiTopbarProps = {
  offsetLeft: number;
  animate?: boolean;
  background?: string;
};

export interface CuiTopbarSlotProps {
  position: TopbarPosition;
}
