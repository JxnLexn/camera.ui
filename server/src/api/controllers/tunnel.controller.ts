import { ServerService } from '../services/server.service.js';

import type { FastifyReply, FastifyRequest } from 'fastify';

export class TunnelController {
  private serverService: ServerService;

  constructor() {
    this.serverService = new ServerService();
  }

  public check(_req: FastifyRequest, reply: FastifyReply): FastifyReply {
    try {
      return reply.code(200).send(this.serverService.networkEndpoints());
    } catch (error: any) {
      return reply.code(500).send({
        statusCode: 500,
        message: error.message,
      });
    }
  }
}
