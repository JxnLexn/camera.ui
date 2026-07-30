import { container } from 'tsyringe';

import { NamespaceManager } from '../../rpc/namespaces.js';
import { PluginsService } from '../services/plugins.service.js';

import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Plugin } from '../../plugins/plugin.js';
import type { ProxyServer } from '../../rpc/index.js';
import type { NvrEventParams, NvrEventThumbnailQuery } from '../schemas/nvr.schema.js';
import type { AuthLoginRequest } from '../types/index.js';

type ThumbnailMap = Record<string, Uint8Array>;

interface EventThumbnails {
  attributes?: ThumbnailMap;
  scenes?: ThumbnailMap;
  detections?: ThumbnailMap;
  event?: Uint8Array;
}

interface NvrRpc {
  getEventThumbnails(cameraId: string, startMs: number, eventId: string): Promise<EventThumbnails | undefined>;
}

export class NvrController {
  private pluginsService = new PluginsService();
  private proxyServer = container.resolve<ProxyServer>('proxy');

  public async getEventThumbnail(
    req: FastifyRequest<AuthLoginRequest & { Params: NvrEventParams; Querystring: NvrEventThumbnailQuery }>,
    reply: FastifyReply,
  ): Promise<FastifyReply> {
    const plugin = this.resolveNvrPlugin();
    if (!plugin) {
      return reply.code(404).send({ statusCode: 404, message: 'NVR plugin is not running' });
    }

    try {
      const thumbnails = await this.proxyFor(plugin).getEventThumbnails(req.query.cameraId, req.query.startMs, req.params.eventId);
      const image = this.pickPrimaryThumbnail(thumbnails);
      if (!image) {
        return reply.code(404).send({ statusCode: 404, message: 'No thumbnail for this event' });
      }
      return reply.code(200).header('content-type', 'image/jpeg').send(Buffer.from(image));
    } catch (error: any) {
      return reply.code(500).send({ statusCode: 500, message: error.message });
    }
  }

  private proxyFor(plugin: Plugin): NvrRpc {
    const ns = NamespaceManager.pluginNamespaces(plugin.id).pluginChildRpc;
    return this.proxyServer.proxy.createProxy<NvrRpc>(ns);
  }

  private resolveNvrPlugin(): Plugin | undefined {
    for (const name of ['camera-ui-nvr', '@camera.ui/camera-ui-nvr']) {
      const plugin = this.pluginsService.getPluginByName(name);
      if (plugin?.worker.isRunning()) {
        return plugin;
      }
    }
    return undefined;
  }

  private pickPrimaryThumbnail(thumbnails: EventThumbnails | undefined): Uint8Array | undefined {
    if (!thumbnails) return undefined;

    const attributes = thumbnails.attributes ?? {};
    const face = Object.keys(attributes).find((key) => key.startsWith('face:'));
    if (face) return attributes[face];
    const firstAttribute = Object.values(attributes)[0];
    if (firstAttribute) return firstAttribute;

    const scenes = thumbnails.scenes ?? {};
    const orderedScene = Object.keys(scenes).sort((a, b) => Number(a) - Number(b))[0];
    if (orderedScene) return scenes[orderedScene];

    const detections = thumbnails.detections ?? {};
    const person = Object.keys(detections).find((key) => key.endsWith(':person'));
    if (person) return detections[person];
    const firstDetection = Object.values(detections)[0];
    if (firstDetection) return firstDetection;

    return thumbnails.event;
  }
}
