/** Multi-select occasion tags (max 10). */
import { toast } from 'sonner';

const OCCASION_PRESETS = [
  'casual', 'formal', 'work', 'party', 'festive',
  'sports', 'ethnic', 'wedding', 'beach', 'lounge',
] as const;

export function OccasionChipPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const toggle = (occ: string) => {
    if (value.includes(occ)) onChange(value.filter((v) => v !== occ));
    else if (value.length < 10) onChange([...value, occ]);
    else toast.error('At most 10 occasions allowed');
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      {OCCASION_PRESETS.map((occ) => {
        const selected = value.includes(occ);
        return (
          <button
            key={occ}
            type="button"
            onClick={() => toggle(occ)}
            className={
              'rounded-full border px-3 py-1 text-[12px] capitalize transition-colors ' +
              (selected
                ? 'border-accent bg-accent text-accent-fg'
                : 'border-line bg-bg text-ink-2 hover:border-line-2')
            }
          >
            {occ}
          </button>
        );
      })}
    </div>
  );
}
