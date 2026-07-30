import type { RPCClient } from '@camera.ui/rpc';

export function watchReconnect(proxy: RPCClient, onReconnect: () => Promise<void>, onEnd: (error: unknown) => void): (() => void) | undefined {
  const status = proxy.status();
  if (!status) return undefined;

  const iterator = status[Symbol.asyncIterator]();
  let stopped = false;

  (async () => {
    try {
      while (!stopped) {
        const next = await iterator.next();
        if (next.done || stopped) break;
        if (next.value.type !== 'reconnect') continue;
        await onReconnect();
      }
    } catch (error) {
      onEnd(error);
    }
  })();

  return () => {
    stopped = true;
    iterator.return?.()?.catch(() => {});
  };
}
