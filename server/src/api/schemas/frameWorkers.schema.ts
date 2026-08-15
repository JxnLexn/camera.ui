import * as zod from 'zod';

export const frameWorkerParamsSchema = zod.object({
  frameworkername: zod.string().min(1, 'Frame worker name is required'),
});

export type FrameWorkerParamsInput = zod.output<typeof frameWorkerParamsSchema>;

export const frameWorkerBenchmarkSchema = zod
  .object({
    cameras: zod.array(zod.string()).optional(),
    iterations: zod.number().int().min(20).max(2000).optional(),
    concurrency: zod.number().int().min(1).max(16).optional(),
  })
  .nullish();

export type FrameWorkerBenchmarkInput = zod.output<typeof frameWorkerBenchmarkSchema>;
