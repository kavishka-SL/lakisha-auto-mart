# Lakisha Auto Mart

Diploma project for managing a vehicle repair workshop. The React frontend calls an Express API, which stores records in MySQL. Staff roles are Manager, Office Management, Service Advisor, Technician, and Supplier. Customers enter their issued Vehicle ID in the customer portal.

## Project map

| Path | Purpose |
| --- | --- |
| `frontend/src/App.js` | Browser routes and staff session restoration |
| `frontend/src/pages/` | Screens for each role |
| `frontend/src/styles/` | Screen styles |
| `backend/server.js` | API startup, access checks, audit entries, WhatsApp connection |
| `backend/routes/` | API actions for each role and the four inventory reports |
| `backend/db.js`, `passwords.js`, `session.js` | MySQL connection, password hashing, signed staff sessions |
| `backend/whatsappQr.js` | Writes the WhatsApp linking QR as a local SVG file |
| `backend/templates/invoice_template.docx` | Downloaded invoice layout |
| `backend/assets/report-letterhead.png` | Letterhead used by inventory report PDFs |
| `database/schema.sql` | Current database structure, with no customer data or passwords |
| `backend/migrations/` | Changes for installations imported from the older `new3.sql` dump |
| `backend/scripts/create-manager.js` | Creates the first manager on a new, empty database |

The `package.json` and `package-lock.json` files in **both** app folders list the Node packages. Keep the lockfiles; `npm ci` installs the same versions. `node_modules`, `frontend/build`, `backend/.env`, WhatsApp sessions, uploaded files, and database backups are local files and are excluded from Git.

## Run on this laptop

1. Start your MySQL server. MySQL Workbench is the database client; it does not replace the server. This laptop already has `auto_care_db`, so do **not** import the schema again.
2. Check `backend/.env`: `DB_HOST=localhost`, `DB_PORT=3306`, `DB_USER=root`, `DB_NAME=auto_care_db`, and your own `DB_PASSWORD`. Keep this file private.
3. Double-click `Start-Lakisha.cmd` in the project folder. It starts the backend and frontend in separate windows, waits for both, and opens <http://localhost:3000>. It detects running instances so a second click does not start another WhatsApp browser on the same saved session. Keep the two app windows open while using the system.

Double-click `Check-Lakisha.cmd` whenever the site does not open. It reports whether MySQL, the backend, and the frontend are reachable. If all three say `True`, open <http://localhost:3000>. If MySQL says `False`, start MySQL Server first; opening MySQL Workbench alone does not start it. If the backend or frontend says `False`, run `Start-Lakisha.cmd` and read the error in that component's window. A terminal that says `Compiled successfully` and stays open is normal: it is serving the frontend.

If you prefer to start each part manually, open two PowerShell windows. In the first, run:

   ```powershell
   cd "D:\DSE 25.3\Dip Final Project\Final System\lakisha-auto-mart\backend"
   npm.cmd start
   ```

In the second, run:

   ```powershell
   cd "D:\DSE 25.3\Dip Final Project\Final System\lakisha-auto-mart\frontend"
   npm.cmd start
   ```

Open <http://localhost:3000>. Check <http://localhost:5000/api/health> if the page says it cannot connect to the server. `npm.cmd ci` is needed only after downloading the project or changing dependencies; later starts need only `npm.cmd start` in each folder.

PowerShell may block `npm.ps1` because of its script policy. Use `npm.cmd` as shown; the one-click launcher handles this too. The launcher uses a process-scoped PowerShell policy and does not change your Windows security setting.

For a local check after changing code, run `npm.cmd test` in `backend` and `npm.cmd run build` in `frontend`. A successful build checks compilation, but it cannot guarantee that every workflow or future machine setup is error free. Keep a private backup of your MySQL database and `backend/.env`; neither is stored in GitHub.

## Set up a fresh clone

1. Install Node.js with npm and MySQL Server. Open `database/schema.sql` in MySQL Workbench and execute it. This creates the empty `auto_care_db` schema with the current tables and triggers. Do not run `backend/migrations/` after this schema import; those migrations are for older databases.
2. Copy `backend/.env.example` to `backend/.env`. Enter your own MySQL password. Set `SESSION_SECRET` to a long, random, private value so staff sessions survive backend restarts.
3. From `backend`, run `npm ci`. For a **new empty database only**, create its first manager account with PowerShell:

   ```powershell
   $env:SETUP_MANAGER_USERNAME = 'manager'
   $env:SETUP_MANAGER_NAME = 'Manager'
   $secret = Read-Host 'New manager password (12+ characters)' -AsSecureString
   $env:SETUP_MANAGER_PASSWORD = [System.Net.NetworkCredential]::new('', $secret).Password
   node scripts/create-manager.js
   Remove-Item Env:SETUP_MANAGER_PASSWORD
   ```

4. Start the backend and frontend as shown above. Sign in as the manager and create the other staff accounts in the Users screen. Office Management can then register customers; the Service Advisor completes each vehicle registration.

The schema file contains no live records. The old `new3.sql` dump and local backup contain private data and are intentionally **not** part of this repository. The Vehicle ID `VID_DEMO_001` belongs only to the current laptop database; it will not exist in a fresh clone.

For a database created before the combined-visit invoice change, run `backend/migrations/007_invoice_visit.sql` once in MySQL Workbench. It adds `invoice_job` and links existing paid invoices without changing their amounts. On this laptop, the migration has already been applied.

## WhatsApp

Set `ENABLE_WHATSAPP=true` in `backend/.env` and restart the backend. Visit <http://localhost:5000/api/whatsapp/status>:

- `ready`: linked and able to send messages.
- `scan-qr`: open `backend/whatsapp-qr.svg` on this laptop and scan it from WhatsApp **Linked devices** on your phone.
- `starting` or `reconnecting`: wait for the connection to finish.
- `disabled`: set `ENABLE_WHATSAPP=true` and restart the backend.

The linked session is saved under `backend/.wwebjs_auth/`. Keep that folder locally; it is ignored by Git. A new computer needs its own one-time QR scan. Restarting the backend normally reuses its saved session, provided the phone still lists the linked device. WhatsApp messages are sent only while the backend and WhatsApp connection are running. This feature uses WhatsApp, not mobile-network SMS.

Double-click `Check-WhatsApp.cmd` to check the connection. If the status is `scan-qr`, it opens `backend/whatsapp-qr.svg`. On your phone, go to WhatsApp > Linked devices > Link a device and scan the image. If the QR has expired, run the checker again after the backend refreshes it. If the status is `ready`, no scan is needed. Keep only one backend instance running, because two instances cannot use the same saved WhatsApp browser session.

## Reports and limitations

Manager Business Reports downloads Daily, Weekly, Monthly, and Yearly Inventory Summary PDFs. Office Management downloads the invoice Word document. Stock history begins with the first saved inventory snapshot; past quantities from before that date cannot be reconstructed.

Staff APIs use signed role sessions. The customer portal currently uses the issued Vehicle ID alone, which is suitable for this local diploma demonstration but not strong authentication for an internet-facing service. The invoice's card option records a payment completed outside the system; it does not charge a card.
