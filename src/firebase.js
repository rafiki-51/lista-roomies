// src/firebase.js 
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// Configuración de Firebase (esto te lo dio Firebase)
const firebaseConfig = {
  apiKey: "AIzaSyDnbdqA7O1AOQVJIItAsAzlabNt5KXY8wg",
  authDomain: "lista-roomies.firebaseapp.com",
  projectId: "lista-roomies",
  storageBucket: "lista-roomies.firebasestorage.app",
  messagingSenderId: "77960466239",
  appId: "1:77960466239:web:246a72d2f6e854d23bcd8a"
};

// Inicializa Firebase
const app = initializeApp(firebaseConfig);

// Inicializa Firestore
const db = getFirestore(app);

// Inicializa Auth
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Exporto la base de datos
export default db;
