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
});

