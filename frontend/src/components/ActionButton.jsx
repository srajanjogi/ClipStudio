import React from 'react';
import './ActionButton.css';

// Icon components
const CutIcon = () => (
  <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M20 32L44 32" stroke="#000" strokeWidth="2" strokeDasharray="4 4"/>
    <path d="M32 20L32 44" stroke="#000" strokeWidth="2"/>
    <path d="M16 20L24 28L16 36" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M48 20L40 28L48 36" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const MergeIcon = () => (
  <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="12" y="16" width="20" height="32" rx="2" fill="#666" opacity="0.3"/>
    <rect x="32" y="16" width="20" height="32" rx="2" fill="#666" opacity="0.3"/>
    <path d="M24 20L24 44" stroke="#000" strokeWidth="1.5"/>
    <path d="M28 20L28 44" stroke="#000" strokeWidth="1.5"/>
    <path d="M40 20L40 44" stroke="#000" strokeWidth="1.5"/>
    <path d="M44 20L44 44" stroke="#000" strokeWidth="1.5"/>
    <path d="M32 32L40 32" stroke="#000" strokeWidth="2" strokeLinecap="round"/>
    <path d="M36 28L40 32L36 36" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const AudioIcon = () => (
  <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M16 20L16 44L24 44L32 50L32 14L24 20L16 20Z" fill="#666" opacity="0.3"/>
    <path d="M16 20L16 44L24 44L32 50L32 14L24 20L16 20Z" stroke="#000" strokeWidth="2" strokeLinejoin="round"/>
    <path d="M36 24L36 40" stroke="#000" strokeWidth="2" strokeLinecap="round"/>
    <path d="M40 22L40 42" stroke="#000" strokeWidth="2" strokeLinecap="round"/>
    <path d="M44 20L44 44" stroke="#000" strokeWidth="2" strokeLinecap="round"/>
    <path d="M48 18L48 46" stroke="#000" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const SpeedIcon = () => (
  <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="32" cy="32" r="20" stroke="#000" strokeWidth="2"/>
    <path d="M32 12L32 32L20 32" stroke="#000" strokeWidth="2" strokeLinecap="round"/>
    <path d="M32 12L28 16" stroke="#000" strokeWidth="2" strokeLinecap="round"/>
    <path d="M32 12L36 16" stroke="#000" strokeWidth="2" strokeLinecap="round"/>
    <circle cx="32" cy="32" r="2" fill="#000"/>
  </svg>
);

const iconMap = {
  cut: <CutIcon />,
  merge: <MergeIcon />,
  audio: <AudioIcon />,
  speed: <SpeedIcon />
};

function ActionButton({ iconType, title, description, onClick }) {
  return (
    <button className="action-button" onClick={onClick}>
      <div className="action-icon">{iconMap[iconType]}</div>
      <div className="action-content">
        <h3 className="action-title">{title}</h3>
        <p className="action-description">{description}</p>
      </div>
    </button>
  );
}

export default ActionButton;
