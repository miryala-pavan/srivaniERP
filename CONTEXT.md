# Srivani Stores ERP — Project Context

## Business
- **Name:** Srivani Kirana & General Stores
- **Location:** New Bus Stand Area, Sangareddy, Telangana — single branch
- **Founded:** 1983 by Mr. M. Pandurangam
- **GSTIN:** 36AESPM7617R1ZE (state 36 = Telangana → CGST+SGST on all bills)
- **Phone/WhatsApp:** 9382828484
- **Email:** srivanistore.srd@gmail.com
- **Admin login:** admin / Admin@2026

## Tech Stack & Ports (ONLY use ports 4000–4999)
| Service | Port | Path |
|---------|------|------|
| ERP Frontend (Next.js 14) | 4000 | J:\SVN\SVN_26\frontend |
| Backend API (NestJS) | 4001 | J:\SVN\SVN_26\backend |
| Storefront (Next.js 14) | 4002 | J:\SVN\SVN_26\storefront |
| PostgreSQL (Docker) | 4432 | — |
| Redis (Docker) | 4379 | — |

**Startup:** Double-click start-srivani-erp.bat on desktop.
**DB:** Prisma ORM, `prisma db push` (no migrations folder).
JWT key: `userId`. Auth token in localStorage: `srivani_token`.

## Taxonomy (3 levels, self-referential Category table)
- 18 Departments → 150 Categories → 516 Subcategories = 666 rows total
- 18 Departments: FOOD, PERSONAL, HOMECARE, HEALTH, BABY, FRVEG, MEAT,
  STATIONERY, ELECTRICAL, TOBACCO, LIQUOR, SEASONAL, APPAREL,
  KITCHEN, GENERAL, SUPPLIES, PETCARE, TELECOM

## Catalog
- 3,776 products imported, ALL CAPS names
- 462 product icons at storage/product-images/products/icons/{code}.png
- 558 products in GENERAL_07_GEN Miscellaneous (need manual category later)
- All stockOnHand = 0 (opening stock via GRN pending)
- HSN codes all "0000" (update per category later)
- GST rates set per category:
  0% → fresh produce, salt
  5% → staples, dal, spices, tea, pooja items, agarbathi
  12% → ghee, butter, dry fruits, condiments, juices
  18% → FMCG, personal care, snacks, biscuits, noodles, detergent
  28% → tobacco, soft drinks, energy drinks

## Hardware
- Thermal printer: TVS RP3200 Star (80mm, 48 chars/line, ESC/POS)
- Label printer: TVS LP 45 Lite

## ERP Features — COMPLETED
- Product management: 3-state (Active / Out of Stock / Disabled)
- Inline tax rate editing, card + compact views, sub-category filter, column sort
- POS: 3 bill types:
    Tax Invoice  → GST/2026-27/XXXX
    Retail Invoice → INV/2026-27/XXXX
    Estimate → EST/2026-27/XXXX
- B2B auto-detection when 15-char GSTIN entered by cashier
- GST-compliant thermal receipt: grouped by rate, tax summary, savings line
- A4 invoice with amount in words
- Duplicate bill printing with DUPLICATE COPY watermark + audit log
- Notification bell with OOS alerts
- Day closure page
- Estimates list page
- Bills search (4 modes)
- Hold bill system (HOLD-00001 series, Ctrl+H hold, Ctrl+B popup)
- POS shortcuts settings with live key capture
- PWA manifest for standalone install
- Cart auto-save with crash recovery
- 6-digit product codes (000001 format)
- Roles: SUPER_ADMIN, BRANCH_MANAGER, CASHIER, PURCHASE_CHECKER,
  ACCOUNTS_PERSON, FLOOR_SUPERVISOR, PACKING_STAFF, SALES_REP, VIEWER
- Cost price visible only to: SUPER_ADMIN, PURCHASE_CHECKER

## Storefront Features — COMPLETED
- Homepage: logo, categories grid, featured products
- /products: all-products browse with dept filter + sort
- /category/[code]: category/subcategory product listing
- /search: search results page with autocomplete dropdown
- /product/[code]: product detail page
- ProductCard shows: product code (#000123), pack size badge,
  MRP strikethrough + SP + savings %, Out of Stock overlay
- WhatsApp list builder: [+List] button on cards, floating FAB with
  item count badge, slide-up panel with qty controls + estimated total,
  sends full order list via wa.me/919382828484
- Department mega-menu in header (3-level tree)
- Breadcrumbs on all pages
- Mobile bottom nav (Home, Categories, Search, WhatsApp)
- Sticky header
- About, Contact, Terms, Privacy, Refund, Shipping pages

## Critical Rules — NEVER BREAK
1. Immutable billing: price/tax changes NEVER alter historical bills
2. ALL CAPS product names in DB and display
3. Port policy: ONLY ports 4000–4999
4. B2B detection: 15-char GSTIN → auto switch to Tax Invoice
5. Single business + branch (no multi-branch logic yet)
6. Telangana state 36 → always CGST+SGST (never IGST for local sales)

## Pending Tasks

### HIGH PRIORITY — Pre Go-Live
1. Day-flow smoke test (manual, not code):
   Open day → cashier login → start shift → POS sale (3-4 items)
   → hold/retrieve bill → print thermal receipt → close shift → close day
2. Opening stock via GRN for top 200 fast-movers (all at stockOnHand=0 now)

### MEDIUM — Claude Code Tasks
3. Sale/Deals page (/deals): products where SP < MRP, sorted by savings % desc
4. SEO meta tags: generateMetadata on product, category, /products pages
5. Loading skeletons: grey placeholder cards during data fetch
6. Empty states: friendly messages for 0-result categories/searches
7. Description + Keywords columns: add to Product model via prisma db push,
   then re-import from J:\SVN\SVN_26\data\products_categorized.csv
8. Rename category: UPDATE Category SET name='Agarbathi & Incense'
   WHERE code='HOMECARE_10_01'

### LOW — Post Go-Live
9. Keywords generation for 585 products with empty keywords field
10. HSN codes per product (currently all "0000")
11. Manual re-category of 558 Miscellaneous products via admin UI
12. FSSAI license number entry (14-digit number — user to provide)
13. Hosting decision (Hostinger KVM4 or similar — needed before public launch)

## Phase 2b — Future (not started)
- Customer login via OTP (own backend, NOT Firebase)
- OTP provider: 2Factor / Fast2SMS / MSG91 (Indian, WhatsApp OTP preferred)
- DLT registration required for SMS in India
- Online cart, checkout, delivery zones, order tracking
- UPI payments: Razorpay or PhonePe Business
- Weighing scale integration, repacking module, loyalty points

## How to Use This File
At the start of any Claude Code session, type:
  "Read CONTEXT.md for full project context before starting any work."
Claude Code will read this file and have everything it needs.
