import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Page, PageHeader } from '@/components/ui/page';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AdminTeamPanel } from './admins';
import { SubRolesPanel } from './sub-roles';

/**
 * Identity hub — the admin roster and the permission matrix that governs every
 * sub-role, merged behind one sidebar entry as URL-synced tabs (`?tab=`). The
 * Sub-roles tab is only offered to super_admins (it edits the matrix itself).
 */
export default function AdminIdentityHub() {
  const [params, setParams] = useSearchParams();
  const perms = useAuth((s) => s.session?.permissions);
  const isSuperAdmin = useAuth(
    (s) => s.session?.kind === 'admin' && s.session.admin.subRole === 'super_admin',
  );

  const tabs = useMemo(
    () =>
      [
        {
          key: 'team',
          label: 'Admin team',
          show: !perms || perms['team.list'] === true,
          Panel: AdminTeamPanel,
        },
        {
          key: 'sub-roles',
          label: 'Sub-roles',
          show: isSuperAdmin,
          Panel: SubRolesPanel,
        },
      ].filter((t) => t.show),
    [perms, isSuperAdmin],
  );

  const fallback = tabs[0]?.key ?? 'team';
  const active = tabs.some((t) => t.key === params.get('tab')) ? params.get('tab')! : fallback;

  function setTab(key: string) {
    const next = new URLSearchParams(params);
    if (key === fallback) next.delete('tab');
    else next.set('tab', key);
    setParams(next);
  }

  return (
    <Page>
      <PageHeader
        kicker="Identity & Access"
        title="Identity"
        description="The platform admin roster and the action × sub-role permission matrix that governs every queue and override."
      />

      <Tabs value={active} onValueChange={setTab}>
        <TabsList>
          {tabs.map((t) => (
            <TabsTrigger key={t.key} value={t.key}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {tabs.map((t) => {
          const Panel = t.Panel;
          return (
            <TabsContent key={t.key} value={t.key}>
              <Panel />
            </TabsContent>
          );
        })}
      </Tabs>
    </Page>
  );
}
