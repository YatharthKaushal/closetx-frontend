import { useState } from 'react';
import { X } from 'lucide-react';
import type { SizeScale } from '@/lib/types';
import { cn } from '@/lib/cn';

/**
 * Size entry for one color: a scale picker (category-aware — Footwear shows
 * UK / US / EU, Apparel shows Letter / Waist / Kids, Accessories shows
 * inch / weight scales, served by /catalog/size-scales) with toggleable value
 * chips, plus a free-text input for non-standard sizes. Selected sizes render
 * as removable chips regardless of where they came from.
 */
export function SizePresetChips({
  scales,
  selected,
  onAdd,
  onRemove,
}: {
  scales: SizeScale[];
  selected: string[];
  onAdd: (size: string) => void;
  onRemove: (size: string) => void;
}) {
  const [scaleId, setScaleId] = useState<string | null>(null);
  const [free, setFree] = useState('');
  const active = scales.find((s) => s.id === scaleId) ?? scales[0];
  const selectedLower = new Set(selected.map((s) => s.toLowerCase()));

  function addFree() {
    const val = free.trim();
    if (val && !selectedLower.has(val.toLowerCase())) onAdd(val);
    setFree('');
  }

  return (
    <div className="space-y-2">
      {scales.length > 1 && (
        <div className="flex flex-wrap items-center gap-1">
          {scales.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setScaleId(s.id)}
              className={cn(
                'rounded-full px-2.5 py-0.5 text-[11px] transition-colors',
                s.id === (active?.id ?? '') ? 'bg-ink text-paper' : 'bg-bg-3 text-ink-3 hover:text-ink',
              )}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      {active && (
        <div className="flex flex-wrap gap-1.5">
          {active.values.map((v) => {
            const isOn = selectedLower.has(v.toLowerCase());
            return (
              <button
                key={v}
                type="button"
                onClick={() => (isOn ? onRemove(v) : onAdd(v))}
                className={cn(
                  'rounded-md border px-2.5 py-1 text-[12px] transition-colors',
                  isOn ? 'border-ink bg-ink text-paper' : 'border-line bg-bg text-ink-2 hover:border-ink-3',
                )}
              >
                {v}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex min-h-[34px] flex-wrap items-center gap-1.5 rounded-md border border-line bg-bg px-2 py-1.5">
        {selected.map((s) => (
          <span
            key={s}
            className="inline-flex items-center gap-1 rounded-sm bg-ink/8 px-2 py-0.5 text-[12px] text-ink-2"
          >
            {s}
            <button
              type="button"
              onClick={() => onRemove(s)}
              className="ml-0.5 text-ink-4 hover:text-danger"
              aria-label={`Remove size ${s}`}
            >
              <X className="size-2.5" />
            </button>
          </span>
        ))}
        <input
          value={free}
          onChange={(e) => setFree(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              addFree();
            }
          }}
          onBlur={addFree}
          placeholder={selected.length === 0 ? 'Pick sizes above or type your own' : '+ add a size'}
          className="min-w-24 flex-1 bg-transparent text-[12px] text-ink outline-none placeholder:text-ink-4"
        />
      </div>
    </div>
  );
}
