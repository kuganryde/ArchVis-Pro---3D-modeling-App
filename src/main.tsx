import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import SaaSGate from './components/SaaSGate.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SaaSGate />
  </StrictMode>,
);
