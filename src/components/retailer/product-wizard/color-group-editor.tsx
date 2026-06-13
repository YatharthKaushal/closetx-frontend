import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Copy, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import type { SizeScale } from '@/lib/types';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ColorSwatchPicker } from './color-swatch-picker';
import { SizePresetChips } from './size-preset-chips';
import { VariantRow } from './variant-row';
import { nextGroupKey, type GroupDraft, type SizeDraft } from './types';

/**
 * The system color → sizes editor. One collapsible card per color: a size
 * chip picker on top (size systems resolved from the listing's category —
 * UK/US/EU for footwear, Letter/Waist for apparel, …), one VariantRow per
 * size beneath, and a copy-across convenience that stamps the first size's
 * price/MRP/stock onto the rest. Colors carry a free-form label plus an
 * optional exact-hex swatch.
 */
export function ColorGroupEditor({
  groups,
  setGroups,
  gallery,
  listingId,
  categoryId,
  onReload,
}: {
  groups: GroupDraft[];
  setGroups: (g: GroupDraft[]) => void;
  gallery: string[];
  listingId: string | null;
  categoryId: string | null;
  onReload: () => void;
}) {
  const [newColor, setNewColor] = useState('');
  const [newHex, setNewHex] = useState<string | null>(null);

  // Category-aware size systems; universal scales come back even without a category.
  const scalesQ = useQuery({
    queryKey: ['catalog', 'size-scales', categoryId],
    queryFn: () =>
      api<SizeScale[]>(`/catalog/size-scales${categoryId ? `?categoryId=${categoryId}` : ''}`),
  });
  const scales = scalesQ.data ?? [];

  function addColor() {
    const name = newColor.trim();
    if (!name) return;
    if (groups.some((g) => g.name.toLowerCase() === name.toLowerCase())) {
      toast.error(`Color "${name}" already exists`);
      return;
    }
    setGroups([
      ...groups,
      { clientKey: nextGroupKey(), name, colorHex: newHex, sortOrder: groups.length, sizes: [] },
    ]);
    setNewColor('');
    setNewHex(null);
  }

  function patchGroup(key: string, patch: Partial<GroupDraft>) {
    setGroups(groups.map((g) => (g.clientKey === key ? { ...g, ...patch } : g)));
  }

  function removeGroup(key: string) {
    const g = groups.find((x) => x.clientKey === key);
    if (!g) return;
    const savedWithStock = g.sizes.filter((s) => s.id && (s.stock ?? 0) > 0);
    if (savedWithStock.length > 0) {
      const okGo = window.confirm(
        `Removing "${g.name}" deletes ${g.sizes.length} size(s) including stock on hand. Continue?`,
      );
      if (!okGo) return;
    }
    setGroups(groups.filter((x) => x.clientKey !== key));
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-rule bg-paper-2/30 p-3">
        <div className="flex items-end gap-2">
          <div className="max-w-xs flex-1">
            <Label hint="your own naming — Black, Midnight Green…">Add a color</Label>
            <Input
              value={newColor}
              onChange={(e) => setNewColor(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addColor();
                }
              }}
              placeholder="e.g. Black, Navy, Starlight"
            />
          </div>
          <Button type="button" variant="outline" size="sm" iconLeft={<Plus className="size-3.5" />} onClick={addColor}>
            Add color
          </Button>
        </div>
        <div className="mt-2">
          <ColorSwatchPicker
            value={newHex}
            onChange={setNewHex}
            onSuggestName={(name) => {
              if (!newColor.trim()) setNewColor(name);
            }}
          />
        </div>
      </div>

      {groups.length === 0 ? (
        <p className="rounded-md border border-dashed border-rule px-4 py-6 text-center text-[13px] text-ink-3">
          Add a color above, then pick its sizes.
        </p>
      ) : (
        groups.map((g) => (
          <ColorGroupCard
            key={g.clientKey}
            group={g}
            otherNames={groups.filter((x) => x.clientKey !== g.clientKey).map((x) => x.name)}
            gallery={gallery}
            listingId={listingId}
            scales={scales}
            onChange={(patch) => patchGroup(g.clientKey, patch)}
            onRemove={() => removeGroup(g.clientKey)}
            onReload={onReload}
          />
        ))
      )}
    </div>
  );
}

function emptySize(size: string, template?: SizeDraft): SizeDraft {
  return {
    size,
    attributes: {},
    attributesLabel: size,
    sku: '',
    pricePaise: template?.pricePaise ?? null,
    compareAtPrice: template?.compareAtPrice ?? null,
    stock: template?.stock ?? 0,
    imageUrls: [],
    isActive: false,
  };
}

function ColorGroupCard({
  group,
  otherNames,
  gallery,
  listingId,
  scales,
  onChange,
  onRemove,
  onReload,
}: {
  group: GroupDraft;
  otherNames: string[];
  gallery: string[];
  listingId: string | null;
  scales: SizeScale[];
  onChange: (patch: Partial<GroupDraft>) => void;
  onRemove: () => void;
  onReload: () => void;
}) {
  const [open, setOpen] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [showSwatch, setShowSwatch] = useState(false);
  const [nameDraft, setNameDraft] = useState(group.name);

  const totalStock = group.sizes.reduce((sum, s) => sum + (s.stock ?? 0), 0);

  function commitName() {
    const name = nameDraft.trim();
    setEditingName(false);
    if (!name || name === group.name) {
      setNameDraft(group.name);
      return;
    }
    if (otherNames.some((n) => n.toLowerCase() === name.toLowerCase())) {
      toast.error(`Color "${name}" already exists`);
      setNameDraft(group.name);
      return;
    }
    onChange({ name });
  }

  function addSize(size: string) {
    if (group.sizes.some((s) => s.size.toLowerCase() === size.toLowerCase())) return;
    const first = group.sizes[0];
    onChange({ sizes: [...group.sizes, emptySize(size, first)] });
  }

  function removeSize(size: string) {
    const row = group.sizes.find((s) => s.size.toLowerCase() === size.toLowerCase());
    if (!row) return;
    if (row.id && (row.stock ?? 0) > 0) {
      const okGo = window.confirm(
        `Removing size ${row.size} deletes its ${row.stock} unit(s) of stock. Continue?`,
      );
      if (!okGo) return;
    }
    onChange({ sizes: group.sizes.filter((s) => s !== row) });
  }

  function patchSize(idx: number, patch: Partial<SizeDraft>) {
    onChange({ sizes: group.sizes.map((s, i) => (i === idx ? { ...s, ...patch } : s)) });
  }

  function copyAcross() {
    const first = group.sizes[0];
    if (!first) return;
    onChange({
      sizes: group.sizes.map((s, i) =>
        i === 0
          ? s
          : { ...s, pricePaise: first.pricePaise, compareAtPrice: first.compareAtPrice, stock: first.stock },
      ),
    });
    toast.success(`Copied ${first.size}'s price · MRP · stock to all sizes`);
  }

  return (
    <div className="rounded-lg border border-rule bg-paper-2/30">
      <div className="flex items-center justify-between gap-2 px-3 py-2.5">
        <button
          type="button"
          onClick={() => setOpen((s) => !s)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          {open ? <ChevronDown className="size-3.5 shrink-0 text-ink-3" /> : <ChevronRight className="size-3.5 shrink-0 text-ink-3" />}
          <span
            className="size-4 shrink-0 rounded-sm border border-line"
            style={{ backgroundColor: group.colorHex ?? 'transparent' }}
            onClick={(e) => {
              e.stopPropagation();
              setShowSwatch((s) => !s);
              setOpen(true);
            }}
            title={group.colorHex ? `${group.colorHex} — click to change` : 'Set a swatch'}
          />
          {editingName ? (
            <Input
              value={nameDraft}
              autoFocus
              onChange={(e) => setNameDraft(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commitName();
                }
                if (e.key === 'Escape') {
                  setNameDraft(group.name);
                  setEditingName(false);
                }
              }}
              className="h-7 max-w-44 text-[13px]"
            />
          ) : (
            <span
              className="truncate text-[13.5px] font-medium text-ink hover:underline"
              onClick={(e) => {
                e.stopPropagation();
                setEditingName(true);
              }}
              title="Click to rename"
            >
              {group.name}
            </span>
          )}
          <span className="shrink-0 text-[11.5px] text-ink-3">
            {group.sizes.length} size{group.sizes.length === 1 ? '' : 's'} · {totalStock} in stock
          </span>
        </button>
        <button type="button" onClick={onRemove} className="shrink-0 text-ink-3 hover:text-danger" aria-label={`Remove color ${group.name}`}>
          <Trash2 className="size-3.5" />
        </button>
      </div>

      {open && (
        <div className="space-y-3 border-t border-rule/60 p-3">
          {showSwatch && (
            <div className="rounded-md border border-rule/60 bg-bg p-2.5">
              <ColorSwatchPicker
                value={group.colorHex}
                onChange={(hex) => onChange({ colorHex: hex })}
              />
            </div>
          )}

          <SizePresetChips
            scales={scales}
            selected={group.sizes.map((s) => s.size)}
            onAdd={addSize}
            onRemove={removeSize}
          />

          {group.sizes.length > 0 && (
            <div className="space-y-2">
              {group.sizes.map((s, i) => (
                <VariantRow
                  key={s.id ?? `${group.clientKey}-${s.size}`}
                  draft={{ ...s, attributesLabel: `${group.name} / ${s.size}` }}
                  gallery={gallery}
                  galleryLen={gallery.length}
                  listingId={listingId}
                  showLabel
                  onChange={(patch) => patchSize(i, patch)}
                  onRemove={() => removeSize(s.size)}
                  onPublished={onReload}
                />
              ))}
              {group.sizes.length > 1 && (
                <button
                  type="button"
                  onClick={copyAcross}
                  className={cn('inline-flex items-center gap-1.5 text-[12px] text-accent hover:underline')}
                >
                  <Copy className="size-3" /> Copy {group.sizes[0]!.size}'s price · MRP · stock to all sizes
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
