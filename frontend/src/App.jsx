import React, { useState } from 'react';
import HomePage from './components/HomePage';
import CutVideo from './components/CutVideo';
import MergeVideos from './components/MergeVideos';
import ChangePlaybackSpeed from './components/ChangePlaybackSpeed';
import AddAudio from './components/AddAudio';
import './App.css';

function App() {
  const [currentView, setCurrentView] = useState('home');

  const handleActionClick = (action) => {
    if (action === 'cut') {
      setCurrentView('cut-video');
    } else if (action === 'merge') {
      setCurrentView('merge-videos');
    } else if (action === 'audio') {
      setCurrentView('add-audio');
    } else if (action === 'speed') {
      setCurrentView('playback-speed');
    }
    // Add other actions later
  };

  const handleBack = () => {
    setCurrentView('home');
  };

  return (
    <div className="app">
      {currentView === 'home' && <HomePage onActionClick={handleActionClick} />}
      {currentView === 'cut-video' && <CutVideo onBack={handleBack} />}
      {currentView === 'merge-videos' && <MergeVideos onBack={handleBack} />}
      {currentView === 'add-audio' && <AddAudio onBack={handleBack} />}
      {currentView === 'playback-speed' && <ChangePlaybackSpeed onBack={handleBack} />}
    </div>
  );
}

export default App;
