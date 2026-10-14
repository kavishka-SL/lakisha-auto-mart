# Backend guide

This Express API supports the Lakisha Auto Mart React frontend and the `auto_care_db` MySQL database. The frontend remains a separate application.

## Run locally

1. Start MySQL. For a new installation, import `../database/schema.sql`; it already contains the current schema. The numbered files in `migrations/` are only for an older `new3.sql` import.
2. Copy `.env.example` to `.env` and enter your local MySQL details. Keep `.env` private.
3. From `backend`, run `npm install` once, then `npm start`.
4. Open `http://localhost:5000/api/health`. A healthy database returns `{ "status": "ok" }`.

See the project root `README.md` for the first manager setup and the two-terminal frontend/backend run commands. The public schema includes no login accounts or customer records.

`PORT` defaults to `5000`. Set `ENABLE_WHATSAPP=true` to connect WhatsApp. The backend uses the saved local session when available, launches Microsoft Edge on this laptop, and prints a QR code in the backend terminal if linking is needed. Open `http://localhost:5000/api/whatsapp/status`: `ready` means messages can be sent, `starting` or `reconnecting` means wait, and `scan-qr` means link this laptop from WhatsApp → Linked devices. The backend retries dropped or stalled connections while it is running. If the status page does not open, start the backend first. `WHATSAPP_BROWSER_PATH` can point to another Chromium browser.

Manager inventory PDFs use Microsoft Edge on this laptop. Set `REPORT_BROWSER_PATH` to another Chrome or Edge executable if needed.

## Code map

| File | Responsibility |
| --- | --- |
| `server.js` | Express setup, health check, optional WhatsApp client, route registration, startup |
| `db.js` | MySQL pool and environment configuration |
| `passwords.js` | Salted password hashes and verification |
| `routes/auth.js` | Staff login |
| `routes/manager.js` | Dashboard, staff, supplier, inventory summary |
| `routes/managementReports.js` | Manager inventory summary PDFs from stock history |
| `assets/report-letterhead.png` | Supplied business letterhead used on inventory PDFs |
| `routes/advisor.js` | Vehicle inspection, job assignment, quality checks |
| `routes/office.js` | Customer registration, invoice and payment records, appointments |
| `routes/technician.js` | Assigned work, time logs, salary advances |
| `routes/customer.js` | Customer status, appointments, feedback, profile |
| `routes/supplier.js` | Supplier orders, quotations, profile |
| `templates/invoice_template.docx` | Office invoice download template |

The request path is **React frontend → Express route → MySQL pool → `auto_care_db`**. Routes use parameterized queries for values. The office payment route uses a database transaction so the invoice and payment record succeed together. Card payments are recorded after payment outside this system; the API does not charge a card.

## Customer and vehicle registration

1. Office Management enters the customer's details and vehicle number plate. One transaction creates the customer and a linked vehicle marked `PENDING_ADVISOR`.
2. The system issues a `VID_...` Vehicle ID at that time. It is saved in `vehicle.vehiclePassId` and mirrored in `customer.vehiclePassId`; the office screen and WhatsApp message give this ID to the customer.
3. The Service Advisor selects the customer, confirms the read-only number plate, and enters the make, model, and year. This updates the same vehicle to `REGISTERED`. Inspection can then begin.
4. The customer enters the issued `VID_...` Vehicle ID to open the portal. `customerId` and the internal `V_...` vehicle record ID remain database links and are not customer login values.

Run `migrations/001_customer_vehicle_pass.sql` once after importing the original SQL dump on a new database. Each vehicle's current Vehicle ID is stored in `vehicle.vehiclePassId`; `customer.vehiclePassId` mirrors that customer's most recently issued ID. Office Management's Vehicle ID tab can view an existing ID without replacing it. Issuing a replacement requires confirmation and updates both tables in one transaction.

## Invoices and payments

Run `migrations/002_invoice_charges.sql` once on an existing database. It adds the `invoice_charge` table and does not alter existing invoice or payment rows. Office Management selects a completed job awaiting payment, reviews parts, and saves any labor, workshop, custom modification, or other charges. The server calculates the amount and tax again when recording payment. Paid jobs move to Completed & Paid Work; individual payment records appear in Payment History. Invoice downloads are Word documents. A card option records a payment already completed outside this system; it does not charge a card.

## Customer feedback

Customer feedback accepts a rating, written comment, and optional photo. Run `migrations/006_remove_feedback_voice.sql` once on an existing database to remove the unused voice note column.

## Management workflows

Run `migrations/003_management_workflows.sql` and `migrations/004_supplier_status.sql` once on an existing database. They add salary advance rejection reasons and active flags for inventory and suppliers; existing rows remain active. Archiving a spare part or supplier hides it from new work while preserving its past job, invoice, and order records.

The Manager Users form requests a role-based User ID preview from the server. The server checks the signed preview before creating a staff account. Supplier accounts are registered from the Suppliers tab with a username and password, and the supplier profile is linked to that account. The Security tab requires the current manager password when resetting another user's password.

Set `SESSION_SECRET` in `backend/.env` to a long random value so login sessions survive backend restarts. The login API returns a signed token, which the frontend sends to the Manager, Office Management, Service Advisor, Technician, and Supplier APIs. Existing staff browser sessions must sign in once again after this change. Archived supplier accounts lose API access immediately. Successful API writes are listed in the Audit Logs tab; public customer actions may have no staff actor name.

## Passwords and existing data

New staff passwords are salted and hashed with Node's `scrypt`. The imported database contains older plain text password values. Those accounts can still log in; a successful login replaces the old value with a hash. New customer records receive a random staff-login secret because the customer portal uses the issued Vehicle ID instead of a staff password.

## Honest limits for the viva

- Staff APIs verify a signed role token. Customer portal access still uses the issued Vehicle ID only, so this system is suitable for a local demonstration rather than public deployment.
- Customer portal access uses the issued Vehicle ID only. Treat it as private for the demo; a production system would need stronger customer authentication.
- The manager can open Daily, Weekly, Monthly, and Yearly Inventory Summary PDFs from Business Reports. Office Management can download the invoice Word document as the fifth report. Run `migrations/005_inventory_history.sql` once to record future stock changes. The initial history row is a snapshot of stock when the migration is applied; the system cannot reconstruct stock quantities from earlier dates.
- WhatsApp messages require a connected client and a recipient with WhatsApp. Registration still works when WhatsApp is unavailable and reports that the message was not sent. This feature sends WhatsApp messages, not mobile-network SMS.

Run the backend checks with `npm test`.
