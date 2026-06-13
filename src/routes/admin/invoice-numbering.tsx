import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import type { InvoiceNumberingConfig } from '@/lib/types';
import { SectionHeading } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function InvoiceNumberingPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'invoice-numbering'],
    queryFn: () => api<InvoiceNumberingConfig[]>('/admin/invoice-numbering'),
  });
  const list = data ?? [];

  return (
    <div>
      <p className="mb-4 max-w-3xl text-[13px] text-ink-3 leading-relaxed">
        The invoice-number prefix and pattern for each legal entity. Changes apply only to the next
        invoice issued — they never change invoices already created.
      </p>

      {isLoading ? (
        <Skeleton className="h-72" />
      ) : (
        <div className="space-y-4">
          {list.map((cfg) => <ConfigCard key={cfg.legalEntityId} initial={cfg} />)}
        </div>
      )}
    </div>
  );
}

function ConfigCard({ initial }: { initial: InvoiceNumberingConfig }) {
  const [draft, setDraft] = useState<InvoiceNumberingConfig>(initial);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const sample = draft.pattern
    .replace('{prefix}', draft.prefix)
    .replace('{YYYY}', new Date().getFullYear().toString())
    .replace('{MM}', String(new Date().getMonth() + 1).padStart(2, '0'))
    .replace(/\{seq:0(\d)d\}/, (_, n) => String(draft.nextSequence).padStart(Number(n), '0'));

  return (
    <Card>
      <CardContent className="p-6">
        <SectionHeading kicker="Legal entity" title={initial.legalEntityName} hint={initial.legalEntityId} />
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor={`prefix-${initial.legalEntityId}`} required>Prefix</Label>
            <Input id={`prefix-${initial.legalEntityId}`} value={draft.prefix} onChange={(e) => setDraft({ ...draft, prefix: e.target.value.toUpperCase() })} mono />
          </div>
          <div>
            <Label htmlFor={`seq-${initial.legalEntityId}`}>Next sequence</Label>
            <Input id={`seq-${initial.legalEntityId}`} type="number" value={draft.nextSequence} onChange={(e) => setDraft({ ...draft, nextSequence: Number(e.target.value) })} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor={`pattern-${initial.legalEntityId}`} hint="tokens: {prefix} {YYYY} {MM} {seq:04d}">Pattern</Label>
            <Input id={`pattern-${initial.legalEntityId}`} value={draft.pattern} onChange={(e) => setDraft({ ...draft, pattern: e.target.value })} mono />
          </div>
          <div>
            <Label>Reset cycle</Label>
            <Select value={draft.resetCycle} onValueChange={(v) => setDraft({ ...draft, resetCycle: v as InvoiceNumberingConfig['resetCycle'] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="never">Never</SelectItem>
                <SelectItem value="fiscal_year">Fiscal year</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Sample next number</Label>
            <div className="rounded-md border border-line bg-bg-2/30 px-3 py-2 font-mono text-[13px] text-ink">{sample}</div>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <Button variant="accent" disabled={!dirty} onClick={() => toast.success('Saved (mock)')}>Save</Button>
          <Button variant="ghost" disabled={!dirty} onClick={() => setDraft(initial)}>Reset</Button>
          {dirty && <Badge tone="warning">Unsaved</Badge>}
        </div>
      </CardContent>
    </Card>
  );
}
