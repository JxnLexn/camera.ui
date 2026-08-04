import * as zod from 'zod';

import { VIRTUAL_SENSOR_TYPES } from '../../sensors/types.js';

import type { VirtualSensorType } from '../../sensors/types.js';

export const sensorParamsSchema = zod.object({
  id: zod.string().min(1, 'Sensor ID is required'),
});

export const createVirtualSensorSchema = zod.object({
  cameraId: zod.string().min(1).optional(),
  type: zod.enum(VIRTUAL_SENSOR_TYPES as [VirtualSensorType, ...VirtualSensorType[]]),
  name: zod.string().trim().min(1, 'Name is required').max(100, 'Name cannot be more than 100 characters'),
});

export const patchSensorSchema = zod
  .object({
    displayName: zod.string().trim().min(1, 'Display name is required').max(100, 'Display name cannot be more than 100 characters').optional(),
    assignedCameraIds: zod.array(zod.string().min(1)).optional(),
    exposed: zod.boolean().optional(),
    hidden: zod.boolean().optional(),
  })
  .refine((body) => body.displayName !== undefined || body.assignedCameraIds !== undefined || body.exposed !== undefined || body.hidden !== undefined, {
    message: 'Nothing to update',
  });

export const sensorCommandSchema = zod.object({
  property: zod.string().trim().min(1, 'Property is required'),
  value: zod.unknown(),
});

export const bulkDeleteSensorsSchema = zod.object({
  ids: zod.array(zod.string()).min(1).max(10000),
});

export const bulkPatchSensorsSchema = zod.object({
  ids: zod.array(zod.string()).min(1).max(10000),
  data: zod.object({ hidden: zod.boolean() }),
});

export type CreateVirtualSensorInput = zod.infer<typeof createVirtualSensorSchema>;
export type PatchSensorInput = zod.infer<typeof patchSensorSchema>;
export type BulkDeleteSensorsInput = zod.infer<typeof bulkDeleteSensorsSchema>;
export type BulkPatchSensorsInput = zod.infer<typeof bulkPatchSensorsSchema>;
export type SensorCommandInput = zod.infer<typeof sensorCommandSchema>;
