import React from "react";
import { useNavigate } from "react-router-dom";
import "./LandingPage.css";

function LandingPage() {
  const navigate = useNavigate();

  const entrar = () => {
    navigate("/app");
  };

  const irLoginEmail = () => {
    navigate("/login-email");
  };

  return (
    <div className="landing-container">
      <h1>🛒 Lista Roomies</h1>
      <p>Organizá las compras con tus compañeros de casa de forma fácil y colaborativa.</p>

      <button onClick={entrar}>Entrar</button>

      <button className="secundario" onClick={irLoginEmail} style={{ marginTop: "10px" }}>
        Iniciar sesión con Email 📧
      </button>
    </div>
  );
}

export default LandingPage;
