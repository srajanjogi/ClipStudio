import React from 'react';
import './RecentProjects.css';

function RecentProjects() {
  // Mock data - will be replaced with actual data later
  const projects = [
    { name: 'Project 1', lastEdited: '2 days ago' },
    { name: 'Project 2', lastEdited: '1 week ago' },
    { name: 'Project 3', lastEdited: '3 weeks ago' }
  ];

  return (
    <div className="recent-projects">
      <div className="recent-projects-header">
        <h2 className="recent-projects-title">Recent Projects</h2>
        <a href="#" className="view-all-link">View All</a>
      </div>
      <div className="projects-list">
        {projects.map((project, index) => (
          <div key={index} className="project-card">
            <div className="project-play-icon">▶</div>
            <div className="project-info">
              <p className="project-name">{project.name}</p>
              <p className="project-date">{project.lastEdited}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default RecentProjects;
