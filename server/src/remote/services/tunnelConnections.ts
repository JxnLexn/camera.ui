const REGISTERED = /Registered tunnel connection\b.*?\bconnIndex=(\d+)/;
const UNREGISTERED = /Unregistered tunnel connection\b.*?\bconnIndex=(\d+)/;

export class TunnelConnections {
  private connections = new Set<string>();
  private waiters = new Set<(registered: boolean) => void>();

  public get count(): number {
    return this.connections.size;
  }

  public get registered(): boolean {
    return this.connections.size > 0;
  }

  public observe(line: string): void {
    const up = REGISTERED.exec(line);
    if (up) {
      this.connections.add(up[1]);
      for (const waiter of [...this.waiters]) waiter(true);
      this.waiters.clear();
      return;
    }

    const down = UNREGISTERED.exec(line);
    if (down) this.connections.delete(down[1]);
  }

  public reset(): void {
    this.connections.clear();
    for (const waiter of [...this.waiters]) waiter(false);
    this.waiters.clear();
  }

  public whenRegistered(timeoutMs: number): Promise<boolean> {
    if (this.registered) return Promise.resolve(true);

    return new Promise((resolve) => {
      const settle = (value: boolean): void => {
        clearTimeout(timer);
        this.waiters.delete(settle);
        resolve(value);
      };
      const timer = setTimeout(() => settle(this.registered), timeoutMs);
      timer.unref();
      this.waiters.add(settle);
    });
  }
}
