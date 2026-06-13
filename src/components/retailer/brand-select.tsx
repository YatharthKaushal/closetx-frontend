/**
 * Brand picker with inline "create new brand" — self-contained (owns its own
 * brands query + create mutation). Extracted from the old listing wizard so
 * both create and edit flows share one implementation.
 *
 * The Radix workarounds here are deliberate crash fixes — do not "simplify":
 *  - No <SelectValue/>: Radix portals the selected item's text into the value
 *    node; for a brand selected programmatically right after creation the item
 *    isn't mounted yet, so the label sticks on the placeholder, and manual
 *    SelectValue children race that portal → React removeChild crash. A plain
 *    span we control is always correct.
 *  - onCloseAutoFocus preventDefault + focus the panel input: otherwise the
 *    user's typing lands on the trigger's typeahead and silently selects random
 *    brands.
 *  - setQueryData seed before select: keeps the new item mounted at selection.
 */
import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import type { Brand } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldError, Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';

const CREATE_BRAND_SENTINEL = '__create__';

/** URL-safe slug matching the server's ^[a-z0-9]+(?:-[a-z0-9]+)*$ rule. */
export function slugifyBrandName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

type Props = {
  value: string;
  onChange: (brandId: string) => void;
  error?: string | undefined;
};

export function BrandSelect({ value, onChange, error }: Props) {
  const qc = useQueryClient();
  const brands = useQuery({
    queryKey: ['catalog', 'brands'],
    queryFn: () => api<Brand[]>('/catalog/brands'),
  });
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const focusPanelRef = useRef(false);

  const createBrand = useMutation({
    mutationFn: async (name: string) => {
      const slug = slugifyBrandName(name);
      try {
        return await api<Brand>('/retailer/brands', {
          method: 'POST',
          body: { name: name.trim(), slug },
        });
      } catch (e) {
        if (e instanceof ApiError && e.status === 409 && /slug/i.test(e.message)) {
          return await api<Brand>('/retailer/brands', {
            method: 'POST',
            body: { name: name.trim(), slug: `${slug}-2` },
          });
        }
        throw e;
      }
    },
    onSuccess: (created) => {
      qc.setQueryData<Brand[]>(['catalog', 'brands'], (old) =>
        old ? [...old, created] : [created],
      );
      onChange(created.id);
      setCreating(false);
      setNewName('');
      setCreateError(null);
      toast.success(`Brand "${created.name}" created`);
      void qc.invalidateQueries({ queryKey: ['catalog', 'brands'] });
    },
    onError: async (e, name) => {
      if (e instanceof ApiError && e.status === 409 && /named/i.test(e.message)) {
        const fresh = await qc.fetchQuery({
          queryKey: ['catalog', 'brands'],
          queryFn: () => api<Brand[]>('/catalog/brands'),
        });
        const match = fresh.find((b) => b.name.toLowerCase() === name.trim().toLowerCase());
        if (match) {
          onChange(match.id);
          setCreating(false);
          setNewName('');
          setCreateError(null);
          toast.info(`Brand "${match.name}" already exists — selected it for you.`);
          return;
        }
      }
      setCreateError(e instanceof Error ? e.message : 'Could not create brand');
    },
  });

  const submit = () => {
    if (newName.trim() && slugifyBrandName(newName)) createBrand.mutate(newName);
  };

  return (
    <div>
      <Label required>Brand</Label>
      <Select
        value={value}
        onValueChange={(v) => {
          if (v === CREATE_BRAND_SENTINEL) {
            focusPanelRef.current = true;
            setCreating(true);
            setCreateError(null);
            return;
          }
          if (!v) return;
          onChange(v);
        }}
      >
        <SelectTrigger>
          <span className={value ? undefined : 'text-ink-4'}>
            {value
              ? brands.data?.find((b) => b.id === value)?.name ?? '…'
              : brands.isLoading
                ? 'Loading…'
                : 'Pick a brand'}
          </span>
        </SelectTrigger>
        <SelectContent
          onCloseAutoFocus={(e) => {
            if (!focusPanelRef.current) return;
            focusPanelRef.current = false;
            e.preventDefault();
            requestAnimationFrame(() => nameInputRef.current?.focus());
          }}
        >
          {(brands.data ?? []).map((b) => (
            <SelectItem key={b.id} value={b.id}>
              {b.name}
            </SelectItem>
          ))}
          <SelectItem
            value={CREATE_BRAND_SENTINEL}
            className="mt-1 border-t border-rule/60 font-medium text-accent"
          >
            ＋ Create new brand…
          </SelectItem>
        </SelectContent>
      </Select>
      <FieldError>{error}</FieldError>

      {creating && (
        <div className="mt-2 rounded-xs border border-rule bg-paper-2/40 p-4 space-y-3">
          <div className="text-[12.5px] font-medium text-ink">Create a new brand</div>
          <div>
            <Label htmlFor="new-brand-name" required>
              Brand name
            </Label>
            <Input
              id="new-brand-name"
              ref={nameInputRef}
              autoFocus
              placeholder="e.g. House of Asha"
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value);
                setCreateError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  submit();
                }
              }}
            />
            <p className="mt-1 font-mono text-[11px] text-ink-3">
              slug: {slugifyBrandName(newName) || '—'}
            </p>
            {createError && <FieldError>{createError}</FieldError>}
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setCreating(false);
                setNewName('');
                setCreateError(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="ink"
              size="sm"
              loading={createBrand.isPending}
              disabled={!newName.trim() || !slugifyBrandName(newName)}
              onClick={submit}
            >
              Create brand
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
