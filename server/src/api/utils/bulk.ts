export interface BulkResult {
  succeeded: string[];
  failed: { id: string; error: string }[];
}

export async function collectBulk(ids: string[], op: (id: string) => Promise<void>): Promise<BulkResult> {
  const result: BulkResult = { succeeded: [], failed: [] };
  for (const id of ids) {
    try {
      await op(id);
      result.succeeded.push(id);
    } catch (error: any) {
      result.failed.push({ id, error: error.message });
    }
  }
  return result;
}

export async function collectBulkParallel(ids: string[], op: (id: string) => Promise<void>): Promise<BulkResult> {
  const result: BulkResult = { succeeded: [], failed: [] };
  await Promise.all(
    ids.map(async (id) => {
      try {
        await op(id);
        result.succeeded.push(id);
      } catch (error: any) {
        result.failed.push({ id, error: error.message });
      }
    }),
  );
  return result;
}
