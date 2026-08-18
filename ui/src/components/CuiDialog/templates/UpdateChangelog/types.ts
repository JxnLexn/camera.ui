export interface UpdateChangelogProps {
  kind: 'server' | 'plugin' | 'worker';
  name: string;
  version?: string;
}
