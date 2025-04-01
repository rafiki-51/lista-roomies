import React from 'react';

function Producto({ nombre, comprado, onClick, onDelete, claseExtra }) {
  return (
    <li
      className={`${comprado ? 'comprado' : ''} ${claseExtra || ''}`}
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        cursor: 'pointer'
      }}
    >
      <span onClick={onClick}>{nombre}</span>
      <button
        onClick={(e) => {
          e.stopPropagation(); // evita que se tache al hacer clic en el basurero
          onDelete();
        }}
        style={{
          backgroundColor: 'transparent',
          border: 'none',
          color: 'red',
          fontSize: '18px',
          cursor: 'pointer'
        }}
        title="Eliminar"
      >
        🗑️
      </button>
    </li>
  );
}

export default Producto;
