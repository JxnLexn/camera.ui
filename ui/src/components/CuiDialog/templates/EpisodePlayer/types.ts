import type { RecordedEpisode } from '@camera.ui/nvr';
import type { DBCamera } from '@shared/types';

export interface EpisodePlayerProps {
  episode: RecordedEpisode;
  cameraById: Map<string, DBCamera>;
}
