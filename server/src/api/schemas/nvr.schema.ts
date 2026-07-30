import * as zod from 'zod';

export const nvrEventParamsSchema = zod
  .object({
    eventId: zod.string().trim().min(1, 'Event id is required'),
  })
  .strict();

export const nvrEventThumbnailQuerySchema = zod
  .object({
    cameraId: zod.string().trim().min(1, 'Camera id is required'),
    startMs: zod.coerce.number(),
  })
  .strict();

export type NvrEventParams = zod.infer<typeof nvrEventParamsSchema>;
export type NvrEventThumbnailQuery = zod.infer<typeof nvrEventThumbnailQuerySchema>;
