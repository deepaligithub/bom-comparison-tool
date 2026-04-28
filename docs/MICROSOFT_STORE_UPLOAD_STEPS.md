# Upload BOM Compare Tool to Microsoft Store — Step-by-step

Follow these steps to publish the app to the **Microsoft Store** (Windows).

---

## Step 1: Create a developer account and app (one-time)

1. Go to **[Partner Center](https://partner.microsoft.com/dashboard/windows/overview)** and sign in with a **personal Microsoft account**.
2. Complete **Open a developer account** (one-time fee; see [Microsoft docs](https://learn.microsoft.com/en-us/windows/apps/publish/partner-center/open-a-developer-account)).
3. In Partner Center: **Apps and games** → **New product** → **MSIX or PWA app**.
4. Reserve your app name (e.g. **BOM Compare Tool**).
5. Go to **Product management** → **Product identity** and note:
   - **Publisher ID** (e.g. `CN=YourName-...`)
   - **Publisher display name**
   - **Package ID** (e.g. `BOMCompareTool`)

You will use these in Step 3.

---

## Step 2: Build the MSIX package

**Option A — One command (recommended):** From the **project root** in PowerShell:

```powershell
.\scripts\create-microsoft-store-package.ps1
```

This builds the app and creates **BOMCompareTool-MicrosoftStore** with the `.appx` and upload instructions. Upload the file from that folder.

**Option B — Manual build:** Run the Windows build, then copy the .appx yourself:

```powershell
.\scripts\build-windows-app.ps1
```

Output is in `electron\dist-electron\` (e.g. **BOM Compare Tool 1.0.0.appx**).

If you see *"file in use"* or *"app.asar"* locked: close any running BOM Compare Tool or Electron window, then run the script again.

**Prerequisites:** Node.js, Python 3, and:

```powershell
pip install pyinstaller waitress
```

The script will:

1. Build the React frontend  
2. Build the backend into `bom-backend.exe` (PyInstaller)  
3. Copy them into the Electron app  
4. Run Electron Builder and create the MSIX  

**Output location:**  
`electron\dist-electron\`

You should see: **`BOM Compare Tool 1.0.0.appx`** (for Microsoft Store) and **`BOM Compare Tool Setup 1.0.0.exe`** (NSIS installer for direct download).

---

## Step 3: Set Store identity in the app

Before submitting, the AppX package must use your Partner Center identity.

1. Open **`electron\package.json`**.
2. Find the **`build.appx`** section.
3. Set:

| Field | What to put |
|-------|---------------------|
| `identityName` | Your **Package ID** from Partner Center (e.g. `BOMCompareTool`) |
| `publisher` | Your **Publisher ID** (e.g. `CN=YourName-12345`) |
| `publisherDisplayName` | Your **Publisher display name** |

Example:

```json
"appx": {
  "identityName": "BOMCompareTool",
  "publisher": "CN=YourCompany-12345ABCD",
  "publisherDisplayName": "Your Company Name"
}
```

5. Save the file and **run the build again** (Step 2) so the new .appx has the correct identity.

**Reference — same publisher:** If you have another app already published under the same account (e.g. **Anamorphic Desqueeze Pro** at `C:\Users\Admin\Desktop\AssesteMS\AnamorphicDesqueezePro\AnamorphicDesqueezePro`), use the **same Publisher ID** for BOM Compare Tool. Get it from Partner Center: **Account** → **Developer settings** → **Publisher ID** (it’s the same for all apps on that account). Copy that value (e.g. `CN=...`) into `electron\package.json` → `build.appx.publisher`, then rebuild.

---

## Step 4: Submit in Partner Center

1. In **[Partner Center](https://partner.microsoft.com/dashboard/windows/overview)**, open your app (the one you reserved in Step 1).
2. Start a **new submission**.
3. Fill in:
   - **Pricing** (e.g. Free or Paid)
   - **Age rating** (complete the questionnaire)
   - **Description** (short and full description — ready-to-paste text in [STORE_DESCRIPTION_SEO.md](STORE_DESCRIPTION_SEO.md))
   - **Screenshots** (required; add at least one)
   - **Privacy policy URL** (required if the app uses data). Use the page in `privacy\index.html` (project root): host it on your site or GitHub Pages, then paste that URL here.
4. In **Packages**:
   - If you see an error like *"PublisherDisplayName ... is Your Publisher Display Name, which doesn't match ... Cinematics"*: **Delete** the failed package first (use the "Delete" link next to it).
   - Upload **only** the .appx from `electron\dist-electron\`: **BOM Compare Tool 1.0.0.appx**. Open that folder in Explorer and drag that file (or use "browse your files" and select it). Do **not** upload a copy from Desktop or Downloads—that may be an old build.
5. **Device family**: If you see "provide a package that supports each selected device family", go to **Device family availability** and ensure **PC** is checked (or uncheck Xbox/HoloLens if you are not targeting them).
6. Complete any other required fields, then **Submit for certification**.

Review usually takes **24–48 hours**. After approval, the app will appear in the Microsoft Store.

---

## Quick reference

| Step | Where | What |
|------|--------|------|
| 1 | [Partner Center](https://partner.microsoft.com/dashboard/windows/overview) | Create account, reserve app, copy Publisher ID and Package ID |
| 2 | Project root (PowerShell) | `.\scripts\build-windows-app.ps1` → MSIX in `electron\dist-electron\` |
| 3 | `electron\package.json` → `build.appx` | Set `publisher`, `publisherDisplayName`, `identityName`; rebuild |
| 4 | Partner Center → your app → New submission | Upload .appx, add description/screenshots/privacy, submit |

For more options (PWA, packaging alternatives), see **WINDOWS_STORE.md** in the project root.
