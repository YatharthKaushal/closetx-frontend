import { useEffect, useState } from 'react';
import { Columns3, Check } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

export type ColumnSpec<K extends string> = {
  key: K;
  label: string;
  /** If true, column is hidden by default until user opts in. */
  defaultHidden?: boolean;
  /** If true, column is always visible and cannot be hidden. */
  alwaysOn?: boolean;
};

/**
 * Hook for managing column visibility with localStorage persistence.
 * Returns a Set of visible column keys + helpers.
 */
export function useColumnVisibility<K extends string>(
  storageKey: string,
  columns: ReadonlyArray<ColumnSpec<K>>,
) {
  const defaultVisible = (): Set<K> =>
    new Set(columns.filter((c) => c.alwaysOn || !c.defaultHidden).map((c) => c.key));

  const [visible, setVisible] = useState<Set<K>>(() => {
    if (typeof window === 'undefined') return defaultVisible();
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return defaultVisible();
      const parsed = JSON.parse(raw) as K[];
      const next = new Set<K>();
      for (const c of columns) {
        if (c.alwaysOn || parsed.includes(c.key)) next.add(c.key);
      }
      return next;
    } catch {
      return defaultVisible();
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(Array.from(visible)));
    } catch {
      /* ignore quota errors */
    }
  }, [storageKey, visible]);

  function toggle(key: K) {
    setVisible((prev) => {
      const spec = columns.find((c) => c.key === key);
      if (spec?.alwaysOn) return prev;
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function reset() {
    setVisible(defaultVisible());
  }

  return {
    isVisible: (k: K) => visible.has(k),
    toggle,
    reset,
  };
}

export function ColumnPicker<K extends string>({
  columns,
  isVisible,
  onToggle,
  onReset,
}: {
  columns: ReadonlyArray<ColumnSpec<K>>;
  isVisible: (k: K) => boolean;
  onToggle: (k: K) => void;
  onReset: () => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" iconLeft={<Columns3 className="size-3.5" />}>
          Columns
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-1">
        <div className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-3">
          Visible columns
        </div>
        {columns.map((c) => {
          const checked = isVisible(c.key);
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => onToggle(c.key)}
              disabled={c.alwaysOn}
              className={cn(
                'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-[13px] hover:bg-bg-2',
                c.alwaysOn && 'cursor-not-allowed opacity-60',
              )}
            >
              <Check className={cn('size-3.5 text-ink-3', !checked && 'invisible')} />
              <span className="flex-1 text-ink">{c.label}</span>
              {c.alwaysOn && <span className="text-[10.5px] text-ink-4">always</span>}
            </button>
          );
        })}
        <div className="my-1 border-t border-line" />
        <button
          type="button"
          onClick={onReset}
          className="w-full rounded-sm px-2 py-1.5 text-left text-[12px] text-ink-3 hover:bg-bg-2"
        >
          Reset to default
        </button>
      </PopoverContent>
    </Popover>
  );
}
