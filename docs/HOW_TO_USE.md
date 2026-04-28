# BOM Compare Tool – How to Use

This guide walks you through using the BOM Compare Tool: logging in, comparing two BOMs, viewing results, and using optional features like Mapping Manager and export.

---

## Running the app

Start the app using **BOMCompareTool.exe** (double‑click) or **run.bat** from your package or project. The app usually **opens in your browser automatically**. If it doesn’t, use the address shown in the window when you started it. For full options and troubleshooting, see **[INSTALLATION.md](INSTALLATION.md)**.

---

## 1. Log in

1. Open the app in your browser. (If you just started the app, it may already be open; otherwise use the address that was shown when you started it.)
2. On the login page, enter:
   - **Username:** `admin`
   - **Password:** `admin`
3. Click **Log in**.

Default credentials can be changed by editing `backend/uploads/auth_users.json` (see [FEATURES_FREE_PAID.md](FEATURES_FREE_PAID.md)).

---

## 2. Compare two BOMs (main workflow)

### 2.1 Upload Source and Target BOMs

- **Source BOM** = first file (e.g. from your PLM or source system).
- **Target BOM** = second file (e.g. from SAP or target system).

Steps:

1. On the **BOM Compare** page, use the two upload areas:
   - **Upload Source BOM** – choose the first file (CSV, Excel, JSON, or PLMXML).
   - **Upload Target BOM** – choose the second file (CSV, Excel, or JSON).
2. Ensure both files are selected (names shown next to the buttons).

**Supported formats:**

| Format   | Source BOM | Target BOM |
|----------|------------|------------|
| CSV      | Yes        | Yes        |
| Excel (.xlsx) | Yes   | Yes        |
| JSON     | Yes        | Yes        |
| PLMXML   | Yes        | No         |

### 2.2 Optional: Use a saved mapping preset

If an admin has created a **saved mapping** (preset) in Mapping Manager and set it as **active**:

- Check **“Use saved mapping preset”** before comparing.
- The tool will use that preset instead of building a mapping from column names. Use this when column names differ between files (e.g. “Part Number” vs “Material ID”) or for PLMXML.

If you leave this **unchecked**, the tool builds a mapping from the file headers by matching column names (case-insensitive) and uses the first matched pair as the key.

### 2.3 Run the comparison

1. Click **Validate BOMs** (or press **Ctrl+Enter**).
2. Wait for the run to finish. The page will scroll to the results section.

### 2.4 Understand the results

After the run you’ll see:

- **Summary** – Total rows, and counts for **Matched**, **Different**, **Source BOM only**, **Target BOM only**.
- **Column mapping** – Which columns were compared, which exist only in the Source BOM, and which only in the Target BOM.
- **Results table** – One row per key (e.g. part number + plant). Columns show:
  - **BOM_A_*** and **BOM_B_*** values side by side.
  - **Status:** Matched, Different, Source BOM only, or Target BOM only.

**Filters (tabs above the table):**

- **All** – Show all rows.
- **Matched** – Rows that exist in both and match.
- **Different** – Rows that exist in both but have different values.
- **BOM A only** – Rows only in BOM A.
- **BOM B only** – Rows only in BOM B.

Use the **search** box to filter rows by any visible column. Use **Columns ▾** to show or hide columns in the table.

### 2.5 Row details

Click the **info (ℹ)** button on a row to open a detail view with full Source and Target BOM data for that key.

---

## 3. Export results (paid plan)

If your account has **Export** (paid plan or admin):

- **Export CSV** – Downloads the current (filtered) comparison results as CSV.
- **Export PDF** – Downloads the current results as a PDF table.

Buttons are in the toolbar above the results table. While export runs, you may see a short “Preparing…” state.

---

## 4. Ignored rows and columns

The comparison may **ignore** some rows (e.g. duplicates, missing keys) or **skip** some columns (only in one file). To inspect them:

1. Use the **Ignored** area (e.g. “X ignored” link or section).
2. Switch between **Duplicates**, **Missing Keys**, and **Skipped Columns**.
3. Optionally **Export** the ignored rows as CSV from that section.

---

## 5. Mapping Manager (paid plan or admin)

**Mapping Manager** lets you create, edit, and activate **saved mappings** (presets) so you can compare files with different column names or use a fixed mapping (e.g. for PLMXML).

### 5.1 Open Mapping Manager

- In the navbar, click **Mapping Manager** (or go to **/admin/mapping**).

### 5.2 Create a mapping

1. Click **Create Mapping**.
2. **UI Mapping:**
   - Upload a sample BOM A and BOM B (or use samples from the `samples/` folder).
   - Map BOM A columns to BOM B columns and set the key columns.
   - Save with a name.
3. **Manual Mapping:**
   - Write or paste mapping lines in the form: `BOM A column → BOM B column`.
   - Save with a name.

### 5.3 Set active preset

1. Go to **Manage Mappings**.
2. Find the mapping you want and set it as **Active**.
3. On the BOM Compare page, check **“Use saved mapping preset”** and run **Validate BOMs** to use that preset.

---

## 6. Change password

1. Click your **username** in the top-right (navbar).
2. Choose **Change password**.
3. Enter **Current password**, **New password**, and **Confirm new password**.
4. Submit. Passwords are stored hashed in `backend/uploads/auth_users.json`.

---

## 7. Users page (admin only)

If you are logged in as **admin**, you’ll see a **Users** link in the navbar. There you can:

- View existing users and their plan (free/paid).
- Change a user’s plan (e.g. set to paid) if your app supports it via the UI or API.

See [FEATURES_FREE_PAID.md](FEATURES_FREE_PAID.md) for plans and upgrading users.

---

## 8. Sample files

The project includes sample BOM files in the **`samples/`** folder:

- **bom_a_*** – use as BOM A.
- **bom_b_*** – use as BOM B.

Use the same number for a pair (e.g. `bom_a_sample_01.csv` with `bom_b_sample_01.csv`). See **samples/README.md** for the list and what each pair demonstrates (all matched, differences, BOM A only, etc.).

---

## Quick reference

| Task              | Where / How |
|-------------------|-------------|
| Log in            | Login page → admin / admin |
| Compare BOMs       | BOM Compare → Upload A & B → Validate BOMs |
| Filter results    | Tabs: All, Matched, Different, BOM A only, BOM B only |
| Search in table   | Search box above the table |
| Show/hide columns | Columns ▾ button |
| Row details       | ℹ button on a row |
| Export CSV/PDF    | Toolbar above table (paid) |
| Saved mapping     | Mapping Manager → Create / Manage → set Active; then “Use saved mapping preset” on BOM Compare |
| Change password   | Navbar → username → Change password |
| Users (admin)     | Navbar → Users |

---

For installation, see **[INSTALLATION.md](INSTALLATION.md)**. For mapping details, see **[MAPPING.md](MAPPING.md)**.
