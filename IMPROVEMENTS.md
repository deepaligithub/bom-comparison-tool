# BOM Validator Tool – Suggested Improvements

This document lists improvements that would make the tool more complete and less limited.

---

## ✅ Done

- **Change password** – Users can change their password from the account dropdown (navbar → username → Change password). Passwords are stored hashed and persisted in `uploads/auth_users.json`.

---

## Authentication & Users

| Improvement | Description |
|-------------|-------------|
| **Admin: create login users** | Let admins add new users (username + password + role) from the Users page, stored in the same auth file so they can log in. |
| **Session / JWT** | After login, issue a session cookie or JWT so API calls are authenticated; reject requests without valid auth. |
| **Session timeout** | Auto-logout after inactivity (e.g. 30 minutes) or “Remember me” option. |
| **Password rules** | Enforce stronger rules: min length, mix of letters/numbers/symbols, prevent reuse of last N passwords. |
| **Forgot password** | If you add email to users: “Forgot password” flow with reset link or one-time code. |

---

## User Experience

| Improvement | Description |
|-------------|-------------|
| **Dashboard / home** | After login, show a simple dashboard: last comparison summary, quick links, or “Get started” steps. |
| **Empty states** | When no mapping or no comparison yet, show clear messages and actions (e.g. “Upload your first BOM” or “Create a mapping”). |
| **Success / error toasts** | Use toast notifications for “Password changed”, “Mapping saved”, “Export started”, and errors. |
| **Loading skeletons** | Replace generic spinners with skeleton placeholders for table and cards. |
| **Keyboard shortcuts** | e.g. Ctrl+Enter to run comparison, Escape to close modals. |
| **Remember last mapping** | Remember the last selected mapping per user (e.g. in localStorage or backend). |

---

## Comparison & Data

| Improvement | Description |
|-------------|-------------|
| **Save comparison history** | Store past comparisons (metadata + optional file refs) so users can reopen or re-export. |
| **Comparison names** | Let users name a comparison (e.g. “Q1 TC vs SAP”) for easier reference. |
| **Bulk export** | Export multiple comparisons or filtered result sets in one go. |
| **Column templates** | Save/load column visibility presets (e.g. “Minimal”, “Full”). |
| **Better numeric handling** | Consistent handling of decimals (e.g. 1.0 vs 1) and units across TC and SAP. |

---

## Admin & Configuration

| Improvement | Description |
|-------------|-------------|
| **Sync Users page with auth** | Make the existing Users list reflect real login users; add/edit/delete from there and update auth store. |
| **Default mapping per role** | Allow setting a default mapping per user or role. |
| **Audit log** | Log who ran a comparison, changed mapping, or changed password (with timestamp). |
| **Configurable file size limit** | Allow admins to set max upload size (e.g. via env or settings page). |

---

## Security & Operations

| Improvement | Description |
|-------------|-------------|
| **HTTPS in production** | Ensure the app is only served over HTTPS. |
| **Rate limiting** | Limit login attempts and API calls per IP to reduce abuse. |
| **Password hashing** | Already using SHA-256; consider bcrypt/argon2 for new implementations. |
| **Environment-based secrets** | Store default admin password or secret key in env, not in code. |

---

## UI Polish

| Improvement | Description |
|-------------|-------------|
| **Responsive layout** | Improve tables and filters on small screens (e.g. horizontal scroll, stacked filters). |
| **Accessibility** | ARIA labels, focus management in modals, and keyboard navigation. |
| **Dark mode** | Optional theme toggle. |
| **Consistent styling** | Align BOM Compare page with Tailwind/design system used in the rest of the app. |

---

## Next steps (quick wins)

1. **Admin: add login users** – Reuse `auth_users.json` and add a form on the Users page to create username/password/role.
2. **Toast notifications** – Add a small toast library and use it for success/error after login, change password, and export.
3. **Dashboard placeholder** – Add a simple “Home” or “Dashboard” route with a short welcome and links to BOM Validator and (for admin) Mapping Manager.

Implementing these in small steps will make the tool feel more complete without a full rewrite.
