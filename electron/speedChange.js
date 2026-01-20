import ffmpeg from 'fluent-ffmpeg';
import { tmpdir } from 'os';
import { existsSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';

// Track temporary preview files for cleanup
const tempPreviewFiles = new Set();

function getVideoDuration(inputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err) {
        reject(err);
        return;
      }
      const duration = metadata.format?.duration || 0;
      resolve(duration);
    });
  });
}

/**
 * Core helper to change playback speed of a segment and concatenate
 * [0:start] + [start:end] at speed factor + [end:total]
 */
async function changeSpeedSegment(inputPath, start, end, speedFactor, outputPath, isPreview = false) {
  const tempDir = tmpdir();
  const tempFiles = [];

  try {
    const totalDuration = await getVideoDuration(inputPath);

    const startSeconds = typeof start === 'number' ? start : parseFloat(start);
    const endSeconds = typeof end === 'number' ? end : parseFloat(end);
    const speed = typeof speedFactor === 'number' ? speedFactor : parseFloat(speedFactor);

    if (
      !isFinite(startSeconds) ||
      !isFinite(endSeconds) ||
      startSeconds < 0 ||
      endSeconds <= startSeconds ||
      !isFinite(speed) ||
      speed <= 0
    ) {
      throw new Error('Invalid start/end times for speed change');
    }

    const segmentDuration = endSeconds - startSeconds;

    const encodingPreset = isPreview ? 'ultrafast' : 'medium';
    const crfValue = isPreview ? '28' : '23';

    const segments = [];

    // Helper to build chained atempo filters so we support any speed factor
    const buildAtempoFilter = (s) => {
      if (s <= 0) throw new Error('Speed must be > 0');
      const chain = [];
      let remaining = s;

      // For slowing down more than 0.5x, apply multiple 0.5x steps
      while (remaining < 0.5) {
        chain.push(0.5);
        remaining /= 0.5;
      }

      // For speeding up more than 2x, apply multiple 2x steps
      while (remaining > 2.0) {
        chain.push(2.0);
        remaining /= 2.0;
      }

      chain.push(remaining);
      return 'atempo=' + chain.join(',atempo=');
    };

    // Part 1: 0 -> start (normal speed)
    if (startSeconds > 0.01) {
      const part1Path = join(tempDir, `speed-part1-${Date.now()}-${Math.random().toString(36).slice(2)}.mp4`);
      tempFiles.push(part1Path);

      await new Promise((resolve, reject) => {
        ffmpeg(inputPath)
          .setStartTime(0)
          .setDuration(startSeconds)
          .videoCodec('libx264')
          .audioCodec('aac')
          .addOption('-preset', encodingPreset)
          .addOption('-crf', crfValue)
          .addOption('-movflags', '+faststart')
          .outputOptions('-y')
          .output(part1Path)
          .on('end', resolve)
          .on('error', reject)
          .run();
      });

      segments.push(part1Path);
    }

    // Part 2: start -> end with speed change
    // Step 1: cleanly extract the segment into its own temp file
    const rawSegmentPath = join(
      tempDir,
      `speed-segment-raw-${Date.now()}-${Math.random().toString(36).slice(2)}.mp4`
    );
    tempFiles.push(rawSegmentPath);

    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .setStartTime(startSeconds)
        .setDuration(segmentDuration)
        .videoCodec('libx264')
        .audioCodec('aac')
        .addOption('-preset', encodingPreset)
        .addOption('-crf', crfValue)
        .addOption('-movflags', '+faststart')
        .outputOptions('-y')
        .output(rawSegmentPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });

    // Step 2: apply speed change to that trimmed segment only
    const part2Path = join(tempDir, `speed-part2-${Date.now()}-${Math.random().toString(36).slice(2)}.mp4`);
    tempFiles.push(part2Path);

    await new Promise((resolve, reject) => {
      ffmpeg(rawSegmentPath)
        .videoCodec('libx264')
        .audioCodec('aac')
        // Change playback speed for this segment only. We keep FPS the same
        // and stretch/compress time using PTS so frames are not skipped.
        .videoFilters(`setpts=${1 / speed}*PTS`)
        .audioFilters(buildAtempoFilter(speed))
        .addOption('-preset', encodingPreset)
        .addOption('-crf', crfValue)
        .addOption('-movflags', '+faststart')
        .outputOptions('-y')
        .output(part2Path)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });

    segments.push(part2Path);

    // Part 3: end -> total (normal speed)
    if (endSeconds < totalDuration - 0.01) {
      const part3Path = join(tempDir, `speed-part3-${Date.now()}-${Math.random().toString(36).slice(2)}.mp4`);
      tempFiles.push(part3Path);

      await new Promise((resolve, reject) => {
        ffmpeg(inputPath)
          .setStartTime(endSeconds)
          .setDuration(totalDuration - endSeconds)
          .videoCodec('libx264')
          .audioCodec('aac')
          .addOption('-preset', encodingPreset)
          .addOption('-crf', crfValue)
          .addOption('-movflags', '+faststart')
          .outputOptions('-y')
          .output(part3Path)
          .on('end', resolve)
          .on('error', reject)
          .run();
      });

      segments.push(part3Path);
    }

    // Concat all segments using concat demuxer
    const concatFile = join(tempDir, `speed-concat-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`);
    tempFiles.push(concatFile);

    const concatContent = segments
      .map(p => {
        const escaped = p.replace(/\\/g, '/').replace(/'/g, "\\'");
        return `file '${escaped}'`;
      })
      .join('\n');

    writeFileSync(concatFile, concatContent, 'utf8');

    // Final re-encode so container duration and timestamps match new total length
    const finalEncodingOptions = isPreview
      ? [
          '-c:v', 'libx264',
          '-preset', 'ultrafast',
          '-crf', '28',
          '-c:a', 'aac',
          '-b:a', '128k',
          '-movflags', '+faststart',
          '-avoid_negative_ts', 'make_zero',
          '-y',
        ]
      : [
          '-c:v', 'libx264',
          '-preset', 'medium',
          '-crf', '23',
          '-c:a', 'aac',
          '-b:a', '192k',
          '-movflags', '+faststart',
          '-avoid_negative_ts', 'make_zero',
          '-y',
        ];

    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(concatFile)
        .inputOptions(['-f', 'concat', '-safe', '0'])
        .outputOptions(finalEncodingOptions)
        .output(outputPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });

    return outputPath;
  } finally {
    // Do not delete outputPath, only temp segments/concat
    tempFiles.forEach((p) => {
      try {
        if (existsSync(p)) unlinkSync(p);
      } catch (err) {
        console.error('Error deleting temp speed file:', err);
      }
    });
  }
}

export function registerSpeedChangeHandlers(ipcMain, dialog) {
  // Export final video with speed-changed segment
  ipcMain.handle('export-speed-change', async (event, { inputPath, start, end, speed }) => {
    if (!inputPath || start === undefined || end === undefined || !speed) {
      return { canceled: true, error: 'Missing required parameters' };
    }

    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Export Speed Adjusted Video',
      defaultPath: 'speed-changed-video.mp4',
      filters: [{ name: 'MP4 Video', extensions: ['mp4'] }],
    });

    if (canceled || !filePath) {
      return { canceled: true };
    }

    try {
      await changeSpeedSegment(inputPath, start, end, speed, filePath, false);
      return { canceled: false, filePath };
    } catch (err) {
      console.error('Error exporting speed-changed video:', err);
      return { canceled: false, error: err.message || String(err) };
    }
  });

  // Create preview file with speed-changed segment (temporary)
  ipcMain.handle('create-preview-speed-change', async (event, { inputPath, start, end, speed }) => {
    if (!inputPath || start === undefined || end === undefined || !speed) {
      return { error: 'Missing required parameters' };
    }

    const tempDir = tmpdir();
    const tempFilePath = join(
      tempDir,
      `clipstudio-speed-preview-${Date.now()}-${Math.random().toString(36).substring(7)}.mp4`
    );

    try {
      await changeSpeedSegment(inputPath, start, end, speed, tempFilePath, true);
      tempPreviewFiles.add(tempFilePath);
      return { filePath: tempFilePath };
    } catch (err) {
      console.error('Error creating speed preview:', err);
      return { error: err.message || String(err) };
    }
  });

  ipcMain.handle('cleanup-speed-preview-video', async (event, { filePath }) => {
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

export function cleanupSpeedTempFiles() {
  tempPreviewFiles.forEach((filePath) => {
    try {
      if (existsSync(filePath)) {
        unlinkSync(filePath);
      }
    } catch (err) {
      console.error('Error cleaning up speed temp file:', err);
    }
  });
  tempPreviewFiles.clear();
}

