const { app, BrowserWindow } = require('electron');
const { execFile } = require('child_process');
const path = require('path');
const AutoLaunch = require('auto-launch');
const http = require('http');

let flaskProcess;
let mainWindow;

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
}

// Wait until Flask server is ready
function waitForFlaskAndLoad(retries = 20) {
  const url = 'http://127.0.0.1:5000';

  http.get(url, (res) => {
    if (res.statusCode === 200) {
      console.log('[Electron] Flask is up — loading UI');
      mainWindow.loadURL(url);

      mainWindow.webContents.on('did-finish-load', () => {
        mainWindow.webContents.executeJavaScript(`
          new Promise(resolve => {
            const body = document.body;
            const html = document.documentElement;
            const height = Math.max(
              body.scrollHeight, body.offsetHeight,
              html.clientHeight, html.scrollHeight, html.offsetHeight
            );
            const width = Math.max(
              body.scrollWidth, body.offsetWidth,
              html.clientWidth, html.scrollWidth, html.offsetWidth
            );
            resolve({ width, height });
          });
        `).then(({ width, height }) => {
          mainWindow.setSize(Math.ceil(width), Math.ceil(height));
        });

        setInterval(() => {
          mainWindow.webContents.reload();
        }, 60000);
      });

    } else {
      retryLater();
    }
  }).on('error', retryLater);

  function retryLater() {
    if (retries > 0) {
      console.log(`[Electron] Waiting for Flask... Retries left: ${retries}`);
      setTimeout(() => waitForFlaskAndLoad(retries - 1), 1000);
    } else {
      mainWindow.loadURL('data:text/html,<h1>❌ Could not connect to Flask backend</h1>');
    }
  }
}

app.whenReady().then(() => {
  autoLauncher.isEnabled().then((isEnabled) => {
    if (!isEnabled) autoLauncher.enable();
  }).catch(console.error);

  const isPackaged = app.isPackaged;
  const basePath = isPackaged ? process.resourcesPath : path.join(__dirname, 'dist');
  const flaskBinary = process.platform === 'win32' ? 'app.exe' : 'app';
  const flaskPath = path.join(basePath, flaskBinary);

  console.log(`[Electron] Starting Flask from ${flaskPath}`);

  flaskProcess = execFile(flaskPath, (err, stdout, stderr) => {
    if (err) {
      console.error('[Flask error]', err);
    }
    if (stdout) console.log('[Flask stdout]', stdout);
    if (stderr) console.error('[Flask stderr]', stderr);
  });

  if (flaskProcess.stdout) {
    flaskProcess.stdout.on('data', data => console.log(`[Flask log] ${data.toString()}`));
  }

  if (flaskProcess.stderr) {
    flaskProcess.stderr.on('data', data => console.error(`[Flask error stream] ${data.toString()}`));
  }

  createWindow();
  waitForFlaskAndLoad();
});

app.on('window-all-closed', () => {
  if (
