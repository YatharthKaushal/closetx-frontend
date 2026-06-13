import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/cn';

/**
 * Click-to-copy mono chip for IDs / order numbers / payment refs.
 * Truncates middle on narrow widths; full id on hover via title.
 */
export function CopyableId({
  value,
  label,
  className,
  full = false,
}: {
  value: string;
  label?: string;
  className?: string;
  /** Show the whole id (no middle truncation). Default truncates at 140px. */
  full?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(`Copied ${label ?? 'id'}`);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      toast.error('Could not copy to clipboard');
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      title={value}
      className={cn(
        'inline-flex items-center gap-1.5 rounded border border-line bg-bg-2 px-1.5 py-0.5 ' +
          'font-mono text-[11px] text-ink-2 hover:border-line-2 hover:text-ink hover:bg-bg-3 transition-colors',
        className,
      )}
    >
      <span className={full ? 'break-all' : 'truncate max-w-[140px]'}>{value}</span>
      {copied ? (
        <Check className="size-3 text-success shrink-0" />
      ) : (
        <Copy className="size-3 text-ink-4 shrink-0" />
      )}
    </button>
  );
}
