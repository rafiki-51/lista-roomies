import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import MainApp from './App'; // ⬅️ Cambiá esto (antes decía App)
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <MainApp /> {/* ⬅️ Cambiá esto también */}
  </React.StrictMode>
);

reportWebVitals();
