import React, { useState } from "react";
import { auth } from "./firebase";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { useNavigate } from "react-router-dom"; // ✅

function LoginEmail() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [modoRegistro, setModoRegistro] = useState(false);
  const [mensaje, setMensaje] = useState(null);

  const navigate = useNavigate(); // ✅

  const manejarSubmit = async (e) => {
    e.preventDefault();
    try {
      if (modoRegistro) {
        await createUserWithEmailAndPassword(auth, email, password);
        setMensaje("✅ Usuario creado exitosamente.");
        navigate("/app"); // ✅ redirigir
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        setMensaje("✅ Sesión iniciada correctamente.");
        navigate("/app"); // ✅ redirigir
      }
    } catch (error) {
      setMensaje(`❌ Error: ${error.message}`);
    }
  };

  return (
    <div className="app-container">
      <h1>{modoRegistro ? "Crear cuenta" : "Iniciar sesión"}</h1>

      {mensaje && <p style={{ marginBottom: "15px", color: "#dc2626" }}>{mensaje}</p>}

      <form onSubmit={manejarSubmit}>
        <input
          type="email"
          placeholder="Correo electrónico"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button className="primario" type="submit">
          {modoRegistro ? "Registrarse" : "Iniciar sesión"}
        </button>
      </form>

      <button
        className="secundario"
        onClick={() => setModoRegistro(!modoRegistro)}
        style={{ marginTop: "15px" }}
      >
        {modoRegistro ? "Ya tengo cuenta" : "Crear nueva cuenta"}
      </button>
    </div>
  );
}

export default LoginEmail;
