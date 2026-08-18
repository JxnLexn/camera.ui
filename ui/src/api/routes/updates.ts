import { axiosInstance as api } from '..';

import type { UpdatesRunState, UpdatesStatus } from '@shared/types';
import type { AxiosResponse } from 'axios';

export async function getUpdatesStatus({ signal }: { signal?: AbortSignal } = {}): Promise<UpdatesStatus> {
  const response: AxiosResponse<UpdatesStatus> = await api.get('/updates/status', { signal });
  return response.data;
}

export async function runUpdates(): Promise<UpdatesRunState> {
  const response: AxiosResponse<UpdatesRunState> = await api.post('/updates/run');
  return response.data;
}

export async function cancelUpdates(): Promise<void> {
  await api.post('/updates/cancel');
}

export async function checkUpdates(): Promise<void> {
  await api.post('/updates/check', undefined, { timeout: 60_000 });
}
