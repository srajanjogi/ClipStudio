import React, { useState } from 'react';
import './FileUpload.css';

function FileUpload({ onFileSelect, onClose, title = "Upload Video", acceptedFormats = "MP4, MOV, AVI, MKV", maxSize = "500MB" }) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('video/')) {
      handleFileSelection(file);
    }
  };

  const handleFileInput = async (e) => {
    // If Electron API is available, use native dialog instead
    if (window.electronAPI?.selectVideoFile) {
      e.preventDefault();
      try {
        const result = await window.electronAPI.selectVideoFile();
        if (!result.canceled && result.filePath) {
          // Create a file-like object with the path
          const fileWithPath = {
            name: result.filePath.split(/[/\\]/).pop(), // Get filename from path
            path: result.filePath,
            size: 0, // We don't know the size without reading the file
            type: 'video/*'
          };
          handleFileSelection(fileWithPath);
        }
      } catch (err) {
        console.error('Error using native file dialog:', err);
        // Fall back to browser file input
        const file = e.target.files[0];
        if (file) {
          handleFileSelection(file);
        }
      }
    } else {
      // Fallback to browser file input
      const file = e.target.files[0];
      if (file) {
        handleFileSelection(file);
      }
    }
  };

  const handleFileSelection = (file) => {
    setSelectedFile(file);
    // Simulate upload progress
    let progress = 0;
    const interval = setInterval(() => {
      progress += 10;
      setUploadProgress(progress);
      if (progress >= 100) {
        clearInterval(interval);
        // Automatically proceed after upload completes
        setTimeout(() => {
          if (onFileSelect) {
            onFileSelect(file);
          }
        }, 800);
      }
    }, 150);
  };

  const handleContinue = () => {
    if (selectedFile && onFileSelect) {
      onFileSelect(selectedFile);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setUploadProgress(0);
  };

  return (
    <div className="file-upload-overlay" onClick={onClose}>
      <div className="file-upload-modal" onClick={(e) => e.stopPropagation()}>
        <div className="file-upload-header">
          <div className="header-left">
            <div className="cloud-icon">☁️</div>
            <div>
              <h2 className="upload-title">{title}</h2>
              <p className="upload-subtitle">Select and upload the file of your choice</p>
            </div>
          </div>
          <button className="close-button" onClick={onClose}>✕</button>
        </div>

        <div className="file-upload-content">
          {!selectedFile ? (
            <div
              className={`drop-zone ${isDragging ? 'dragging' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="drop-zone-icon">☁️</div>
              <p className="drop-zone-text">Choose a file or drag & drop it here</p>
              <p className="drop-zone-formats">{acceptedFormats} formats, up to {maxSize}</p>
              <input
                type="file"
                id="file-input"
                accept="video/*"
                onChange={handleFileInput}
                style={{ display: 'none' }}
              />
              <label 
                htmlFor="file-input" 
                className="browse-file-button"
                onClick={async (e) => {
                  // If Electron API is available, use native dialog instead of browser input
                  if (window.electronAPI?.selectVideoFile) {
                    e.preventDefault();
                    try {
                      const result = await window.electronAPI.selectVideoFile();
                      if (!result.canceled && result.filePath) {
                        const fileWithPath = {
                          name: result.filePath.split(/[/\\]/).pop(),
                          path: result.filePath,
                          size: 0,
                          type: 'video/*'
                        };
                        handleFileSelection(fileWithPath);
                      }
                    } catch (err) {
                      console.error('Error using native file dialog:', err);
                      // Fall back to browser file input - trigger click on hidden input
                      document.getElementById('file-input').click();
                    }
                  }
                  // If no Electron API, the label will trigger the file input normally
                }}
              >
                Browse File
              </label>
            </div>
          ) : (
            <div className="file-list">
              <div className="file-item">
                <div className="file-icon">📹</div>
                <div className="file-info">
                  <p className="file-name">{selectedFile.name}</p>
                  {uploadProgress < 100 ? (
                    <>
                      <p className="file-size">{Math.round(selectedFile.size / 1024)} KB</p>
                      <div className="upload-progress">
                        <div className="progress-bar">
                          <div className="progress-fill" style={{ width: `${uploadProgress}%` }}></div>
                        </div>
                        <span className="upload-status">Uploading... {uploadProgress}%</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="file-size">{Math.round(selectedFile.size / 1024)} KB</p>
                      <span className="upload-status completed">✓ Completed</span>
                      <button className="continue-button" onClick={handleContinue}>
                        Continue →
                      </button>
                    </>
                  )}
                </div>
                {uploadProgress < 100 && (
                  <button className="remove-file-button" onClick={handleRemoveFile}>✕</button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default FileUpload;
