import { useMemo, useState } from 'react';
import { cn } from '@/lib/cn';

type BarChartProps = {
  /** X-axis tick labels, one per bar. */
  labels: string[];
  values: number[];
  /** Pretty-print a y-axis / tooltip value. */
  formatY?: (n: number) => string;
  /** Bar fill; any CSS colour. Negative bars always paint danger. */
  color?: string;
  height?: number;
  className?: string;
};

/**
 * Vertical bar chart as inline SVG — sibling of LineChart (same grid, axis
 * type, hover tooltip). Right chart for discrete buckets: weekly revenue,
 * payout cycles. Handles negative values (bars hang below the zero line).
 */
export function BarChart({
  labels,
  values,
  formatY = (n) => String(n),
  color = 'var(--color-ink)',
  height = 240,
  className,
}: BarChartProps) {
  const [hover, setHover] = useState<number | null>(null);

  const width = 800;
  const padTop = 12;
  const padBottom = 32;
  const padLeft = 48;
  const padRight = 16;
  const innerW = width - padLeft - padRight;
  const innerH = height - padTop - padBottom;

  const { yMin, yMax, yTicks } = useMemo(() => {
    if (values.length === 0) return { yMin: 0, yMax: 1, yTicks: [0, 0.5, 1] };
    const lo = Math.min(0, ...values);
    const hi = Math.max(0, ...values);
    const range = Math.max(1, hi - lo);
    const top = hi + range * 0.1;
    const bottom = lo < 0 ? lo - range * 0.1 : 0;
    const step = (top - bottom) / 4;
    return {
      yMin: bottom,
      yMax: top,
      yTicks: [bottom, bottom + step, bottom + 2 * step, bottom + 3 * step, top],
    };
  }, [values]);

  const y = (v: number) => padTop + innerH * (1 - (v - yMin) / Math.max(0.0001, yMax - yMin));
  const slot = innerW / Math.max(1, labels.length);
  const barW = Math.min(48, slot * 0.62);
  const xCenter = (i: number) => padLeft + slot * i + slot / 2;
  const zeroY = y(0);

  // Avoid label soup on dense charts — show at most ~10 x labels.
  const labelEvery = Math.max(1, Math.ceil(labels.length / 10));

  return (
    <div className={cn('relative w-full', className)} style={{ height }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - rect.left) / rect.width) * width;
          const i = Math.floor((px - padLeft) / slot);
          setHover(i >= 0 && i < labels.length ? i : null);
        }}
      >
        {yTicks.map((t, i) => (
          <line
            key={i}
            x1={padLeft}
            x2={width - padRight}
            y1={y(t)}
            y2={y(t)}
            stroke="var(--color-line)"
            strokeDasharray="3 4"
            strokeWidth="1"
            opacity={i === 0 ? 0 : 1}
          />
        ))}
        {yTicks.map((t, i) => (
          <text
            key={i}
            x={padLeft - 8}
            y={y(t) + 4}
            textAnchor="end"
            className="fill-ink-4"
            style={{ fontSize: 11, fontFamily: 'var(--font-sans)' }}
          >
            {formatY(t)}
          </text>
        ))}
        {labels.map((label, i) =>
          i % labelEvery === 0 ? (
            <text
              key={i}
              x={xCenter(i)}
              y={height - 10}
              textAnchor="middle"
              className="fill-ink-4"
              style={{ fontSize: 11, fontFamily: 'var(--font-sans)' }}
            >
              {label}
            </text>
          ) : null,
        )}

        {values.map((v, i) => {
          const top = v >= 0 ? y(v) : zeroY;
          const h = Math.max(1.5, Math.abs(y(v) - zeroY));
          return (
            <rect
              key={i}
              x={xCenter(i) - barW / 2}
              y={top}
              width={barW}
              height={h}
              rx={3}
              fill={v < 0 ? 'var(--color-danger)' : color}
              opacity={hover === null || hover === i ? 0.92 : 0.35}
              style={{ transition: 'opacity 120ms ease' }}
            />
          );
        })}

        {/* zero baseline when negatives exist */}
        {yMin < 0 && (
          <line
            x1={padLeft}
            x2={width - padRight}
            y1={zeroY}
            y2={zeroY}
            stroke="var(--color-line-strong)"
            strokeWidth="1"
          />
        )}
      </svg>

      {hover != null && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 surface-card px-3 py-2 text-[12px] shadow-md"
          style={{ left: `${(xCenter(hover) / width) * 100}%`, top: '6%', minWidth: 110 }}
        >
          <div className="kicker mb-0.5">{labels[hover]}</div>
          <div className="font-medium text-ink tabular">{formatY(values[hover] ?? 0)}</div>
        </div>
      )}
    </div>
  );
}
