import type { CameraUiPlugin } from '@shared/types';

export const PLUGIN_CARD_SIZE = {
  HEIGHT: 220,
};

export interface CuiPluginCardProps {
  plugin: CameraUiPlugin;
  selectionMode?: boolean;
  selected?: boolean;
}

export interface CuiPluginOAuthButtonProps {
  pluginName: string;
  routeTo?: string;
}
