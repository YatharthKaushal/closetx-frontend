import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import type { AttributeAxisType, AttributeTemplate } from '@/lib/types';
import { Page, PageHeader, SectionHeading } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type AffectedListing = { listingId: string; listingName: string; variantCount: number };

const AXIS_TYPES: AttributeAxisType[] = ['enum', 'free_text', 'numeric', 'color'];

export default function AttributeTemplateEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isNew = id === 'new' || id === undefined;
  const { data, isLoading } = useQuery({
    queryKey: ['retailer', 'attribute-templates', id],
    queryFn: () => api<AttributeTemplate>(`/retailer/attribute-templates/${id}`),
    enabled: !isNew,
  });
  const [draft, setDraft] = useState<AttributeTemplate>({
    id: 'new',
    name: '',
    axes: [{ name: '', type: 'enum', allowedValues: [] }],
    usedByListingCount: 0,
    usageCount: 0,
    lastUsedAt: null,
    updatedAt: null,
  });
  const [saving, setSaving] = useState(false);
  const [orphanPrompt, setOrphanPrompt] = useState<AffectedListing[] | null>(null);
  const initialAxes = useRef<AttributeTemplate['axes'] | null>(null);

  const allTemplatesQ = useQuery({
    queryKey: ['retailer', 'attribute-templates'],
    queryFn: () => api<AttributeTemplate[]>('/retailer/attribute-templates'),
  });

  useEffect(() => {
    if (data) {
      setDraft(data);
      initialAxes.current ??= data.axes;
    }
  }, [data]);

  if (!isNew && isLoading) return <Page><Skeleton className="h-72" /></Page>;
  if (!isNew && !data) return <Page><PageHeader title="Template not found" /></Page>;

  // Show orphan warning only when removing/renaming axes or removing values — not just adding
  const orphanWarning = (() => {
    if ((data?.usedByListingCount ?? 0) === 0) return false;
    if (!initialAxes.current) return false;
    const init = initialAxes.current;
    const curr = draft.axes;
    // Axis removed
    if (curr.length < init.length) return true;
    // Axis renamed (by name match position)
    for (let i = 0; i < Math.min(init.length, curr.length); i++) {
      if (init[i]!.name && curr[i]!.name !== init[i]!.name) return true;
      const initVals = new Set(init[i]!.allowedValues);
      const currVals = new Set(curr[i]!.allowedValues);
      for (const v of initVals) {
        if (!currVals.has(v)) return true; // value removed
      }
    }
    return false;
  })();

  // Client-side fast-fail on dupe name. Backend also enforces — this just avoids
  // a round-trip when the user can see the clash from current data.
  function clientDupeName(): boolean {
    const existingNames = (allTemplatesQ.data ?? [])
      .filter((t) => t.id !== (isNew ? '' : id))
      .map((t) => t.name.toLowerCase());
    if (existingNames.includes(draft.name.trim().toLowerCase())) {
      toast.error(`A template named "${draft.name.trim()}" already exists`);
      return true;
    }
    return false;
  }

  async function attemptSave(force: boolean) {
    setSaving(true);
    try {
      if (isNew) {
        const r = await api<{ id: string }>('/retailer/attribute-templates', {
          method: 'POST',
          body: { name: draft.name, axes: draft.axes },
        });
        await qc.invalidateQueries({ queryKey: ['retailer', 'attribute-templates'] });
        toast.success('Template created');
        navigate(`/retailer/attribute-templates/${r.id}`);
      } else {
        const body: Record<string, unknown> = { name: draft.name, axes: draft.axes };
        if (force) body.force = true;
        const result = await api<{ orphansFlagged?: number }>(`/retailer/attribute-templates/${id}`, {
          method: 'PATCH',
          body,
        });
        await qc.invalidateQueries({ queryKey: ['retailer', 'attribute-templates'] });
        if (force && result.orphansFlagged && result.orphansFlagged > 0) {
          toast.success(`Template saved · ${result.orphansFlagged} variant(s) flagged for review`);
        } else {
          toast.success('Template saved');
        }
        // Reset baseline so the orphan check doesn't re-trigger on next edit
        initialAxes.current = draft.axes;
        setOrphanPrompt(null);
      }
    } catch (err) {
      if (
        err instanceof ApiError &&
        err.status === 409 &&
        err.details &&
        typeof err.details === 'object' &&
        'affected' in (err.details as object) &&
        Array.isArray((err.details as { affected: unknown }).affected)
      ) {
        setOrphanPrompt((err.details as { affected: AffectedListing[] }).affected);
      } else {
        toast.error(err instanceof ApiError ? err.message : 'Save failed');
      }
    } finally {
      setSaving(false);
    }
  }

  function save() {
    if (clientDupeName()) return;
    void attemptSave(false);
  }

  return (
    <Page>
      <PageHeader
        kicker="Catalog"
        title={isNew ? 'New attribute template' : `Edit: ${draft.name || data?.name}`}
        description="Editing axes on a template that's in use can orphan variants. Add new axes freely; remove axes only when the impact is acceptable."
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" iconLeft={<ArrowLeft className="size-3.5" />}>
              <Link to="/retailer/attribute-templates">Back</Link>
            </Button>
            <Button variant="accent" onClick={save} disabled={saving || !draft.name.trim()}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        }
      />

      {orphanWarning && (
        <div className="mb-4 rounded-md border border-warning/30 bg-warning-soft/30 p-3 text-[12.5px] text-warning">
          <strong>Heads up:</strong> {data?.usedByListingCount} listing(s) depend on this template.
          Removing or renaming an axis will orphan their variants.
        </div>
      )}

      <Card>
        <CardContent className="p-6 space-y-5">
          <div>
            <Label htmlFor="tpl-name" required>Template name</Label>
            <Input id="tpl-name" value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
          </div>

          <div>
            <SectionHeading kicker="Axes" title="Variant axes" />
            <ul className="space-y-3">
              {draft.axes.map((axis, idx) => (
                <li key={idx} className="rounded-lg border border-line bg-bg-2/30 p-4 space-y-3">
                  <div className="grid gap-3 sm:grid-cols-[2fr_1fr_auto]">
                    <div>
                      <Label htmlFor={`axis-${idx}-name`} required>Axis name</Label>
                      <Input
                        id={`axis-${idx}-name`}
                        value={axis.name}
                        onChange={(e) => updateAxis(idx, { name: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`axis-${idx}-type`}>Type</Label>
                      <Select
                        value={axis.type}
                        onValueChange={(v) => updateAxis(idx, { type: v as AttributeAxisType })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {AXIS_TYPES.map((t) => (
                            <SelectItem key={t} value={t}>{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      variant="ghost"
                      iconLeft={<Trash2 className="size-3.5" />}
                      onClick={() => removeAxis(idx)}
                      disabled={draft.axes.length === 1}
                    >
                      Remove
                    </Button>
                  </div>
                  <div>
                    <Label>Allowed values</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {axis.allowedValues.map((v) => (
                        <Badge key={v} tone="neutral" className="cursor-pointer" onClick={() => updateAxis(idx, { allowedValues: axis.allowedValues.filter((x) => x !== v) })}>
                          {v} ×
                        </Badge>
                      ))}
                      <input
                        type="text"
                        placeholder="Type and press Enter…"
                        className="rounded-md border border-line-2 bg-bg px-2 py-1 text-[12.5px] focus:border-ink focus:outline-none"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const v = (e.target as HTMLInputElement).value.trim();
                            if (v && !axis.allowedValues.includes(v)) {
                              updateAxis(idx, { allowedValues: [...axis.allowedValues, v] });
                            }
                            (e.target as HTMLInputElement).value = '';
                            e.preventDefault();
                          }
                        }}
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              iconLeft={<Plus className="size-3.5" />}
              onClick={() =>
                setDraft((d) => ({ ...d, axes: [...d.axes, { name: '', type: 'enum', allowedValues: [] }] }))
              }
            >
              Add axis
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={orphanPrompt !== null} onOpenChange={(o) => { if (!o) setOrphanPrompt(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-warning" />
              This edit will orphan existing variants
            </DialogTitle>
            <DialogDescription>
              You're removing an axis or an allowed value that some variants depend on.
              These variants stay in place but get flagged for review so you can decide
              whether to retire or re-tag them.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border border-warning/30 bg-warning-soft/20 px-3 py-2 text-[12.5px] text-ink-2">
            <p className="mb-2 font-medium text-warning">
              Affected: {orphanPrompt?.reduce((s, a) => s + a.variantCount, 0) ?? 0} variant{(orphanPrompt?.reduce((s, a) => s + a.variantCount, 0) ?? 0) === 1 ? '' : 's'}
              {' '}across {orphanPrompt?.length ?? 0} listing{(orphanPrompt?.length ?? 0) === 1 ? '' : 's'}
            </p>
            <ul className="space-y-1">
              {(orphanPrompt ?? []).map((a) => (
                <li key={a.listingId} className="flex items-center justify-between gap-2">
                  <Link
                    to={`/retailer/listings/${a.listingId}`}
                    className="truncate text-ink hover:underline"
                  >
                    {a.listingName}
                  </Link>
                  <span className="font-mono text-[11.5px] text-ink-3">
                    {a.variantCount} variant{a.variantCount === 1 ? '' : 's'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOrphanPrompt(null)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="danger" loading={saving} onClick={() => void attemptSave(true)}>
              Save anyway & flag variants
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  );

  function updateAxis(idx: number, patch: Partial<AttributeTemplate['axes'][number]>) {
    setDraft((d) => ({
      ...d,
      axes: d.axes.map((a, i) => (i === idx ? { ...a, ...patch } : a)),
    }));
  }
  function removeAxis(idx: number) {
    setDraft((d) => ({ ...d, axes: d.axes.filter((_, i) => i !== idx) }));
  }
}
