import { z } from 'zod';
import type { Listing } from '@/lib/types';

/** Scalar fields owned by react-hook-form (Steps 1 + 3). */
export const WizardFormSchema = z.object({
  name: z.string().trim().min(1, 'Required').max(200),
  sku: z.string().trim().max(64).optional(),
  description: z.string().trim().max(2000).optional(),
  descriptionLong: z.string().optional(),
  brandId: z.string().min(1, 'Pick a brand'),
  categoryId: z.string().min(1, 'Pick a category'),
  gender: z.enum(['her', 'him', 'unisex']),
  occasion: z.array(z.string().trim().min(1).max(40)).max(10),
  ageGroups: z.array(z.string()).max(7),
  listingPolicy: z.enum(['return', 'replace', 'final_sale']),
  hsn: z.string().trim().max(8).optional(),
});
export type WizardFormValues = z.infer<typeof WizardFormSchema>;

/** A variant row in Step 2 (local, before/after persistence). */
export type VariantDraft = {
  /** Server id once persisted; absent for a not-yet-saved row. */
  id?: string;
  attributes: Record<string, string>;
  attributesLabel: string;
  /** '' means auto-generate on save. */
  sku: string;
  pricePaise: number | null;
  compareAtPrice: number | null;
  stock: number | null;
  imageUrls: string[];
  isActive: boolean;
};

export const WIZARD_STEPS = ['Basics & media', 'Variants', 'Details'] as const;

/** Client mirror of the backend's variant-completeness rule. */
export function isVariantDraftComplete(v: VariantDraft, galleryLength: number): boolean {
  return (
    v.pricePaise !== null &&
    v.pricePaise > 0 &&
    !!v.sku.trim() &&
    v.stock !== null &&
    (v.imageUrls.length > 0 || galleryLength > 0)
  );
}

// ===== Parent-child (color → sizes) variant structure =====

/** Wizard-side mirror of the listing's `variantMode`. */
export type VariantMode = 'single' | 'color_size' | 'custom';

/** A size row under a color group — identity (attributes/label) is server-derived. */
export type SizeDraft = VariantDraft & { size: string };

/** One color card in the grouped editor. */
export type GroupDraft = {
  /** Stable React key before the group is persisted. */
  clientKey: string;
  /** Server id once persisted. */
  id?: string;
  name: string;
  /** Optional #RRGGBB swatch. */
  colorHex: string | null;
  sortOrder: number;
  sizes: SizeDraft[];
};

let groupKeyCounter = 0;
export function nextGroupKey(): string {
  groupKeyCounter += 1;
  return `g${groupKeyCounter}-${Date.now()}`;
}

function variantToDraft(v: NonNullable<Listing['variants']>[number]): VariantDraft {
  return {
    id: v.id,
    attributes: v.attributes,
    attributesLabel: v.attributesLabel,
    sku: v.sku ?? '',
    pricePaise: v.pricePaise,
    compareAtPrice: v.compareAtPrice,
    stock: v.stock,
    imageUrls: v.imageUrls,
    isActive: v.isActive,
  };
}

/** The variant's size value under either key casing (legacy rows used "Size"). */
function sizeOf(attrs: Record<string, string>): string | null {
  for (const key of Object.keys(attrs)) {
    if (key.toLowerCase() === 'size') return attrs[key] ?? null;
  }
  return null;
}

/**
 * Seed the wizard's variant state from a loaded listing. `variantMode` is the
 * server's record of the structure; grouped listings bucket their flat
 * variants by `groupId` (the empty default group is hidden from the editor).
 */
export function seedVariantState(l: Listing): {
  mode: VariantMode;
  groups: GroupDraft[];
  variants: VariantDraft[];
} {
  const mode = l.variantMode;
  const flat = (l.variants ?? []).map(variantToDraft);
  if (mode !== 'color_size') {
    return { mode, groups: [], variants: flat };
  }

  const byGroup = new Map<string, VariantDraft[]>();
  for (const v of l.variants ?? []) {
    const list = byGroup.get(v.groupId) ?? [];
    list.push(variantToDraft(v));
    byGroup.set(v.groupId, list);
  }
  const groups: GroupDraft[] = (l.variantGroups ?? [])
    .filter((g) => !g.isDefault || (byGroup.get(g.id)?.length ?? 0) > 0)
    .map((g) => ({
      clientKey: nextGroupKey(),
      id: g.id,
      name: g.name,
      colorHex: g.colorHex,
      sortOrder: g.sortOrder,
      sizes: (byGroup.get(g.id) ?? []).map((d) => ({
        ...d,
        size: sizeOf(d.attributes) ?? d.attributesLabel,
      })),
    }));
  return { mode, groups, variants: flat };
}
