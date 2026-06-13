/**
 * Product media gallery (wizard Step 1). Big main image on top, a sortable
 * thumbnail strip below, and an always-visible upload zone pinned at the bottom
 * that never disappears — plus "Select from library" and "Generate with AI".
 *
 *  - First URL in `urls` is the cover/main image. Any thumbnail can be promoted
 *    via "Set as main" (reorder-to-front) or by dragging it to the front.
 *  - The drop zone accepts MULTIPLE files. A single file routes through the crop
 *    dialog; multiple files upload as-is with sequential progress.
 *  - Every upload is recorded in the store media library (recordToLibrary).
 */
import { lazy, Suspense, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ImageOff,
  Images,
  Loader2,
  Sparkles,
  Star,
  Upload,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { uploadMedia } from '@/lib/upload';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { MediaLibraryDialog } from '@/components/ui/media-library-dialog';

const CropDialog = lazy(() => import('./crop-dialog'));

const LISTING_GALLERY_MAX_BYTES = 5 * 1024 * 1024;
const LISTING_GALLERY_MIMES: Record<string, string[]> = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
};

type Props = {
  urls: string[];
  onChange: (next: string[]) => void;
  uploadFolder: string;
  maxImages?: number;
  /** Enables the "Generate with AI" affordance (needs a saved draft). */
  onRequestAiGenerate?: (() => void) | undefined;
};

export function MediaGalleryV2({ urls, onChange, uploadFolder, maxImages = 20, onRequestAiGenerate }: Props) {
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);

  const atCapacity = urls.length >= maxImages;
  // What shows in the big slot: the explicit preview, else the cover.
  const mainUrl = (previewUrl && urls.includes(previewUrl) ? previewUrl : urls[0]) ?? null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function uploadOne(file: File) {
    const res = await uploadMedia(file, {
      folder: uploadFolder,
      purpose: 'listing-gallery',
      recordToLibrary: true,
    });
    return res.url;
  }

  async function handleFiles(files: File[]) {
    const room = maxImages - urls.length;
    if (room <= 0) {
      toast.error(`At most ${maxImages} images allowed`);
      return;
    }
    const batch = files.slice(0, room);
    if (batch.length < files.length) {
      toast.warning(`Only ${room} more image${room === 1 ? '' : 's'} fit — extras skipped.`);
    }
    // A single file gets the crop step; multiple upload directly.
    if (batch.length === 1) {
      setPickedFile(batch[0]!);
      return;
    }
    setUploading(true);
    setProgress({ done: 0, total: batch.length });
    const added: string[] = [];
    for (let i = 0; i < batch.length; i++) {
      try {
        added.push(await uploadOne(batch[i]!));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : `Upload failed for image ${i + 1}`);
      }
      setProgress({ done: i + 1, total: batch.length });
    }
    if (added.length) onChange([...urls, ...added]);
    setUploading(false);
    setProgress(null);
    if (added.length) toast.success(`${added.length} image${added.length === 1 ? '' : 's'} added`);
  }

  const handleCropConfirm = async (blob: Blob, originalName: string) => {
    if (blob.size > LISTING_GALLERY_MAX_BYTES) {
      toast.error('Image too large after crop — keep it under 5 MB');
      return;
    }
    setUploading(true);
    try {
      const file = new File([blob], originalName, { type: blob.type || 'image/jpeg' });
      onChange([...urls, await uploadOne(file)]);
      setPickedFile(null);
      toast.success('Image added');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive, isDragReject, open } = useDropzone({
    accept: LISTING_GALLERY_MIMES,
    multiple: true,
    maxSize: LISTING_GALLERY_MAX_BYTES,
    noClick: false,
    disabled: atCapacity || uploading,
    onDrop: (accepted, rejected) => {
      if (rejected.length > 0) {
        toast.error(rejected[0]?.errors?.[0]?.message ?? 'Some files were rejected.');
      }
      if (accepted.length > 0) void handleFiles(accepted);
    },
  });

  const setAsMain = (url: string) => {
    onChange([url, ...urls.filter((u) => u !== url)]);
    setPreviewUrl(url);
  };
  const remove = (url: string) => {
    onChange(urls.filter((u) => u !== url));
    if (previewUrl === url) setPreviewUrl(null);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = urls.indexOf(active.id as string);
    const newIndex = urls.indexOf(over.id as string);
    if (oldIndex < 0 || newIndex < 0) return;
    onChange(arrayMove(urls, oldIndex, newIndex));
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Big main image */}
      <div className="relative aspect-square overflow-hidden rounded-lg border border-rule bg-paper-2">
        {mainUrl ? (
          <>
            <img src={mainUrl} alt="" className="h-full w-full object-contain" />
            <span className="absolute left-3 top-3 rounded-full bg-ink/90 px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-paper">
              {mainUrl === urls[0] ? 'Cover' : 'Preview'}
            </span>
            <div className="absolute right-3 top-3 flex gap-1.5">
              {mainUrl !== urls[0] && (
                <Button
                  type="button"
                  variant="solid"
                  size="xs"
                  iconLeft={<Star className="size-3" />}
                  onClick={() => setAsMain(mainUrl)}
                >
                  Set as main
                </Button>
              )}
              <button
                type="button"
                onClick={() => remove(mainUrl)}
                aria-label="Remove image"
                className="grid size-7 place-items-center rounded-full bg-ink/85 text-paper hover:bg-danger"
              >
                <X className="size-3.5" />
              </button>
            </div>
          </>
        ) : (
          <div className="grid h-full place-items-center text-ink-4">
            <div className="text-center">
              <ImageOff className="mx-auto mb-2 size-8" />
              <p className="text-[12.5px]">No images yet — add at least one to publish</p>
            </div>
          </div>
        )}
      </div>

      {/* Thumbnail strip */}
      {urls.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={urls} strategy={horizontalListSortingStrategy}>
            <ul className="flex flex-wrap gap-2">
              {urls.map((url, i) => (
                <Thumb
                  key={url}
                  url={url}
                  isCover={i === 0}
                  isPreview={url === mainUrl}
                  onSelect={() => setPreviewUrl(url)}
                  onSetMain={() => setAsMain(url)}
                  onRemove={() => remove(url)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      {/* Pinned upload zone — always visible */}
      <div
        {...getRootProps()}
        className={cn(
          'group relative cursor-pointer rounded-lg border-2 border-dashed px-5 py-6 text-center transition-colors',
          isDragReject
            ? 'border-danger bg-danger-soft/40'
            : isDragActive
              ? 'border-accent bg-accent-soft/60'
              : 'border-rule-strong bg-paper-2/30 hover:border-ink hover:bg-paper-2/50',
          (atCapacity || uploading) && 'pointer-events-none opacity-60',
        )}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-1.5">
          {uploading ? (
            <>
              <Loader2 className="size-5 animate-spin text-ink-2" />
              <p className="text-[13px] text-ink-2">
                {progress ? `Uploading ${progress.done}/${progress.total}…` : 'Uploading…'}
              </p>
            </>
          ) : (
            <>
              <span className="grid size-9 place-items-center rounded-full bg-paper-2 text-ink-2">
                <Upload className="size-4" />
              </span>
              <p className="text-[13.5px] text-ink">
                {atCapacity ? (
                  'Gallery full — remove one to add another'
                ) : (
                  <>
                    <span className="font-medium">Drop images</span> or click to choose
                  </>
                )}
              </p>
              <p className="text-[11px] uppercase tracking-[0.12em] text-ink-3">
                JPG · PNG · WebP · up to 5 MB · {urls.length}/{maxImages}
              </p>
            </>
          )}
        </div>
      </div>

      {/* Source actions */}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          iconLeft={<Images className="size-3.5" />}
          disabled={atCapacity}
          onClick={() => setLibraryOpen(true)}
        >
          Select from library
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          iconLeft={<Upload className="size-3.5" />}
          disabled={atCapacity || uploading}
          onClick={open}
        >
          Upload files
        </Button>
        {onRequestAiGenerate && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            iconLeft={<Sparkles className="size-3.5" />}
            disabled={atCapacity}
            onClick={onRequestAiGenerate}
          >
            Generate with AI
          </Button>
        )}
      </div>

      <MediaLibraryDialog
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
        existing={urls}
        onConfirm={(picked) => {
          const room = maxImages - urls.length;
          const add = picked.filter((u) => !urls.includes(u)).slice(0, room);
          if (add.length) onChange([...urls, ...add]);
        }}
      />

      <Suspense fallback={null}>
        {pickedFile && (
          <CropDialog
            file={pickedFile}
            onCancel={() => setPickedFile(null)}
            onConfirm={handleCropConfirm}
            uploading={uploading}
          />
        )}
      </Suspense>
    </div>
  );
}

function Thumb({
  url,
  isCover,
  isPreview,
  onSelect,
  onSetMain,
  onRemove,
}: {
  url: string;
  isCover: boolean;
  isPreview: boolean;
  onSelect: () => void;
  onSetMain: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: url,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
  };
  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        'group relative size-16 overflow-hidden rounded-xs border bg-paper-2',
        isPreview ? 'border-ink ring-1 ring-ink/20' : 'border-rule',
        isDragging && 'shadow-lg',
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        onClick={onSelect}
        className="absolute inset-0 cursor-grab active:cursor-grabbing"
        aria-label="Select / drag image"
      >
        <img src={url} alt="" loading="lazy" className="h-full w-full object-contain" draggable={false} />
      </button>
      {isCover && (
        <span className="absolute left-0.5 top-0.5 rounded-sm bg-ink/90 px-1 py-px text-[8px] uppercase tracking-wide text-paper">
          Main
        </span>
      )}
      <div className="absolute inset-x-0 bottom-0 flex justify-between bg-ink/70 opacity-0 transition-opacity group-hover:opacity-100">
        {!isCover && (
          <button
            type="button"
            title="Set as main"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onSetMain();
            }}
            className="grid flex-1 place-items-center py-0.5 text-paper hover:bg-accent"
          >
            <Star className="size-3" />
          </button>
        )}
        <button
          type="button"
          title="Remove"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="grid flex-1 place-items-center py-0.5 text-paper hover:bg-danger"
        >
          <X className="size-3" />
        </button>
      </div>
    </li>
  );
}
