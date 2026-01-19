import React, { useState } from 'react';
import FileUpload from './FileUpload';
import './AddAudio.css';

function AddAudio({ onBack }) {
  // step: upload-base -> configure
  const [step, setStep] = useState('upload-base');
  const [baseVideo, setBaseVideo] = useState(null);
  const [audioTrack, setAudioTrack] = useState(null);
  const [volume, setVolume] = useState(50);
  const [placementMode, setPlacementMode] = useState('start');
  const [placementOption, setPlacementOption] = useState('start');
  const [loopAudio, setLoopAudio] = useState(true);
  const [audioStart, setAudioStart] = useState('00:00:00');
  const [audioEnd, setAudioEnd] = useState('00:01:30');

  const handleBaseVideoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setBaseVideo({
        name: file.name,
        duration: '00:01:30', // mock duration
      });
    }
  };

  const handleBaseVideoSelect = (file) => {
    if (file) {
      setBaseVideo({
        name: file.name,
        duration: '00:01:30', // mock duration
      });
      setStep('configure');
    }
  };

  const handleAudioTrackChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAudioTrack({
        name: file.name,
        duration: '00:02:00', // mock duration
      });
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
                <div className="thumbnail-play-icon">▶</div>
              </div>
              <div className="base-video-details">
                <p className="file-label">
                  Filename: {baseVideo ? baseVideo.name : 'No file selected'}
                </p>
                <p className="file-duration">
                  Duration: {baseVideo ? baseVideo.duration : '00:00:00'}
                </p>
                <label className="file-button">
                  Choose File
                  <input type="file" accept="video/*" onChange={handleBaseVideoChange} hidden />
                </label>
              </div>
            </div>
          </div>

          {/* Audio Track */}
          <div className="panel audio-track-panel">
            <h2 className="panel-title">Audio Track</h2>
            <div className="audio-upload-area">
              <div className="audio-upload-border">
                <p className="upload-title">Audio file upload area</p>
                <p className="upload-icon-row">♫ ♪</p>
                <p className="file-label">
                  Filename: {audioTrack ? audioTrack.name : 'No file selected'}
                </p>
                <p className="file-duration">
                  Duration: {audioTrack ? audioTrack.duration : '00:00:00'}
                </p>
                <label className="file-button">
                  Browse Audio File
                  <input type="file" accept="audio/*" onChange={handleAudioTrackChange} hidden />
                </label>
              </div>
            </div>

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
                  onChange={(e) => setPlacementOption(e.target.value)}
                >
                  <option value="start">Start from beginning</option>
                  <option value="custom">Use custom timeframe</option>
                  <option value="loop">Loop across video</option>
                </select>
              </div>

              <div className="placement-options">
                <label className="placement-option">
                  <input
                    type="radio"
                    name="placementMode"
                    value="start"
                    checked={placementMode === 'start'}
                    onChange={(e) => setPlacementMode(e.target.value)}
                  />
                  <span>Start from beginning</span>
                </label>
                <label className="placement-option">
                  <input
                    type="radio"
                    name="placementMode"
                    value="custom"
                    checked={placementMode === 'custom'}
                    onChange={(e) => setPlacementMode(e.target.value)}
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

            <div className="timeline-preview-box">
              <div className="timeline-header">
                <span>00:00:00</span>
                <span>00:00:30</span>
                <span>00:01:00</span>
                <span>00:01:30</span>
              </div>

              <div className="tracks-container">
                <div className="track-row track-video-row">
                  <span className="track-label">Video track</span>
                  <div className="track-timeline video-track-timeline">
                    <div className="video-segment" />
                    <div className="video-segment second" />
                    <div className="video-segment third" />
                  </div>
                </div>

                <div className="track-row track-audio-row">
                  <span className="track-label">Audio track</span>
                  <div className="track-timeline audio-track-timeline">
                    <div className="audio-selection" />
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
                  />
                </div>
                <div className="time-label-row">
                  <span>Audio End:</span>
                  <input
                    type="text"
                    value={audioEnd}
                    onChange={(e) => setAudioEnd(e.target.value)}
                    className="time-field"
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
            <button className="primary-button">Preview</button>
            <button className="secondary-button" onClick={onBack}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AddAudio;
