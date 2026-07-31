import { axiosInstance as api } from '..';

import type { AxiosResponse } from 'axios';

export interface CastTarget {
  deviceId: string;
  name: string;
  lastSeen: number;
}

export interface CastBody {
  deviceId: string;
  cameraId: string;
  startMs?: number;
}

export async function listCastTargetsFn(): Promise<CastTarget[]> {
  const response: AxiosResponse<CastTarget[]> = await api.get('/cast/targets');
  return response.data;
}

export async function castFn(body: CastBody): Promise<void> {
  await api.post('/cast', body);
}
