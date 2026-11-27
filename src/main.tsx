import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import SaaSGate from './components/SaaSGate.tsx';
// Self-hosted fonts (no third-party font requests): Bricolage Grotesque for display type,
// IBM Plex Sans for interface text, IBM Plex Mono for dimensions, IDs and readouts.
import '@fontsource-variable/bricolage-grotesque/wght.css';
import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SaaSGate />
  </StrictMode>,
);
