import { NvrController } from '../controllers/nvr.controller.js';
import { validJWTNeeded } from '../middlewares/authValidation.middleware.js';
import { nvrEventParamsSchema, nvrEventThumbnailQuerySchema } from '../schemas/nvr.schema.js';

import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';

export const NvrRoute: FastifyPluginAsync = async (app: FastifyInstance): Promise<void> => {
  const controller = new NvrController();

  app.withTypeProvider<ZodTypeProvider>().route({
    url: '/events/:eventId/thumbnail',
    method: 'GET',
    preValidation: [validJWTNeeded],
    handler: controller.getEventThumbnail.bind(controller),
    schema: {
      tags: ['NVR'],
      summary: 'Get the primary thumbnail of an NVR event',
      params: nvrEventParamsSchema,
      querystring: nvrEventThumbnailQuerySchema,
    },
  });
};
