import { app, BrowserWindow, ipcMain, dialog, protocol } from 'electron';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { spawn } from 'child_process';
import { tmpdir } from 'os';
import { existsSync, unlinkSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let mainWindow;
const tempPreviewFiles = new Set(); // Track temporary preview files for cleanup

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

// IPC handler for exporting a cut / trimmed video using ffmpeg
ipcMain.handle('export-cut-video', async (event, { inputPath, start, end, duration }) => {
  if (!inputPath || start === undefined || start === null) {
    return { canceled: true, error: 'Missing required parameters' };
  }

  // Ask user where to save the trimmed video
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Export Trimmed Video',
    defaultPath: 'trimmed-video.mp4',
    filters: [{ name: 'MP4 Video', extensions: ['mp4'] }],
  });

  if (canceled || !filePath) {
    return { canceled: true };
  }

  const startSeconds = typeof start === 'number' ? start : parseFloat(start);
  let segDuration = duration;
  if (segDuration === undefined && end !== undefined) {
    const endSeconds = typeof end === 'number' ? end : parseFloat(end);
    segDuration = endSeconds - startSeconds;
  }

  if (!segDuration || !isFinite(segDuration) || segDuration <= 0) {
    return { canceled: true, error: 'Invalid segment duration' };
  }

  // Build ffmpeg command with re-encoding for proper video output:
  //   ffmpeg -y -ss START -i inputPath -t DURATION -c:v libx264 -c:a aac -preset medium -crf 23 outputPath
  // Using re-encoding instead of copy to ensure proper playback
  const ffmpegArgs = [
    '-y',                    // Overwrite output file
    '-ss',
    String(startSeconds),     // Start time
    '-i',
    inputPath,               // Input file
    '-t',
    String(segDuration),      // Duration
    '-c:v',
    'libx264',               // Video codec (H.264)
    '-preset',
    'medium',                // Encoding speed/quality balance
    '-crf',
    '23',                    // Quality (18-28, lower is better quality)
    '-c:a',
    'aac',                   // Audio codec
    '-b:a',
    '192k',                  // Audio bitrate
    '-movflags',
    '+faststart',            // Enable fast start for web playback
    filePath,                // Output file
  ];

  // Assume ffmpeg is available on PATH. You can change this to an absolute path if needed.
  const ffmpegProcess = spawn('ffmpeg', ffmpegArgs);

  return await new Promise((resolve) => {
    let stderr = '';

    ffmpegProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffmpegProcess.on('error', (err) => {
      resolve({ canceled: false, error: err.message });
    });

    ffmpegProcess.on('close', (code) => {
      if (code === 0) {
        resolve({ canceled: false, filePath });
      } else {
        resolve({
          canceled: false,
          error: `ffmpeg exited with code ${code}\n${stderr}`,
        });
      }
    });
  });
});

// IPC handler for creating a temporary trimmed video for preview
ipcMain.handle('create-preview-video', async (event, { inputPath, start, end, duration }) => {
  if (!inputPath || start === undefined || start === null) {
    return { error: 'Missing required parameters' };
  }

  const startSeconds = typeof start === 'number' ? start : parseFloat(start);
  let segDuration = duration;
  if (segDuration === undefined && end !== undefined) {
    const endSeconds = typeof end === 'number' ? end : parseFloat(end);
    segDuration = endSeconds - startSeconds;
  }

  if (!segDuration || !isFinite(segDuration) || segDuration <= 0) {
    return { error: 'Invalid segment duration' };
  }

  // Create temporary file path
  const tempDir = tmpdir();
  const tempFilePath = join(tempDir, `clipstudio-preview-${Date.now()}-${Math.random().toString(36).substring(7)}.mp4`);

  // Build ffmpeg command to create trimmed preview with re-encoding
  // Using faster encoding for preview to reduce wait time
  const ffmpegArgs = [
    '-y',                    // Overwrite output file
    '-ss',
    String(startSeconds),     // Start time
    '-i',
    inputPath,               // Input file
    '-t',
    String(segDuration),      // Duration
    '-c:v',
    'libx264',               // Video codec (H.264)
    '-preset',
    'ultrafast',             // Fast encoding for preview
    '-crf',
    '28',                    // Slightly lower quality for faster encoding
    '-c:a',
    'aac',                   // Audio codec
    '-b:a',
    '128k',                  // Audio bitrate (lower for preview)
    '-movflags',
    '+faststart',            // Enable fast start for web playback
    tempFilePath,            // Output file
  ];

  const ffmpegProcess = spawn('ffmpeg', ffmpegArgs);

  return await new Promise((resolve) => {
    let stderr = '';

    ffmpegProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffmpegProcess.on('error', (err) => {
      resolve({ error: err.message });
    });

    ffmpegProcess.on('close', (code) => {
      if (code === 0) {
        tempPreviewFiles.add(tempFilePath);
        resolve({ filePath: tempFilePath });
      } else {
        resolve({
          error: `ffmpeg exited with code ${code}\n${stderr}`,
        });
      }
    });
  });
});

// IPC handler for cleaning up temporary preview files
ipcMain.handle('cleanup-preview-video', async (event, { filePath }) => {
  if (filePath && tempPreviewFiles.has(filePath)) {
    try {
      if (existsSync(filePath)) {
        unlinkSync(filePath);
      }
      tempPreviewFiles.delete(filePath);
      return { success: true };
    } catch (err) {
      return { error: err.message };
    }
  }
  return { success: true };
});

// Cleanup all temp files on app exit
app.on('before-quit', () => {
  tempPreviewFiles.forEach((filePath) => {
    try {
      if (existsSync(filePath)) {
        unlinkSync(filePath);
      }
    } catch (err) {
      console.error('Error cleaning up temp file:', err);
    }
  });
  tempPreviewFiles.clear();
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
