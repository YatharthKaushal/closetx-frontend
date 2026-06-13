import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Check, ExternalLink, X } from 'lucide-react';
import { api } from '@/lib/api';
import { changeRequestStatusMeta, formatAge } from '@/lib/status';
import type { ChangeRequest } from '@/lib/types';
import { Page, PageHeader } from '@/components/ui/page';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Empty } from '@/components/ui/empty';
import { CopyableId } from '@/components/ui/copyable-id';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/input';
import { MetaList } from '@/components/ui/meta-list';

function fieldLabel(f: ChangeRequest['field']): string {
  switch (f) {
    case 'legal_name': return 'Legal name';
    case 'address': return 'Address';
    case 'gstin': return 'GSTIN';
    case 'bank_account': return 'Bank account';
  }
}

function BankAccountBlock({ raw }: { raw: string }) {
  let parsed: { accountNumber: string; ifsc: string; legalName: string } | null = null;
  try {
    const p = JSON.parse(raw) as { accountNumber: string; ifsc: string; legalName: string };
    if (p.accountNumber && p.ifsc && p.legalName) parsed = p;
  } catch {
    /* fall through */
  }
  if (!parsed) return <pre className="whitespace-pre-wrap text-[12.5px] text-ink-2">{raw}</pre>;
  return (
    <MetaList
      items={[
        { label: 'Legal name', value: parsed.legalName },
        { label: 'Account number', value: parsed.accountNumber },
        { label: 'IFSC', value: parsed.ifsc },
      ]}
    />
  );
}

function ValueBlock({ field, value }: { field: ChangeRequest['field']; value: string }) {
  if (field === 'bank_account') return <BankAccountBlock raw={value} />;
  return <div className="whitespace-pre-wrap text-[13px] text-ink">{value}</div>;
}

export default function AdminChangeRequestDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [note, setNote] = useState('');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin', 'change-request', id],
    queryFn: () => api<ChangeRequest>(`/admin/compliance/change-requests/${id}`),
    enabled: Boolean(id),
  });

  const decide = useMutation({
    mutationFn: (decision: 'approved' | 'rejected') =>
      api<ChangeRequest>(`/admin/compliance/change-requests/${id}/decide`, {
        method: 'POST',
        body: { decision, ...(note.trim() ? { note: note.trim() } : {}) },
      }),
    onSuccess: (_d, decision) => {
      toast.success(decision === 'approved' ? 'Approved and applied' : 'Rejected');
      qc.invalidateQueries({ queryKey: ['admin', 'change-requests'] });
      qc.invalidateQueries({ queryKey: ['admin', 'change-request', id] });
      navigate('/admin/change-requests');
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Decide failed'),
  });

  if (isLoading) {
    return (
      <Page>
        <Skeleton className="h-32 mb-4" />
        <Skeleton className="h-48" />
      </Page>
    );
  }
  if (isError || !data) {
    return (
      <Page>
        <Empty kicker="Not found" title="Change request not found." />
      </Page>
    );
  }

  const cr = data;
  const meta = changeRequestStatusMeta(cr.status);
  const isPending = cr.status === 'pending';

  return (
    <Page>
      <div className="mb-3">
        <Button asChild variant="ghost" size="sm" iconLeft={<ArrowLeft className="size-3.5" />}>
          <Link to="/admin/compliance?tab=change-requests">Back</Link>
        </Button>
      </div>

      <PageHeader
        kicker="Change request"
        title={fieldLabel(cr.field)}
        description={
          <span className="flex items-center gap-2 flex-wrap">
            <Badge tone={meta.tone}>{meta.label}</Badge>
            <span className="text-[12px] text-ink-3">submitted {formatAge(cr.submittedAt)}</span>
          </span>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader><CardTitle>From → To</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="text-[11px] text-ink-3 mb-1 uppercase tracking-wide">From</div>
                  <ValueBlock field={cr.field} value={cr.currentValue} />
                </div>
                <div>
                  <div className="text-[11px] text-ink-3 mb-1 uppercase tracking-wide">To</div>
                  <ValueBlock field={cr.field} value={cr.requestedValue} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Retailer's reason</CardTitle></CardHeader>
            <CardContent>
              <div className="whitespace-pre-wrap text-[13px] text-ink-2">
                {cr.reason ?? <span className="text-ink-4">No reason supplied.</span>}
              </div>
              {cr.evidenceUrl && (
                <div className="mt-3">
                  <Button asChild variant="outline" size="sm" iconRight={<ExternalLink className="size-3.5" />}>
                    <a href={cr.evidenceUrl} target="_blank" rel="noreferrer">View evidence</a>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {isPending ? (
            <Card>
              <CardHeader><CardTitle>Decide</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label htmlFor="cr-note" hint="Shown to the retailer on the request card">
                    Decision note (optional)
                  </Label>
                  <Textarea
                    id="cr-note"
                    rows={3}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Add context for the retailer — e.g. asked-for follow-up evidence."
                    maxLength={500}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="ink"
                    iconLeft={<Check className="size-3.5" />}
                    loading={decide.isPending && decide.variables === 'approved'}
                    disabled={decide.isPending}
                    onClick={() => decide.mutate('approved')}
                  >
                    Approve & apply
                  </Button>
                  <Button
                    variant="outline"
                    iconLeft={<X className="size-3.5" />}
                    loading={decide.isPending && decide.variables === 'rejected'}
                    disabled={decide.isPending}
                    onClick={() => decide.mutate('rejected')}
                    className="text-danger border-danger/40 hover:bg-danger/5"
                  >
                    Reject
                  </Button>
                </div>
                {cr.field === 'bank_account' && (
                  <div className="text-[11.5px] text-ink-3">
                    Approving inserts a new default bank account and clears the previous default,
                    in one transaction.
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader><CardTitle>Decided</CardTitle></CardHeader>
              <CardContent>
                <MetaList
                  items={[
                    { label: 'Decision', value: <Badge tone={meta.tone}>{meta.label}</Badge> },
                    {
                      label: 'Decided at',
                      value: cr.decidedAt ? formatAge(cr.decidedAt) : '—',
                    },
                    { label: 'Decided by', value: cr.decidedByAccountId ?? '—' },
                    { label: 'Note', value: cr.decisionNote ?? '—' },
                  ]}
                />
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Store</CardTitle></CardHeader>
            <CardContent>
              <MetaList
                items={[
                  { label: 'Name', value: cr.storeName ?? '—' },
                  { label: 'Store id', value: <CopyableId value={cr.storeId} label="store id" /> },
                  { label: 'Field', value: fieldLabel(cr.field) },
                ]}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </Page>
  );
}
