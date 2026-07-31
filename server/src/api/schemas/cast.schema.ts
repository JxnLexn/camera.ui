import * as zod from 'zod';

export const castSchema = zod.object({
  deviceId: zod.string().min(1),
  cameraId: zod.string().min(1),
  startMs: zod.number().positive().optional(),
});

export type CastInput = zod.output<typeof castSchema>;
