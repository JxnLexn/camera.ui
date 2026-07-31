import { CastController } from '../controllers/cast.controller.js';
import { onlyAdminCanDoThisAction } from '../middlewares/authPermission.middleware.js';
import { validJWTNeeded } from '../middlewares/authValidation.middleware.js';
import { castSchema } from '../schemas/cast.schema.js';

import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';

export const CastRoute: FastifyPluginAsync = async (app: FastifyInstance): Promise<void> => {
  const controller = new CastController(app);

  app.route({
    url: '/targets',
    method: 'GET',
    preValidation: [validJWTNeeded, onlyAdminCanDoThisAction],
    handler: controller.listTargets.bind(controller),
    schema: {
      tags: ['Cast'],
      summary: 'List reachable cast targets (TV clients)',
    },
  });

  app.withTypeProvider<ZodTypeProvider>().route({
    url: '/',
    method: 'POST',
    preValidation: [validJWTNeeded, onlyAdminCanDoThisAction],
    handler: controller.cast.bind(controller),
    schema: {
      tags: ['Cast'],
      summary: 'Open a camera on a cast target, live or at a point in time',
      body: castSchema,
    },
  });
};
