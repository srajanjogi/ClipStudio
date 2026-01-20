import ffmpeg from 'fluent-ffmpeg';
import { tmpdir } from 'os';
import { existsSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';

// Track temporary preview files for cleanup
const tempPreviewFiles = new Set();

/**
 * Get video metadata (duration, resolution, fps) using FFprobe
 */
function getVideoMetadata(videoPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        reject(err);
        return;
      }

      const videoStream = metadata.streams.find(s => s.codec_type === 'video');
      const duration = metadata.format.duration || 0;
      const width = videoStream?.width || 0;
      const height = videoStream?.height || 0;
      
      // Get FPS
      let fps = 30; // default
      if (videoStream?.r_frame_rate) {
        const [num, den] = videoStream.r_frame_rate.split('/').map(Number);
        if (den && den > 0) {
          fps = num / den;
        }
      } else if (videoStream?.avg_frame_rate) {
        const [num, den] = videoStream.avg_frame_rate.split('/').map(Number);
        if (den && den > 0) {
          fps = num / den;
        }
      }

      resolve({
        duration,
        width,
        height,
        fps,
        resolution: `${width}x${height}`,
        metadata // Full metadata
      });
    });
  });
}

/**
 * Check if video has audio stream
 */
function hasAudioStream(meta) {
  return meta.metadata?.streams?.some(s => s.codec_type === 'audio') || false;
}

/**
 * Get video properties for normalization
 */
function getVideoProperties(metadata) {
  return {
    width: metadata.width || 1920,
    height: metadata.height || 1080,
    fps: metadata.fps || 30
  };
}

/**
 * Normalize a video to match target properties (resolution, fps, codec)
 */
function normalizeVideo(inputPath, outputPath, targetProps, duration) {
  return new Promise((resolve, reject) => {
    // Get full metadata for audio check
    ffmpeg.ffprobe(inputPath, (err, fullMetadata) => {
      if (err) {
        reject(err);
        return;
      }
      
      const hasAudio = fullMetadata.streams.some(s => s.codec_type === 'audio');
        const filters = [];
        
        // Video filter: normalize to target properties
        filters.push(
          `[0:v]scale=${targetProps.width}:${targetProps.height}:force_original_aspect_ratio=decrease,pad=${targetProps.width}:${targetProps.height}:-1:-1:color=black,fps=${targetProps.fps}[v]`
        );
        
        // Audio filter: normalize audio or generate silent audio
        if (hasAudio) {
          filters.push(`[0:a]aformat=sample_rates=44100:channel_layouts=stereo[a]`);
        } else {
          filters.push(`anullsrc=channel_layout=stereo:sample_rate=44100,atrim=start=0:end=${duration}[a]`);
        }
        
        ffmpeg(inputPath)
          .complexFilter(filters)
          .outputOptions([
            '-map', '[v]',
            '-map', '[a]',
            '-c:v', 'libx264',
            '-preset', 'fast',
            '-crf', '23',
            '-r', String(targetProps.fps),
            '-c:a', 'aac',
            '-b:a', '192k',
            '-pix_fmt', 'yuv420p',
            '-t', String(duration),
            '-y'
          ])
          .output(outputPath)
          .on('end', () => {
            console.log(`Video normalized: ${outputPath}`);
            resolve();
          })
          .on('error', (err) => {
            console.error(`Error normalizing video ${inputPath}:`, err);
            reject(err);
          })
          .run();
    });
  });
}

/**
 * Format seconds to HH:MM:SS
 */
function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Merge videos - Sequential: base[0:point] + insert + base[point:end]
 * Overlay: base[0:point] + insert + base[point+insertDuration:end]
 * All videos are normalized to match base video properties
 */
async function mergeVideos(basePath, insertPath, insertionPoint, mergeType, outputPath, isPreview = false) {
  const tempDir = tmpdir();
  const tempFiles = [];

  try {
    // Get base video properties for normalization
    const baseMeta = await getVideoMetadata(basePath);
    const baseProps = getVideoProperties(baseMeta);
    const baseDuration = baseMeta.duration;
    
    // Get insert video metadata
    const insertMeta = await getVideoMetadata(insertPath);
    const insertDuration = insertMeta.duration;
    
    const insertionPointSeconds = typeof insertionPoint === 'number' ? insertionPoint : parseFloat(insertionPoint);
    
    console.log(`Merging videos - Target: ${baseProps.width}x${baseProps.height} @ ${baseProps.fps}fps`);
    console.log(`Base: ${baseDuration}s, Insert: ${insertDuration}s, Point: ${insertionPointSeconds}s`);
    
    // Calculate segments
    let part1Duration = insertionPointSeconds;
    let part2Start, part2Duration;
    let actualInsertDuration = insertDuration;
    
    if (mergeType === 'sequential') {
      // Sequential: base[0:point] + insert + base[point:end]
      part2Start = insertionPointSeconds;
      part2Duration = baseDuration - insertionPointSeconds;
    } else {
      // Overlay: base[0:point] + insert + base[point+insertDuration:end]
      actualInsertDuration = Math.min(insertDuration, baseDuration - insertionPointSeconds);
      part2Start = insertionPointSeconds + actualInsertDuration;
      part2Duration = baseDuration - part2Start;
    }

    // Step 1: Normalize base video part 1 (0 to insertionPoint)
    const normalizedSegments = [];
    
    if (part1Duration > 0) {
      const part1Extracted = join(tempDir, `part1-extracted-${Date.now()}.mp4`);
      tempFiles.push(part1Extracted);
      
      // Extract segment first
      await new Promise((resolve, reject) => {
        ffmpeg(basePath)
          .setStartTime(0)
          .setDuration(part1Duration)
          .outputOptions(['-c', 'copy', '-y'])
          .output(part1Extracted)
          .on('end', resolve)
          .on('error', reject)
          .run();
      });
      
      // Then normalize
      const part1Normalized = join(tempDir, `part1-normalized-${Date.now()}.mp4`);
      tempFiles.push(part1Normalized);
      await normalizeVideo(part1Extracted, part1Normalized, baseProps, part1Duration);
      normalizedSegments.push(part1Normalized);
    }

    // Step 2: Normalize insert video
    const insertExtracted = join(tempDir, `insert-extracted-${Date.now()}.mp4`);
    tempFiles.push(insertExtracted);
    
    // Extract/trim insert video first
    await new Promise((resolve, reject) => {
      ffmpeg(insertPath)
        .setStartTime(0)
        .setDuration(actualInsertDuration)
        .outputOptions(['-c', 'copy', '-y'])
        .output(insertExtracted)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });
    
    // Then normalize
    const insertNormalized = join(tempDir, `insert-normalized-${Date.now()}.mp4`);
    tempFiles.push(insertNormalized);
    await normalizeVideo(insertExtracted, insertNormalized, baseProps, actualInsertDuration);
    normalizedSegments.push(insertNormalized);

    // Step 3: Normalize base video part 2
    if (part2Duration > 0) {
      const part2Extracted = join(tempDir, `part2-extracted-${Date.now()}.mp4`);
      tempFiles.push(part2Extracted);
      
      // Extract segment first
      await new Promise((resolve, reject) => {
        ffmpeg(basePath)
          .setStartTime(part2Start)
          .setDuration(part2Duration)
          .outputOptions(['-c', 'copy', '-y'])
          .output(part2Extracted)
          .on('end', resolve)
          .on('error', reject)
          .run();
      });
      
      // Then normalize
      const part2Normalized = join(tempDir, `part2-normalized-${Date.now()}.mp4`);
      tempFiles.push(part2Normalized);
      await normalizeVideo(part2Extracted, part2Normalized, baseProps, part2Duration);
      normalizedSegments.push(part2Normalized);
    }

    // Step 4: Create concat file and merge
    const concatFile = join(tempDir, `concat-${Date.now()}.txt`);
    tempFiles.push(concatFile);
    const concatContent = normalizedSegments.map(p => {
      const escapedPath = p.replace(/\\/g, '/').replace(/'/g, "\\'");
      return `file '${escapedPath}'`;
    }).join('\n');
    writeFileSync(concatFile, concatContent, 'utf8');

    // Use concat demuxer with copy (all videos are now same format)
    const encodingOptions = isPreview
      ? ['-c', 'copy', '-avoid_negative_ts', 'make_zero', '-y']
      : ['-c', 'copy', '-avoid_negative_ts', 'make_zero', '-y'];

    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(concatFile)
        .inputOptions(['-f', 'concat', '-safe', '0'])
        .outputOptions(encodingOptions)
        .output(outputPath)
        .on('start', (cmd) => console.log('FFmpeg merge:', cmd))
        .on('end', () => {
          console.log(`Merge completed: ${outputPath}`);
          resolve();
        })
        .on('error', reject)
        .run();
    });

    return outputPath;
  } catch (error) {
    console.error('Error in mergeVideos:', error);
    throw error;
  } finally {
    // Cleanup temp files
    tempFiles.forEach(f => {
      try {
        if (existsSync(f)) unlinkSync(f);
      } catch (e) {
        console.error('Error deleting temp file:', e);
      }
    });
  }
}

/**
 * Register IPC handlers related to the Merge Videos feature.
 */
export function registerMergeVideosHandlers(ipcMain, dialog) {
  // IPC handler for getting video metadata
  ipcMain.handle('get-video-metadata', async (event, { videoPath }) => {
    if (!videoPath) {
      return { error: 'No video path provided' };
    }

    try {
      const metadata = await getVideoMetadata(videoPath);
      return {
        duration: metadata.duration,
        durationFormatted: formatDuration(metadata.duration),
        width: metadata.width,
        height: metadata.height,
        resolution: metadata.resolution
      };
    } catch (err) {
      return { error: err.message };
    }
  });

  // IPC handler for creating a thumbnail (first frame) of a video
  ipcMain.handle('create-video-thumbnail', async (event, { videoPath }) => {
    if (!videoPath) {
      return { error: 'No video path provided' };
    }

    const tempDir = tmpdir();
    const thumbnailPath = join(
      tempDir,
      `clipstudio-thumbnail-${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`
    );

    return new Promise((resolve) => {
      ffmpeg(videoPath)
        .seekInput(0)
        .outputOptions([
          '-vframes', '1',
          '-vf', 'scale=320:180:force_original_aspect_ratio=decrease,pad=320:180:(ow-iw)/2:(oh-ih)/2:color=black',
          '-q:v', '2'
        ])
        .output(thumbnailPath)
        .on('start', (cmd) => console.log('FFmpeg thumbnail:', cmd))
        .on('end', () => {
          if (existsSync(thumbnailPath)) {
            tempPreviewFiles.add(thumbnailPath);
            resolve({ thumbnailPath });
          } else {
            resolve({ error: 'Thumbnail file was not created' });
          }
        })
        .on('error', (err) => {
          console.error('FFmpeg thumbnail error:', err);
          resolve({ error: err.message });
        })
        .run();
    });
  });

  // IPC handler for exporting sequential merge
  ipcMain.handle('export-sequential-merge', async (event, { baseVideoPath, insertVideoPath, insertionPoint }) => {
    if (!baseVideoPath || !insertVideoPath || insertionPoint === undefined) {
      return { canceled: true, error: 'Missing required parameters' };
    }

    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Export Merged Video',
      defaultPath: 'merged-video.mp4',
      filters: [{ name: 'MP4 Video', extensions: ['mp4'] }],
    });

    if (canceled || !filePath) {
      return { canceled: true };
    }

    try {
      await mergeVideos(baseVideoPath, insertVideoPath, insertionPoint, 'sequential', filePath, false);
      return { canceled: false, filePath };
    } catch (error) {
      return { canceled: false, error: error.message };
    }
  });

  // IPC handler for exporting overlay merge
  ipcMain.handle('export-overlay-merge', async (event, { baseVideoPath, insertVideoPath, insertionPoint }) => {
    if (!baseVideoPath || !insertVideoPath || insertionPoint === undefined) {
      return { canceled: true, error: 'Missing required parameters' };
    }

    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Export Merged Video',
      defaultPath: 'merged-video.mp4',
      filters: [{ name: 'MP4 Video', extensions: ['mp4'] }],
    });

    if (canceled || !filePath) {
      return { canceled: true };
    }

    try {
      await mergeVideos(baseVideoPath, insertVideoPath, insertionPoint, 'overlay', filePath, false);
      return { canceled: false, filePath };
    } catch (error) {
      return { canceled: false, error: error.message };
    }
  });

  // IPC handler for creating preview (sequential merge)
  ipcMain.handle('create-preview-sequential-merge', async (event, { baseVideoPath, insertVideoPath, insertionPoint }) => {
    if (!baseVideoPath || !insertVideoPath || insertionPoint === undefined) {
      return { error: 'Missing required parameters' };
    }

    const tempDir = tmpdir();
    const previewPath = join(
      tempDir,
      `clipstudio-merge-preview-${Date.now()}-${Math.random().toString(36).substring(7)}.mp4`
    );

    try {
      await mergeVideos(baseVideoPath, insertVideoPath, insertionPoint, 'sequential', previewPath, true);
      tempPreviewFiles.add(previewPath);
      return { filePath: previewPath };
    } catch (error) {
      return { error: error.message };
    }
  });

  // IPC handler for creating preview (overlay merge)
  ipcMain.handle('create-preview-overlay-merge', async (event, { baseVideoPath, insertVideoPath, insertionPoint }) => {
    if (!baseVideoPath || !insertVideoPath || insertionPoint === undefined) {
      return { error: 'Missing required parameters' };
    }

    const tempDir = tmpdir();
    const previewPath = join(
      tempDir,
      `clipstudio-overlay-preview-${Date.now()}-${Math.random().toString(36).substring(7)}.mp4`
    );

    try {
      await mergeVideos(baseVideoPath, insertVideoPath, insertionPoint, 'overlay', previewPath, true);
      tempPreviewFiles.add(previewPath);
      return { filePath: previewPath };
    } catch (error) {
      return { error: error.message };
    }
  });

  // IPC handler for cleaning up a specific temporary preview file
  ipcMain.handle('cleanup-merge-preview-video', async (event, { filePath }) => {
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
export function cleanupMergeVideosTempFiles() {
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
