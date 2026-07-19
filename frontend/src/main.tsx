import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { AppRouter } from './router';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppRouter />
  </React.StrictMode>,
);
console.log("API URL:", import.meta.env.VITE_API_URL);
