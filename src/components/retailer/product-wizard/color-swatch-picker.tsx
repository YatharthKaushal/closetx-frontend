import { useEffect, useState } from 'react';
import { Check, Pipette } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Swatch palette + exact-hex entry for a color group. The hex is decorative
 * metadata (drives swatch UI) — the group's NAME stays free-form so retailers
 * can follow their product line's naming ("Midnight Green", "Starlight").
 * Picking a palette swatch suggests its conventional name via `onSuggestName`
 * (parent applies it only when the label is still empty).
 */
const PALETTE: { hex: string; name: string }[] = [
  { hex: '#000000', name: 'Black' },
  { hex: '#FFFFFF', name: 'White' },
  { hex: '#808080', name: 'Grey' },
  { hex: '#C0A080', name: 'Beige' },
  { hex: '#8B4513', name: 'Brown' },
  { hex: '#DC2626', name: 'Red' },
  { hex: '#EA580C', name: 'Orange' },
  { hex: '#EAB308', name: 'Yellow' },
  { hex: '#16A34A', name: 'Green' },
  { hex: '#0D9488', name: 'Teal' },
  { hex: '#2563EB', name: 'Blue' },
  { hex: '#1E3A5F', name: 'Navy' },
  { hex: '#7C3AED', name: 'Purple' },
  { hex: '#DB2777', name: 'Pink' },
  { hex: '#7F1D1D', name: 'Maroon' },
  { hex: '#C0C0C0', name: 'Silver' },
];

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export function ColorSwatchPicker({
  value,
  onChange,
  onSuggestName,
}: {
  value: string | null;
  onChange: (hex: string | null) => void;
  onSuggestName?: ((name: string) => void) | undefined;
}) {
  const [hexInput, setHexInput] = useState(value ?? '');

  // Keep the text field in sync when the value changes from outside
  // (palette click, native picker, parent reset).
  useEffect(() => {
    setHexInput(value ?? '');
  }, [value]);

  function commitHex(raw: string) {
    const v = raw.trim();
    if (v === '') {
      onChange(null);
      return;
    }
    const withHash = v.startsWith('#') ? v : `#${v}`;
    if (HEX_RE.test(withHash)) onChange(withHash.toUpperCase());
    else setHexInput(value ?? '');
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {PALETTE.map((p) => {
          const isOn = value?.toUpperCase() === p.hex.toUpperCase();
          return (
            <button
              key={p.hex}
              type="button"
              title={p.name}
              onClick={() => {
                onChange(p.hex);
                onSuggestName?.(p.name);
              }}
              className={cn(
                'grid size-7 place-items-center rounded-md border transition-shadow',
                isOn ? 'border-ink ring-2 ring-ink/30' : 'border-line hover:border-ink-3',
              )}
              style={{ backgroundColor: p.hex }}
            >
              {isOn && (
                <Check
                  className="size-3.5"
                  style={{ color: ['#FFFFFF', '#EAB308', '#C0C0C0', '#C0A080'].includes(p.hex) ? '#000' : '#fff' }}
                />
              )}
            </button>
          );
        })}
        {/* Exact-color option: native eyedropper-style picker. */}
        <label
          title="Pick an exact color"
          className="relative grid size-7 cursor-pointer place-items-center rounded-md border border-dashed border-line text-ink-3 hover:border-ink-3 hover:text-ink"
        >
          <Pipette className="size-3.5" />
          <input
            type="color"
            value={value && HEX_RE.test(value) ? value : '#888888'}
            onChange={(e) => onChange(e.target.value.toUpperCase())}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
            aria-label="Pick an exact color"
          />
        </label>
      </div>

      <div className="flex items-center gap-2">
        <span
          className="size-6 shrink-0 rounded-md border border-line"
          style={{ backgroundColor: value && HEX_RE.test(value) ? value : 'transparent' }}
          title={value ?? 'No swatch'}
        />
        <input
          value={hexInput}
          onChange={(e) => setHexInput(e.target.value)}
          onBlur={(e) => commitHex(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitHex(hexInput);
            }
          }}
          placeholder="#1E3A5F"
          spellCheck={false}
          className="w-24 rounded-md border border-line bg-bg px-2 py-1 font-mono text-[12px] text-ink outline-none placeholder:text-ink-4 focus:border-ink-3"
        />
        <span className="text-[11px] text-ink-4">optional — exact hex for the swatch</span>
      </div>
    </div>
  );
}
