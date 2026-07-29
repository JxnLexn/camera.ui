import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import { CoalescingWriter } from './coalescingWriter.js';
import { upgradeStoreLayout } from './layout.js';
import { backupStoreFile, readStoreFile, removeOrphanedTmpFiles, writeStoreFile } from './storeFile.js';

export const STORE_FILE_NAME = 'store.cui';

export class PluginStoreFile {
  private readonly path: string;
  private readonly writer: CoalescingWriter;
  private payload: Record<string, any> = {};
  private closed = true;

  constructor(private readonly volumeDir: string) {
    this.path = join(volumeDir, STORE_FILE_NAME);
    this.writer = new CoalescingWriter((snapshot) => writeStoreFile(this.path, snapshot));
  }

  public async open(): Promise<void> {
    await mkdir(this.volumeDir, { recursive: true });
    await removeOrphanedTmpFiles(this.path);

    let payload = await readStoreFile(this.path);
    if (payload === undefined) {
      payload = {};
      await writeStoreFile(this.path, payload);
    }

    const upgraded = upgradeStoreLayout(payload);
    if (upgraded !== payload) {
      await writeStoreFile(this.path, upgraded);
    }

    this.payload = upgraded;
    await backupStoreFile(this.path);
    this.closed = false;
  }

  public get(): Record<string, any> {
    return this.payload;
  }

  public async put(payload: Record<string, any>): Promise<void> {
    if (this.closed) {
      // A silently "successful" no-op here would lose the write during
      // shutdown windows. Fail loudly instead.
      throw new Error(`store: put on closed store ${this.path}`);
    }
    this.payload = payload;
    await this.writer.write(payload);
  }

  public async close(): Promise<void> {
    this.closed = true;
    await this.writer.idle();
  }
}
