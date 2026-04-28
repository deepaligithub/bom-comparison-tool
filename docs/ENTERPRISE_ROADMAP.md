# BOM Compare Tool – Enterprise Roadmap ($10k‑grade)

This document lists improvements and new features that would position the tool as a high‑value enterprise product: auditability, scale, polish, and differentiation.

---

## 1. Comparison history & audit (enterprise must‑have)

| Feature | Why it justifies premium |
|--------|----------------------------|
| **Comparison history** | Store each run with: timestamp, user, BOM A/B names (or hashes), mapping used, result counts (matched/different/tc_only/sap_only). Let users reopen a past comparison to re‑view or re‑export. |
| **Named comparisons** | Let users name a run (e.g. “Q1 PLM vs SAP”) and optionally add notes. Makes history searchable and reportable. |
| **Audit log** | Log who did what: login, comparison run, mapping create/edit/delete, password change, export. Exportable for compliance. Stored in a simple log file or DB table. |
| **Re‑export from history** | From a past run, export the same results again (CSV/PDF) without re‑uploading files. |

**Impact:** Enterprises need traceability and “who compared what when.” This is table stakes for a $10k tool.

---

## 2. Dashboard & landing experience

| Feature | Why it justifies premium |
|--------|----------------------------|
| **Dashboard / Home** | After login: last comparison summary (date, name, counts), quick actions (“Run new compare”, “Run demo”), recent history (last 5–10 runs). No blank screen. |
| **Empty states** | When no comparisons yet: “Run demo” or “Upload BOM A & B” with clear CTAs. When no mapping: “Create a mapping in Mapping Manager” with link. |
| **Onboarding hint** | First‑time user: short tooltip or banner (“Start with Run demo or upload two BOMs”). Dismissible. |

**Impact:** Feels like a product, not a form. Reduces support and confusion.

---

## 3. Notifications & feedback (polish)

| Feature | Why it justifies premium |
|--------|----------------------------|
| **Toast notifications** | Success: “Comparison complete”, “Export started”, “Mapping saved”, “Password updated”. Error: show message and optional “Retry”. |
| **Loading skeletons** | Skeleton placeholders for table and cards instead of a single spinner. |
| **Export progress** | For large exports, show “Preparing… 1/3” or a progress indicator so users know it’s working. |

**Impact:** Small touches that make the app feel reliable and responsive.

---

## 4. Scale & performance

| Feature | Why it justifies premium |
|--------|----------------------------|
| **Large file handling** | For BOMs with 10k+ rows: chunked processing or background job so the UI doesn’t freeze. Show progress (“Comparing… 5,000 / 12,000 rows”). |
| **Configurable limits** | Admin setting or env for max upload size and max rows per comparison (e.g. 50k rows). |
| **Streaming / pagination** | Backend returns paginated results for very large comparisons; frontend requests page N. |

**Impact:** “It works with our 50k‑line BOMs” is a direct sales argument.

---

## 5. Security & compliance

| Feature | Why it justifies premium |
|--------|----------------------------|
| **Session timeout** | Auto‑logout after N minutes of inactivity (e.g. 30). Optional “Remember me” to extend. |
| **Stronger password rules** | Min length (e.g. 10), mix of upper/lower/numbers/symbols, no reuse of last 3 passwords. |
| **Audit log export** | Export audit log as CSV for compliance (who ran what, when). |
| **HTTPS enforcement** | In production, redirect HTTP → HTTPS and document TLS setup. |
| **Rate limiting** | Limit login attempts and API calls per IP to reduce brute‑force and abuse. |

**Impact:** Required for regulated industries and security‑conscious buyers.

---

## 6. Reporting & export (premium feel)

| Feature | Why it justifies premium |
|--------|----------------------------|
| **Report template** | One‑click “Executive summary” PDF: comparison name, date, user, counts (matched/different/tc_only/sap_only), top 10 differences, and link to full export. |
| **Bulk export** | Export multiple saved comparisons (or filtered views) in one go (ZIP of CSVs/PDFs). |
| **Column visibility presets** | Save presets like “Minimal” (key + quantity only) and “Full” (all columns). Apply with one click. |
| **Excel export** | Export to .xlsx with sheets: Matched, Different, BOM A only, BOM B only (in addition to CSV/PDF). |

**Impact:** “We need a report for the steering committee” is a common ask; one‑click summary PDF and Excel support justify price.

---

## 7. Users & admin (align with auth)

| Feature | Why it justifies premium |
|--------|----------------------------|
| **Users page = auth store** | The Users list should reflect real login users (from `auth_users.json`). Add user = create login; delete = remove from auth. No separate “users” list. |
| **Default mapping per user/role** | Let admin set “Default mapping” per user so they land on the right preset. |
| **Role‑based access** | Optional: restrict “BOM Compare” to certain roles; “Mapping Manager” and “Users” stay admin‑only. |

**Impact:** One source of truth for users and clear admin control.

---

## 8. Differentiation & “wow” features

| Feature | Why it justifies premium |
|--------|----------------------------|
| **Diff highlighting in table** | In “Different” rows, highlight the cells that differ (e.g. yellow background or bold) so users see the delta at a glance. |
| **Side‑by‑side row view** | Click a row to see BOM A vs BOM B values side‑by‑side in a modal with clear “same” / “different” labels. |
| **Comparison templates** | Save “comparison config”: mapping + optional filters. “Run template: PLM vs SAP” loads mapping and runs with one click when user uploads files. |
| **Email / share report** | Optional: “Email this report” (PDF) to a list of addresses (requires SMTP config). |

**Impact:** Diff highlighting and side‑by‑side view are visible differentiators in demos; templates and email appeal to power users.

---

## 9. Implementation priority (suggested order)

1. **Quick wins (1–2 weeks)**  
   - Toast notifications (success/error).  
   - Dashboard: welcome + last comparison summary + “Run demo” / “New compare”.  
   - Empty states on BOM Compare and Mapping Manager.

2. **Audit & history (2–3 weeks)**  
   - Comparison history (store metadata; optional file refs).  
   - Audit log (who ran compare, who changed mapping, etc.).  
   - Re‑export from history.

3. **Polish & scale (2–3 weeks)**  
   - Loading skeletons; export progress.  
   - Large file handling (progress indicator or background job).  
   - Diff highlighting in “Different” rows.

4. **Security & compliance (1–2 weeks)**  
   - Session timeout; stronger password rules.  
   - Audit log export (CSV).  
   - Rate limiting and HTTPS guidance.

5. **Premium reporting & admin**  
   - Executive summary PDF; Excel export.  
   - Users page synced with auth; default mapping per user.

Implementing **comparison history + audit log + dashboard + toasts** alone would already move the product toward a $10k narrative; adding **diff highlighting**, **Excel export**, and **session timeout** would strengthen the enterprise story further.
