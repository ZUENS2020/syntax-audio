const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const isDev = require('electron-is-dev');

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  });

  if (isDev) {
    win.loadURL('http://localhost:3000');
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(process.cwd(), 'dist', 'index.html'));
  }

  // Open devtools in production when DEBUG_ELECTRON=1 (for debugging installed app)
  if (process.env.DEBUG_ELECTRON === '1') {
    try { win.webContents.openDevTools(); } catch (e) {}
  }

  // Capture renderer console messages and write to userData log file
  const logFile = path.join(app.getPath('userData'), 'renderer.log');
  win.webContents.on('console-message', (event, level, message, line, sourceId) => {
    const entry = `[console-${level}] ${sourceId}:${line} ${message}\n`;
    try { fs.appendFileSync(logFile, entry); } catch (e) {}
  });

  win.webContents.on('crashed', (event) => {
    const entry = `[crash] renderer crashed at ${new Date().toISOString()}\n`;
    try { fs.appendFileSync(logFile, entry); } catch (e) {}
  });
}

app.whenReady().then(() => {
  ipcMain.handle('fetch-url', async (_, url) => {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Status ${res.status}`);
      return await res.text();
    } catch (err) {
      console.error('fetch-url error', err);
      throw String(err);
    }
  });

  createWindow();

  // Listen for renderer error reports from preload
  ipcMain.on('renderer-error', (_, info) => {
    const logFile = path.join(app.getPath('userData'), 'renderer.log');
    const entry = `[renderer-error] ${new Date().toISOString()} ${JSON.stringify(info)}\n`;
    try { fs.appendFileSync(logFile, entry); } catch (e) {}
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

process.on('uncaughtException', (err) => {
  const logFile = path.join(app.getPath('userData'), 'main.log');
  const entry = `[uncaughtException] ${new Date().toISOString()} ${String(err)}\n`;
  try { fs.appendFileSync(logFile, entry); } catch (e) {}
});
