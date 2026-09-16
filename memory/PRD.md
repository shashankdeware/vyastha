# Vyastha — Product Requirements & Implementation Log

## Original Problem Statement
Enhance & redesign the EXISTING "Vyastha" GST billing SaaS (React + FastAPI + MongoDB) into a
unified premium product: professional GST billing, quotations, customers, products, inventory,
payment tracking, analytics, admin-configurable subscriptions (Free 3-month trial, ₹49/mo, ₹499/yr),
a real-time multilingual AI Business Assistant ("Ask Vyastha") with voice, admin panel, feature-access
control, notifications, and mobile/PWA readiness — without breaking existing features or data.

## Architecture
- **Backend**: FastAPI monolith (`server.py`) + `lib/` modules. Motor/MongoDB. JWT auth (cookie + Bearer).
  Tenant isolation via `user_id` on every collection.
- **Frontend**: React 19 + CRACO + Tailwind + shadcn/ui. Contexts: AuthContext, EntitlementContext.
- **Integrations**: Gemini 3.5 Flash (Ask Vyastha) & Stripe checkout via `emergentintegrations`
  (Emergent Universal LLM key + `sk_test_emergent`). SMTP email service (configurable).

## User Personas
1. Business Owner (business_owner) — runs billing, gets trial, upgrades.
2. Platform Admin (admin) — manages plans/pricing/users/audit logs.

## Core Requirements (static)
- Preserve all existing billing/invoice/quotation/inventory/customer/payment features.
- Admin-configurable pricing stored in DB (no hardcoded prices).
- Backend-enforced feature access + subscription entitlements.
- AI uses only approved, tenant-scoped data functions.

## Implemented (2026-06)
- Migrated full existing Vyastha app into /app; fixed Mongo (local, conditional TLS) & CORS (origin reflect).
- Subscription system: `plans` (free + pro ₹49/₹499, 90-day trial), auto trial on first load,
  entitlements via `lib/features.py`, Stripe INR checkout + status polling + webhook + cancel.
- Ask Vyastha AI: `lib/ai_data.py` (20+ approved functions), `lib/ai_assistant.py` (Gemini, multilingual
  Hindi/English/Hinglish/Marathi, dynamic suggested questions, audit log, action suggestions).
- Frontend: AskVyastha floating assistant (voice via Web Speech API + TTS, language selector,
  suggestion chips, action confirmation), SubscriptionPage, SubscriptionSuccessPage, AdminPage,
  trial/expired banners, nav links. EntitlementContext for frontend feature gating.
- Notifications endpoint (low stock, overdue, trial expiry), notification preferences, integrations status.
- Admin panel: stats, users, plan pricing/trial editing, AI audit logs.
- PWA: manifest.json, service worker (API-bypassing), icons, apple meta.

## Backlog / Remaining (P1/P2)
- P1: Subscription payment receipt/invoice PDF; WhatsApp integration (currently "setup required" status).
- P1: Full premium redesign polish across every legacy page (shell + dashboard done; builders pending).
- P2: Native Android/iOS packaging via Capacitor (web + PWA ready; packaging not yet done).
- P2: Event-driven push refresh (currently polling every 15s in Layout + on-demand AI).
- P2: Email notifications delivery (SMTP configurable; not wired to scheduled sends).

## External Config Required
- SMTP_* env vars to enable email sending.
- WhatsApp Business API credentials to enable WhatsApp notifications.
- Stripe: claim sandbox / KYC before production for live payments.

## Next Tasks
- Run testing agent (backend + frontend), fix issues.
- Then polish legacy page visuals and add subscription receipts.

## Iteration 2 (2026-06) — 4 new features (all tested 100%, no functional bugs)
- WhatsApp Reminders: GET /api/reminders/pending builds wa.me click-to-chat links (no API key) with
  prefilled overdue-invoice messages; new /reminders page with per-invoice WhatsApp + copy buttons.
- Subscription GST Receipts: GET /api/subscription/receipts (stable receipt numbers from session_id,
  18% GST inclusive breakup); Billing History section on SubscriptionPage with client-side jsPDF download.
- AI Invoice Draft: ai_assistant.extract_invoice_draft turns a spoken/typed request into a structured
  draft (suggested_action type invoice_draft); AskVyastha confirm -> sessionStorage -> InvoiceBuilder prefill.
- Analytics Dashboard: GET /api/analytics/overview (advanced_analytics gated) -> /analytics page with
  recharts area (sales vs collected, 6 months), top-products bar, payment-status pie + KPIs.
- Trial is now granted at registration (register endpoint) so analytics/AI work immediately for new users.
