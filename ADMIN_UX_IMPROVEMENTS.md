# Admin Dashboard — UX Improvement Suggestions

Admin side is powerful but cluttered. 52 sidebar items across 11 groups, dense tables without sorting, modal fatigue on detail pages, and overlapping financial sections. This doc covers concrete changes to make daily admin work faster and less overwhelming.

---

## 1. Sidebar: 52 Items Is Too Many

**Problem:** 11 nav groups with 52 total items. Settlement alone has 9 entries. Reports has 7. Admins can't remember where things live.

### Suggestions

#### 1a. Merge Settlement + Finance into one "Money" group
**Current:** Settlement (9 items: Billing console, Payouts pipeline, Holds, Adjustments, Early disbursement, Tail of cycle, Invoice ops, Invoice numbering, GST returns) + Finance (4 items: Fees, Payment reconciliation, Payment failures, Wallet payouts) = 13 items across 2 groups.
**Proposed:** Single "Money" group with 3 sub-sections:
- **Payouts** → Payouts pipeline, Holds, Early disbursement, Tail of cycle
- **Invoices** → Billing console, Invoice ops, Invoice numbering, GST returns
- **Reconciliation** → Payment reconciliation, Payment failures, Refund reconciliation

Fees moves to a Settings area. Adjustments and Wallet payouts become actions within Payouts pipeline, not standalone pages.
- Priority: **High**
- Effort: **Medium** — rearrange sidebar config in `layout.tsx`, merge 2-3 thin pages into parent pages

#### 1b. Reports → single hub page
**Current:** 7 sidebar entries (Headline, Leaderboard, Funnel, Feature usage, Operational, Below floor, Floor breaches).
**Proposed:** One "Reports" link → landing page with report cards. Each card shows title, one-line description, freshness timestamp. Click → individual report.
- Priority: **High**
- Effort: **Small** — new index page, remove 6 sidebar items

#### 1c. Collapse Compliance into fewer items
**Current:** 5 items (KYC queue, Change requests, Policy enforcement, Data exports, Account deletions).
**Proposed:** Merge into 2:
- **Compliance queue** (existing page already has 4 tabs: KYC, Floor breaches, Data exports, Account deletions — so KYC queue, Data exports, Account deletions are redundant sidebar entries)
- **Policy & changes** (merge Policy enforcement + Change requests)
- Priority: **High**
- Effort: **Small** — remove redundant sidebar links that duplicate tabs on compliance.tsx

#### 1d. Target sidebar count
After 1a-1c, sidebar drops from 52 to ~25-28 items across 7 groups:
```
Operations    → Dashboard, Applications, Retailers, Stores, New retailer
Compliance    → Compliance queue, Policy & changes
Identity      → Admin team, Sub-roles
Orders        → All orders, Test order, Refund reconciliation, Post-payout recovery, Held items, Issues, Delivery windows
Money         → Payouts, Invoices, Reconciliation, Fees
Customers     → Consumers, Loyalty config, Community moderation, Reviews moderation
Catalog       → Listings search, Featured selections, Catalog moderation
Promotions    → Promotions, Targeted drops, Clubbing matrix, Pricing simulator, Feature controls
Reports       → (single link)
```

---

## 2. Tables Need Sorting and Fewer Columns

**Problem:** Key tables (Retailers, Listings, Payouts pipeline) have 7 columns, no sorting, and no bulk actions. Finding "oldest pending retailer" or "highest-rated listing" requires eyeballing.

### Suggestions

#### 2a. Add column sorting to all admin tables
**Affected pages:** `retailers.tsx` (7 cols), `listings-search.tsx` (5 cols), `payouts-pipeline.tsx` (7 cols), `payment-reconciliation.tsx`.
**Minimum sortable columns:** name/date/status/amount. Click column header to sort asc/desc.
- Priority: **High**
- Effort: **Medium** — add sort state to existing table components

#### 2b. Hide low-value columns by default on Retailers table
**Current columns:** Retailer, Role, Contact, GSTIN, Status, Joined, Actions.
**Proposed default:** Retailer, Status, Joined, Actions. Show Role, Contact, GSTIN via column picker toggle (already exists in some tables).
Sub-role badge can live inline with retailer name. GSTIN belongs on detail page, not list view.
- Priority: **Medium**
- Effort: **Small** — adjust default column visibility

#### 2c. Add bulk actions to high-frequency lists
**Applications:** Bulk approve (select 5 pending apps → approve all). Saves 5 modal interactions.
**Listings:** Bulk retire (select 10 → retire all). Currently requires 10 individual modals.
**Payouts pipeline:** "Retry all failed" button on Failed tab.
- Priority: **High**
- Effort: **Medium** — `BulkActionBar` component already exists, wire it to these pages

---

## 3. Cmd+K Command Palette

**Problem:** Sidebar has a search hint ("Search retailers, stores, promos...") but it only searches entities, not admin screens. Finding "Policy enforcement" or "Invoice numbering" requires knowing which group it lives in.

### Suggestion

#### 3a. Implement Cmd+K with page search + entity search
**Page search:** Fuzzy match against all 52 sidebar item names. Type "payout" → shows Payouts pipeline, Payout detail, Upcoming payout.
**Entity search:** Same search that exists today (retailers, stores, promos by name/ID).
Combine both in one palette with sections.
- Priority: **High**
- Effort: **Medium** — command palette component + page index

---

## 4. Compliance Queue Needs Aggregate Counts

**Problem:** `compliance.tsx` has 4 tabs (KYC due, Floor breaches, Data exports, Account deletions) but no badge counts. Admin must click each tab to see if anything needs attention.

### Suggestion

#### 4a. Add count badges on compliance tabs
Show unread/pending count on each tab: `KYC due (3)`, `Floor breaches (1)`, `Data exports (0)`, `Account deletions (0)`. Fetch counts in parallel on page load.
- Priority: **High**
- Effort: **Small** — add count queries, render as tab badges

#### 4b. Add urgency sorting to KYC tab
Sort by days-until-due ascending. Color-code: overdue = red, due in 3 days = orange, due in 7+ days = neutral. Currently no sort order — items appear in arbitrary order.
- Priority: **Medium**
- Effort: **Small** — client-side sort on fetched data

---

## 5. Store Detail Page Is Too Dense

**Problem:** `store-detail.tsx` (727 lines) packs 4 KPI tiles + action ribbon + 2-column profile + compliance card + accounts roster + 6 ops deep-link tiles + 4 modal dialogs onto one scrollable page. Admin loses context scrolling between sections.

### Suggestions

#### 5a. Break store detail into tabs
**Proposed tabs:**
1. **Overview** — KPI tiles + action ribbon + profile summary
2. **Accounts** — AccountsOnStoreCard (staff roster, password resets)
3. **Compliance** — KYC status, enforcement history, compliance floor
4. **Operations** — 6 ops tiles (Listings, Inventory, Orders, Returns, Held items, Promotions)

Each tab loads on demand. Action ribbon stays pinned at top across all tabs.
- Priority: **Medium**
- Effort: **Medium** — restructure `store-detail.tsx` into tabbed layout

#### 5b. Consolidate lifecycle actions into one dropdown
**Current:** 5 separate buttons (Pause, Suspend, Terminate, Resume, Edit) compete for space on action ribbon.
**Proposed:** Primary button = most likely next action (based on current status). Secondary = dropdown with remaining actions. Example: active store shows "Pause" as primary, dropdown has Suspend/Terminate/Edit.
- Priority: **Medium**
- Effort: **Small** — replace button row with split-button pattern

---

## 6. Store Dropdown in Modals Is Unusable at Scale

**Problem:** Policy enforcement, promotions filter, payout cycle forms all use a plain `<select>` dropdown to pick a store. With 200+ stores, scrolling through a dropdown is painful.

### Suggestion

#### 6a. Replace all store dropdowns with searchable combobox
`StoreCombobox` component already exists at `components/ui/store-combobox.tsx`. Replace plain `<select>` with it in:
- `policy-enforcement.tsx` — new enforcement action dialog
- `promotions.tsx` — store filter dropdown
- `payouts-pipeline.tsx` — cycle preview/run form
- `promotion-new.tsx` — store selection
- Priority: **High**
- Effort: **Small** — swap component, already built

---

## 7. Promotions Page Has 7 Tabs

**Problem:** `promotions.tsx` has 7 tabs (Offers, Coupons, Vouchers, Targeted drops, Performance, Comparison, Anomalies). Each mechanism tab (Offers/Coupons/Vouchers) duplicates the same layout with search + status + discount type + store filters.

### Suggestion

#### 7a. Merge mechanism tabs into one list with Type filter
**Proposed:** Single "All promotions" list with a "Mechanism" filter chip (Offer/Coupon/Voucher/Targeted drop). Keep Performance, Anomalies as secondary tabs. Drop Comparison tab — merge comparison charts into Performance.

Result: 3 tabs instead of 7 (All promotions, Performance, Anomalies).
- Priority: **Medium**
- Effort: **Large** — refactor promotion list to unified view

---

## 8. Issue Detail Has Too Many Dialogs

**Problem:** `issue-detail.tsx` (607 lines) has 5+ independent modal dialogs for: Decide, Reply, Assign, Change kind, Flag party, Request evidence. Admin bounces between modals during one dispute resolution.

### Suggestion

#### 8a. Convert issue actions to inline panels instead of modals
Show decision form, reply box, and assignment picker as collapsible inline sections below the message thread. Only use modals for destructive/irreversible actions (Flag party, Close).
- Priority: **Medium**
- Effort: **Medium** — replace Dialog wrappers with collapsible sections

---

## 9. Dashboard KPIs Are Visually Flat

**Problem:** Dashboard has 3 primary KPIs (pending apps, active retailers, active stores) + 5 secondary KPIs (GMV, take-rate, dispute-rate, refund-rate, payout volume). Secondary KPIs are small cards that blend into background. Chart takes 2/3 of grid but provides limited insight.

### Suggestions

#### 9a. Promote actionable KPIs, demote informational ones
**Hero strip:** Pending applications (with "Review" link), Failed payouts (with "Retry" link), Overdue KYC (with "Review" link) — these drive action.
**Secondary strip:** GMV, take-rate, active retailers — these are informational.
**Chart:** Keep but make it smaller (1/2 width), add click-to-filter (click "Pending" segment → navigate to Applications filtered by pending).
- Priority: **Low**
- Effort: **Medium** — rearrange dashboard layout, add navigation links to KPI cards

---

## 10. Retailer Status Dropdown Has 8 Options

**Problem:** `retailers.tsx` status filter has: pending_approval, approved_no_store, onboarding, active, paused, suspended, terminated, all. "approved_no_store" and "onboarding" are intermediate states that confuse.

### Suggestion

#### 10a. Simplify to 5 statuses with smart grouping
**Proposed filter options:** All, Pending (merges pending_approval + approved_no_store + onboarding), Active, Suspended (includes paused), Terminated.
Intermediate states still exist in data — just group them in the filter UI.
- Priority: **Low**
- Effort: **Small** — change filter mapping in `retailers.tsx`

---

## 11. No Cross-links Between Related Pages

**Problem:** Viewing a retailer's stores requires: Retailers → click retailer → retailer-detail → Stores tab. No quick way to jump from a store to its retailer, from a payout to its store, or from a promotion to the store running it.

### Suggestions

#### 11a. Add breadcrumb-style cross-links
- Store detail header → link to parent retailer
- Payout detail → link to store
- Promotion detail → link to store (if store-scoped)
- Order detail → links to both store and consumer
- Priority: **Medium**
- Effort: **Small** — add `<Link>` elements to detail page headers

#### 11b. Add "View stores" shortcut on Retailers list
Each retailer row → small "stores" chip showing count. Click → navigates to Stores filtered by that retailer.
- Priority: **Low**
- Effort: **Small**

---

## 12. Payout Math Not Visualized

**Problem:** `payout-detail.tsx` shows payout breakdown as form fields. Admin can't quickly see: Gross → minus Commission → minus TCS → minus Refunds held → minus Dispute holds → plus Adjustments = Net.

### Suggestion

#### 12a. Add waterfall/funnel visualization to payout detail
Simple stacked bar or waterfall chart showing each deduction step. Makes it immediately clear why net payout differs from gross.
- Priority: **Low**
- Effort: **Medium** — LineChart component exists, add waterfall variant or use stacked bars

---

## Summary Table

| # | Change | Priority | Effort | Impact |
|---|--------|----------|--------|--------|
| 1a | Merge Settlement + Finance → "Money" | High | Medium | -8 sidebar items |
| 1b | Reports → single hub page | High | Small | -6 sidebar items |
| 1c | Collapse Compliance sidebar items | High | Small | -3 sidebar items |
| 3a | Cmd+K command palette | High | Medium | Faster navigation |
| 4a | Compliance tab count badges | High | Small | At-a-glance triage |
| 6a | Replace store `<select>` with combobox | High | Small | Fixes 4 slow dropdowns |
| 2a | Add table sorting | High | Medium | Find things without scrolling |
| 2c | Bulk actions on lists | High | Medium | Batch approve/retire/retry |
| 2b | Hide low-value table columns | Medium | Small | Cleaner retailer list |
| 5a | Store detail → tabs | Medium | Medium | Less scrolling |
| 5b | Lifecycle action dropdown | Medium | Small | Cleaner action ribbon |
| 7a | Promotion tabs 7 → 3 | Medium | Large | Simpler promo management |
| 8a | Issue detail inline panels | Medium | Medium | Fewer modal bounces |
| 4b | KYC urgency sorting | Medium | Small | Triage overdue first |
| 11a | Cross-links on detail pages | Medium | Small | Faster entity navigation |
| 9a | Dashboard actionable KPIs | Low | Medium | Better daily overview |
| 10a | Simplify retailer status filter | Low | Small | Less confusing filter |
| 11b | "View stores" chip on retailer rows | Low | Small | Minor convenience |
| 12a | Payout waterfall chart | Low | Medium | Visual clarity |

### Recommended execution order
1. **Quick wins:** 1c (compliance sidebar dedup), 6a (store combobox swap — component already exists), 4a (tab badges), 2b (hide columns)
2. **High-impact restructuring:** 1a (Money group merge), 1b (reports hub), 3a (Cmd+K), 2a (sorting), 2c (bulk actions)
3. **Detail page polish:** 5a (store detail tabs), 5b (action dropdown), 8a (issue inline panels), 4b (KYC sort), 11a (cross-links)
4. **Larger refactors:** 7a (promotion tab merge), 9a (dashboard KPIs), 12a (payout waterfall)
