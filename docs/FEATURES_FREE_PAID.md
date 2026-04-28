# Free vs paid features

## Plans

| Plan | Features |
|------|----------|
| **Free** | BOM Compare (upload, run, view results), change password, download log. Uses existing mappings (read-only). |
| **Paid** | Everything in Free, plus **Export** (CSV/PDF), **Mapping Manager** (create, edit, delete, set active mapping). |
| **Admin** | Same as Paid; additionally **Users** page. Admins always have Mapping Manager even if plan is free. |

## How plan is stored

- Login users are in `backend/uploads/auth_users.json` (or `DATA_DIR/uploads/auth_users.json` when packaged).
- Each user has `role` (`"admin"` or `"user"`) and `plan` (`"free"` or `"paid"`).
- If `plan` is missing, it defaults to `"free"`.

Example:

```json
{
  "admin": {
    "password_hash": "...",
    "role": "admin",
    "plan": "paid"
  },
  "jane": {
    "password_hash": "...",
    "role": "user",
    "plan": "free"
  }
}
```

## Upgrading a user to paid

**Option 1 – Edit file**  
Edit `uploads/auth_users.json` and set `"plan": "paid"` for that user. Restart is not required; next login will use the new plan.

**Option 2 – API (admin only)**  
As an admin, send:

```http
PATCH /api/auth-users/<username>/plan
Content-Type: application/json
X-User-Plan: paid
X-User-Role: admin

{"plan": "paid"}
```

Response: `{"username": "jane", "plan": "paid"}`.

## Backend enforcement

- **Paid-only endpoints** (return `402 Upgrade required` if plan is not paid):  
  `POST /api/save-mapping`, `POST /api/update-mapping`, `DELETE /api/mapping/<filename>`, `POST /api/mapping/status/<filename>`, `POST /api/rename-mapping`.
- **Read-only mapping** (allowed for free):  
  `GET /api/mappings`, `GET /api/load-mapping/<filename>` — free users can use existing mappings for BOM Compare.
- Export is done in the browser (CSV/PDF); the UI simply hides or disables export buttons for free users and shows an upgrade prompt.

## Selling price (optional)

You can show a **selling price** for the paid plan in the upgrade prompt (e.g. "$29/month", "€20/year").

- **Config:** `appConfig.sellingPrice` in `frontend/src/config/appConfig.js` (default: empty = not shown).
- **Override at build time:** `REACT_APP_PAID_PLAN_PRICE` — e.g. `$29/month` or `€20/year`.

When set, the upgrade modal shows a line: **Paid plan: &lt;sellingPrice&gt;**.

## Upgrade contact (align with your support/billing)

The “Contact to upgrade” link in the app is driven by **one config** so you can align it with your real support or billing URL/email.

- **File:** `frontend/src/config/appConfig.js`
- **Settings:**
  - `UPGRADE_CONTACT.url` – `mailto:...` or `https://...` (e.g. your pricing or contact page).
  - `UPGRADE_CONTACT.label` – Button text (e.g. `"Contact to upgrade"` or `"View plans"`).

You can override at build time with env vars:

- `REACT_APP_UPGRADE_URL` – e.g. `https://yourcompany.com/bom-compare-pricing`
- `REACT_APP_UPGRADE_LABEL` – e.g. `View plans`
- `REACT_APP_APP_NAME` – App name used in titles (default: `BOM Compare Tool`)
- `REACT_APP_PAID_PLAN_PRICE` – Optional; e.g. `$29/month` (shown in upgrade prompt when set)

Example (PowerShell):

```powershell
$env:REACT_APP_UPGRADE_URL="https://yourcompany.com/contact"
$env:REACT_APP_UPGRADE_LABEL="Contact sales"
npm run build
```

## Frontend

- Every API request sends `X-User-Plan` and `X-User-Role` (set from login response).
- `useFeatures()` returns `{ canExport, canUseMappingManager, isPaid, features }`.
- Navbar shows **Mapping Manager** only if `canUseMappingManager`; shows **Free** badge when not paid.
- **Export CSV / Export PDF** on BOM Compare page: if not paid, clicking opens an upgrade prompt instead of exporting.
