import { lazy, Suspense, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { UseFormReturn } from 'react-hook-form';
import { Check, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import type { Category } from '@/lib/types';
import { Input, Textarea } from '@/components/ui/input';
import { FieldError, Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BrandSelect } from '@/components/retailer/brand-select';
import { MediaGalleryV2 } from '@/components/ui/media-gallery-v2';
import type { WizardFormValues } from './types';

const RichTextEditor = lazy(() =>
  import('@/components/ui/rich-text-editor').then((m) => ({ default: m.RichTextEditor })),
);

export function StepBasicsMedia({
  form,
  categories,
  gallery,
  onGalleryChange,
  uploadFolder,
  onRequestAiGenerate,
}: {
  form: UseFormReturn<WizardFormValues>;
  categories: Category[];
  gallery: string[];
  onGalleryChange: (next: string[]) => void;
  uploadFolder: string;
  onRequestAiGenerate?: (() => void) | undefined;
}) {
  const { register, setValue, watch, formState: { errors } } = form;
  const gender = watch('gender');
  const visibleCategories = categories.filter((c) => c.gender === gender || c.gender === 'unisex');

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {/* LEFT — fields */}
      <div className="space-y-5">
        <div>
          <Label htmlFor="name" required>Product name</Label>
          <Input id="name" placeholder="e.g. Linen relaxed shirt" {...register('name')} />
          <FieldError>{errors.name?.message}</FieldError>
        </div>

        <SkuField value={watch('sku') ?? ''} onChange={(v) => setValue('sku', v, { shouldDirty: true })} />

        <div>
          <Label htmlFor="desc" hint="Optional">Short description</Label>
          <Textarea
            id="desc"
            rows={2}
            placeholder="One-liner for cards and search…"
            {...register('description')}
          />
          <FieldError>{errors.description?.message}</FieldError>
        </div>

        <div>
          <Label hint="Optional">Full description</Label>
          <p className="mb-1.5 text-[12px] text-ink-3">
            Rich formatting for the product page — headings, lists, tables, colours, images.
          </p>
          <Suspense
            fallback={
              <div className="grid h-40 place-items-center rounded-md border border-line-2 text-[12.5px] text-ink-4">
                Loading editor…
              </div>
            }
          >
            <RichTextEditor
              value={watch('descriptionLong') ?? ''}
              onChange={(html) => setValue('descriptionLong', html, { shouldDirty: true })}
              uploadFolder={`${uploadFolder}/description`}
            />
          </Suspense>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <BrandSelect
            value={watch('brandId')}
            onChange={(id) => setValue('brandId', id, { shouldValidate: true, shouldDirty: true })}
            error={errors.brandId?.message}
          />
          <div>
            <Label required>Cut for</Label>
            <Select value={gender} onValueChange={(v) => setValue('gender', v as WizardFormValues['gender'], { shouldDirty: true })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="her">Her</SelectItem>
                <SelectItem value="him">Him</SelectItem>
                <SelectItem value="unisex">Unisex</SelectItem>
              </SelectContent>
            </Select>
            <FieldError>{errors.gender?.message}</FieldError>
          </div>
        </div>

        <div>
          <Label required>Category</Label>
          <Select
            value={watch('categoryId')}
            onValueChange={(v) => setValue('categoryId', v, { shouldValidate: true, shouldDirty: true })}
          >
            <SelectTrigger>
              <span className={watch('categoryId') ? undefined : 'text-ink-4'}>
                {watch('categoryId')
                  ? categories.find((c) => c.id === watch('categoryId'))?.label ?? '…'
                  : 'Pick a category'}
              </span>
            </SelectTrigger>
            <SelectContent>
              {visibleCategories.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError>{errors.categoryId?.message}</FieldError>
        </div>
      </div>

      {/* RIGHT — media */}
      <div>
        <Label>Media</Label>
        <p className="mb-2 text-[12px] text-ink-3">
          First image is the cover. Variant images are picked from this set.
        </p>
        <MediaGalleryV2
          urls={gallery}
          onChange={onGalleryChange}
          uploadFolder={uploadFolder}
          onRequestAiGenerate={onRequestAiGenerate}
        />
      </div>
    </div>
  );
}

/** Editable SKU with debounced store-wide availability check. */
function SkuField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value.trim()), 400);
    return () => clearTimeout(t);
  }, [value]);

  const check = useQuery({
    queryKey: ['retailer', 'sku-available', debounced],
    enabled: debounced.length > 0,
    queryFn: () => api<{ available: boolean }>(`/retailer/variants/sku-available?sku=${encodeURIComponent(debounced)}`),
    staleTime: 10_000,
  });

  return (
    <div>
      <Label htmlFor="sku" hint="Optional — auto-generated if left blank">SKU</Label>
      <div className="relative">
        <Input
          id="sku"
          placeholder="Leave blank to auto-generate"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          mono
        />
        {debounced.length > 0 && (
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2">
            {check.isFetching ? (
              <Loader2 className="size-3.5 animate-spin text-ink-4" />
            ) : check.data?.available ? (
              <Check className="size-4 text-success" />
            ) : check.data && !check.data.available ? (
              <span className="text-[11px] font-medium text-danger">taken</span>
            ) : null}
          </span>
        )}
      </div>
      {debounced.length > 0 && check.data && !check.data.available && (
        <FieldError>That SKU is already used in your store.</FieldError>
      )}
    </div>
  );
}
