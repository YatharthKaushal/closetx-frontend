/* Backend response types — kept narrow to what the dashboard reads.
   Mirror src/db/schema/* on the backend; widen only as new fields are surfaced in UI. */

export type Envelope<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string; details?: unknown } };

export type AdminSubRole = 'super_admin' | 'ops_admin' | 'support';
export type RetailerSubRole = 'owner' | 'manager' | 'staff' | 'delivery_agent';

export type ConsumerStatus = 'active' | 'suspended' | 'closed';
export type RetailerStatus =
  | 'pending_approval'
  | 'approved_no_store'
  | 'onboarding'
  | 'active'
  | 'paused'
  | 'suspended'
  | 'terminated';
export type StoreStatus = 'onboarding' | 'active' | 'paused' | 'suspended' | 'terminated';
export type ListingStatus = 'draft' | 'active' | 'retired' | 'taken_down';
export type Gender = 'her' | 'him' | 'unisex';
export type ListingPolicy = 'return' | 'replace' | 'final_sale';

export type AdminProfile = {
  id: string;
  email: string;
  subRole: AdminSubRole;
};

export type RetailerProfile = {
  id: string;
  email: string;
  legalName: string;
  phone: string;
  gstin: string;
  status: RetailerStatus;
  storeId: string | null;
  /** Present on the login response; used to route delivery agents to their surface. */
  subRole?: RetailerSubRole;
  permanentSuspend?: boolean;
  suspendReason?: string | null;
};

export type Store = {
  id: string;
  legalName: string;
  gstin: string;
  gstScheme: 'regular' | 'composition';
  address: string;
  stateCode: string;
  lat: number;
  lng: number;
  status: StoreStatus;
  platformFeeBp: number;
  payoutCadenceDays: number;
  delegationModeEnabled: boolean;
  permanentSuspend?: boolean;
  suspendReason?: string | null;
  pauseReason?: string | null;
  contactPhone?: string | null;
  managerName?: string | null;
  galleryImageUrls?: string[] | null;
};

export type Brand = {
  id: string;
  slug: string;
  name: string;
  tintColor: string | null;
  logoUrl: string | null;
  domain: string | null;
  isActive: boolean;
};

export type Category = {
  id: string;
  slug: string;
  label: string;
  parentId: string | null;
  iconName: string | null;
  tintColor: string | null;
  imageUrl: string | null;
  gender: Gender;
  sortOrder: number;
  isActive: boolean;
};

/** Parent level of the variant hierarchy — one row per color ("Red"). Every
 *  listing owns one `isDefault` group holding single-product and custom-template
 *  variants. */
export type VariantGroup = {
  id: string;
  listingId: string;
  name: string;
  /** Optional #RRGGBB swatch; the name stays free-form ("Midnight Green"). */
  colorHex: string | null;
  sortOrder: number;
  isDefault: boolean;
  isActive: boolean;
};

/** One sizing system ("UK", "Letter sizes") with its pick-list values, scoped
 *  to category slugs server-side (empty = universal). */
export type SizeScale = {
  id: string;
  name: string;
  values: string[];
  categorySlugs: string[];
  sortOrder: number;
  isActive: boolean;
};

/** How a listing's variants are structured (server-recorded wizard choice). */
export type VariantMode = 'single' | 'color_size' | 'custom';

export type Variant = {
  id: string;
  listingId: string;
  storeId?: string;
  /** Parent group (color for the system flow; the default group otherwise). */
  groupId: string;
  sku: string | null;
  attributes: Record<string, string>;
  attributesLabel: string;
  imageUrls: string[];
  stock: number;
  reserved: number;
  pricePaise: number;
  /** Struck-through "was" price in paise; null when not on sale. */
  compareAtPrice: number | null;
  isActive: boolean;
  /** True when a template edit removed an axis/value this variant was using. */
  attributesOutOfTemplate: boolean;
};

/** System age ranges a product can target (multi-select; [] = unspecified).
 *  Mirrors AGE_RANGES in the backend listings validators. */
export const AGE_RANGES = ['0-2', '3-7', '8-12', '13-17', '18-24', '25-40', '40+'] as const;
export type AgeRange = (typeof AGE_RANGES)[number];

export type Listing = {
  id: string;
  storeId: string;
  brandId: string | null;
  categoryId: string;
  templateId: string | null;
  name: string;
  description: string | null;
  /** Rich HTML, sanitized server-side on write — safe to render verbatim. */
  descriptionLong: string | null;
  hsn: string | null;
  gender: Gender;
  listingPolicy: ListingPolicy;
  galleryUrls: string[];
  occasion: string[];
  ageGroups: AgeRange[];
  status: ListingStatus;
  /** Latest moderation takedown note — only present when status === 'taken_down'. */
  takedownReason?: string | null;
  ratingAvg: string;
  ratingCount: number;
  createdAt: string;
  updatedAt: string;
  variantMode: VariantMode;
  brand?: Brand;
  category?: Category;
  variants?: Variant[];
  variantGroups?: VariantGroup[];
};

/** One row of the retailer's flat inventory roster — variant + the bits of its
 *  parent listing the operator needs to scan and act on. */
export type InventoryRow = {
  id: string;
  listingId: string;
  listingName: string;
  listingStatus: ListingStatus;
  brandName: string | null;
  sku: string | null;
  attributesLabel: string;
  pricePaise: number;
  stock: number;
  reserved: number;
  isActive: boolean;
};

/** One entry per CSV row in the dry-run plan returned by `/retailer/inventory/import`. */
export type InventoryImportPlanEntry = {
  row: number;
  action: 'stock_update' | 'variant_create' | 'listing_create' | 'no_change' | 'error';
  identifier: string;
  stockUpdate?: {
    variantId: string;
    sku: string | null;
    currentStock: number;
    newStock: number;
    delta: number;
    newPricePaise?: number;
  };
  variantCreate?: {
    listingId: string;
    listingName: string;
    attributes: Record<string, string>;
    attributesLabel: string;
    sku?: string;
    pricePaise: number;
    stock: number;
  };
  listingCreate?: {
    listingName: string;
    brandSlug: string;
    brandId: string;
    categoryLabel: string;
    categoryId: string;
    gender: Gender;
    variant: {
      attributes: Record<string, string>;
      attributesLabel: string;
      sku?: string;
      pricePaise: number;
      stock: number;
    };
  };
  error?: { reason: string; detail?: string };
};

export type InventoryImportSummary = {
  parsed: number;
  stockUpdates: number;
  variantCreates: number;
  listingCreates: number;
  noChange: number;
  errors: number;
};

/** Discriminated union returned by `POST /retailer/inventory/import`.
 *  Dry-run carries the full plan; apply carries the created/updated IDs. */
export type InventoryImportResult =
  | {
      dryRun: true;
      applied: 0;
      summary: InventoryImportSummary;
      plan: InventoryImportPlanEntry[];
      /** Back-compat — list of stock-update plan entries flattened for older callers. */
      valid?: Array<{ row: number; sku: string; currentStock: number; newStock: number; delta: number }>;
      errors?: { row: number; sku: string; reason: string }[];
    }
  | {
      dryRun: false;
      applied: {
        stockUpdates: number;
        variantCreates: number;
        listingCreates: number;
        priceUpdates: number;
      };
      appliedTotal: number;
      createdListings: Array<{ row: number; listingId: string; name: string }>;
      createdVariants: Array<{ row: number; variantId: string; listingId: string; sku: string | null }>;
      updatedVariants: Array<{ row: number; variantId: string; delta: number; priceChanged: boolean }>;
      errors?: { row: number; sku: string; reason: string }[];
    };

export type InventoryAdjustment = {
  id: string;
  variantId: string;
  delta: number;
  newStock: number;
  reason: string;
  actorKind: string;
  actorId: string | null;
  refKind: string | null;
  refId: string | null;
  note: string | null;
  at: string;
};

/** What `GET /retailer/orders` returns per row. */
export type RetailerOrder = {
  id: string;
  status: string;
  consumerName: string;
  consumerPhone: string;
  deliveryMethod: string;
  paymentMethod: string;
  itemCount: number;
  grandTotalPaise: number;
  placedAt: string;
  acceptedAt: string | null;
  deliveredAt: string | null;
};

export type AdminRetailerView = RetailerProfile & {
  subRole: RetailerSubRole;
  createdAt: string;
};

/**
 * What `/admin/stores` returns — the store row plus a small summary of the owning
 * retailer, so the UI can show approval-order dependencies (admin can't approve a
 * store until its retailer is `active`).
 */
export type AdminStoreView = Store & {
  retailer: {
    id: string;
    email: string;
    legalName: string;
    status: RetailerStatus;
  } | null;
};

export type CollectionKind = 'outfit' | 'occasion' | 'drop' | 'edit' | 'trend' | 'brand';
export type CollectionStatus = 'draft' | 'active' | 'archived';

export type Collection = {
  id: string;
  slug: string;
  name: string;
  kind: CollectionKind;
  gender: Gender;
  description: string | null;
  heroImageUrl: string | null;
  accentColors: string[];
  sortOrder: number;
  isFeatured: boolean;
  status: CollectionStatus;
  startsAt: string | null;
  endsAt: string | null;
  /** When kind='brand', the brand whose active listings auto-populate. */
  brandId: string | null;
  /** When kind='occasion', the occasion tag matched against listing.occasion[]. */
  occasionTag: string | null;
  createdAt: string;
};

/** Index row — `listingCount` rolled up server-side. */
export type CollectionIndexRow = Collection & { listingCount: number };

export type CategoryRow = Category & { listingCount: number };
export type BrandRow = Brand & { listingCount: number };

/** Detail — collection plus the ordered listing roster. */
export type CollectionDetail = Collection & {
  listings: (Listing & { sortOrder: number })[];
};

// ─────────────────────────────────────────────────────────────────────
// Promotions / coupons / vouchers / loyalty / pricing engine
// ─────────────────────────────────────────────────────────────────────

export type Mechanism = 'offer' | 'coupon' | 'voucher';
export type DiscountType =
  | 'flat_amount'
  | 'percent'
  | 'percent_upto'
  | 'bogo'
  | 'bxgy'
  | 'bundle'
  | 'tiered_cart'
  | 'free_shipping';
export type IssuerType = 'admin' | 'retailer' | 'system';
export type AppliedTo = 'retailer_promo' | 'platform_promo' | 'coupon' | 'shipping' | 'loyalty';
export type PromotionStatus =
  | 'draft'
  | 'scheduled'
  | 'active'
  | 'paused'
  | 'expired'
  | 'exhausted'
  | 'revoked';
export type ClubbingDefault = 'allowed' | 'disallowed' | 'always_allowed';

export type DeliveryMethod = 'express' | 'standard' | 'pickup' | 'try_and_buy';
export type PaymentMethod = 'upi' | 'card' | 'cod' | 'wallet' | 'gift_card';

/** Discount config shapes per discountType. Mirrors backend schemas.ts. */
export type FlatAmountConfig = { amountPaise: number };
export type PercentConfig = { percent: number };
export type PercentUptoConfig = { percent: number; maxAmountPaise: number };
export type BogoConfig = {
  buyListingId: string;
  getListingId?: string;
  discountPercent: number;
};
export type BxgyConfig = {
  buyQty: number;
  getQty: number;
  buyListingIds: string[];
  getListingIds?: string[];
  discountPercent: number;
};
export type BundleConfig = { bundleListingIds: string[]; discountPercent: number };
export type TieredCartConfig = {
  tiers: Array<{ minCartPaise: number; discountPercent: number }>;
};
export type FreeShippingConfig = { minCartPaise?: number };

export type PromotionConfig =
  | FlatAmountConfig
  | PercentConfig
  | PercentUptoConfig
  | BogoConfig
  | BxgyConfig
  | BundleConfig
  | TieredCartConfig
  | FreeShippingConfig;

export type Scope = {
  listingIds?: string[];
  categoryIds?: string[];
  brandIds?: string[];
  storeIds?: string[];
  excludeListingIds?: string[];
  excludeCategoryIds?: string[];
  excludeBrandIds?: string[];
  allowedDaysOfWeek?: number[];
  allowedTimesOfDay?: Array<{ from: string; to: string }>;
  minCartPaise?: number;
  minItemCount?: number;
  allowedDeliveryMethods?: DeliveryMethod[];
  allowedPaymentMethods?: PaymentMethod[];
  firstOrderOnly?: boolean;
  loyaltyTierFilter?: Array<'bronze' | 'silver' | 'gold' | 'platinum'>;
  specificConsumerIds?: string[];
  excludeConsumerIds?: string[];
};

export type Promotion = {
  id: string;
  storeId: string | null;
  name: string;
  mechanism: Mechanism;
  discountType: DiscountType;
  issuerType: IssuerType;
  appliedTo: AppliedTo;
  scope: Scope;
  config: PromotionConfig;
  stackableWith: string[];
  nonStackable: string[];
  totalUses: number | null;
  redeemedCount: number;
  perConsumerLimit: number | null;
  validFrom: string; // ISO
  validUntil: string; // ISO
  status: PromotionStatus;
  /** Server-derived runtime status (factors in dates + counters). */
  effectiveStatus: PromotionStatus;
  createdAt: string;
};

export type VoucherCode = {
  id: string;
  promotionId: string;
  code: string;
  totalUses: number | null;
  redeemedCount: number;
  createdAt: string;
};

export type ClubbingMatrixCell = {
  appliedToA: AppliedTo;
  appliedToB: AppliedTo;
  defaultValue: ClubbingDefault;
  note: string | null;
  /** Whether this cell is persisted in the DB or just engine-default. */
  seeded: boolean;
};

export type ConsumerWallet = {
  id: string;
  consumerId: string;
  balancePaise: number;
  version: number;
  updatedAt: string;
};

export type WalletTxKind = 'top_up' | 'debit' | 'refund_credit' | 'gift_card_credit' | 'adjustment';
export type WalletTransaction = {
  id: string;
  walletId: string;
  kind: WalletTxKind;
  amountPaise: number;
  balanceAfterPaise: number;
  walletVersionAfter: number;
  refOrderId: string | null;
  refRefundId: string | null;
  refGiftCardId: string | null;
  note: string | null;
  at: string;
};

export type LoyaltyTxKind = 'earn' | 'redeem' | 'refund_credit' | 'adjustment' | 'bonus';
export type LoyaltyTransaction = {
  id: string;
  consumerId: string;
  kind: LoyaltyTxKind;
  points: number;
  balanceAfterPoints: number;
  refOrderId: string | null;
  note: string | null;
  expiresAt: string | null;
  at: string;
};

export type LoyaltyTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export type LoyaltyConfigRow = {
  value: unknown;
  description: string | null;
  updatedAt: string;
};
export type LoyaltyConfig = Partial<Record<
  | 'loyalty_point_value_paise'
  | 'loyalty_earn_rate_bp'
  | 'min_redeemable_points'
  | 'max_redeem_fraction_bp'
  | 'welcome_points'
  | 'referrer_points'
  | 'referred_points'
  | 'quiz_completion_points'
  | 'daily_reward_table',
  LoyaltyConfigRow
>>;

export type ConsumerSummary = {
  id: string;
  email: string;
  phone: string;
  name: string;
  status: ConsumerStatus;
  signupAt: string;
};

export type ConsumerProfile = ConsumerSummary & {
  genderPreference: 'her' | 'him' | 'unisex' | null;
};

// ─────────────────────── Issues (formerly "Disputes" — see §19) ───────────────────────
// `kind: 'dispute'` keeps the historical adversarial workflow; `'query'` is the
// upcoming lighter ticket type. Status union is widened with the doc-aligned
// awaiting_* states so future §19 work can populate them without another rename.

export type IssueKind = 'query' | 'complaint' | 'dispute';

export type IssueStatus =
  | 'open'
  | 'requested_evidence'
  | 'awaiting_consumer'
  | 'awaiting_retailer'
  | 'awaiting_admin'
  | 'decided'
  | 'escalated'
  | 'resolved'
  | 'closed';

export type IssueDecision = 'refund' | 'fresh_delivery' | 'pickup' | 'no_refund' | 'split';

export type AwaitingParty = 'admin' | 'retailer' | 'consumer';

export type IssueListRow = {
  id: string;
  kind: IssueKind;
  storeId: string;
  orderId: string | null;
  returnId: string | null;
  openedByActorType: ActorType;
  openedByActorId: string;
  subject: string;
  description: string;
  evidence: string[];
  status: IssueStatus;
  awaitingParty: AwaitingParty;
  assignedAdminId: string | null;
  decision: IssueDecision | null;
  decisionNote: string | null;
  decidedAt: string | null;
  payoutAdjustmentPaise: number | null;
  linkedHoldId: string | null;
  linkedAdjustmentId: string | null;
  lastMessageAt: string;
  createdAt: string;
  closedAt: string | null;
  /** Compatibility shims for pages that still read legacy field names */
  targetKind?: 'order' | 'return';
  targetId?: string | null;
  openedAt?: string;
  decidedByAdminId?: string | null;
};

// ─────────────────────── Orders ───────────────────────

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'routing'
  | 'accepted'
  | 'packed'
  | 'picked_up'
  | 'out_for_delivery'
  | 'at_door'
  | 'undelivered'
  | 'returning_to_store'
  | 'returned_to_store'
  | 'delivered'
  | 'cancelled'
  | 'payment_failed'
  | 'closed';

export type OrderGroupStatus =
  | 'in_flight'
  | 'partially_delivered'
  | 'all_delivered'
  | 'partially_cancelled'
  | 'all_cancelled';

export type PaymentStatus = 'pending' | 'succeeded' | 'failed' | 'superseded';
export type DeliveryAttemptOutcome = 'delivered' | 'undelivered' | 'returning_to_store';
export type ActorType = 'consumer' | 'retailer' | 'admin' | 'delivery_agent' | 'system';

export type OrderItemOutcome =
  | 'pending_delivery'
  | 'delivered_kept'
  | 'at_door_kept'
  | 'at_door_returned'
  | 'at_door_refused'
  | 'at_store_pending_verification'
  | 'store_accepted_return'
  | 'store_rejected_held'
  | 'held_collected_at_counter'
  | 'held_redelivered'
  | 'held_abandoned'
  | 'held_window_expired'
  | 'dispute_open'
  | 'dispute_resolved_refund'
  | 'dispute_resolved_fresh_delivery'
  | 'dispute_resolved_pickup'
  | 'dispute_resolved_no_refund'
  | 'cancelled';

export type OrderListRow = {
  id: string;
  groupId?: string;
  status: OrderStatus;
  storeId?: string;
  storeName?: string;
  /** Store's contact phone, for the merged Store column. `null` if unset. */
  storePhone?: string | null;
  consumerId?: string;
  consumerName: string;
  consumerPhone?: string;
  deliveryMethod: DeliveryMethod;
  paymentMethod: PaymentMethod;
  /** Capture state of the order's payment (resolved from the payment chain).
   *  `null` when the order has no payment row yet. */
  paymentStatus?: PaymentStatus | null;
  itemCount: number;
  /** Compact line-item preview (capped to 4) for board/history cards. */
  items?: { name: string; qty: number; listingId: string }[];
  grandTotalPaise: number;
  placedAt: string;
  acceptedAt: string | null;
  deliveredAt: string | null;
  /** When the routing/pending order's acceptance window closes. ISO timestamp; null on orders that never had a window. */
  acceptanceDeadlineAt?: string | null;
  /** True if the order has at least one open dispute/query — surfaced to admin filters. */
  hasOpenDispute?: boolean;
  /** True if a return on this order is awaiting the store's accept/decline decision. */
  hasPendingReturn?: boolean;
  /** §9 — pickup slot snapshot for delivery_method='pickup' orders. */
  pickupSlotStart?: string | null;
  pickupSlotEnd?: string | null;
  pickupCode?: string | null;
  /** §9 — try-and-buy door visit window. Live deadline for the try-on countdown. */
  doorWindowExpiresAt?: string | null;
  doorWindowExtendedAt?: string | null;
};

export type OrderItem = {
  id: string;
  orderId: string;
  listingId: string;
  variantId: string;
  listingNameSnap: string;
  brandSnap: string;
  categorySnap: string;
  hsnSnap: string | null;
  galleryImageSnap: string | null;
  attributesLabelSnap: string;
  qty: number;
  unitPricePaise: number;
  lineSubtotalPaise: number;
  retailerPromoAllocPaise: number;
  platformPromoAllocPaise: number;
  couponAllocPaise: number;
  pointsAllocPaise: number;
  gstRateBp: number;
  gstAllocPaise: number;
  netLinePaise: number;
  outcome: OrderItemOutcome;
};

export type OrderTransition = {
  id: string;
  orderId: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  actorType: ActorType;
  actorId: string;
  reason: string | null;
  metadata: Record<string, unknown> | null;
  at: string;
};

export type Payment = {
  id: string;
  orderId: string;
  method: PaymentMethod;
  amountPaise: number;
  status: PaymentStatus;
  gatewayRef: string | null;
  previousPaymentId: string | null;
  initiatedAt: string;
  settledAt: string | null;
};

export type DeliveryAttempt = {
  id: string;
  orderId: string;
  deliveryAgentId: string | null;
  attemptNumber: number;
  outcome: DeliveryAttemptOutcome;
  notes: string | null;
  proofPhotos: string[];
  attemptedAt: string;
};

export type AvailableTransition = {
  from: OrderStatus;
  to: OrderStatus;
  actors: ActorType[];
};

export type OrderDetail = {
  id: string;
  groupId: string;
  status: OrderStatus;
  storeId: string;
  consumerId: string;
  addressId: string | null;
  deliveryMethod: DeliveryMethod;
  paymentMethod: PaymentMethod;
  paymentMethodLabel: string;

  consumerNameSnap: string;
  consumerEmailSnap: string;
  consumerPhoneSnap: string;
  addressLine1Snap: string | null;
  addressLine2Snap: string | null;
  addressCitySnap: string | null;
  addressPincodeSnap: string | null;
  addressStateCodeSnap: string | null;

  storeNameSnap: string;
  storeAddressSnap: string;
  storeGstinSnap: string;
  storeStateCodeSnap: string;

  itemsSubtotalPaise: number;
  retailerPromoPaise: number;
  platformPromoPaise: number;
  couponPaise: number;
  pointsRedeemedPaise: number;
  walletAppliedPaise: number;
  taxPaise: number;
  taxSplitKind: 'intra_state' | 'inter_state';
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  deliveryFeePaise: number;
  handlingFeePaise: number;
  convenienceFeePaise: number;
  grandTotalPaise: number;
  platformFeeBpSnap: number;
  /** §12 F3b — admin-set per-order platform fee override (paise). 0 = no override. */
  platformFeeOverridePaise?: number;
  platformFeeOverrideReason?: string | null;

  placedAt: string;
  acceptedAt: string | null;
  deliveredAt: string | null;
  closedAt: string | null;
  piiScrubbedAt: string | null;
  idempotencyKey: string;
  acceptanceDeadlineAt?: string | null;
  pickupSlotId?: string | null;
  pickupSlotStart?: string | null;
  pickupSlotEnd?: string | null;
  pickupCode?: string | null;
  doorWindowExpiresAt?: string | null;
  doorWindowExtendedAt?: string | null;

  group: {
    id: string;
    status: OrderGroupStatus;
    placedAt: string;
    combinedTotalPaise?: number;
    siblingOrders: OrderListRow[];
  };
  items: OrderItem[];
  payments: Payment[];
  transitions: OrderTransition[];
  deliveryAttempts: DeliveryAttempt[];
  availableTransitions: AvailableTransition[];
  returns?: Return[];
  refunds?: Refund[];
  heldItems?: HeldItem[];
  /** All disputes tied to this order (or its returns) — open and decided/closed. */
  disputes?: OrderDispute[];
  /** Thin summary of the live dispute, if any — gates raise-dispute/request-refund. */
  openDispute?: { id: string; status: string } | null;
};

/** A dispute (backed by customerIssues) attached to an order or one of its returns. */
export type OrderDispute = {
  id: string;
  status: IssueStatus;
  subject: string;
  description: string;
  openedByActorType: ActorType;
  createdAt: string;
  decision: IssueDecision | null;
  decisionNote: string | null;
  decidedAt: string | null;
  returnId: string | null;
  /** Retailer funds withheld pending the admin decision (paise), when held. */
  heldAmountPaise: number | null;
};

// ─────────────── Delivery agent surface (/retailer/deliveries) ───────────────
export type DeliveryItemRow = {
  id: string;
  listingNameSnap: string;
  qty: number;
  listingId: string;
};

export type DeliveryRow = {
  id: string;
  status: OrderStatus;
  deliveryMethod: DeliveryMethod;
  consumerNameSnap: string;
  consumerPhoneSnap: string;
  addressLine1Snap: string | null;
  addressLine2Snap: string | null;
  addressCitySnap: string | null;
  addressPincodeSnap: string | null;
  grandTotalPaise: number;
  doorWindowExpiresAt: string | null;
  placedAt: string;
  items: DeliveryItemRow[];
};

export type DeliveryDetail = {
  id: string;
  status: OrderStatus;
  deliveryMethod: DeliveryMethod;
  consumerNameSnap: string;
  consumerPhoneSnap: string;
  consumerEmailSnap?: string;
  addressLine1Snap: string | null;
  addressLine2Snap: string | null;
  addressCitySnap: string | null;
  addressPincodeSnap: string | null;
  grandTotalPaise: number;
  doorWindowExpiresAt: string | null;
  doorWindowExtendedAt: string | null;
  placedAt: string;
  items: OrderItem[];
  availableTransitions: AvailableTransition[];
};

/** Per-item door decision the agent records. */
export type DoorDecision = 'kept' | 'returned' | 'refused' | 'return_rejected';

export type PlaceOrderResult = {
  orderId: string;
  groupId: string;
  status: OrderStatus;
  pricing: PricingBreakdown;
  alreadyExisted: boolean;
};

export type TestConsumerCreated = {
  consumer: { id: string; email: string; phone: string; name: string };
  addressId: string;
};

export type PricingBreakdown = {
  lineSubtotalPaise: number;
  appliedPromotions: Array<{
    promotionId: string;
    mechanism: Mechanism;
    discountType: DiscountType;
    appliedTo: AppliedTo;
    amountPaise: number;
    voucherCodeId?: string;
  }>;
  excludedPromotions: Array<{ promotionId: string; reason: string }>;
  retailerPromoDiscountPaise: number;
  platformPromoDiscountPaise: number;
  couponDiscountPaise: number;
  loyaltyDiscountPaise: number;
  shippingSubsidyPaise: number;
  postPromoSubtotalPaise: number;
  taxBasePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  deliveryFeePaise: number;
  handlingFeePaise: number;
  convenienceFeePaise: number;
  tcsPaise: number;
  totalPaise: number;
  loyaltyEarnedPoints: number;
  loyaltyRedeemedPoints: number;
};

// ─────────────────────── Returns / Refunds / Held ───────────────────────

export type ReturnKind = 'door_return' | 'standard_return';
export type AgentDisposition = 'kept' | 'returned' | 'refused';
export type StoreReturnDecision = 'pending' | 'accepted' | 'rejected';

export type Return = {
  id: string;
  orderItemId: string;
  kind: ReturnKind;
  openedAt: string;
  reasonText: string | null;
  photos: string[];
  agentDisposition: AgentDisposition | null;
  storeDecision: StoreReturnDecision;
  storeDecidedAt: string | null;
  verificationWindowExpiresAt: string | null;
};

export type ReturnWithItem = Return & {
  orderItem: OrderItem & { order: OrderDetail };
};

export type RefundStatus =
  | 'pending'
  | 'processing'
  | 'succeeded'
  | 'partially_disbursed'
  | 'failed';

export type RefundDisbursementStatus = 'pending' | 'succeeded' | 'failed';
export type RefundDestination = 'original_tender' | 'wallet';

export type RefundLine = {
  id: string;
  refundId: string;
  orderItemId: string;
  refundedAmountPaise: number;
  couponClawbackPaise: number;
  pointsClawbackPaise: number;
  taxRefundPaise: number;
};

export type RefundDisbursement = {
  id: string;
  refundId: string;
  destination: RefundDestination;
  sourcePaymentId: string | null;
  amountPaise: number;
  status: RefundDisbursementStatus;
  gatewayRef: string | null;
  previousDisbursementId: string | null;
  initiatedAt: string;
  settledAt: string | null;
};

export type Refund = {
  id: string;
  orderId: string;
  totalRefundPaise: number;
  status: RefundStatus;
  reason: string | null;
  createdAt: string;
  completedAt: string | null;
  lines: RefundLine[];
  disbursements: RefundDisbursement[];
};

export type HeldItemStatus = 'holding' | 'expired' | 'resolved';
export type HeldItemDisposition =
  | 'returned_to_consumer'
  | 'redelivered'
  | 'forfeited_to_store'
  | 'restocked'
  | 'written_off';

export type HeldItem = {
  id: string;
  returnId: string;
  storeId: string;
  consumerId: string;
  status: HeldItemStatus;
  disposition: HeldItemDisposition | null;
  holdingWindowExpiresAt: string;
  extendedByAdminId: string | null;
  extensionReason: string | null;
  resolvedAt: string | null;
  return?: ReturnWithItem;
};

// ─────────────────────────────────────────────────────────────────────
// §1 Identity & Access — staff, admin team, sub-role permissions, notifications
// ─────────────────────────────────────────────────────────────────────

export type RetailerStaff = {
  id: string;
  storeId: string | null;
  email: string;
  legalName: string;
  phone: string;
  gstin: string;
  subRole: RetailerSubRole;
  status: 'pending_approval' | 'active' | 'terminated';
  createdAt: string;
};

export type RetailerStaffInvite = {
  id: string;
  email: string;
  subRole: RetailerSubRole;
  invitedAt: string;
  expiresAt: string;
};

export type AdminTeamMember = {
  id: string;
  email: string;
  /** Display name. Optional because the backend `admin_accounts` row has no name column today; the UI falls back to email when absent. */
  name?: string;
  subRole: AdminSubRole;
  status: 'active' | 'revoked';
  createdAt: string;
};

/** Action × sub-role permission grid edited by super-admin under §1. */
export type SubRolePermissionMatrix<Role extends string> = {
  actions: string[];
  subRoles: Role[];
  cells: Record<string, Record<Role, boolean>>;
};

export type NotificationKind = 'order' | 'refund' | 'kyc' | 'system' | 'issue' | 'payout' | 'promotion' | 'compliance';

export type Notification = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  deepLink: string | null;
  readAt: string | null;
  createdAt: string;
};

export type BannerKind = 'impersonation' | 'kyc' | 'maintenance' | 'floor_breach' | 'suspended' | 'banned' | 'paused_by_admin';

// ─────────────────────────────────────────────────────────────────────
// §2 Retailer Onboarding — application pipeline, clarification thread, store profile
// ─────────────────────────────────────────────────────────────────────

export type ApplicationStatus =
  | 'pending'
  | 'docs_requested'
  | 'approved'
  | 'rejected';

export type Application = {
  id: string;
  legalName: string;
  email: string;
  phone: string;
  gstin: string;
  pan: string | null;
  addressLine: string;
  pincode: string;
  stateCode: string;
  submittedAt: string;
  status: ApplicationStatus;
  pennyDropResult: 'matched' | 'failed' | 'not_attempted';
  gstinVerification: 'valid' | 'invalid' | 'not_attempted';
  documentsCount: number;
  clarificationCount: number;
  documents?: ApplicationDocument[];
};

export type ApplicationDocumentKind =
  | 'storefront_photo'
  | 'address_proof'
  | 'pan'
  | 'gst_certificate'
  | 'bank_proof'
  | 'other';

export type ApplicationDocument = {
  id: string;
  kind: ApplicationDocumentKind;
  url: string;
};

/**
 * Snapshot returned from POST /applications/:id/fetch-for-resubmit. Mirrors the
 * `retailer_applications` row (minus `passwordHash`) plus the existing document set.
 * Stashed in sessionStorage and read by the application form when `?reapply=<id>` is set.
 */
export type ResubmitSnapshot = {
  application: {
    id: string;
    legalName: string;
    storeName: string | null;
    gstin: string;
    pan: string | null;
    ownerName: string;
    ownerEmail: string;
    ownerPhone: string;
    addressLine: string;
    pincode: string;
    stateCode: string;
    lat: string | null;
    lng: string | null;
    hours: Record<string, unknown> | null;
    categories: string[] | null;
    brands: string[] | null;
    sampleSkus: unknown[] | null;
    bankLegalName: string | null;
    bankAccountNumber: string | null;
    bankIfsc: string | null;
    status: ApplicationStatus;
    decisionReason: string | null;
    mustReuploadDocKinds: ApplicationDocumentKind[];
    resubmissionCount: number;
  };
  documents: Array<{ kind: ApplicationDocumentKind; url: string }>;
};

export type ClarificationMessage = {
  id: string;
  applicationId: string;
  authorKind: 'admin' | 'retailer';
  authorLabel: string;
  body: string;
  attachments: string[];
  fieldKey: string | null;
  createdAt: string;
};

export type StoreHoursDay = { from: string; to: string; closed: boolean };
export type StoreHours = {
  monday: StoreHoursDay;
  tuesday: StoreHoursDay;
  wednesday: StoreHoursDay;
  thursday: StoreHoursDay;
  friday: StoreHoursDay;
  saturday: StoreHoursDay;
  sunday: StoreHoursDay;
};

export type BankAccount = {
  accountHolderName: string;
  accountNumber: string;
  ifsc: string;
  bankName: string | null;
  pennyDropStatus: 'matched' | 'name_mismatch' | 'failed' | 'not_attempted';
  pennyDropAt: string | null;
};

export type RequiredDocumentType =
  | 'gstin_certificate'
  | 'pan_card'
  | 'address_proof'
  | 'cancelled_cheque'
  | 'shop_act_license';

export type StoreDocument = {
  id: string;
  kind: RequiredDocumentType;
  label: string;
  status: 'verified' | 'pending_review' | 'missing' | 'rejected';
  uploadedAt: string | null;
  fileUrl: string | null;
};

// ─────────────────────────────────────────────────────────────────────
// §3 KYC & Compliance — re-verification, change requests, enforcement, exports/deletions
// ─────────────────────────────────────────────────────────────────────

export type KycDocumentStatus = 'verified' | 'pending_review' | 'missing' | 'rejected';

export type KycDocument = {
  id: string;
  kind: RequiredDocumentType;
  label: string;
  status: KycDocumentStatus;
  uploadedAt: string | null;
  fileUrl: string | null;
};

export type KycReverificationStatus = 'pending' | 'submitted' | 'approved' | 'rejected' | 'overdue';

export type KycReverification = {
  id: string;
  /** Retailer endpoint sets this to the caller's account id; admin endpoint
   *  omits it (uses storeId / storeName instead). Optional so both shapes type-fit. */
  retailerId?: string;
  /** Set by admin endpoint — the store the cycle belongs to. */
  storeId?: string;
  /** Joined store legal-name on admin endpoint. */
  storeName?: string | null;
  dueAt: string;
  gracePeriodEndsAt: string;
  status: KycReverificationStatus;
  lastVerifiedAt: string | null;
  submittedAt?: string | null;
  decidedAt?: string | null;
  decisionReason?: string | null;
  documents: KycDocument[];
};

export type ChangeRequestField = 'legal_name' | 'address' | 'bank_account' | 'gstin';
export type ChangeRequestStatus = 'pending' | 'under_review' | 'approved' | 'rejected';

export type ChangeRequest = {
  id: string;
  storeId: string;
  /** Joined from retailer_stores on the admin GET; absent on the retailer-scoped GET. */
  storeName?: string | null;
  field: ChangeRequestField;
  currentValue: string;
  requestedValue: string;
  reason: string | null;
  evidenceUrl: string | null;
  status: ChangeRequestStatus;
  submittedAt: string;
  decidedAt: string | null;
  decidedByAccountId: string | null;
  decisionNote: string | null;
};

/** Live store + bank values, used by the retailer submit dialog to populate "From". */
export type ChangeRequestCurrentValues = {
  legalName: string;
  address: string;
  gstin: string;
  bank: { accountNumber: string; ifsc: string; legalName: string } | null;
};

export type EnforcementStep = 'warning_1' | 'warning_2' | 'warning_3' | 'suspension' | 'termination' | 'lifted';

export type PolicyEnforcementAction = {
  id: string;
  storeId: string;
  step: EnforcementStep;
  breachKind: 'acceptance_rate' | 'fulfilment_sla' | 'dispute_rate' | 'return_rate' | 'kyc_overdue' | 'policy_violation';
  metric: Record<string, unknown> | null;
  actedAt: string;
  actedByAdminId: string | null;
  reason: string | null;
  liftsActionId: string | null;
  /** Joined fields (admin list/detail endpoint). */
  storeName?: string | null;
  retailerId?: string | null;
  retailerName?: string | null;
  retailerEmail?: string | null;
  actorName?: string | null;
};

/** @deprecated use PolicyEnforcementAction */
export type PolicyEnforcement = PolicyEnforcementAction;

export type DataExportStatus = 'pending' | 'building' | 'ready' | 'expired' | 'failed';

export type DataExportRequest = {
  id: string;
  consumerId: string;
  requestedAt: string;
  status: DataExportStatus;
  readyAt: string | null;
  downloadUrl: string | null;
  expiresAt: string | null;
  failureReason: string | null;
  consumerName?: string | null;
  consumerEmail?: string | null;
  consumerPhone?: string | null;
};

export type AccountDeletionStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export type AccountDeletionRequest = {
  id: string;
  consumerId: string;
  requestedAt: string;
  status: AccountDeletionStatus;
  scheduledFor: string;
  cancelledAt: string | null;
  completedAt?: string | null;
  consumerName?: string | null;
  consumerEmail?: string | null;
  consumerPhone?: string | null;
};

// ─────────────────────────────────────────────────────────────────────
// §4 Store Operations — pause state, holiday calendar, notification prefs
// ─────────────────────────────────────────────────────────────────────

export type StoreVisibilityWhilePaused = 'block_orders_only' | 'hide_from_catalog';

export type StorePauseState = {
  paused: boolean;
  visibility: StoreVisibilityWhilePaused;
  pausedAt: string | null;
  reason: string | null;
};

export type HolidayDate = {
  date: string; // YYYY-MM-DD
  label: string | null;
};

export type NotificationChannel = 'push' | 'email' | 'sms' | 'in_app';
export type DashboardTileKey = 'sales' | 'orders' | 'inventory' | 'top_products' | 'recent_products' | 'compliance';

export type NotificationPrefs = {
  channels: Record<NotificationChannel, boolean>;
  dailyDigest: boolean;
  language: 'en' | 'hi' | 'mr' | 'ta';
  enabledDashboardTiles: DashboardTileKey[];
};

// ─────────────────────────────────────────────────────────────────────
// §5 Catalog and Listings — attribute templates, audit, moderation flags
// ─────────────────────────────────────────────────────────────────────

export type AttributeAxisType = 'enum' | 'free_text' | 'numeric' | 'color';

export type AttributeTemplate = {
  id: string;
  name: string;
  isPlatformDefault?: boolean;
  ownerStoreId?: string | null;
  axes: Array<{
    name: string;
    type: AttributeAxisType;
    allowedValues: string[];
  }>;
  usedByListingCount: number;
  usageCount: number;
  lastUsedAt: string | null;
  updatedAt: string | null;
};

/** One uploaded asset in the store's media library (GET /retailer/media). */
export type MediaItem = {
  id: string;
  url: string;
  publicId: string | null;
  width: number | null;
  height: number | null;
  bytes: number | null;
  resourceType: string;
  mimetype: string | null;
  folder: string | null;
  createdAt: string;
};

export type Paginated<T> = { items: T[]; nextCursor: string | null };

export type ListingAuditEntry = {
  id: string;
  listingId: string;
  action: string;
  actorKind: 'retailer' | 'admin' | 'system';
  actorId: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  at: string;
  note: string | null;
};

export type CatalogFlagSource = 'automation' | 'user_report' | 'admin_review';
export type CatalogFlagStatus = 'open' | 'under_appeal' | 'resolved_taken_down' | 'resolved_restored' | 'resolved_dismissed';

export type CatalogFlag = {
  id: string;
  listingId: string;
  /** Joined from product_listings — present in GET /admin/catalog/moderation. */
  listingName?: string | null;
  listingStatus?: ListingStatus | null;
  source: CatalogFlagSource;
  reasonCode: string;
  details: string | null;
  reportedByConsumerId: string | null;
  ruleKey: string | null;
  status: CatalogFlagStatus;
  openedAt: string;
  resolvedAt: string | null;
  assignedAdminId: string | null;
};

/** @deprecated use CatalogFlagSource */
export type CatalogFlagKind = 'auto_flagged' | 'user_reported' | 'under_appeal';

// ─────────────────────────────────────────────────────────────────────
// §7 AI Catalog Generation
// ─────────────────────────────────────────────────────────────────────

export type AiSubmissionStatus =
  | 'submitted'
  | 'processing'
  | 'ready_for_review'
  | 'accepted'
  | 'rejected'
  | 'regenerating'
  | 'failed';
export type AiSubmissionMode = 'with_model' | 'without_model';

export type AiSubmission = {
  id: string;
  storeId: string;
  listingId: string | null;
  targetVariantId: string | null;
  mode: AiSubmissionMode;
  prompt: string;
  referenceImageUrls: string[];
  revisionNotes: string | null;
  rawPhotos: string[];
  outputUrls: string[];
  status: AiSubmissionStatus;
  errorMessage: string | null;
  costPaise: number | null;
  parentSubmissionId: string | null;
  thirdPartyRequestId: string | null;
  at: string;
  // Populated only on the GET /:id detail call.
  childSubmissionId?: string | null;
};

export type AiListingQuota = {
  listingId: string;
  variantCount: number;
  usedAttempts: number;
  remaining: number;
};

// ─────────────────────────────────────────────────────────────────────
// §12 Fees and Charges
// ─────────────────────────────────────────────────────────────────────

export type FeesConfig = {
  defaultPlatformFeeBp: number;
  surgeMultiplier: number;
  gstRateBp: number;
  tcsRateBp: number;
  intraStateSplit: { cgstBp: number; sgstBp: number };
  interStateSplit: { igstBp: number };
  delivery: Record<DeliveryMethod, { baseFeePaise: number; perKmFeePaise: number }>;
  platformFeeOverrides: Array<{ retailerId: string; retailerName: string; platformFeeBp: number; reason: string }>;
  lastChanged: Partial<Record<'base_delivery_fee_table' | 'surge_multiplier' | 'tcs_rate_bp', { at: string; by: string | null }>>;
};

export type RetailerFeeView = {
  platformFeeBp: number;
  payoutCadenceDays: number;
  delegationModeEnabled: boolean;
  handlingFeePaise: number;
  convenienceFeePaise: number;
  gstRateBp: number;
  tcsRateBp: number;
};

// ─────────────────────────────────────────────────────────────────────
// §13 Promotion performance + targeted drops + anomalies
// ─────────────────────────────────────────────────────────────────────

export type PromotionPerformance = {
  promotionId: string;
  name: string;
  redemptions: number;
  uniqueConsumers: number;
  totalDiscountPaise: number;
  /** @deprecated alias of totalDiscountPaise; kept for back-compat. */
  gmvInfluencePaise: number;
  gmvInfluencedPaise: number;
  refundRateBp: number;
  aovLiftBp: number;
  anomalyFlagged: boolean;
  anomalyReasons: Array<'velocity_spike' | 'refund_spike' | 'consumer_concentration'>;
};

export type TargetedDrop = {
  id: string;
  name: string;
  promotionId: string;
  promotionName: string;
  cohortKind: 'specific_consumers' | 'tier' | 'segment';
  audienceSize: number;
  pushedAt: string;
  redemptionCount: number;
};

export type PromotionAnomaly = {
  id: string;
  promotionId: string;
  promotionName: string;
  kind: 'velocity_spike' | 'refund_spike' | 'consumer_concentration';
  detectedAt: string;
  severity: 'low' | 'medium' | 'high';
  metric: string;
  value: string;
  threshold: string;
  status: 'open' | 'acknowledged' | 'resolved';
  consumersInvolved: number;
};

// ─────────────────────────────────────────────────────────────────────
// §14 Wallet payouts (account closure escheat)
// ─────────────────────────────────────────────────────────────────────

export type WalletPayoutStatus = 'pending_claim' | 'awaiting_bank' | 'paid' | 'escheated' | 'failed';

export type WalletPayout = {
  id: string;
  consumerId: string;
  consumerEmail: string;
  balancePaise: number;
  closedAt: string;
  claimWindowEndsAt: string;
  status: WalletPayoutStatus;
  bankAccountMasked: string | null;
  paidAt: string | null;
};

// ─────────────────────────────────────────────────────────────────────
// §15 Payment capture reconciliation + failures
// ─────────────────────────────────────────────────────────────────────

export type PaymentSettlementStatus = 'uploaded' | 'reconciled' | 'partial' | 'closed';
export type PaymentSettlementEntryMatchStatus =
  | 'pending'
  | 'matched'
  | 'amount_mismatch'
  | 'missing_in_capture'
  | 'status_mismatch'
  | 'duplicate';
export type PaymentReconDiscrepancyKind =
  | 'amount_mismatch'
  | 'missing_in_capture'
  | 'missing_in_settlement'
  | 'status_mismatch'
  | 'duplicate';

export type PaymentReconSummary = {
  totalEntries: number;
  matched: number;
  amountMismatch: number;
  missingInCapture: number;
  missingInSettlement: number;
  statusMismatch: number;
  duplicate: number;
  totalAmountPaise: number;
};

export type PaymentSettlementRow = {
  id: string;
  gatewayName: string;
  cycleStart: string;
  cycleEnd: string;
  fileRef: string | null;
  status: PaymentSettlementStatus;
  summary: PaymentReconSummary;
  openDiscrepancies: number;
  uploadedAt: string;
  reconciledAt: string | null;
};

export type PaymentSettlementEntry = {
  id: string;
  settlementId: string;
  gatewayRef: string;
  amountPaise: number;
  currency: string;
  txAt: string;
  matchedPaymentId: string | null;
  matchStatus: PaymentSettlementEntryMatchStatus;
  raw: Record<string, unknown> | null;
};

export type PaymentReconDiscrepancy = {
  id: string;
  settlementId: string;
  paymentId: string | null;
  entryId: string | null;
  kind: PaymentReconDiscrepancyKind;
  details: Record<string, unknown>;
  createdAt: string;
  resolvedByAdminId: string | null;
  resolvedAt: string | null;
  resolvedNote: string | null;
};

export type PaymentSettlementDetail = {
  settlement: PaymentSettlementRow;
  entries: PaymentSettlementEntry[];
  discrepancies: PaymentReconDiscrepancy[];
};

export type PaymentFailureRow = {
  id: string;
  orderId: string;
  consumerId: string | null;
  consumerEmail: string | null;
  consumerPhone: string | null;
  amountPaise: number;
  method: PaymentMethod;
  failureCode: string | null;
  failureMessage: string | null;
  gatewayRef: string | null;
  reservationStillHeld: boolean;
  consumerNotifiedAt: string | null;
  inventoryReleasedAt: string | null;
  failedAt: string;
};

// ─────────────────────────────────────────────────────────────────────
// §16 Refunds — post-payout recovery
// ─────────────────────────────────────────────────────────────────────

export type PostPayoutRecoveryStatus = 'planned' | 'debited' | 'failed' | 'cancelled';

export type PostPayoutRecoveryRow = {
  id: string;
  refundId: string;
  orderId: string;
  retailerId: string;
  retailerName: string;
  payoutCycleId: string;
  refundedPaise: number;
  plannedDebitPaise: number;
  status: PostPayoutRecoveryStatus;
  reason: string | null;
  createdAt: string;
  scheduledFor: string;
  settledAt: string | null;
};

// ─────────────────────────────────────────────────────────────────────
// §17 Consumer Invoicing
// ─────────────────────────────────────────────────────────────────────

export type TaxInvoiceKind = 'invoice' | 'supplementary' | 'commission';

export type TaxInvoice = {
  id: string;
  number: string;
  kind: TaxInvoiceKind;
  status: 'draft' | 'issued' | 'credited';
  orderId: string;
  storeId: string;
  consumerName: string;
  issuedAt: string | null;
  totalPaise: number;
  taxableValuePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  pdfUrl: string | null;
  linkedInvoiceId: string | null;
  createdAt: string;
};

export type InvoiceNumberingConfig = {
  legalEntityId: string;
  legalEntityName: string;
  prefix: string;
  pattern: string;
  nextSequence: number;
  resetCycle: 'never' | 'fiscal_year' | 'monthly';
};

export type GstReturnFile = {
  id: string;
  period: string;
  kind: 'gstr1' | 'gstr3b' | 'tcs_reconciliation';
  generatedAt: string | null;
  downloadUrl: string | null;
  status: 'pending' | 'generating' | 'ready' | 'failed';
};

// ─────────────────────────────────────────────────────────────────────
// §18 Retailer Billing & Settlement
// ─────────────────────────────────────────────────────────────────────

export type CommissionInvoice = {
  id: string;
  number: string;
  orderId: string;
  storeId: string;
  commissionPaise: number;
  gstOnCommissionPaise: number;
  totalPaise: number;
  issuedAt: string;
  pdfUrl: string | null;
};

export type BillingStatement = {
  id: string;
  period: string;
  storeId: string;
  status: 'open' | 'closing' | 'closed';
  ordersCount: number;
  grossPaise: number;
  commissionPaise: number;
  tcsPaise: number;
  refundsPaise: number;
  holdsPaise: number;
  adjustmentsPaise: number;
  netPaise: number;
  generatedAt: string;
};

export type BillingStatementDetail = BillingStatement & {
  liabilityBookings: Array<{ id: string; issueId: string; description: string; amountPaise: number }>;
};

export type PayoutCycleStatus = 'pending' | 'processing' | 'paid' | 'failed';

export type PayoutCycle = {
  id: string;
  storeId: string;
  period: string;
  cycleStart: string;
  cycleEnd: string;
  grossPaise: number;
  commissionPaise: number;
  commissionTaxPaise: number;
  refundsHeldPaise: number;
  adjustmentsPaise: number;
  netPaise: number;
  amountPaise: number;
  status: PayoutCycleStatus;
  bankAccountMasked: string;
  bankConfirmationRef: string | null;
  retryCount: number;
  initiatedAt: string | null;
  settledAt: string | null;
  statementUrl: string | null;
  createdAt: string;
  deductions?: Array<{ kind: string; label: string; amountPaise: number }>;
};

export type EarlyDisbursementStatus = 'pending' | 'approved' | 'rejected';

export type EarlyDisbursementRequest = {
  id: string;
  storeId: string;
  storeName: string;
  amountPaise: number;
  reason: string;
  requestedAt: string;
  status: EarlyDisbursementStatus;
  decidedAt: string | null;
  decisionNote: string | null;
};

export type BillingMonthSummary = {
  period: string;
  status: 'open' | 'closing' | 'closed';
  storesIncluded: number;
  totalGrossPaise: number;
  totalCommissionPaise: number;
  totalNetPaise: number;
  closedAt: string | null;
  gstReturnStatus: 'pending' | 'generating' | 'ready' | 'failed';
};

export type AdminPayoutRow = {
  id: string;
  storeId: string;
  storeName: string;
  period: string;
  amountPaise: number;
  status: PayoutCycleStatus;
  bankAccountMasked: string;
  bankConfirmationRef: string | null;
  retryCount: number;
  initiatedAt: string | null;
  settledAt: string | null;
  createdAt: string;
};

export type TailOfCycleRow = {
  storeId: string;
  storeName: string;
  period: string;
  unreconciledPaise: number;
  reasonHints: string[];
};

// ─────────────────────────────────────────────────────────────────────
// §19 Issue detail (extends IssueListRow already in place)
// ─────────────────────────────────────────────────────────────────────

export type IssueMessage = {
  id: string;
  senderType: 'admin' | 'retailer' | 'consumer' | 'system';
  senderId: string;
  body: string;
  attachments: string[];
  at: string;
};

export type IssueTransition = {
  id: string;
  issueId: string;
  fromStatus: IssueStatus | null;
  toStatus: IssueStatus;
  actorType: ActorType;
  actorId: string;
  reason: string | null;
  at: string;
};

export type IssueEvidencePhoto = {
  url: string;
  source: string;
  label?: string;
};

export type ConsumerFlag = {
  kind: string;
  reason: string;
  at: string;
};

export type RetailerEnforcementEntry = {
  step: string;
  breachKind: string;
  reason: string | null;
  actedAt: string;
};

export type IssuePartyContext = {
  consumerFlags: ConsumerFlag[];
  retailerEnforcements: RetailerEnforcementEntry[];
};

export type IssueDetail = IssueListRow & {
  target: Record<string, unknown> | null;
  decidedByAdmin: { id: string; email: string } | null;
  assignedAdminId?: string | null;
  messages: IssueMessage[];
  transitions: IssueTransition[];
  evidencePhotos?: IssueEvidencePhoto[];
  /** Returned physical goods sitting at the store for this dispute's return(s). */
  heldItems?: IssueHeldItem[];
  partyContext?: IssuePartyContext | null;
  payoutAdjustmentPaise?: number | null;
};

/** A returned item held at the store pending this dispute's outcome. */
export type IssueHeldItem = {
  id: string;
  status: string;
  disposition: string | null;
  holdingWindowExpiresAt: string | null;
  resolvedAt: string | null;
};

// ─────────────────────────────────────────────────────────────────────
// §20 Consumer Management — bans + community/reviews moderation
// ─────────────────────────────────────────────────────────────────────

export type ConsumerBanFlags = {
  community: boolean;
  rewards: boolean;
  reviews: boolean;
};

export type CommunityFlag = {
  id: string;
  consumerId: string;
  consumerLabel: string;
  postId: string;
  excerpt: string;
  reason: 'spam' | 'harassment' | 'nsfw' | 'misinfo' | 'other';
  reportedBy: string;
  reportedAt: string;
  status: 'open' | 'approved' | 'taken_down';
};

export type ReviewFlag = {
  id: string;
  consumerId: string;
  consumerLabel: string;
  reviewId: string;
  listingId: string;
  listingName: string;
  rating: number;
  excerpt: string;
  reason: 'spam' | 'fake' | 'abuse' | 'irrelevant' | 'other';
  reportedAt: string;
  status: 'open' | 'approved' | 'taken_down' | 'edited';
};

// ─────────────────────────────────────────────────────────────────────
// §21 Analytics & Reporting (rollup row shapes)
// ─────────────────────────────────────────────────────────────────────

export type SalesReportRow = {
  bucket: string;
  ordersCount: number;
  grossPaise: number;
  netPaise: number;
};

export type FulfilmentMetricRow = {
  bucket: string;
  acceptanceRateBp: number;
  avgTimeToAcceptMs: number;
  avgTimeToPackMs: number;
  avgTimeToHandoverMs: number;
  avgEndToEndMs: number;
};

export type ReturnsReportRow = {
  bucket: string;
  returnRateBp: number;
  totalReturns: number;
  topListing: string;
  topReason: string;
};

export type LeaderboardRow = {
  retailerId: string;
  retailerName: string;
  acceptanceRateBp: number;
  fulfilmentScoreBp: number;
  returnRateBp: number;
  disputeRateBp: number;
  rank: number;
};

export type FunnelStep = {
  label: string;
  count: number;
  dropoffPctFromPrevious: number;
};

export type FeatureUsageRow = {
  feature: string;
  uniqueUsers: number;
  totalUsage: number;
  costPaise: number;
};

export type OperationalRow = {
  metric: string;
  value: string;
  trendBp: number;
};

export type ComplianceFloorRow = {
  retailerId: string;
  retailerName: string;
  metric: string;
  value: string;
  threshold: string;
  daysBelow: number;
};

export type InventoryHealthRow = {
  listingId: string;
  listingName: string;
  variantSku: string | null;
  stock: number;
  reservedDays: number;
  status: 'low_stock' | 'out_of_stock' | 'overstock' | 'aged';
  lastSoldAt: string | null;
};
