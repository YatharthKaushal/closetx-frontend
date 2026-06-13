import { useEffect, useState, type ComponentType, type ReactElement } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { ChevronsLeft, Menu, Search, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { AccountMenu, AccountsPanel } from './AccountMenu';
import { BannerStack } from './BannerStack';
import { NotificationsBell } from './NotificationsBell';
import { CommandPalette } from './CommandPalette';

export type SidebarItem = {
  to: string;
  label: string;
  end?: boolean;
  /** Optional lucide icon component, rendered before the label. Sized 16px. */
  icon?: ComponentType<{ className?: string }>;
  /** Optional permission action key. When supplied, the layout hides this item
   *  whenever the active session's permission map says the action is not granted. */
  action?: string;
  /** Optional set of permission action keys; the item shows if ANY is granted.
   *  Use for merged/hub entries that front several gated sub-views. */
  anyAction?: string[];
  /** Optional count bubble (e.g. pending disputes). Hidden when 0/undefined. */
  badge?: number;
  /**
   * Custom active-state test. Needed when two items share a pathname but differ
   * by query (NavLink ignores search), e.g. Issues vs Disputes on /admin/issues.
   */
  activeWhen?: (loc: { pathname: string; search: string }) => boolean;
};

export type SidebarGroup = {
  label: string;
  items: SidebarItem[];
};

/** Hide items the active session lacks permission for and drop now-empty groups.
 *  Items without `action` always pass through. */
export function filterSidebarGroups(
  groups: SidebarGroup[],
  permissions: Record<string, boolean> | undefined,
): SidebarGroup[] {
  if (!permissions) return groups;
  const out: SidebarGroup[] = [];
  for (const g of groups) {
    const items = g.items.filter((it) => {
      if (it.action) return permissions[it.action] === true;
      if (it.anyAction) return it.anyAction.some((a) => permissions[a] === true);
      return true;
    });
    if (items.length > 0) out.push({ ...g, items });
  }
  return out;
}

type SidebarShellProps = {
  kindLabel: string;
  groups: SidebarGroup[];
  /** Placeholder shown in the top-bar search affordance. Omit to hide. */
  searchHint?: string;
  /** Optional element shown inside the dark sidebar footer (e.g. AI quota chip). */
  sidebarFooter?: ComponentType | ReactElement;
  /** Scope hint for the Cmd+K palette to choose which entity search to run. */
  paletteScope?: 'admin' | 'retailer';
};

const STORAGE_KEY = 'trendzo.sidebar.collapsed';

/**
 * Floating-card application shell. A soft gray page hosts a single rounded
 * white container that splits into the persistent left sidebar and the main
 * column (top-bar + page outlet). Sidebar collapses to icon-only on desktop;
 * on mobile it opens as a slide-over drawer.
 */
export function SidebarShell({ kindLabel, groups, searchHint, sidebarFooter, paletteScope = 'admin' }: SidebarShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  });
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0');
  }, [collapsed]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-bg">
      {/* Desktop sidebar — inverted: black surface with white-on-black active pill. */}
      <aside
        className={cn(
          'hidden lg:flex lg:flex-col lg:shrink-0 bg-ink text-bg transition-[width] duration-200 overflow-y-auto',
          collapsed ? 'lg:w-[76px]' : 'lg:w-[244px]',
        )}
      >
        <SidebarHeader collapsed={collapsed} kindLabel={kindLabel} onToggle={() => setCollapsed((c) => !c)} />
        <SidebarBody groups={groups} collapsed={collapsed} />
        {sidebarFooter && !collapsed && (
          <div className="shrink-0 border-t border-[#2a2a2a] px-3 py-3">
            {typeof sidebarFooter === 'function'
              ? (() => {
                  const F = sidebarFooter as ComponentType;
                  return <F />;
                })()
              : sidebarFooter}
          </div>
        )}
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-line bg-bg/95 px-4 sm:px-6 backdrop-blur">
          <button
            className="lg:hidden -m-2 p-2 text-ink-2 rounded-md hover:bg-bg-3"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="size-5" />
          </button>

          {/* Mobile wordmark — sits in the white top bar so it stays inked. */}
          <NavLink to="/" className="lg:hidden text-[18px] font-semibold tracking-tight text-ink leading-none" aria-label="Trendzo home">
            Trendzo
          </NavLink>

          {searchHint && (
            <button
              type="button"
              className={cn(
                'hidden md:flex h-10 items-center gap-2 rounded-full bg-bg-3 ' +
                  'px-4 text-[13.5px] text-ink-3 hover:bg-bg-4 transition-colors min-w-[300px] press',
              )}
              onClick={() => setPaletteOpen(true)}
            >
              <Search className="size-4 text-ink-4" />
              <span className="flex-1 text-left">{searchHint}</span>
              <kbd className="kbd">⌘K</kbd>
            </button>
          )}

          <div className="ml-auto flex items-center gap-2">
            <NotificationsBell />
            <AccountMenu />
          </div>
        </header>

        <BannerStack />

        <main className="flex-1 min-h-0 overflow-y-auto bg-bg">
          <Outlet />
        </main>
      </div>

      {mobileOpen && (
        <MobileDrawer
          groups={groups}
          kindLabel={kindLabel}
          onClose={() => setMobileOpen(false)}
        />
      )}

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        groups={groups}
        scope={paletteScope}
      />
    </div>
  );
}

function SidebarHeader({
  collapsed,
  kindLabel,
  onToggle,
}: {
  collapsed: boolean;
  kindLabel: string;
  onToggle: () => void;
}) {
  // Collapsed: the brand tile itself is the expand affordance (click to expand).
  // Expanded: a discrete chevron button collapses.
  if (collapsed) {
    return (
      <div className="flex h-16 shrink-0 items-center justify-center border-b border-[#2a2a2a] px-3">
        <button
          type="button"
          aria-label="Expand sidebar"
          onClick={onToggle}
          className="grid size-9 place-items-center rounded-lg bg-bg text-ink text-[14px] font-semibold press hover:bg-bg-2"
        >
          C
        </button>
      </div>
    );
  }
  return (
    <div className="flex h-16 shrink-0 items-center justify-between border-b border-[#2a2a2a] px-5">
      <NavLink to="/" aria-label="Trendzo home" className="min-w-0">
        <div className="flex flex-col leading-none">
          <div className="text-[20px] font-semibold tracking-tight text-bg">
            Trendzo
          </div>
          <div className="mt-1 text-[10.5px] uppercase tracking-[0.12em] text-bg/50 font-medium">
            {kindLabel}
          </div>
        </div>
      </NavLink>
      <button
        type="button"
        aria-label="Collapse sidebar"
        onClick={onToggle}
        className="-m-1.5 p-1.5 text-bg/60 hover:text-bg rounded-md hover:bg-bg/10 press"
      >
        <ChevronsLeft className="size-4" />
      </button>
    </div>
  );
}

function SidebarBody({ groups, collapsed }: { groups: SidebarGroup[]; collapsed: boolean }) {
  return (
    <nav
      className={cn(
        'flex-1 overflow-y-auto py-4 space-y-5',
        collapsed ? 'px-2' : 'px-3',
      )}
    >
      {groups.map((group) => (
        <div key={group.label}>
          {!collapsed && (
            <div className="px-2 mb-1.5 text-[11px] font-medium uppercase tracking-[0.04em] text-bg/40">
              {group.label}
            </div>
          )}
          <ul className="space-y-0.5">
            {group.items.map((item) => (
              <li key={item.to}>
                <SidebarItemRow item={item} collapsed={collapsed} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function SidebarItemRow({ item, collapsed }: { item: SidebarItem; collapsed: boolean }) {
  const Icon = item.icon;
  const loc = useLocation();
  return (
    <NavLink
      to={item.to}
      end={item.end ?? false}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) => {
        const active = item.activeWhen ? item.activeWhen(loc) : isActive;
        return cn(
          'group relative flex items-center gap-3 rounded-lg text-[13.5px] font-medium transition-colors press',
          collapsed ? 'h-10 justify-center px-0' : 'h-9 px-3',
          active ? 'bg-bg text-ink shadow-xs' : 'text-bg/70 hover:bg-bg/10 hover:text-bg',
        );
      }}
    >
      {Icon && <Icon className="size-[16px] shrink-0" />}
      {!collapsed && <span className="truncate">{item.label}</span>}
      {item.badge != null && item.badge > 0 && (
        <span
          className={cn(
            'grid min-w-[18px] place-items-center rounded-full bg-danger px-1.5 text-[10px] font-semibold leading-none text-white',
            collapsed ? 'absolute right-1 top-1 h-4' : 'ml-auto h-[18px]',
          )}
          aria-label={`${item.badge} pending`}
        >
          {item.badge > 99 ? '99+' : item.badge}
        </span>
      )}
    </NavLink>
  );
}

function MobileDrawer({
  groups,
  kindLabel,
  onClose,
}: {
  groups: SidebarGroup[];
  kindLabel: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex bg-black/50 backdrop-blur-sm lg:hidden">
      <div className="flex w-72 max-w-[85vw] flex-col bg-ink text-bg shadow-lg">
        <div className="flex items-start justify-between px-5 py-4 border-b border-[#2a2a2a]">
          <div className="flex flex-col leading-none">
            <div className="text-[20px] font-semibold tracking-tight text-bg">
              Trendzo
            </div>
            <div className="mt-1 text-[10.5px] uppercase tracking-[0.12em] text-bg/50 font-medium">
              {kindLabel}
            </div>
          </div>
          <button
            aria-label="Close"
            onClick={onClose}
            className="-m-2 p-2 text-bg/60 hover:text-bg hover:bg-bg/10 rounded-md"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {groups.map((group) => (
            <div key={group.label}>
              <div className="px-2 mb-1.5 text-[11px] font-medium uppercase tracking-[0.04em] text-bg/40">
                {group.label}
              </div>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        end={item.end ?? false}
                        onClick={onClose}
                        className={({ isActive }) =>
                          cn(
                            'flex items-center gap-3 rounded-lg px-3 py-2.5 text-[14px]',
                            isActive ? 'bg-bg text-ink font-semibold' : 'text-bg/70 hover:bg-bg/10 hover:text-bg',
                          )
                        }
                      >
                        {Icon && <Icon className="size-4" />}
                        <span>{item.label}</span>
                        {item.badge != null && item.badge > 0 && (
                          <span className="ml-auto grid h-[18px] min-w-[18px] place-items-center rounded-full bg-danger px-1.5 text-[10px] font-semibold leading-none text-white">
                            {item.badge > 99 ? '99+' : item.badge}
                          </span>
                        )}
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-[#2a2a2a] p-4 bg-ink">
          <AccountsPanel onNavigate={onClose} />
        </div>
      </div>
      <button type="button" aria-label="Close menu" className="flex-1" onClick={onClose} />
    </div>
  );
}

