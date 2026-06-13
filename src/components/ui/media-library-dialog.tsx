/**
 * Shopify-style media library picker. Lists everything the store has uploaded
 * (GET /retailer/media, paginated) and lets the user multi-select images to add
 * to the current product gallery. Soft-deletes here don't break products still
 * referencing the URL.
 */
import { useState } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, ImageOff, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import type { MediaItem, Paginated } from '@/lib/types';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** URLs already in the gallery — shown checked + disabled. */
  existing: string[];
  onConfirm: (urls: string[]) => void;
};

export function MediaLibraryDialog({ open, onOpenChange, existing, onConfirm }: Props) {
  const qc = useQueryClient();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const existingSet = new Set(existing);

  const query = useInfiniteQuery({
    queryKey: ['retailer', 'media'],
    enabled: open,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      api<Paginated<MediaItem>>(
        `/retailer/media?type=image&limit=40${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ''}`,
      ),
    getNextPageParam: (last) => last.nextCursor,
  });

  const del = useMutation({
    mutationFn: (id: string) => api(`/retailer/media/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Removed from library');
      void qc.invalidateQueries({ queryKey: ['retailer', 'media'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not remove'),
  });

  const items = query.data?.pages.flatMap((p) => p.items) ?? [];

  const toggle = (url: string) => {
    if (existingSet.has(url)) return;
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  };

  const confirm = () => {
    if (picked.size > 0) onConfirm([...picked]);
    setPicked(new Set());
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setPicked(new Set());
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Media library</DialogTitle>
          <DialogDescription>
            Reuse an image you've already uploaded. {picked.size > 0 && `${picked.size} selected.`}
          </DialogDescription>
        </DialogHeader>

        {query.isLoading ? (
          <div className="grid h-48 place-items-center text-ink-3">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="grid h-48 place-items-center text-center text-ink-3">
            <div>
              <ImageOff className="mx-auto mb-2 size-6" />
              <p className="text-[13px]">Nothing uploaded yet. Drop a file in the gallery to start.</p>
            </div>
          </div>
        ) : (
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
            {items.map((m) => {
              const already = existingSet.has(m.url);
              const sel = picked.has(m.url);
              return (
                <li key={m.id} className="group relative">
                  <button
                    type="button"
                    disabled={already}
                    onClick={() => toggle(m.url)}
                    className={cn(
                      'relative aspect-square w-full overflow-hidden rounded-xs border bg-paper-2 transition-all',
                      sel ? 'border-accent ring-2 ring-accent/30' : 'border-rule hover:border-ink-3',
                      already && 'cursor-not-allowed opacity-50',
                    )}
                  >
                    <img src={m.url} alt={m.folder ?? ''} loading="lazy" className="h-full w-full object-contain" />
                    {(sel || already) && (
                      <span
                        className={cn(
                          'absolute right-1.5 top-1.5 grid size-5 place-items-center rounded-full text-paper',
                          already ? 'bg-ink/60' : 'bg-accent',
                        )}
                      >
                        <Check className="size-3" />
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    title="Remove from library"
                    onClick={() => del.mutate(m.id)}
                    className="absolute left-1.5 top-1.5 grid size-5 place-items-center rounded-full bg-ink/80 text-paper opacity-0 transition-opacity hover:bg-danger group-hover:opacity-100"
                  >
                    <Trash2 className="size-2.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-5 flex items-center justify-between gap-2 border-t border-rule pt-4">
          <div>
            {query.hasNextPage && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                loading={query.isFetchingNextPage}
                onClick={() => query.fetchNextPage()}
              >
                Load more
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" variant="ink" size="sm" disabled={picked.size === 0} onClick={confirm}>
              Add {picked.size > 0 ? `${picked.size} ` : ''}image{picked.size === 1 ? '' : 's'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
