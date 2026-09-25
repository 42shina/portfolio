import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import ProjectPage from './components/ProjectPage.jsx';
import content from './content';
import './styles.css';

const root = document.getElementById('root');
const projectMatch = window.location.pathname.match(/^\/projects\/([^/]+)(?:\/index\.html|\/)?$/);

if (projectMatch) {
  const project = content.projects.find((item) => item.id === projectMatch[1]);
  if (!project) {
    window.location.replace('/404.html');
  } else {
    document.title = `${project.title} | T.S Portfolio`;
    const description = document.querySelector('meta[name="description"]');
    if (description) description.setAttribute('content', project.description);
    createRoot(root).render(<ProjectPage project={project} />);
  }
} else {
  createRoot(root).render(<App />);
}
