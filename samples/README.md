# Sample BOM files (Source BOM ↔ Target BOM compare)

Use these files with the **BOM Compare** page. The tool is generic: you compare a **Source BOM** (first file) vs a **Target BOM** (second file).

## Naming

- **`bom_a_*`** → use as the **Source BOM** (first upload).
- **`bom_b_*`** → use as the **Target BOM** (second upload).

## Pairs (use same number for A and B)

| Source BOM (bom_a_*)   | Target BOM (bom_b_*)   | Result / purpose        |
|-----------------------|------------------------|-------------------------|
| bom_a_sample_01.csv   | bom_b_sample_01.csv    | All matched             |
| bom_a_sample_02.csv   | bom_b_sample_02.csv    | All matched             |
| bom_a_sample_03.json  | bom_b_sample_03.json   | All matched (JSON)      |
| bom_a_sample_04_wrapped.json | bom_b_sample_04_wrapped.json | All matched (`{ "rows": [...] }`) |
| bom_a_sample_05_diff.csv   | bom_b_sample_05_diff.csv   | One row **Different** (qty 5 vs 6) |
| bom_a_sample_06_tc_only.csv | bom_b_sample_06_tc_only.csv | **Source BOM only** + **Target BOM only** rows |
| bom_a_sample_07_plants.csv  | bom_b_sample_07_plants.csv  | Multi-plant / duplicate handling |
| bom_a_sample_08_minimal.csv | bom_b_sample_08_minimal.csv | For minimal mapping (part_number, qty only) |
| bom_a_sample_09.plmxml      | bom_b_sample_09.csv        | PLMXML as Source BOM, CSV as Target BOM |
| bom_a_sample_10.json        | bom_b_sample_10.json       | All matched (JSON)      |
| **bom_a_1000.csv**          | **bom_b_1000.csv**         | **1000 rows** – 997 Matched, 1 Different, 2 BOM A only, 2 BOM B only |

## Demo / large samples (1000 rows) — shipped with app

- **bom_a_1000.csv** and **bom_b_1000.csv** – **1000 data rows each**. These are the **built-in demo** used when you click **Run demo** in the app (no upload). Same column layout as sample_01. Use them to verify the app with large BOMs; the app supports **up to ~10,000 lines** per BOM (subject to the 10 MB upload limit).
- To regenerate the 1000-row files:  
  `python samples/generate_large_samples.py`

## Formats

- **Source BOM** accepts: `.csv`, `.xlsx`, `.json`, `.plmxml`
- **Target BOM** accepts: `.csv`, `.xlsx`, `.json`

Column names in these samples match the default active mapping (e.g. `part number` / `material number`, `plant` / `plant code`, `description`, etc.). Result columns appear as **BOM_A_*** and **BOM_B_*** in the comparison table. If your active mapping uses different column names, adjust the CSV/JSON headers or pick the mapping that fits these samples.
