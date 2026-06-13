import { cn } from '@/lib/cn';

export type WaterfallStep = {
  label: string;
  /** Paise. Positive = addition, negative = deduction. Special: first step is the starting Gross (always treated positive); last step is the final Net (always treated as total). */
  amountPaise: number;
  kind: 'start' | 'deduction' | 'addition' | 'total';
};

function formatPaiseShort(paise: number): string {
  if (!Number.isFinite(paise)) return '—';
  const rupees = paise / 100;
  const abs = Math.abs(rupees);
  if (abs >= 1_00_00_000) return `₹${(rupees / 1_00_00_000).toFixed(2)}Cr`;
  if (abs >= 1_00_000) return `₹${(rupees / 1_00_000).toFixed(2)}L`;
  if (abs >= 1_000) return `₹${(rupees / 1_000).toFixed(1)}k`;
  return `₹${rupees.toFixed(0)}`;
}

function ariaSummary(steps: WaterfallStep[]): string {
  const start = steps.find((s) => s.kind === 'start');
  const total = steps.find((s) => s.kind === 'total');
  if (!start || !total) return 'Payout breakdown';
  return `Payout breakdown: ${start.label} ${formatPaiseShort(start.amountPaise)} to ${total.label} ${formatPaiseShort(total.amountPaise)}`;
}

/**
 * Stacked-bar waterfall — each step renders a colored block whose width
 * is proportional to its amount relative to the start value. Visually shows
 * "Gross → minus X → minus Y → plus Z → Net" in one glance.
 *
 * Guards:
 *  - Non-finite amounts render as a thin gray placeholder.
 *  - Zero or unknown start → all bars are placeholder width.
 *  - Negative total (overpayment) renders in warning tone with a `−` prefix.
 */
export function WaterfallChart({ steps, className }: { steps: WaterfallStep[]; className?: string }) {
  const start = steps.find((s) => s.kind === 'start')?.amountPaise;
  const max = Number.isFinite(start) && (start as number) > 0 ? (start as number) : 0;

  return (
    <div
      className={cn('space-y-2', className)}
      role="img"
      aria-label={ariaSummary(steps)}
    >
      {steps.map((s, i) => {
        const finite = Number.isFinite(s.amountPaise);
        const pct = finite && max > 0 ? Math.min(100, (Math.abs(s.amountPaise) / max) * 100) : 0;
        const negativeTotal = s.kind === 'total' && finite && s.amountPaise < 0;
        const tone = !finite
          ? 'bg-bg-3'
          : s.kind === 'start'
            ? 'bg-ink'
            : s.kind === 'total'
              ? negativeTotal ? 'bg-warning' : 'bg-success'
              : s.kind === 'addition'
                ? 'bg-info'
                : 'bg-danger';
        const sign = !finite
          ? ''
          : s.kind === 'deduction'
            ? '−'
            : s.kind === 'addition'
              ? '+'
              : negativeTotal
                ? '−'
                : '';
        const displayAmount = finite ? Math.abs(s.amountPaise) : NaN;
        return (
          <div key={`${s.label}-${i}`} className="flex items-center gap-3">
            <div className="w-32 shrink-0 text-[12px] text-ink-3">{s.label}</div>
            <div className="flex-1 h-7 rounded-md bg-bg-2 overflow-hidden">
              <div
                className={cn('h-full transition-[width] duration-300', tone)}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="w-28 shrink-0 text-right font-mono text-[12px] tabular-nums text-ink">
              {sign}
              {formatPaiseShort(displayAmount)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
