import { container } from 'tsyringe';

import { createEmptyContext } from '../context.js';

import type { Disposable } from '@camera.ui/sdk';
import type { DBAutomation, DBAutomationNode } from '../../api/database/types.js';
import type { InternalEventBus, InternalEventPayload, SensorPropertyChangedPayload } from '../../internal-bus.js';
import type { SensorRegistry } from '../../sensors/registry.js';
import type { TriggerContext } from './types.js';

export function subscribeSensor(ctx: TriggerContext, flow: DBAutomation, triggerNode: DBAutomationNode): void {
  const sensorId = triggerNode.data.sensorId as string;
  const watchProperties = (triggerNode.data.properties as string[]) ?? [];

  if (!sensorId) return;

  const registry = container.resolve<SensorRegistry>('sensorRegistry');
  const record = registry.getRecord(sensorId);
  if (!record) {
    // arm anyway, the sensor entity may appear later (plugin install, import)
    ctx.logger.debug(`Automation "${flow.name}": Sensor "${sensorId}" not found, trigger arms when it appears`);
  }

  const bus = container.resolve<InternalEventBus>('internalBus');
  const handler = (payload: InternalEventPayload) => {
    const p = payload as SensorPropertyChangedPayload;
    if (p.sensorId !== sensorId) return;
    if (watchProperties.length > 0 && !watchProperties.includes(p.property)) return;

    const context = createEmptyContext();
    context.sensor = {
      value: p.value,
      previousValue: p.previousValue,
      property: p.property,
      sensorType: p.sensorType,
      sensorId: p.sensorId,
      assignedCameraIds: p.assignedCameraIds,
    };

    ctx.executeFlow(flow, triggerNode, context);
  };

  bus.onEvent('sensor:property:changed', handler);

  const disposable: Disposable = {
    dispose: () => bus.offEvent('sensor:property:changed', handler),
  } as Disposable;

  ctx.addSubscription(flow._id, disposable);
  const label = record?.displayName ?? record?.name ?? sensorId;
  ctx.logger.trace(`Automation "${flow.name}": Subscribed to sensor "${label}" (properties: ${watchProperties.join(', ') || 'any'})`);
}
