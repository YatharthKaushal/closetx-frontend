import { AGE_RANGES } from '@/lib/types';
import { cn } from '@/lib/cn';

/**
 * Multi-select chips for the numeric age ranges a product targets.
 * Empty selection = unspecified (shown to shoppers as ageless).
 */
export function AgeRangeChips({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const selected = new Set(value);
  return (
    <div className="flex flex-wrap gap-1.5">
      {AGE_RANGES.map((r) => {
        const isOn = selected.has(r);
        return (
          <button
            key={r}
            type="button"
            onClick={() =>
              onChange(isOn ? value.filter((v) => v !== r) : [...value, r])
            }
            className={cn(
              'rounded-md border px-2.5 py-1 text-[12px] transition-colors',
              isOn ? 'border-ink bg-ink text-paper' : 'border-line bg-bg text-ink-2 hover:border-ink-3',
            )}
          >
            {r === '40+' ? '40+ yrs' : `${r} yrs`}
          </button>
        );
      })}
    </div>
  );
}
