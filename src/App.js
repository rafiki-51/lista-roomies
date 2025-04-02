import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useParams,
  useNavigate,
} from "react-router-dom";
import Producto from "./Producto";
import "./App.css";

import db, { auth, googleProvider } from "./firebase";

import {
  collection,
  addDoc,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  getDocs,
} from "firebase/firestore";

import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import LandingPage from "./LandingPage";
import LoginEmail from "./LoginEmail";

// -------------------- COMPONENTE PRINCIPAL --------------------
function App() {
  const navigate = useNavigate(); // ✅ Para redirigir al cerrar sesión

  const [historial, setHistorial] = useState([]);
  const [productos, setProductos] = useState([]);
  const [nuevoProducto, setNuevoProducto] = useState("");
  const [usuario, setUsuario] = useState(null);
  const [temaOscuro, setTemaOscuro] = useState(
    localStorage.getItem("tema") === "oscuro"
  );
  const [productoEliminando, setProductoEliminando] = useState(null);
  const [alerta, setAlerta] = useState(null);
  const [historialBorrando, setHistorialBorrando] = useState(false);
  const [errorInput, setErrorInput] = useState("");

  const toggleTema = () => {
    setTemaOscuro(!temaOscuro);
  };

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setUsuario(user);
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    document.body.className = temaOscuro ? "tema-oscuro" : "";
    localStorage.setItem("tema", temaOscuro ? "oscuro" : "claro");
  }, [temaOscuro]);

  useEffect(() => {
    if (!usuario) return;

    const obtenerListaId = async () => {
      const q = query(
        collection(db, "listas"),
        where("uid", "==", usuario.uid)
      );
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        const nuevaLista = await addDoc(collection(db, "listas"), {
          uid: usuario.uid,
        });
        localStorage.setItem("listaId", nuevaLista.id);
        escucharProductos(nuevaLista.id);
      } else {
        const listaExistente = snapshot.docs[0];
        localStorage.setItem("listaId", listaExistente.id);
        escucharProductos(listaExistente.id);
      }
    };

    const escucharProductos = (idLista) => {
      const q = query(
        collection(db, "productos"),
        where("listaId", "==", idLista)
      );
      const unsub = onSnapshot(q, (snapshot) => {
        const lista = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setProductos(lista.reverse());
      });
    };

    obtenerListaId();
  }, [usuario]);

  useEffect(() => {
    const listaId = localStorage.getItem("listaId");
    if (!listaId) return;

    const q = query(
      collection(db, "historial"),
      where("listaId", "==", listaId)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const lista = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      lista.sort((a, b) => b.timestamp?.seconds - a.timestamp?.seconds);
      setHistorial(lista);
    });

    return () => unsub();
  }, []);

  const eliminarHistorialItem = async (id) => {
    try {
      await deleteDoc(doc(db, "historial", id));
      mostrarAlerta("Producto eliminado del historial 🗑️", "success");
    } catch (error) {
      mostrarAlerta("Error al eliminar historial ❌", "error");
    }
  };

  const agregarProducto = async (e) => {
    e.preventDefault();
    const nombreLimpio = nuevoProducto.trim();

    if (!nombreLimpio) {
      setErrorInput("Por favor, escribe un nombre válido.");
      setNuevoProducto("");
      return;
    }

    const soloLetras = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/;
    if (!soloLetras.test(nombreLimpio)) {
      mostrarAlerta("Solo se permiten letras y espacios.", "error");
      setNuevoProducto("");
      return;
    }

    if (nombreLimpio.length < 3) {
      mostrarAlerta("El nombre debe tener al menos 3 letras.", "error");
      setNuevoProducto("");
      return;
    }

    if (nombreLimpio.length > 30) {
      mostrarAlerta("Máximo 30 caracteres por producto.", "error");
      setNuevoProducto("");
      return;
    }

    const nombreMinuscula = nombreLimpio.toLowerCase();
    const yaExiste = productos.some(
      (p) => p.nombre.trim().toLowerCase() === nombreMinuscula
    );

    if (yaExiste) {
      mostrarAlerta("Ese producto ya está en la lista.", "error");
      setNuevoProducto("");
      setErrorInput("");
      return;
    }

    const listaId = localStorage.getItem("listaId");

    await addDoc(collection(db, "productos"), {
      nombre: nombreLimpio,
      comprado: false,
      listaId,
    });

    setNuevoProducto("");
    setErrorInput("");
    mostrarAlerta("Producto agregado ✅", "success");
  };

  const marcarComoComprado = async (id, estadoActual) => {
    const ref = doc(db, "productos", id);
    await updateDoc(ref, {
      comprado: !estadoActual,
    });

    if (!estadoActual) {
      const producto = productos.find((p) => p.id === id);
      if (producto) {
        await guardarEnHistorial(producto);
      }
    }
  };

  const eliminarProducto = (id) => {
    setProductoEliminando(id);

    setTimeout(async () => {
      await deleteDoc(doc(db, "productos", id));
      setProductoEliminando(null);
    }, 400);
  };

  const limpiarHistorial = async () => {
    const confirmacion = window.confirm(
      "¿Estás seguro de que querés borrar todo el historial? Esta acción no se puede deshacer."
    );
    if (!confirmacion) return;

    const listaId = localStorage.getItem("listaId");

    setHistorialBorrando(true);
    setTimeout(async () => {
      const q = query(
        collection(db, "historial"),
        where("listaId", "==", listaId)
      );
      const docs = await getDocs(q);
      const promesas = docs.docs.map((docu) =>
        deleteDoc(doc(db, "historial", docu.id))
      );
      await Promise.all(promesas);
      mostrarAlerta("Historial limpiado 🧽", "success");
      setHistorialBorrando(false);
    }, 300);
  };

  const guardarEnHistorial = async (producto) => {
    await addDoc(collection(db, "historial"), {
      nombre: producto.nombre,
      listaId: producto.listaId,
      timestamp: new Date(),
    });
  };

  const login = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      alert("Error al iniciar sesión");
    }
  };

  const logout = async () => {
    await signOut(auth);
    navigate("/"); // ✅ redirige a la landing
  };

  const mostrarAlerta = (mensaje, tipo = "success") => {
    setAlerta({ mensaje, tipo });
    setTimeout(() => {
      setAlerta(null);
    }, 3000);
  };

  const copiarEnlace = () => {
    const listaId = localStorage.getItem("listaId");
    const enlace = `${window.location.origin}/lista/${listaId}`;
    navigator.clipboard.writeText(enlace);
    mostrarAlerta("¡Enlace copiado al portapapeles! 📋", "success");
  };

  return (
    <div className="app-container">
      <h1>Lista Compartida de Compras 🛒</h1>

      {alerta && (
        <div className={`alerta ${alerta.tipo}`}>{alerta.mensaje}</div>
      )}

      {!usuario ? (
        <button className="primario" onClick={login}>
          Iniciar sesión con Google
        </button>
      ) : (
        <>
          <div className="seccion bienvenida">
            <p
              style={{
                fontSize: "18px",
                marginBottom: "10px",
                fontStyle: "italic",
              }}
            >
              Hola, {usuario.displayName || usuario.email}
            </p>
          </div>

          <div className="seccion">
            <button className="secundario" onClick={toggleTema}>
              Cambiar a modo {temaOscuro ? "claro ☀️" : "oscuro 🌙"}
            </button>
            <button className="logout" onClick={logout}>
              Cerrar sesión
            </button>
          </div>

          <div className="seccion">
            <p style={{ fontWeight: "bold" }}>
              🧾 Tienes {productos.filter((p) => !p.comprado).length}{" "}
              pendiente(s) y {productos.filter((p) => p.comprado).length}{" "}
              comprado(s)
            </p>
            <button className="secundario" onClick={copiarEnlace}>
              Compartir mi lista 🔗
            </button>
          </div>

          <div className="seccion">
            <form onSubmit={agregarProducto}>
              <input
                type="text"
                placeholder="Escribe un producto"
                value={nuevoProducto}
                onChange={(e) => setNuevoProducto(e.target.value)}
              />
              <button type="submit" className="primario">
                Agregar
              </button>
              {errorInput && (
                <p style={{ color: "red", fontSize: "14px", margin: "5px 0" }}>
                  {errorInput}
                </p>
              )}
            </form>
          </div>

          <ul>
            {productos.map((producto) => (
              <li
                key={producto.id}
                className={`nuevo ${
                  productoEliminando === producto.id ? "eliminando" : ""
                }`}
              >
                {producto.nombre} {producto.comprado ? "✅" : ""}
                <div style={{ display: "flex", gap: "5px", marginTop: "5px" }}>
                  <button
                    className="boton-colab"
                    onClick={() =>
                      marcarComoComprado(producto.id, producto.comprado)
                    }
                  >
                    {producto.comprado ? "Desmarcar" : "Marcar"}
                  </button>
                  <button
                    className="boton-colab"
                    onClick={() => eliminarProducto(producto.id)}
                  >
                    Eliminar
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <div className="seccion historial">
            <h2 style={{ marginTop: "30px", fontSize: "20px" }}>
              Historial de productos tachados
            </h2>
            <ul>
              {historial.map((item) => (
                <li
                  key={item.id}
                  className={`historial-item ${
                    historialBorrando ? "eliminando" : ""
                  }`}
                >
                  {item.nombre} –{" "}
                  <span style={{ fontSize: "0.9em", color: "#666" }}>
                    {new Date(item.timestamp?.seconds * 1000).toLocaleString()}
                  </span>
                  <button
                    onClick={() => eliminarHistorialItem(item.id)}
                    className="boton-colab"
                    style={{ marginLeft: "10px" }}
                  >
                    Eliminar 🗑️
                  </button>
                </li>
              ))}
            </ul>

            {historial.length === 0 && (
              <p
                style={{
                  color: "#888",
                  fontStyle: "italic",
                  marginTop: "10px",
                }}
              >
                El historial está vacío 💤
              </p>
            )}
            {historial.length > 0 && (
              <button
                className="secundario"
                onClick={limpiarHistorial}
                style={{ marginTop: "10px" }}
              >
                Limpiar historial 🧽
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// -------------------- ListaCompartida --------------------

function ListaCompartida() {
  const { uid } = useParams();
  const [productos, setProductos] = useState([]);
  const [nuevoProducto, setNuevoProducto] = useState("");
  const [productoEliminando, setProductoEliminando] = useState(null);
  const [alerta, setAlerta] = useState(null);
  const [historial, setHistorial] = useState([]); // ✅ 1️⃣ Nuevo estado para el historial
  const [historialBorrandoId, setHistorialBorrandoId] = useState(null);


  useEffect(() => {
    if (alerta) {
      const timeout = setTimeout(() => setAlerta(null), 3000);
      return () => clearTimeout(timeout);
    }
  }, [alerta]);
  

  useEffect(() => {
    if (!uid) return;

    const q = query(collection(db, "productos"), where("listaId", "==", uid));
    const unsub = onSnapshot(q, (snapshot) => {
      const lista = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setProductos(lista.reverse());
    });

    return () => unsub();
  }, [uid]);

  useEffect(() => {
    if (!uid) return;

    const q = query(collection(db, "historial"), where("listaId", "==", uid));
    const unsub = onSnapshot(q, (snapshot) => {
      const lista = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      lista.sort((a, b) => b.timestamp?.seconds - a.timestamp?.seconds);
      setHistorial(lista);
    });

    return () => unsub();
  }, [uid]); // ✅ 1️⃣ useEffect para escuchar historial

  const eliminarItemHistorial = async (id) => {
    setHistorialBorrandoId(id);
    setTimeout(async () => {
      await deleteDoc(doc(db, "historial", id));
      setHistorialBorrandoId(null);
    }, 400);
  };

  const agregarProducto = async (e) => {
    e.preventDefault();
    const nombreLimpio = nuevoProducto.trim();
    const nombreMinuscula = nombreLimpio.toLowerCase();

    if (!nombreLimpio || nombreLimpio.length > 30) {
      setAlerta({ mensaje: "Nombre inválido o muy largo", tipo: "error" });
      return;
    }

    const yaExiste = productos.some(
      (p) => p.nombre.trim().toLowerCase() === nombreMinuscula
    );
    if (yaExiste) {
      setAlerta({ mensaje: "Ese producto ya está en la lista.", tipo: "error" });
      return;
    }

    try {
      await addDoc(collection(db, "productos"), {
        nombre: nombreLimpio,
        comprado: false,
        listaId: uid,
      });
      setNuevoProducto("");
    } catch (error) {
      setAlerta({ mensaje: "Error al agregar", tipo: "error" });
    }
  };

  const marcarComoComprado = async (id, estadoActual) => {
    const ref = doc(db, "productos", id);
    await updateDoc(ref, {
      comprado: !estadoActual,
    });

    if (!estadoActual) {
      const producto = productos.find((p) => p.id === id);
      if (producto) {
        await guardarEnHistorial(producto);
      }
    }
  };

  const eliminarProducto = (id) => {
    setProductoEliminando(id);

    setTimeout(async () => {
      await deleteDoc(doc(db, "productos", id));
      setProductoEliminando(null);
    }, 400);
  };

  const guardarEnHistorial = async (producto) => {
    await addDoc(collection(db, "historial"), {
      nombre: producto.nombre,
      listaId: producto.listaId,
      timestamp: new Date(),
    });
  };

  return (
    <div>
      <h1>Lista de Compras Compartida 🛒</h1>

      <form onSubmit={agregarProducto}>
        <input
          type="text"
          placeholder="Escribe un producto"
          value={nuevoProducto}
          onChange={(e) => setNuevoProducto(e.target.value)}
        />
        <button type="submit">Agregar</button>
      </form>

      {alerta && (
        <div className={`alerta ${alerta.tipo}`}>{alerta.mensaje}</div>
      )}

      <ul>
        {productos.map((producto) => (
          <li
            key={producto.id}
            className={`nuevo ${
              productoEliminando === producto.id ? "eliminando" : ""
            }`}
          >
            {producto.nombre} {producto.comprado ? "✅" : ""}
            <div style={{ display: "flex", gap: "5px", marginTop: "5px" }}>
              <button
                className="boton-colab"
                onClick={() =>
                  marcarComoComprado(producto.id, producto.comprado)
                }
              >
                {producto.comprado ? "Desmarcar" : "Marcar"}
              </button>
              <button
                className="boton-colab"
                onClick={() => eliminarProducto(producto.id)}
              >
                Eliminar
              </button>
            </div>
          </li>
        ))}
      </ul>

      {/* ✅ 2️⃣ Mostrar historial */}
      <div className="seccion historial">
        <h2 style={{ marginTop: "30px", fontSize: "20px" }}>
          Historial de productos tachados
        </h2>

        <ul>
          {historial.map((item) => (
            <li
              key={item.id}
              className={`historial-item ${
                historialBorrandoId === item.id ? "eliminando" : ""
              }`}
            >
              {item.nombre} –{" "}
              <span style={{ fontSize: "0.9em", color: "#666" }}>
                {new Date(item.timestamp?.seconds * 1000).toLocaleString()}
              </span>
              <button
                className="boton-colab"
                onClick={() => eliminarItemHistorial(item.id)}
                style={{ marginLeft: "10px" }}
              >
                🗑️
              </button>
            </li>
          ))}
        </ul>

        {historial.length === 0 && (
          <p style={{ color: "#888", fontStyle: "italic", marginTop: "10px" }}>
            El historial está vacío 💤
          </p>
        )}
      </div>
    </div>
  );
}

// -------------------- MAIN ROUTER --------------------

function MainApp() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/app" element={<App />} />
        <Route path="/lista/:uid" element={<ListaCompartida />} />
        <Route path="/login-email" element={<LoginEmail />} />
      </Routes>
    </Router>
  );
}

export default MainApp;
