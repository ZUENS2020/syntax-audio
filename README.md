<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1J8fT9Dq46SOx2zEImLDKu0Eg-k0Lvkv0

## Run Locally

**Prerequisites:**  Node.js

1. Install dependencies:
   `npm install`
2. (Optional) No external AI provider is required for the desktop build. Skip API key setup.
3. Run the app:
   `npm run dev`

## Desktop (Electron) Development & Build

- Start the app in Electron dev mode (requires `npm install` to complete successfully):

```bash
npm run electron:dev
```

- Build a distributable Windows EXE (after a successful `npm install`):

```bash
npm run build:electron
```

If local `npm install` cannot download the Electron binary (certificate/proxy issues), use the provided GitHub Actions workflow to produce the Windows installer remotely:

- Go to the repository Actions tab and run the "Build Windows EXE" workflow manually (or push a commit), then download the `windows-installer` artifact from the workflow run.

Troubleshooting tips:

- If `npm install` errors while downloading the Electron binary (e.g. "unable to verify the first certificate"), you can:
  - Retry on a network that allows TLS downloads from GitHub; or
  - Configure npm to use your company CA if behind a corporate proxy; or
  - Use the GitHub Actions workflow to build and retrieve the installer instead of building locally.

I added the workflow `.github/workflows/build-windows.yml` which runs on-demand via the Actions UI and uploads the produced installer as an artifact.

