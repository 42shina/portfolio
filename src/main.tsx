import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import ProjectPage from './components/ProjectPage';
import DocumentPage from './components/DocumentPage';
import content from './content';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('Root element is missing');
const projectMatch = window.location.pathname.match(/^\/projects\/([^/]+)(?:\/index\.html|\/)?$/);
const documentMatch = window.location.pathname.match(/^\/documents\/(portfolio|resume)(?:\/index\.html|\/)?$/);

if (documentMatch?.[1] === 'portfolio') {
  window.location.replace('/');
} else if (documentMatch) {
  document.title = `${documentMatch[1] === 'resume' ? '職務経歴書' : 'ポートフォリオ'} | ${content.brand}`;
  createRoot(root).render(<DocumentPage />);
} else if (projectMatch) {
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
