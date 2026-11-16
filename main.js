const { app, BrowserWindow, Menu, dialog, shell } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

// Only one Mathpad window at a time (two windows would fight over the same notes).
if (!app.requestSingleInstanceLock()) {
  app.quit();
}

let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 700,
    minHeight: 480,
    title: 'Mathpad',
    icon: path.join(__dirname, 'app', 'icon.png'),
    backgroundColor: '#fbfaf6',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
    },
  });

  win.loadFile(path.join(__dirname, 'app', 'index.html'));
  win.once('ready-to-show', () => win.show());

  // Links open in the normal web browser, never inside the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file:')) {
      e.preventDefault();
      if (/^https?:/i.test(url)) shell.openExternal(url);
    }
  });

  win.on('closed', () => { win = null; });
}

// ---------------- automatic updates ----------------
// Builds made by the GitHub workflow know which repo they came from and check its
// Releases page. A newer version downloads in the background and installs when the
// app closes (or right away if you choose "Restart now"). Builds made on your own
// computer have no release feed, so they never update themselves.
let manualCheck = false;
let readyVersion = null;

autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

autoUpdater.on('update-available', info => {
  if (manualCheck) {
    manualCheck = false;
    dialog.showMessageBox(win, { type: 'info', message: `Downloading Mathpad ${info.version}…`, detail: "You'll be asked to restart when it's ready." });
  }
});
autoUpdater.on('update-not-available', () => {
  if (manualCheck) {
    manualCheck = false;
    dialog.showMessageBox(win, { type: 'info', message: "You're up to date", detail: `Mathpad ${app.getVersion()} is the latest version.` });
  }
});
function updateFailed(err) {
  // automatic checks fail quietly (e.g. no internet); only a check you asked for shows a message
  if (!manualCheck) return;
  manualCheck = false;
  dialog.showMessageBox(win, { type: 'warning', message: "Couldn't check for updates", detail: String((err && err.message) || err).split('\n')[0] });
}
autoUpdater.on('error', updateFailed);
autoUpdater.on('update-downloaded', async info => {
  readyVersion = info.version;
  const { response } = await dialog.showMessageBox(win, {
    type: 'info',
    buttons: ['Restart now', 'Later'],
    defaultId: 0,
    cancelId: 1,
    message: `Mathpad ${info.version} is ready`,
    detail: 'Restart to finish updating. Your notes are kept. If you pick Later, the update installs the next time you close Mathpad.',
  });
  if (response === 0) autoUpdater.quitAndInstall();
});

function checkForUpdates(manual) {
  if (!app.isPackaged) {
    if (manual) dialog.showMessageBox(win, { type: 'info', message: 'Updates only work in the installed app.' });
    return;
  }
  if (readyVersion) {
    if (manual) autoUpdater.quitAndInstall();
    return;
  }
  manualCheck = !!manual;
  autoUpdater.checkForUpdates().catch(updateFailed);
}

// ---------------- menu ----------------
const menu = Menu.buildFromTemplate([
  { label: 'File', submenu: [
    { label: 'Check for updates…', click: () => checkForUpdates(true) },
    { type: 'separator' },
    { role: 'quit', label: 'Exit' },
  ] },
  { label: 'Edit', submenu: [
    { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
    { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' },
  ] },
  { label: 'View', submenu: [
    { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' },
    { role: 'togglefullscreen' }, { role: 'reload' },
  ] },
  { label: 'Help', submenu: [
    { label: `Mathpad ${app.getVersion()}`, enabled: false },
    { label: 'Check for updates…', click: () => checkForUpdates(true) },
  ] },
]);

app.on('second-instance', () => {
  if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
});

app.whenReady().then(() => {
  Menu.setApplicationMenu(menu);
  createWindow();
  // check a few seconds after launch, then every 4 hours while it's open
  setTimeout(() => checkForUpdates(false), 5000);
  setInterval(() => checkForUpdates(false), 4 * 60 * 60 * 1000);
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
