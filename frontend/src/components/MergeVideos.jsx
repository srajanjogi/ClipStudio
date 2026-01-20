import React, { useState, useEffect, useRef } from 'react';
import FileUpload from './FileUpload';
import './MergeVideos.css';

function MergeVideos({ onBack }) {
  const [step, setStep] = useState('upload-base'); // upload-base, configure
  const [showInsertUpload, setShowInsertUpload] = useState(false);
  const [baseVideo, setBaseVideo] = useState(null);
  const [insertVideo, setInsertVideo] = useState(null);
  const [mergeType, setMergeType] = useState('sequential');
  const [insertionPoint, setInsertionPoint] = useState(15); // in seconds
  
  // Preview and export state
  const videoRef = useRef(null);
  const [previewVideoUrl, setPreviewVideoUrl] = useState(null);
  const [previewTempFilePath, setPreviewTempFilePath] = useState(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isCreatingPreview, setIsCreatingPreview] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Fetch video metadata when base video is selected
  useEffect(() => {
    const fetchBaseVideoMetadata = async () => {
      if (!baseVideo?.path || !window.electronAPI?.getVideoMetadata) return;

      try {
        const result = await window.electronAPI.getVideoMetadata({ videoPath: baseVideo.path });
        if (result.error) {
          console.error('Error fetching base video metadata:', result.error);
          return;
        }

        // Create thumbnail
        let thumbnailUrl = null;
        if (window.electronAPI.createVideoThumbnail) {
          try {
            const thumbResult = await window.electronAPI.createVideoThumbnail({ videoPath: baseVideo.path });
            if (thumbResult.thumbnailPath && !thumbResult.error) {
              const thumbPathForUrl = thumbResult.thumbnailPath.replace(/\\/g, '/');
              thumbnailUrl = `file:///${thumbPathForUrl}`;
              console.log('Base video thumbnail created:', thumbnailUrl);
            } else {
              console.error('Thumbnail creation error:', thumbResult.error);
            }
          } catch (err) {
            console.error('Error creating base video thumbnail:', err);
          }
        }

        setBaseVideo(prev => ({
          ...prev,
          duration: result.durationFormatted,
          durationSeconds: result.duration,
          resolution: result.resolution,
          thumbnailUrl: thumbnailUrl
        }));

        // Update insertion point max and default
        if (result.duration) {
          const maxPoint = Math.floor(result.duration);
          setInsertionPoint(prev => Math.min(prev, maxPoint));
        }
      } catch (err) {
        console.error('Error in fetchBaseVideoMetadata:', err);
      }
    };

    fetchBaseVideoMetadata();
  }, [baseVideo?.path]);

  // Fetch video metadata when insert video is selected
  useEffect(() => {
    const fetchInsertVideoMetadata = async () => {
      if (!insertVideo?.path || !window.electronAPI?.getVideoMetadata) return;

      try {
        const result = await window.electronAPI.getVideoMetadata({ videoPath: insertVideo.path });
        if (result.error) {
          console.error('Error fetching insert video metadata:', result.error);
          return;
        }

        // Create thumbnail
        let thumbnailUrl = null;
        if (window.electronAPI.createVideoThumbnail) {
          try {
            const thumbResult = await window.electronAPI.createVideoThumbnail({ videoPath: insertVideo.path });
            if (thumbResult.thumbnailPath && !thumbResult.error) {
              const thumbPathForUrl = thumbResult.thumbnailPath.replace(/\\/g, '/');
              thumbnailUrl = `file:///${thumbPathForUrl}`;
              console.log('Insert video thumbnail created:', thumbnailUrl);
            } else {
              console.error('Thumbnail creation error:', thumbResult.error);
            }
          } catch (err) {
            console.error('Error creating insert video thumbnail:', err);
          }
        }

        setInsertVideo(prev => ({
          ...prev,
          duration: result.durationFormatted,
          durationSeconds: result.duration,
          resolution: result.resolution,
          thumbnailUrl: thumbnailUrl
        }));
      } catch (err) {
        console.error('Error in fetchInsertVideoMetadata:', err);
      }
    };

    fetchInsertVideoMetadata();
  }, [insertVideo?.path]);

  const handleBaseVideoSelect = (file) => {
    const filePath = file.path || file.file?.path;
    setBaseVideo({
      file: file,
      name: file.name,
      path: filePath,
      duration: '00:00:00', // Will be updated by useEffect
      durationSeconds: 0,
      resolution: '',
      thumbnailUrl: null
    });
    setStep('configure'); // Go directly to configure interface
  };

  const handleInsertVideoSelect = (file) => {
    const filePath = file.path || file.file?.path;
    setInsertVideo({
      file: file,
      name: file.name,
      path: filePath,
      duration: '00:00:00', // Will be updated by useEffect
      durationSeconds: 0,
      resolution: '',
      thumbnailUrl: null
    });
    // Stay on configure step
  };

  const calculateTotalDuration = () => {
    if (!baseVideo || !insertVideo || !baseVideo.durationSeconds || !insertVideo.durationSeconds) {
      return '00:00:00';
    }
    
    const baseSeconds = baseVideo.durationSeconds;
    const insertSeconds = insertVideo.durationSeconds;
    
    if (mergeType === 'sequential') {
      const total = baseSeconds + insertSeconds;
      const hours = Math.floor(total / 3600);
      const minutes = Math.floor((total % 3600) / 60);
      const seconds = Math.floor(total % 60);
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    } else {
      return baseVideo.duration; // Same duration for overlay
    }
  };

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };
  
  const parseTimeToSeconds = (timeString) => {
    const parts = timeString.split(':').map(p => parseInt(p, 10));
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    return 0;
  };

  const handlePreview = async () => {
    if (!baseVideo?.path || !insertVideo?.path) {
      alert('Please select both base and insert videos.');
      return;
    }

    if (!window.electronAPI) {
      alert('Preview is not available in this environment.');
      return;
    }

    setIsCreatingPreview(true);

    try {
      // Clean up previous preview file if exists
      if (previewTempFilePath && window.electronAPI.cleanupMergePreviewVideo) {
        await window.electronAPI.cleanupMergePreviewVideo({ filePath: previewTempFilePath });
      }

      // Create merged preview video using FFmpeg
      const previewHandler = mergeType === 'sequential' 
        ? window.electronAPI.createPreviewSequentialMerge
        : window.electronAPI.createPreviewOverlayMerge;

      if (!previewHandler) {
        alert('Preview handler not available.');
        setIsCreatingPreview(false);
        return;
      }

      const result = await previewHandler({
        baseVideoPath: baseVideo.path,
        insertVideoPath: insertVideo.path,
        insertionPoint: insertionPoint,
      });

      if (result.error) {
        console.error(result.error);
        alert('Failed to create preview. Check console for details.');
        setIsCreatingPreview(false);
        return;
      }

      // Create a URL for the temporary video using file:// protocol
      const pathForUrl = result.filePath.replace(/\\/g, '/');
      const previewUrl = `file:///${pathForUrl}`;
      setPreviewVideoUrl(previewUrl);
      setPreviewTempFilePath(result.filePath);
      setIsPreviewMode(true);
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
    if (previewTempFilePath && window.electronAPI?.cleanupMergePreviewVideo) {
      try {
        await window.electronAPI.cleanupMergePreviewVideo({ filePath: previewTempFilePath });
      } catch (err) {
        console.error('Error cleaning up preview file:', err);
      }
    }

    setPreviewVideoUrl(null);
    setPreviewTempFilePath(null);
    setIsPreviewMode(false);

    // Reset video
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  const handleExport = async () => {
    if (!baseVideo?.path || !insertVideo?.path) {
      alert('Please select both base and insert videos.');
      return;
    }

    if (!window.electronAPI) {
      alert('Export is not available in this environment.');
      return;
    }

    setIsExporting(true);
    try {
      const exportHandler = mergeType === 'sequential'
        ? window.electronAPI.exportSequentialMerge
        : window.electronAPI.exportOverlayMerge;

      if (!exportHandler) {
        alert('Export handler not available.');
        setIsExporting(false);
        return;
      }

      const result = await exportHandler({
        baseVideoPath: baseVideo.path,
        insertVideoPath: insertVideo.path,
        insertionPoint: insertionPoint,
      });

      if (result.canceled) {
        // User canceled the save dialog
        setIsExporting(false);
        return;
      }

      if (result.error) {
        console.error(result.error);
        alert(`Export failed: ${result.error}`);
      } else {
        alert('Export completed successfully!');
      }
    } catch (err) {
      console.error(err);
      alert('Export failed due to an unexpected error.');
    } finally {
      setIsExporting(false);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (previewTempFilePath && window.electronAPI?.cleanupMergePreviewVideo) {
        window.electronAPI.cleanupMergePreviewVideo({ filePath: previewTempFilePath }).catch(console.error);
      }
    };
  }, [previewTempFilePath]);

  // Step 1: Upload Base Video
  if (step === 'upload-base') {
    return (
      <FileUpload
        onFileSelect={handleBaseVideoSelect}
        onClose={onBack}
        title="Upload Base Video"
        acceptedFormats="MP4, MOV, AVI, MKV"
        maxSize="500MB"
      />
    );
  }

  // Step 2: Configure Merge (shows after base video is selected)
  if (!baseVideo) {
    return null; // Safety check
  }

  return (
    <>
      {showInsertUpload && (
        <FileUpload
          onFileSelect={(file) => {
            handleInsertVideoSelect(file);
            setShowInsertUpload(false);
          }}
          onClose={() => setShowInsertUpload(false)}
          title="Upload Insert Video"
          acceptedFormats="MP4, MOV, AVI, MKV"
          maxSize="500MB"
        />
      )}
      <div className="merge-videos-container">
        <div className="merge-videos-header">
          <button className="back-button" onClick={onBack}>← Back</button>
          <h1 className="merge-videos-title">Merge Videos</h1>
        </div>

        <div className="merge-videos-content">
          {/* Left Panel: Media Panel & Configuration */}
          <div className="media-panel">
            <h2 className="panel-title">MEDIA PANEL & CONFIGURATION</h2>

            {/* Selected Media */}
            <div className="selected-media-section">
              <h3 className="section-label">SELECTED MEDIA:</h3>
              <div className="media-files">
                <div className="media-file base-video-file">
                  <div className="media-thumbnail base-thumbnail">
                    {baseVideo?.thumbnailUrl ? (
                      <img src={baseVideo.thumbnailUrl} alt="Base video thumbnail" className="video-thumbnail-img" />
                    ) : (
                      <div className="thumbnail-placeholder">🏔️</div>
                    )}
                  </div>
                  <div className="media-info">
                    <p className="media-name">{baseVideo?.name || 'No file'}</p>
                    <p className="media-duration">({baseVideo?.duration || '00:00:00'})</p>
                  </div>
                  <button className="change-file-button" onClick={() => setStep('upload-base')}>
                    Change
                  </button>
                </div>

              <div className="media-connector">+</div>

              {insertVideo ? (
                <div className="media-file insert-video-file">
                  <div className="media-thumbnail insert-thumbnail">
                    {insertVideo?.thumbnailUrl ? (
                      <img src={insertVideo.thumbnailUrl} alt="Insert video thumbnail" className="video-thumbnail-img" />
                    ) : (
                      <div className="thumbnail-placeholder">🎬</div>
                    )}
                  </div>
                  <div className="media-info">
                    <p className="media-name">{insertVideo.name}</p>
                    <p className="media-duration">({insertVideo.duration})</p>
                  </div>
                  <button className="change-file-button" onClick={() => {
                    setInsertVideo(null);
                    setShowInsertUpload(true);
                  }}>
                    Change
                  </button>
                </div>
              ) : (
                <div className="media-file media-file-empty insert-video-file">
                  <div className="media-thumbnail insert-thumbnail empty-thumbnail">
                    <div className="upload-icon">📹</div>
                  </div>
                  <div className="media-info">
                    <p className="media-name-empty">No video selected</p>
                    <p className="media-duration-empty">Select insert video</p>
                  </div>
                  <button className="select-file-button" onClick={() => setShowInsertUpload(true)}>
                    Select Video
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Merge Configuration - Only show when both videos are selected */}
          {insertVideo && (
          <div className="merge-configuration-section">
            <h3 className="section-label">MERGE CONFIGURATION:</h3>

            <div className="merge-type-selection">
              <div className="radio-group">
                <label className={`radio-option ${mergeType === 'sequential' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="mergeType"
                    value="sequential"
                    checked={mergeType === 'sequential'}
                    onChange={(e) => setMergeType(e.target.value)}
                  />
                  <div className="radio-content">
                    <div className="radio-header">
                      <span className="radio-title">Sequential Merge</span>
                      {mergeType === 'sequential' && <span className="selected-badge">Selected</span>}
                    </div>
                    <p className="radio-description">
                      Extends total duration - Insert video plays after base video
                    </p>
                    <div className="radio-visual">
                      <span className="visual-box">[Video A]</span>
                      <span className="visual-arrow">→</span>
                      <span className="visual-box">[Video B]</span>
                    </div>
                  </div>
                </label>

                <label className={`radio-option ${mergeType === 'overlay' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="mergeType"
                    value="overlay"
                    checked={mergeType === 'overlay'}
                    onChange={(e) => setMergeType(e.target.value)}
                  />
                  <div className="radio-content">
                    <div className="radio-header">
                      <span className="radio-title">Overlay Merge</span>
                      {mergeType === 'overlay' && <span className="selected-badge">Selected</span>}
                    </div>
                    <p className="radio-description">
                      Replaces content - Same total duration
                    </p>
                    <div className="radio-visual">
                      <span className="visual-box">[Video A]</span>
                      <span className="visual-box overlay-box">[Video B overlay section]</span>
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* Insertion Point - Show for both Sequential and Overlay */}
            <div className="insertion-point-section">
              <h3 className="section-label">INSERTION POINT:</h3>
              <div className="insertion-point-controls">
                <div className="timeline-slider-container">
                  <div className="timeline-slider-wrapper">
                    <div className="slider-handle-label" style={{ 
                      left: `${baseVideo?.durationSeconds ? (insertionPoint / Math.floor(baseVideo.durationSeconds)) * 100 : 0}%` 
                    }}>
                      {formatTime(insertionPoint)}
                    </div>
                    <div className="timeline-slider">
                      <input
                        type="range"
                        min="0"
                        max={baseVideo?.durationSeconds ? Math.floor(baseVideo.durationSeconds) : 225}
                        value={insertionPoint}
                        onChange={(e) => setInsertionPoint(parseInt(e.target.value))}
                        className="slider-input"
                      />
                    </div>
                    <div className="slider-markers">
                      {baseVideo?.durationSeconds ? (() => {
                        const maxSeconds = Math.floor(baseVideo.durationSeconds);
                        const markers = [];
                        const numMarkers = 7;
                        const step = Math.max(1, Math.floor(maxSeconds / (numMarkers - 1)));
                        for (let i = 0; i < numMarkers; i++) {
                          const time = Math.min(i * step, maxSeconds);
                          markers.push(
                            <span key={i} className="marker-label">{formatTime(time)}</span>
                          );
                        }
                        return markers;
                      })() : (
                        <>
                          <span className="marker-label">00:00:00</span>
                          <span className="marker-label">00:00:04</span>
                          <span className="marker-label">00:00:08</span>
                          <span className="marker-label">00:00:12</span>
                          <span className="marker-label">00:00:16</span>
                          <span className="marker-label">00:00:20</span>
                          <span className="marker-label">00:00:24</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="time-input-container">
                  <div className="time-input-row">
                    <input
                      type="text"
                      value={formatTime(insertionPoint)}
                      onChange={(e) => {
                        const time = e.target.value;
                        const totalSeconds = parseTimeToSeconds(time);
                        const maxSeconds = baseVideo?.durationSeconds ? Math.floor(baseVideo.durationSeconds) : 225;
                        if (!isNaN(totalSeconds) && totalSeconds >= 0 && totalSeconds <= maxSeconds) {
                          setInsertionPoint(totalSeconds);
                        }
                      }}
                      className="time-input-field"
                      placeholder="00:00:00"
                    />
                    <button
                      type="button"
                      className="time-adjust-btn"
                      onClick={() => {
                        const maxSeconds = baseVideo?.durationSeconds ? Math.floor(baseVideo.durationSeconds) : 225;
                        const newValue = Math.min(insertionPoint + 1, maxSeconds);
                        setInsertionPoint(newValue);
                      }}
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      className="time-adjust-btn"
                      onClick={() => {
                        const newValue = Math.max(insertionPoint - 1, 0);
                        setInsertionPoint(newValue);
                      }}
                    >
                      ▼
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          )}
        </div>

        {/* Right Panel: Preview Panel */}
        <div className="preview-panel">
          <h2 className="panel-title">PREVIEW PANEL</h2>

          {/* Preview Video Player */}
          <div className="preview-section">
            <h3 className="section-label">Preview: Merged Video Sequence</h3>
            <div className="preview-player">
              {isPreviewMode && previewVideoUrl ? (
                <div className="video-player-placeholder" style={{ position: 'relative' }}>
                  {isCreatingPreview && (
                    <div className="loading-overlay">
                      <div className="loading-spinner">Creating Preview...</div>
                    </div>
                  )}
                  <video
                    ref={videoRef}
                    src={previewVideoUrl}
                    controls
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      backgroundColor: '#000'
                    }}
                    onLoadedMetadata={() => {
                      if (videoRef.current) {
                        videoRef.current.currentTime = 0;
                      }
                    }}
                  />
                </div>
              ) : (
                <div className="player-placeholder">
                  <div className="play-button-large">▶</div>
                  <p style={{ marginTop: '10px', color: '#666' }}>
                    Click "Preview" to see the merged video
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Timeline Impact - Only show when both videos are selected */}
          {insertVideo && (
          <div className="timeline-impact-section">
            <h3 className="section-label">TIMELINE IMPACT:</h3>
            
            <div className="timeline-comparison">
              <div className="timeline-after">
                {mergeType === 'sequential' ? (
                  <>
                    <p className="timeline-original-duration">Original duration: {baseVideo.duration}</p>
                    <div className="timeline-wrapper">
                      <div className="timeline-duration-labels">
                        {baseVideo?.durationSeconds && insertVideo?.durationSeconds ? (() => {
                          const baseSeconds = Math.floor(baseVideo.durationSeconds);
                          const insertSeconds = Math.floor(insertVideo.durationSeconds);
                          const totalSeconds = baseSeconds + insertSeconds;
                          const insertStart = insertionPoint;
                          const insertEnd = insertionPoint + insertSeconds;
                          return (
                            <>
                              <span className="timeline-start-label">Start: {formatTime(0)}</span>
                              <span className="timeline-end-label">End: {formatTime(totalSeconds)}</span>
                            </>
                          );
                        })() : (
                          <>
                            <span className="timeline-start-label">Start: 00:00:00</span>
                            <span className="timeline-end-label">End: 00:00:00</span>
                          </>
                        )}
                      </div>
                      <div className="timeline-bars-container">
                        {baseVideo?.durationSeconds && insertVideo?.durationSeconds ? (() => {
                          const baseSeconds = Math.floor(baseVideo.durationSeconds);
                          const insertSeconds = Math.floor(insertVideo.durationSeconds);
                          const totalSeconds = baseSeconds + insertSeconds;
                          const segment1Width = totalSeconds > 0 ? (insertionPoint / totalSeconds) * 100 : 0;
                          const segment2Width = totalSeconds > 0 ? (insertSeconds / totalSeconds) * 100 : 0;
                          const segment3Width = totalSeconds > 0 ? ((baseSeconds - insertionPoint) / totalSeconds) * 100 : 0;
                          const mergePointPosition = segment1Width;
                          const insertStart = insertionPoint;
                          const insertEnd = insertionPoint + insertSeconds;
                          return (
                            <>
                              <div className="timeline-bar segment-1" style={{ width: `${segment1Width}%` }}></div>
                              <div className="merge-point-marker" style={{ left: `${mergePointPosition}%` }}>
                                <div className="dashed-line"></div>
                              </div>
                              <div className="timeline-bar segment-2" style={{ width: `${segment2Width}%`, position: 'relative' }}>
                                <div className="segment-duration-labels">
                                  <span className="segment-start-label">Start: {formatTime(insertStart)}</span>
                                  <span className="segment-end-label">End: {formatTime(insertEnd)}</span>
                                </div>
                              </div>
                              <div className="timeline-bar segment-3" style={{ width: `${segment3Width}%` }}></div>
                            </>
                          );
                        })() : (
                          <>
                            <div className="timeline-bar segment-1" style={{ width: `${(insertionPoint / 305) * 100}%` }}></div>
                            <div className="merge-point-marker" style={{ left: `${(insertionPoint / 305) * 100}%` }}>
                              <div className="dashed-line"></div>
                            </div>
                            <div className="timeline-bar segment-2" style={{ width: `${(80 / 305) * 100}%`, position: 'relative' }}>
                              <div className="segment-duration-labels">
                                <span className="segment-start-label">Start: {formatTime(insertionPoint)}</span>
                                <span className="segment-end-label">End: {formatTime(insertionPoint + 80)}</span>
                              </div>
                            </div>
                            <div className="timeline-bar segment-3" style={{ width: `${((225 - insertionPoint) / 305) * 100}%` }}></div>
                          </>
                        )}
                      </div>
                    </div>
                    <p className="timeline-label">
                      Total duration: {calculateTotalDuration()} <span className="extended-badge">(Extended)</span>
                    </p>
                    <p className="timeline-detail">
                      Merge Point at {formatTime(insertionPoint)}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="timeline-original-duration">Original duration: {baseVideo?.duration || '00:00:00'}</p>
                    <div className="timeline-wrapper">
                      <div className="timeline-duration-labels">
                        {baseVideo?.durationSeconds ? (() => {
                          const baseSeconds = Math.floor(baseVideo.durationSeconds);
                          return (
                            <>
                              <span className="timeline-start-label">Start: {formatTime(0)}</span>
                              <span className="timeline-end-label">End: {formatTime(baseSeconds)}</span>
                            </>
                          );
                        })() : (
                          <>
                            <span className="timeline-start-label">Start: 00:00:00</span>
                            <span className="timeline-end-label">End: 00:00:00</span>
                          </>
                        )}
                      </div>
                      <div className="timeline-bars-container">
                        {baseVideo?.durationSeconds && insertVideo?.durationSeconds ? (() => {
                          const baseSeconds = Math.floor(baseVideo.durationSeconds);
                          const insertSeconds = Math.floor(insertVideo.durationSeconds);
                          const actualInsertDuration = Math.min(insertSeconds, baseSeconds - insertionPoint);
                          const segment1Width = baseSeconds > 0 ? (insertionPoint / baseSeconds) * 100 : 0;
                          const segment2Width = baseSeconds > 0 ? (actualInsertDuration / baseSeconds) * 100 : 0;
                          const segment3Width = baseSeconds > 0 ? ((baseSeconds - insertionPoint - actualInsertDuration) / baseSeconds) * 100 : 0;
                          const insertStart = insertionPoint;
                          const insertEnd = insertionPoint + actualInsertDuration;
                          return (
                            <>
                              <div className="timeline-bar segment-1" style={{ width: `${segment1Width}%` }}></div>
                              <div className="merge-point-marker" style={{ left: `${segment1Width}%` }}>
                                <div className="dashed-line"></div>
                              </div>
                              <div className="timeline-bar segment-2" style={{ width: `${segment2Width}%`, position: 'relative' }}>
                                <div className="segment-duration-labels">
                                  <span className="segment-start-label">Start: {formatTime(insertStart)}</span>
                                  <span className="segment-end-label">End: {formatTime(insertEnd)}</span>
                                </div>
                              </div>
                              <div className="timeline-bar segment-3" style={{ width: `${segment3Width}%` }}></div>
                            </>
                          );
                        })() : (
                          <>
                            <div className="timeline-bar segment-1" style={{ width: `${(insertionPoint / 225) * 100}%` }}></div>
                            <div className="merge-point-marker" style={{ left: `${(insertionPoint / 225) * 100}%` }}>
                              <div className="dashed-line"></div>
                            </div>
                            <div className="timeline-bar segment-2" style={{ width: `${(80 / 225) * 100}%`, position: 'relative' }}>
                              <div className="segment-duration-labels">
                                <span className="segment-start-label">Start: {formatTime(insertionPoint)}</span>
                                <span className="segment-end-label">End: {formatTime(insertionPoint + 80)}</span>
                              </div>
                            </div>
                            <div className="timeline-bar segment-3" style={{ width: `${((225 - insertionPoint - 80) / 225) * 100}%` }}></div>
                          </>
                        )}
                      </div>
                    </div>
                    <p className="timeline-label">
                      Total duration: {baseVideo?.duration || '00:00:00'} <span className="same-badge">(Same)</span>
                    </p>
                    <p className="timeline-detail">
                      Merge Point at {formatTime(insertionPoint)}
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
          )}
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="action-bar">
        <div className="action-bar-spacer"></div>
        {insertVideo && (
          <div className="action-buttons">
            {!isPreviewMode ? (
              <>
                <button 
                  className="preview-button" 
                  onClick={handlePreview}
                  disabled={isCreatingPreview}
                >
                  {isCreatingPreview ? 'Creating Preview...' : 'Preview'}
                </button>
                <button 
                  className="export-button" 
                  onClick={handleExport}
                  disabled={isExporting}
                >
                  {isExporting ? 'Exporting...' : 'Export'}
                </button>
              </>
            ) : (
              <>
                <button 
                  className="exit-preview-button" 
                  onClick={handleExitPreview}
                >
                  Exit Preview
                </button>
                <button 
                  className="export-button" 
                  onClick={handleExport}
                  disabled={isExporting}
                >
                  {isExporting ? 'Exporting...' : 'Export'}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
    </>
  );
}

export default MergeVideos;
