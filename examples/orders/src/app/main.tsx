import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './ui/App';
import './styles/styles.css';

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
