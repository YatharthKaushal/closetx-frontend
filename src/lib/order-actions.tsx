/**
 * Single source of truth for retailer order actions.
 *
 * `deriveOrderActions` turns an order (list row or full detail) into an ordered
 * list of actions with stable labels/variants/icons and per-state enablement.
 * The SAME definitions drive the kanban card buttons, history-row 3-dots menu,
 * the right Sheet's action bar, and the full detail page — so wording and design
 * never drift. Invalid-but-applicable actions are returned disabled with a
 * reason (shown on hover) rather than hidden; actions that never apply to the
 * order's kind are omitted.
 */
import type { ReactNode } from 'react';
import {
  AlertTriangle,
  Box,
  Check,
  CheckCircle2,
  DoorOpen,
  Download,
  FileWarning,
  HandCoins,
  PackageCheck,
  RotateCcw,
  Send,
  ShieldAlert,
  Store,
  Truck,
  XCircle,
} from 'lucide-react';
import type { OrderDetail, OrderListRow, OrderStatus } from '@/lib/types';
import type { ButtonProps } from '@/components/ui/button';

export type OrderActionKey =
  | 'accept'
  | 'pack'
  | 'pickup-handover'
  | 'handover'
  | 'depart'
  | 'mark-delivered'
  | 'mark-undelivered'
  | 'confirm-received'
  | 'accept-return'
  | 'decline-return'
  | 'request-cancel'
  | 'door-visit'
  | 'counter-return'
  | 'tax-invoice'
  | 'raise-issue'
  | 'request-refund';

// 'returns' actions resolve the pending return(s) via the runner (it fetches
// detail on click), so they work from card/row/sheet without prior detail.
export type OrderActionKind = 'mutation' | 'dialog' | 'download' | 'returns';

/** Dialog actions resolve to one of these shared confirm UIs in the runner. */
export type OrderConfirmKind =
  | 'request-cancel'
  | 'mark-undelivered'
  | 'handover'
  | 'pickup-handover'
  | 'counter-return'
  | 'door-close'
  | 'decline-return'
  | 'raise-issue'
  | 'request-refund';

export interface OrderAction {
  key: OrderActionKey;
  label: string;
  variant: ButtonProps['variant'];
  icon: ReactNode;
  kind: OrderActionKind;
  /** POST suffix under /retailer/orders/:id/ — for kind 'mutation'. */
  endpoint?: string;
  /** Which shared dialog to open — for kind 'dialog'. */
  confirm?: OrderConfirmKind;
  enabled: boolean;
  disabledReason?: string;
  /** The one lead CTA for the order's current state. */
  primary?: boolean;
  /** Only surfaced on the full detail page (not card/row/sheet bar). */
  detailOnly?: boolean;
}

type Def = Pick<OrderAction, 'label' | 'variant' | 'icon' | 'kind' | 'endpoint' | 'confirm' | 'detailOnly'>;

/** Stable label/variant/icon/kind per action — the design source of truth. */
const ACTION_DEF: Record<OrderActionKey, Def> = {
  accept: { label: 'Accept order', variant: 'accent', icon: <Check className="size-3.5" />, kind: 'mutation', endpoint: 'accept' },
  pack: { label: 'Mark as packed', variant: 'accent', icon: <Box className="size-3.5" />, kind: 'mutation', endpoint: 'pack' },
  'pickup-handover': { label: 'Hand to customer', variant: 'accent', icon: <Store className="size-3.5" />, kind: 'dialog', confirm: 'pickup-handover' },
  handover: { label: 'Hand to delivery', variant: 'accent', icon: <Truck className="size-3.5" />, kind: 'dialog', confirm: 'handover' },
  depart: { label: 'Out for delivery', variant: 'accent', icon: <Send className="size-3.5" />, kind: 'mutation', endpoint: 'depart' },
  'mark-delivered': { label: 'Mark delivered', variant: 'accent', icon: <CheckCircle2 className="size-3.5" />, kind: 'mutation', endpoint: 'mark-delivered' },
  'mark-undelivered': { label: 'Mark undelivered', variant: 'outline', icon: <XCircle className="size-3.5" />, kind: 'dialog', confirm: 'mark-undelivered' },
  'confirm-received': { label: 'Confirm goods received', variant: 'accent', icon: <PackageCheck className="size-3.5" />, kind: 'mutation', endpoint: 'confirm-return-received' },
  'accept-return': { label: 'Accept return', variant: 'accent', icon: <Check className="size-3.5" />, kind: 'returns' },
  'decline-return': { label: 'Decline & dispute', variant: 'danger', icon: <ShieldAlert className="size-3.5" />, kind: 'dialog', confirm: 'decline-return' },
  'request-cancel': { label: 'Request cancellation', variant: 'outline', icon: <AlertTriangle className="size-3.5" />, kind: 'dialog', confirm: 'request-cancel' },
  'door-visit': { label: 'Door visit', variant: 'accent', icon: <DoorOpen className="size-3.5" />, kind: 'dialog', confirm: 'door-close' },
  'counter-return': { label: 'Counter return', variant: 'outline', icon: <RotateCcw className="size-3.5" />, kind: 'dialog', confirm: 'counter-return' },
  'tax-invoice': { label: 'Tax invoice', variant: 'outline', icon: <Download className="size-3.5" />, kind: 'download', detailOnly: true },
  'raise-issue': { label: 'Raise dispute', variant: 'outline', icon: <FileWarning className="size-3.5" />, kind: 'dialog', confirm: 'raise-issue', detailOnly: true },
  'request-refund': { label: 'Request refund', variant: 'outline', icon: <HandCoins className="size-3.5" />, kind: 'dialog', confirm: 'request-refund', detailOnly: true },
};

const TERMINAL: OrderStatus[] = ['delivered', 'cancelled', 'closed', 'payment_failed'];
const COUNTER_RETURN_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function isPickup(o: OrderListRow | OrderDetail): boolean {
  return o.deliveryMethod === 'pickup';
}

/** When detail is loaded, the state machine is authoritative for transitions. */
function canTransition(detail: OrderDetail | undefined, to: OrderStatus): boolean | null {
  if (!detail) return null; // unknown — fall back to status heuristics
  return detail.availableTransitions.some((t) => t.to === to && t.actors.includes('retailer'));
}

type Surface = 'card' | 'row' | 'sheet' | 'page';

/**
 * Build the ordered action list for an order. `opts.detail` (full order) tightens
 * enablement via availableTransitions; `opts.surface` controls whether
 * detail-only actions are included.
 */
export function deriveOrderActions(
  o: OrderListRow | OrderDetail,
  opts: { detail?: OrderDetail; surface: Surface },
): OrderAction[] {
  const { detail, surface } = opts;
  const status = o.status;
  const out: OrderAction[] = [];

  // Is a return awaiting the store's decision? Detail is authoritative; list rows
  // carry hasPendingReturn. Return actions are handled in the dedicated panel on
  // the full page, so they're surfaced on card/row/sheet only.
  const hasPendingReturn = detail
    ? (detail.returns ?? []).some((r) => r.storeDecision === 'pending')
    : 'hasPendingReturn' in o
      ? Boolean((o as OrderListRow).hasPendingReturn)
      : false;
  const showReturnActions = hasPendingReturn && surface !== 'page';

  const add = (key: OrderActionKey, over: Partial<OrderAction> = {}) => {
    out.push({ ...ACTION_DEF[key], key, enabled: true, ...over });
  };
  /** Enable only if the state machine allows it (when known); else trust the status branch. */
  const gated = (key: OrderActionKey, to: OrderStatus, over: Partial<OrderAction> = {}) => {
    const allowed = canTransition(detail, to);
    if (allowed === false) {
      add(key, { ...over, primary: false, enabled: false, disabledReason: 'Not available in the current state' });
    } else {
      add(key, over);
    }
  };

  // Request-cancel only makes sense pre-shipment (routing/accepted/packed). Once
  // the order is in transit or coming back as a return, the meaningful actions
  // are delivery/return decisions — a cancel request there is just noise.
  switch (status) {
    case 'routing':
      gated('accept', 'accepted', { primary: true });
      add('request-cancel');
      break;
    case 'accepted':
      gated('pack', 'packed', { primary: true });
      add('request-cancel');
      break;
    case 'packed':
      if (isPickup(o)) add('pickup-handover', { primary: true });
      else gated('handover', 'picked_up', { primary: true });
      add('request-cancel');
      break;
    case 'picked_up':
      gated('depart', 'out_for_delivery', { primary: true });
      break;
    case 'out_for_delivery':
      gated('mark-delivered', 'delivered', { primary: true });
      gated('mark-undelivered', 'undelivered');
      break;
    case 'at_door':
      add('door-visit', { primary: true });
      gated('mark-undelivered', 'undelivered');
      break;
    case 'undelivered':
      // Retailer has nothing to do — the system auto-retries or routes back.
      break;
    case 'returning_to_store':
      // Goods in transit back. If the customer return is already decidable,
      // surface accept/decline; otherwise let the retailer confirm receipt.
      if (showReturnActions) {
        add('accept-return', { primary: true });
        add('decline-return');
      } else {
        add('confirm-received', { primary: true });
      }
      break;
    case 'returned_to_store':
      if (showReturnActions) {
        add('accept-return', { primary: true });
        add('decline-return');
      }
      break;
    case 'delivered': {
      const deliveredMs = o.deliveredAt ? Date.parse(o.deliveredAt) : null;
      const withinWindow = deliveredMs !== null && Date.now() - deliveredMs <= COUNTER_RETURN_WINDOW_MS;
      add('counter-return', {
        primary: false,
        enabled: withinWindow,
        ...(withinWindow ? {} : { disabledReason: 'Return window has closed (7 days)' }),
      });
      break;
    }
    default:
      // pending / confirmed / cancelled / closed / payment_failed — no live action.
      break;
  }

  // Detail-only extras on the full page. When a dispute is already open on this
  // order, don't re-offer raise-dispute / request-refund — the page shows a
  // "dispute open" banner instead. (The action key stays 'raise-issue'
  // internally; the customerIssues table is the backing store.)
  if (surface === 'page') {
    add('tax-invoice');
    const hasOpenDispute = !!detail?.openDispute;
    if (!hasOpenDispute) {
      add('raise-issue');
      add('request-refund', {
        enabled: !TERMINAL.includes(status) || status === 'delivered',
        ...(TERMINAL.includes(status) && status !== 'delivered'
          ? { disabledReason: 'Order is closed — no refund possible' }
          : {}),
      });
    }
  }

  return out;
}
