const FAILED = /Error trying to connect as leafnode to remote server \S+ \(attempt \d+\): (.+)$/;

export class LeafConnection {
  public onChange?: (connected: boolean) => void;

  private linked = false;
  private error?: string;
  private waiters = new Set<(connected: boolean) => void>();

  public get connected(): boolean {
    return this.linked;
  }

  public get lastError(): string | undefined {
    return this.error;
  }

  public observe(line: string): void {
    if (line.includes('Leafnode connection created')) {
      this.error = undefined;
      this.setLinked(true);
      for (const waiter of [...this.waiters]) waiter(true);
      this.waiters.clear();
      return;
    }

    if (line.includes('Leafnode connection closed')) {
      this.setLinked(false);
      return;
    }

    const failed = FAILED.exec(line);
    if (failed) {
      this.error = failed[1];
    }
  }

  public reset(): void {
    // waiters keep their own deadline: a restart in between is normal and must
    // not read as "the link will never come up"
    this.linked = false;
    this.error = undefined;
  }

  public whenConnected(timeoutMs: number): Promise<boolean> {
    if (this.linked) {
      return Promise.resolve(true);
    }

    return new Promise((resolve) => {
      const settle = (value: boolean): void => {
        clearTimeout(timer);
        this.waiters.delete(settle);
        resolve(value);
      };
      const timer = setTimeout(() => settle(this.linked), timeoutMs);
      timer.unref();
      this.waiters.add(settle);
    });
  }

  private setLinked(linked: boolean): void {
    if (this.linked === linked) {
      return;
    }

    this.linked = linked;
    this.onChange?.(linked);
  }
}
