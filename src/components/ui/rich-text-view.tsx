import { cn } from '@/lib/cn';

/**
 * Renders server-sanitized rich HTML (product long descriptions).
 *
 * Only ever feed this `descriptionLong` as returned by the API —
 * sanitize-on-write (backend shared/sanitize/rich-text.ts) is the safety
 * boundary that makes the dangerouslySetInnerHTML below safe. Styling comes
 * from the `.rich-text` block in styles/index.css.
 *
 * Kept separate from rich-text-editor.tsx so read-only consumers don't pull
 * the whole Tiptap bundle.
 */
export function RichTextView({ html, className }: { html: string; className?: string }) {
  return (
    <div
      className={cn('rich-text', className)}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
