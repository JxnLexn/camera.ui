import { useLogsSocket } from './sockets/useLogsSocket.js';

export interface PluginUpdateRun {
  status: 'updating' | 'success' | 'error';
  error?: string;
  lines: string[];
  version?: string;
}

const MAX_BUFFERED_CHUNKS = 2000;

const runs = reactive<Record<string, PluginUpdateRun>>({});

export function usePluginUpdates() {
  function runOf(pluginName: string): PluginUpdateRun | undefined {
    return runs[pluginName];
  }

  function isUpdating(pluginName: string): boolean {
    return runs[pluginName]?.status === 'updating';
  }

  async function startUpdate(pluginName: string, version: string | undefined, install: () => Promise<unknown>): Promise<boolean> {
    if (runs[pluginName]?.status === 'updating') return false;

    runs[pluginName] = { status: 'updating', lines: [], version };
    const run = runs[pluginName];

    const scope = effectScope(true);
    scope.run(() => {
      useLogsSocket({
        target: pluginName,
        onStdout: (data) => {
          run.lines.push(data);
          if (run.lines.length > MAX_BUFFERED_CHUNKS) run.lines.splice(0, run.lines.length - MAX_BUFFERED_CHUNKS);
        },
      });
    });

    try {
      await install();
      run.status = 'success';
      return true;
    } catch (error: any) {
      run.status = 'error';
      run.error = error?.response?.data?.message ?? error?.message ?? String(error);
      return false;
    } finally {
      scope.stop();
    }
  }

  return { runs, runOf, isUpdating, startUpdate };
}
