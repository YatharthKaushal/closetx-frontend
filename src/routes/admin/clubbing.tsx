import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Lock } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { clubbingDefaultMeta } from '@/lib/status';
import type { AppliedTo, ClubbingDefault, ClubbingMatrixCell } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Empty } from '@/components/ui/empty';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/cn';

/**
 * 5x5 clubbing matrix. Diagonal cells are self-pairs (e.g. coupon × coupon).
 * Lower triangle is implied (canonical pair stored once); we show only the
 * upper-triangle + diagonal cells. Always-allowed cells render with a lock and
 * cannot be downgraded.
 */
const APPLIED_TO_LABELS: Record<AppliedTo, string> = {
  retailer_promo: 'Retailer offer',
  platform_promo: 'Platform offer',
  coupon: 'Coupon',
  shipping: 'Shipping',
  loyalty: 'Loyalty',
};
const APPLIED_TO_ORDER: AppliedTo[] = [
  'retailer_promo',
  'platform_promo',
  'coupon',
  'shipping',
  'loyalty',
];

export function ClubbingPanel() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<ClubbingMatrixCell | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'clubbing-matrix'],
    queryFn: () => api<ClubbingMatrixCell[]>('/admin/clubbing-matrix'),
  });

  const upsert = useMutation({
    mutationFn: (cell: { appliedToA: AppliedTo; appliedToB: AppliedTo; defaultValue: ClubbingDefault; note?: string }) =>
      api<ClubbingMatrixCell>('/admin/clubbing-matrix', { method: 'PUT', body: cell }),
    onSuccess: () => {
      toast.success('Rule updated');
      setEditing(null);
      void qc.invalidateQueries({ queryKey: ['admin', 'clubbing-matrix'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Failed'),
  });

  // Build a lookup keyed by canonical pair "a:b"
  const lookup = new Map<string, ClubbingMatrixCell>();
  for (const c of data ?? []) lookup.set(`${c.appliedToA}:${c.appliedToB}`, c);

  return (
    <div>
      <p className="mb-4 max-w-3xl text-[13px] text-ink-3 leading-relaxed">
        Default rule for every pair of promotion types. Per-promotion overrides can flip an{' '}
        <em>allowed</em> or <em>disallowed</em> default; <em>always-allowed</em> cells (loyalty +
        anything, free shipping + coupon) are locked and cannot be overridden.
      </p>

      {isLoading ? (
        <Skeleton className="h-[420px]" />
      ) : isError ? (
        <Empty
          kicker="Connection lost"
          title="Couldn't load matrix"
          action={<Button variant="outline" onClick={() => refetch()}>Retry</Button>}
        />
      ) : (
        <>
          <Legend />
          <div className="overflow-x-auto">
            <table className="w-full border-collapse" style={{ minWidth: 720 }}>
              <thead>
                <tr>
                  <th className="w-32" />
                  {APPLIED_TO_ORDER.map((b) => (
                    <th
                      key={b}
                      className="border-b border-rule px-2 py-3 text-center kicker text-ink-3 align-bottom"
                    >
                      {APPLIED_TO_LABELS[b]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {APPLIED_TO_ORDER.map((a, ai) => (
                  <tr key={a}>
                    <th className="border-b border-r border-rule px-3 py-3 text-right kicker text-ink-3 align-middle">
                      {APPLIED_TO_LABELS[a]}
                    </th>
                    {APPLIED_TO_ORDER.map((b, bi) => {
                      const isUpper = bi >= ai;
                      const canonical = isUpper ? { a, b } : { a: b, b: a };
                      const cell = lookup.get(`${canonical.a}:${canonical.b}`);
                      const value: ClubbingDefault = cell?.defaultValue ?? 'allowed';
                      const seeded = cell?.seeded ?? false;
                      const locked = value === 'always_allowed';
                      const meta = clubbingDefaultMeta(value);
                      const cellRef: ClubbingMatrixCell = cell ?? {
                        appliedToA: canonical.a,
                        appliedToB: canonical.b,
                        defaultValue: value,
                        note: null,
                        seeded: false,
                      };
                      return (
                        <td
                          key={b}
                          className="relative border border-rule p-0 transition-colors"
                        >
                          <button
                            type="button"
                            onClick={() => setEditing(cellRef)}
                            className={cn(
                              'flex h-20 w-full flex-col items-center justify-center gap-1 px-2 transition-colors',
                              value === 'allowed' && 'bg-success-soft/50 hover:bg-success-soft',
                              value === 'disallowed' && 'bg-danger-soft/50 hover:bg-danger-soft',
                              value === 'always_allowed' && 'bg-info-soft/60 hover:bg-info-soft',
                              !seeded && 'opacity-70 hover:opacity-100',
                            )}
                            aria-label={`Edit ${APPLIED_TO_LABELS[a]} × ${APPLIED_TO_LABELS[b]}`}
                          >
                            <span
                              className={cn(
                                'text-[10.5px] uppercase tracking-[0.16em] font-semibold',
                                value === 'allowed' && 'text-success',
                                value === 'disallowed' && 'text-danger',
                                value === 'always_allowed' && 'text-info',
                              )}
                            >
                              {meta.label}
                            </span>
                            {locked && <Lock className="size-3 text-info" />}
                            {!seeded && (
                              <span className="text-[9px] uppercase tracking-[0.18em] text-ink-3">default</span>
                            )}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-6 text-[12px] text-ink-3 max-w-2xl leading-relaxed">
            <strong className="text-ink">default</strong> = engine-default value (cell is not
            stored in the DB until you edit it). <strong className="text-ink">Always allowed</strong>{' '}
            cells are locked: they cannot be downgraded by per-promotion overrides.
          </p>
        </>
      )}

      <EditDialog
        target={editing}
        onClose={() => setEditing(null)}
        onSave={(v, note) =>
          upsert.mutate({
            appliedToA: editing!.appliedToA,
            appliedToB: editing!.appliedToB,
            defaultValue: v,
            ...(note ? { note } : {}),
          })
        }
        loading={upsert.isPending}
      />
    </div>
  );
}

function Legend() {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-4 text-[11px] uppercase tracking-[0.16em]">
      <Swatch className="bg-success-soft text-success" label="Allowed" />
      <Swatch className="bg-danger-soft text-danger" label="Disallowed" />
      <Swatch className="bg-info-soft text-info" label="Always allowed (locked)" />
    </div>
  );
}
function Swatch({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className={cn('inline-block size-3', className)} aria-hidden />
      <span className="text-ink-3">{label}</span>
    </span>
  );
}

function EditDialog({
  target,
  onClose,
  onSave,
  loading,
}: {
  target: ClubbingMatrixCell | null;
  onClose: () => void;
  onSave: (v: ClubbingDefault, note?: string) => void;
  loading: boolean;
}) {
  const [value, setValue] = useState<ClubbingDefault>(target?.defaultValue ?? 'allowed');
  const [note, setNote] = useState(target?.note ?? '');

  // Reset when target changes
  useEffectOnTarget(target, () => {
    setValue(target?.defaultValue ?? 'allowed');
    setNote(target?.note ?? '');
  });

  if (!target) return null;
  const isLocked = target.defaultValue === 'always_allowed';

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {APPLIED_TO_LABELS[target.appliedToA]} × {APPLIED_TO_LABELS[target.appliedToB]}
          </DialogTitle>
          <DialogDescription>
            Set the default rule for this pair. Per-promotion overrides can refine the rule
            (unless the value is <em>always allowed</em>, which is locked).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label required>Rule</Label>
            <Select value={value} onValueChange={(v) => setValue(v as ClubbingDefault)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="allowed">Allowed</SelectItem>
                <SelectItem value="disallowed">Disallowed</SelectItem>
                <SelectItem value="always_allowed">Always allowed (locked)</SelectItem>
              </SelectContent>
            </Select>
            {isLocked && value !== 'always_allowed' && (
              <p className="mt-1.5 text-[12px] text-danger">
                · This pair is locked. Cannot be downgraded.
              </p>
            )}
          </div>
          <div>
            <Label hint="Optional context">Note</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why this rule?" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant="ink"
            caps
            loading={loading}
            disabled={isLocked && value !== 'always_allowed'}
            onClick={() => onSave(value, note.trim() || undefined)}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useEffect } from 'react';
function useEffectOnTarget<T>(t: T, fn: () => void) {
  // Reset edit state whenever a new target is opened.
  useEffect(() => {
    fn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);
}
