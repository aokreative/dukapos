# Duka POS – Project Documentation

## 1. Overview
Duka POS is a completely offline-first Point of Sale application designed for speed, resilience, and multi-vertical support. It allows seamless operation without an internet connection and syncs in the background when connectivity is restored.

## 2. Tech Stack
- **Framework**: React (Vite)
- **Language**: TypeScript
- **State Management**: Zustand (with JSON persistence for offline-first capabilities)
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Charts**: Recharts
- **Database / Backend**: Supabase (PostgreSQL, Row Level Security, RPCs)
- **Hosting / CI/CD**: Vercel (connected to GitHub for automatic deployments)

## 3. Architecture & Data Flow
The application logic runs entirely client-side. The entire database is modeled as a small, flat JSON structure stored in the browser using `localStorage`/`IndexedDB` (via Zustand persist).

### The Zustand Store (`src/store/useStore.ts`)
The store (`useStore`) holds the entire state:
- `products`: Catalog items, stock numbers, prices.
- `sales`: Ledger of all finalized transactions.
- `staff`: Employees and their PINs.
- `settings`: Business configuration.
- `locations`: Branches and warehouses.
- `transfers`: Pending and completed stock movements.

Because the app is offline-first, actions like completing a sale synchronously update the local Zustand store. A separate background sync queue (`syncQueue`) is implemented to eventually push these operations to a remote Supabase backend.

## 4. First-Run Onboarding & Clean State
The application defaults to a **clean state** for production deployments. 
If the `staff` array in the Zustand store is empty, the application intercepts routing and forces a local-first **First-Run Onboarding Wizard**. This wizard captures:
- Shop Name
- Business Type (Vertical)
- Master Owner PIN

Once completed, the owner can begin trading immediately, completely offline.

## 5. Vertical-Specific Features (Business Types)
The POS adapts dynamically based on the `settings.businessType` value. This triggers specific feature flags and UI changes via `src/lib/labels.ts`.

- **Retail / Shop**: Standard FMCG workflow.
- **Restaurant**: Hides barcodes and brands. Adds Table assignment, Order Holding, and Kitchen view (3-column layout: Preparing -> Waiting/Pass -> Floor). Features raw ingredient tracking.
- **Pharmacy**: Adds `batchNumber`, `prescription` flags, and strict `expiryDate` tracking. Hides customer debts.
- **Boutique**: Separates variations into explicitly structured `sizes` and `colors`.
- **Auto Spares**: Introduces `compatibility` (Make/Model/Year fields) for robust searching, plus warranty features.
- **Hardware & Spices**: Heavily utilizes fractional sales natively via `inputMode="decimal"` and unit configurations (kg, m, L).

## 6. Multi-Branch & Warehousing
The POS supports managing multiple locations (branches and warehouses) under a single account.
- **Locations**: A location can be a `branch` (sells to customers) or a `warehouse` (stores stock).
- **Device Assignment**: Each POS device selects its active location, meaning all sales and stock deductions occur there.
- **Stock Transfers**: Stock can be transferred between locations. Transfers remain pending until the receiving location confirms receipt.
- **Per-branch M-PESA**: Branches can optionally have their own specific M-PESA Till/Paybill numbers and Daraja STK Push keys, so payments at a specific branch go to its own account instead of the shop default.

## 7. Super Admin & Demo Control Center
The application features a dedicated **Super Admin Dashboard** accessible at `/superadmin`. 

### Access Control
- Authentication is handled via **Supabase Auth**.
- Only the specific account `aokreative@gmail.com` is granted access to the `/superadmin` route.
- The UI layout is strictly isolated from the tenant POS UI.

### SaaS Management
Super Admins can manage all multi-tenant SaaS accounts:
- View all registered shops and their details.
- **Suspend/Reactivate**: Soft-locks a shop out of the application via Supabase RPCs (`admin_suspend_tenant`, `admin_reactivate_tenant`).
- **Delete**: Permanently wipes a shop and cascades deletions safely via the `admin_delete_tenant` RPC.

### Demo Control Center
For sales presentations, the Super Admin dashboard includes a **Demo Control Center**.
- **11 Vertical Seeders**: Injects rich, vertical-specific mock data (Restaurant, Pharmacy, Boutique, Auto Spares, Hardware, Mini-Mart, Electronics, Agrovet, Spices, Wholesale, Babyshop) into the application.
- **Local Isolation**: All seeders write **strictly to the local Zustand store**. The `syncQueue` is explicitly cleared to guarantee fake demo data never pollutes the live Supabase production database.
- **Demo Mode Routing**: Super admins can enter the seeded POS directly (`_isDemo` mode) without being bounced back to `/superadmin`.
- **Clear Demo Data**: A dedicated button to wipe local state safely without triggering Supabase sync.

## 8. Security & Authentication
- The app features a PIN-based lock screen for daily staff operations.
- A global `keydown` event listener is attached on the `LockScreen` for fast physical keyboard PIN entry.
- A prominent Lock System / Switch User button provides fast account switching.

## 9. How to Resume Development
1. **Prerequisites**: Ensure you have Node.js installed.
2. **Setup**: Run `npm install` in the project root.
3. **Start**: Run `npm run dev` to launch the Vite development server.
4. **Login**: 
   - New instances boot to the **First-Run Onboarding** (create your own PIN).
   - Alternatively, use the Super Admin Demo Control Center to seed the app, then log in with:
     - Owner PIN: `1234`
     - Cashier PIN: `0000`

## 10. Key Files
- `src/store/useStore.ts`: The central nervous system of the app. All state modifications go through here.
- `src/types.ts`: Domain models. Review this to understand the data schema.
- `src/pages/POS.tsx`: The main checkout and cart interface. Handles fractional logic, wholesale triggers, and parking sales.
- `src/pages/SuperAdmin.tsx`: The multi-tenant control panel.
- `src/pages/Branches.tsx`: Multi-branch, warehouse, and stock transfer management.
- `src/lib/demoSeeders.ts`: Generators for rich, local-only mock data.

## 11. Deployment
This is a standard Vite application. The repository is hosted on **GitHub** and connected to **Vercel** for CI/CD. Pushing changes to the `main` branch will automatically trigger a build and deploy on Vercel. Supabase acts as the remote backend for syncing the offline data and managing SaaS billing states.

## 12. Tracked Defects
- **Silent RLS failures in Sync Queue**: Postgres missing UPDATE/DELETE policies return 0 rows updated instead of throwing an error. Supabase client resolves successfully with an empty array. The `syncQueue` processes this empty result as a success, silently dequeuing and losing the change. We need to verify the expected number of rows was affected and route a 0-row result to a visible error state, instead of silently dropping it or infinitely retrying.