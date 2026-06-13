// MOCK_DEPENDENCY: §5 Catalog and Listings — attribute templates, audit, moderation flags

import type {
  AttributeTemplate,
  CatalogFlag,
  CatalogFlagKind,
  ListingAuditEntry,
} from '@/lib/types';

const HOUR = 1000 * 60 * 60;
const DAY = HOUR * 24;
const now = () => Date.now();

export function mockAttributeTemplates(): AttributeTemplate[] {
  return [
    {
      id: 'tpl_apparel_basic',
      name: 'Apparel basics (size + color)',
      axes: [
        { name: 'Size', type: 'enum', allowedValues: ['XS', 'S', 'M', 'L', 'XL', 'XXL'] },
        { name: 'Color', type: 'color', allowedValues: ['Black', 'White', 'Indigo', 'Saffron', 'Maroon'] },
      ],
      usedByListingCount: 18,
      usageCount: 0,
      lastUsedAt: null,
      updatedAt: new Date(now() - DAY * 14).toISOString(),
    },
    {
      id: 'tpl_footwear',
      name: 'Footwear (size + width)',
      axes: [
        { name: 'Size', type: 'numeric', allowedValues: ['6', '7', '8', '9', '10', '11', '12'] },
        { name: 'Width', type: 'enum', allowedValues: ['Narrow', 'Regular', 'Wide'] },
      ],
      usedByListingCount: 4,
      usageCount: 0,
      lastUsedAt: null,
      updatedAt: new Date(now() - DAY * 30).toISOString(),
    },
    {
      id: 'tpl_jewelry',
      name: 'Jewelry (metal + length)',
      axes: [
        { name: 'Metal', type: 'enum', allowedValues: ['Gold', 'Silver', 'Rose gold'] },
        { name: 'Length (in)', type: 'numeric', allowedValues: ['16', '18', '20', '24'] },
      ],
      usedByListingCount: 0,
      usageCount: 0,
      lastUsedAt: null,
      updatedAt: new Date(now() - DAY * 90).toISOString(),
    },
  ];
}

export function mockListingAudit(listingId: string): ListingAuditEntry[] {
  return [
    {
      id: `${listingId}_a1`,
      listingId,
      action: 'edit',
      actorKind: 'retailer',
      actorId: 'ret_aanya',
      before: { priceInPaise: 249900 },
      after: { priceInPaise: 229900 },
      at: new Date(now() - HOUR * 4).toISOString(),
      note: null,
    },
    {
      id: `${listingId}_a2`,
      listingId,
      action: 'publish',
      actorKind: 'system',
      actorId: null,
      before: { status: 'draft' },
      after: { status: 'active' },
      at: new Date(now() - DAY * 2).toISOString(),
      note: null,
    },
    {
      id: `${listingId}_a3`,
      listingId,
      action: 'edit',
      actorKind: 'admin',
      actorId: 'adm_super',
      before: { categoryId: 'cat_kurta' },
      after: { categoryId: 'cat_sherwani' },
      at: new Date(now() - DAY * 7).toISOString(),
      note: 'Recategorised during audit',
    },
  ];
}

export function mockCatalogFlags(): CatalogFlag[] {
  const mk = (id: string, _kind: CatalogFlagKind, reasonCode: string, hoursAgo: number, status: CatalogFlag['status']): CatalogFlag => ({
    id,
    listingId: `lst_${id}`,
    source: _kind === 'auto_flagged' ? 'automation' : _kind === 'user_reported' ? 'user_report' : 'admin_review',
    reasonCode,
    details: null,
    reportedByConsumerId: _kind === 'user_reported' ? 'consumer_4421' : null,
    ruleKey: _kind === 'auto_flagged' ? `rule_${reasonCode}` : null,
    status,
    assignedAdminId: null,
    openedAt: new Date(now() - HOUR * hoursAgo).toISOString(),
    resolvedAt: status !== 'open' ? new Date(now() - HOUR * (hoursAgo / 2)).toISOString() : null,
  });
  return [
    mk('flag_1', 'auto_flagged', 'pricing', 2, 'open'),
    mk('flag_2', 'user_reported', 'imagery', 8, 'open'),
    mk('flag_3', 'under_appeal', 'description', 36, 'open'),
    mk('flag_4', 'auto_flagged', 'category', 80, 'resolved_dismissed'),
  ];
}
