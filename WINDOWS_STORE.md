# Publishing BOM Compare Tool to the Microsoft Store (Windows)

This guide covers how to publish the BOM Compare Tool to the **Microsoft Store** on Windows. Your app has a **React frontend** and a **Flask backend**, so you can choose one of two paths.

---

## Recommended: Desktop app (implemented)

The **Electron desktop app** is implemented in this repo. It runs the Flask backend and React frontend locally—no server or hosting required. You get an installer (NSIS) and an **MSIX** package suitable for the Microsoft Store.

### Build the Windows app (one script)

From the **project root** (PowerShell):

```powershell
.\scripts\build-windows-app.ps1
```

**Prerequisites:** Node.js, Python 3, and `pip install pyinstaller waitress` (or use `backend/venv`). The script will:

1. Build the React frontend (`frontend/build`)
2. Build the backend into a single exe with PyInstaller (`backend/dist/bom-backend.exe`)
3. Copy both into `electron/resources/`
4. Run Electron Builder to produce installers and MSIX in `electron/dist-electron/`

### Run in development (without building exe)

1. Build the frontend once: `cd frontend && npm run build`
2. Install backend deps: `cd backend && pip install waitress` (and use venv if you have one)
3. Run Electron: `cd electron && npm install && npm start`

Electron will start the backend with `python backend/run_production.py` and open a window to `http://127.0.0.1:5000`.

### Submit the MSIX to the Store

After running the build script, in `electron/dist-electron/` you will have:

- **MSIX** (e.g. `BOM Compare Tool 1.0.0.msix`) for the Microsoft Store
- **NSIS installer** for direct distribution

Before submitting, update **Publisher** and **identity** in `electron/package.json` under `build.msix` to match your [Partner Center](https://partner.microsoft.com/dashboard/windows/overview) app reservation (Publisher ID, Publisher display name, Package ID). Then submit the MSIX in Partner Center as described in **Path B** below.

---

## Choose your path

| Path | Best when | Summary |
|------|------------|--------|
| **A. PWA** | The app is **hosted on a URL** (e.g. company server, Azure). | Store app opens your hosted site in a window. No local Python. |
| **B. Desktop (MSIX)** ✅ **Implemented** | App runs **fully on the user’s PC**. | Use the Electron build above; submit the generated MSIX to the Store. |

---

## Path A: PWA to Microsoft Store (hosted app)

Your app must be **live at a public URL** (e.g. `https://bomcompare.yourcompany.com`). The Store app is a wrapper that opens that URL in a window.

### 1. Deploy the app to a URL

- Build the frontend: from `frontend/` run `npm run build`.
- Deploy the **backend** (Flask) and the **frontend** (contents of `frontend/build`) to the same host (or configure CORS and API base URL if they’re on different domains).
- Ensure the site is served over **HTTPS** and the **root URL** loads your app (e.g. `/` serves `index.html` for client-side routing).

### 2. PWA-ready assets (already in this repo)

- **Manifest**: `frontend/public/manifest.json` is set up with name, description, and icons.
- **Icons**: Microsoft Store / PWA Builder expect at least:
  - **192×192 px** PNG → put in `frontend/public/logo192.png`
  - **512×512 px** PNG → put in `frontend/public/logo512.png`  
  If these are missing, add them (e.g. export from your logo or use [PWA Asset Generator](https://www.pwabuilder.com/imageGenerator)).
- Rebuild the frontend after adding or changing icons/manifest.

### 3. Developer account and app reservation

1. **Windows Developer account**
   - Go to [Partner Center](https://partner.microsoft.com/dashboard/windows/overview).
   - Sign in with a **personal Microsoft account** (not work/school).
   - Complete [Open a developer account](https://learn.microsoft.com/en-us/windows/apps/publish/partner-center/open-a-developer-account) (one-time fee applies unless a promotion is active).

2. **Create an app reservation**
   - In Partner Center: **Apps and games** → **New product** → **MSIX or PWA app**.
   - Reserve your app name (e.g. “BOM Compare Tool”).
   - Go to **Product management** → **Product identity** and copy:
     - **Publisher display name**
     - **Publisher ID**
     - **Package ID**  
   You will need these in PWA Builder.

### 4. Package with PWA Builder

1. Open [PWA Builder](https://www.pwabuilder.com/).
2. Under **Ship your PWA to app stores**, enter your **live app URL** (e.g. `https://bomcompare.yourcompany.com`) and click **Start**.
3. Fix any **Action items** (e.g. manifest, icons, HTTPS, service worker if required).
4. When the report shows the PWA is **store-ready**, click **Package for stores**.
5. For **Windows**:
   - Click **Generate package**.
   - In **Windows Package Options**, paste:
     - Publisher ID  
     - Publisher display name  
     - Package ID  
   - Click **Download package**.

You get a ZIP containing:

- `.msixbundle` (main package for the Store)
- `.classic.appxbundle` (for older Windows versions)

### 5. Submit in Partner Center

1. In [Partner Center](https://partner.microsoft.com/dashboard/windows/overview), open your app.
2. Start a **new submission**.
3. Fill in **Pricing**, **Age rating**, **Description**, **Screenshots**, etc.
4. On **Packages**:
   - Upload the **.msixbundle**.
   - Upload the **.classic.appxbundle**.
5. Submit for certification. Review usually takes about **24–48 hours**.

After approval, the app will appear in the Microsoft Store and users can install it like any other Store app; it will open your hosted URL in an app window.

---

## Path B: Desktop app (MSIX) for Microsoft Store — implemented

Use the **Electron build** described at the top of this document. Summary:

1. **Build:** Run `.\scripts\build-windows-app.ps1` from the repo root. This produces the MSIX in `electron/dist-electron/`.
2. **Configure Store identity:** In `electron/package.json`, under `build.msix`, set:
   - `publisher` — from Partner Center Product identity (e.g. `CN=YourName`).
   - `publisherDisplayName` — your display name.
   - `identityName` / Package ID — from Partner Center.
3. **Submit:** In [Partner Center](https://partner.microsoft.com/dashboard/windows/overview), create an app reservation (**New product** → **MSIX or PWA app**), then in your submission upload the **.msix** (or **.msixbundle**) from `electron/dist-electron/`. Fill in description, screenshots, age rating, and privacy policy URL.

### Option B2: Package existing DeploymentPackage (alternative)

Your repo has a **DeploymentPackage** (e.g. `bomvalidator.pyz`, `run_check.ps1`, `static/`, `site/`). You can:

- Use the **MSIX Packaging Tool** or **Advanced Installer** to:
  - Install or bundle Python (or rely on a preinstalled runtime),
  - Copy your package files,
  - Run your launcher script and optionally open the browser to `http://localhost:5000`.
- This produces an MSIX you can submit to the Store **only if** it complies with [Store policies](https://learn.microsoft.com/en-us/windows/apps/publish/store-policies) (e.g. no forced installs of unrelated software, clear use of runtime). Packaging a custom Python stack can be more work and may require a **classic desktop** submission path depending on policy.

---

## Checklist before submission (either path)

- [ ] App runs correctly at the submitted URL (PWA) or from the installed package (desktop).
- [ ] **Privacy policy** URL added in Partner Center (required for Store).
- [ ] **192×192** and **512×512** PNG icons in place and referenced in the manifest (PWA).
- [ ] **Screenshots** and **description** filled in Partner Center.
- [ ] **Age rating** and **Pricing** (e.g. Free) set.

---

## Useful links

- [Publish a PWA to the Microsoft Store (Microsoft Learn)](https://learn.microsoft.com/en-us/microsoft-edge/progressive-web-apps/how-to/microsoft-store)
- [PWA Builder](https://www.pwabuilder.com/)
- [Partner Center – Windows apps](https://partner.microsoft.com/dashboard/windows/overview)
- [Open a developer account](https://learn.microsoft.com/en-us/windows/apps/publish/partner-center/open-a-developer-account)
- [Store policies](https://learn.microsoft.com/en-us/windows/apps/publish/store-policies)

---

## Quick summary

- **Hosted app (simplest for Store):** Deploy backend + frontend to HTTPS → add `logo192.png` and `logo512.png` → PWA Builder with your URL → use Publisher ID and Package ID → download Windows package → submit both bundles in Partner Center.
- **Fully local app:** Wrap with Electron (or similar), build MSIX with electron-builder, then submit that package in Partner Center under your app reservation.
