import React, { useState } from 'react';
import FileUpload from './FileUpload';
import './ChangePlaybackSpeed.css';

function ChangePlaybackSpeed({ onBack }) {
  const [step, setStep] = useState('upload');
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [startTime, setStartTime] = useState(5); // in seconds
  const [endTime, setEndTime] = useState(15); // in seconds
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  const speedOptions = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

  const handleVideoSelect = (file) => {
    setSelectedVideo({
      file: file,
      name: file.name,
      duration: '00:02:30' // 2 minutes 30 seconds
    });
    setStep('configure');
  };

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const parseTime = (timeString) => {
    const parts = timeString.split(':');
    if (parts.length === 3) {
      return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
    }
    return 0;
  };

  const segmentDuration = endTime - startTime;
  const newSegmentDuration = segmentDuration / playbackSpeed;
  const durationChange = newSegmentDuration - segmentDuration;

  // Step 1: Upload Video
  if (step === 'upload') {
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
        <h1 className="playback-speed-title">Change Playback Speed</h1>
      </div>

      <div className="playback-speed-content">
        {/* Top Section: Selected Video */}
        <div className="top-section">
          <div className="selected-video-panel">
            <h2 className="panel-title">Selected Video</h2>
            <div className="video-info-card">
              <div className="video-thumbnail-large">
                <div className="thumbnail-image">🏔️🌊</div>
                <div className="play-overlay">▶</div>
              </div>
              <div className="video-details-large">
                <p className="video-filename">{selectedVideo.name}</p>
                <p className="video-original-duration">Original Duration: {selectedVideo.duration}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Section: Middle (left) and Preview (right) */}
        <div className="bottom-section">
          {/* Middle Section: Select Speed Segment */}
          <div className="middle-section">
            <div className="speed-segment-panel">
              <h2 className="panel-title">Select Speed Segment</h2>

            {/* Video Timeline with Thumbnails */}
            <div className="video-timeline-container">
              <div className="timeline-thumbnails">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="timeline-thumbnail">
                    <div className="thumbnail-mini">🏔️🌊</div>
                  </div>
                ))}
              </div>

              {/* Segment Selection Slider */}
              <div className="segment-slider-container">
                <div className="segment-slider-wrapper">
                  <div className="slider-track">
                    <div 
                      className="slider-segment" 
                      style={{ 
                        left: `${(startTime / 30) * 100}%`, 
                        width: `${((endTime - startTime) / 30) * 100}%` 
                      }}
                    ></div>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="30"
                    value={startTime}
                    onChange={(e) => {
                      const newStart = parseInt(e.target.value);
                      if (newStart < endTime) {
                        setStartTime(newStart);
                      }
                    }}
                    className="slider-input slider-start"
                  />
                  <input
                    type="range"
                    min="0"
                    max="30"
                    value={endTime}
                    onChange={(e) => {
                      const newEnd = parseInt(e.target.value);
                      if (newEnd > startTime) {
                        setEndTime(newEnd);
                      }
                    }}
                    className="slider-input slider-end"
                  />
                  <div className="slider-markers">
                    <span>00:00:00</span>
                    <span>00:00:05</span>
                    <span>00:00:10</span>
                    <span>00:00:15</span>
                    <span>00:00:20</span>
                    <span>00:00:25</span>
                    <span>00:00:30</span>
                  </div>
                </div>
              </div>

              {/* Manual Input */}
              <div className="manual-input-container">
                <div className="time-input-group">
                  <label>Start:</label>
                  <input
                    type="text"
                    value={formatTime(startTime)}
                    onChange={(e) => {
                      const seconds = parseTime(e.target.value);
                      if (!isNaN(seconds) && seconds >= 0 && seconds < endTime && seconds <= 30) {
                        setStartTime(seconds);
                      }
                    }}
                    className="time-input"
                  />
                </div>
                <div className="time-input-group">
                  <label>End:</label>
                  <input
                    type="text"
                    value={formatTime(endTime)}
                    onChange={(e) => {
                      const seconds = parseTime(e.target.value);
                      if (!isNaN(seconds) && seconds > startTime && seconds <= 30) {
                        setEndTime(seconds);
                      }
                    }}
                    className="time-input"
                  />
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

              {/* Duration Impact */}
              <div className="duration-impact-box">
                <h3 className="section-label">Duration Impact:</h3>
                <div className="duration-info">
                  <p>Original segment duration: {formatTime(segmentDuration)}</p>
                  <p>New segment duration: {formatTime(Math.round(newSegmentDuration))}</p>
                </div>
                <div className="duration-bars">
                  <div className="duration-bar-group">
                    <p className="bar-label">Original Segment</p>
                    <div className="duration-bar">
                      <div className="bar-fill" style={{ width: `${(segmentDuration / 30) * 100}%` }}></div>
                      <div className="bar-markers">
                        <span>0</span>
                        <span>5</span>
                        <span>10</span>
                        <span>15</span>
                      </div>
                    </div>
                  </div>
                  <div className="duration-bar-group">
                    <p className="bar-label">New Segment (at {playbackSpeed}x)</p>
                    <div className="duration-bar">
                      <div className="bar-fill" style={{ width: `${(newSegmentDuration / 30) * 100}%` }}></div>
                      <div className="bar-markers">
                        <span>0</span>
                        <span>5</span>
                        <span>10</span>
                      </div>
                    </div>
                  </div>
                </div>
                <p className="duration-change">
                  Total video duration change: {durationChange >= 0 ? '+' : ''}{Math.round(durationChange)} seconds
                </p>
              </div>
            </div>
          </div>
          </div>

          {/* Right Side: Preview */}
          <div className="right-section">
            <div className="preview-panel">
              <h2 className="panel-title">Preview</h2>
              <div className="preview-player-container">
                <div className="preview-video-frame">
                  <div className="video-frame-content">🏔️🌊</div>
                </div>
                <div className="player-controls-panel">
                  <button className="player-control-btn">▶</button>
                  <button className="player-control-btn">⏹</button>
                  <div className="progress-control">
                    <div className="progress-bar-player">
                      <div className="progress-indicator-player" style={{ left: `${(startTime / 30) * 100}%` }}></div>
                    </div>
                  </div>
                  <span className="time-display">{formatTime(startTime)}</span>
                  <span className="time-display">/</span>
                  <span className="time-display">{formatTime(30)}</span>
                  <button className="player-control-btn">🔇</button>
                  <button className="player-control-btn">⚙️</button>
                  <button className="player-control-btn">⛶</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="action-bar">
        <button className="cancel-button" onClick={onBack}>Cancel</button>
        <button className="next-button">Next: Preview &gt;</button>
      </div>
    </div>
  );
}

export default ChangePlaybackSpeed;
