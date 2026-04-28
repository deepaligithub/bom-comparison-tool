# BOM Compare Tool

Compare two Bills of Material (Source BOM ↔ Target BOM) in CSV, Excel, JSON, or PLMXML. Mapping is built from file columns by default; admins can create saved presets in Mapping Manager.

## Quick start

**Windows package (recommended):** If you have a package (e.g. BOMCompareTool-Package or -Delivery), **double-click `BOMCompareTool.exe`**. No install—the app starts and your browser opens. If something goes wrong (e.g. port in use), a **popup message** explains the issue. See **[docs/INSTALLATION.md](docs/INSTALLATION.md)** for details.

**From source:** Double-click **`RUN.bat`** in the project root to install backend and frontend dependencies and start both servers; the app opens at http://localhost:3000. (Requires Python 3.9+ and Node.js on your PATH.)

**Or run manually:**

1. **Backend:** From the `backend` folder, install dependencies and start the API:
   ```bash
   cd backend
   pip install -r requirements.txt
   python run.py
   ```
   Backend runs at [http://localhost:5000](http://localhost:5000).

2. **Frontend:** From the `frontend` folder, install and start the UI:
   ```bash
   cd frontend
   npm install
   npm start
   ```
   App opens at [http://localhost:3000](http://localhost:3000).

3. **Use the app:** Log in (default admin: `admin` / `admin`), upload Source BOM and Target BOM, then click **Validate BOMs**. Results and column mapping (compared vs missing) appear below.

**Documentation:** (sources in `docs/*.md`; run `npm run generate-docs-pdf` to build all as **PDF** in `docs/`)

- **Installation & troubleshooting:** **[docs/INSTALLATION.md](docs/INSTALLATION.md)** – Windows package (exe: click and go; popup on error), run.bat, manual run, production, Electron, port-in-use.
- **[How to use](docs/HOW_TO_USE.md)** – Login, compare BOMs, filters, export, Mapping Manager.
- **[Combined Install + Use guide](docs/BOM_Compare_Tool_Install_and_Use_Guide.html)** – Professional guide (HTML; generated as PDF by `generate-docs-pdf`).
- [docs/FEATURES_FREE_PAID.md](docs/FEATURES_FREE_PAID.md) – Plans and features.
- [docs/MAPPING.md](docs/MAPPING.md) – Mapping and presets.

**Generate all documentation as PDF** (from project root):
```powershell
npm install          # once: installs md-to-pdf, puppeteer
npm run generate-docs-pdf   # creates docs/*.pdf and docs/BOM_Compare_Tool_Install_and_Use_Guide.pdf
```
Then `docs/` contains every guide in PDF format. The upload and delivery packagers run this step automatically and include all PDFs.

**Create packages** (app + all docs in PDF, in the same folder):
```powershell
# Upload package (for upload/distribution)
.\scripts\create-upload-package.ps1                    # folder: BOMCompareTool-Package/
.\scripts\create-upload-package.ps1 -StandaloneExe      # + BOMCompareTool.exe (no Python required)
.\scripts\create-upload-package.ps1 -CreateZip         # + zip

# Delivery package (for delivery to end users)
.\scripts\create-delivery-package.ps1 -StandaloneExe   # include BOMCompareTool.exe
.\scripts\create-delivery-package.ps1 -CreateZip       # + zip

# Microsoft Store upload package (Electron + .appx)
.\scripts\create-microsoft-store-package.ps1            # builds app, creates BOMCompareTool-MicrosoftStore/ with .appx + instructions
```
See **[docs/MICROSOFT_STORE_UPLOAD_STEPS.md](docs/MICROSOFT_STORE_UPLOAD_STEPS.md)** for Partner Center submission steps.

**Standalone EXE only** (no package folder):
```powershell
.\scripts\build-standalone-exe.ps1                     # outputs backend\dist\bom-backend.exe
.\scripts\build-standalone-exe.ps1 -OutputDir .\Release # copies as BOMCompareTool.exe to Release\
```

---

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

# Steps to run the project (detailed)
-> To run the project you need to install Node.js (LTS version), python.
-> After installing python you need to set "System Variable" "path" value. Add these 2 variables to "Path" : 
  1) C:\Users\<your-user>\AppData\Local\Programs\Python\Python311\
  2) C:\Users\<your-user>\AppData\Local\Programs\Python\Python311\Scripts\
-> For the first time you need to run the command "npm install" in "frontend" folder only, it will install all the package.json dependencies.
then run "npm start" to start the server.
-> Go to "backend" folder in terminal and activate python virtual enviornment using command "venv\Scripts\activate"
-> then in "backend" folder run command "pip install -r requirements.txt" to install flask.
-> start backend using command "python run.py"
-> in local browser execute URL "http://localhost:5000/api/" it sould show msg "Flask API is running!"
  or in postman send POST http://localhost:5000/api/compare with two Files "tcFile" and "sapFile" as arguments.

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)
