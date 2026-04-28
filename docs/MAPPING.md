# Column mapping (BOM A ↔ BOM B)

## Do we need the mapper?

**Yes.** The compare engine needs to know:

1. **Which column in BOM A corresponds to which in BOM B**  
   (e.g. "Part Number" in one file ↔ "Material ID" in the other, "Qty" ↔ "Quantity"). Without this, the tool cannot align attributes for comparison.

2. **Which columns form the key** for matching rows (e.g. part number, plant, revision). The key is used to decide which row from BOM A pairs with which row in BOM B.

So for any two BOM formats (CSV, Excel, JSON, PLMXML), a mapping is required. Free users can **use** existing mappings (read-only); paid users and admins can **create, edit, and manage** mappings.

## Generic mapper (BOM A / BOM B)

The mapper is **generic**: it always means “first file” (BOM A) and “second file” (BOM B).

- **In the UI:** All labels use **BOM A** and **BOM B** (e.g. “Upload BOM A (sample)”, “BOM A column → BOM B column”, “Select BOM A Column”).
- **In saved files and API:** Mappings are stored with keys **`tc`** (BOM A) and **`sap`** (BOM B) for backward compatibility. The backend and frontend still use these keys internally; only the visible text is generic.

So “mapper” = **column mapping between BOM A and BOM B**; no product-specific names in the user-facing UI.

## Dynamic mapping (always on)

Mapping is **always built from the compare data** (the two files you upload):

1. On the **BOM Compare** page, upload BOM A and BOM B, then click **Validate BOMs**.
2. The app reads column names from both files (CSV, JSON, XLSX; for PLMXML it falls back to the saved active mapping if present).
3. It matches columns by **name** (case-insensitive) and uses the **first matched pair** as the key. Only columns that exist in **both** files are compared.
4. After the run, a **Column mapping** summary shows:
   - **Compared (available in both):** columns that were used for the comparison.
   - **Only in BOM A (not compared):** columns that had no matching name in BOM B.
   - **Only in BOM B (not compared):** columns that had no matching name in BOM A.

So you always see what was compared and what was missing; the comparison uses whatever is available.

**Presets (saved mappings):** If an admin wants to use a fixed mapping (preset), they can create and save it in **Mapping Manager**, set one as **active**, then on the BOM Compare page check **“Use saved mapping preset”**. The compare will then use that active preset instead of building a mapping from the file columns. Use presets when column names differ (e.g. “Part Number” vs “Material ID”) or when you want the same mapping for every run (e.g. PLMXML).
