import React from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import App from './app';
import './styles.css';

// Check if we're running in a browser environment
const isBrowser = typeof window !== 'undefined' && window.document;

// Only run the client-side code if we're in a browser
if (isBrowser) {
  // Wait for DOM to be ready
  document.addEventListener('DOMContentLoaded', () => {
    const rootElement = document.getElementById('root');

    if (!rootElement) {
      console.error('Failed to find the root element');
    } else {
      // Check if the root already has content (server-side rendered)
      const hasChildNodes = rootElement.hasChildNodes();

      if (hasChildNodes) {
        // If server-rendered, hydrate
        hydrateRoot(
          rootElement,
          <React.StrictMode>
            <App />
          </React.StrictMode>
        );
      } else {
        // If not server-rendered, create new root
        const root = createRoot(rootElement);
        root.render(
          <React.StrictMode>
            <App />
          </React.StrictMode>
        );
      }
    }
  });
}

// Export App for server-side rendering
export default App;
