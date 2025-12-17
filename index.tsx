import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Suppress specific browser extension errors that are unrelated to the app's functionality
window.addEventListener('error', (event) => {
  // "Extension context invalidated" happens when a browser extension updates or crashes.
  // We prevent it from reporting as an uncaught error in the console.
  if (event.message && event.message.includes('Extension context invalidated')) {
    event.preventDefault();
    event.stopImmediatePropagation();
    console.debug('Suppressed external browser extension error.');
  }
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);