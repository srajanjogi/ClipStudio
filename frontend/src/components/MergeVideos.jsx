import React, { useState } from 'react';
import FileUpload from './FileUpload';
import './MergeVideos.css';

function MergeVideos({ onBack }) {
  const [step, setStep] = useState('upload-base'); // upload-base, configure
  const [showInsertUpload, setShowInsertUpload] = useState(false);
  const [baseVideo, setBaseVideo] = useState(null);
  const [insertVideo, setInsertVideo] = useState(null);
  const [mergeType, setMergeType] = useState('sequential');
  const [insertionPoint, setInsertionPoint] = useState(15); // in seconds

  const handleBaseVideoSelect = (file) => {
    setBaseVideo({
      file: file,
      name: file.name,
      duration: '00:03:45'
    });
    setStep('configure'); // Go directly to configure interface
  };

  const handleInsertVideoSelect = (file) => {
    setInsertVideo({
      file: file,
      name: file.name,
      duration: '00:01:20'
    });
    // Stay on configure step
  };

  const calculateTotalDuration = () => {
    if (!baseVideo || !insertVideo) return '00:00:00';
    
    const baseSeconds = 225; // 3:45 in seconds
    const insertSeconds = 80; // 1:20 in seconds
    
    if (mergeType === 'sequential') {
      const total = baseSeconds + insertSeconds;
      const minutes = Math.floor(total / 60);
      const seconds = total % 60;
      return `00:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    } else {
      return baseVideo.duration; // Same duration for overlay
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `00:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

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
                    <div className="thumbnail-placeholder">🏔️</div>
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
                    <div className="thumbnail-placeholder">🎬</div>
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
                  <div className="timeline-slider">
                    <input
                      type="range"
                      min="0"
                      max="225"
                      value={insertionPoint}
                      onChange={(e) => setInsertionPoint(parseInt(e.target.value))}
                      className="slider-input"
                    />
                    <div className="slider-markers">
                      <span>00:00</span>
                      <span>00:01</span>
                      <span>00:02</span>
                      <span>00:03</span>
                      <span>00:04</span>
                      <span>00:05</span>
                      <span>00:06</span>
                    </div>
                    <div className="slider-handle-label" style={{ left: `${(insertionPoint / 225) * 100}%` }}>
                      {formatTime(insertionPoint)}
                    </div>
                  </div>
                </div>
                <div className="time-input-container">
                  <input
                    type="text"
                    value={formatTime(insertionPoint)}
                    onChange={(e) => {
                      const time = e.target.value;
                      // Simple parsing - can be enhanced
                      const parts = time.split(':');
                      if (parts.length === 3) {
                        const totalSeconds = parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
                        if (!isNaN(totalSeconds) && totalSeconds >= 0 && totalSeconds <= 225) {
                          setInsertionPoint(totalSeconds);
                        }
                      }
                    }}
                    className="time-input-field"
                  />
                  <button className="set-button">SET</button>
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
              <div className="player-placeholder">
                <div className="play-button-large">▶</div>
              </div>
              <div className="player-controls-bar">
                <button className="control-btn">⏮</button>
                <button className="control-btn">⏯</button>
                <button className="control-btn">⏭</button>
                <div className="progress-bar-container">
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: '35%' }}></div>
                  </div>
                </div>
                <div className="volume-control">
                  <span>🔊</span>
                  <div className="volume-slider"></div>
                </div>
                <button className="control-btn">⛶</button>
              </div>
            </div>
          </div>

          {/* Timeline Impact - Only show when both videos are selected */}
          {insertVideo && (
          <div className="timeline-impact-section">
            <h3 className="section-label">TIMELINE IMPACT:</h3>
            
            <div className="timeline-comparison">
              <div className="timeline-before">
                <div className="timeline-bar original-bar"></div>
                <p className="timeline-label">Original duration: {baseVideo.duration}</p>
              </div>

              <div className="timeline-after">
                {mergeType === 'sequential' ? (
                  <>
                    <div className="timeline-bars-container">
                      <div className="timeline-bar segment-1" style={{ width: `${(insertionPoint / 225) * 100}%` }}></div>
                      <div className="merge-point-marker">
                        <div className="dashed-line"></div>
                        <span className="merge-point-label">{formatTime(insertionPoint)}</span>
                      </div>
                      <div className="timeline-bar segment-2" style={{ width: `${(80 / 225) * 100}%` }}></div>
                      <div className="timeline-bar segment-3" style={{ width: `${((225 - insertionPoint) / 225) * 100}%` }}></div>
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
                    <div className="timeline-bar original-bar"></div>
                    <p className="timeline-label">
                      Total duration: {baseVideo?.duration || '00:00:00'} <span className="same-badge">(Same)</span>
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
        <button className="cancel-button" onClick={onBack}>Cancel</button>
        <button className="next-button">Next: Preview &gt;</button>
      </div>
    </div>
    </>
  );
}

export default MergeVideos;
