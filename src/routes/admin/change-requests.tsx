import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, ExternalLink, FileEdit } from 'lucide-react';
import { api } from '@/lib/api';
import { changeRequestStatusMeta, formatAge } from '@/lib/status';
import type { ChangeRequest, ChangeRequestStatus } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { CopyableId } from '@/components/ui/copyable-id';
import { Segmented } from '@/components/ui/segmented';

type Filter = ChangeRequestStatus | 'all';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'All' },
];

function fieldLabel(f: ChangeRequest['field']): string {
  switch (f) {
    case 'legal_name': return 'Legal name';
    case 'address': return 'Address';
    case 'gstin': return 'GSTIN';
    case 'bank_account': return 'Bank account';
  }
}

function summariseValue(field: ChangeRequest['field'], raw: string): string {
  if (!raw) return '—';
  if (field !== 'bank_account') return raw;
  try {
    const parsed = JSON.parse(raw) as { accountNumber?: string; ifsc?: string; legalName?: string };
    const parts = [parsed.legalName, parsed.accountNumber, parsed.ifsc].filter(Boolean);
    return parts.join(' · ') || raw;
  } catch {
    return raw;
  }
}

export function ChangeRequestsPanel() {
  const [filter, setFilter] = useState<Filter>('pending');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'change-requests', filter],
    queryFn: () =>
      api<ChangeRequest[]>(
        filter === 'all'
          ? '/admin/compliance/change-requests'
          : `/admin/compliance/change-requests?status=${filter}`,
      ),
  });
  const list = data ?? [];

  return (
    <div>
      <p className="mb-3 max-w-2xl text-[13px] text-ink-3 leading-relaxed">
        Verified-field changes (legal name, address, bank, GSTIN). Approve to apply the new value
        atomically; reject leaves the store row untouched.
      </p>

      <div className="mb-4">
        <Segmented
          value={filter}
          onChange={(v) => setFilter(v as Filter)}
          options={FILTERS.map((f) => ({ value: f.value, label: f.label }))}
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : list.length === 0 ? (
        <Empty
          kicker="All clear"
          title={
            filter === 'pending'
              ? 'No pending change requests.'
              : `No ${filter} change requests.`
          }
        />
      ) : (
        <ul className="space-y-2">
          {list.map((cr) => {
            const meta = changeRequestStatusMeta(cr.status);
            return (
              <Card key={cr.id}>
                <CardContent className="flex flex-wrap items-start gap-3 p-4">
                  <FileEdit className="mt-0.5 size-4 shrink-0 text-ink-3" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[14px] font-medium text-ink">{fieldLabel(cr.field)}</span>
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                      {cr.storeName ? (
                        <span className="text-[12px] text-ink-2 truncate">{cr.storeName}</span>
                      ) : (
                        <CopyableId value={cr.storeId} label="store id" />
                      )}
                      <span className="text-[11.5px] text-ink-3">{formatAge(cr.submittedAt)}</span>
                    </div>
                    <div className="mt-2 grid grid-cols-1 gap-1.5 text-[12.5px] sm:grid-cols-[auto,1fr]">
                      <span className="kicker">From</span>
                      <span className="text-ink-2 line-through decoration-ink-4">
                        {summariseValue(cr.field, cr.currentValue)}
                      </span>
                      <span className="kicker text-success">To</span>
                      <span className="text-ink">{summariseValue(cr.field, cr.requestedValue)}</span>
                    </div>
                    {cr.reason && (
                      <p className="mt-2 text-[12px] italic text-ink-3">"{cr.reason}"</p>
                    )}
                    {cr.evidenceUrl && (
                      <a
                        href={cr.evidenceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-[11.5px] text-ink-3 hover:text-ink hover:underline"
                      >
                        <ExternalLink className="size-3" /> Evidence
                      </a>
                    )}
                  </div>
                  <Button asChild variant="outline" size="sm" iconRight={<ArrowUpRight className="size-3.5" />}>
                    <Link to={`/admin/change-requests/${cr.id}`}>Review</Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </ul>
      )}
    </div>
  );
}
