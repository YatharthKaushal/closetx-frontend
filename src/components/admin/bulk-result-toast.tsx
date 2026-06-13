import { toast } from 'sonner';
import { ApiError } from '@/lib/api';

export type BulkResult<TId extends string = string> = {
  ok: TId[];
  failed: Array<{ id: TId; error: string }>;
};

export type BulkOp<TId extends string = string> = {
  id: TId;
  /** Promise that resolves on success, rejects on failure. */
  run: () => Promise<unknown>;
};

/**
 * Run a batch of independent async operations with `Promise.allSettled`-like
 * isolation, but return both the IDs that succeeded and per-ID error messages
 * for those that failed. Caller is expected to surface failures via
 * `bulkResultToast` so operators can see which items need attention.
 */
export async function runBulk<TId extends string>(ops: BulkOp<TId>[]): Promise<BulkResult<TId>> {
  const results = await Promise.allSettled(ops.map((o) => o.run()));
  const ok: TId[] = [];
  const failed: BulkResult<TId>['failed'] = [];
  results.forEach((r, i) => {
    const id = ops[i]!.id;
    if (r.status === 'fulfilled') ok.push(id);
    else failed.push({ id, error: extractError(r.reason) });
  });
  return { ok, failed };
}

function extractError(reason: unknown): string {
  if (reason instanceof ApiError) return reason.message;
  if (reason instanceof Error) return reason.message;
  return 'Unknown error';
}

/**
 * Render a Sonner toast that succinctly reports the outcome of a bulk action.
 * When all succeed: success toast with the count and one-word verb.
 * When any fail: warning toast with a per-row breakdown so the operator can
 * identify and retry the failures.
 */
export function bulkResultToast<TId extends string>(args: {
  result: BulkResult<TId>;
  verb: string; // e.g. "approved", "retired", "retried"
  describe: (id: TId) => string; // human label per id, e.g. legal name
}) {
  const { result, verb, describe } = args;
  const total = result.ok.length + result.failed.length;
  if (result.failed.length === 0) {
    toast.success(`${result.ok.length} ${verb}.`);
    return;
  }
  toast.warning(`${result.ok.length} of ${total} ${verb}, ${result.failed.length} failed`, {
    description: (
      <ul className="mt-1 space-y-0.5 text-[12px]">
        {result.failed.slice(0, 5).map((f) => (
          <li key={f.id}>
            <span className="text-ink">{describe(f.id)}</span>
            <span className="text-ink-3"> — {f.error}</span>
          </li>
        ))}
        {result.failed.length > 5 && (
          <li className="text-ink-4">…and {result.failed.length - 5} more.</li>
        )}
      </ul>
    ),
    duration: 8000,
  });
}
