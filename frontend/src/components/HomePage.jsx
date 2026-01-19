import React from 'react';
import ActionButton from './ActionButton';
import './HomePage.css';

function HomePage({ onActionClick }) {
  const handleActionClick = (action) => {
    if (onActionClick) {
      onActionClick(action);
    }
  };

  return (
    <div className="homepage">
      <div className="hero-section">
        <h1 className="hero-title">Every tool you need to edit videos in one place</h1>
        <p className="hero-description">
          Every tool you need to edit videos, at your fingertips. All are 100% FREE and easy to use! 
          Cut, merge, add audio, and change playback speed with just a few clicks.
        </p>
      </div>

      <div className="homepage-content">
        <h2 className="section-title">What would you like to do?</h2>
        
        <div className="actions-grid">
          <ActionButton
            iconType="cut"
            title="Cut Video"
            description="Remove unwanted parts"
            onClick={() => handleActionClick('cut')}
          />
          <ActionButton
            iconType="merge"
            title="Merge Videos"
            description="Combine two videos"
            onClick={() => handleActionClick('merge')}
          />
          <ActionButton
            iconType="audio"
            title="Add Audio"
            description="Overlay background or voice audio"
            onClick={() => handleActionClick('audio')}
          />
          <ActionButton
            iconType="speed"
            title="Change Playback Speed"
            description="Speed up or slow down selected parts"
            onClick={() => handleActionClick('speed')}
          />
        </div>
      </div>
    </div>
  );
}

export default HomePage;
