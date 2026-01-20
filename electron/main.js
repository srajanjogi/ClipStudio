import { app, BrowserWindow, ipcMain, dialog, protocol } from 'electron';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { registerCutVideoHandlers, cleanupCutVideoTempFiles } from './cutVideo.js';
import { registerMergeVideosHandlers, cleanupMergeVideosTempFiles } from './mergeVideos.js';
import { registerSpeedChangeHandlers, cleanupSpeedTempFiles } from './speedChange.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let mainWindow;

// Register custom protocol scheme before app is ready
if (process.defaultApp || /[\\/]electron-prebuilt[\\/]/.test(process.execPath) || /[\\/]electron[\\/]/.test(process.execPath)) {
  // Register the scheme as standard (for development)
  app.setAsDefaultProtocolClient('clipstudio');
}

// Register the protocol handler when app is ready
app.whenReady().then(() => {
  protocol.registerFileProtocol('clipstudio', (request, callback) => {
    try {
      // Extract file path from URL (clipstudio://C:/Users/...)
      let url = request.url.replace('clipstudio://', '');
      url = decodeURIComponent(url);
      
      // Convert forward slashes to backslashes for Windows paths
      let filePath = url;
      if (process.platform === 'win32') {
        // Replace forward slashes with backslashes
        filePath = url.replace(/\//g, '\\');
        // Ensure drive letter is uppercase
        if (/^[a-z]:\\/.test(filePath)) {
          filePath = filePath.charAt(0).toUpperCase() + filePath.slice(1);
        }
      }
      
      callback({ path: filePath });
    } catch (error) {
      console.error('Error in protocol handler:', error);
      callback({ error: -2 }); // FILE_NOT_FOUND
    }
  });
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: join(__dirname, 'preload.cjs'),
      webSecurity: false // Allow loading local files (only for development)
    },
    title: 'ClipStudio - Video Editor',
    titleBarStyle: 'default',
    backgroundColor: '#ffffff'
  });

  // Load the app
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC handler for selecting a video file using native dialog
ipcMain.handle('select-video-file', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Select Video File',
    filters: [
      { name: 'Video Files', extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    properties: ['openFile']
  });

  if (canceled || filePaths.length === 0) {
    return { canceled: true };
  }

  return { canceled: false, filePath: filePaths[0] };
});

// IPC handler to get a file URL that works in the renderer
ipcMain.handle('get-file-url', async (event, filePath) => {
  if (!filePath) {
    return { error: 'No file path provided' };
  }
  // Return the file path - we'll use file:// with webSecurity disabled
  // Convert backslashes to forward slashes for URL
  const url = `file:///${filePath.replace(/\\/g, '/')}`;
  return { url };
});

// Register all IPC handlers for the Cut Video feature
registerCutVideoHandlers(ipcMain, dialog);

// Register all IPC handlers for the Merge Videos feature
registerMergeVideosHandlers(ipcMain, dialog);

// Register IPC handlers for the Change Playback Speed feature
registerSpeedChangeHandlers(ipcMain, dialog);

// Cleanup all temp files on app exit
app.on('before-quit', () => {
  cleanupCutVideoTempFiles();
  cleanupMergeVideosTempFiles();
  cleanupSpeedTempFiles();
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
