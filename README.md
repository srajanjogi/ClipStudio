# ClipStudio

A professional desktop video editor built with Electron, React, and Vite. Features an innovative action-first user experience that reduces cognitive load and streamlines the editing workflow.

## Features

- **Action-First UX** - Intuitive workflow that reduces cognitive load
- **Cut Video** - Remove unwanted parts with precision
- **Merge Videos** - Combine videos sequentially or overlay
- **Add Audio** - Overlay background or voice audio tracks
- **Change Playback Speed** - Adjust speed (0.5x - 2x) for specific segments

## Tech Stack

- **Electron** - Cross-platform desktop application framework
- **React** - Modern UI library with component-based architecture
- **Vite** - Next-generation frontend build tool
- **FFmpeg** - Industry-standard video processing engine

## Development

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn

### Installation

```bash
npm install
```

### Run in Development Mode

```bash
npm run electron:dev
```

This will:
1. Start the Vite dev server on http://localhost:5173
2. Launch the Electron app once the server is ready

### Build for Production

```bash
npm run build
npm run electron
```

## Project Structure

```
├── electron/
│   ├── main.js          # Main Electron process
│   └── preload.js       # Preload script
├── frontend/
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── App.jsx      # Main app component
│   │   ├── main.jsx     # React entry point
│   │   └── index.css    # Global styles
│   ├── index.html       # HTML template
│   └── vite.config.js   # Vite configuration
└── package.json         # Dependencies and scripts
```
