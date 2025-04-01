import React from "react";
import { useNavigate } from "react-router-dom";
import "./LandingPage.css";

function LandingPage() {
  const navigate = useNavigate();

  const entrar = () => {
    navigate("/app");
  };

  return (
    <div className="landing-container">
      <h1>🛒 Lista Roomies</h1>
      <p>Organizá las compras con tus compañeros de casa de forma fácil y colaborativa.</p>
      <button onClick={entrar}>Entrar</button>
    </div>
  );
}

export default LandingPage;
