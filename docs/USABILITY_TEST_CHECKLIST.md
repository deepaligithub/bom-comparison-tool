# BOM Compare Tool – Usability Test Checklist

Use this checklist to test all main functions from a **usability** point of view. Run the app (backend on port 5000, frontend on 3000), then go through each section.

---

## 1. Login & navigation

- [ ] Open http://localhost:3000 and see the login page.
- [ ] Log in with `admin` / `admin`; land on BOM Compare page.
- [ ] Navbar shows: BOM Compare, Mapping Manager (or equivalent), Users (admin), Logout.
- [ ] Click each nav item; pages load without errors.

---

## 2. BOM Compare (main flow)

- [ ] **Upload:** Choose BOM A file (CSV/Excel/JSON); name appears. Choose BOM B; name appears.
- [ ] **Preset hint:** See “Use saved mapping preset” and the note “(Active mapping keys narrow results; columns from mapping.)”.
- [ ] **With preset off:** Uncheck “Use saved mapping preset”. Click **Validate BOMs**. Comparison runs (or shows a clear error if no active mapping / missing files).
- [ ] **With preset on:** Check “Use saved mapping preset”; ensure “Active: &lt;name&gt;” or “No active preset” is shown. Run **Validate BOMs**.
- [ ] **Results:** Summary pills (Total, Matched, Different, BOM A only, BOM B only) and table appear. “Column mapping” section explains compared vs only-in-A/B.
- [ ] **Filters:** Click each status pill; table filters correctly.
- [ ] **Row detail:** Click a row; detail modal opens and shows BOM A vs BOM B values.
- [ ] **Review Ignored:** If there are ignored items, open “Review Ignored Items”; list is understandable.
- [ ] **Export:** If paid, Export CSV/PDF works. If free, upgrade prompt appears.
- [ ] **Reset:** Reset clears files and results as expected.

---

## 3. Mapping Manager – list & presets

- [ ] Go to **Mapping Manager** (or Load Mapping page).
- [ ] **Empty install:** If mappings folder is empty, after first load you see **5 default presets**: Default_Single_Key_Part_Material, Default_2_Keys_Part_Plant, Default_3_Keys_Part_Plant_Revision, Default_4_Keys, Default_5_Keys. One is marked active (e.g. Single key).
- [ ] List shows filename, created/updated date, and active state for each mapping.

---

## 4. Mapping Manager – load, set active, delete

- [ ] Click a mapping to **load** it; details (keys and non-keys) are visible.
- [ ] **Set active:** Set a different mapping as active; only one is active; UI updates.
- [ ] **Delete:** Delete a non-active mapping; it disappears from the list. Active mapping cannot be deleted (error or disabled).

---

## 5. Add Mapping (create new mapper)

- [ ] Open **Add Mapping** (or equivalent).
- [ ] **UI Mapping tab:** Upload a small BOM A and BOM B sample; columns appear in dropdowns. Map at least one key (e.g. Part Number ↔ Material Number) and one non-key. Save.
- [ ] **Name:** New mapping appears in the list with a name like `ui_mapping_YYYYMMDD_HHMMSS.json`.
- [ ] **Manual Mapping tab:** Switch to Manual; paste or enter mapping (e.g. tc,sap,isKey rows). Parse/Save. New mapping appears like `manual_mapping_YYYYMMDD_HHMMSS.json`.
- [ ] No limit on how many mappings can be created (create 2–3 and confirm all appear).

---

## 6. Edit mapping (rename / change fields)

- [ ] From Mapping Manager, open a mapping for edit (e.g. “Edit” or “Rename”).
- [ ] Change filename to a logical name (e.g. `My_BOM_Mapping.json`); save. List shows new name.
- [ ] Change a key or non-key pair; save. Reload mapping; changes persist.

---

## 7. Keys and columns (usability)

- [ ] On Add Mapping page, key vs non-key is explained (e.g. “Key = match rows; non-key = compare & display” or tooltip).
- [ ] After a compare, “Column mapping” section states that columns follow the active mapping and keys narrow results.
- [ ] With a 1-key preset active, run compare; results match on that key. With a 2-key preset, same; matching feels consistent with the chosen preset.

---

## 8. Error and edge cases

- [ ] Compare without selecting both files: clear error message.
- [ ] Compare with “Use saved preset” on but no active mapping: clear message (e.g. set active or turn off preset).
- [ ] Upload unsupported format: clear error.
- [ ] Save mapping with no key or duplicate columns: validation error or message.

---

## 9. Quick automated checks (backend)

From project root:

```powershell
cd backend
python -m unittest tests.test_routes -v
```

- [ ] All tests pass (health, compare2 validation, mappings list seeds 5 presets when empty, list with existing file does not reseed).

---

## Sign-off

- Tester: ________________  
- Date: ________________  
- Build/version: ________________  
- Notes: ________________  
