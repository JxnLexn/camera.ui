import { container } from 'tsyringe';

import type { CastCommand, CastTarget } from '../../manager/castManager.js';
import type { ProxyServer } from '../../rpc/index.js';

export class CastService {
  private proxyServer: ProxyServer;

  constructor() {
    this.proxyServer = container.resolve<ProxyServer>('proxy');
  }

  public listTargets(): CastTarget[] {
    return this.proxyServer.castManager.listTargets();
  }

  public cast(deviceId: string, command: CastCommand): Promise<boolean> {
    return this.proxyServer.castManager.cast(deviceId, command);
  }
}
