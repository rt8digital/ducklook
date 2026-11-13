import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

app.setName('DuckLook');

let mainWindow: BrowserWindow | null = null;
let apiModule: typeof import('../server/api.ts');

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);

function isExternalHttp(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function registerIpcHandlers() {
  ipcMain.handle('api:invoke', async (_event, payload) => {
    return apiModule.handleApiCall(payload);
  });

  ipcMain.handle('attachment:save', async (_event, payload: { messageId: string; attachmentId: string }) => {
    const attachment = apiModule.getAttachment(payload.messageId, payload.attachmentId);
    if (!attachment) throw new Error('Attachment not found');

    const { canceled, filePath } = mainWindow
      ? await dialog.showSaveDialog(mainWindow, {
          title: 'Save attachment',
          defaultPath: path.join(app.getPath('downloads'), attachment.filename),
        })
      : await dialog.showSaveDialog({
          title: 'Save attachment',
          defaultPath: path.join(app.getPath('downloads'), attachment.filename),
        });

    if (canceled || !filePath) return { saved: false };
    fs.writeFileSync(filePath, Buffer.from(attachment.contentBase64 ?? '', 'base64'));
    return { saved: true, path: filePath };
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 620,
    show: false,
    backgroundColor: '#F5F5F5',
    title: 'DuckLook',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow?.show());

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isExternalHttp(url)) shell.openExternal(url).catch(() => undefined);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const current = mainWindow?.webContents.getURL() ?? '';
    if (url !== current && isExternalHttp(url)) {
      event.preventDefault();
      shell.openExternal(url).catch(() => undefined);
    }
  });

  if (isDev) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL as string);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    await mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

// Copy a pre-rebrand "Outlook Desktop" database the first time DuckLook starts,
// so existing local mail survives the rename. Only applies to the default data
// directory; a custom DUCKLOOK_DATA_DIR is used as-is.
function migrateLegacyDatabase(dataDir: string) {
  const target = path.join(dataDir, 'ducklook.db');
  if (fs.existsSync(target)) return;

  const legacyDirs = [
    path.join(app.getPath('appData'), 'Outlook Desktop', 'data'),
    path.join(app.getPath('appData'), 'outlook-desktop', 'data'),
  ];

  for (const legacyDir of legacyDirs) {
    const legacyDb = path.join(legacyDir, 'outlook.db');
    if (!fs.existsSync(legacyDb)) continue;

    for (const suffix of ['', '-wal', '-shm']) {
      const from = `${legacyDb}${suffix}`;
      if (fs.existsSync(from)) fs.copyFileSync(from, `${target}${suffix}`);
    }
    return;
  }
}

app.whenReady().then(async () => {
  try {
    const usingDefaultDir = !process.env.DUCKLOOK_DATA_DIR;
    const dataDir = process.env.DUCKLOOK_DATA_DIR
      ? path.resolve(process.env.DUCKLOOK_DATA_DIR)
      : path.join(app.getPath('userData'), 'data');
    fs.mkdirSync(dataDir, { recursive: true });
    if (usingDefaultDir) migrateLegacyDatabase(dataDir);
    process.env.DUCKLOOK_DATA_DIR = dataDir;

    // Import after the data directory is known and Electron is ready, so SQLite
    // opens in the per-user app data directory and safeStorage is available.
    apiModule = await import('../server/api.ts');

    registerIpcHandlers();
    await createWindow();
  } catch (err) {
    console.error('Failed to start DuckLook:', err);
    app.quit();
    return;
  }

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) await createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
