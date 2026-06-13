/** Delivery-method pill (icon + short label, tone-coloured). */
import { Package, Shirt, Store, Truck, Zap } from 'lucide-react';
import type { DeliveryMethod } from '@/lib/types';
import { deliveryMethodMeta } from '@/lib/status';
import { cn } from '@/lib/cn';

const METHOD_ICON: Record<DeliveryMethod, typeof Package> = {
  express: Zap,
  standard: Truck,
  pickup: Store,
  try_and_buy: Shirt,
};

export function MethodChip({ method, className }: { method: DeliveryMethod; className?: string }) {
  const m = deliveryMethodMeta(method);
  const Icon = METHOD_ICON[method] ?? Package;
  const toneCls =
    m.tone === 'success'
      ? 'border-success/30 bg-success-soft text-success-strong'
      : m.tone === 'info'
        ? 'border-info/30 bg-info-soft text-info'
        : m.tone === 'warning'
          ? 'border-warning/30 bg-warning-soft text-warning'
          : 'border-line bg-bg-2 text-ink-2';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide',
        toneCls,
        className,
      )}
      title={m.label}
    >
      <Icon className="size-3" />
      {m.short}
    </span>
  );
}
