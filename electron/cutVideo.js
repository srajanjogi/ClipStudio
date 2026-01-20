import ffmpeg from 'fluent-ffmpeg';
import { tmpdir } from 'os';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';

// Track temporary preview files for cleanup
const tempPreviewFiles = new Set();

/**
 * Register IPC handlers related to the Cut Video feature.
 * This keeps all FFmpeg + trimming logic in one dedicated module.
 */
export function registerCutVideoHandlers(ipcMain, dialog) {
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

    // Use fluent-ffmpeg to trim video with re-encoding for proper video output
    return await new Promise((resolve) => {
      let errorMessage = '';

      ffmpeg(inputPath)
        .setStartTime(startSeconds)           // Start time
        .setDuration(segDuration)             // Duration
        .videoCodec('libx264')                // Video codec (H.264)
        .videoBitrate(0)                      // Use CRF instead of bitrate
        .addOption('-preset', 'medium')       // Encoding speed/quality balance
        .addOption('-crf', '23')              // Quality (18-28, lower is better quality)
        .audioCodec('aac')                    // Audio codec
        .audioBitrate('192k')                 // Audio bitrate
        .addOption('-movflags', '+faststart') // Enable fast start for web playback
        .outputOptions('-y')                  // Overwrite output file
        .output(filePath)                     // Output file
        .on('start', (commandLine) => {
          console.log('FFmpeg command:', commandLine);
        })
        .on('progress', (progress) => {
          // Optional: can emit progress updates if needed
        })
        .on('error', (err) => {
          errorMessage = err.message;
          resolve({ canceled: false, error: errorMessage });
        })
        .on('end', () => {
          resolve({ canceled: false, filePath });
        })
        .run();
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
    const tempFilePath = join(
      tempDir,
      `clipstudio-preview-${Date.now()}-${Math.random().toString(36).substring(7)}.mp4`
    );

    // Use fluent-ffmpeg to create trimmed preview with faster encoding
    return await new Promise((resolve) => {
      let errorMessage = '';

      ffmpeg(inputPath)
        .setStartTime(startSeconds)           // Start time
        .setDuration(segDuration)            // Duration
        .videoCodec('libx264')               // Video codec (H.264)
        .videoBitrate(0)                     // Use CRF instead of bitrate
        .addOption('-preset', 'ultrafast')   // Fast encoding for preview
        .addOption('-crf', '28')             // Slightly lower quality for faster encoding
        .audioCodec('aac')                   // Audio codec
        .audioBitrate('128k')                // Audio bitrate (lower for preview)
        .addOption('-movflags', '+faststart') // Enable fast start for web playback
        .outputOptions('-y')                 // Overwrite output file
        .output(tempFilePath)                // Output file
        .on('start', (commandLine) => {
          console.log('FFmpeg preview command:', commandLine);
        })
        .on('progress', (progress) => {
          // Optional: can emit progress updates if needed
        })
        .on('error', (err) => {
          errorMessage = err.message;
          resolve({ error: errorMessage });
        })
        .on('end', () => {
          tempPreviewFiles.add(tempFilePath);
          resolve({ filePath: tempFilePath });
        })
        .run();
    });
  });

  // IPC handler for cleaning up a specific temporary preview file
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
}

/**
 * Cleanup all temporary preview files (e.g., when the app exits).
 */
export function cleanupCutVideoTempFiles() {
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
}

