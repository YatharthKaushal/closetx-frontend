/**
 * Variant axis building blocks shared by the product wizard's variant step.
 * Extracted from the old listing-detail CreateVariantsDialog.
 */
import { useState } from 'react';
import { X } from 'lucide-react';
import type { AttributeAxisType } from '@/lib/types';
import { Input } from '@/components/ui/input';

export type AxisState = {
  name: string;
  type: AttributeAxisType;
  allowedValues: string[];
  selectedValues: string[];
};

export type RowFields = { price: string; compareAt: string; stock: string; sku: string };

/** Cartesian product of each axis's selected values. */
export function cartesian(axesValues: string[][]): string[][] {
  return axesValues.reduce<string[][]>(
    (acc, values) => acc.flatMap((combo) => values.map((v) => [...combo, v])),
    [[]],
  );
}

export function AxisValueEditor({
  axis,
  fromTemplate,
  onNameChange,
  onToggleEnum,
  onSetFree,
  onRemove,
}: {
  axis: AxisState;
  fromTemplate: boolean;
  onNameChange: (name: string) => void;
  onToggleEnum: (value: string) => void;
  onSetFree: (values: string[]) => void;
  onRemove: () => void;
}) {
  const [freeInput, setFreeInput] = useState('');

  function addFreeValue() {
    const val = freeInput.trim();
    if (val && !axis.selectedValues.includes(val)) {
      onSetFree([...axis.selectedValues, val]);
    }
    setFreeInput('');
  }

  function handleFreeKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addFreeValue();
    } else if (e.key === 'Backspace' && !freeInput && axis.selectedValues.length > 0) {
      onSetFree(axis.selectedValues.slice(0, -1));
    }
  }

  return (
    <div className="rounded-lg border border-line bg-bg-2/20 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {fromTemplate ? (
            <div className="text-[13px] font-medium text-ink">{axis.name}</div>
          ) : (
            <Input
              placeholder="Axis name (e.g. Size)"
              value={axis.name}
              onChange={(e) => onNameChange(e.target.value)}
              className="h-7 text-[12px]"
            />
          )}
          <span className="text-[11px] capitalize text-ink-4">{axis.type.replace('_', ' ')}</span>
        </div>
        {!fromTemplate && (
          <button type="button" onClick={onRemove} className="mt-0.5 text-ink-3 hover:text-danger">
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {axis.type === 'enum' && axis.allowedValues.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {axis.allowedValues.map((v) => {
            const selected = axis.selectedValues.includes(v);
            return (
              <button
                key={v}
                type="button"
                onClick={() => onToggleEnum(v)}
                className={`rounded-md border px-2.5 py-1 text-[12px] transition-colors ${
                  selected
                    ? 'border-ink bg-ink text-paper'
                    : 'border-line bg-bg text-ink-2 hover:border-ink-3'
                }`}
              >
                {v}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="flex min-h-[36px] flex-wrap items-center gap-1.5 rounded-md border border-line bg-bg px-2 py-1.5">
          {axis.selectedValues.map((v, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 rounded-sm bg-ink/8 px-2 py-0.5 text-[12px] text-ink-2"
            >
              {v}
              <button
                type="button"
                onClick={() => onSetFree(axis.selectedValues.filter((_, j) => j !== i))}
                className="ml-0.5 text-ink-4 hover:text-danger"
              >
                <X className="size-2.5" />
              </button>
            </span>
          ))}
          <input
            value={freeInput}
            onChange={(e) => setFreeInput(e.target.value)}
            onKeyDown={handleFreeKeyDown}
            placeholder={axis.selectedValues.length === 0 ? 'Type a value and press Enter' : '+ add'}
            className="min-w-16 flex-1 bg-transparent text-[12px] text-ink outline-none placeholder:text-ink-4"
          />
        </div>
      )}
    </div>
  );
}
