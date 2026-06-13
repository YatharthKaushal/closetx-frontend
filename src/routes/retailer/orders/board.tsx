/**
 * Retailer active-orders board — three visual columns (no drag-drop). Each column
 * header is a dropdown: the retailer picks which lifecycle "view" that column shows
 * (e.g. switch a column to "Returns" to see all return orders). Defaults to
 * Awaiting acceptance · Preparing · In transit & exceptions; the choice persists.
 *
 * Single-click a card → right Sheet; double-click → full detail page.
 * Try-and-buy sorts first on accept-ish views; exceptions sort to the top on
 * transit views; cards whose time window expired today sink to the column bottom.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { History, Volume2, VolumeX } from 'lucide-react';
import { api } from '@/lib/api';
import { formatPaise } from '@/lib/status';
import { playNewOrderChime, unlockAudio } from '@/lib/audio-alert';
import type { OrderListRow, OrderStatus } from '@/lib/types';
import { cardDeadline, isException, isExpiredToday, remainingMs } from '@/lib/order-deadline';
import { Page, PageHeader } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Empty } from '@/components/ui/empty';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { OrderCard } from '@/components/retailer/orders/order-card';
import { OrderSheet } from '@/components/retailer/orders/order-sheet';

const ACTIVE_STATUSES: OrderStatus[] = [
  'routing', 'accepted', 'packed', 'picked_up', 'out_for_delivery',
  'at_door', 'undelivered', 'returning_to_store', 'returned_to_store',
];

const AUDIO_PREF_KEY = 'retailer.orders.audioAlerts';
function readAudioPref(): boolean {
  try {
    return window.localStorage.getItem(AUDIO_PREF_KEY) !== '0';
  } catch {
    return true;
  }
}
function writeAudioPref(on: boolean) {
  try {
    window.localStorage.setItem(AUDIO_PREF_KEY, on ? '1' : '0');
  } catch {
    /* ignore */
  }
}

const tnbFirst = (a: OrderListRow, b: OrderListRow) =>
  Number(b.deliveryMethod === 'try_and_buy') - Number(a.deliveryMethod === 'try_and_buy');
const expiredLast = (a: OrderListRow, b: OrderListRow) =>
  Number(isExpiredToday(cardDeadline(a))) - Number(isExpiredToday(cardDeadline(b)));
const byPlaced = (a: OrderListRow, b: OrderListRow) =>
  Date.parse(a.placedAt) - Date.parse(b.placedAt);

/** Cols 1-2: expired sinks, try-and-buy first, soonest deadline first, oldest first. */
function sortAccept(a: OrderListRow, b: OrderListRow): number {
  return (
    expiredLast(a, b) ||
    tnbFirst(a, b) ||
    remainingMs(cardDeadline(a)) - remainingMs(cardDeadline(b)) ||
    byPlaced(a, b)
  );
}
/** Transit views: exceptions to top, expired sinks, soonest door deadline first, oldest first. */
function sortTransit(a: OrderListRow, b: OrderListRow): number {
  return (
    Number(isException(b)) - Number(isException(a)) ||
    expiredLast(a, b) ||
    remainingMs(cardDeadline(a)) - remainingMs(cardDeadline(b)) ||
    byPlaced(a, b)
  );
}

/** Terminal views: most-recent first (these orders are done — recency is what matters). */
const sortRecent = (a: OrderListRow, b: OrderListRow): number =>
  Date.parse(b.placedAt) - Date.parse(a.placedAt);

// Selectable column views. Each maps a label to the statuses it shows + a sort.
// `terminal` views show finished orders (delivered/completed/cancelled) which the
// board doesn't poll by default — selecting one triggers a separate fetch.
type ViewKey =
  | 'awaiting' | 'preparing' | 'transit' | 'returns' | 'at_door' | 'undelivered'
  | 'delivered' | 'completed' | 'cancelled';
type ColView = {
  label: string;
  hint: string;
  statuses: OrderStatus[];
  sort: (a: OrderListRow, b: OrderListRow) => number;
  terminal?: boolean;
};
const VIEWS: Record<ViewKey, ColView> = {
  awaiting: { label: 'Awaiting acceptance', hint: 'New orders to accept', statuses: ['routing'], sort: sortAccept },
  preparing: { label: 'Preparing', hint: 'Accepted · packing · at store', statuses: ['accepted', 'packed'], sort: sortAccept },
  transit: { label: 'In transit & exceptions', hint: 'Out for delivery · returns', statuses: ['picked_up', 'out_for_delivery', 'at_door', 'undelivered', 'returning_to_store', 'returned_to_store'], sort: sortTransit },
  returns: { label: 'Returns', hint: 'Coming back · at store', statuses: ['returning_to_store', 'returned_to_store'], sort: sortTransit },
  at_door: { label: 'At the door', hint: 'Try-on in progress', statuses: ['at_door'], sort: sortTransit },
  undelivered: { label: 'Undelivered', hint: 'Delivery failed · retrying', statuses: ['undelivered'], sort: sortTransit },
  delivered: { label: 'Delivered', hint: 'Handed to customer', statuses: ['delivered'], sort: sortRecent, terminal: true },
  completed: { label: 'Completed', hint: 'Closed & settled', statuses: ['closed'], sort: sortRecent, terminal: true },
  cancelled: { label: 'Cancelled', hint: 'Cancelled · payment failed', statuses: ['cancelled', 'payment_failed'], sort: sortRecent, terminal: true },
};
const VIEW_ORDER: ViewKey[] = ['awaiting', 'preparing', 'transit', 'returns', 'at_door', 'undelivered', 'delivered', 'completed', 'cancelled'];
const DEFAULT_VIEWS: [ViewKey, ViewKey, ViewKey] = ['awaiting', 'preparing', 'transit'];

// Statuses fetched on demand when a column shows a terminal view (recent-only).
const TERMINAL_STATUSES: OrderStatus[] = ['delivered', 'closed', 'cancelled', 'payment_failed'];

const VIEWS_PREF_KEY = 'retailer.orders.colViews';
function readViewsPref(): [ViewKey, ViewKey, ViewKey] {
  try {
    const raw = window.localStorage.getItem(VIEWS_PREF_KEY);
    if (!raw) return DEFAULT_VIEWS;
    const arr = JSON.parse(raw);
    if (Array.isArray(arr) && arr.length === 3 && arr.every((v) => v in VIEWS)) {
      return arr as [ViewKey, ViewKey, ViewKey];
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_VIEWS;
}

export default function RetailerOrdersBoard() {
  const navigate = useNavigate();
  const [audioOn, setAudioOn] = useState<boolean>(() => readAudioPref());
  const [sheetId, setSheetId] = useState<string | null>(null);
  const prevRoutingRef = useRef<Set<string> | null>(null);
  const titleBaseRef = useRef<string>(typeof document !== 'undefined' ? document.title : 'Orders');
  const newSinceFocusRef = useRef(0);

  useEffect(() => { unlockAudio(); }, []);
  useEffect(() => {
    const clear = () => { newSinceFocusRef.current = 0; document.title = titleBaseRef.current; };
    const onVis = () => { if (!document.hidden) clear(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', clear);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', clear);
      document.title = titleBaseRef.current;
    };
  }, []);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['retailer', 'orders', 'board'],
    queryFn: () =>
      api<OrderListRow[]>(`/retailer/orders?statusIn=${ACTIVE_STATUSES.join(',')}&limit=200`),
    refetchInterval: 5000,
  });

  // New-order chime + tab-title badge (diff the routing set across polls).
  useEffect(() => {
    if (!data) return;
    const routing = new Set(data.filter((o) => o.status === 'routing').map((o) => o.id));
    const prev = prevRoutingRef.current;
    if (prev === null) { prevRoutingRef.current = routing; return; }
    const fresh = [...routing].filter((id) => !prev.has(id));
    if (fresh.length > 0) {
      if (audioOn) playNewOrderChime();
      data.filter((o) => fresh.includes(o.id)).slice(0, 3).forEach((o) =>
        toast.info(`New order · ${o.itemCount} item${o.itemCount === 1 ? '' : 's'} · ${formatPaise(o.grandTotalPaise)}`),
      );
      if (typeof document !== 'undefined' && document.hidden) {
        newSinceFocusRef.current += fresh.length;
        document.title = `(${newSinceFocusRef.current}) ${titleBaseRef.current}`;
      }
    }
    prevRoutingRef.current = routing;
  }, [data, audioOn]);

  // Which view each of the 3 columns shows (persisted).
  const [colViews, setColViews] = useState<[ViewKey, ViewKey, ViewKey]>(() => readViewsPref());
  const setColView = (idx: 0 | 1 | 2, key: ViewKey) => {
    setColViews((prev) => {
      const next = [...prev] as [ViewKey, ViewKey, ViewKey];
      next[idx] = key;
      try { window.localStorage.setItem(VIEWS_PREF_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  // Finished orders (delivered/completed/cancelled) aren't part of the active
  // poll. Fetch the recent ones only when a column actually selects a terminal
  // view — keeps the default board light. Full archive lives in Order history.
  const needTerminal = colViews.some((k) => VIEWS[k].terminal);
  const { data: terminalData } = useQuery({
    queryKey: ['retailer', 'orders', 'board-terminal'],
    queryFn: () =>
      api<OrderListRow[]>(`/retailer/orders?statusIn=${TERMINAL_STATUSES.join(',')}&limit=100`),
    enabled: needTerminal,
    refetchInterval: 30000,
  });

  const all = useMemo(() => {
    const active = data ?? [];
    if (!terminalData?.length) return active;
    const seen = new Set(active.map((o) => o.id));
    return [...active, ...terminalData.filter((o) => !seen.has(o.id))];
  }, [data, terminalData]);

  const cols = useMemo(
    () =>
      colViews.map((key) => {
        const v = VIEWS[key];
        return all.filter((o) => v.statuses.includes(o.status)).sort(v.sort);
      }) as [OrderListRow[], OrderListRow[], OrderListRow[]],
    [all, colViews],
  );

  const openSheet = (id: string) => setSheetId(id);
  const openPage = (id: string) => navigate(`/retailer/orders/${id}`);

  return (
    <Page>
      <PageHeader
        title="Orders"
        description="Active orders across the lifecycle. Single-click for a quick view, double-click to open."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              iconLeft={audioOn ? <Volume2 className="size-3.5" /> : <VolumeX className="size-3.5" />}
              onClick={() => { const n = !audioOn; setAudioOn(n); writeAudioPref(n); toast.success(n ? 'Alerts unmuted' : 'Alerts muted'); }}
              title={audioOn ? 'Mute new-order chime' : 'Unmute new-order chime'}
            >
              {audioOn ? 'Alerts on' : 'Alerts muted'}
            </Button>
            <Button asChild variant="ink" size="sm" iconLeft={<History className="size-3.5" />}>
              <Link to="/retailer/orders/history">Order history</Link>
            </Button>
          </div>
        }
      />

      {isError ? (
        <Empty title="Couldn't load orders" description="Something went wrong." action={<Button onClick={() => refetch()}>Retry</Button>} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {([0, 1, 2] as const).map((i) => (
            <BoardColumn
              key={i}
              viewKey={colViews[i]}
              onViewChange={(key) => setColView(i, key)}
              loading={isLoading}
              orders={cols[i]}
              onSingle={openSheet}
              onDouble={openPage}
            />
          ))}
        </div>
      )}

      <OrderSheet orderId={sheetId} open={!!sheetId} onOpenChange={(o) => !o && setSheetId(null)} />
    </Page>
  );
}

function BoardColumn({
  viewKey,
  onViewChange,
  loading,
  orders,
  onSingle,
  onDouble,
}: {
  viewKey: ViewKey;
  onViewChange: (key: ViewKey) => void;
  loading: boolean;
  orders: OrderListRow[];
  onSingle: (id: string) => void;
  onDouble: (id: string) => void;
}) {
  return (
    <section className="flex min-h-[60vh] flex-col rounded-xl border border-rule bg-bg-2/30">
      <header className="sticky top-0 z-[1] flex items-center justify-between gap-2 rounded-t-xl border-b border-rule bg-bg-2/80 px-3 py-2.5 backdrop-blur">
        <div className="min-w-0">
          <Select value={viewKey} onValueChange={(v) => onViewChange(v as ViewKey)}>
            <SelectTrigger
              className="h-auto gap-1 border-0 bg-transparent p-0 text-[13px] font-semibold text-ink shadow-none hover:text-accent focus:ring-0"
              aria-label="Switch column view"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VIEW_ORDER.map((k) => (
                <SelectItem key={k} value={k}>{VIEWS[k].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="truncate text-[11px] text-ink-4">{VIEWS[viewKey].hint}</div>
        </div>
        <span className="shrink-0 rounded-full bg-bg-3 px-2 py-0.5 text-[11px] font-medium tabular-nums text-ink-2">
          {orders.length}
        </span>
      </header>
      <div className="flex-1 space-y-2.5 overflow-y-auto p-2.5">
        {loading ? (
          <>
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </>
        ) : orders.length === 0 ? (
          <p className="px-2 py-8 text-center text-[12.5px] text-ink-4">Nothing here.</p>
        ) : (
          orders.map((o) => (
            <OrderCard key={o.id} order={o} onSingleClick={onSingle} onDoubleClick={onDouble} />
          ))
        )}
      </div>
    </section>
  );
}
