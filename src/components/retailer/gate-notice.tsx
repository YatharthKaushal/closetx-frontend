import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Gate } from '@/lib/gate';

type Config = {
  kicker: string;
  kickerTone: 'warning' | 'danger' | 'info';
  title: ReactNode;
  body: ReactNode;
  cta: { label: string; href: string } | null;
};

function configFor(gate: Exclude<Gate, { state: 'ready' }>): Config {
  switch (gate.state) {
    case 'retailer_pending':
      return {
        kicker: 'Awaiting admin approval',
        kickerTone: 'warning',
        title: <>Your account is being reviewed.</>,
        body: (
          <>
            Once admin approves your account, your store is created automatically and
            you'll be able to publish products.
          </>
        ),
        cta: { label: 'Go to overview', href: '/retailer/dashboard' },
      };
    case 'retailer_terminated':
      return {
        kicker: 'Account terminated — read-only',
        kickerTone: 'danger',
        title: <>This account has been terminated.</>,
        body: (
          <>
            You can still view your orders, invoices, and statements for
            record-keeping, but nothing can be created or changed. Contact admin
            if you think this is a mistake.
          </>
        ),
        cta: { label: 'View invoices', href: '/retailer/invoices' },
      };
    case 'no_store':
      return {
        kicker: 'Store not provisioned',
        kickerTone: 'info',
        title: <>Your store is being set up.</>,
        body: (
          <>
            Your store is created automatically when Trendzo approves your application.
            If this persists after approval, contact admin.
          </>
        ),
        cta: { label: 'Go to overview', href: '/retailer/dashboard' },
      };
    case 'store_pending':
      return {
        kicker: 'Storefront awaiting approval',
        kickerTone: 'warning',
        title: <>Your storefront is being reviewed.</>,
        body: (
          <>
            You'll be able to publish products once admin approves your storefront.
            Your platform fee and how often you're paid are set at that time.
          </>
        ),
        cta: { label: 'View storefront', href: '/retailer/store' },
      };
    case 'store_blocked':
      return {
        kicker: 'Storefront unavailable',
        kickerTone: 'danger',
        title: <>Your storefront is currently <em>{gate.status}</em>.</>,
        body: <>Contact admin to restore it.</>,
        cta: null,
      };
    case 'kyc_overdue':
      return {
        kicker: 'KYC re-verification overdue',
        kickerTone: 'warning',
        title: <>Re-submit KYC to keep selling.</>,
        body: <>Your re-verification was due {new Date(gate.dueAt).toLocaleDateString()}. Upload the requested documents to clear the warning.</>,
        cta: { label: 'Resubmit KYC', href: '/retailer/kyc' },
      };
    case 'floor_breached':
      return {
        kicker: 'Below the required standard',
        kickerTone: 'warning',
        title: <>Your store is below the required level for {gate.metric}.</>,
        body: <>If this keeps happening, the warnings get more serious. Check the number and fix it.</>,
        cta: { label: 'View dashboard', href: '/retailer/dashboard' },
      };
    case 'suspended':
      return {
        kicker: 'Account suspended',
        kickerTone: 'danger',
        title: <>This account has been suspended.</>,
        body: <>{gate.reason ?? 'Contact admin to discuss restoration.'}</>,
        cta: null,
      };
  }
}

const kickerToneClass: Record<Config['kickerTone'], string> = {
  warning: 'text-warning',
  danger: 'text-danger',
  info: 'text-info',
};

/**
 * Big paper-card banner explaining why a mutation page can't act yet, with the
 * recommended next step. Renders nothing when the gate is `ready`.
 */
export function GateNotice({ gate }: { gate: Gate }) {
  if (gate.state === 'ready') return null;
  const config = configFor(gate);
  return (
    <section
      className="border border-rule-strong bg-paper-2/50 p-6 sm:p-8 rounded-xs"
      role="status"
    >
      <div className={`kicker mb-3 ${kickerToneClass[config.kickerTone]}`}>
        — {config.kicker} —
      </div>
      <h2 className="font-display italic text-[26px] sm:text-[30px] leading-tight tracking-tight text-ink">
        {config.title}
      </h2>
      <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-ink-2">{config.body}</p>
      {config.cta && (
        <Button
          asChild
          variant="ink"
          caps
          size="sm"
          className="mt-6"
          iconRight={<ArrowUpRight className="size-3.5" />}
        >
          <Link to={config.cta.href}>{config.cta.label}</Link>
        </Button>
      )}
    </section>
  );
}
