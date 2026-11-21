const { app, BrowserWindow, ipcMain, dialog, screen, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

let win = null;

// Pinned before any getPath call. Without this, `npm start` and the packaged
// build derive different names and end up with two separate task files.
app.setName('Sticky Todo');

const dataPath = () => path.join(app.getPath('userData'), 'data.json');
const windowPath = () => path.join(app.getPath('userData'), 'window.json');

const DEFAULT_WINDOW = { width: 340, height: 470, alwaysOnTop: true };

function readJSON(file, fallback) {
  try {
    const raw = fs.readFileSync(file, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch {
    return fallback;
  }
}

// Write to a temp file first, then rename. A crash mid-write can't corrupt the real file.
function writeJSON(file, obj) {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), 'utf8');
  fs.renameSync(tmp, file);
}

// If the note was last closed on a monitor that is no longer attached, forget the
// position so it doesn't open off-screen.
function isOnScreen(x, y) {
  if (typeof x !== 'number' || typeof y !== 'number') return false;
  return screen.getAllDisplays().some((d) => {
    const b = d.workArea;
    return x >= b.x - 40 && x <= b.x + b.width - 40 && y >= b.y - 40 && y <= b.y + b.height - 40;
  });
}

function createWindow() {
  const saved = { ...DEFAULT_WINDOW, ...readJSON(windowPath(), {}) };
  const usePos = isOnScreen(saved.x, saved.y);

  win = new BrowserWindow({
    width: Math.max(240, saved.width || DEFAULT_WINDOW.width),
    height: Math.max(120, saved.height || DEFAULT_WINDOW.height),
    x: usePos ? saved.x : undefined,
    y: usePos ? saved.y : undefined,
    // The fixed chrome (title bar, capture box, sort row, footer) needs 209px.
    minWidth: 240,
    minHeight: 240,
    frame: false,
    alwaysOnTop: saved.alwaysOnTop !== false,
    resizable: true,
    fullscreenable: false,
    backgroundColor: '#191f27',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: true,
    },
  });

  // Float above full-screen apps and other spaces on macOS.
  if (process.platform === 'darwin') {
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }

  win.loadFile('index.html');
  win.once('ready-to-show', () => win.show());

  // Open any external link in the real browser, never inside the note.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  win.on('close', () => {
    if (!win || win.isDestroyed()) return;
    const b = win.getBounds();
    writeJSON(windowPath(), {
      x: b.x,
      y: b.y,
      width: b.width,
      height: b.height,
      alwaysOnTop: win.isAlwaysOnTop(),
    });
  });

  win.on('closed', () => {
    win = null;
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => app.quit());

/* ---------- IPC ---------- */

ipcMain.handle('data:load', () => readJSON(dataPath(), null));

ipcMain.handle('data:save', (_e, data) => {
  writeJSON(dataPath(), data);
  return true;
});

ipcMain.handle('win:pin:get', () => (win ? win.isAlwaysOnTop() : true));

ipcMain.handle('win:pin:set', (_e, value) => {
  if (win) win.setAlwaysOnTop(Boolean(value));
  return win ? win.isAlwaysOnTop() : false;
});

ipcMain.on('win:minimize', () => win && win.minimize());
ipcMain.on('win:close', () => win && win.close());

ipcMain.handle('ics:save', async (_e, text) => {
  const res = await dialog.showSaveDialog(win, {
    title: 'Export to calendar file',
    defaultPath: 'todo.ics',
    filters: [{ name: 'Calendar', extensions: ['ics'] }],
  });
  if (res.canceled || !res.filePath) return { saved: false };
  fs.writeFileSync(res.filePath, text, 'utf8');
  return { saved: true, path: res.filePath };
});

ipcMain.handle('data:reveal', () => {
  shell.showItemInFolder(dataPath());
  return dataPath();
});
