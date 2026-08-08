import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!, {
  // Production error visibility: log to console (file-based logging in Electron).
  onCaughtError: (err) => {
    console.error('React caught error:', err);
  },
  onUncaughtError: (err) => {
    console.error('React uncaught error:', err);
  }
}).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
