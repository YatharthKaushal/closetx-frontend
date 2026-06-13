import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FileText, Receipt } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { SectionHeading } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label, FieldError } from '@/components/ui/label';

/**
 * §18 admin invoice operations:
 *  - Re-issue commission invoice for an order after a correction.
 *  - Issue credit note against a refund.
 *  - Manual tax-invoice issuance (covered here for completeness).
 */
export function InvoiceOpsPanel() {
  return (
    <div>
      <p className="mb-4 max-w-3xl text-[13px] text-ink-3 leading-relaxed">
        Create or fix invoices by hand — platform-fee invoices, credit notes, and one-off tax
        invoices.
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        <ReissueCommissionCard />
        <CreditNoteCard />
        <TaxInvoiceCard />
      </div>
    </div>
  );
}

function ReissueCommissionCard() {
  const [orderId, setOrderId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = useMutation({
    mutationFn: () =>
      api('/admin/invoices/commission/issue', {
        method: 'POST',
        body: { orderId: orderId.trim() },
      }),
    onSuccess: () => {
      toast.success('Commission invoice re-issued');
      setOrderId('');
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Re-issue failed'),
  });

  return (
    <Card>
      <CardContent className="p-6">
        <SectionHeading kicker="Platform fee" title="Re-issue platform-fee invoice" hint={<Receipt className="size-4 text-ink-3" />} />
        <p className="mb-3 text-[12.5px] text-ink-3">
          Use after correcting a fee on an order. The old invoice is cancelled and a new one is created with the updated amounts.
        </p>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            if (!orderId.trim()) return setError('Order ID required.');
            submit.mutate();
          }}
          noValidate
        >
          <div>
            <Label htmlFor="reissue-order" required>Order ID</Label>
            <Input id="reissue-order" value={orderId} onChange={(e) => setOrderId(e.target.value)} />
          </div>
          <FieldError>{error}</FieldError>
          <Button type="submit" variant="ink" caps size="sm" loading={submit.isPending}>Re-issue</Button>
        </form>
      </CardContent>
    </Card>
  );
}

function CreditNoteCard() {
  const [refundId, setRefundId] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = useMutation({
    mutationFn: () =>
      api('/admin/credit-notes/issue', {
        method: 'POST',
        body: { refundId: refundId.trim(), reason: reason.trim() },
      }),
    onSuccess: () => {
      toast.success('Credit note issued');
      setRefundId(''); setReason('');
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Credit note failed'),
  });

  return (
    <Card>
      <CardContent className="p-6">
        <SectionHeading kicker="Credit note" title="Issue against refund" hint={<FileText className="size-4 text-ink-3" />} />
        <p className="mb-3 text-[12.5px] text-ink-3">
          Issue a credit note against an existing refund. Reason is recorded for audit and surfaces on the retailer's monthly statement.
        </p>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            if (!refundId.trim()) return setError('Refund ID required.');
            if (!reason.trim()) return setError('Reason required.');
            submit.mutate();
          }}
          noValidate
        >
          <div>
            <Label htmlFor="cn-refund" required>Refund ID</Label>
            <Input id="cn-refund" value={refundId} onChange={(e) => setRefundId(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="cn-reason" required>Reason</Label>
            <textarea
              id="cn-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={500}
              className="mt-1 w-full resize-none rounded-md border border-line bg-transparent px-3 py-2 text-[13.5px] text-ink focus:outline-none focus:ring-1 focus:ring-ink/30"
            />
          </div>
          <FieldError>{error}</FieldError>
          <Button type="submit" variant="ink" caps size="sm" loading={submit.isPending}>Issue credit note</Button>
        </form>
      </CardContent>
    </Card>
  );
}

function TaxInvoiceCard() {
  const [orderId, setOrderId] = useState('');
  const [kind, setKind] = useState<'tax_invoice' | 'supplementary_invoice'>('tax_invoice');
  const [heldItemId, setHeldItemId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = useMutation({
    mutationFn: () =>
      api('/admin/invoices/issue', {
        method: 'POST',
        body: {
          orderId: orderId.trim(),
          kind,
          ...(heldItemId.trim() ? { heldItemId: heldItemId.trim() } : {}),
        },
      }),
    onSuccess: () => {
      toast.success('Invoice issued');
      setOrderId(''); setHeldItemId('');
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Issue failed'),
  });

  return (
    <Card>
      <CardContent className="p-6">
        <SectionHeading kicker="Tax invoice" title="Manual issuance" hint={<Receipt className="size-4 text-ink-3" />} />
        <p className="mb-3 text-[12.5px] text-ink-3">
          Create a one-off or extra tax invoice — usually when the system missed an item that was held.
        </p>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            if (!orderId.trim()) return setError('Order ID required.');
            submit.mutate();
          }}
          noValidate
        >
          <div>
            <Label htmlFor="ti-order" required>Order ID</Label>
            <Input id="ti-order" value={orderId} onChange={(e) => setOrderId(e.target.value)} />
          </div>
          <div>
            <Label required>Kind</Label>
            <div className="mt-1 flex gap-2">
              <Button type="button" variant={kind === 'tax_invoice' ? 'ink' : 'outline'} size="sm" onClick={() => setKind('tax_invoice')}>
                Tax invoice
              </Button>
              <Button type="button" variant={kind === 'supplementary_invoice' ? 'ink' : 'outline'} size="sm" onClick={() => setKind('supplementary_invoice')}>
                Extra
              </Button>
            </div>
          </div>
          <div>
            <Label htmlFor="ti-held">Held item ID (optional)</Label>
            <Input id="ti-held" value={heldItemId} onChange={(e) => setHeldItemId(e.target.value)} />
          </div>
          <FieldError>{error}</FieldError>
          <Button type="submit" variant="ink" caps size="sm" loading={submit.isPending}>Issue</Button>
        </form>
      </CardContent>
    </Card>
  );
}
