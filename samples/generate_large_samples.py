#!/usr/bin/env python3
"""
Generate large BOM sample files (1000 rows) for testing.
Output: bom_a_1000.csv, bom_b_1000.csv (same column mapping as sample_01).
Use these to verify the app works with 1000+ line BOMs (and is suitable for 10000).
"""
import csv
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DESCRIPTIONS = (
    "Bracket", "Bolt", "Washer", "Nut", "Screw", "Pin", "Clip", "Gasket",
    "Seal", "Bushing", "Spacer", "Shim", "Plate", "Cover", "Housing", "Shaft",
    "Gear", "Bearing", "Spring", "Grommet", "Plug", "Cap", "Filter", "Valve",
)
COLORS = ("Silver", "Zinc", "Steel", "Black", "Gray", "Natural", "Brass", "Chrome")
UOM = "EA"
PLANTS = ("P01", "P02", "P03")
REVISIONS = ("A", "B", "C")


def gen_rows(n, start_id=1001, qty_diff_indices=None):
    """Generate n data rows. If qty_diff_indices (set/list of 0-based indices), those rows have qty+1 in B (Different)."""
    if qty_diff_indices is not None and not isinstance(qty_diff_indices, (set, list)):
        qty_diff_indices = {qty_diff_indices}
    qty_diff_indices = set(qty_diff_indices or [])
    rows = []
    for i in range(n):
        part_id = start_id + i
        plant = PLANTS[i % len(PLANTS)]
        rev = REVISIONS[i % len(REVISIONS)]
        desc = DESCRIPTIONS[i % len(DESCRIPTIONS)]
        qty = (i % 99) + 1
        if i in qty_diff_indices:
            qty += 1
        color = COLORS[i % len(COLORS)]
        rows.append((part_id, plant, rev, desc, qty, color))
    return rows


def write_bom_a(rows, path):
    header = ["part number", "plant", "revision", "description", "quantity", "uom", "color"]
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(header)
        for r in rows:
            w.writerow([f"PN{r[0]}", r[1], r[2], r[3], r[4], UOM, r[5]])


def write_bom_b(rows, path, extra_rows=None):
    header = ["material number", "plant code", "revision level", "description", "quantity", "base unit", "color"]
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(header)
        for r in rows:
            w.writerow([f"PN{r[0]}", r[1], r[2], r[3], r[4], UOM, r[5]])
        if extra_rows:
            for r in extra_rows:
                w.writerow([f"PN{r[0]}", r[1], r[2], r[3], r[4], UOM, r[5]])


def main():
    n = 1000
    # BOM A: PN1000 (only in A) + PN1001..PN2000 = 1001 rows — so first row is "Source BOM only"
    rows_a_only_first = gen_rows(1, start_id=1000)   # PN1000 only in A
    rows_a_rest = gen_rows(n)                         # PN1001..PN2000
    rows_a_final = rows_a_only_first + rows_a_rest

    # 5 Different rows: 1 at top (index 1 = PN1002), then at indices 100, 300, 500, 750
    qty_diff_indices = {1, 100, 300, 500, 750}

    # BOM B: PN999 (only in B) + PN1001..PN1998 with 5 qty diffs at the indices above + PN2001, PN2002 (only in B)
    rows_b_only_first = gen_rows(1, start_id=999)    # PN999 only in B
    rows_b_matching = gen_rows(998, qty_diff_indices=qty_diff_indices)  # 5 Different: PN1002, PN1101, PN1301, PN1501, PN1751
    rows_b_extra = gen_rows(2, start_id=2001)       # PN2001, PN2002 (only in B)
    rows_b_final = rows_b_only_first + rows_b_matching + rows_b_extra  # 1001 rows in B

    path_a = os.path.join(SCRIPT_DIR, "bom_a_1000.csv")
    path_b = os.path.join(SCRIPT_DIR, "bom_b_1000.csv")
    write_bom_a(rows_a_final, path_a)
    write_bom_b(rows_b_final, path_b)
    print(f"Wrote {path_a} ({len(rows_a_final)} rows)")
    print(f"Wrote {path_b} ({len(rows_b_final)} rows)")
    print("Demo: 5 Different (qty mismatch) — 1 at top: PN1002; others: PN1101, PN1301, PN1501, PN1751.")


if __name__ == "__main__":
    main()
