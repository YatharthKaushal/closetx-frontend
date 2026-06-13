import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Sparkles, Wand2, X } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import type { AttributeTemplate } from '@/lib/types';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetClose, SheetContent, SheetHeader } from '@/components/ui/sheet';
import { AxisValueEditor, cartesian, type AxisState } from '@/components/retailer/variant-builder';
import { toPaise } from './variant-row';
import type { VariantDraft } from './types';

/**
 * The "Other" / custom-options path: pick (or build) an attribute template,
 * select axis values, cartesian-generate variant rows. Extracted unchanged
 * from the old StepVariants multi-mode block.
 */
export function CustomOptionsBuilder({
  variants,
  setVariants,
}: {
  variants: VariantDraft[];
  setVariants: (v: VariantDraft[]) => void;
}) {
  const qc = useQueryClient();
  const templatesQ = useQuery({
    queryKey: ['retailer', 'attribute-templates'],
    queryFn: () => api<AttributeTemplate[]>('/retailer/attribute-templates'),
  });

  const [axes, setAxes] = useState<AxisState[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [bulkPrice, setBulkPrice] = useState('');
  const [bulkStock, setBulkStock] = useState('');
  const [saveAsTemplateName, setSaveAsTemplateName] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);

  function applyTemplate(t: AttributeTemplate) {
    setSelectedTemplateId(t.id);
    setAxes(
      t.axes.map((a) => ({
        name: a.name,
        type: a.type,
        allowedValues: a.allowedValues,
        selectedValues: [],
      })),
    );
  }

  function generateRows() {
    const usable = axes.filter((a) => a.name.trim() && a.selectedValues.length > 0);
    if (usable.length === 0) {
      toast.error('Pick at least one value on one option');
      return;
    }
    const combos = cartesian(usable.map((a) => a.selectedValues));
    const existingLabels = new Set(variants.map((v) => v.attributesLabel));
    const price = toPaise(bulkPrice);
    const stock = bulkStock.trim() === '' ? 0 : Number(bulkStock);
    const fresh: VariantDraft[] = [];
    for (const combo of combos) {
      const attributes: Record<string, string> = {};
      usable.forEach((a, i) => (attributes[a.name] = combo[i]!));
      const label = combo.join(' / ');
      if (existingLabels.has(label)) continue;
      fresh.push({
        attributes,
        attributesLabel: label,
        sku: '',
        pricePaise: price,
        compareAtPrice: null,
        stock: Number.isNaN(stock) ? 0 : stock,
        imageUrls: [],
        isActive: false,
      });
    }
    if (fresh.length === 0) {
      toast.info('All those combinations already exist');
      return;
    }
    setVariants([...variants, ...fresh]);
    toast.success(`Added ${fresh.length} variant${fresh.length === 1 ? '' : 's'}`);
  }

  const saveTemplate = useMutation({
    mutationFn: () =>
      api('/retailer/attribute-templates', {
        method: 'POST',
        body: {
          name: saveAsTemplateName.trim(),
          axes: axes
            .filter((a) => a.name.trim())
            .map((a) => ({ name: a.name.trim(), type: a.type, allowedValues: a.selectedValues })),
        },
      }),
    onSuccess: () => {
      toast.success(`Template "${saveAsTemplateName.trim()}" saved`);
      setSaveAsTemplateName('');
      void qc.invalidateQueries({ queryKey: ['retailer', 'attribute-templates'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not save template'),
  });

  return (
    <div className="space-y-4 rounded-lg border border-rule bg-paper-2/30 p-4">
      <div className="flex items-center justify-between">
        <div className="text-[13px] font-medium text-ink">Build options</div>
        <Button type="button" variant="ghost" size="xs" iconLeft={<Plus className="size-3" />} onClick={() => setSheetOpen(true)}>
          New template
        </Button>
      </div>

      {/* Template suggestions */}
      {(templatesQ.data?.length ?? 0) > 0 && (
        <div className="flex flex-wrap gap-2">
          {templatesQ.data!.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => applyTemplate(t)}
              className={cn(
                'rounded-md border px-3 py-1.5 text-left text-[12px] transition-colors',
                selectedTemplateId === t.id
                  ? 'border-ink bg-ink text-paper'
                  : 'border-line bg-bg hover:border-ink-3',
              )}
            >
              <div className="font-medium">{t.name}</div>
              <div className={cn('text-[10px]', selectedTemplateId === t.id ? 'text-paper/70' : 'text-ink-4')}>
                {t.ownerStoreId ? 'Yours' : 'Platform'} · {t.axes.map((a) => a.name).join(', ')}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Axes */}
      {axes.length > 0 ? (
        <div className="space-y-2">
          {axes.map((axis, i) => (
            <AxisValueEditor
              key={i}
              axis={axis}
              fromTemplate={!!selectedTemplateId}
              onNameChange={(name) => setAxes(axes.map((a, j) => (j === i ? { ...a, name } : a)))}
              onToggleEnum={(value) =>
                setAxes(
                  axes.map((a, j) =>
                    j === i
                      ? {
                          ...a,
                          selectedValues: a.selectedValues.includes(value)
                            ? a.selectedValues.filter((x) => x !== value)
                            : [...a.selectedValues, value],
                        }
                      : a,
                  ),
                )
              }
              onSetFree={(values) => setAxes(axes.map((a, j) => (j === i ? { ...a, selectedValues: values } : a)))}
              onRemove={() => setAxes(axes.filter((_, j) => j !== i))}
            />
          ))}
        </div>
      ) : (
        <p className="text-[12.5px] text-ink-3">
          Pick a template above, or add an option manually.
        </p>
      )}

      <div className="flex flex-wrap items-end gap-2">
        {!selectedTemplateId && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            iconLeft={<Plus className="size-3.5" />}
            onClick={() => setAxes([...axes, { name: '', type: 'free_text', allowedValues: [], selectedValues: [] }])}
          >
            Add option
          </Button>
        )}
        <div className="w-28">
          <Label hint="₹">Bulk price</Label>
          <Input value={bulkPrice} onChange={(e) => setBulkPrice(e.target.value)} placeholder="999" inputMode="decimal" />
        </div>
        <div className="w-24">
          <Label>Bulk stock</Label>
          <Input value={bulkStock} onChange={(e) => setBulkStock(e.target.value)} placeholder="0" inputMode="numeric" />
        </div>
        <Button type="button" variant="ink" size="sm" iconLeft={<Wand2 className="size-3.5" />} onClick={generateRows}>
          Generate variants
        </Button>
      </div>

      {!selectedTemplateId && axes.some((a) => a.selectedValues.length > 0) && (
        <div className="flex items-end gap-2 border-t border-rule/60 pt-3">
          <div className="flex-1">
            <Label hint="Optional">Save these options as a template</Label>
            <Input
              value={saveAsTemplateName}
              onChange={(e) => setSaveAsTemplateName(e.target.value)}
              placeholder="e.g. My apparel sizes"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            loading={saveTemplate.isPending}
            disabled={!saveAsTemplateName.trim()}
            onClick={() => saveTemplate.mutate()}
          >
            Save template
          </Button>
        </div>
      )}

      <NewTemplateSheet open={sheetOpen} onOpenChange={setSheetOpen} onCreated={(t) => applyTemplate(t)} />
    </div>
  );
}

/** Right-side sheet to build a brand-new template from scratch. */
function NewTemplateSheet({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: (t: AttributeTemplate) => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [axes, setAxes] = useState<AxisState[]>([
    { name: '', type: 'enum', allowedValues: [], selectedValues: [] },
  ]);

  const create = useMutation({
    mutationFn: () =>
      api<AttributeTemplate>('/retailer/attribute-templates', {
        method: 'POST',
        body: {
          name: name.trim(),
          axes: axes
            .filter((a) => a.name.trim())
            // For a template, the values the user types are the allowed values.
            .map((a) => ({ name: a.name.trim(), type: a.type, allowedValues: a.selectedValues })),
        },
      }),
    onSuccess: (t) => {
      toast.success(`Template "${t.name}" created`);
      void qc.invalidateQueries({ queryKey: ['retailer', 'attribute-templates'] });
      onCreated(t);
      onOpenChange(false);
      setName('');
      setAxes([{ name: '', type: 'enum', allowedValues: [], selectedValues: [] }]);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not create template'),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[min(28rem,100vw)]">
        <SheetHeader className="flex items-center justify-between">
          <span className="text-[15px] font-semibold text-ink">New template</span>
          <SheetClose className="text-ink-3 hover:text-ink"><X className="size-4" /></SheetClose>
        </SheetHeader>
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <div>
            <Label required>Template name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Footwear sizes" />
          </div>
          <div className="space-y-2">
            <Label>Options</Label>
            {axes.map((axis, i) => (
              <AxisValueEditor
                key={i}
                axis={axis}
                fromTemplate={false}
                onNameChange={(n) => setAxes(axes.map((a, j) => (j === i ? { ...a, name: n } : a)))}
                onToggleEnum={() => {}}
                onSetFree={(values) => setAxes(axes.map((a, j) => (j === i ? { ...a, selectedValues: values } : a)))}
                onRemove={() => setAxes(axes.filter((_, j) => j !== i))}
              />
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              iconLeft={<Plus className="size-3.5" />}
              onClick={() => setAxes([...axes, { name: '', type: 'enum', allowedValues: [], selectedValues: [] }])}
            >
              Add option
            </Button>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-line p-4">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="ink"
            size="sm"
            loading={create.isPending}
            iconLeft={<Sparkles className="size-3.5" />}
            disabled={!name.trim() || !axes.some((a) => a.name.trim() && a.selectedValues.length > 0)}
            onClick={() => create.mutate()}
          >
            Create template
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
