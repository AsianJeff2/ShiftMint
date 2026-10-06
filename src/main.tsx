import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { HashRouter } from 'react-router-dom';
import { LocalAuthProvider } from '@/contexts/LocalAuthContext';
import { Toaster } from 'sonner';
import { Toaster as FormToaster } from '@/components/ui/toaster';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <LocalAuthProvider>
        <App />
        <Toaster richColors position="top-right" />
        <FormToaster />
      </LocalAuthProvider>
    </HashRouter>
  </React.StrictMode>
);
