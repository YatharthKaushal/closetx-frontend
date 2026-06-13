import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Layers, Package, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import type { Listing, VariantGroup } from '@/lib/types';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ColorGroupEditor } from './color-group-editor';
import { CustomOptionsBuilder } from './custom-options-builder';
import { VariantRow } from './variant-row';
import type { GroupDraft, VariantDraft, VariantMode } from './types';

type Props = {
  listing: Listing | null;
  listingId: string | null;
  gallery: string[];
  mode: VariantMode;
  setMode: (m: VariantMode) => void;
  groups: GroupDraft[];
  setGroups: (g: GroupDraft[]) => void;
  variants: VariantDraft[];
  setVariants: (v: VariantDraft[]) => void;
  onReload: () => void;
};

/** Fields shared by create payloads, diffed for patches. */
function variantPatchBody(draft: VariantDraft, orig: NonNullable<Listing['variants']>[number]) {
  const body: Record<string, unknown> = {};
  if (draft.pricePaise !== null && draft.pricePaise !== orig.pricePaise) body.pricePaise = draft.pricePaise;
  if (draft.compareAtPrice !== orig.compareAtPrice) body.compareAtPrice = draft.compareAtPrice;
  if ((draft.stock ?? 0) !== orig.stock) body.stock = draft.stock ?? 0;
  if (draft.sku.trim() && draft.sku.trim() !== (orig.sku ?? '')) body.sku = draft.sku.trim();
  if (JSON.stringify(draft.imageUrls) !== JSON.stringify(orig.imageUrls)) body.imageUrls = draft.imageUrls;
  return body;
}

export function StepVariants(props: Props) {
  const { listing, listingId, gallery, mode, setMode, groups, setGroups, variants, setVariants, onReload } = props;
  const qc = useQueryClient();
  const [confirmReplace, setConfirmReplace] = useState<VariantMode | null>(null);

  const serverMode = listing?.variantMode ?? 'single';
  const serverVariants = listing?.variants ?? [];
  const serverGroups: VariantGroup[] = listing?.variantGroups ?? [];
  const namedServerGroups = serverGroups.filter((g) => !g.isDefault);

  // Single mode always has exactly one editable draft — seed it on first render
  // of a fresh listing so the pricing row is immediately visible.
  useEffect(() => {
    if (mode === 'single' && variants.length === 0) {
      setVariants([
        {
          attributes: {},
          attributesLabel: 'Default',
          sku: '',
          pricePaise: null,
          compareAtPrice: null,
          stock: 0,
          imageUrls: [],
          isActive: false,
        },
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, variants.length]);

  // ── Mode switching ───────────────────────────────────────────────────────
  function requestMode(next: VariantMode) {
    if (next === mode) return;
    // Destructive when saved variants exist under a different structure.
    const hasSaved = serverVariants.length > 0;
    if (hasSaved && serverMode !== next) {
      setConfirmReplace(next);
      return;
    }
    applyMode(next);
  }

  function applyMode(next: VariantMode) {
    setConfirmReplace(null);
    setMode(next);
    if (next === 'single' && variants.filter((v) => !v.id).length === 0) {
      // Carry the first existing price/stock into the default draft as a prefill.
      const first = groups[0]?.sizes[0] ?? variants[0];
      setVariants([
        {
          attributes: {},
          attributesLabel: 'Default',
          sku: '',
          pricePaise: first?.pricePaise ?? null,
          compareAtPrice: first?.compareAtPrice ?? null,
          stock: first?.stock ?? 0,
          imageUrls: [],
          isActive: false,
        },
      ]);
    }
    if (next === 'color_size' && groups.length === 0) {
      setGroups([]);
    }
    if (next === 'custom') {
      // Start the flat editor from scratch (or keep unsaved flat drafts).
      setVariants(variants.filter((v) => !v.id));
    }
  }

  // ── Save (one reconciler per mode) ───────────────────────────────────────
  const save = useMutation({
    mutationFn: async () => {
      if (!listingId) throw new Error('Save the product first');

      if (mode === 'single') return saveSingle();
      if (mode === 'color_size') return saveGrouped();
      return saveCustom();
    },
    onSuccess: () => {
      toast.success('Variants saved');
      onReload();
      void qc.invalidateQueries({ queryKey: ['retailer', 'listings'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not save variants'),
  });

  async function saveSingle() {
    const draft = variants[0];
    if (!draft) throw new Error('Set a price first');
    if (draft.pricePaise === null) throw new Error('Set a selling price');
    // Clear any color groups left over from a previous structure (cascades sizes).
    for (const g of namedServerGroups) {
      await api(`/retailer/groups/${g.id}`, { method: 'DELETE' });
    }
    if (serverMode !== 'single') {
      await api(`/retailer/listings/${listingId}`, { method: 'PATCH', body: { variantMode: 'single' } });
    }
    await api(`/retailer/listings/${listingId}/default-variant`, {
      method: 'PUT',
      body: {
        pricePaise: draft.pricePaise,
        compareAtPrice: draft.compareAtPrice,
        stock: draft.stock ?? 0,
        ...(draft.sku.trim() ? { sku: draft.sku.trim() } : {}),
        imageUrls: draft.imageUrls,
      },
    });
  }

  async function saveGrouped() {
    // Validate before any network call.
    const nameSeen = new Set<string>();
    for (const g of groups) {
      const key = g.name.trim().toLowerCase();
      if (!key) throw new Error('Every color needs a name');
      if (nameSeen.has(key)) throw new Error(`Color "${g.name}" appears twice`);
      nameSeen.add(key);
      const sizeSeen = new Set<string>();
      for (const s of g.sizes) {
        const sk = s.size.toLowerCase();
        if (sizeSeen.has(sk)) throw new Error(`Size ${s.size} appears twice under ${g.name}`);
        sizeSeen.add(sk);
        if (s.pricePaise === null) throw new Error(`Set a price for ${g.name} / ${s.size}`);
        if (s.compareAtPrice !== null && s.compareAtPrice <= s.pricePaise) {
          throw new Error(`MRP must exceed selling price on ${g.name} / ${s.size}`);
        }
      }
    }
    if (groups.every((g) => g.sizes.length === 0)) {
      throw new Error('Add at least one size');
    }

    if (serverMode !== 'color_size') {
      await api(`/retailer/listings/${listingId}`, { method: 'PATCH', body: { variantMode: 'color_size' } });
    }

    // 1. Create new groups, writing server ids back (retry-safe).
    const next = groups.map((g) => ({ ...g, sizes: [...g.sizes] }));
    for (const g of next) {
      if (!g.id) {
        const created = await api<VariantGroup>(`/retailer/listings/${listingId}/groups`, {
          method: 'POST',
          body: {
            name: g.name.trim(),
            sortOrder: g.sortOrder,
            ...(g.colorHex ? { colorHex: g.colorHex } : {}),
          },
        });
        g.id = created.id;
      }
    }
    setGroups(next);

    // 2. Patch renamed / recolored / reordered groups.
    const serverGroupById = new Map(serverGroups.map((g) => [g.id, g]));
    for (const g of next) {
      const orig = serverGroupById.get(g.id!);
      if (!orig) continue;
      const body: Record<string, unknown> = {};
      if (g.name.trim() !== orig.name) body.name = g.name.trim();
      if ((g.colorHex ?? null) !== (orig.colorHex ?? null)) body.colorHex = g.colorHex;
      if (g.sortOrder !== orig.sortOrder) body.sortOrder = g.sortOrder;
      if (Object.keys(body).length > 0) {
        await api(`/retailer/groups/${g.id}`, { method: 'PATCH', body });
      }
    }

    // 3. Delete server variants no longer present in any draft — unless their
    //    whole group is going away (step 5's cascade handles those).
    const keptVariantIds = new Set(next.flatMap((g) => g.sizes.filter((s) => s.id).map((s) => s.id!)));
    const keptGroupIds = new Set(next.map((g) => g.id!));
    const groupsToDelete = serverGroups.filter((g) => !g.isDefault && !keptGroupIds.has(g.id));
    const cascading = new Set(groupsToDelete.map((g) => g.id));
    for (const v of serverVariants) {
      if (!keptVariantIds.has(v.id) && !cascading.has(v.groupId)) {
        await api(`/retailer/variants/${v.id}`, { method: 'DELETE' });
      }
    }

    // 4. Create / patch size variants per group.
    const serverVariantById = new Map(serverVariants.map((v) => [v.id, v]));
    for (const g of next) {
      for (const s of g.sizes) {
        if (!s.id) {
          await api(`/retailer/listings/${listingId}/groups/${g.id}/variants`, {
            method: 'POST',
            body: {
              size: s.size,
              pricePaise: s.pricePaise,
              ...(s.compareAtPrice !== null ? { compareAtPrice: s.compareAtPrice } : {}),
              stock: s.stock ?? 0,
              ...(s.sku.trim() ? { sku: s.sku.trim() } : {}),
              imageUrls: s.imageUrls,
            },
          });
        } else {
          const orig = serverVariantById.get(s.id);
          if (!orig) continue;
          const body = variantPatchBody(s, orig);
          if (orig.groupId !== g.id) body.groupId = g.id;
          if (Object.keys(body).length > 0) {
            await api(`/retailer/variants/${s.id}`, { method: 'PATCH', body });
          }
        }
      }
    }

    // 5. Delete groups removed in the editor (children cascade server-side).
    for (const g of groupsToDelete) {
      await api(`/retailer/groups/${g.id}`, { method: 'DELETE' });
    }
  }

  async function saveCustom() {
    if (serverMode !== 'custom') {
      await api(`/retailer/listings/${listingId}`, { method: 'PATCH', body: { variantMode: 'custom' } });
    }
    // Clear color groups from a previous structure (cascades their sizes).
    const cascading = new Set(namedServerGroups.map((g) => g.id));
    for (const g of namedServerGroups) {
      await api(`/retailer/groups/${g.id}`, { method: 'DELETE' });
    }
    const keptIds = new Set(variants.filter((v) => v.id).map((v) => v.id!));
    for (const v of serverVariants) {
      if (!keptIds.has(v.id) && !cascading.has(v.groupId)) {
        await api(`/retailer/variants/${v.id}`, { method: 'DELETE' });
      }
    }
    for (const v of variants.filter((d) => !d.id)) {
      if (v.pricePaise === null) throw new Error(`Set a price for "${v.attributesLabel}"`);
      await api(`/retailer/listings/${listingId}/variants`, {
        method: 'POST',
        body: {
          attributes: v.attributes,
          attributesLabel: v.attributesLabel,
          ...(v.sku.trim() ? { sku: v.sku.trim() } : {}),
          pricePaise: v.pricePaise,
          ...(v.compareAtPrice !== null ? { compareAtPrice: v.compareAtPrice } : {}),
          stock: v.stock ?? 0,
          imageUrls: v.imageUrls,
        },
      });
    }
    const serverVariantById = new Map(serverVariants.map((v) => [v.id, v]));
    for (const v of variants.filter((d) => d.id)) {
      const orig = serverVariantById.get(v.id!);
      if (!orig) continue;
      const body = variantPatchBody(v, orig);
      if (Object.keys(body).length > 0) {
        await api(`/retailer/variants/${v.id}`, { method: 'PATCH', body });
      }
    }
  }

  function updateFlatDraft(idx: number, patch: Partial<VariantDraft>) {
    setVariants(variants.map((v, i) => (i === idx ? { ...v, ...patch } : v)));
  }

  const replaceCount = serverVariants.length;
  const saveDisabled =
    !listingId ||
    (mode === 'single' && variants.length === 0) ||
    (mode === 'color_size' && groups.length === 0) ||
    (mode === 'custom' && variants.length === 0);

  return (
    <div className="max-w-4xl space-y-6">
      {/* Structure choice */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <ModeCard
          active={mode === 'single'}
          icon={<Package className="size-4" />}
          title="Single product"
          desc="One price, one SKU, one stock count."
          onClick={() => requestMode('single')}
        />
        <ModeCard
          active={mode === 'color_size'}
          icon={<Layers className="size-4" />}
          title="Colors & sizes"
          desc="Add colors, then sizes under each — the standard setup."
          onClick={() => requestMode('color_size')}
        />
        <ModeCard
          active={mode === 'custom'}
          icon={<Wand2 className="size-4" />}
          title="Other options"
          desc="Build your own option axes (material, pack size…)."
          onClick={() => requestMode('custom')}
        />
      </div>

      {/* Editor per mode */}
      {mode === 'color_size' && (
        <ColorGroupEditor
          groups={groups}
          setGroups={setGroups}
          gallery={gallery}
          listingId={listingId}
          categoryId={listing?.categoryId ?? null}
          onReload={onReload}
        />
      )}

      {mode === 'custom' && (
        <>
          <CustomOptionsBuilder variants={variants} setVariants={setVariants} />
          {variants.length > 0 ? (
            <div className="space-y-2">
              {variants.map((v, i) => (
                <VariantRow
                  key={v.id ?? `new-${i}`}
                  draft={v}
                  gallery={gallery}
                  galleryLen={gallery.length}
                  listingId={listingId}
                  showLabel
                  onChange={(patch) => updateFlatDraft(i, patch)}
                  onRemove={() => setVariants(variants.filter((_, j) => j !== i))}
                  onPublished={onReload}
                />
              ))}
            </div>
          ) : (
            <p className="rounded-md border border-dashed border-rule px-4 py-6 text-center text-[13px] text-ink-3">
              No variants yet — generate some above.
            </p>
          )}
        </>
      )}

      {mode === 'single' &&
        (variants.length > 0 ? (
          <VariantRow
            draft={variants[0]!}
            gallery={gallery}
            galleryLen={gallery.length}
            listingId={listingId}
            showLabel={false}
            onChange={(patch) => updateFlatDraft(0, patch)}
            onPublished={onReload}
          />
        ) : (
          <p className="rounded-md border border-dashed border-rule px-4 py-6 text-center text-[13px] text-ink-3">
            Pick "Single product" again to add pricing.
          </p>
        ))}

      <div className="flex items-center justify-end gap-2 border-t border-rule pt-4">
        <Button
          type="button"
          variant="ink"
          loading={save.isPending}
          disabled={saveDisabled}
          onClick={() => save.mutate()}
        >
          Save variants
        </Button>
      </div>

      {/* Structure-change confirmation */}
      <Dialog open={confirmReplace !== null} onOpenChange={(o) => !o && setConfirmReplace(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Change variant structure?</DialogTitle>
          </DialogHeader>
          <p className="text-[13px] text-ink-2">
            This product has {replaceCount} saved variant{replaceCount === 1 ? '' : 's'}. Switching the
            structure and saving will replace {replaceCount === 1 ? 'it' : 'them'} — including stock on
            hand. Variants with order history cannot be replaced.
          </p>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setConfirmReplace(null)}>
              Keep current setup
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => confirmReplace && applyMode(confirmReplace)}
            >
              Switch structure
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ModeCard({
  active,
  icon,
  title,
  desc,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex-1 rounded-lg border px-4 py-3 text-left transition-colors',
        active ? 'border-ink bg-ink/[0.03] ring-1 ring-ink/15' : 'border-rule bg-bg hover:border-ink-3',
      )}
    >
      <div className="mb-1 flex items-center gap-2 text-ink">
        {icon}
        <span className="text-[13.5px] font-medium">{title}</span>
      </div>
      <p className="text-[12px] text-ink-3">{desc}</p>
    </button>
  );
}
