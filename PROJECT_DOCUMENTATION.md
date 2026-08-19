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

## 3. Architecture & Data Flow
The application logic runs entirely client-side. The entire database is modeled as a small, flat JSON structure stored in the browser using `localStorage`/`IndexedDB` (via Zustand persist).

### The Zustand Store (`src/store/useStore.ts`)
The store (`useStore`) holds the entire state:
- `products`: Catalog items, stock numbers, prices.
- `sales`: Ledger of all finalized transactions.
- `staff`: Employees and their PINs.
- `settings`: Business configuration.

Because the app is offline-first, actions like completing a sale synchronously update the local Zustand store. A separate background sync queue (e.g. `sync_queue`) is implemented to eventually push these operations to a remote backend.

## 4. Vertical-Specific Features (Business Types)
The POS adapts dynamically based on the `settings.businessType` value. This triggers specific feature flags and UI changes via `src/lib/labels.ts`.

- **Restaurant**: Hides barcodes and brands. Adds Table assignment, Order Holding, and Kitchen view. Features raw ingredient tracking.
- **Pharmacy**: Adds `batchNumber`, `prescription` flags, and strict `expiryDate` tracking. Hides customer debts.
- **Boutique**: Separates variations into explicitly structured `sizes` and `colors`.
- **Auto Spares**: Introduces `compatibility` (Make/Model/Year fields) for robust searching, plus warranty features.
- **Hardware & Spices**: Heavily utilizes fractional sales natively via `inputMode="decimal"` and unit configurations (kg, m, L).

## 5. Security & Authentication
- The app features a PIN-based lock screen.
- A global `keydown` event listener is attached on the `LockScreen` for fast physical keyboard PIN entry.
- A prominent Lock System / Switch User button provides fast account switching.

## 6. How to Resume Development
1. **Prerequisites**: Ensure you have Node.js installed.
2. **Setup**: Run `npm install` in the project root.
3. **Start**: Run `npm run dev` to launch the Vite development server.
4. **Login**: 
   - Demo Owner PIN: `1234`
   - Demo Cashier PIN: `0000`

## 7. Key Files
- `src/store/useStore.ts`: The central nervous system of the app. All state modifications go through here.
- `src/types.ts`: Domain models. Review this to understand the data schema.
- `src/pages/POS.tsx`: The main checkout and cart interface. Handles fractional logic, wholesale triggers, and parking sales.
- `src/pages/Products.tsx`: The inventory manager, dynamically rendering fields based on the business type.

## 8. Deployment
This is a standard Vite application. Run `npm run build` to generate static files in the `dist` folder. These files can be served by any static host (Vercel, Netlify, Nginx, etc.). Ensure the web server is configured to fallback to `index.html` for client-side routing.
