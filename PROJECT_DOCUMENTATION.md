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
- **Restaurant**: Hides barcodes and brands. Adds Table assignment, Order Holding, and Kitchen view. Features raw ingredient tracking.
- **Pharmacy**: Adds `batchNumber`, `prescription` flags, and strict `expiryDate` tracking. Hides customer debts.
- **Boutique**: Separates variations into explicitly structured `sizes` and `colors`.
- **Auto Spares**: Introduces `compatibility` (Make/Model/Year fields) for robust searching, plus warranty features.
- **Hardware & Spices**: Heavily utilizes fractional sales natively via `inputMode="decimal"` and unit configurations (kg, m, L).

## 6. Super Admin & Demo Control Center
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
- **6 Vertical Seeders**: Injects rich, vertical-specific mock data (Retail, Restaurant, Pharmacy, Boutique, Auto Spares, Hardware) into the application.
- **Local Isolation**: All seeders write **strictly to the local Zustand store**. The `syncQueue` is explicitly cleared to guarantee fake demo data never pollutes the live Supabase production database.
- **Wipe Local Store**: A kill-switch to wipe local state and trigger the onboarding wizard.

## 7. Security & Authentication
- The app features a PIN-based lock screen for daily staff operations.
- A global `keydown` event listener is attached on the `LockScreen` for fast physical keyboard PIN entry.
- A prominent Lock System / Switch User button provides fast account switching.

## 8. How to Resume Development
1. **Prerequisites**: Ensure you have Node.js installed.
2. **Setup**: Run `npm install` in the project root.
3. **Start**: Run `npm run dev` to launch the Vite development server.
4. **Login**: 
   - New instances boot to the **First-Run Onboarding** (create your own PIN).
   - Alternatively, use the Super Admin Demo Control Center to seed the app, then log in with:
     - Owner PIN: `1234`
     - Cashier PIN: `0000`

## 9. Key Files
- `src/store/useStore.ts`: The central nervous system of the app. All state modifications go through here.
- `src/types.ts`: Domain models. Review this to understand the data schema.
- `src/pages/POS.tsx`: The main checkout and cart interface. Handles fractional logic, wholesale triggers, and parking sales.
- `src/pages/SuperAdmin.tsx`: The multi-tenant control panel.
- `src/lib/demoSeeders.ts`: Generators for rich, local-only mock data.

## 10. Deployment
This is a standard Vite application. The repository is hosted on **GitHub** and connected to **Vercel** for CI/CD. Pushing changes to the `main` branch will automatically trigger a build and deploy on Vercel. Supabase acts as the remote backend for syncing the offline data and managing SaaS billing states.
