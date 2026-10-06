# POS integrations

Official provider documentation checked on **2026-10-05**. This implementation supports a private business connecting its own merchant credentials. It does not claim provider partnership or certification.

## What works

Owners and managers use **Settings → POS connections** to validate and save Square or Toast credentials, disconnect a provider, and request a normalized JSON preview. The backend validates real location access before saving. A badge reports the last successful validation; it does not guarantee continuous provider availability.

The preview contains payment identifiers, dates, currency, amounts, tips, refunds, provider employee identifiers, optional labor records, and optional current catalog/menu item identifiers and names. It excludes provider credentials, customer contact details, and payment card details. No preview writes employees, shifts, tips, or payroll entries. The operator must establish employee mappings and accounting rules before a separate import feature can be implemented.

The backend stores each connection as AES-256-GCM encrypted JSON in `AppSetting`, under `pos.connection.v1:<encoded authenticated business ID>:<provider>`. It never accepts a business ID from the request body. Requests require an authenticated owner or manager. Credentials do not enter the general business settings form or browser storage.

Limits are 20 configured locations, a 28-day interval, 100 pages per paginated endpoint, 10,000 normalized records per preview, a 90-second operation budget checked before each provider request, and 10 seconds per upstream request. A final in-flight request can finish after the operation budget. Large previews fail with a shorter-range instruction instead of returning a truncated success. Redirects are refused. Rate limits return sanitized errors and bounded `Retry-After` guidance. Operations for the same business/provider are serialized in this single server process.

## Required server configuration

| Variable | Required for | Contract |
| --- | --- | --- |
| `ENCRYPTION_KEY` | Either provider | A securely generated 32-byte key represented by 64 hexadecimal characters. Configure it on the server before storing credentials. Keep a separate secure recovery copy; losing or changing it makes stored connections unreadable. |
| `TOAST_API_BASE_URL` | Toast | The API Access URL shown in Toast Web for the merchant. An HTTPS hostname below `toasttab.com`, without a path, query, credentials, or custom port. This is administrator configuration, not a browser input. |

Do not prefix these variables with `VITE_`, include them in static assets, or commit their values. Square needs no global merchant token variable; owners save their own token through the protected API. Toast client credentials and cached bearer tokens are encrypted together in the connection record.

## Square setup and contract

Create a Square developer application and obtain a merchant access token in the matching production or sandbox environment. Setup requires `MERCHANT_PROFILE_READ` and `PAYMENTS_READ`. Enable `TIMECARDS_READ` for labor and `ITEMS_READ` for the catalog. Select active location IDs or leave the input blank to discover active locations. Validation reads locations and one payment page for each selected location. The adapter pins `Square-Version: 2026-09-16`.

| Data | Read endpoint | Behavior |
| --- | --- | --- |
| Locations | `GET /v2/locations` | Keeps active locations and verifies selection against token access. [Locations reference](https://developer.squareup.com/reference/square/locations-api/list-locations). |
| Payments and tips | `GET /v2/payments` | Calls every selected location separately, passes creation-time bounds, and follows cursors. A page is at most 100 records. Amounts remain integer currency minor units; `amount_money` excludes `tip_money`. [Payments reference](https://developer.squareup.com/reference/square/payments-api/list-payments), [Payment object](https://developer.squareup.com/reference/square/objects/Payment). |
| Labor and declared cash tips | `POST /v2/labor/timecards/search` | Uses the current timecards API, location filters, start-time range, and cursor pagination. Results include timecards that started in the interval. The older shifts API is deprecated. [Timecards reference](https://developer.squareup.com/reference/square/labor/search-timecards), [Labor migration guidance](https://developer.squareup.com/docs/labor-api/build-with-labor). |
| Current catalog | `GET /v2/catalog/list?types=ITEM` | Follows cursors and returns item IDs and names. Deleted items and historical catalog versions are excluded. [Catalog reference](https://developer.squareup.com/reference/square/catalog-api/list-catalog). |

Square reports each payment's refunds to date, which can change after the payment creation window. Offline payments can appear late. Re-read original date ranges to reconcile historical changes; overlapping current ranges alone are insufficient. Payment status remains visible, including failures and cancellations. The preview does not convert payment gross amounts into net sales, fees, deposits, or a payable tip ledger. [Retrieving payments](https://developer.squareup.com/docs/payments-api/retrieve-payments), [Offline payments](https://developer.squareup.com/docs/payments-api/take-payments).

**OAuth onboarding and automatic refresh are not implemented.** The manual token field is explicit merchant setup. OAuth access tokens expire after 30 days. A future hosted OAuth flow must use a confidential server authorization-code exchange, single-use expiring authorization codes, persisted single-use state, encrypted tokens, revocation handling, and proactive refresh. Square recommends refreshing every seven days or less. Public desktop applications require the documented PKCE flow and have different refresh-token semantics. Do not embed an application secret in Electron or the SPA. [OAuth overview](https://developer.squareup.com/docs/oauth-api/overview), [Receiving and managing tokens](https://developer.squareup.com/docs/oauth-api/receive-and-manage-tokens).

Square Sandbox supports API tests but does not emulate the Square POS application, Square for Restaurants, or physical hardware. No live sandbox requests were made during implementation. [Sandbox limitations](https://developer.squareup.com/docs/devtools/sandbox/overview).

## Toast setup and contract

This adapter uses **Toast Standard API Access**, not an unapproved partner integration. An active restaurant employee needs RMS Essentials or higher and Manage Integrations permission at every location. Configure restaurant GUIDs, client ID, client secret, and the restaurant currency. Standard access is read-only and has **no sandbox**. Required data scope is `orders:read`; optional reads use `labor:read` and `menus:read`. Non-ordering integrations use Menus V2. [Access requirements](https://doc.toasttab.com/doc/devguide/devApiAccessRequirements.html), [Standard access scopes](https://doc.toasttab.com/doc/devguide/devApiAccessScopes.html), [Standard access FAQs](https://doc.toasttab.com/doc/devguide/devApiAccessFAQs.html).

The adapter authenticates with `POST /authentication/v1/authentication/login`, using `clientId`, `clientSecret`, and `userAccessType: TOAST_MACHINE_CLIENT`. Data requests carry `Authorization: Bearer ...` and `Toast-Restaurant-External-ID`. It honors the returned `expiresIn`, caches one token for the configured client across locations, and persists refreshed tokens even if a later read is throttled. A rejected token is discarded. Toast normally issues a one-day token and recommends no more than two authentication requests per hour; repeated authentication is not a refresh strategy. [Authentication](https://doc.toasttab.com/doc/devguide/authentication.html), [Token refresh](https://doc.toasttab.com/doc/devguide/apiAuthTokenRefresh.html), [Authentication rate limits](https://doc.toasttab.com/doc/devguide/apiAuthenticationRateLimit.html).

| Data | Read endpoint | Behavior |
| --- | --- | --- |
| Orders, payments and tips | `GET /orders/v2/ordersBulk` | Passes a modified-time window, restaurant header, one-based page number, and `pageSize=100`; follows pages until fewer than 100 records return. Start is inclusive and end exclusive. Payments can have paid dates outside the modified-time interval. [Bulk orders reference](https://doc.toasttab.com/openapi/orders/operation/ordersBulkGet/). |
| Labor and cash/noncash tips | `GET /labor/v1/timeEntries` | Uses clock-in bounds and `includeArchived=true`. The provider limits intervals to one month; ShiftMint limits them to 28 days. A shift that began before the interval is outside this preview. [Time entries reference](https://doc.toasttab.com/openapi/labor/operation/timeEntriesGet/). |
| Current menus | `GET /menus/v2/menus` | Traverses nested menu groups and exports item GUIDs and names. [Menus reference](https://doc.toasttab.com/openapi/menus/overview/). |

Toast order validation, order preview, and labor preview query timestamps use the documented `yyyy-MM-dd'T'HH:mm:ss.SSS±hhmm` form, normalized to UTC with milliseconds and `+0000`. `URLSearchParams` encodes the plus sign. This changes the outgoing representation while preserving the selected instants and preview interval. Square keeps its own ISO timestamp representation. These request-format checks use mocked HTTP; acceptance by a live Toast merchant environment remains unverified. [Toast dates and timestamps](https://doc.toasttab.com/doc/devguide/api_dates_and_timestamps.html), [Bulk order query dates](https://doc.toasttab.com/openapi/orders/operation/ordersBulkGet/).

Toast payment amounts and tips are separate decimal currency amounts; the adapter converts them to integer minor units. Currency must be supplied accurately during setup and is currently limited to USD, CAD, GBP, EUR, and AUD. Refund status is separate from payment status. Payment server attribution takes precedence over check/order attribution. Service charges, mandatory gratuities, tax, withholding, deposits, and provider fees are not a calculated payroll entitlement. [Payment schema](https://doc.toasttab.com/openapi/orders/tag/Data-definitions/schema/Payment/).

Historical bulk order calls are paced at least five seconds apart. Toast documents endpoint limits as well as global request limits and recommends five to ten seconds between historical requests. A 429 response is surfaced for the operator to retry later. [Rate limiting](https://doc.toasttab.com/doc/devguide/apiRateLimiting.html).

A commercial partner integration is a different program. Toast describes application review, agreements, sandbox provisioning, certification, and staged production rollout. This code does not satisfy or bypass those approvals. [Partner integration process](https://doc.toasttab.com/doc/devguide/integrationDevProcess.html).

## Webhooks and automatic synchronization

Webhook endpoints, webhook subscriptions, durable event receipts, scheduled synchronization, and automatic payroll imports are **not implemented**. Polling occurs only when an operator requests a preview. Current connection validation does not promise real-time synchronization.

Before adding webhooks:

- Square: validate `x-square-hmacsha256-signature` with the subscription signing key over the registered notification URL plus the raw body; use constant-time comparison. Persist and deduplicate `event_id`; acknowledge quickly, allow out-of-order delivery, and reconcile missed updates. Square retries delivery for up to 24 hours. [Signature validation](https://developer.squareup.com/docs/webhooks/step3validate), [Webhook delivery](https://developer.squareup.com/docs/webhooks/overview).
- Toast: Standard access now permits self-managed webhook subscriptions, but this does not create a sandbox. Validate `Toast-Signature` as Base64 HMAC-SHA256 over the raw message body followed by the payload's timestamp. Deduplicate the payload GUID. The timestamp is in the payload; do not invent a `Toast-Timestamp` header. Acknowledge within two seconds after durable receipt, then process asynchronously. Implement documented retry and polling recovery. [Standard subscriptions](https://doc.toasttab.com/doc/devguide/devApiAccessWebhookSubscriptions.html), [Message signatures](https://doc.toasttab.com/doc/devguide/apiMessageSigning.html), [Payload schema](https://doc.toasttab.com/doc/devguide/apiMessageDataSchema.html), [Timeouts](https://doc.toasttab.com/doc/devguide/apiTimeouts.html), [Retries](https://doc.toasttab.com/doc/devguide/apiRetrySupport.html).

Any future import needs provider/business/location/external-record unique keys, update/version tracking, explicit employee mappings, void/refund reconciliation, time-zone and business-day rules, tax/gratuity classification, audit history, and an operator-reviewed payroll transaction.

## Verona and other providers

The user approved keeping Verona pending for this release until an approved integration contract becomes available.

The user identified **Verona POS** at [veronapos.com](https://www.veronapos.com/). Its official [integration page](https://www.veronapos.com/restaurant-pos-system-integrations/) advertises partner solutions. Its [Otter guide](https://doc.veronapos.com/en/otter/try-otter-integration-guide) describes dealer-assisted onboarding for third-party ordering. These pages do not establish an API contract for ShiftMint sales, tips, or labor reads. No public developer endpoint, authentication, scopes, pagination, or webhook contract was found in the reviewed official pages and focused searches. This does not prove that a private partner API is unavailable.

Verona's [credit-card report guide](https://doc.veronapos.com/en/reports/reports-list/credit-card) documents transaction date/time, ticket, employee, purchase amount, tip, status, and Excel export. Its [hours report guide](https://doc.veronapos.com/en/reports/reports-list/hours-total-detail) documents date-filtered employee-hours reporting. No actual export file or schema has been tested.

**A Verona connector or report import is not implemented.** The next step is an approved vendor API/export contract and merchant permission. Request sales/tip/labor access, stable business/location/employee/record identifiers, currency and business timezone rules, refunds/voids, historical corrections, authentication and renewal, rate limits, and test access. A future export importer must validate a representative report, map employees explicitly, reject ambiguous timestamps/amounts, reconcile duplicates/corrections, and show an operator-reviewed preview before writes. The current generic CSV screens do not claim Verona compatibility. No vendor message, merchant login, or private endpoint request was sent. Official Verona material was checked on 2026-10-05.

Other named providers in the old menu were placeholders and are not represented as implemented integrations.

## Hosting decision

The actual application is Electron plus an Express backend and Prisma SQLite, not a Supabase application. The minimum cloud deployment that preserves desktop behavior is a single Render Node web service serving the SPA and API from one origin, with a paid persistent disk and the SQLite database on that disk. Bind Express to `0.0.0.0` and Render's `PORT`; keep all provider credentials on the backend. [Render web services](https://render.com/docs/web-services).

Render disks are only available at runtime, not during build or pre-deploy commands. Run SQLite migrations after the disk mounts in the startup command. A persistent disk restricts the service to one instance and prevents zero-downtime deploys; it cannot be shared with a worker. Retain encrypted backups outside the service and test restoration. This recommendation accepts those single-business limits. A later multi-instance service should migrate explicitly to managed PostgreSQL with a data migration and separate provider migrations. [Render disks](https://render.com/docs/disks), [Prisma on Render](https://render.com/docs/deploy-prisma-orm).

Railway is an alternative persistent Node host. Its volumes likewise mount at startup, not build or pre-deploy, and paths must match the mount. Its PostgreSQL template requires operator maintenance. [Railway volumes](https://docs.railway.com/volumes), [Railway PostgreSQL](https://docs.railway.com/databases/postgresql).

Vercel can host the Vite frontend with SPA rewrites, but it does not replace the persistent backend/database required here. Supabase Edge Functions would introduce a new backend and bounded execution model rather than preserve this application. Neither service has been provisioned. [Vercel Vite SPA guidance](https://vercel.com/docs/frameworks/frontend/vite), [Supabase Edge Function limits](https://supabase.com/docs/guides/functions/limits).

## Verification and remaining checks

Automated tests use mocked provider HTTP, mocked Prisma storage, real encryption, a loopback Express server, and a jsdom UI. They cover pagination, repeated cursors, location access, provider errors, currency conversion, exclusion of card details and credentials, token reuse, encrypted storage, tenant scope, role authorization, rejected request fields, disconnect serialization, structured UI errors, status refresh after rejection, and clearing credentials after validation.

Merchant credentials, live provider calls, Toast partner approval, Square marketplace review, POS hardware, webhook delivery, provider production behavior, and hosted billing/provisioning have not been checked. Test accounts and granted provider scopes are needed for a live end-to-end acceptance check. No approval or successful live connection is implied by mocked tests.
