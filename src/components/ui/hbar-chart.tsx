import { cn } from '@/lib/cn';

export type HBarRow = {
  label: string;
  value: number;
  /** Right-aligned pretty value; defaults to String(value). */
  display?: string;
  /** Small grey annotation after the label (e.g. "12 orders"). */
  sub?: string;
  /** Per-row colour override. */
  color?: string;
};

/**
 * Ranked horizontal bar list — the right chart for "top N" reports
 * (best sellers, revenue contributors, return rates). HTML/CSS rather than
 * SVG: rows stay readable at any width, labels never truncate into an axis.
 */
export function HBarChart({
  rows,
  color = 'var(--color-ink)',
  className,
}: {
  rows: HBarRow[];
  color?: string;
  className?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.value)));
  return (
    <div className={cn('space-y-2.5', className)}>
      {rows.map((r, i) => {
        const pct = Math.max(1.5, (Math.abs(r.value) / max) * 100);
        return (
          <div key={`${r.label}-${i}`} className="group">
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-[12.5px] text-ink">
                <span className="mr-1.5 font-mono text-[11px] text-ink-4">
                  {String(i + 1).padStart(2, '0')}
                </span>
                {r.label}
                {r.sub && <span className="ml-1.5 text-[11px] text-ink-4">{r.sub}</span>}
              </span>
              <span className="shrink-0 font-mono text-[12.5px] tabular-nums text-ink">
                {r.display ?? String(r.value)}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-bg-3">
              <div
                className="h-full rounded-full transition-[width] duration-500 ease-out"
                style={{ width: `${pct}%`, background: r.color ?? color, opacity: 0.9 }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
