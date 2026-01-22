import ffmpeg from 'fluent-ffmpeg';
import { tmpdir } from 'os';
import { existsSync, unlinkSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

// Track temporary preview files for cleanup
const tempPreviewFiles = new Set();

/**
 * Get audio metadata (duration, sample rate, etc.) using FFprobe
 */
function getAudioMetadata(audioPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(audioPath, (err, metadata) => {
      if (err) {
        reject(err);
        return;
      }

      const audioStream = metadata.streams.find(s => s.codec_type === 'audio');
      const duration = metadata.format.duration || 0;
      const sampleRate = audioStream?.sample_rate || 44100;
      const channels = audioStream?.channels || 2;
      const bitrate = metadata.format.bit_rate || 0;

      resolve({
        duration,
        durationFormatted: formatDuration(duration),
        sampleRate,
        channels,
        bitrate,
        metadata // Full metadata
      });
    });
  });
}

/**
 * Format duration in seconds to HH:MM:SS
 */
function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return '00:00:00';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Get video metadata to check if it has audio
 */
function getVideoMetadata(videoPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(metadata);
    });
  });
}

/**
 * Check if video has audio stream
 */
function hasAudioStream(metadata) {
  return metadata?.streams?.some(s => s.codec_type === 'audio') || false;
}

/**
 * Parse HH:MM:SS time format to seconds
 */
function parseHMSToSeconds(timeStr) {
  if (!timeStr) return 0;
  const parts = timeStr.split(':').map(p => parseInt(p, 10));
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return 0;
}

/**
 * Generate waveform data from audio file
 * Returns an array of amplitude values (normalized 0-1) for visualization
 */
function generateWaveform(audioPath, samples = 200) {
  return new Promise((resolve, reject) => {
    const tempDir = tmpdir();
    const tempRawFile = join(tempDir, `waveform-${Date.now()}-${Math.random().toString(36).substring(7)}.raw`);

    // Extract audio as raw PCM data (16-bit signed integers, mono)
    ffmpeg(audioPath)
      .audioChannels(1) // Convert to mono
      .audioFrequency(8000) // Downsample to 8kHz for faster processing
      .format('s16le') // 16-bit signed little-endian PCM
      .output(tempRawFile)
      .on('start', (commandLine) => {
        console.log('FFmpeg waveform command:', commandLine);
      })
      .on('error', (err) => {
        console.error('Waveform generation error:', err);
        // Clean up temp file if it exists
        if (existsSync(tempRawFile)) {
          try {
            unlinkSync(tempRawFile);
          } catch (e) {
            console.error('Error deleting temp waveform file:', e);
          }
        }
        reject(err);
      })
      .on('end', () => {
        try {
          // Read the raw audio data
          const rawData = readFileSync(tempRawFile);
          
          // Clean up temp file
          unlinkSync(tempRawFile);

          // Process raw PCM data (16-bit signed integers)
          // Each sample is 2 bytes (16-bit)
          const sampleCount = Math.floor(rawData.length / 2);
          const samplesPerPoint = Math.max(1, Math.floor(sampleCount / samples));
          
          const waveform = [];
          let maxAmplitude = 0;

          // Calculate RMS (Root Mean Square) for each segment
          for (let i = 0; i < samples; i++) {
            const startIdx = i * samplesPerPoint * 2;
            const endIdx = Math.min(startIdx + samplesPerPoint * 2, rawData.length);
            
            if (startIdx >= rawData.length) {
              waveform.push(0);
              continue;
            }

            let sumSquares = 0;
            let count = 0;

            for (let j = startIdx; j < endIdx; j += 2) {
              // Read 16-bit signed integer (little-endian)
              const sample = rawData.readInt16LE(j);
              sumSquares += sample * sample;
              count++;
            }

            if (count > 0) {
              const rms = Math.sqrt(sumSquares / count);
              // Normalize to 0-1 range (16-bit audio range is -32768 to 32767)
              const normalized = Math.min(1, rms / 32768);
              waveform.push(normalized);
              maxAmplitude = Math.max(maxAmplitude, normalized);
            } else {
              waveform.push(0);
            }
          }

          // Normalize all values relative to max amplitude for better visualization
          if (maxAmplitude > 0) {
            for (let i = 0; i < waveform.length; i++) {
              waveform[i] = waveform[i] / maxAmplitude;
            }
          }

          resolve(waveform);
        } catch (err) {
          console.error('Error processing waveform data:', err);
          reject(err);
        }
      })
      .run();
  });
}

/**
 * Register IPC handlers related to the Add Audio feature.
 */
export function registerAddAudioHandlers(ipcMain, dialog) {
  // IPC handler for selecting an audio file
  ipcMain.handle('select-audio-file', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Select Audio File',
      filters: [
        { name: 'Audio Files', extensions: ['mp3', 'wav', 'aac', 'm4a', 'ogg', 'flac', 'wma'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile']
    });

    if (canceled || filePaths.length === 0) {
      return { canceled: true };
    }

    return { canceled: false, filePath: filePaths[0] };
  });

  // IPC handler for getting audio metadata
  ipcMain.handle('get-audio-metadata', async (event, { audioPath }) => {
    if (!audioPath) {
      return { error: 'No audio path provided' };
    }

    try {
      const metadata = await getAudioMetadata(audioPath);
      return {
        duration: metadata.duration,
        durationFormatted: metadata.durationFormatted,
        sampleRate: metadata.sampleRate,
        channels: metadata.channels,
        bitrate: metadata.bitrate
      };
    } catch (err) {
      console.error('Error getting audio metadata:', err);
      return { error: err.message || 'Failed to get audio metadata' };
    }
  });

  // IPC handler for generating waveform data
  ipcMain.handle('generate-audio-waveform', async (event, { audioPath, samples }) => {
    if (!audioPath) {
      return { error: 'No audio path provided' };
    }

    try {
      const waveform = await generateWaveform(audioPath, samples || 200);
      return { waveform };
    } catch (err) {
      console.error('Error generating waveform:', err);
      return { error: err.message || 'Failed to generate waveform' };
    }
  });

  // IPC handler for adding audio to video (export)
  ipcMain.handle('export-add-audio', async (event, options) => {
    const {
      videoPath,
      audioPath,
      volume, // 0-100
      audioStart, // HH:MM:SS format
      audioEnd, // HH:MM:SS format
      loopAudio,
      placementMode // 'start' or 'custom'
    } = options;

    if (!videoPath || !audioPath) {
      return { canceled: true, error: 'Missing required parameters' };
    }

    // Ask user where to save the output video
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Export Video with Audio',
      defaultPath: 'video-with-audio.mp4',
      filters: [{ name: 'MP4 Video', extensions: ['mp4'] }],
    });

    if (canceled || !filePath) {
      return { canceled: true };
    }

    try {
      await addAudioToVideo({
        videoPath,
        audioPath,
        outputPath: filePath,
        volume,
        audioStart,
        audioEnd,
        loopAudio,
        placementMode,
        isPreview: false
      });

      return { canceled: false, filePath };
    } catch (err) {
      console.error('Error adding audio to video:', err);
      return { canceled: false, error: err.message || 'Failed to add audio to video' };
    }
  });

  // IPC handler for creating preview video with audio
  ipcMain.handle('create-preview-add-audio', async (event, options) => {
    const {
      videoPath,
      audioPath,
      volume,
      audioStart,
      audioEnd,
      loopAudio,
      placementMode
    } = options;

    if (!videoPath || !audioPath) {
      return { error: 'Missing required parameters' };
    }

    // Create temporary file path
    const tempDir = tmpdir();
    const tempFilePath = join(
      tempDir,
      `clipstudio-audio-preview-${Date.now()}-${Math.random().toString(36).substring(7)}.mp4`
    );

    try {
      await addAudioToVideo({
        videoPath,
        audioPath,
        outputPath: tempFilePath,
        volume,
        audioStart,
        audioEnd,
        loopAudio,
        placementMode,
        isPreview: true
      });

      tempPreviewFiles.add(tempFilePath);
      return { filePath: tempFilePath };
    } catch (err) {
      console.error('Error creating preview:', err);
      return { error: err.message || 'Failed to create preview' };
    }
  });

  // IPC handler for cleaning up preview file
  ipcMain.handle('cleanup-add-audio-preview', async (event, { filePath }) => {
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
 * Add audio to video with specified options
 */
async function addAudioToVideo({
  videoPath,
  audioPath,
  outputPath,
  volume, // 0-100
  audioStart, // HH:MM:SS
  audioEnd, // HH:MM:SS
  loopAudio,
  placementMode, // 'start' or 'custom'
  isPreview
}) {
  return new Promise(async (resolve, reject) => {
    try {
      // Get video metadata to check if it has audio
      const videoMetadata = await getVideoMetadata(videoPath);
      const videoHasAudio = hasAudioStream(videoMetadata);
      const videoDuration = videoMetadata.format.duration || 0;

      // Get audio metadata
      const audioMetadata = await getAudioMetadata(audioPath);
      const audioDuration = audioMetadata.duration;

      // Parse video timeline times (when audio should start/end in the video)
      let videoStartSeconds = 0; // When in the video to start the audio
      let videoEndSeconds = videoDuration; // When in the video to end the audio

      if (placementMode === 'custom' && audioStart && audioEnd) {
        videoStartSeconds = parseHMSToSeconds(audioStart);
        videoEndSeconds = parseHMSToSeconds(audioEnd);
      }

      // Calculate how long the audio should play in the video
      const audioPlayDuration = videoEndSeconds - videoStartSeconds;

      // Convert volume from 0-100 to 0.0-1.0 for FFmpeg
      const volumeFactor = volume / 100;

      // Build FFmpeg command
      const command = ffmpeg(videoPath);

      // Add audio input
      command.input(audioPath);

      // Build complex filter for audio processing
      const filters = [];

      if (videoHasAudio) {
        // Video has audio - mix both audio streams
        if (placementMode === 'custom' && videoStartSeconds > 0 && videoEndSeconds < videoDuration) {
          // Custom placement: mix audio only during specified time range
          const customStart = Math.max(0, Math.min(videoStartSeconds, videoDuration));
          const customEnd = Math.max(customStart, Math.min(videoEndSeconds, videoDuration));
          const customDuration = customEnd - customStart;
          
          const audioSegments = [];
          let segmentCount = 0;
          
          // Segment 1: Before custom placement - original video audio only
          if (customStart > 0.1) {
            filters.push(`[0:a]atrim=start=0:end=${customStart},asetpts=PTS-STARTPTS[a_before]`);
            audioSegments.push('a_before');
            segmentCount++;
          }
          
          // Segment 2: During custom placement - mix video audio with inserted audio
          if (customDuration > 0.1) {
            // Video audio segment for mixing
            filters.push(`[0:a]atrim=start=${customStart}:end=${customEnd},asetpts=PTS-STARTPTS[video_seg]`);
            
            // Inserted audio segment - loop if needed
            let insertedAudioFilter = `[1:a]volume=${volumeFactor}`;
            if (loopAudio && audioDuration < customDuration) {
              insertedAudioFilter += `,aloop=loop=-1:size=2147483647:start=0`;
            }
            insertedAudioFilter += `,atrim=start=0:end=${customDuration},asetpts=PTS-STARTPTS[inserted_seg]`;
            filters.push(insertedAudioFilter);
            
            // Normalize both
            filters.push(`[video_seg]aformat=sample_rates=44100:channel_layouts=stereo[video_norm]`);
            filters.push(`[inserted_seg]aformat=sample_rates=44100:channel_layouts=stereo[inserted_norm]`);
            
            // Mix during segment (video audio is main, inserted is background)
            filters.push(`[video_norm][inserted_norm]amix=inputs=2:duration=longest:dropout_transition=0:normalize=0[a_during]`);
            audioSegments.push('a_during');
            segmentCount++;
          }
          
          // Segment 3: After custom placement - original video audio only
          if (customEnd < videoDuration - 0.1) {
            filters.push(`[0:a]atrim=start=${customEnd}:end=${videoDuration},asetpts=PTS-STARTPTS[a_after]`);
            audioSegments.push('a_after');
            segmentCount++;
          }
          
          // Concatenate all segments
          if (segmentCount > 1) {
            filters.push(`[${audioSegments.join('][')}]concat=n=${segmentCount}:v=0:a=1[mixed]`);
          } else if (segmentCount === 1) {
            filters.push(`[${audioSegments[0]}]copy[mixed]`);
          } else {
            filters.push(`[0:a]copy[mixed]`);
          }
        } else {
          // Standard mixing - "Start from beginning"
          if (loopAudio) {
            // Loop enabled: mix inserted audio (looped) with video audio for full duration
            filters.push(`[0:a]aformat=sample_rates=44100:channel_layouts=stereo[video_norm]`);
            
            // Loop inserted audio to match video duration
            let insertedAudioFilter = `[1:a]volume=${volumeFactor}`;
            if (audioDuration < videoDuration) {
              insertedAudioFilter += `,aloop=loop=-1:size=2147483647:start=0`;
            }
            insertedAudioFilter += `,atrim=start=0:end=${videoDuration},asetpts=PTS-STARTPTS,aformat=sample_rates=44100:channel_layouts=stereo[inserted_norm]`;
            filters.push(insertedAudioFilter);
            
            // Mix original video audio with new audio (background) for full duration
            filters.push(`[video_norm][inserted_norm]amix=inputs=2:duration=longest:dropout_transition=0:normalize=0[mixed]`);
          } else {
            // No loop: inserted audio plays for its duration (or video duration if audio is longer), then only video audio continues
            const audioSegments = [];
            let segmentCount = 0;
            
            // Segment 1: Mix inserted audio with video audio
            if (audioDuration > 0.1 && audioDuration <= videoDuration) {
              // Audio is shorter or equal to video: use full audio duration
              // Video audio for first segment (audio duration)
              filters.push(`[0:a]atrim=start=0:end=${audioDuration},asetpts=PTS-STARTPTS,aformat=sample_rates=44100:channel_layouts=stereo[video_seg1]`);
              
              // Inserted audio (no loop)
              let insertedAudioFilter = `[1:a]volume=${volumeFactor},atrim=start=0:end=${audioDuration},asetpts=PTS-STARTPTS,aformat=sample_rates=44100:channel_layouts=stereo[inserted_seg1]`;
              filters.push(insertedAudioFilter);
              
              // Mix them
              filters.push(`[video_seg1][inserted_seg1]amix=inputs=2:duration=longest:dropout_transition=0:normalize=0[a_seg1]`);
              audioSegments.push('a_seg1');
              segmentCount++;
            } else if (audioDuration > videoDuration) {
              // Audio is longer than video (e.g., 10s audio, 5s video): trim audio to video duration and mix
              filters.push(`[0:a]aformat=sample_rates=44100:channel_layouts=stereo[video_norm]`);
              let insertedAudioFilter = `[1:a]volume=${volumeFactor},atrim=start=0:end=${videoDuration},asetpts=PTS-STARTPTS,aformat=sample_rates=44100:channel_layouts=stereo[inserted_norm]`;
              filters.push(insertedAudioFilter);
              filters.push(`[video_norm][inserted_norm]amix=inputs=2:duration=longest:dropout_transition=0:normalize=0[mixed]`);
              segmentCount = 0; // Use direct mixing, not segments
            }
            
            // Segment 2: Only video audio for remaining duration (if audio is shorter than video)
            if (audioDuration < videoDuration - 0.1 && segmentCount > 0) {
              const remainingDuration = videoDuration - audioDuration;
              filters.push(`[0:a]atrim=start=${audioDuration}:end=${videoDuration},asetpts=PTS-STARTPTS,aformat=sample_rates=44100:channel_layouts=stereo[a_seg2]`);
              audioSegments.push('a_seg2');
              segmentCount++;
            }
            
            // Concatenate segments if we have multiple
            if (segmentCount > 1) {
              filters.push(`[${audioSegments.join('][')}]concat=n=${segmentCount}:v=0:a=1[mixed]`);
            } else if (segmentCount === 1) {
              filters.push(`[${audioSegments[0]}]copy[mixed]`);
            }
            // If segmentCount is 0, we already have [mixed] from the direct mixing case
          }
        }

        command.complexFilter(filters);
        command.outputOptions([
          '-map', '0:v', // Map video stream
          '-map', '[mixed]', // Map mixed audio
          '-c:v', 'copy', // Copy video codec
          '-c:a', 'aac', // Encode audio as AAC
          '-b:a', isPreview ? '128k' : '192k', // Audio bitrate
          '-t', String(videoDuration) // Use video duration, not shortest
        ]);
      } else {
        // Video has no audio - just add the new audio
        if (placementMode === 'custom' && videoStartSeconds > 0) {
          // Custom placement: need to create silence before audio starts
          const audioSegments = [];
          let segmentCount = 0;
          
          // Segment 1: Silence before audio starts
          if (videoStartSeconds > 0.1) {
            filters.push(`anullsrc=channel_layout=stereo:sample_rate=44100,atrim=start=0:end=${videoStartSeconds},asetpts=PTS-STARTPTS[silence_before]`);
            audioSegments.push('silence_before');
            segmentCount++;
          }
          
          // Segment 2: Inserted audio
          let insertedAudioFilter = `[1:a]volume=${volumeFactor}`;
          if (loopAudio && audioDuration < audioPlayDuration) {
            insertedAudioFilter += `,aloop=loop=-1:size=2147483647:start=0`;
          }
          const audioEndTime = Math.min(audioPlayDuration, videoDuration - videoStartSeconds);
          insertedAudioFilter += `,atrim=start=0:end=${audioEndTime},asetpts=PTS-STARTPTS[inserted_audio]`;
          filters.push(insertedAudioFilter);
          audioSegments.push('inserted_audio');
          segmentCount++;
          
          // Segment 3: Silence after audio (if needed)
          const remainingDuration = videoDuration - videoStartSeconds - audioEndTime;
          if (remainingDuration > 0.1) {
            filters.push(`anullsrc=channel_layout=stereo:sample_rate=44100,atrim=start=0:end=${remainingDuration},asetpts=PTS-STARTPTS[silence_after]`);
            audioSegments.push('silence_after');
            segmentCount++;
          }
          
          // Concatenate all segments
          if (segmentCount > 1) {
            filters.push(`[${audioSegments.join('][')}]concat=n=${segmentCount}:v=0:a=1[audio_out]`);
          } else {
            filters.push(`[${audioSegments[0]}]copy[audio_out]`);
          }
        } else {
          // Start from beginning - "Start from beginning" mode
          if (loopAudio) {
            // Loop enabled: loop inserted audio until video ends
            let audioFilter = `[1:a]volume=${volumeFactor}`;
            if (audioDuration < videoDuration) {
              audioFilter += `,aloop=loop=-1:size=2147483647:start=0`;
            }
            audioFilter += `,atrim=start=0:end=${videoDuration},asetpts=PTS-STARTPTS[audio_out]`;
            filters.push(audioFilter);
          } else {
            // No loop: inserted audio plays for its duration (or video duration if audio is longer), then silence
            const audioSegments = [];
            let segmentCount = 0;
            
            // Segment 1: Inserted audio
            if (audioDuration > 0.1 && audioDuration <= videoDuration) {
              // Audio is shorter or equal to video: use full audio duration
              let insertedAudioFilter = `[1:a]volume=${volumeFactor},atrim=start=0:end=${audioDuration},asetpts=PTS-STARTPTS[audio_seg1]`;
              filters.push(insertedAudioFilter);
              audioSegments.push('audio_seg1');
              segmentCount++;
            } else if (audioDuration > videoDuration) {
              // Audio is longer than video (e.g., 10s audio, 5s video): trim audio to video duration
              let audioFilter = `[1:a]volume=${volumeFactor},atrim=start=0:end=${videoDuration},asetpts=PTS-STARTPTS[audio_out]`;
              filters.push(audioFilter);
              segmentCount = 0; // Use direct output, not segments
            }
            
            // Segment 2: Silence for remaining duration (if audio is shorter than video)
            if (audioDuration < videoDuration - 0.1 && segmentCount > 0) {
              const remainingDuration = videoDuration - audioDuration;
              filters.push(`anullsrc=channel_layout=stereo:sample_rate=44100,atrim=start=0:end=${remainingDuration},asetpts=PTS-STARTPTS[silence_seg2]`);
              audioSegments.push('silence_seg2');
              segmentCount++;
            }
            
            // Concatenate segments if we have multiple
            if (segmentCount > 1) {
              filters.push(`[${audioSegments.join('][')}]concat=n=${segmentCount}:v=0:a=1[audio_out]`);
            } else if (segmentCount === 1) {
              filters.push(`[${audioSegments[0]}]copy[audio_out]`);
            }
            // If segmentCount is 0, we already have [audio_out] from the direct case
          }
        }

        command.complexFilter(filters);
        command.outputOptions([
          '-map', '0:v', // Map video stream
          '-map', '[audio_out]', // Map processed audio
          '-c:v', 'copy', // Copy video codec
          '-c:a', 'aac', // Encode audio as AAC
          '-b:a', isPreview ? '128k' : '192k', // Audio bitrate
          '-t', String(videoDuration) // Use video duration, not shortest
        ]);
      }

      // For export (not preview), add faststart flag for web playback
      if (!isPreview) {
        command.outputOptions(['-movflags', '+faststart']);
      }

      command
        .outputOptions('-y') // Overwrite output
        .output(outputPath)
        .on('start', (commandLine) => {
          console.log('FFmpeg add audio command:', commandLine);
        })
        .on('progress', (progress) => {
          console.log('FFmpeg progress:', progress.percent ? `${progress.percent}%` : 'processing...');
        })
        .on('error', (err, stdout, stderr) => {
          console.error('FFmpeg error:', err);
          console.error('FFmpeg stderr:', stderr);
          reject(new Error(`FFmpeg error: ${err.message || err}`));
        })
        .on('end', () => {
          console.log('Audio added to video successfully:', outputPath);
          // Verify file exists
          if (existsSync(outputPath)) {
            const stats = statSync(outputPath);
            console.log('Output file size:', stats.size, 'bytes');
            resolve();
          } else {
            reject(new Error('Output file was not created'));
          }
        })
        .run();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Cleanup all temporary preview files
 */
export function cleanupAddAudioTempFiles() {
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
