const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * Open a native file dialog to select a video file.
   * Returns a promise that resolves with { canceled: boolean, filePath?: string, file?: File }.
   */
  selectVideoFile: () => ipcRenderer.invoke('select-video-file'),
  /**
   * Export a cut/trimmed version of a video.
   * options: { inputPath: string, start: number, end: number, duration: number }
   * Returns a promise that resolves with { canceled: boolean, filePath?: string }.
   */
  exportCutVideo: (options) => ipcRenderer.invoke('export-cut-video', options),
  /**
   * Create a temporary trimmed video for preview.
   * options: { inputPath: string, start: number, end: number, duration: number }
   * Returns a promise that resolves with { filePath?: string, error?: string }.
   */
  createPreviewVideo: (options) => ipcRenderer.invoke('create-preview-video', options),
  /**
   * Clean up a temporary preview video file.
   * options: { filePath: string }
   * Returns a promise that resolves with { success: boolean, error?: string }.
   */
  cleanupPreviewVideo: (options) => ipcRenderer.invoke('cleanup-preview-video', options),
  /**
   * Get video metadata (duration, resolution, etc.)
   * options: { videoPath: string }
   * Returns a promise that resolves with { duration?: number, durationFormatted?: string, resolution?: string, error?: string }.
   */
  getVideoMetadata: (options) => ipcRenderer.invoke('get-video-metadata', options),
  /**
   * Create a thumbnail (first frame) of a video.
   * options: { videoPath: string }
   * Returns a promise that resolves with { thumbnailPath?: string, error?: string }.
   */
  createVideoThumbnail: (options) => ipcRenderer.invoke('create-video-thumbnail', options),
  /**
   * Export a sequential merge of two videos.
   * options: { baseVideoPath: string, insertVideoPath: string, insertionPoint: number }
   * Returns a promise that resolves with { canceled?: boolean, filePath?: string, error?: string }.
   */
  exportSequentialMerge: (options) => ipcRenderer.invoke('export-sequential-merge', options),
  /**
   * Export an overlay merge of two videos.
   * options: { baseVideoPath: string, insertVideoPath: string, insertionPoint: number }
   * Returns a promise that resolves with { canceled?: boolean, filePath?: string, error?: string }.
   */
  exportOverlayMerge: (options) => ipcRenderer.invoke('export-overlay-merge', options),
  /**
   * Create a temporary merged video for preview (sequential merge).
   * options: { baseVideoPath: string, insertVideoPath: string, insertionPoint: number }
   * Returns a promise that resolves with { filePath?: string, error?: string }.
   */
  createPreviewSequentialMerge: (options) => ipcRenderer.invoke('create-preview-sequential-merge', options),
  /**
   * Create a temporary merged video for preview (overlay merge).
   * options: { baseVideoPath: string, insertVideoPath: string, insertionPoint: number }
   * Returns a promise that resolves with { filePath?: string, error?: string }.
   */
  createPreviewOverlayMerge: (options) => ipcRenderer.invoke('create-preview-overlay-merge', options),
  /**
   * Clean up a temporary preview video file.
   * options: { filePath: string }
   * Returns a promise that resolves with { success: boolean, error?: string }.
   */
  cleanupMergePreviewVideo: (options) => ipcRenderer.invoke('cleanup-merge-preview-video', options),

  /**
   * Change playback speed for a segment and export full video.
   * options: { inputPath: string, start: number, end: number, speed: number }
   */
  exportSpeedChange: (options) => ipcRenderer.invoke('export-speed-change', options),

  /**
   * Create a temporary preview video with speed-changed segment.
   * options: { inputPath: string, start: number, end: number, speed: number }
   */
  createPreviewSpeedChange: (options) => ipcRenderer.invoke('create-preview-speed-change', options),

  /**
   * Clean up a temporary speed preview file.
   * options: { filePath: string }
   */
  cleanupSpeedPreviewVideo: (options) => ipcRenderer.invoke('cleanup-speed-preview-video', options),
});

