import { cn } from '@/lib/cn';

type Option<T extends string> = { value: T; label: React.ReactNode };

type SegmentedProps<T extends string> = {
  options: Option<T>[];
  value: T;
  onChange: (next: T) => void;
  size?: 'sm' | 'md';
  className?: string;
};

/**
 * Segmented control — pill background with a sliding-style ink fill on the
 * active option. Used inside chart headers and tab-y filters where a full
 * Tabs primitive would be heavy.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = 'sm',
  className,
}: SegmentedProps<T>) {
  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-bg-3 p-1',
        className,
      )}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            type="button"
            role="tab"
            aria-selected={active}
            key={o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              'rounded-full font-medium transition-colors press',
              size === 'sm' ? 'h-7 px-3 text-[12px]' : 'h-8 px-3.5 text-[13px]',
              active
                ? 'bg-ink text-bg shadow-xs'
                : 'text-ink-3 hover:text-ink',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
