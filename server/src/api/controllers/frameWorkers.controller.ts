import { orderBy } from '@camera.ui/common/utils';
import { readdirSync, readFileSync } from 'fs';
import * as si from 'systeminformation';
import { container } from 'tsyringe';

import { ConfigService } from '../../services/config/index.js';

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { CameraUiAPI } from '../../api.js';
import type { BenchmarkSystem, ObjectBenchmarkResult, ObjectBenchmarkRun } from '../../camera/decoder/types.js';
import type { PluginManager } from '../../plugins/index.js';
import type { AuthLoginRequest, FrameWorker, FrameWorkerParamsNameRequest, PaginationRequest } from '../types/index.js';

export class FrameWorkersController {
  private api: CameraUiAPI;
  private pluginManager: PluginManager;
  private benchmarkRun?: Promise<ObjectBenchmarkRun | null>;

  constructor(private app: FastifyInstance) {
    this.api = container.resolve<CameraUiAPI>('api');
    this.pluginManager = container.resolve<PluginManager>('pluginManager');
  }

  public list(_req: FastifyRequest<AuthLoginRequest & PaginationRequest>, reply: FastifyReply): FastifyReply | FrameWorker[] {
    try {
      const cameraControllers = this.api.getCameras();
      const frameWorkers = cameraControllers.map((cameraController) => {
        const frameWorker = cameraController.frameWorker;

        return {
          name: frameWorker.name,
          status: frameWorker.status,
        };
      });

      return orderBy(frameWorkers, ['name'], ['asc']);
    } catch (error: any) {
      return reply.code(500).send({
        statusCode: 500,
        message: error.message,
      });
    }
  }

  public async resetPerf(_req: FastifyRequest<AuthLoginRequest>, reply: FastifyReply): Promise<FastifyReply> {
    try {
      await Promise.all(this.api.getCameras().map((cameraController) => cameraController.frameWorker.resetPerf()));

      return reply.code(204).send();
    } catch (error: any) {
      return reply.code(500).send({
        statusCode: 500,
        message: error.message,
      });
    }
  }

  public async benchmark(
    req: FastifyRequest<AuthLoginRequest & { Body?: { cameras?: string[]; iterations?: number; concurrency?: number } }>,
    reply: FastifyReply,
  ): Promise<FastifyReply> {
    const iterations = Math.min(2000, Math.max(20, req.body?.iterations ?? 200));
    const concurrency = Math.min(16, Math.max(1, req.body?.concurrency ?? 4));

    try {
      this.benchmarkRun ??= this.runBenchmark(req.body?.cameras, iterations, concurrency).finally(() => {
        this.benchmarkRun = undefined;
      });

      const run = await this.benchmarkRun;
      if (!run) {
        return reply.code(404).send({
          statusCode: 404,
          message: 'No camera with an object detector',
        });
      }

      return reply.code(200).send(run);
    } catch (error: any) {
      return reply.code(500).send({
        statusCode: 500,
        message: error.message,
      });
    }
  }

  private async runBenchmark(cameras: string[] | undefined, iterations: number, concurrency: number): Promise<ObjectBenchmarkRun | null> {
    const workers = this.api.getCameras().map((cameraController) => cameraController.frameWorker);
    const selection = cameras?.length ? workers.filter((worker) => cameras.includes(worker.name)) : workers;

    try {
      await Promise.all(workers.map((worker) => worker.pauseForBenchmark(true)));

      const startedAt = Date.now();
      const results = await Promise.all(
        selection.map(async (worker) => {
          const result = await worker.runObjectBenchmark(iterations, concurrency);
          return result ? { ...result, camera: worker.name, plugin: this.pluginName(result.plugin) } : null;
        }),
      );
      const totalMs = Date.now() - startedAt;
      const measured = results.filter((result): result is ObjectBenchmarkResult => result !== null);
      if (measured.length === 0) return null;

      const done = measured.reduce((sum, result) => sum + result.iterations, 0);
      const handlerMs = measured.reduce((sum, result) => sum + result.handlerMs * result.iterations, 0);

      return {
        system: await this.benchmarkSystem(),
        total: {
          cameras: measured.length,
          iterations: done,
          failed: measured.reduce((sum, result) => sum + result.failed, 0),
          concurrency: concurrency * measured.length,
          totalMs,
          perSecond: totalMs > 0 ? Math.round((done / (totalMs / 1000)) * 10) / 10 : 0,
          handlerMs: done > 0 ? Math.round((handlerMs / done) * 10) / 10 : 0,
        },
        cameras: measured,
      };
    } finally {
      await Promise.all(workers.map((worker) => worker.pauseForBenchmark(false)));
    }
  }

  private async benchmarkSystem(): Promise<BenchmarkSystem> {
    const [cpu, memory, os, graphics] = await Promise.all([si.cpu(), si.mem(), si.osInfo(), si.graphics().catch(() => undefined)]);
    const gpu = graphics?.controllers.map((controller) => [controller.vendor, controller.model].filter(Boolean).join(' ').trim()).filter(Boolean);

    return {
      cpu: [cpu.manufacturer, cpu.brand].filter(Boolean).join(' '),
      cores: cpu.cores,
      memoryGb: Math.round((memory.total / 1024 ** 3) * 10) / 10,
      gpu: gpu?.length ? gpu.join(', ') : this.drmGpus(),
      os: [os.distro, os.release, `(${os.platform} ${os.arch})`].filter(Boolean).join(' '),
      version: ConfigService.RUNNING_VERSION,
    };
  }

  private drmGpus(): string | undefined {
    const vendors: Record<string, string> = { 8086: 'Intel', '10de': 'NVIDIA', 1002: 'AMD', '1af4': 'Virtio' };

    try {
      const cards = readdirSync('/sys/class/drm').filter((entry) => /^card\d+$/.test(entry));
      const names = cards
        .map((card) => {
          const uevent = readFileSync(`/sys/class/drm/${card}/device/uevent`, 'utf8');
          const driver = /DRIVER=(.+)/.exec(uevent)?.[1];
          const pciId = /PCI_ID=([0-9A-Fa-f]{4}):([0-9A-Fa-f]{4})/.exec(uevent);
          if (!pciId) return undefined;
          return [vendors[pciId[1].toLowerCase()] ?? pciId[1], driver, `[${pciId[1]}:${pciId[2]}]`].filter(Boolean).join(' ');
        })
        .filter((name): name is string => Boolean(name));

      return names.length ? [...new Set(names)].join(', ') : undefined;
    } catch {
      return undefined;
    }
  }

  private pluginName(pluginId: string): string {
    for (const plugin of this.pluginManager.plugins.values()) {
      if (plugin.id === pluginId) return plugin.displayName ?? plugin.pluginName;
    }
    return pluginId;
  }

  public async restartByName(req: FastifyRequest<AuthLoginRequest & FrameWorkerParamsNameRequest>, reply: FastifyReply): Promise<FastifyReply> {
    try {
      const cameraControllers = this.api.getCameras();
      const cameraController = cameraControllers.find((cameraController) => cameraController.frameWorker.name === req.params.frameworkername);
      const frameWorker = cameraController?.frameWorker;

      if (!frameWorker) {
        return reply.code(404).send({
          statusCode: 404,
          message: 'Frame Worker not exists',
        });
      }

      await frameWorker.restart();

      return reply.code(204).send();
    } catch (error: any) {
      return reply.code(500).send({
        statusCode: 500,
        message: error.message,
      });
    }
  }

  public async startByName(req: FastifyRequest<AuthLoginRequest & FrameWorkerParamsNameRequest>, reply: FastifyReply): Promise<FastifyReply> {
    try {
      const cameraControllers = this.api.getCameras();
      const cameraController = cameraControllers.find((cameraController) => cameraController.frameWorker.name === req.params.frameworkername);
      const frameWorker = cameraController?.frameWorker;

      if (!frameWorker) {
        return reply.code(404).send({
          statusCode: 404,
          message: 'Frame Worker not exists',
        });
      }

      await frameWorker.start();

      return reply.code(204).send();
    } catch (error: any) {
      return reply.code(500).send({
        statusCode: 500,
        message: error.message,
      });
    }
  }

  public async stopByName(req: FastifyRequest<AuthLoginRequest & FrameWorkerParamsNameRequest>, reply: FastifyReply): Promise<FastifyReply> {
    try {
      const cameraControllers = this.api.getCameras();
      const cameraController = cameraControllers.find((cameraController) => cameraController.frameWorker.name === req.params.frameworkername);
      const frameWorker = cameraController?.frameWorker;

      if (!frameWorker) {
        return reply.code(404).send({
          statusCode: 404,
          message: 'Frame Worker not exists',
        });
      }

      await frameWorker.close();

      return reply.code(204).send();
    } catch (error: any) {
      return reply.code(500).send({
        statusCode: 500,
        message: error.message,
      });
    }
  }
}
