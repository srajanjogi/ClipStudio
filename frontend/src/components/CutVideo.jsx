import React, { useState, useEffect, useRef } from 'react';
import FileUpload from './FileUpload';
import './CutVideo.css';

function CutVideo({ onBack }) {
  const [showUpload, setShowUpload] = useState(true);
  const [selectedFile, setSelectedFile] = useState(null);
  const [startTime, setStartTime] = useState('00:00.00');
  const [endTime, setEndTime] = useState('00:10.00');

  const videoRef = useRef(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [previewVideoUrl, setPreviewVideoUrl] = useState(null);
  const [previewTempFilePath, setPreviewTempFilePath] = useState(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isCreatingPreview, setIsCreatingPreview] = useState(false);
  const [durationDisplay, setDurationDisplay] = useState('');
  const [resolutionDisplay, setResolutionDisplay] = useState('');
  const [videoDurationSeconds, setVideoDurationSeconds] = useState(null);

  const handleFileUpload = (file) => {
    // File object from FileUpload may have a path property if Electron API was used
    setSelectedFile({
      file: file,
      name: file.name,
      path: file.path, // This will be set if Electron native dialog was used
      duration: '02:45:30',
      resolution: '1920x1080 (1080p)'
    });
    setShowUpload(false);
  };

  useEffect(() => {
    if (selectedFile?.file) {
      // If we have a file path, use file:// URL (webSecurity is disabled)
      if (selectedFile.path) {
        // Convert Windows backslashes to forward slashes for URL
        const pathForUrl = selectedFile.path.replace(/\\/g, '/');
        // Use file:// protocol (works with webSecurity: false)
        setVideoUrl(`file:///${pathForUrl}`);
      } else if (selectedFile.file instanceof File) {
        const url = URL.createObjectURL(selectedFile.file);
        setVideoUrl(url);
        return () => {
          URL.revokeObjectURL(url);
        };
      } else {
        setVideoUrl(null);
      }
    } else {
      setVideoUrl(null);
    }
  }, [selectedFile]);

  // Support MM:SS.MS (2-digit milliseconds) - minutes, seconds, milliseconds only
  const parseTimeToSeconds = (time) => {
    if (!time) return NaN;
    const [ms, msPart] = time.split('.');
    const parts = ms.split(':').map((p) => parseInt(p, 10));
    // Support both MM:SS and HH:MM:SS formats for backward compatibility
    if (parts.length === 2) {
      // MM:SS format
      const [mm, ss] = parts;
      let milliseconds = 0;
      if (msPart) {
        if (!/^\d{1,3}$/.test(msPart)) return NaN;
        const msValue = parseInt(msPart, 10);
        milliseconds = msPart.length === 2 ? msValue * 10 : msValue;
      }
      return mm * 60 + ss + milliseconds / 1000;
    } else if (parts.length === 3) {
      // HH:MM:SS format (for backward compatibility)
      const [hh, mm, ss] = parts;
      let milliseconds = 0;
      if (msPart) {
        if (!/^\d{1,3}$/.test(msPart)) return NaN;
        const msValue = parseInt(msPart, 10);
        milliseconds = msPart.length === 2 ? msValue * 10 : msValue;
      }
      return hh * 3600 + mm * 60 + ss + milliseconds / 1000;
    }
    return NaN;
  };

  const formatSecondsToTime = (seconds) => {
    const clamped = Math.max(0, seconds);
    const totalMs = Math.round(clamped * 1000);
    const wholeSeconds = Math.floor(totalMs / 1000);
    // Format as MM:SS.MS (minutes:seconds.milliseconds)
    const mm = String(Math.floor(wholeSeconds / 60)).padStart(2, '0');
    const ss = String(wholeSeconds % 60).padStart(2, '0');
    const ms = String(Math.floor((totalMs % 1000) / 10)).padStart(2, '0'); // 2-digit milliseconds
    return `${mm}:${ss}.${ms}`;
  };

  // Format for timeline labels: HH:MM:SS (no milliseconds)
  // Format for timeline markers: MM:SS (no milliseconds)
  // Format for timeline markers: MM:SS (no milliseconds)
  const formatSecondsToHMS = (seconds) => {
    const clamped = Math.max(0, Math.floor(seconds));
    const mm = String(Math.floor(clamped / 60)).padStart(2, '0');
    const ss = String(clamped % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  };

  const handlePreview = async () => {
    const filePath = selectedFile?.path || selectedFile?.file?.path;
    if (!filePath) {
      alert('No video selected or file path not available. Please select a video file.');
      return;
    }

    const startSec = parseTimeToSeconds(startTime);
    const endSec = parseTimeToSeconds(endTime);
    if (isNaN(startSec) || isNaN(endSec) || endSec <= startSec) {
      alert('Please enter a valid start and end time.');
      return;
    }

    if (!window.electronAPI || !window.electronAPI.createPreviewVideo) {
      alert('Preview is not available in this environment.');
      return;
    }

    setIsCreatingPreview(true);

    try {
      // Clean up previous preview file if exists
      if (previewTempFilePath && window.electronAPI.cleanupPreviewVideo) {
        await window.electronAPI.cleanupPreviewVideo({ filePath: previewTempFilePath });
      }

      // Create trimmed preview video using FFmpeg
      const filePath = selectedFile.path || selectedFile.file.path;
      const result = await window.electronAPI.createPreviewVideo({
        inputPath: filePath,
        start: startSec,
        end: endSec,
        duration: endSec - startSec,
      });

      if (result.error) {
        console.error(result.error);
        alert('Failed to create preview. Check console for details.');
        setIsCreatingPreview(false);
        return;
      }

      // Create a URL for the temporary video using file:// protocol
      // Convert Windows backslashes to forward slashes for URL
      const pathForUrl = result.filePath.replace(/\\/g, '/');
      const previewUrl = `file:///${pathForUrl}`;
      setPreviewVideoUrl(previewUrl);
      setPreviewTempFilePath(result.filePath);
      setIsPreviewMode(true);
      setIsPreviewing(true);
      setIsCreatingPreview(false);

      // Play the preview video once it loads
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.currentTime = 0;
          videoRef.current.play();
        }
      }, 100);
    } catch (err) {
      console.error(err);
      alert('Failed to create preview due to an unexpected error.');
      setIsCreatingPreview(false);
    }
  };

  const handleExitPreview = async () => {
    // Clean up temporary preview file
    if (previewTempFilePath && window.electronAPI?.cleanupPreviewVideo) {
      try {
        await window.electronAPI.cleanupPreviewVideo({ filePath: previewTempFilePath });
      } catch (err) {
        console.error('Error cleaning up preview file:', err);
      }
    }

    setPreviewVideoUrl(null);
    setPreviewTempFilePath(null);
    setIsPreviewMode(false);
    setIsPreviewing(false);

    // Reset video to original
    if (videoRef.current) {
      videoRef.current.currentTime = startSeconds;
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (previewTempFilePath && window.electronAPI?.cleanupPreviewVideo) {
        window.electronAPI.cleanupPreviewVideo({ filePath: previewTempFilePath }).catch(console.error);
      }
    };
  }, [previewTempFilePath]);

  // Derived segment times
  const startSeconds = (() => {
    const s = parseTimeToSeconds(startTime);
    return isNaN(s) ? 0 : s;
  })();

  const endSeconds = (() => {
    const s = parseTimeToSeconds(endTime);
    if (isNaN(s)) return startSeconds + 1;
    return s;
  })();

  const effectiveDuration = videoDurationSeconds || Math.max(endSeconds, startSeconds + 1);
  const segmentDuration = Math.max(endSeconds - startSeconds, 0);
  const displayDuration =
    isPreviewMode && segmentDuration > 0 ? segmentDuration : effectiveDuration;

  const displayStartSeconds = isPreviewMode ? 0 : startSeconds;
  const displayEndSeconds = isPreviewMode ? segmentDuration : endSeconds;

  // Update duration & resolution when metadata loads
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;

    const onLoadedMetadata = () => {
      if (!isNaN(vid.duration)) {
        const totalSeconds = Math.floor(vid.duration);
        const hh = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
        const mm = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
        const ss = String(totalSeconds % 60).padStart(2, '0');
        
        // In preview mode, the video is already trimmed, so use its actual duration
        // In normal mode, use the full video duration
        if (!isPreviewMode) {
          setDurationDisplay(`${hh}:${mm}:${ss}`);
          setVideoDurationSeconds(totalSeconds);
        }
      }

      if (vid.videoWidth && vid.videoHeight) {
        setResolutionDisplay(`${vid.videoWidth}x${vid.videoHeight} (${vid.videoHeight}p)`);
      }
    };

    vid.addEventListener('loadedmetadata', onLoadedMetadata);
    return () => {
      vid.removeEventListener('loadedmetadata', onLoadedMetadata);
    };
  }, [videoUrl, previewVideoUrl, isPreviewMode]);

  // Update video source when preview mode changes
  useEffect(() => {
    if (videoRef.current) {
      if (isPreviewMode && previewVideoUrl) {
        // Use trimmed preview video
        videoRef.current.src = previewVideoUrl;
        videoRef.current.load();
      } else if (videoUrl) {
        // Use original video
        videoRef.current.src = videoUrl;
        videoRef.current.load();
      }
    }
  }, [isPreviewMode, previewVideoUrl, videoUrl]);

  const handleExport = async () => {
    const filePath = selectedFile?.path || selectedFile?.file?.path;
    if (!filePath) {
      alert('No video selected or file path not available. Please select a video file.');
      return;
    }

    if (!window.electronAPI || !window.electronAPI.exportCutVideo) {
      alert('Export is not available in this environment.');
      return;
    }

    try {
      const startSec = parseTimeToSeconds(startTime);
      const endSec = parseTimeToSeconds(endTime);
      if (isNaN(startSec) || isNaN(endSec) || endSec <= startSec) {
        alert('Please enter a valid start and end time before exporting.');
        return;
      }

      const filePath = selectedFile.path || selectedFile.file.path;
      const result = await window.electronAPI.exportCutVideo({
        inputPath: filePath,
        start: startSec,
        end: endSec,
        duration: endSec - startSec,
      });

      if (result.canceled) {
        return;
      }

      if (result.error) {
        console.error(result.error);
        alert('Export failed. Check console for details.');
      } else {
        alert('Export completed successfully.');
      }
    } catch (err) {
      console.error(err);
      alert('Export failed due to an unexpected error.');
    }
  };

  const handleStartSliderChange = (value) => {
    const newStart = Math.min(Math.floor(value), endSeconds - 0.001);
    if (newStart < 0 || isNaN(newStart)) return;
    setStartTime(formatSecondsToTime(newStart));
  };

  const handleEndSliderChange = (value) => {
    const newEnd = Math.max(Math.floor(value), startSeconds + 0.001);
    if (isNaN(newEnd)) return;
    setEndTime(formatSecondsToTime(newEnd));
  };

  // delta is in seconds (can be fractional, e.g. 0.1 = 100ms)
  const adjustStart = (delta) => {
    const newVal = Math.min(
      Math.max(startSeconds + delta, 0),
      endSeconds - 0.001
    );
    setStartTime(formatSecondsToTime(newVal));
  };

  const adjustEnd = (delta) => {
    const newVal = Math.max(
      Math.min(endSeconds + delta, effectiveDuration),
      startSeconds + 0.001
    );
    setEndTime(formatSecondsToTime(newVal));
  };

  const beginHandleDrag = (type, event) => {
    if (isPreviewMode) return;
    const track = event.currentTarget.parentElement;
    const rect = track.getBoundingClientRect();

    const onMove = (moveEvent) => {
      const ratio = Math.max(
        0,
        Math.min(1, (moveEvent.clientX - rect.left) / rect.width)
      );
      const seconds = ratio * effectiveDuration;
      if (type === 'start') {
        handleStartSliderChange(seconds);
      } else {
        handleEndSliderChange(seconds);
      }
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  if (showUpload) {
    return (
      <FileUpload
        onFileSelect={handleFileUpload}
        onClose={onBack}
        title="Upload Base Video"
        acceptedFormats="MP4, MOV, AVI, MKV"
        maxSize="500MB"
      />
    );
  }

  return (
    <div className="cut-video-container">
      <div className="cut-video-header">
        <button className="back-button" onClick={onBack}>← Back</button>
        <h1 className="cut-video-title">Cut Video</h1>
      </div>

      <div className="cut-video-content">
        {/* Step 2: Select Media */}
        <div className="step-section">
          <h2 className="step-title">Step 2: Select Media</h2>
          
          <div className="media-selection">
            <h3 className="media-label">Base Video</h3>
            
            {selectedFile && (
              <div className="video-preview-section">
                <div className="video-thumbnail">
                  {videoUrl ? (
                    <video
                      src={videoUrl}
                      className="base-video-thumb"
                      muted
                    />
                  ) : (
                    <div className="play-icon-overlay">▶</div>
                  )}
                </div>
                <div className="video-details">
                  <p><strong>Filename:</strong> {selectedFile.name}</p>
                  <p><strong>Duration:</strong> {durationDisplay || selectedFile.duration}</p>
                  <p><strong>Resolution:</strong> {resolutionDisplay || selectedFile.resolution}</p>
                  <button className="choose-file-button" onClick={() => setShowUpload(true)}>
                    Choose Different File
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Step 3: Define Timeframe */}
        <div className="step-section">
          <h2 className="step-title">Step 3: Define Timeframe</h2>
          
          <div className="timeframe-section">
            <div className="video-player">
              <div className="video-player-placeholder">
                {(videoUrl || previewVideoUrl) ? (
                  <>
                    <video
                      ref={videoRef}
                      src={isPreviewMode && previewVideoUrl ? previewVideoUrl : videoUrl}
                      controls
                      className="cut-video-element"
                    />
                    {isCreatingPreview && (
                      <div className="preview-loading-overlay">
                        <div className="preview-loading-text">Creating preview...</div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="player-placeholder-text">No video loaded</div>
                )}
              </div>
            </div>

            <div className="timeline-container">
              <div className="timeline">
                <div className="timeline-markers">
                  {isPreviewMode ? (
                    <>
                      <span>{formatSecondsToHMS(0)}</span>
                      <span>{formatSecondsToHMS(segmentDuration * 0.25)}</span>
                      <span>{formatSecondsToHMS(segmentDuration * 0.5)}</span>
                      <span>{formatSecondsToHMS(segmentDuration * 0.75)}</span>
                      <span>{formatSecondsToHMS(segmentDuration)}</span>
                    </>
                  ) : (
                    <>
                      <span>{formatSecondsToHMS(0)}</span>
                      <span>{formatSecondsToHMS(effectiveDuration * 0.25)}</span>
                      <span>{formatSecondsToHMS(effectiveDuration * 0.5)}</span>
                      <span>{formatSecondsToHMS(effectiveDuration * 0.75)}</span>
                      <span>{formatSecondsToHMS(effectiveDuration)}</span>
                    </>
                  )}
                </div>
                <div className="timeline-track">
                  {isPreviewMode ? (
                    // In preview mode, show full segment as the selected range
                    <div
                      className="timeline-segment"
                      style={{
                        left: '0%',
                        width: '100%',
                      }}
                    ></div>
                  ) : (
                    <>
                      <div
                        className="timeline-segment"
                        style={{
                          left: `${(startSeconds / effectiveDuration) * 100}%`,
                          width: `${((endSeconds - startSeconds) / effectiveDuration) * 100}%`,
                        }}
                      ></div>
                      <div
                        className="timeline-handle timeline-handle-start"
                        style={{ left: `${(startSeconds / effectiveDuration) * 100}%` }}
                        onMouseDown={(e) => beginHandleDrag('start', e)}
                      ></div>
                      <div
                        className="timeline-handle timeline-handle-end"
                        style={{ left: `${(endSeconds / effectiveDuration) * 100}%` }}
                        onMouseDown={(e) => beginHandleDrag('end', e)}
                      ></div>
                    </>
                  )}
                </div>
              </div>

              <div className="time-inputs">
                <div className="time-input-group">
                  <label>Start Time:</label>
                  <div className="time-input-row">
                    <input
                      type="text"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="time-input"
                    />
                    <button
                      type="button"
                      className="time-adjust-btn"
                      onClick={() => adjustStart(0.1)}
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      className="time-adjust-btn"
                      onClick={() => adjustStart(-0.1)}
                    >
                      ▼
                    </button>
                  </div>
                </div>
                <div className="time-input-group">
                  <label>End Time:</label>
                  <div className="time-input-row">
                    <input
                      type="text"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="time-input"
                    />
                    <button
                      type="button"
                      className="time-adjust-btn"
                      onClick={() => adjustEnd(0.1)}
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      className="time-adjust-btn"
                      onClick={() => adjustEnd(-0.1)}
                    >
                      ▼
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="action-bar">
        <div className="action-bar-spacer"></div>
        <div className="action-buttons">
          {isPreviewMode ? (
            <button 
              className="preview-button" 
              onClick={handleExitPreview}
              disabled={isCreatingPreview}
            >
              Exit Preview
            </button>
          ) : (
            <button 
              className="preview-button" 
              onClick={handlePreview}
              disabled={isCreatingPreview}
            >
              {isCreatingPreview ? 'Creating Preview...' : 'Preview'}
            </button>
          )}
          <button className="next-button" onClick={handleExport}>Export</button>
        </div>
      </div>
    </div>
  );
}

export default CutVideo;
