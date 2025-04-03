const { app, BrowserWindow } = require('electron');
const { execFile } = require('child_process');
const path = require('path');
const AutoLaunch = require('auto-launch');

let flaskProcess;
let mainWindow;

// Setup auto-launch
const autoLauncher = new AutoLaunch({
  name: 'EscapidoWidget',
  isHidden: true
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false,
    transparent: true,
    roundedCorners: true,
    alwaysOnTop: false,
    resizable: false,
    hasShadow: false,
    backgroundColor: '#00000000',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  setTimeout(() => {
    mainWindow.loadURL('http://127.0.0.1:5000');

    mainWindow.webContents.on('did-finish-load', () => {
      mainWindow.webContents.executeJavaScript(`
        new Promise(resolve => {
          const body = document.body;
          const html = document.documentElement;
          const height = Math.max(
            body.scrollHeight,
            body.offsetHeight,
            html.clientHeight,
            html.scrollHeight,
            html.offsetHeight
          );
          const width = Math.max(
            body.scrollWidth,
            body.offsetWidth,
            html.clientWidth,
            html.scrollWidth,
            html.offsetWidth
          );
          resolve({ width, height });
        });
      `).then(({ width, height }) => {
        mainWindow.setSize(Math.ceil(width), Math.ceil(height));
      });

      // 🔁 Auto-refresh every 60 seconds
      setInterval(() => {
        mainWindow.webContents.reload();
      }, 60 * 1000);
    });
  }, 1000);
}

app.whenReady().then(() => {
  // ✅ Enable auto-launch
  autoLauncher.isEnabled().then((isEnabled) => {
    if (!isEnabled) {
      autoLauncher.enable();
    }
  }).catch(err => {
    console.error('Auto-launch error:', err);
  });

  // ✅ Use process.resourcesPath in production builds
  const isPackaged = app.isPackaged;
  const basePath = isPackaged ? process.resourcesPath : path.join(__dirname, 'dist');
  const flaskPath = path.join(basePath, process.platform === 'win32' ? 'app.exe' : 'app');

  flaskProcess = execFile(flaskPath, (err) => {
    if (err) {
      console.error('Flask error:', err);
    }
  });

  createWindow();
});

app.on('window-all-closed', () => {
  if (flaskProcess) flaskProcess.kill('SIGTERM');
  app.quit();
});

app.on('before-quit', () => {
  if (flaskProcess) flaskProcess.kill('SIGTERM');
});
