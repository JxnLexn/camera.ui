import { container } from 'tsyringe';

import type { ProxyServer } from '../../rpc/index.js';
import type { ActionContext } from './types.js';

export async function actionNotificationControl(ctx: ActionContext, data: Record<string, unknown>): Promise<void> {
  const suppressed = data.mode !== 'enable';
  const scope = data.scope === 'user' ? 'user' : 'global';

  const notificationManager = container.resolve<ProxyServer>('proxy').notificationManager;

  if (scope === 'user') {
    const userId = ctx.resolve((data.userId as string) ?? '').trim();
    if (!userId) {
      ctx.logger.warn(`[automation:${ctx.flowName}] action-notification-control skipped — no user selected`);
      return;
    }
    await notificationManager.setUserSuppressed(userId, suppressed);
    return;
  }

  await notificationManager.setGlobalSuppressed(suppressed);
}
