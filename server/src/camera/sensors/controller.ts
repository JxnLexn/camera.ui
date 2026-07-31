import { container } from 'tsyringe';

import { NamespaceManager } from '../../rpc/namespaces.js';

import type { Promisify, RPCClient } from '@camera.ui/rpc';
import type { SensorLike, SensorType } from '@camera.ui/sdk';
import type { InternalEventBus, SensorLifecyclePayload } from '../../internal-bus.js';
import type { DetectionCoordinatorInterface } from '../../rpc/interfaces/detection.js';
import type { SensorRefreshedState, SensorWriteMessage } from '../../rpc/interfaces/sensor.js';
import type { SensorRegistry } from '../../sensors/registry.js';
import type { ServerSensor } from '../../sensors/sensor.js';
import type { CameraController } from '../controller.js';
import type { FrameWorker } from '../decoder/worker.js';

export class SensorController {
  private readonly registry: SensorRegistry;
  private readonly disposables: (() => void | Promise<void>)[] = [];

  constructor(
    private cameraController: CameraController,
    private frameWorker: FrameWorker,
    private proxy: RPCClient,
  ) {
    this.registry = container.resolve<SensorRegistry>('sensorRegistry');
  }

  public get detectionCoordinatorProxy(): Promisify<DetectionCoordinatorInterface> {
    return this.registry.coordinatorFor(this.cameraController.id);
  }

  public async init(): Promise<void> {
    // Coordinator-published write batches for detection-sensor properties —
    // worker owns the state, we only mirror.
    const writeNs = NamespaceManager.sensorCameraViewNamespaces(this.cameraController.id);
    const writeUnsub = await this.proxy.subscribe<SensorWriteMessage>(writeNs.sensorWriteSubject, (msg) => {
      this.registry.getSensor(msg.sensorId)?.applyWriteBatch(msg.properties);
    });
    this.disposables.push(writeUnsub);

    const settings = this.cameraController.onPropertyChange('detectionSettings').subscribe(({ newData }) => {
      this.handleSensorTriggersChanged(newData.sensor?.triggers ?? []);
    });
    this.disposables.push(() => settings.dispose());

    // mirror registry lifecycle into the camera's own subjects (UI drawer, homekit)
    const bus = container.resolve<InternalEventBus>('internalBus');
    const onAdded = (payload: SensorLifecyclePayload): void => {
      if (!payload.assignedCameraIds.includes(this.cameraController.id)) return;
      this.cameraController.updateSensorState(payload.sensorId, payload.sensorType as SensorType, 'added');
    };
    bus.onEvent('sensor:added', onAdded as (payload: unknown) => void);
    this.disposables.push(() => bus.offEvent('sensor:added', onAdded as (payload: unknown) => void));
  }

  public async destroy(): Promise<void> {
    for (const dispose of this.disposables.reverse()) {
      try {
        await dispose();
      } catch (error) {
        this.cameraController.logger.warn('Sensor controller disposal failed:', error);
      }
    }
    this.disposables.length = 0;
  }

  public onFrameWorkerStateChanged(oldState: boolean, newState: boolean): void {
    if (!oldState && newState) {
      const maxRetries = this.frameWorker.isRemoteWorker ? 5 : 1;
      this.registry.reconcileCamera(this.cameraController.id, maxRetries).catch((error: unknown) => {
        this.cameraController.logger.warn('Sensor reconcile after worker start failed:', error);
      });
    }
  }

  public getSensor(sensorId: string, options: { activatedOnly?: boolean } = { activatedOnly: false }): ServerSensor | undefined {
    const sensor = this.registry.getSensor(sensorId, { connectedOnly: options.activatedOnly });
    if (!sensor) return undefined;
    if (options.activatedOnly && !sensor.assignedCameraIds.includes(this.cameraController.id)) return undefined;
    return sensor;
  }

  public getSensorByTypeInternal(sensorType: SensorType): ServerSensor | undefined {
    return this.getAllSensors().find((s) => s.type === sensorType);
  }

  public getAllSensors(): ServerSensor[] {
    return this.registry.getAllSensors({ connectedOnly: true, cameraId: this.cameraController.id });
  }

  public getSensorsByType(sensorType: SensorType): ServerSensor[] {
    return this.getAllSensors().filter((s) => s.type === sensorType);
  }

  public getStatesForCamera(): Record<string, SensorRefreshedState> {
    const result: Record<string, SensorRefreshedState> = {};
    for (const sensor of this.getAllSensors()) {
      result[sensor.id] = sensor.getState();
    }
    return result;
  }

  public getPluginSensorRpc(pluginId: string, sensorId: string): Promisify<SensorLike> {
    const ns = NamespaceManager.sensorProviderNamespaces(pluginId, sensorId).sensorRpc;
    return this.proxy.createProxy<SensorLike>(ns);
  }

  public unassignPluginSensors(pluginId: string): void {
    this.registry.unassignPluginFromCamera(pluginId, this.cameraController.id).catch((error: unknown) => {
      this.cameraController.logger.warn(`Failed to unassign sensors of plugin ${pluginId}:`, error);
    });
  }

  public updatePropertyValues(sensorId: string, properties: Record<string, unknown>): void {
    this.registry.updatePropertyValues(sensorId, properties);
  }

  private handleSensorTriggersChanged(triggers: string[]): void {
    const activeSensorIds = triggers.filter((sensorId) => this.registry.isConnected(sensorId));

    this.detectionCoordinatorProxy.reconcileSensorTriggers(activeSensorIds).catch((error: unknown) => {
      this.cameraController.logger.warn('Failed to reconcile sensor triggers:', error);
    });
  }
}
