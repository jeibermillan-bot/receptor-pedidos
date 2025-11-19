// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx'; // 👈 ¿Ruta correcta?
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render( // 👈 ¿Es 'root' el ID?
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);