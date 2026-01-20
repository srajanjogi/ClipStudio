import React, { useState, useEffect, useRef } from 'react';
import FileUpload from './FileUpload';
import './ChangePlaybackSpeed.css';

function ChangePlaybackSpeed({ onBack }) {
  const [showUpload, setShowUpload] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [startTime, setStartTime] = useState('00:00.00');
  const [endTime, setEndTime] = useState('00:10.00');
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [applyToWholeVideo, setApplyToWholeVideo] = useState(false);

  // Separate refs so that metadata (duration/timeline) always comes
  // from the ORIGINAL base video, not from the preview clip.
  const baseVideoRef = useRef(null);
  const previewVideoRef = useRef(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [durationDisplay, setDurationDisplay] = useState('');
  const [resolutionDisplay, setResolutionDisplay] = useState('');
  const [videoDurationSeconds, setVideoDurationSeconds] = useState(null);
  const [thumbnailUrl, setThumbnailUrl] = useState(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewTempFilePath, setPreviewTempFilePath] = useState(null);
  const [isCreatingPreview, setIsCreatingPreview] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const speedOptions = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

  const handleVideoSelect = (file) => {
    setSelectedVideo({
      file: file,
      name: file.name,
      path: file.path,
      duration: '',
      resolution: ''
    });
    setShowUpload(false);
  };

  useEffect(() => {
    if (selectedVideo?.file) {
      if (selectedVideo.path) {
        const pathForUrl = selectedVideo.path.replace(/\\/g, '/');
        setVideoUrl(`file:///${pathForUrl}`);
      } else if (selectedVideo.file instanceof File) {
        const url = URL.createObjectURL(selectedVideo.file);
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
  }, [selectedVideo]);

  // Fetch metadata & thumbnail from backend (Electron) when available
  useEffect(() => {
    const fetchMetadata = async () => {
      if (!selectedVideo?.path || !window.electronAPI?.getVideoMetadata) return;

      try {
        const result = await window.electronAPI.getVideoMetadata({
          videoPath: selectedVideo.path,
        });

        if (!result.error) {
          if (result.durationFormatted) {
            setDurationDisplay(result.durationFormatted);
          }
          if (typeof result.duration === 'number') {
            setVideoDurationSeconds(result.duration);
          }
          if (result.resolution) {
            setResolutionDisplay(result.resolution);
          }
        } else {
          console.error('Error fetching speed video metadata:', result.error);
        }

        if (window.electronAPI.createVideoThumbnail) {
          try {
            const thumbResult = await window.electronAPI.createVideoThumbnail({
              videoPath: selectedVideo.path,
            });
            if (thumbResult.thumbnailPath && !thumbResult.error) {
              const thumbPathForUrl = thumbResult.thumbnailPath.replace(/\\/g, '/');
              setThumbnailUrl(`file:///${thumbPathForUrl}`);
            } else if (thumbResult.error) {
              console.error('Thumbnail creation error (speed):', thumbResult.error);
            }
          } catch (err) {
            console.error('Error creating speed video thumbnail:', err);
          }
        }
      } catch (err) {
        console.error('Error in fetchMetadata for speed feature:', err);
      }
    };

    fetchMetadata();
  }, [selectedVideo?.path]);

  const handlePreview = async () => {
    if (!selectedVideo?.path || !window.electronAPI?.createPreviewSpeedChange) return;

    const filePath = selectedVideo.path;
    const startSec = applyToWholeVideo ? 0 : startSeconds;
    const endSec = applyToWholeVideo ? effectiveDuration : endSeconds;

    setIsCreatingPreview(true);
    try {
      const result = await window.electronAPI.createPreviewSpeedChange({
        inputPath: filePath,
        start: startSec,
        end: endSec,
        speed: playbackSpeed,
      });

      if (result?.error) {
        console.error('Speed preview error:', result.error);
        alert(`Preview failed: ${result.error}`);
        return;
      }

      if (result?.filePath) {
        const pathForUrl = result.filePath.replace(/\\/g, '/');
        const url = `file:///${pathForUrl}`;
        setPreviewUrl(url);
        setPreviewTempFilePath(result.filePath);
        setIsPreviewMode(true);
      }
    } catch (err) {
      console.error('Speed preview unexpected error:', err);
      alert('Preview failed due to an unexpected error.');
    } finally {
      setIsCreatingPreview(false);
    }
  };

  const handleExport = async () => {
    if (!selectedVideo?.path || !window.electronAPI?.exportSpeedChange) return;

    const filePath = selectedVideo.path;
    const startSec = applyToWholeVideo ? 0 : startSeconds;
    const endSec = applyToWholeVideo ? effectiveDuration : endSeconds;

    setIsExporting(true);
    try {
      const result = await window.electronAPI.exportSpeedChange({
        inputPath: filePath,
        start: startSec,
        end: endSec,
        speed: playbackSpeed,
      });

      if (result?.canceled) {
        return;
      }

      if (result?.error) {
        console.error('Speed export error:', result.error);
        alert(`Export failed: ${result.error}`);
      } else {
        alert('Export completed successfully!');
      }
    } catch (err) {
      console.error('Speed export unexpected error:', err);
      alert('Export failed due to an unexpected error.');
    } finally {
      setIsExporting(false);
    }
  };

  // Cleanup preview temp file on unmount or when changing video
  useEffect(() => {
    return () => {
      if (previewTempFilePath && window.electronAPI?.cleanupSpeedPreviewVideo) {
        window.electronAPI.cleanupSpeedPreviewVideo({ filePath: previewTempFilePath });
      }
    };
  }, [previewTempFilePath]);

  // Parse MM:SS.MS format
  const parseTimeToSeconds = (time) => {
    if (!time) return NaN;
    const [ms, msPart] = time.split('.');
    const parts = ms.split(':').map((p) => parseInt(p, 10));
    if (parts.length === 2) {
      const [mm, ss] = parts;
      let milliseconds = 0;
      if (msPart) {
        if (!/^\d{1,3}$/.test(msPart)) return NaN;
        const msValue = parseInt(msPart, 10);
        milliseconds = msPart.length === 2 ? msValue * 10 : msValue;
      }
      return mm * 60 + ss + milliseconds / 1000;
    }
    return NaN;
  };

  const formatSecondsToTime = (seconds) => {
    const clamped = Math.max(0, seconds);
    const totalMs = Math.round(clamped * 1000);
    const wholeSeconds = Math.floor(totalMs / 1000);
    const mm = String(Math.floor(wholeSeconds / 60)).padStart(2, '0');
    const ss = String(wholeSeconds % 60).padStart(2, '0');
    const ms = String(Math.floor((totalMs % 1000) / 10)).padStart(2, '0');
    return `${mm}:${ss}.${ms}`;
  };

  const formatSecondsToMMSS = (seconds) => {
    const clamped = Math.max(0, Math.floor(seconds));
    const mm = String(Math.floor(clamped / 60)).padStart(2, '0');
    const ss = String(clamped % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  };

  // When applying to the whole video, sync the start/end inputs so they show
  // 0 as start and the full base video duration as end.
  useEffect(() => {
    if (applyToWholeVideo && videoDurationSeconds != null) {
      setStartTime(formatSecondsToTime(0));
      setEndTime(formatSecondsToTime(videoDurationSeconds));
    }
  }, [applyToWholeVideo, videoDurationSeconds]);

  // Derived segment times
  const baseStartSeconds = (() => {
    const s = parseTimeToSeconds(startTime);
    return isNaN(s) ? 0 : s;
  })();

  const baseEndSeconds = (() => {
    const s = parseTimeToSeconds(endTime);
    if (isNaN(s)) return baseStartSeconds + 1;
    return s;
  })();

  const effectiveDuration = videoDurationSeconds || Math.max(baseEndSeconds, baseStartSeconds + 1);

  const startSeconds = applyToWholeVideo ? 0 : baseStartSeconds;
  const endSeconds = applyToWholeVideo ? effectiveDuration : baseEndSeconds;
  const segmentDuration = Math.max(endSeconds - startSeconds, 0);
  const newSegmentDuration = segmentDuration / playbackSpeed;
  const originalTotalDuration = effectiveDuration;
  const newTotalDurationSeconds =
    originalTotalDuration - segmentDuration + newSegmentDuration;
  const durationChange = newSegmentDuration - segmentDuration;

  // Update duration & resolution when metadata loads
  useEffect(() => {
    const vid = baseVideoRef.current;
    if (!vid) return;

    const onLoadedMetadata = () => {
      if (!isNaN(vid.duration)) {
        const totalSeconds = Math.floor(vid.duration);
        const hh = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
        const mm = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
        const ss = String(totalSeconds % 60).padStart(2, '0');
        
        setDurationDisplay(`${hh}:${mm}:${ss}`);
        setVideoDurationSeconds(totalSeconds);
      }

      if (vid.videoWidth && vid.videoHeight) {
        setResolutionDisplay(`${vid.videoWidth}x${vid.videoHeight} (${vid.videoHeight}p)`);
      }
    };

    vid.addEventListener('loadedmetadata', onLoadedMetadata);
    return () => {
      vid.removeEventListener('loadedmetadata', onLoadedMetadata);
    };
  }, [videoUrl]);

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
    const track = event.currentTarget.parentElement;
    const rect = track.getBoundingClientRect();

    const onMove = (moveEvent) => {
      const ratio = Math.max(
        0,
        Math.min(1, (moveEvent.clientX - rect.left) / rect.width)
      );
      const newTime = ratio * effectiveDuration;

      if (type === 'start') {
        const clamped = Math.min(newTime, endSeconds - 0.001);
        if (clamped >= 0) {
          setStartTime(formatSecondsToTime(clamped));
        }
      } else {
        const clamped = Math.max(newTime, startSeconds + 0.001);
        if (clamped <= effectiveDuration) {
          setEndTime(formatSecondsToTime(clamped));
        }
      }
    };

    const onEnd = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onEnd);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);
  };

  // Generate timeline markers
  const generateMarkers = () => {
    const markers = [];
    const interval = Math.max(5, Math.floor(effectiveDuration / 10));
    for (let i = 0; i <= effectiveDuration; i += interval) {
      markers.push(i);
    }
    if (markers[markers.length - 1] !== effectiveDuration) {
      markers.push(effectiveDuration);
    }
    return markers;
  };

  const timelineMarkers = generateMarkers();

  // Step 1: Upload Video
  if (showUpload) {
    return (
      <FileUpload
        onFileSelect={handleVideoSelect}
        onClose={onBack}
        title="Upload Video"
        acceptedFormats="MP4, MOV, AVI, MKV"
        maxSize="500MB"
      />
    );
  }

  if (!selectedVideo) {
    return null;
  }

  return (
    <div className="playback-speed-container">
      <div className="playback-speed-header">
        <button className="back-button" onClick={onBack}>← Back</button>
        <h1 className="playback-speed-title">Change Playback Speed &gt; Define Speed Segment</h1>
      </div>

      <div className="playback-speed-content">
        {/* Left Panel */}
        <div className="left-panel">
          {/* Top Section: Base Video */}
          <div className="top-section-panel">
            <h2 className="section-title">Base Video</h2>
            {selectedVideo && (
              <div className="selected-video-display">
                <div className="video-thumbnail-large">
                  <video
                    ref={baseVideoRef}
                    src={videoUrl}
                    style={{ display: 'none' }}
                    preload="metadata"
                  />
                  {thumbnailUrl ? (
                    <img
                      src={thumbnailUrl}
                      alt="Base video thumbnail"
                      className="video-thumbnail-img"
                    />
                  ) : (
                    <>
                      <div className="thumbnail-image">🏔️🌊</div>
                      <div className="play-overlay">▶</div>
                    </>
                  )}
                </div>
                <div className="video-details-large">
                  <p className="video-detail-row">
                    <span className="video-detail-label">Filename:</span>
                    <span className="video-detail-value">{selectedVideo.name}</span>
                  </p>
                  <p className="video-detail-row">
                    <span className="video-detail-label">Duration:</span>
                    <span className="video-detail-value">{durationDisplay || 'Loading...'}</span>
                  </p>
                  <p className="video-detail-row">
                    <span className="video-detail-label">Resolution:</span>
                    <span className="video-detail-value">{resolutionDisplay || 'Loading...'}</span>
                  </p>
                </div>
              </div>
            )}
            <button 
              className="choose-file-button"
              onClick={() => setShowUpload(true)}
            >
              {selectedVideo ? 'Choose Different File' : 'Choose File'}
            </button>
          </div>

          {/* Middle Section: Select Speed Segment */}
          <div className="middle-section-panel">
            <h2 className="section-title">Select Speed Segment</h2>

            <div className="apply-whole-video-toggle">
              <label>
                <input
                  type="checkbox"
                  checked={applyToWholeVideo}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setApplyToWholeVideo(checked);
                    if (checked && videoDurationSeconds != null) {
                      setStartTime(formatSecondsToTime(0));
                      setEndTime(formatSecondsToTime(videoDurationSeconds));
                    }
                  }}
                />
                <span>Apply speed change to entire video</span>
              </label>
            </div>

            {/* Timeline */}
            <div className="timeline-container">
              <div className="timeline-track" onMouseDown={(e) => {
                if (applyToWholeVideo) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                const newTime = ratio * effectiveDuration;
                if (Math.abs(newTime - startSeconds) < Math.abs(newTime - endSeconds)) {
                  setStartTime(formatSecondsToTime(Math.min(newTime, endSeconds - 0.001)));
                } else {
                  setEndTime(formatSecondsToTime(Math.max(newTime, startSeconds + 0.001)));
                }
              }}>
                <div 
                  className="timeline-segment"
                  style={{
                    left: `${(startSeconds / effectiveDuration) * 100}%`,
                    width: `${(segmentDuration / effectiveDuration) * 100}%`
                  }}
                ></div>
                <div
                  className="timeline-handle timeline-handle-start"
                  style={{ left: `${(startSeconds / effectiveDuration) * 100}%` }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    beginHandleDrag('start', e);
                  }}
                >
                  <div className="handle-arrow-left">◀</div>
                  <div className="handle-arrow-right">▶</div>
                </div>
                <div
                  className="timeline-handle timeline-handle-end"
                  style={{ left: `${(endSeconds / effectiveDuration) * 100}%` }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    beginHandleDrag('end', e);
                  }}
                >
                  <div className="handle-arrow-left">◀</div>
                  <div className="handle-arrow-right">▶</div>
                </div>
              </div>
              <div className="timeline-markers">
                {timelineMarkers.map((time, i) => (
                  <span key={i} className="marker-label">{formatSecondsToMMSS(time)}</span>
                ))}
              </div>
            </div>

            {/* Manual Input */}
            <div className="manual-input-container">
              <div className="time-input-group">
                <label>Start:</label>
                <div className="time-input-wrapper">
                  <button 
                    className="time-adjust-btn"
                    onClick={() => adjustStart(-0.1)}
                    disabled={applyToWholeVideo}
                    type="button"
                  >
                    ↑
                  </button>
                  <input
                    type="text"
                    value={startTime}
                    onChange={(e) => {
                      if (applyToWholeVideo) return;
                      const val = e.target.value;
                      setStartTime(val);
                      const secs = parseTimeToSeconds(val);
                      if (!isNaN(secs) && secs >= 0 && secs < endSeconds) {
                        // Valid input
                      }
                    }}
                    className="time-input"
                    disabled={applyToWholeVideo}
                  />
                  <button 
                    className="time-adjust-btn"
                    onClick={() => adjustStart(0.1)}
                    disabled={applyToWholeVideo}
                    type="button"
                  >
                    ↓
                  </button>
                </div>
              </div>
              <div className="time-input-group">
                <label>End:</label>
                <div className="time-input-wrapper">
                  <button 
                    className="time-adjust-btn"
                    onClick={() => adjustEnd(-0.1)}
                    disabled={applyToWholeVideo}
                    type="button"
                  >
                    ↑
                  </button>
                  <input
                    type="text"
                    value={endTime}
                    onChange={(e) => {
                      if (applyToWholeVideo) return;
                      const val = e.target.value;
                      setEndTime(val);
                      const secs = parseTimeToSeconds(val);
                      if (!isNaN(secs) && secs > startSeconds && secs <= effectiveDuration) {
                        // Valid input
                      }
                    }}
                    className="time-input"
                    disabled={applyToWholeVideo}
                  />
                  <button 
                    className="time-adjust-btn"
                    onClick={() => adjustEnd(0.1)}
                    disabled={applyToWholeVideo}
                    type="button"
                  >
                    ↓
                  </button>
                </div>
              </div>
            </div>

            {/* Choose Playback Speed */}
            <div className="playback-speed-selection">
              <h3 className="section-label">Choose Playback Speed:</h3>
              <div className="speed-buttons">
                {speedOptions.map((speed) => (
                  <button
                    key={speed}
                    className={`speed-button ${playbackSpeed === speed ? 'selected' : ''}`}
                    onClick={() => setPlaybackSpeed(speed)}
                  >
                    {speed}x{speed === 1 && ' (default)'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel: Preview */}
        <div className="right-panel">
          <h2 className="section-title">Preview</h2>
          
          {/* Video Player */}
          <div className="video-player-placeholder">
            <video
              ref={previewVideoRef}
              src={isPreviewMode && previewUrl ? previewUrl : videoUrl}
              controls
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                backgroundColor: '#000'
              }}
            />
          </div>

          {/* Duration Impact */}
          <div className="duration-impact-box">
            <h3 className="section-label">Duration Impact:</h3>
            <div className="duration-info">
              <p>Original segment duration: {formatSecondsToMMSS(segmentDuration)}</p>
              <p>New segment duration: {formatSecondsToMMSS(Math.round(newSegmentDuration))}</p>
            </div>
            <p className="duration-change">
              New total video duration: {formatSecondsToMMSS(Math.round(newTotalDurationSeconds))} ({durationChange >= 0 ? '+' : ''}{Math.round(durationChange)}s)
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="action-bar">
        <button className="cancel-button" onClick={onBack}>Cancel</button>
        <div className="action-buttons-right">
          <button
            className="preview-button"
            onClick={handlePreview}
            disabled={isCreatingPreview || !selectedVideo}
          >
            {isCreatingPreview ? 'Creating Preview...' : 'Preview'}
          </button>
          <button
            className="export-button"
            onClick={handleExport}
            disabled={isExporting || !selectedVideo}
          >
            {isExporting ? 'Exporting...' : 'Export'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ChangePlaybackSpeed;
