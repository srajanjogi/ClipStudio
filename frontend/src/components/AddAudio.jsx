import React, { useState, useEffect, useRef } from 'react';
import FileUpload from './FileUpload';
import './AddAudio.css';

function AddAudio({ onBack }) {
  // step: upload-base -> configure
  const [step, setStep] = useState('upload-base');
  const [baseVideo, setBaseVideo] = useState(null);
  const [audioTrack, setAudioTrack] = useState(null);
  const [audioWaveform, setAudioWaveform] = useState(null);
  const [audioDurationDisplay, setAudioDurationDisplay] = useState('');
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [volume, setVolume] = useState(50);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewTempFilePath, setPreviewTempFilePath] = useState(null);
  const [isCreatingPreview, setIsCreatingPreview] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const previewVideoRef = useRef(null);
  const [placementMode, setPlacementMode] = useState('start');
  const [placementOption, setPlacementOption] = useState('start');
  const [loopAudio, setLoopAudio] = useState(true);
  const [audioStart, setAudioStart] = useState('00:00:00');
  const [audioEnd, setAudioEnd] = useState('00:01:30');
  const [videoUrl, setVideoUrl] = useState(null);
  const [thumbnailUrl, setThumbnailUrl] = useState(null);
  const [durationDisplay, setDurationDisplay] = useState('');
  const [videoDurationSeconds, setVideoDurationSeconds] = useState(null);
  const baseVideoRef = useRef(null);

  const handleBaseVideoSelect = (file) => {
    if (file) {
      setBaseVideo({
        file: file,
        name: file.name,
        path: file.path,
        duration: '',
      });
      setStep('configure');
    }
  };

  useEffect(() => {
    if (baseVideo?.file) {
      if (baseVideo.path) {
        const pathForUrl = baseVideo.path.replace(/\\/g, '/');
        setVideoUrl(`file:///${pathForUrl}`);
      } else if (baseVideo.file instanceof File) {
        const url = URL.createObjectURL(baseVideo.file);
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
  }, [baseVideo]);

  // Fetch metadata & thumbnail from backend
  useEffect(() => {
    const fetchMetadata = async () => {
      if (!baseVideo?.path || !window.electronAPI?.getVideoMetadata) return;

      try {
        const result = await window.electronAPI.getVideoMetadata({
          videoPath: baseVideo.path,
        });

        if (!result.error) {
          if (result.durationFormatted) {
            setDurationDisplay(result.durationFormatted);
            // Update audioEnd to match video duration if placement is 'start'
            if (placementMode === 'start') {
              setAudioEnd(result.durationFormatted);
            }
          }
          if (typeof result.duration === 'number') {
            setVideoDurationSeconds(result.duration);
          }
        } else {
          console.error('Error fetching video metadata:', result.error);
        }

        if (window.electronAPI.createVideoThumbnail) {
          try {
            const thumbResult = await window.electronAPI.createVideoThumbnail({
              videoPath: baseVideo.path,
            });
            if (thumbResult.thumbnailPath && !thumbResult.error) {
              const thumbPathForUrl = thumbResult.thumbnailPath.replace(/\\/g, '/');
              setThumbnailUrl(`file:///${thumbPathForUrl}`);
            } else if (thumbResult.error) {
              console.error('Thumbnail creation error:', thumbResult.error);
            }
          } catch (err) {
            console.error('Error creating video thumbnail:', err);
          }
        }
      } catch (err) {
        console.error('Error in fetchMetadata:', err);
      }
    };

    fetchMetadata();
  }, [baseVideo?.path, placementMode]);

  const handleAudioTrackSelect = async () => {
    if (!window.electronAPI?.selectAudioFile) {
      alert('Audio file selection is not available in this environment.');
      return;
    }

    setIsLoadingAudio(true);
    try {
      const result = await window.electronAPI.selectAudioFile();
      if (!result.canceled && result.filePath) {
        // Extract filename from path
        const fileName = result.filePath.split(/[/\\]/).pop();
        setAudioTrack({
          name: fileName,
          path: result.filePath,
        });
      }
    } catch (err) {
      console.error('Error selecting audio file:', err);
      alert('Failed to select audio file.');
    } finally {
      setIsLoadingAudio(false);
    }
  };

  // Fetch audio metadata and waveform when audio file is selected
  useEffect(() => {
    const fetchAudioData = async () => {
      if (!audioTrack?.path || !window.electronAPI?.getAudioMetadata) return;

      setIsLoadingAudio(true);
      try {
        // Fetch metadata
        const metadataResult = await window.electronAPI.getAudioMetadata({
          audioPath: audioTrack.path,
        });

        if (!metadataResult.error) {
          if (metadataResult.durationFormatted) {
            setAudioDurationDisplay(metadataResult.durationFormatted);
          }
        } else {
          console.error('Error fetching audio metadata:', metadataResult.error);
        }

        // Generate waveform
        if (window.electronAPI.generateAudioWaveform) {
          try {
            const waveformResult = await window.electronAPI.generateAudioWaveform({
              audioPath: audioTrack.path,
              samples: 200, // Number of waveform points
            });

            if (waveformResult.waveform && !waveformResult.error) {
              setAudioWaveform(waveformResult.waveform);
            } else if (waveformResult.error) {
              console.error('Waveform generation error:', waveformResult.error);
            }
          } catch (err) {
            console.error('Error generating waveform:', err);
          }
        }
      } catch (err) {
        console.error('Error in fetchAudioData:', err);
      } finally {
        setIsLoadingAudio(false);
      }
    };

    fetchAudioData();
  }, [audioTrack?.path]);

  const handlePlacementModeChange = (mode) => {
    setPlacementMode(mode);
    setPlacementOption(mode === 'start' ? 'start' : mode === 'custom' ? 'custom' : 'start');
    if (mode === 'start' && durationDisplay) {
      setAudioStart('00:00:00');
      setAudioEnd(durationDisplay);
    }
  };

  // Parse HH:MM:SS time format to seconds
  const parseHMSToSeconds = (timeStr) => {
    if (!timeStr) return 0;
    const parts = timeStr.split(':').map(p => parseInt(p, 10));
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    }
    return 0;
  };

  // Format seconds to HH:MM:SS
  const formatSecondsToHMS = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Calculate timeline positions
  const getTimelineMarkers = () => {
    if (!videoDurationSeconds || videoDurationSeconds === 0) {
      return ['00:00:00', '00:00:30', '00:01:00', '00:01:30'];
    }
    const markers = [];
    const interval = Math.max(30, Math.floor(videoDurationSeconds / 4));
    for (let i = 0; i <= 3; i++) {
      const time = Math.min(i * interval, videoDurationSeconds);
      markers.push(formatSecondsToHMS(time));
    }
    return markers;
  };

  // Calculate percentage positions for timeline elements
  const getAudioStartPercent = () => {
    if (!videoDurationSeconds || videoDurationSeconds === 0) return 0;
    const startSec = parseHMSToSeconds(audioStart);
    return (startSec / videoDurationSeconds) * 100;
  };

  const getAudioEndPercent = () => {
    if (!videoDurationSeconds || videoDurationSeconds === 0) return 100;
    const endSec = parseHMSToSeconds(audioEnd);
    return (endSec / videoDurationSeconds) * 100;
  };

  const getScrubberPosition = () => {
    // Position at the start of audio segment
    return getAudioStartPercent();
  };

  const handlePreview = async () => {
    if (!baseVideo?.path || !audioTrack?.path) {
      alert('Please select both a video and an audio file.');
      return;
    }

    if (!window.electronAPI?.createPreviewAddAudio) {
      alert('Preview is not available in this environment.');
      return;
    }

    setIsCreatingPreview(true);

    try {
      // Clean up previous preview file if exists
      if (previewTempFilePath && window.electronAPI.cleanupAddAudioPreview) {
        await window.electronAPI.cleanupAddAudioPreview({ filePath: previewTempFilePath });
      }

      const result = await window.electronAPI.createPreviewAddAudio({
        videoPath: baseVideo.path,
        audioPath: audioTrack.path,
        volume: volume,
        audioStart: audioStart,
        audioEnd: audioEnd,
        loopAudio: loopAudio,
        placementMode: placementMode,
      });

      if (result.error) {
        console.error('Preview creation error:', result.error);
        alert(`Failed to create preview: ${result.error}`);
        setIsCreatingPreview(false);
        return;
      }

      if (result.filePath) {
        const pathForUrl = result.filePath.replace(/\\/g, '/');
        const previewUrl = `file:///${pathForUrl}`;
        console.log('Preview file created:', previewUrl);
        setPreviewUrl(previewUrl);
        setPreviewTempFilePath(result.filePath);
        setIsPreviewMode(true);
        setIsCreatingPreview(false);
        
        // Force video to reload
        setTimeout(() => {
          if (previewVideoRef.current) {
            previewVideoRef.current.load();
          }
        }, 100);
      } else {
        console.error('No file path returned from preview creation');
        alert('Failed to create preview: No file path returned');
        setIsCreatingPreview(false);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to create preview due to an unexpected error.');
      setIsCreatingPreview(false);
    }
  };

  const handleExitPreview = async () => {
    // Clean up temporary preview file
    if (previewTempFilePath && window.electronAPI?.cleanupAddAudioPreview) {
      try {
        await window.electronAPI.cleanupAddAudioPreview({ filePath: previewTempFilePath });
      } catch (err) {
        console.error('Error cleaning up preview file:', err);
      }
    }

    setPreviewUrl(null);
    setPreviewTempFilePath(null);
    setIsPreviewMode(false);
  };

  const handleExport = async () => {
    if (!baseVideo?.path || !audioTrack?.path) {
      alert('Please select both a video and an audio file.');
      return;
    }

    if (!window.electronAPI?.exportAddAudio) {
      alert('Export is not available in this environment.');
      return;
    }

    setIsExporting(true);

    try {
      const result = await window.electronAPI.exportAddAudio({
        videoPath: baseVideo.path,
        audioPath: audioTrack.path,
        volume: volume,
        audioStart: audioStart,
        audioEnd: audioEnd,
        loopAudio: loopAudio,
        placementMode: placementMode,
      });

      if (result.canceled) {
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

  // Step 2 (PRD): Select Base Video via upload modal
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

  // After base video is selected, show full Add Audio configuration screen
  return (
    <div className="add-audio-container">
      <div className="add-audio-header">
        <button className="back-button" onClick={onBack}>
          ← Back
        </button>
        <h1 className="add-audio-title">Add Audio</h1>
        <span className="breadcrumb">Configure Audio Track</span>
      </div>

      <div className="add-audio-content">
        {/* Left: Base Video & Audio Track */}
        <div className="left-panel">
          {/* Base Video */}
          <div className="panel base-video-panel">
            <h2 className="panel-title">Base Video</h2>
            <div className="base-video-box">
              <div className="base-video-thumbnail">
                {thumbnailUrl ? (
                  <img src={thumbnailUrl} alt="Video thumbnail" className="thumbnail-image" />
                ) : (
                  <div className="thumbnail-placeholder">
                    <div className="thumbnail-play-icon">▶</div>
                  </div>
                )}
              </div>
              <div className="base-video-details">
                <p className="file-label">
                  Filename: {baseVideo ? baseVideo.name : 'No file selected'}
                </p>
                <p className="file-duration">
                  Duration: {durationDisplay || (baseVideo ? baseVideo.duration : '00:00:00')}
                </p>
              </div>
            </div>
          </div>

          {/* Audio Track */}
          <div className="panel audio-track-panel">
            <h2 className="panel-title">Audio Track</h2>
            <div className="audio-upload-area">
              <div className="audio-upload-border">
                <p className="upload-title">Audio file upload area</p>
                {isLoadingAudio ? (
                  <div className="loading-waveform">
                    <p>Loading audio...</p>
                  </div>
                ) : (
                  <div className="audio-waveform-timeline-container">
                    <div className="audio-waveform-timeline">
                      {audioWaveform ? (
                        <>
                          {/* Waveform pattern */}
                          <div className="waveform-timeline-pattern">
                            {audioWaveform.map((amplitude, index) => (
                              <div
                                key={index}
                                className="waveform-timeline-bar"
                                style={{ 
                                  height: `${Math.max(8, amplitude * 50)}px`
                                }}
                              />
                            ))}
                          </div>
                          {/* Highlighted segment overlay (if needed) */}
                          <div className="waveform-segment-overlay" />
                        </>
                      ) : (
                        <div className="waveform-timeline-placeholder">
                          <p>No audio selected</p>
                        </div>
                      )}
                      {/* Left handle */}
                      <div className="waveform-handle waveform-handle-left" />
                      {/* Right handle */}
                      <div className="waveform-handle waveform-handle-right" />
                    </div>
                  </div>
                )}
                <p className="upload-icon-row">♫</p>
                <button
                  className="file-button"
                  onClick={handleAudioTrackSelect}
                  disabled={isLoadingAudio}
                >
                  {isLoadingAudio ? 'Loading...' : 'Browse Audio File'}
                </button>
              </div>
            </div>
            {audioTrack && (
              <div className="audio-file-details">
                <p className="file-label">
                  Filename: {audioTrack.name}
                </p>
                <p className="file-duration">
                  Duration: {audioDurationDisplay || '00:00:00'}
                </p>
              </div>
            )}

            {/* Volume */}
            <div className="volume-row">
              <span className="volume-label">Volume</span>
              <input
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={(e) => setVolume(parseInt(e.target.value, 10))}
                className="volume-slider-control"
              />
              <span className="volume-percent">{volume}%</span>
            </div>

            {/* Audio Placement */}
            <div className="audio-placement-section">
              <h3 className="section-subtitle">Audio Placement</h3>

              <div className="placement-dropdown-row">
                <select
                  className="placement-select"
                  value={placementOption}
                  onChange={(e) => {
                    const val = e.target.value;
                    setPlacementOption(val);
                    handlePlacementModeChange(val);
                  }}
                >
                  <option value="start">Start from beginning</option>
                  <option value="custom">Custom timeframe</option>
                </select>
              </div>

              <div className="placement-options">
                <label className="placement-option">
                  <input
                    type="radio"
                    name="placementMode"
                    value="start"
                    checked={placementMode === 'start'}
                    onChange={(e) => handlePlacementModeChange(e.target.value)}
                  />
                  <span>Start from beginning</span>
                </label>
                <label className="placement-option">
                  <input
                    type="radio"
                    name="placementMode"
                    value="custom"
                    checked={placementMode === 'custom'}
                    onChange={(e) => handlePlacementModeChange(e.target.value)}
                  />
                  <span>Custom timeframe</span>
                </label>
                <label className="placement-option">
                  <input
                    type="checkbox"
                    checked={loopAudio}
                    onChange={(e) => setLoopAudio(e.target.checked)}
                  />
                  <span>Loop audio</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Timeline Preview */}
        <div className="right-panel">
          <div className="timeline-panel">
            <h2 className="panel-title">Timeline Preview</h2>
            
            {/* Video Preview Player */}
            {isCreatingPreview ? (
              <div className="preview-placeholder">
                <p>Creating preview...</p>
                <p style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>This may take a moment</p>
              </div>
            ) : isPreviewMode && previewUrl ? (
              <div className="preview-video-container">
                <video
                  key={previewUrl} // Force re-render when URL changes
                  ref={previewVideoRef}
                  src={previewUrl}
                  controls
                  style={{ width: '100%', maxHeight: '300px' }}
                  onError={(e) => {
                    console.error('Preview video error:', e);
                    console.error('Video element error details:', e.target?.error);
                    alert(`Failed to load preview video: ${e.target?.error?.message || 'Unknown error'}`);
                  }}
                  onLoadedData={() => {
                    console.log('Preview video loaded successfully');
                    if (previewVideoRef.current) {
                      console.log('Video duration:', previewVideoRef.current.duration);
                      console.log('Video ready state:', previewVideoRef.current.readyState);
                    }
                  }}
                  onLoadStart={() => {
                    console.log('Preview video loading started');
                  }}
                />
              </div>
            ) : (
              <div className="preview-placeholder">
                <p>Preview will appear here</p>
              </div>
            )}

            <div className="timeline-preview-box">
              <div className="timeline-header">
                {getTimelineMarkers().map((marker, idx) => (
                  <span key={idx}>{marker}</span>
                ))}
              </div>

              <div className="tracks-container">
                <div className="track-row track-video-row">
                  <span className="track-label">Video track</span>
                  <div className="track-timeline video-track-timeline">
                    <div className="video-segment" />
                    <div className="video-segment second" />
                    <div className="video-segment third" />
                    <div 
                      className="timeline-scrubber-line"
                      style={{ left: `${getScrubberPosition()}%` }}
                    >
                      <div className="scrubber-handle top-handle" />
                      <div className="scrubber-handle bottom-handle" />
                    </div>
                  </div>
                </div>

                <div className="track-row track-audio-row">
                  <span className="track-label">Audio track</span>
                  <div className="track-timeline audio-track-timeline">
                    <div 
                      className="audio-selection"
                      style={{ 
                        left: `${getAudioStartPercent()}%`,
                        width: `${Math.max(0, getAudioEndPercent() - getAudioStartPercent())}%`
                      }}
                    >
                      {audioWaveform ? (
                        <div className="waveform-pattern-inline">
                          {audioWaveform.slice(0, Math.min(50, audioWaveform.length)).map((amplitude, index) => (
                            <div
                              key={index}
                              className="waveform-bar-inline"
                              style={{ height: `${Math.max(4, amplitude * 30)}px` }}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="waveform-pattern-inline">
                          <div className="waveform-bar-inline" style={{ height: '12px' }} />
                          <div className="waveform-bar-inline" style={{ height: '20px' }} />
                          <div className="waveform-bar-inline" style={{ height: '8px' }} />
                          <div className="waveform-bar-inline" style={{ height: '24px' }} />
                          <div className="waveform-bar-inline" style={{ height: '15px' }} />
                          <div className="waveform-bar-inline" style={{ height: '18px' }} />
                          <div className="waveform-bar-inline" style={{ height: '10px' }} />
                          <div className="waveform-bar-inline" style={{ height: '16px' }} />
                        </div>
                      )}
                    </div>
                    <div 
                      className="timeline-scrubber-line"
                      style={{ left: `${getScrubberPosition()}%` }}
                    >
                      <div className="scrubber-handle top-handle" />
                      <div className="scrubber-handle bottom-handle" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="scrubber-row">
                <div className="scrubber" />
              </div>
            </div>

            <div className="preview-controls-row">
              <div className="audio-time-labels">
                <div className="time-label-row">
                  <span>Audio Start:</span>
                  <input
                    type="text"
                    value={audioStart}
                    onChange={(e) => setAudioStart(e.target.value)}
                    className="time-field"
                    placeholder="00:00:00"
                  />
                </div>
                <div className="time-label-row">
                  <span>Audio End:</span>
                  <input
                    type="text"
                    value={audioEnd}
                    onChange={(e) => setAudioEnd(e.target.value)}
                    className="time-field"
                    placeholder="00:00:00"
                  />
                </div>
              </div>

              <div className="preview-transport">
                <button className="transport-btn">⏮</button>
                <button className="transport-btn play-btn">▶</button>
                <button className="transport-btn">⏭</button>
              </div>
            </div>
          </div>

          <div className="bottom-slider-row">
            <input
              type="range"
              min="0"
              max="100"
              defaultValue="50"
              className="bottom-timeline-slider"
            />
          </div>

          <div className="bottom-buttons-row">
            {isPreviewMode ? (
              <>
                <button className="secondary-button" onClick={handleExitPreview}>
                  Exit Preview
                </button>
                <button 
                  className="primary-button"
                  onClick={handleExport}
                  disabled={isExporting}
                >
                  {isExporting ? 'Exporting...' : 'Export'}
                </button>
              </>
            ) : (
              <>
                <button 
                  className="primary-button"
                  onClick={handlePreview}
                  disabled={isCreatingPreview || !baseVideo || !audioTrack}
                >
                  <span className="button-icon">▶</span>
                  {isCreatingPreview ? 'Creating Preview...' : 'Preview'}
                </button>
                <button className="secondary-button" onClick={onBack}>
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      {/* Hidden video element for metadata */}
      {videoUrl && (
        <video
          ref={baseVideoRef}
          src={videoUrl}
          style={{ display: 'none' }}
          onLoadedMetadata={() => {
            if (baseVideoRef.current) {
              const duration = baseVideoRef.current.duration;
              if (duration && !durationDisplay) {
                const hours = Math.floor(duration / 3600);
                const minutes = Math.floor((duration % 3600) / 60);
                const seconds = Math.floor(duration % 60);
                const formatted = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
                setDurationDisplay(formatted);
                if (placementMode === 'start') {
                  setAudioEnd(formatted);
                }
              }
            }
          }}
        />
      )}
    </div>
  );
}

export default AddAudio;
