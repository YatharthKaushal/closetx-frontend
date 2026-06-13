/**
 * Rich-text editor for product long descriptions, built on Tiptap v3.
 *
 * Controlled component: `value` is an HTML string, `onChange` fires with the
 * editor's HTML on every document change — plugs straight into
 * react-hook-form via watch/setValue. Images are uploaded through the
 * platform's `/uploads` endpoint (purpose `listing-description`) and inserted
 * by URL; base64 paste is disabled so everything we render is Cloudinary-hosted.
 *
 * The HTML produced here is re-sanitized server-side on write
 * (backend shared/sanitize/rich-text.ts) — keep the extension set in sync with
 * that allow-list (headings h2-h4, marks, lists, blockquote/hr, tables, links,
 * images, span color).
 *
 * Heavy dependency — consumers should `lazy(() => import(...))` this module
 * (see `crop-dialog` precedent in media-gallery.tsx).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Image from '@tiptap/extension-image';
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table';
import { CharacterCount, Placeholder } from '@tiptap/extensions';
import { HexColorPicker } from 'react-colorful';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  TextQuote,
  Minus,
  Table as TableIcon,
  ImagePlus,
  Link2,
  Link2Off,
  Undo2,
  Redo2,
  Palette,
  Loader2,
  ChevronDown,
  Rows3,
  Columns3,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/cn';
import { uploadMedia } from '@/lib/upload';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const CHAR_LIMIT = 20_000;

/** Quick palette for text colour; the wheel covers everything else. */
const COLOR_PRESETS = ['#0a0a0a', '#dc2626', '#d97706', '#16a34a', '#2563eb', '#9333ea'];

type RichTextEditorProps = {
  /** Current HTML document. Empty string = empty editor. */
  value: string;
  onChange: (html: string) => void;
  /** Cloudinary sub-folder for images inserted via the toolbar. */
  uploadFolder: string;
  placeholder?: string;
  className?: string;
};

export function RichTextEditor({
  value,
  onChange,
  uploadFolder,
  placeholder = 'Write the full description — headings, lists, tables and images are supported…',
  className,
}: RichTextEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        // Not in the server allow-list — keep the doc model aligned with it.
        codeBlock: false,
        code: false,
        link: {
          openOnClick: false,
          autolink: true,
          defaultProtocol: 'https',
        },
      }),
      TextStyle,
      Color.configure({ types: [TextStyle.name] }),
      Image.configure({ inline: false, allowBase64: false }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({ placeholder }),
      CharacterCount.configure({ limit: CHAR_LIMIT }),
    ],
    content: value || '',
    onUpdate: ({ editor: e }) => onChange(e.isEmpty ? '' : e.getHTML()),
    editorProps: {
      attributes: {
        class: 'rich-text focus:outline-none min-h-[200px] px-3.5 py-3',
      },
    },
  });

  // External value → editor (e.g. form reset). Guarded so our own onUpdate
  // round-trip doesn't reset the cursor. Initial content is handled by the
  // `content` option above; until the editor finishes initializing,
  // getHTML()'s serializer isn't ready, so bail early.
  useEffect(() => {
    if (!editor || !editor.isInitialized || editor.isDestroyed) return;
    const current = editor.isEmpty ? '' : editor.getHTML();
    if (value !== current) {
      editor.commands.setContent(value || '', { emitUpdate: false });
    }
  }, [editor, value]);

  const pickImage = useCallback(() => fileInputRef.current?.click(), []);

  const handleImageFile = useCallback(
    async (file: File | undefined) => {
      if (!file || !editor) return;
      setUploadingImage(true);
      try {
        const res = await uploadMedia(file, {
          purpose: 'listing-description',
          folder: uploadFolder,
        });
        editor.chain().focus().setImage({ src: res.url, alt: file.name }).run();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Image upload failed');
      } finally {
        setUploadingImage(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    },
    [editor, uploadFolder],
  );

  if (!editor) return null;

  return (
    <div className={cn('rounded-md border border-line-2 bg-bg focus-within:border-ink', className)}>
      <Toolbar editor={editor} onPickImage={pickImage} uploadingImage={uploadingImage} />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => void handleImageFile(e.target.files?.[0])}
      />
      <div className="max-h-[560px] overflow-y-auto">
        <EditorContent editor={editor} />
      </div>
      <Footer editor={editor} />
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Toolbar                                                                    */
/* ------------------------------------------------------------------------- */

function Toolbar({
  editor,
  onPickImage,
  uploadingImage,
}: {
  editor: Editor;
  onPickImage: () => void;
  uploadingImage: boolean;
}) {
  // v3 doesn't re-render on transactions by default — select the active states
  // we actually paint so toggles light up as the cursor moves. The selector
  // also runs before the editor view mounts, when command internals are still
  // null — bail to inert defaults until `isInitialized`.
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      if (!e.isInitialized || e.isDestroyed) {
        return {
          bold: false,
          italic: false,
          underline: false,
          strike: false,
          bulletList: false,
          orderedList: false,
          blockquote: false,
          link: false,
          inTable: false,
          color: '',
          block: 'Text',
          canUndo: false,
          canRedo: false,
        };
      }
      return {
        bold: e.isActive('bold'),
        italic: e.isActive('italic'),
        underline: e.isActive('underline'),
        strike: e.isActive('strike'),
        bulletList: e.isActive('bulletList'),
        orderedList: e.isActive('orderedList'),
        blockquote: e.isActive('blockquote'),
        link: e.isActive('link'),
        inTable: e.isActive('table'),
        color: (e.getAttributes('textStyle').color as string | undefined) ?? '',
        block: e.isActive('heading', { level: 2 })
          ? 'H2'
          : e.isActive('heading', { level: 3 })
            ? 'H3'
            : e.isActive('heading', { level: 4 })
              ? 'H4'
              : 'Text',
        canUndo: e.can().undo(),
        canRedo: e.can().redo(),
      };
    },
  });

  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 rounded-t-md border-b border-line bg-bg-2 px-1.5 py-1">
      {/* Block type */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="xs" className="w-16 justify-between">
            {s.block}
            <ChevronDown className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onSelect={() => editor.chain().focus().setParagraph().run()}>
            Text
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          >
            <span className="text-[15px] font-semibold">Heading 2</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          >
            <span className="text-[14px] font-semibold">Heading 3</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
          >
            <span className="text-[13px] font-semibold">Heading 4</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Divider />

      <ToolButton
        label="Bold"
        active={s.bold}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="size-4" />
      </ToolButton>
      <ToolButton
        label="Italic"
        active={s.italic}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="size-4" />
      </ToolButton>
      <ToolButton
        label="Underline"
        active={s.underline}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <UnderlineIcon className="size-4" />
      </ToolButton>
      <ToolButton
        label="Strikethrough"
        active={s.strike}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <Strikethrough className="size-4" />
      </ToolButton>

      <ColorButton editor={editor} current={s.color} />

      <Divider />

      <ToolButton
        label="Bullet list"
        active={s.bulletList}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="size-4" />
      </ToolButton>
      <ToolButton
        label="Numbered list"
        active={s.orderedList}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="size-4" />
      </ToolButton>
      <ToolButton
        label="Quote"
        active={s.blockquote}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <TextQuote className="size-4" />
      </ToolButton>
      <ToolButton
        label="Divider line"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      >
        <Minus className="size-4" />
      </ToolButton>

      <Divider />

      <TableMenu editor={editor} inTable={s.inTable} />

      <ToolButton label="Insert image" onClick={onPickImage} disabled={uploadingImage}>
        {uploadingImage ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <ImagePlus className="size-4" />
        )}
      </ToolButton>

      <LinkButton editor={editor} active={s.link} />

      <div className="ml-auto flex items-center gap-0.5">
        <ToolButton
          label="Undo"
          disabled={!s.canUndo}
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo2 className="size-4" />
        </ToolButton>
        <ToolButton
          label="Redo"
          disabled={!s.canRedo}
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo2 className="size-4" />
        </ToolButton>
      </div>
    </div>
  );
}

function ToolButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      className={cn(active && 'bg-bg-4 text-ink')}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

function Divider() {
  return <span className="mx-1 h-5 w-px bg-line-2" aria-hidden />;
}

/* Colour picker — compact icon trigger, wheel + presets + clear. */
function ColorButton({ editor, current }: { editor: Editor; current: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          title="Text colour"
          aria-label="Text colour"
          className={cn(current && 'text-ink')}
        >
          <span className="relative">
            <Palette className="size-4" />
            <span
              className="absolute -bottom-1 left-0 h-[3px] w-full rounded-full"
              style={{ background: current || 'transparent' }}
            />
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <HexColorPicker
          color={current || '#0a0a0a'}
          onChange={(c) => editor.chain().focus().setColor(c).run()}
        />
        <div className="mt-2 flex items-center gap-1.5">
          {COLOR_PRESETS.map((c) => (
            <button
              key={c}
              type="button"
              className="size-5 rounded-full border border-line-2"
              style={{ background: c }}
              aria-label={`Colour ${c}`}
              onClick={() => editor.chain().focus().setColor(c).run()}
            />
          ))}
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="ml-auto"
            onClick={() => editor.chain().focus().unsetColor().run()}
          >
            Clear
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* Table insert + row/column operations (ops only shown when inside a table). */
function TableMenu({ editor, inTable }: { editor: Editor; inTable: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          title="Table"
          aria-label="Table"
          className={cn(inTable && 'bg-bg-4 text-ink')}
        >
          <TableIcon className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem
          onSelect={() =>
            editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
          }
        >
          <TableIcon className="size-4" /> Insert 3×3 table
        </DropdownMenuItem>
        {inTable && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => editor.chain().focus().addRowAfter().run()}>
              <Rows3 className="size-4" /> Add row below
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => editor.chain().focus().addColumnAfter().run()}>
              <Columns3 className="size-4" /> Add column right
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => editor.chain().focus().deleteRow().run()}>
              <Rows3 className="size-4" /> Delete row
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => editor.chain().focus().deleteColumn().run()}>
              <Columns3 className="size-4" /> Delete column
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => editor.chain().focus().deleteTable().run()}>
              <Trash2 className="size-4" /> Delete table
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* Link set/unset via a small popover (no window.prompt). */
function LinkButton({ editor, active }: { editor: Editor; active: boolean }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');

  const apply = () => {
    const href = url.trim();
    if (href) {
      const withScheme = /^https?:\/\//i.test(href) ? href : `https://${href}`;
      editor.chain().focus().extendMarkRange('link').setLink({ href: withScheme }).run();
    }
    setOpen(false);
    setUrl('');
  };

  if (active) {
    return (
      <ToolButton
        label="Remove link"
        active
        onClick={() => editor.chain().focus().unsetLink().run()}
      >
        <Link2Off className="size-4" />
      </ToolButton>
    );
  }

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setUrl((editor.getAttributes('link').href as string | undefined) ?? '');
      }}
    >
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="icon-sm" title="Link" aria-label="Link">
          <Link2 className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="start">
        <div className="flex items-center gap-1.5">
          <Input
            autoFocus
            placeholder="https://…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                apply();
              }
            }}
          />
          <Button type="button" variant="solid" size="sm" onClick={apply} disabled={!url.trim()}>
            Set
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Footer({ editor }: { editor: Editor }) {
  const chars = useEditorState({
    editor,
    // Storage isn't populated until the editor finishes initializing.
    selector: ({ editor: e }) =>
      (e.storage.characterCount?.characters() ?? 0) as number,
  });
  return (
    <div className="flex justify-end border-t border-line px-3 py-1">
      <span className={cn('text-[11px] tabular-nums', chars >= CHAR_LIMIT ? 'text-danger' : 'text-ink-4')}>
        {chars.toLocaleString()} / {CHAR_LIMIT.toLocaleString()}
      </span>
    </div>
  );
}

// Read-only rendering lives in rich-text-view.tsx (kept Tiptap-free so it can
// be imported statically without dragging the editor bundle along).
