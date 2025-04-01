import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useParams,
} from "react-router-dom";
import Producto from "./Producto";
import "./App.css";

import db, { auth, googleProvider } from "./firebase"; // unificá todo lo que viene de firebase.js

import {
  collection,
  addDoc,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  getDocs, // 👈 incluí este aquí para evitar la doble línea
} from "firebase/firestore";

import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";

// -------------------- COMPONENTE PRINCIPAL --------------------
function App() {
  const [historial, setHistorial] = useState([]);
  const [productos, setProductos] = useState([]);
  const [nuevoProducto, setNuevoProducto] = useState("");
  const [usuario, setUsuario] = useState(null);
  const [temaOscuro, setTemaOscuro] = useState(
    localStorage.getItem("tema") === "oscuro"
  );
  const [productoEliminando, setProductoEliminando] = useState(null);
  const [alerta, setAlerta] = useState(null);
  const toggleTema = () => {
    setTemaOscuro(!temaOscuro);
  };

  const [historialBorrando, setHistorialBorrando] = useState(false);

  const [errorInput, setErrorInput] = useState(""); // Para mensaje visual debajo del input

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
        // Si no existe la lista, la creamos
        const nuevaLista = await addDoc(collection(db, "listas"), {
          uid: usuario.uid,
        });
        escucharProductos(nuevaLista.id);
      } else {
        const listaExistente = snapshot.docs[0];
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
        setProductos(lista);
      });

      // También guardamos el ID de la lista en localStorage (opcional)
      localStorage.setItem("listaId", idLista);
    };

    obtenerListaId();
  }, [usuario]);

  // ✅ CORRECTO: este es el useEffect para escuchar historial
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

  const agregarProducto = async (e) => {
    e.preventDefault();
    const nombreLimpio = nuevoProducto.trim();

    // ⚠️ Validación 1: No vacío ni solo espacios
    if (!nombreLimpio) {
      setErrorInput("Por favor, escribe un nombre válido.");
      setNuevoProducto("");
      return;
    }

    // ⚠️ Validación 3: solo letras y espacios
    const soloLetras = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/;
    if (!soloLetras.test(nombreLimpio)) {
      mostrarAlerta("Solo se permiten letras y espacios.", "error");
      setNuevoProducto("");
      return;
    }

    // ⚠️ Validación 2: mínimo 3 caracteres
    if (nombreLimpio.length < 3) {
      mostrarAlerta("El nombre debe tener al menos 3 letras.", "error");
      setNuevoProducto("");
      return;
    }

    // ⚠️ Validación 2: Límite de caracteres
    if (nombreLimpio.length > 30) {
      mostrarAlerta("Máximo 30 caracteres por producto.", "error");
      setNuevoProducto("");
      return;
    }

    const nombreMinuscula = nombreLimpio.toLowerCase();

    // ⚠️ Validación 3: No duplicados
    const yaExiste = productos.some(
      (p) => p.nombre.trim().toLowerCase() === nombreMinuscula
    );

    if (yaExiste) {
      mostrarAlerta("Ese producto ya está en la lista.", "error");
      setNuevoProducto("");
      setErrorInput("");
      return;
    }

    // ✅ Si pasa todo, lo agregamos
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
    setProductoEliminando(id); // 🧼 Marcamos cuál se está eliminando

    setTimeout(async () => {
      await deleteDoc(doc(db, "productos", id));
      setProductoEliminando(null); // 🔁 Limpiamos el estado después
    }, 400); // ⏳ Esperamos 400ms para que la animación se vea
  };

  // 🧽 Limpiar historial completo del usuario
  const limpiarHistorial = async () => {
    const confirmacion = window.confirm(
      "¿Estás seguro de que querés borrar todo el historial? Esta acción no se puede deshacer."
    );
    if (!confirmacion) return;

    // 🔁 Activamos animación primero
    setHistorialBorrando(true);
    setTimeout(async () => {
      const q = query(
        collection(db, "historial"),
        where("uid", "==", usuario.uid)
      );
      const docs = await getDocs(q);
      const promesas = docs.docs.map((docu) =>
        deleteDoc(doc(db, "historial", docu.id))
      );
      await Promise.all(promesas);
      mostrarAlerta("Historial limpiado 🧽", "success");
      setHistorialBorrando(false);
    }, 300); // tiempo que dura la animación
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
  };

  const mostrarAlerta = (mensaje, tipo = "success") => {
    setAlerta({ mensaje, tipo });
    setTimeout(() => {
      setAlerta(null);
    }, 3000);
  };

  const copiarEnlace = (uid) => {
    const listaId = localStorage.getItem("listaId");
    const enlace = `${window.location.origin}/lista/${listaId}`;
    navigator.clipboard.writeText(enlace);
    mostrarAlerta("¡Enlace copiado al portapapeles! 📋", "success");
  };

  return (
    <div>
      <h1>Lista Compartida de Compras 🛒</h1>

      {alerta && (
        <div className={`alerta ${alerta.tipo}`}>{alerta.mensaje}</div>
      )}

      {!usuario ? (
        <button onClick={login}>Iniciar sesión con Google</button>
      ) : (
        <>
          <p>Bienvenido, {usuario.displayName}</p>

          <div
            style={{
              marginTop: "10px",
              display: "flex",
              gap: "10px",
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <button onClick={toggleTema}>
              Cambiar a modo {temaOscuro ? "claro ☀️" : "oscuro 🌙"}
            </button>

            <button onClick={logout}>Cerrar sesión</button>
          </div>

          <p style={{ marginTop: "10px", fontWeight: "bold" }}>
            🧾 Tienes {productos.filter((p) => !p.comprado).length} pendiente(s)
            y {productos.filter((p) => p.comprado).length} comprado(s)
          </p>

          <p style={{ marginTop: "10px" }}>
            <button onClick={() => copiarEnlace(usuario.uid)}>
              Compartir mi lista 🔗
            </button>
          </p>

          <form onSubmit={agregarProducto}>
            <input
              type="text"
              placeholder="Escribe un producto"
              value={nuevoProducto}
              onChange={(e) => setNuevoProducto(e.target.value)}
            />
            {errorInput && (
              <p style={{ color: "red", fontSize: "14px", margin: "5px 0" }}>
                {errorInput}
              </p>
            )}

            <button type="submit">Agregar</button>
          </form>

          <ul>
            {productos.map((producto) => (
              <li key={producto.id}>
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

          <h2 style={{ marginTop: "30px" }}>
            🕓 Historial de productos tachados
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
              </li>
            ))}
          </ul>
          {historial.length === 0 && (
            <p
              style={{ color: "#888", fontStyle: "italic", marginTop: "10px" }}
            >
              El historial está vacío 💤
            </p>
          )}

          {historial.length > 0 && (
            <button onClick={limpiarHistorial} style={{ marginTop: "10px" }}>
              Limpiar historial 🧽
            </button>
          )}
        </>
      )}
    </div>
  );
}

// -------------------- COMPONENTE LISTA COMPARTIDA --------------------
function ListaCompartida() {
  const { uid } = useParams(); // uid = listaId
  const [productos, setProductos] = useState([]);
  const [nuevoProducto, setNuevoProducto] = useState("");
  const [productoEliminando, setProductoEliminando] = useState(null);
  const [alerta, setAlerta] = useState(null);

  useEffect(() => {
    if (!uid) return;

    const q = query(collection(db, "productos"), where("listaId", "==", uid));
    const unsub = onSnapshot(q, (snapshot) => {
      const lista = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setProductos(lista);
    });

    return () => unsub();
  }, [uid]);

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
      setAlerta({ mensaje: "Ya existe ese producto", tipo: "error" });
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
  };

  const eliminarProducto = (id) => {
    setProductoEliminando(id);

    setTimeout(async () => {
      await deleteDoc(doc(db, "productos", id));
      setProductoEliminando(null);
    }, 400);
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
          <Producto
            key={producto.id}
            nombre={producto.nombre}
            comprado={producto.comprado}
            onClick={() =>
              marcarComoComprado(producto.id, producto.comprado)
            }
            onDelete={() => eliminarProducto(producto.id)}
            claseExtra={`nuevo ${
              productoEliminando === producto.id ? "eliminando" : ""
            }`}
          />
        ))}
      </ul>
    </div>
  );
}


// -------------------- MAIN APP (rutas) --------------------
function MainApp() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/lista/:uid" element={<ListaCompartida />} />
      </Routes>
    </Router>
  );
}

export default MainApp;
