# Retailer Dashboard — UX Improvement Suggestions

The retailer side has grown feature-complete but hard to navigate. This doc covers concrete changes to reduce clutter and make daily workflows faster.

---

## 1. Sidebar: Too Many Items

**Problem:** 35+ nav items across 8 groups. A retailer opening the dashboard for the first time sees a wall of links. Reports alone has 13 entries (4 of which are legacy duplicates).

### Suggestions

#### 1a. Collapse Reports into a single "Reports" page with sub-navigation
**Current:** 13 sidebar items (Sales detail, Revenue summary, Listing revenue, Variant conversion, Best sellers, Dead stock, Top returns, Compliance, Payout cycles + 4 legacy).
**Proposed:** One "Reports" sidebar link → landing page with report cards grouped into Sales, Catalog, Operations. Each card links to its report. Remove legacy reports entirely or hide behind a toggle.
- Priority: **High**
- Effort: **Medium** — new reports index page, remove 12 sidebar entries, retire legacy pages

#### 1b. Collapse Finance into 2-3 sidebar items max
**Current:** 7 items (Fees, Tax invoices, Commission invoices, Billing statements, Payouts, Upcoming payout, Early disbursement).
**Proposed:** Group into:
- **Fees** (standalone, rarely visited)
- **Invoices** (merge Tax + Commission invoices with tab toggle)
- **Payouts** (merge Payouts list + Upcoming payout + Early disbursement into one page with tabs or sections)

Billing statements can fold into Invoices as a third tab.
- Priority: **High**
- Effort: **Medium** — merge pages, add tab navigation within combined pages

#### 1c. Move Workspace Tools into a secondary area
**Current:** Inbox, Notification prefs, Holiday calendar, Pickup slots live as top-level sidebar items.
**Proposed:** Move to a "Settings" or gear menu. These are configure-once items, not daily workflows. Keep Inbox accessible (move to top bar bell icon area).
- Priority: **Medium**
- Effort: **Small** — rearrange sidebar config in `layout.tsx`

#### 1d. Target sidebar item count
After 1a-1c, sidebar should have ~15-18 items across 5 groups:
```
Workspace     → Overview, Store settings
Orders        → Orders, Returns, Held items, Issues
Catalog       → Products, Inventory, Pricing, Attribute templates, AI catalog
Marketing     → Promotions
Finance       → Fees, Invoices, Payouts
Reports       → (single link)
Settings      → Staff, Notifications, Holidays, Pickup slots, KYC, Change requests
```

---

## 2. Tab Overload on Key Pages

**Problem:** Several pages use 5-8 tabs. On mobile, tabs overflow and require horizontal scroll. Cognitive load is high even on desktop.

### Suggestions

#### 2a. Store profile: collapse 7 tabs into sections on one scrollable page
**Current tabs:** Basics, Photos, Hours, Address, Legal & Bank, Documents, Status.
**Proposed:** Single scrollable page with collapsible sections. Most retailers edit this once during setup. A scrollable form with section anchors (jump links at top) is easier than hunting through tabs.
- Priority: **Medium**
- Effort: **Medium** — restructure `store.tsx` from tab layout to sectioned scroll

#### 2b. Listing detail: reorder and group 6 tabs
**Current tabs:** Overview, Variants & inventory, Details, Promotions, AI generations, Audit log.
**Proposed:** Keep tabs but reorder by frequency:
1. Overview (most visited)
2. Variants & inventory (daily ops)
3. Details (occasional edits)
4. Promotions (marketing)

Move "AI generations" and "Audit log" into a "More" dropdown or secondary tab row — they're reference tabs, not action tabs.
- Priority: **Low**
- Effort: **Small** — reorder tabs, add overflow menu

#### 2c. Promotions: merge related tabs
**Current tabs:** Variant prices (redirect), Offers, Coupons, Vouchers, Performance, Platform impact.
**Proposed:**
- Merge Offers + Coupons + Vouchers into one "Promotions" list with a "Type" column/filter
- Keep Performance and Platform impact as secondary tabs or move to Reports
- Remove Variant prices redirect (link to Pricing page instead)
- Priority: **Medium**
- Effort: **Large** — refactor promotion list to unified view with type filter

---

## 3. Missing Command Palette / Global Search

**Problem:** `layout.tsx` has a search placeholder (Cmd+K) in the top bar but it's non-functional. Retailers must know which sidebar section holds what they need.

### Suggestion

#### 3a. Implement Cmd+K command palette
Allow searching across: pages, products (by name/SKU), orders (by ID), staff members. Even a simple page-name fuzzy search would cut navigation time significantly.
- Priority: **High**
- Effort: **Medium** — command palette component + index of pages/entities

---

## 4. Missing Contextual Cross-links

**Problem:** Related pages require sidebar hops. Product → Inventory → Pricing are tightly related but disconnected.

### Suggestions

#### 4a. Add quick-links on listing detail page
Show inline links to: "View inventory for this product", "Edit pricing", "See recent orders containing this product." These exist as separate pages but aren't cross-referenced.
- Priority: **Medium**
- Effort: **Small** — add link buttons to `listing-detail.tsx`

#### 4b. Add prev/next navigation on order detail
When processing a batch of pending orders, retailers must go back to the list and click the next order. Add prev/next arrows on the order detail page.
- Priority: **Medium**
- Effort: **Small** — pass order list context to detail page

#### 4c. Add inline low-stock alert links on dashboard
Dashboard already shows low-stock variants. Make each row clickable → links to that product's inventory tab.
- Priority: **Low**
- Effort: **Small** — add `<Link>` wrapper on dashboard low-stock rows

---

## 5. Onboarding vs. Live Dashboard Transition

**Problem:** Dashboard has two completely different modes (onboarding steps vs. analytics). The switch is abrupt. New retailers who just went live see analytics with zero data and no guidance.

### Suggestion

#### 5a. Add a "Getting Started" checklist that persists for first 7 days after going live
Instead of immediately showing empty charts, overlay a dismissible checklist:
- [ ] Add your first 5 products
- [ ] Set store hours
- [ ] Upload store photos
- [ ] Configure pickup slots
- [ ] Share your store link

Show analytics underneath but with the checklist as the hero element.
- Priority: **Medium**
- Effort: **Medium** — new component, track completion state

---

## 6. Empty States Need More Guidance

**Problem:** Retailer pages use a generic `<Empty/>` component with minimal context. Admin pages have richer empty states with action hints.

### Suggestion

#### 6a. Add contextual CTAs to empty states
Examples:
- Products page empty → "Add your first product" button + "Import from CSV" link
- Orders page empty → "Share your store link to start receiving orders" + link to store page
- Returns page empty → "No returns yet" (reassuring tone, no action needed)
- Promotions empty → "Create your first offer to boost sales" + link to guide

Each empty state should have: icon, message, primary CTA (where applicable), secondary link.
- Priority: **Medium**
- Effort: **Small** — update `<Empty/>` usage per page

---

## 7. Legacy Report Cleanup

**Problem:** 4 reports are labeled "(legacy)" in the sidebar: Sales, Performance, Returns, Inventory health. They coexist with newer versions creating confusion about which to use.

### Suggestion

#### 7a. Remove legacy reports from sidebar, add redirect
If new reports cover the same data, remove legacy sidebar entries. Add a banner on legacy pages: "This report has been replaced by [New Report]. Redirecting in 5s..." with a link.
- Priority: **High**
- Effort: **Small** — remove sidebar items in `layout.tsx`, add redirect pages

---

## 8. Order Pipeline Tab Count

**Problem:** 8 tabs for order statuses (pending, accepted, packed, picked_up, in_delivery, at_door, delivered_today, cancelled_today). On mobile these overflow.

### Suggestion

#### 8a. Group into 3 primary tabs with status filter
- **Active** (pending + accepted + packed) — these need retailer action
- **In Transit** (picked_up + in_delivery + at_door) — read-only tracking
- **Completed** (delivered_today + cancelled_today) — history

Within each tab, show status as a badge/filter chip rather than a separate tab.
- Priority: **Medium**
- Effort: **Medium** — refactor tab structure in `orders/list.tsx`

---

## Summary Table

| # | Change | Priority | Effort | Impact |
|---|--------|----------|--------|--------|
| 1a | Reports → single page with sub-nav | High | Medium | Removes 12 sidebar items |
| 1b | Finance → 3 items max | High | Medium | Removes 4 sidebar items |
| 1c | Workspace Tools → Settings | Medium | Small | Removes 4 sidebar items |
| 3a | Cmd+K command palette | High | Medium | Faster navigation across board |
| 7a | Remove legacy reports | High | Small | Eliminates confusion |
| 2c | Merge promotion tabs | Medium | Large | Simpler marketing workflow |
| 2a | Store profile → scrollable sections | Medium | Medium | Better mobile + setup flow |
| 4a | Cross-links on listing detail | Medium | Small | Faster product management |
| 4b | Prev/next on order detail | Medium | Small | Faster order processing |
| 5a | Post-launch getting started checklist | Medium | Medium | Better onboarding transition |
| 6a | Contextual empty states | Medium | Small | Better first-time experience |
| 8a | Order tabs → 3 groups | Medium | Medium | Mobile-friendly orders |
| 2b | Listing detail tab reorder | Low | Small | Minor clarity improvement |
| 4c | Dashboard low-stock links | Low | Small | Minor convenience |

### Recommended execution order
1. **Quick wins first:** 7a (legacy cleanup), 1c (move workspace tools), 4a-4c (cross-links)
2. **High-impact restructuring:** 1a (reports index), 1b (finance merge), 3a (Cmd+K)
3. **Polish:** 2a (store sections), 5a (onboarding checklist), 6a (empty states), 8a (order groups)
4. **Larger refactors:** 2c (promotion merge)
