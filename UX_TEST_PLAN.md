# UX Test Plan — Admin + Retailer

End-to-end manual QA for the UX improvements shipped from `ADMIN_UX_IMPROVEMENTS.md` and `RETAILER_UX_IMPROVEMENTS.md`. Written as user stories so any tester can step through one row at a time.

---

## Preface

### How to use this doc

Each story is self-contained: read the **As / I want / So that** to understand intent, set up the **Preconditions**, follow the **Steps**, and tick each **Acceptance** bullet. **Regression check** entries (when present) call out behaviour that should NOT have changed — useful for catching collateral damage.

Story IDs:
- `S-A-N` — Admin feature
- `S-AF-N` — Admin audit-fix hardening
- `S-R-N` — Retailer feature
- `S-RF-N` — Retailer audit-fix hardening

### Environment

- Dashboard dev server: `npm run dev` in `/dashboard/` → http://localhost:5173
- Backend: Render deployment or local backend on http://localhost:3099
- Browser: Chrome / Brave with DevTools accessible (we verify network panel + localStorage in several stories)

### Fixtures (one-time setup)

Before running, seed (or sign in to a fixture that already has):
1. **Super-admin account** with full permission matrix
2. **One Ops-admin sub-role** missing `reports.view`
3. **One Support-admin sub-role** missing `payouts.view`
4. **One Owner-retailer** with **active store** that has:
   - ≥ 5 active listings (one with ≤ 3 stock on some variant for low-stock test)
   - ≥ 5 orders across multiple statuses (pending, packed, in-delivery, delivered)
   - At least one platform-wide promotion redeemed against it
   - At least one settled and one failed payout
   - ≥ 1 store-photo uploaded
5. **One Manager-retailer** sub-role missing `orders.view`
6. **One Floor-staff** sub-role missing `staff.list`
7. **KYC fixture**: 1 KYC cycle due in 2 days, 1 overdue by 5 days
8. **Issue fixture**: 1 open dispute, 1 query

### Personas (referenced throughout)

| Persona | Permissions slice |
|---|---|
| **Super-admin** | Full admin matrix |
| **Ops-admin** | Lacks `reports.view` |
| **Support-admin** | Lacks `payouts.view` and `payouts.hold` |
| **Owner-retailer** | Full retailer matrix |
| **Manager-retailer** | Lacks `orders.view` |
| **Floor-staff** | Lacks `staff.list`, `listings.view` |

---

## Smoke order (run this first — ~25 min)

Validates highest-impact changes before exhaustive coverage:

1. **S-A-1** Admin sidebar shape (Money replaces Settlement+Finance; Reports collapsed)
2. **S-A-2** Cmd+K admin palette page + entity search
3. **S-A-9** Retailers sort, status filter, view-stores chip
4. **S-A-14** Compliance tab badges + KYC sorted by urgency
5. **S-A-18** Store-detail tabs + lifecycle split-button
6. **S-A-23** Promotions 4 tabs + StoreCombobox extras
7. **S-A-26** Payout waterfall + cross-links
8. **S-R-1** Retailer sidebar shape (Reports + Finance + Settings collapse)
9. **S-R-3** Cmd+K retailer palette
10. **S-R-9** Orders 3-group + chip strip
11. **S-R-11** Listing detail tabs reorder + More + cross-link chips
12. **S-R-15** Getting Started checklist on a fresh active store

If all 12 pass, dig into full stories below.

---

## Admin stories

### A1. Sidebar / navigation

Scope: items 1a, 1b, 1c from `ADMIN_UX_IMPROVEMENTS.md`.

#### S-A-1 · Sidebar groups collapsed to ~22 items

**As** Super-admin
**I want** a deduped admin sidebar
**So that** I can find pages without scrolling 50 entries

**Preconditions:** Logged in as Super-admin.
**Steps:**
1. Open `/admin/dashboard`.
2. Count sidebar items per group.

**Acceptance:**
- ✅ "Money" group present; "Settlement" and "Finance" groups absent.
- ✅ Money group contains exactly one item: "Money" → `/admin/money`.
- ✅ Reports group contains exactly one item: "Reports" → `/admin/reports`.
- ✅ Compliance group contains: Compliance queue, Change requests, Policy enforcement (no `Data exports` or `Account deletions` directly — those are tabs inside Compliance queue).
- ✅ Total visible sidebar items ≤ 25.

**Regression check:** Clicking each group item still navigates correctly; permission filter still applies (Ops-admin missing `reports.view` doesn't see the Reports entry).

#### S-A-2 · Money hub page

**As** Super-admin
**I want** all settlement / billing / reconciliation surfaces accessible from one hub
**So that** I don't have to remember which group hosts which page

**Preconditions:** Logged in as Super-admin.
**Steps:**
1. Click sidebar "Money".

**Acceptance:**
- ✅ URL is `/admin/money`.
- ✅ Page shows 4 grouped sections: Payouts, Invoices, Reconciliation, Configuration.
- ✅ Each section has clickable cards that navigate to the existing standalone page (e.g. "Payouts pipeline" card → `/admin/payouts-pipeline`).
- ✅ Card hover state shows arrow-up-right indicator.

#### S-A-3 · Reports hub page

**As** Super-admin
**I want** all reports surfaced as cards in one place
**So that** I don't need 7 sidebar entries.

**Preconditions:** Logged in as Super-admin.
**Steps:**
1. Click sidebar "Reports".

**Acceptance:**
- ✅ URL is `/admin/reports`.
- ✅ Grid of report cards: Headline, Leaderboard, Funnel, Feature usage, Operational, Below floor, Floor breaches.
- ✅ Each card navigates to the corresponding standalone report when clicked.

#### S-AF-1 · Hub permission gating (Money + Reports)

**As** Support-admin (lacks `payouts.view`)
**I want** to be told I lack access instead of seeing dead cards
**So that** I don't waste clicks bouncing into 403s

**Preconditions:** Login as Support-admin sub-role.
**Steps:**
1. Open `/admin/money`.

**Acceptance:**
- ✅ Cards for "Payouts pipeline", "Payout holds" (anything needing `payouts.view` / `payouts.hold`) are absent.
- ✅ Cards for which sub-role has permission ARE visible.
- ✅ If all groups would be empty, an `<Empty kicker="No access" title="You don't have permission to view any money pages.">` block renders instead of an empty grid.
- ✅ Same behaviour exercised on `/admin/reports` for a sub-role lacking `reports.view`: shows "No access" empty state.

**Regression check:** Super-admin still sees all cards.

#### S-A-4 · Compliance sidebar dedup

**As** Super-admin
**I want** Data exports and Account deletions reached from the Compliance queue tabs, not as separate sidebar entries
**So that** I don't see two roads to the same surface

**Preconditions:** Logged in as Super-admin.
**Steps:**
1. Open sidebar → expand Compliance group.
2. Open `/admin/compliance`.

**Acceptance:**
- ✅ Compliance group has 3 items: Compliance queue, Change requests, Policy enforcement.
- ✅ Compliance queue page has 4 tabs: KYC due, Floor breaches, Data exports, Account deletions.

---

### A2. Cmd+K palette

#### S-A-5 · Cmd+K opens, pages searchable

**As** Super-admin
**I want** Cmd+K to open a palette that finds admin pages by fuzzy match
**So that** I can jump to any page without sidebar hunting

**Preconditions:** Logged in as Super-admin.
**Steps:**
1. From any admin page, press Cmd+K (or Ctrl+K on non-Mac).
2. Type "payo".
3. Press ↓ to highlight "Payouts pipeline".
4. Press Enter.

**Acceptance:**
- ✅ Palette overlay opens centered.
- ✅ Typing "payo" surfaces multiple page results including Payouts pipeline.
- ✅ ↑ / ↓ moves highlight; mouse hover updates highlight too.
- ✅ Enter navigates; URL becomes `/admin/payouts-pipeline`.
- ✅ Pressing Esc closes the palette.

#### S-A-6 · Cmd+K entity search

**As** Super-admin
**I want** to find specific retailers or stores by name from Cmd+K
**So that** I can jump straight into their detail page

**Preconditions:** Owner-retailer fixture is named "Aurora Boutique" (or similar).
**Steps:**
1. Open Cmd+K.
2. Type "auro".
3. Wait ~300ms for entity results.

**Acceptance:**
- ✅ Both "Pages" and "Entities" groups render; entities section lists retailers + stores matching.
- ✅ Clicking the retailer row navigates to `/admin/retailers/<id>`.
- ✅ Clicking the store row navigates to `/admin/retailers/<retailerId>/stores/<storeId>`.

#### S-AF-2 · Cmd+K debounce + abort

**As** Super-admin
**I want** the palette to not flicker as I type
**So that** the active highlight stays useful

**Preconditions:** Cmd+K palette open.
**Steps:**
1. Type "auro" character-by-character watching the result list.
2. Open DevTools Network. Type "aurora boutique" then immediately press Esc.

**Acceptance:**
- ✅ Result list updates after a single debounce window per typed char, not on every keystroke.
- ✅ Active highlight stays on the first result throughout typing (no flicker / reset).
- ✅ Network panel shows that in-flight entity requests are cancelled when Esc closes the palette.

#### S-AF-3 · Cmd+K admin permission gating

**As** Support-admin (lacks `applications.view`)
**I want** retailer search to silently skip
**So that** I don't see 403 noise in DevTools

**Preconditions:** Logged in as Support-admin sub-role.
**Steps:**
1. Open Cmd+K. Type "aurora". Watch DevTools Network.

**Acceptance:**
- ✅ Page results render (no permission needed).
- ✅ No request to `/admin/retailers?` fires.
- ✅ No 403 in network panel.
- ✅ Entity results section either omits Retailers or shows zero retailer rows.

---

### A3. Tables — sort, columns, bulk actions

Scope: items 2a, 2b, 2c.

#### S-A-7 · Retailers table sortable

**As** Super-admin
**I want** column-click sort on the Retailers table
**So that** I can find oldest pending applications without eyeballing

**Preconditions:** `/admin/retailers` shows ≥ 5 rows.
**Steps:**
1. Open `/admin/retailers`.
2. Click "Joined" column header.
3. Click again.
4. Click "Status" header.

**Acceptance:**
- ✅ Sort indicator chevron appears next to the sorted column.
- ✅ First Joined click sorts ascending; second click flips to descending.
- ✅ Status column sorts alphabetically.
- ✅ Th element has `aria-sort="ascending"` / `"descending"` / `"none"` matching state (verify via DevTools Elements).

#### S-A-8 · Retailers column picker persists

**As** Super-admin
**I want** to toggle low-value columns on the Retailers table and have the preference survive reload
**So that** my preferred view stays in place

**Preconditions:** Logged in as Super-admin.
**Steps:**
1. Open `/admin/retailers`. Note default columns visible: Retailer, Status, Joined, Actions. Role/Contact/GSTIN hidden by default.
2. Click "Columns" button → toggle Role on.
3. Refresh the page.

**Acceptance:**
- ✅ Role column appears after toggle.
- ✅ After refresh, Role column still visible (preference loaded from `localStorage["admin.retailers.cols"]`).
- ✅ Click "Reset to default" in column picker → returns to default 4 columns.

#### S-A-9 · Retailers status filter (5 options)

**As** Super-admin
**I want** simpler status filter options
**So that** I'm not confused by 8 intermediate states

**Preconditions:** Some retailers in `pending_approval`, `approved_no_store`, `onboarding`, `paused`, `suspended`.
**Steps:**
1. Open `/admin/retailers`.
2. Open the status filter dropdown.
3. Select "Pending".
4. Select "Suspended".

**Acceptance:**
- ✅ Dropdown shows exactly 5 options: All retailers, Pending, Active, Suspended, Terminated.
- ✅ "Pending" filter shows retailers whose backend status is any of `pending_approval`, `approved_no_store`, `onboarding`.
- ✅ "Suspended" includes both `suspended` and `paused`.
- ✅ Selecting a value updates URL `?status=`; reload preserves the filter.

#### S-A-10 · Retailers "View stores" chip

**As** Super-admin
**I want** to jump from a retailer row to their stores
**So that** I don't have to navigate Stores → filter manually

**Preconditions:** A retailer in the visible list has ≥ 1 store.
**Steps:**
1. On `/admin/retailers`, locate that row.
2. Click the `{n} stores` chip.

**Acceptance:**
- ✅ Chip shows accurate count (matches the number of stores owned by this retailer).
- ✅ Click navigates to `/admin/stores?retailerId=<id>`.
- ✅ Stores page renders a "Filtered to retailer: <name>" pill at top with a Clear link.
- ✅ Clicking Clear removes the filter (URL no longer has `retailerId`).

#### S-AF-4 · Stores queryKey partitioned

**As** developer-tester
**I want** the stores cache to partition by retailer filter
**So that** unrelated views don't poison each other

**Preconditions:** React Query Devtools available (optional).
**Steps:**
1. Open `/admin/stores`. Open Devtools query cache.
2. Open `/admin/stores?retailerId=X`. Reload the cache view.

**Acceptance:**
- ✅ Two separate cache entries appear, one with `null` for retailerId, one with the actual id.

#### S-A-11 · Listings table sortable + bulk retire

**As** Super-admin
**I want** to sort listings by name/status/rating AND bulk-retire a selection
**So that** I can clean up multiple listings without 10 modal dialogs

**Preconditions:** `/admin/listings` shows ≥ 5 active listings.
**Steps:**
1. Open `/admin/listings`.
2. Click "Listing" header → sort ascending.
3. Tick checkboxes on 3 active listings.
4. Bulk Action Bar appears at bottom-center. Click "Retire selected".
5. Confirm the prompt.

**Acceptance:**
- ✅ Sort indicator appears, rows reorder.
- ✅ Checkbox column visible; only retirable rows (status active/draft) have checkbox enabled.
- ✅ Bulk Action Bar shows "3 selected" with Retire button.
- ✅ After confirm, status of all 3 changes to "retired".
- ✅ Toast shows success summary.

#### S-A-12 · Applications bulk approve

**As** Super-admin
**I want** to approve multiple pending applications at once
**So that** onboarding waves don't require dozens of clicks

**Preconditions:** ≥ 3 pending applications in `/admin/applications`.
**Steps:**
1. Open `/admin/applications`.
2. Tick checkboxes on 3 pending applications.
3. Click "Approve selected" in the Bulk Action Bar.

**Acceptance:**
- ✅ All 3 applications transition to approved.
- ✅ Toast shows "3 approved." (no failures).

#### S-A-13 · Payouts retry-all-failed

**As** Super-admin
**I want** one button to retry every failed payout in view
**So that** I don't click Retry 10 times after a bank outage

**Preconditions:** Failed queue has ≥ 2 failed payouts.
**Steps:**
1. Open `/admin/payouts-pipeline`, Failed tab.
2. Click "Retry all failed".
3. Confirm prompt.

**Acceptance:**
- ✅ Confirm dialog quotes the count: "Retry all N failed payouts?".
- ✅ After confirm, each payout retries (status transitions visible after invalidate).
- ✅ Toast summarises outcome (count succeeded / count failed).

#### S-AF-5 · Bulk action partial-failure toast

**As** Super-admin
**I want** to see exactly which items failed when a bulk action partially fails
**So that** I can manually retry them

**Preconditions:** Inject a backend stub that 500s on one specific item id (e.g. via temporary backend tweak), OR pick an action you can break (e.g. bulk retire on a listing whose status already changed).
**Steps:**
1. Trigger bulk action (e.g. bulk approve 3 apps, one of which is already rejected).
2. Observe the toast.

**Acceptance:**
- ✅ Toast variant is "warning" (orange / yellow).
- ✅ Title shows "M of N approved, K failed".
- ✅ Description lists up to 5 failed item names (e.g. legal name for applications, store + period for payouts) with the error message.
- ✅ Duration ≥ 8s so the operator can read it.

---

### A4. Compliance queue

Scope: 4a, 4b.

#### S-A-14 · Compliance tab badges

**As** Super-admin
**I want** count badges on each compliance tab
**So that** I can triage without clicking through each tab

**Preconditions:** Fixture has at least 1 KYC due, 1 floor breach, 1 data export pending, 1 deletion pending.
**Steps:**
1. Open `/admin/compliance`.

**Acceptance:**
- ✅ Each `TabsTrigger` shows a small count badge next to its label when count > 0.
- ✅ Tabs with count 0 show no badge.

#### S-A-15 · KYC sorted by urgency

**As** Super-admin
**I want** overdue KYC at the top
**So that** I work the most urgent items first

**Preconditions:** ≥ 2 KYC cycles, one overdue, one due in 7 days.
**Steps:**
1. Open `/admin/compliance` → KYC tab.

**Acceptance:**
- ✅ Overdue cycle appears above due-soon cycle.
- ✅ Overdue badge is `danger` tone, due-in-3-days badge is `warning`, ≥7 days is `neutral`.

#### S-AF-6 · Compliance staleTime suppresses tab thrash

**As** developer-tester
**I want** repeated tab clicks not to trigger refetches
**So that** the backend isn't hammered

**Preconditions:** DevTools Network panel open.
**Steps:**
1. Open `/admin/compliance`.
2. Click between KYC / Floor / Exports / Deletions tabs five times.

**Acceptance:**
- ✅ The four endpoint calls fire on initial mount.
- ✅ Subsequent tab clicks fire NO additional network requests (within the staleTime window of 60s).

---

### A5. Store detail

Scope: 5a, 5b, 11a.

#### S-A-16 · Store-detail 4 tabs + URL state

**As** Super-admin
**I want** the store detail split into 4 tabs and the active tab stuck to the URL
**So that** sharing a link lands on the right tab

**Preconditions:** Have a store id.
**Steps:**
1. Open `/admin/retailers/<r>/stores/<s>`. Default tab = Overview.
2. Click "Compliance" tab. Note URL becomes `?tab=compliance`.
3. Reload.

**Acceptance:**
- ✅ Tabs: Overview / Compliance / Accounts / Operations.
- ✅ URL `?tab=compliance` after click; reload lands on Compliance tab.
- ✅ Default (Overview) omits `?tab=` from URL.
- ✅ Action ribbon (Pause / split-button) stays pinned above tabs regardless of selected tab.

#### S-A-17 · Lifecycle split-button

**As** Super-admin
**I want** the most likely lifecycle action as the primary button, with secondary actions hidden behind "More"
**So that** I don't fat-finger Terminate when I meant Pause

**Preconditions:** Store status is `active`.
**Steps:**
1. Open `/admin/retailers/<r>/stores/<s>`.
2. Inspect the action ribbon.

**Acceptance:**
- ✅ Primary button: "Pause" (variant=ink, prominent).
- ✅ "More" dropdown holds Suspend and Terminate.
- ✅ Each item retains its destructive tone inside the dropdown (Suspend warning, Terminate danger).
- ✅ When store status is `paused`, primary becomes "Resume".

#### S-A-18 · Cross-link to retailer

**As** Super-admin
**I want** a chip to jump from store detail back to the parent retailer
**So that** I can pivot without sidebar Nav

**Preconditions:** Store detail page loaded.
**Steps:**
1. Look below the page header for a back-button. Click it.

**Acceptance:**
- ✅ "Back to retailer" button visible in actions; clicking it goes to `/admin/retailers/<r>`.

---

### A6. Dashboard

Scope: 9a.

#### S-A-19 · Dashboard hero KPIs

**As** Super-admin
**I want** actionable KPIs (pending apps, failed payouts, overdue KYC) prominent
**So that** at-a-glance I see what needs action today

**Preconditions:** Fixture has pending apps + failed payouts + overdue KYC ≥ 1 each.
**Steps:**
1. Open `/admin/dashboard`.

**Acceptance:**
- ✅ Top strip = 3 dark featured cards: Pending applications, Failed payouts, Overdue KYC. Each card has a CTA label (Review / Retry).
- ✅ Failed payouts + Overdue KYC use a warning-tone gradient (distinct from default ink).
- ✅ Clicking each card navigates to the relevant filtered list page.
- ✅ Below hero strip: a secondary informational strip with Active retailers / Active storefronts / Onboarding stores.

---

### A7. Promotions

Scope: 6a, 7a.

#### S-A-20 · Promotion tabs reduced to 4

**As** Super-admin
**I want** unified promotion list with mechanism chip filter
**So that** I don't have 3 nearly-identical tabs

**Preconditions:** Mixed offers / coupons / vouchers exist.
**Steps:**
1. Open `/admin/promotions`.

**Acceptance:**
- ✅ Tabs: All promotions / Targeted drops / Performance / Anomalies.
- ✅ "All promotions" tab shows Mechanism chip row: All, Offer, Coupon, Voucher.
- ✅ Selecting "Coupon" chip filters list client-side to coupons only.

#### S-A-21 · StoreCombobox in policy enforcement dialog

**As** Super-admin
**I want** a searchable store picker in the new-enforcement dialog
**So that** I don't scroll through 200 stores

**Preconditions:** ≥ 50 stores in the database.
**Steps:**
1. Open `/admin/policy-enforcement` → New enforcement action.
2. Click the Store field. Type a partial store name.

**Acceptance:**
- ✅ Popover combobox opens with text input + filtered list.
- ✅ Typing narrows the list. Selection updates the trigger.

#### S-A-22 · StoreCombobox extras in promotions filter

**As** Super-admin
**I want** the "All retailers" / "Platform-wide only" virtual options to coexist with the searchable store list
**So that** I can filter by either without losing the special options

**Preconditions:** `/admin/promotions` page loaded.
**Steps:**
1. Open the store filter combobox at the right of the filter row.
2. Type "platform".
3. Clear the search.

**Acceptance:**
- ✅ Without query: extras "All retailers" and "Platform-wide only" listed above a separator, then real stores.
- ✅ Typing "platform" still surfaces "Platform-wide only".
- ✅ Selecting "Platform-wide only" sets `?storeId=__platform__` filter; selected extra remains visible as the trigger label.

#### S-A-23 · StoreCombobox in promotion-new

**As** Super-admin
**I want** the create-promotion flow to use the same searchable store picker
**So that** the experience is consistent

**Preconditions:** Permission to create promotions.
**Steps:**
1. Open `/admin/promotions/new`.
2. Use the Store combobox; pick "Platform-wide (no store)".

**Acceptance:**
- ✅ Combobox opens; extra "Platform-wide (no store)" present.
- ✅ Selecting it sets storeId='' in form state (verify by submitting and checking the request body in DevTools).

---

### A8. Payouts

Scope: 11a, 12a.

#### S-A-24 · Payout detail cross-links

**As** Super-admin
**I want** quick chips to jump to the payout's store and retailer
**So that** I can verify context without searching

**Preconditions:** Open a payout detail.
**Steps:**
1. Open `/admin/payouts/<id>`.

**Acceptance:**
- ✅ Below status badges, two pill chips appear: "Open store" and "Open retailer".
- ✅ Clicking each goes to the correct destination.
- ✅ On slow networks, chips show a single skeleton placeholder while the stores query resolves (verify by throttling network).

#### S-A-25 · Payout waterfall — happy path

**As** Super-admin
**I want** to see the payout math visually
**So that** I understand why net differs from gross

**Preconditions:** Payout with gross > 0, commission > 0, refunds > 0, adjustments != 0.
**Steps:**
1. Open the payout detail.

**Acceptance:**
- ✅ Waterfall chart renders Gross → Commission → GST on commission → Refunds held → Adjustments → Net.
- ✅ Bar widths proportional to absolute amounts.
- ✅ Deductions render in `bg-danger`, additions in `bg-info`, Gross in `bg-ink`, Net in `bg-success`.
- ✅ Sign prefix in value column: `−` for deductions, `+` for additions.
- ✅ Container has `role="img"` and a one-line aria-label summarising start→net (verify in DevTools).

#### S-AF-7 · Waterfall negative net

**As** Super-admin
**I want** a negative net payout (overpayment) visually flagged
**So that** I don't miss a problem cycle

**Preconditions:** A payout where deductions > gross + adjustments → net is negative.
**Steps:**
1. Open that payout detail.

**Acceptance:**
- ✅ Net bar renders in `bg-warning` tone (not success).
- ✅ Value column prefixes with `−`.

---

### A9. Issue detail

Scope: 8a.

#### S-A-26 · Inline panels for Decide / Assign / Change kind / Request evidence

**As** Support-admin (with disputes permission)
**I want** action forms to appear inline below the buttons
**So that** I don't bounce between modals

**Preconditions:** Open an issue detail (`/admin/issues/<id>`).
**Steps:**
1. Click "Decide".

**Acceptance:**
- ✅ Inline panel opens below the actions row (not as a centered modal).
- ✅ Panel container has `role="region"` and `aria-label="Decide dispute"`.
- ✅ Button variant flips to "ink" while panel is open.
- ✅ Click "Decide" again → panel closes.

#### S-AF-8 · Issue panel state resets

**As** Support-admin
**I want** stale form text in one panel not to leak into the next
**So that** I don't accidentally submit yesterday's notes

**Preconditions:** Issue detail open.
**Steps:**
1. Click Decide, type 20 chars in the note field.
2. Click Decide again to close. Click Assign, type a random admin ID.
3. Cancel Assign. Click Decide again.

**Acceptance:**
- ✅ Decide note field is empty when re-opened.
- ✅ Same check for Change kind and Request evidence.

#### S-A-27 · Flag party still modal

**As** Support-admin
**I want** Flag party (destructive) to require a modal confirmation
**So that** I can't accidentally flag

**Steps:**
1. Click "Flag party".

**Acceptance:**
- ✅ Centered modal opens (not inline panel).
- ✅ Cancel + Flag buttons in footer.

---

## Retailer stories

### R1. Sidebar / navigation

Scope: 1a, 1b, 1c, 7a.

#### S-R-1 · Sidebar shape ≤ 18 items

**As** Owner-retailer
**I want** a deduped sidebar
**So that** I can find pages without scrolling

**Preconditions:** Logged in as Owner-retailer with active store.
**Steps:**
1. Open `/retailer/dashboard`. Count sidebar items per group.

**Acceptance:**
- ✅ "Workspace tools" group absent.
- ✅ "Settings" group present, containing Staff / KYC / Change requests / Notifications / Holiday calendar / Pickup slots.
- ✅ Reports group contains exactly one item: "Reports" → `/retailer/reports`.
- ✅ Finance group contains exactly 3 items: Fees / Invoices / Payouts.
- ✅ No "(legacy)" entries anywhere.
- ✅ Total visible sidebar items ≤ 20.

#### S-R-2 · Legacy reports redirect

**As** Owner-retailer
**I want** old bookmarks like `/retailer/reports/sales` to land on the new report after a brief notice
**So that** my muscle memory isn't broken

**Preconditions:** Logged in.
**Steps:**
1. Open `/retailer/reports/sales` directly via URL bar.
2. Wait 5 seconds (or click the CTA immediately).

**Acceptance:**
- ✅ Page shows "This report has been replaced." notice with countdown ("Redirecting in 5…").
- ✅ Explicit CTA "Open Sales detail now" navigates immediately.
- ✅ Auto-redirect after 5s lands on `/retailer/reports/sales-detailed`.
- ✅ Same pattern verified for the other 3 legacy reports (performance, returns, inventory-health).

#### S-R-3 · Reports hub

**As** Owner-retailer
**I want** all reports as cards in one hub
**So that** I can pick by name + description

**Steps:**
1. Click sidebar "Reports".

**Acceptance:**
- ✅ URL is `/retailer/reports`.
- ✅ 9 report cards grouped under Sales / Catalog / Operations.
- ✅ Each card links to corresponding standalone report.

#### S-RF-1 · Retailer reports hub permission gate

**As** Floor-staff (lacks `reports.view`)
**I want** a "no access" empty state, not blank cards
**So that** I understand the state

**Preconditions:** Login as Floor-staff sub-role.
**Steps:**
1. Open `/retailer/reports`.

**Acceptance:**
- ✅ "No access" Empty block renders.
- ✅ Sidebar Reports entry hidden (filterSidebarGroups handles this), so the only way to reach the page is direct URL.

#### S-R-4 · Invoices hub URL-bound

**As** Owner-retailer
**I want** tax / commission / statements in one tabbed page
**So that** I don't have 3 sidebar entries

**Steps:**
1. Click sidebar "Invoices" → `/retailer/invoices`. Default tab = Tax invoices.
2. Click "Commission" tab → URL becomes `?tab=commission`.
3. Reload.

**Acceptance:**
- ✅ 3 tabs: Tax invoices / Commission / Billing statements.
- ✅ Default tab omits `?tab=` from URL.
- ✅ Reload lands on Commission tab.
- ✅ Standalone routes still work (open `/retailer/tax-invoices` directly → renders).

#### S-R-5 · Payouts hub URL-bound

**As** Owner-retailer
**I want** payouts history + upcoming + early disbursement in one page
**Steps:**
1. Open `/retailer/payouts`. Default tab = History.
2. Click "Upcoming". URL becomes `?tab=upcoming`. Reload.
3. Click "Early disbursement". URL becomes `?tab=early`.

**Acceptance:**
- ✅ 3 tabs render with the right content per tab.
- ✅ Standalone routes `/retailer/payouts/upcoming` and `/retailer/early-disbursement` still resolve.

---

### R2. Cmd+K palette (retailer scope)

Scope: 3a.

#### S-R-6 · Cmd+K finds products + orders + staff

**As** Owner-retailer
**I want** search across products, orders, and staff
**So that** I can jump to any entity I care about

**Preconditions:** Fixture has a product named "Cotton kurta", an order id starting with a known prefix, a staff member.
**Steps:**
1. Open Cmd+K.
2. Type "cotton". Note product results.
3. Clear; type the order-id prefix.
4. Clear; type the staff name.

**Acceptance:**
- ✅ Each typed query shows results in the correct group label (Products / Orders / Staff).
- ✅ Clicking each result navigates correctly (`/retailer/listings/<id>`, `/retailer/orders/<id>`, `/retailer/staff/<id>`).

#### S-RF-2 · Cmd+K retailer permission gating

**As** Manager-retailer (lacks `orders.view`)
**I want** order queries not to fire
**So that** the network panel stays clean

**Preconditions:** Login as Manager-retailer sub-role.
**Steps:**
1. Open Cmd+K. Type "ord". Watch Network panel.

**Acceptance:**
- ✅ No request to `/retailer/orders?` fires.
- ✅ Orders results group is absent.
- ✅ Products + Staff results still render if those permissions are present.

---

### R3. Listing detail

Scope: 2b, 4a, plus URL-bind.

#### S-R-7 · Cross-link chips

**As** Owner-retailer
**I want** chips below the listing header to jump to inventory / pricing / recent orders for this product
**So that** I don't have to navigate then re-filter

**Preconditions:** Open a listing detail page.
**Steps:**
1. Look below the publish panel for chip strip.

**Acceptance:**
- ✅ 3 chips: "Inventory for this product", "Edit pricing", "Orders with this product".
- ✅ Each navigates to the relevant page with appropriate query params.

#### S-R-8 · Tab reorder + More dropdown

**As** Owner-retailer
**I want** less-used tabs (AI generations, Audit log) tucked into a "More" dropdown
**So that** the primary tabs are uncluttered

**Steps:**
1. Open a listing detail.

**Acceptance:**
- ✅ Visible tabs in order: Overview / Variants & inventory / Details / Promotions / More.
- ✅ "More" trigger has chevron-down icon.
- ✅ Clicking "More" reveals AI generations and Audit log.
- ✅ Selecting one of those shows that tab's content; the "More" trigger label updates to show which one is active.

#### S-RF-3 · Listing tab URL-bound

**As** Owner-retailer
**I want** the active tab in the URL
**So that** refresh and share-links work

**Steps:**
1. Open a listing.
2. Click "Variants & inventory" tab. URL becomes `?tab=variants`.
3. Reload.

**Acceptance:**
- ✅ Reload lands on Variants & inventory.
- ✅ Default Overview omits `?tab=` from URL.
- ✅ Selecting AI from More → URL is `?tab=ai`; refresh keeps it.

---

### R4. Orders

Scope: 4b, 8a, plus URL-bind.

#### S-R-9 · 3 group tabs + chip strip

**As** Owner-retailer
**I want** orders grouped into Active / In transit / Completed with chip drill-downs
**So that** the mobile-overflowing 8-tab strip is gone

**Preconditions:** Orders fixture has multiple statuses.
**Steps:**
1. Open `/retailer/orders`.

**Acceptance:**
- ✅ Top tabs: Active / In transit / Completed.
- ✅ Each group tab has a count badge that sums the inner statuses.
- ✅ Below the group tabs, a chip strip: "All" + each exact-status chip within the group.
- ✅ Active default chip = Pending; chips for the other groups default to first status.
- ✅ Clicking "All" merges all exact statuses in the group.

#### S-RF-4 · Orders URL-bound + legacy ?tab= migration

**As** developer-tester
**I want** legacy `?tab=delivered_today` deep links to upgrade in place
**So that** old bookmarks still work

**Steps:**
1. Open `/retailer/orders?tab=delivered_today`. (Legacy URL.)
2. Wait for state to settle.

**Acceptance:**
- ✅ Lands on Completed group tab with "Delivered today" chip active.
- ✅ URL normalises to `?group=completed&chip=delivered_today` (legacy `tab=` removed).
- ✅ Default state (Active group + Pending chip) omits both params.

#### S-R-10 · Order detail Prev/Next

**As** Owner-retailer
**I want** Prev / Next arrows on the order detail
**So that** I can process a batch of pending orders sequentially

**Preconditions:** Open `/retailer/orders` (warms cache). Click into the 3rd order.
**Steps:**
1. On the order detail header row, click → (Next).
2. Click ← (Prev).

**Acceptance:**
- ✅ Buttons are enabled (cache is warm).
- ✅ Next moves to the 4th order's detail.
- ✅ Prev moves back to the 3rd.
- ✅ When on the first order in the list, Prev is disabled with a tooltip "Open this order from the list view to use prev / next." (or contextually disabled at list bounds).

#### S-RF-5 · Order Prev/Next is reactive

**As** developer-tester
**I want** Prev/Next ids to stay correct when the list cache refreshes
**So that** I don't navigate to a deleted order

**Preconditions:** Two browser tabs both signed in as the same retailer.
**Steps:**
1. In tab A: open an order detail. Note current prev/next ids.
2. In tab B: open `/retailer/orders` (this writes to the shared cache via polling).
3. Switch back to tab A. Wait 5 seconds (the list query in tab A's cache subscription should reflect the latest fetch from tab B since React Query's broadcastQueryClient isn't in use; verify behaviour matches the implementation: detail subscribes to cache via observe-only useQuery).

**Acceptance:**
- ✅ If tab B's polling adds a new order at position 0, tab A's prev/next adjusts accordingly.
- ✅ If a deep-linked order is no longer in the list (status changed → out of bucket), prev/next render disabled (cold-cache fallback).

#### S-R-11 · Orders empty state CTA

**As** Owner-retailer (new store, no orders yet)
**I want** a useful empty state pointing me at the share-link
**So that** I know what to do next

**Preconditions:** Active store with zero orders.
**Steps:**
1. Open `/retailer/orders`, Active group.

**Acceptance:**
- ✅ Empty block shows: kicker "All clear", title "No orders need your action right now.", description mentioning share-link strategy, action button → `/retailer/store`.

---

### R5. Dashboard

Scope: 4c, 5a.

#### S-R-12 · Low-stock rows clickable

**As** Owner-retailer
**I want** to click any low-stock row to land on the filtered inventory for that product
**So that** I can fix stock without re-finding the product

**Preconditions:** ≥ 1 variant with stock ≤ 3 on an active listing.
**Steps:**
1. Open `/retailer/dashboard`.
2. Locate Low stock card. Click any row.

**Acceptance:**
- ✅ Row hover shows pointer cursor and bg change.
- ✅ Click navigates to `/retailer/inventory?productId=<listingId>`.

#### S-R-13 · Getting Started checklist on fresh store

**As** Owner-retailer of a newly active store
**I want** a checklist of setup steps for the first 7 days
**So that** I don't see empty analytics with no guidance

**Preconditions:** A retailer whose `localStorage` for this store doesn't yet have `retailer.gettingStarted.firstSeenActive.<storeId>`. Active store. Some checklist signals NOT yet met (e.g. < 5 active listings).
**Steps:**
1. Open `/retailer/dashboard` for the first time.

**Acceptance:**
- ✅ Checklist card rendered above analytics.
- ✅ 5 items: Add first 5 products / Upload store photos / Set store hours / Configure pickup slots / Share store link.
- ✅ Each item shows a Start (auto-derived) or Open + Mark-done (manual) action.
- ✅ Items with derivable completion (products ≥ 5 active; photos uploaded) show checkmark immediately if true.
- ✅ Header shows "N of 5 done · X days left" where X starts at 7.

#### S-R-14 · Checklist dismiss + complete-all hides

**As** Owner-retailer
**I want** the checklist gone when I dismiss or finish it
**So that** the dashboard doesn't keep nagging

**Preconditions:** Checklist visible.
**Steps:**
1. Click the × in the checklist header.
2. Reload.
3. Wipe the dismiss flag: `localStorage.removeItem("retailer.gettingStarted.dismissed.<storeId>")` in DevTools. Reload again. Mark all 5 steps as done.

**Acceptance:**
- ✅ After ×: card disappears.
- ✅ Reload keeps card hidden (persisted dismiss flag).
- ✅ After undismissing in DevTools and reloading, card reappears.
- ✅ After all 5 done, card disappears (regardless of dismiss flag).

#### S-RF-6 · Checklist multi-tab sync

**As** Owner-retailer
**I want** dismissing or completing in one tab to reflect in another tab without reload
**So that** my state doesn't desync

**Preconditions:** Two browser tabs on `/retailer/dashboard` for the same store.
**Steps:**
1. In tab A, click "Mark done" on "Set store hours".
2. Switch to tab B without reloading.

**Acceptance:**
- ✅ Tab B's checklist updates within ~1s — the hours step shows the strikethrough + checkmark.
- ✅ Same behaviour when dismissing in tab A.

#### S-RF-7 · Checklist no-storage degrades cleanly

**As** developer-tester
**I want** localStorage quota / private-mode failures not to crash the UI
**So that** the dashboard still works

**Preconditions:** Block localStorage in DevTools (or use a quota-exceeded simulation; otherwise inspect code path).
**Steps:**
1. Open `/retailer/dashboard`.

**Acceptance:**
- ✅ Dashboard renders normally.
- ✅ Checklist either hides (no first-seen timestamp can be written) or renders without throwing.
- ✅ No uncaught errors in console.

---

### R6. Inventory

Scope: related to 4c.

#### S-R-15 · ProductId filter chip

**As** Owner-retailer
**I want** a visible filter pill when inventory is scoped to a single product
**So that** I know why the list is short

**Preconditions:** Navigate to `/retailer/inventory?productId=<id>`.
**Steps:**
1. Open the URL.

**Acceptance:**
- ✅ Pill at top: "Filtered to product: <name>" with a Clear link.
- ✅ Clicking Clear strips the param; full inventory returns.

#### S-RF-8 · Pagination hidden under productId filter

**As** Owner-retailer
**I want** no misleading pagination control when filtered to one product
**So that** I'm not confused by `Page 1 of 1` while the result count is 3

**Steps:**
1. Open `/retailer/inventory?productId=<id>&page=4`.

**Acceptance:**
- ✅ Pagination control absent.
- ✅ URL's stale `page=4` is dropped on mount (verify URL after redirect: `productId=<id>` only).
- ✅ Total count text matches the filtered row count (not the full-catalog count).

---

### R7. Store profile

Scope: 2a.

#### S-R-16 · Tabs → sections + anchor strip

**As** Owner-retailer
**I want** the 7-tab store profile flattened to scrollable sections with a sticky anchor strip
**So that** I can edit everything in one pass without tab-hopping

**Steps:**
1. Open `/retailer/store`.

**Acceptance:**
- ✅ No tabs strip; instead a sticky horizontal anchor nav at the top with 7 chips: Basics / Photos / Hours / Address / Legal & Bank / Documents / Status.
- ✅ Clicking a chip smooth-scrolls to that section.
- ✅ The active chip highlights as that section enters view (IntersectionObserver behaviour).

#### S-R-17 · Legacy `?tab=` deep link scrolls

**As** developer-tester
**I want** old links like `/retailer/store?tab=photos` to scroll the Photos section into view
**So that** no existing bookmark breaks

**Steps:**
1. Open `/retailer/store?tab=photos`.

**Acceptance:**
- ✅ On mount, page auto-scrolls to the Photos section.
- ✅ Photos chip is active.

#### S-RF-9 · Anchor active stays correct after resize

**As** developer-tester
**I want** the highlight to follow the viewport even when the sticky nav grows taller on a narrow window
**So that** mobile widths work

**Steps:**
1. Open `/retailer/store` at desktop width.
2. Scroll to "Hours" section. Verify Hours chip active.
3. Resize window narrower so the anchor strip wraps to two lines.
4. Without scrolling, observe the active chip. Then scroll up to Basics.

**Acceptance:**
- ✅ After resize, the active chip still reflects the visible section (IntersectionObserver's rootMargin re-computed against measured nav height).
- ✅ Scrolling back to Basics flips highlight to Basics.

---

### R8. Promotions

Scope: 2c.

#### S-R-18 · 3 tabs + Mechanism chip

**As** Owner-retailer
**I want** unified promotions list with mechanism chip + 2 analytics tabs
**So that** I see all my promos in one place

**Steps:**
1. Open `/retailer/promotions`.

**Acceptance:**
- ✅ Tabs: All promotions / Performance / Platform impact.
- ✅ "All promotions" tab shows Mechanism chip row: All / Offers / Coupons / Vouchers, each with a count badge.
- ✅ Selecting "Coupons" filters list client-side.
- ✅ Page header has a "Variant pricing" link replacing the old "Variant prices" tab.

#### S-R-19 · Promotions empty state CTAs

**As** Owner-retailer (no promotions yet)
**I want** the empty state to point at the create flow per selected mechanism
**Steps:**
1. Filter chip = Offers; no offers exist.
2. Filter chip = All; no promotions exist.

**Acceptance:**
- ✅ Offers chip empty: "No offers yet" + CTA "New offer" → `/retailer/promotions/new?mechanism=offer`.
- ✅ All chip empty: "No promotions yet" + CTA "New offer" → `/retailer/promotions/new`.

---

### R9. Empty states (rest)

Scope: 6a.

#### S-R-20 · Listings empty has Add product + AI catalog link

**Preconditions:** New retailer with zero products.
**Steps:**
1. Open `/retailer/listings`.

**Acceptance:**
- ✅ Empty block: title "No products yet.", description "Add your first product to begin selling."
- ✅ Primary CTA "Add first product" opens the wizard.
- ✅ Secondary link "…or generate a batch with AI catalog" → `/retailer/ai-catalog`.

#### S-R-21 · Returns empty stays reassuring

**Steps:**
1. Open `/retailer/returns` with zero returns.

**Acceptance:**
- ✅ Empty shows reassuring tone — no urgency, no CTA pressure.

---

## Coverage matrix

Spot-check that every numbered item from both source docs has at least one story. Re-run only if the source docs change.

### Admin coverage

| Source item | Stories |
|---|---|
| 1a Money group | S-A-1, S-A-2, S-AF-1 |
| 1b Reports hub | S-A-1, S-A-3, S-AF-1 |
| 1c Compliance dedup | S-A-4 |
| 2a Sort | S-A-7, S-A-11 |
| 2b Hide cols | S-A-8 |
| 2c Bulk | S-A-11, S-A-12, S-A-13, S-AF-5 |
| 3a Cmd+K | S-A-5, S-A-6, S-AF-2, S-AF-3 |
| 4a Tab badges | S-A-14, S-AF-6 |
| 4b KYC sort | S-A-15 |
| 5a Store tabs | S-A-16 |
| 5b Split-button | S-A-17 |
| 6a StoreCombobox | S-A-21, S-A-22, S-A-23 |
| 7a Promo tabs | S-A-20 |
| 8a Issue panels | S-A-26, S-A-27, S-AF-8 |
| 9a Dashboard | S-A-19 |
| 10a Status filter | S-A-9 |
| 11a Cross-links | S-A-18, S-A-24 |
| 11b View-stores chip | S-A-10, S-AF-4 |
| 12a Waterfall | S-A-25, S-AF-7 |

### Retailer coverage

| Source item | Stories |
|---|---|
| 1a Reports hub | S-R-1, S-R-3, S-RF-1 |
| 1b Finance merge | S-R-1, S-R-4, S-R-5 |
| 1c Workspace → Settings | S-R-1 |
| 2a Store sections | S-R-16, S-R-17, S-RF-9 |
| 2b Listing tabs | S-R-8, S-RF-3 |
| 2c Promotion merge | S-R-18, S-R-19 |
| 3a Cmd+K | S-R-6, S-RF-2 |
| 4a Listing cross-links | S-R-7 |
| 4b Order prev/next | S-R-10, S-RF-5 |
| 4c Low-stock links | S-R-12, S-R-15, S-RF-8 |
| 5a Checklist | S-R-13, S-R-14, S-RF-6, S-RF-7 |
| 6a Empty states | S-R-11, S-R-19, S-R-20, S-R-21 |
| 7a Legacy redirects | S-R-2 |
| 8a Orders tabs | S-R-9, S-RF-4 |

---

## Notes for testers

- When a story says "verify in DevTools", use the Elements panel for ARIA attributes, the Network panel for request gating, and the Application > Local Storage panel for persistence.
- For the multi-tab stories (S-RF-5, S-RF-6), make sure both tabs are on the same origin so `storage` events fire.
- For S-RF-7, the easiest way to simulate localStorage failure is DevTools → Application → Storage → uncheck "Local Storage" or use private/incognito with cookies disabled.
- For S-AF-5 (bulk failure toast), the fastest way to provoke a partial failure is to manually toggle one row's state via DB while the bulk request is in flight, or stub backend for one specific id.
- Reset state between stories that mutate persistence: delete the relevant `retailer.*` keys from localStorage before re-running checklist / column-picker stories.
