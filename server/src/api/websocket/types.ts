import type { Namespace } from 'socket.io';
import type { PLUGIN_STATUS } from '../../plugins/types.js';
import type { RuntimeInfo } from '../../services/config/types.js';

export type SocketNsp = '/camera.ui' | '/events' | '/metrics' | '/logs' | '/status' | '/notifications' | '/plugins' | '/server' | '/cameras' | '/workers';

export interface SocketNspMap {
  nsp: Namespace;
  [key: string]: any;
}

export type ProcessType = 'system' | 'core' | 'frameworker' | 'plugin';

export interface WorkerPerfStats {
  lowFps: number;
  mainFps: number;
  mainStreamEnabled: boolean;
  frameAnalysis: boolean;
  activePercent: number;
  decodeMs: number;
  scaleMs: number;
  jpegMs: number;
  inferMs: number;
  secondaryMs: number;
  objects: number;
  faces: number;
  plates: number;
  switches: number;
}

export interface ProcessInfo {
  name: string;
  pid?: number;
  cpuLoad: string;
  memLoad: string;
  type: ProcessType;
  timestamp: number;
  perf?: WorkerPerfStats;
}

export interface ServerProcessInfo {
  'camera.ui': ProcessInfo;
  go2rtc: ProcessInfo;
  nats: ProcessInfo;
}

export interface ServerProcesses {
  'camera.ui': ProcessInfo[];
  go2rtc: ProcessInfo[];
  nats: ProcessInfo[];
}

export type WorkerProcessInfo = Record<string, ProcessInfo>;

export type WorkerProcesses = Record<string, ProcessInfo[]>;

export interface AllProcesses extends ServerProcessInfo {
  plugins: WorkerProcessInfo;
  workers: WorkerProcessInfo;
}

export interface PluginRuntimeInfo {
  name: string;
  status: PLUGIN_STATUS;
}

export interface ServerRuntime {
  'camera.ui'?: RuntimeInfo;
  go2rtc?: RuntimeInfo;
  tunnelClient?: RuntimeInfo;
  nats?: RuntimeInfo;
}

export type WorkerRuntime = Record<string, PluginRuntimeInfo>;
