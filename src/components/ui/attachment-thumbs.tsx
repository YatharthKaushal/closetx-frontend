import { FileText } from 'lucide-react';

/**
 * Inline attachment previews. Image URLs render as thumbnails shown then-and-there
 * (no "View" click / external redirect needed); non-image files fall back to a small
 * labelled chip link. Used in dispute message threads + evidence lists.
 */
const IMAGE_RE = /\.(png|jpe?g|gif|webp|avif|bmp|svg)(\?|#|$)/i;
// Cloudinary image delivery URLs aren't always suffixed with an extension.
const isImageUrl = (url: string) => IMAGE_RE.test(url) || /\/image\/upload\//.test(url);

export function AttachmentThumbs({
  urls,
  size = 'md',
  className,
}: {
  urls: string[];
  size?: 'sm' | 'md';
  className?: string;
}) {
  if (!urls?.length) return null;
  const dim = size === 'sm' ? 'size-16' : 'size-24';
  return (
    <div className={'flex flex-wrap gap-2 ' + (className ?? '')}>
      {urls.map((url, i) =>
        isImageUrl(url) ? (
          <a
            key={i}
            href={url}
            target="_blank"
            rel="noreferrer"
            className={`block ${dim} overflow-hidden rounded-md border border-line bg-bg-2`}
            title="Open full size"
          >
            <img src={url} alt={`Attachment ${i + 1}`} loading="lazy" className="size-full object-cover" />
          </a>
        ) : (
          <a
            key={i}
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex max-w-[200px] items-center gap-1 rounded-md border border-line bg-bg px-2 py-1 text-[11.5px] text-accent hover:bg-bg-2"
          >
            <FileText className="size-3 shrink-0" />
            <span className="truncate">{url.split('/').pop()}</span>
          </a>
        ),
      )}
    </div>
  );
}
