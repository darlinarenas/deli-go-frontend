/* ==========================================================
   BHUZ - MÓDULO ENVIAR PAQUETES
   Archivo: js/modulo-envios.js

   Objetivo:
   - Mantener toda la lógica de envíos separada del index.
   - No tocar comida, restaurantes, carrito, pedidos ni backend.
   - Preparar GPS, link receptor, foto, términos y cálculo temporal.
========================================================== */


/* ==========================================================
   CONFIGURACIÓN BACKEND BHUZ SERVICES
========================================================== */

const BHUZ_SERVICES_STATE = {
  serviceId: "",
  shareUrl: "",
  token: "",
  pollingId: null,
  calculoListo: false,
  receptorConfirmado: false,
  distanceKm: 0,
  totalAmount: 0,
  ultimoServicio: null,
  receptorPollingId: null,
  receptorToken: "",
  receptorUltimoEstadoVisual: "",
  receptorSonidoHabilitado: true,
  receptorRating: 0,
  envioPublicado: false,
  envioCancelado: false,
  receptorAudioDesbloqueado: false,
  receptorAudioCache: {}
};

function obtenerBackendBaseUrl() {
  /*
    Fuente real del módulo:
    - Servicios, tokens, estados, ubicación y código viven en PostgreSQL.
    - El frontend solo consume el backend.
    - No depende de localStorage ni de 127.0.0.1.
  */
  const backend = window.BHUZ_API_URL || window.API_BASE_URL || "https://deligo-backend-i554.onrender.com";
  return String(backend).replace(/\/+$/, "");
}

function construirUrlApi(ruta) {
  return `${obtenerBackendBaseUrl()}${ruta}`;
}

async function fetchConTimeout(url, opciones = {}, timeoutMs = 0) {
  /*
    No abortamos la solicitud de crear link.
    Render puede tardar algunos segundos si está despertando.
  */
  try {
    return await fetch(url, opciones);
  } catch (error) {
    throw new Error(
      error.message || "No se pudo conectar con el backend de BHUZ."
    );
  }
}

function obtenerFrontendBaseUrlCompartible() {
  /*
    Ya no usamos esta URL como fuente real del link.
    El backend arma el link con process.env.FRONTEND_URL.
    Se deja como respaldo informativo para desarrollo.
  */
  const urlActual = new URL(window.location.href);
  return `${urlActual.origin}${urlActual.pathname}`;
}


function aplicarMejorasVisualesReceptor() {
  if (document.getElementById("bhuz-receptor-compact-style")) return;

  const style = document.createElement("style");
  style.id = "bhuz-receptor-compact-style";
  style.textContent = `
    .envio-receptor-panel {
      min-height: auto !important;
      padding: 8px 0 24px !important;
    }

    .envio-receptor-card.bhuz-receptor-compacto {
      gap: 12px !important;
      padding: 18px !important;
      border-radius: 26px !important;
    }

    .envio-receptor-card.bhuz-receptor-compacto h2 {
      font-size: clamp(24px, 7vw, 34px) !important;
      line-height: 1 !important;
      margin: 0 !important;
    }

    .envio-receptor-card.bhuz-receptor-compacto > p {
      font-size: 13px !important;
      line-height: 1.35 !important;
    }

    .envio-receptor-card.bhuz-receptor-compacto .envio-receptor-status {
      padding: 11px 12px !important;
      border-radius: 16px !important;
    }

    .envio-receptor-card.bhuz-receptor-compacto .envio-receptor-seguimiento {
      gap: 7px !important;
      padding: 12px !important;
      border-radius: 18px !important;
    }

    .envio-receptor-card.bhuz-receptor-compacto .envio-receptor-seguimiento h3 {
      font-size: 15px !important;
      margin-bottom: 0 !important;
    }

    .envio-receptor-card.bhuz-receptor-compacto .envio-receptor-linea {
      grid-template-columns: 30px 1fr !important;
      padding: 8px !important;
      border-radius: 14px !important;
    }

    .envio-receptor-card.bhuz-receptor-compacto .envio-receptor-linea span {
      width: 30px !important;
      height: 30px !important;
      font-size: 13px !important;
    }

    .envio-receptor-card.bhuz-receptor-compacto .envio-codigo-entrega {
      padding: 13px !important;
      border-radius: 20px !important;
    }

    .envio-receptor-card.bhuz-receptor-compacto .envio-codigo-entrega strong {
      font-size: clamp(32px, 10vw, 48px) !important;
      letter-spacing: .10em !important;
    }

    .btn-envio-principal.bhuz-btn-confirmado,
    .btn-envio-principal:disabled {
      opacity: .72 !important;
      cursor: not-allowed !important;
      transform: none !important;
      box-shadow: none !important;
    }

    .bhuz-receptor-final {
      display: grid;
      gap: 10px;
      padding: 14px;
      border-radius: 20px;
      border: 1px solid rgba(16, 233, 129, .28);
      background: radial-gradient(circle at 0% 0%, rgba(16, 233, 129, .16), transparent 38%), rgba(0, 0, 0, .24);
      text-align: center;
    }

    .bhuz-receptor-final h3 {
      margin: 0;
      color: #10e981;
      font-size: 20px;
    }

    .bhuz-receptor-final p {
      margin: 0;
      font-size: 13px;
      color: rgba(255, 255, 255, .72);
    }

    .bhuz-receptor-stars {
      display: flex;
      justify-content: center;
      gap: 6px;
      margin-top: 2px;
    }

    .bhuz-receptor-star {
      border: 0;
      background: rgba(255, 255, 255, .08);
      color: #fbbf24;
      width: 38px;
      height: 38px;
      border-radius: 14px;
      font-size: 21px;
      cursor: pointer;
    }

    .bhuz-receptor-star.is-selected {
      background: rgba(251, 191, 36, .18);
      box-shadow: 0 0 0 1px rgba(251, 191, 36, .32) inset;
    }


    .bhuz-receptor-rating-actions {
      display: grid;
      gap: 8px;
      margin-top: 4px;
    }

    .bhuz-receptor-rating-btn {
      border: 0;
      border-radius: 16px;
      padding: 12px 14px;
      background: linear-gradient(135deg, #10e981, #0bbf68);
      color: #04130b;
      font-weight: 900;
      cursor: pointer;
      box-shadow: 0 12px 28px rgba(16, 233, 129, .20);
    }

    .bhuz-receptor-rating-btn:disabled {
      opacity: .65;
      cursor: not-allowed;
      box-shadow: none;
    }

    .bhuz-envio-publicado-box {
      display: grid;
      gap: 12px;
      margin-top: 16px;
      padding: 18px;
      border-radius: 24px;
      border: 1px solid rgba(16, 233, 129, .28);
      background:
        radial-gradient(circle at 0% 0%, rgba(16, 233, 129, .18), transparent 38%),
        linear-gradient(145deg, rgba(5, 18, 12, .96), rgba(7, 10, 16, .96));
      color: #fff;
      box-shadow: 0 18px 42px rgba(0, 0, 0, .28);
    }

    .bhuz-envio-publicado-box h3 {
      margin: 0;
      color: #10e981;
      font-size: 22px;
      line-height: 1.1;
    }

    .bhuz-envio-publicado-box p {
      margin: 0;
      color: rgba(255, 255, 255, .76);
      font-size: 14px;
      line-height: 1.35;
    }

    .bhuz-envio-publicado-status {
      display: grid;
      gap: 6px;
      padding: 14px;
      border-radius: 20px;
      background: rgba(16, 233, 129, .10);
      border: 1px solid rgba(16, 233, 129, .25);
    }

    .bhuz-envio-publicado-status span {
      color: rgba(255, 255, 255, .62);
      font-size: 12px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: .06em;
    }

    .bhuz-envio-publicado-status strong {
      color: #10e981;
      font-size: 20px;
      line-height: 1.15;
    }

    .bhuz-envio-publicado-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }

    .bhuz-envio-publicado-item {
      padding: 12px;
      border-radius: 18px;
      background: rgba(255, 255, 255, .07);
      border: 1px solid rgba(255, 255, 255, .08);
    }

    .bhuz-envio-publicado-item span {
      display: block;
      color: rgba(255, 255, 255, .58);
      font-size: 12px;
      margin-bottom: 4px;
    }

    .bhuz-envio-publicado-item strong {
      color: #fff;
      font-size: 15px;
      word-break: break-word;
    }

    .bhuz-envio-publicado-item.codigo strong,
    .bhuz-envio-publicado-item.id-envio strong {
      display: inline-block;
      padding: 6px 9px;
      border-radius: 12px;
      background: rgba(255,255,255,.10);
      border: 1px solid rgba(255,255,255,.12);
      letter-spacing: .06em;
    }

    .bhuz-envio-publicado-actions.oculto,
    .btn-envio-principal.bhuz-btn-envio-publicado-oculto {
      display: none !important;
    }

    .bhuz-envio-publicado-actions {
      display: grid;
      gap: 9px;
      grid-template-columns: 1fr;
    }

    .bhuz-envio-publicado-actions button {
      border: 0;
      border-radius: 16px;
      padding: 13px 14px;
      font-weight: 900;
      cursor: pointer;
    }

    .bhuz-envio-publicado-primary {
      background: linear-gradient(135deg, #10e981, #0bbf68);
      color: #03140b;
    }

    .bhuz-envio-publicado-secondary {
      background: rgba(255,255,255,.09);
      color: #fff;
      border: 1px solid rgba(255,255,255,.12) !important;
    }

    @media (max-width: 480px) {
      .envio-receptor-card.bhuz-receptor-compacto {
        padding: 15px !important;
        gap: 10px !important;
      }

      .envio-receptor-card.bhuz-receptor-compacto .mini-label {
        font-size: 11px !important;
      }
    }
  `;
  document.head.appendChild(style);
}

document.addEventListener("DOMContentLoaded", async () => {
  const contenedor = document.getElementById("modulo-envios");
  if (!contenedor) return;

  await cargarHtmlModuloEnvios(contenedor);
  inicializarModuloEnvios();
});

/* ==========================================================
   CARGA DEL HTML DEL MÓDULO
========================================================== */

async function cargarHtmlModuloEnvios(contenedor) {
  if (contenedor.dataset.moduloCargado === "true") return;

  try {
    const respuesta = await fetch("componentes/modulo-envios.html", {
      cache: "no-store"
    });

    if (!respuesta.ok) {
      throw new Error("No se pudo cargar componentes/modulo-envios.html");
    }

    const html = await respuesta.text();
    contenedor.innerHTML = html;
    contenedor.dataset.moduloCargado = "true";

    console.log("✅ HTML del módulo de envíos cargado.");
  } catch (error) {
    console.error("BHUZ envíos:", error);

    contenedor.innerHTML = `
      <div class="envios-bloque" style="margin:30px auto;max-width:720px;">
        <h2>No se pudo cargar el módulo de envíos</h2>
        <p>Verifica que exista el archivo <strong>componentes/modulo-envios.html</strong>.</p>
      </div>
    `;
  }
}

/* ==========================================================
   INICIALIZACIÓN GENERAL
========================================================== */

function inicializarModuloEnvios() {
  const formulario = document.getElementById("formulario-envio-paquete");
  const btnUbicacionRetiro = document.getElementById("btn-usar-ubicacion-retiro");
  const btnGenerarLink = document.getElementById("btn-generar-link-receptor");
  const btnCopiarLink = document.getElementById("btn-copiar-link-receptor");
  const btnCompartirWhatsapp = document.getElementById("btn-compartir-whatsapp-receptor");
  const btnConfirmarUbicacionReceptor = document.getElementById("btn-confirmar-ubicacion-receptor");
  const btnEnviarPaquete = document.getElementById("btn-enviar-paquete");
  const inputFoto = document.getElementById("envio-foto");

  if (formulario) {
    formulario.addEventListener("submit", (event) => event.preventDefault());
  }

  if (btnUbicacionRetiro) {
    btnUbicacionRetiro.addEventListener("click", obtenerUbicacionRetiro);
  }

  if (btnGenerarLink) {
    btnGenerarLink.addEventListener("click", generarEnlaceReceptor);
  }

  if (btnCopiarLink) {
    btnCopiarLink.addEventListener("click", copiarEnlaceReceptor);
  }

  if (btnCompartirWhatsapp) {
    btnCompartirWhatsapp.addEventListener("click", compartirEnlaceReceptorPorWhatsapp);
  }

  if (btnConfirmarUbicacionReceptor) {
    btnConfirmarUbicacionReceptor.addEventListener("click", confirmarUbicacionReceptorTemporal);
  }


  detectarFlujoReceptorEnvioTemporal();

  if (btnEnviarPaquete) {
    btnEnviarPaquete.setAttribute("type", "button");
  }

  // Listener robusto por delegación:
  // evita que el botón deje de responder si el HTML del módulo se recarga o cambia dinámicamente.
  if (!document.body.dataset.bhuzEnvioFinalListener) {
    document.body.dataset.bhuzEnvioFinalListener = "true";

    document.body.addEventListener("click", (event) => {
      const estrella = event.target.closest("[data-bhuz-star]");
      if (estrella) {
        manejarEncuestaReceptor(estrella.dataset.bhuzStar);
        return;
      }

      const enviarRating = event.target.closest("[data-bhuz-enviar-rating]");
      if (enviarRating) {
        enviarEncuestaReceptor();
        return;
      }

      const crearOtroEnvio = event.target.closest("[data-bhuz-crear-otro-envio]");
      if (crearOtroEnvio) {
        window.location.reload();
        return;
      }

      const verSeguimientoCliente = event.target.closest("[data-bhuz-ver-seguimiento-cliente]");
      if (verSeguimientoCliente) {
        const objetivo = document.getElementById("bhuz-envio-publicado-box") || document.getElementById("envio-link-receptor") || document.getElementById("envio-resumen-formulario") || document.getElementById("modulo-envios");
        if (objetivo) objetivo.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }

      const cancelarEnvio = event.target.closest("[data-bhuz-cancelar-envio]");
      if (cancelarEnvio) {
        event.preventDefault();
        cancelarEnvioPublicado();
        return;
      }

      const botonEnviar = event.target.closest("#btn-enviar-paquete");
      if (!botonEnviar) return;

      event.preventDefault();
      if (botonEnviar.dataset.publicado === "true" || BHUZ_SERVICES_STATE.envioPublicado) return;
      prepararEnvioParaPagoTemporal();
    });
  }

  if (inputFoto) {
    inputFoto.addEventListener("change", mostrarVistaPreviaFoto);
  }

  console.log("✅ Módulo de envíos inicializado correctamente.");
}

/* ==========================================================
   GPS RETIRO
========================================================== */

function obtenerUbicacionRetiro() {
  const estado = document.getElementById("estado-ubicacion-retiro");
  const inputLat = document.getElementById("envio-retiro-lat");
  const inputLng = document.getElementById("envio-retiro-lng");

  if (!navigator.geolocation) {
    actualizarEstado(estado, "Tu navegador no permite obtener ubicación.", "error");
    return;
  }

  actualizarEstado(estado, "Solicitando permiso de ubicación...", "cargando");

  navigator.geolocation.getCurrentPosition(
    (posicion) => {
      const lat = posicion.coords.latitude;
      const lng = posicion.coords.longitude;

      if (inputLat) inputLat.value = lat;
      if (inputLng) inputLng.value = lng;

      actualizarEstado(
        estado,
        `Ubicación de retiro capturada correctamente. Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`,
        "ok"
      );
    },
    (error) => {
      console.warn("BHUZ ubicación retiro:", error);
      actualizarEstado(
        estado,
        "No se pudo obtener la ubicación. Permite el acceso GPS o coloca una referencia clara.",
        "error"
      );
    },
    {
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 0
    }
  );
}

/* ==========================================================
   LINK DEL RECEPTOR
========================================================== */

async function generarEnlaceReceptor() {
  const estado = document.getElementById("estado-ubicacion-entrega");
  const cajaLink = document.getElementById("envio-link-receptor");
  const inputLink = document.getElementById("envio-link-confirmacion");
  const boton = document.getElementById("btn-generar-link-receptor");

  const datos = obtenerDatosFormularioEnvio();
  const errores = validarDatosEnvio(datos);


  if (errores.length > 0) {
    alert(
      "Antes de generar el enlace del receptor revisa estos puntos:\n\n" +
      errores.map((e) => `• ${e}`).join("\n")
    );
    return;
  }

  try {
    if (boton) {
      boton.disabled = true;
      boton.textContent = "Generando enlace...";
    }

    actualizarEstado(
      estado,
      "Creando solicitud en BHUZ para generar el link del receptor...",
      "cargando"
    );

    const distanciaKm = 0;
    const totalEnvio = 0;

    const service = await crearServicioEnvioBackend({
      datos,
      distanciaKm,
      totalEnvio
    });

    const tokenResponse = await generarTokenReceptorBackend(service.id);

    BHUZ_SERVICES_STATE.serviceId = service.id;
    BHUZ_SERVICES_STATE.shareUrl = tokenResponse.shareUrl || "";
    BHUZ_SERVICES_STATE.token = tokenResponse.token?.token || "";
    BHUZ_SERVICES_STATE.receptorConfirmado = Boolean(service.deliveryLatitude && service.deliveryLongitude);

    if (inputLink) inputLink.value = BHUZ_SERVICES_STATE.shareUrl;
    if (cajaLink) cajaLink.style.display = "grid";

    actualizarEstado(
      estado,
      "Link generado. Envíalo por WhatsApp y espera que el receptor confirme su ubicación.",
      "ok"
    );

    const resumenFormulario = document.getElementById("envio-resumen-formulario");
    const accionFinal = document.getElementById("envio-accion-final");
    const notaCalculo = document.getElementById("envio-nota-calculo");

    if (resumenFormulario) resumenFormulario.style.display = "none";
    if (accionFinal) accionFinal.style.display = "none";
    if (notaCalculo) {
      notaCalculo.textContent =
        "Link generado. Cuando el receptor confirme su ubicación, se calculará la distancia real y el total.";
    }

    bloquearBotonEnviarHastaConfirmacion();
    iniciarPollingServicio(BHUZ_SERVICES_STATE.serviceId);
  } catch (error) {
    console.error("BHUZ generar enlace receptor:", error);
    actualizarEstado(
      estado,
      error.message || "No se pudo generar el enlace del receptor.",
      "error"
    );
  } finally {
    if (boton) {
      boton.disabled = false;
      boton.textContent = "Generar link para el receptor";
    }
  }
}

async function copiarEnlaceReceptor() {
  const inputLink = document.getElementById("envio-link-confirmacion");
  const estado = document.getElementById("estado-ubicacion-entrega");

  if (!inputLink || !inputLink.value) {
    actualizarEstado(estado, "Primero genera el enlace del receptor.", "error");
    return;
  }

  try {
    await navigator.clipboard.writeText(inputLink.value);
    actualizarEstado(estado, "Enlace copiado correctamente.", "ok");
  } catch (error) {
    console.warn("BHUZ copiar enlace:", error);
    inputLink.select();
    document.execCommand("copy");
    actualizarEstado(estado, "Enlace copiado.", "ok");
  }
}

function advertirLinkLocalNoCompartible(link) {
  try {
    const url = new URL(link);
    if (url.hostname === "127.0.0.1" || url.hostname === "localhost") {
      return "El backend devolvió un link local. Revisa FRONTEND_URL en Render.";
    }
  } catch {}
  return "";
}

function compartirEnlaceReceptorPorWhatsapp() {
  const inputLink = document.getElementById("envio-link-confirmacion");
  const estado = document.getElementById("estado-ubicacion-entrega");

  if (!inputLink || !inputLink.value) {
    actualizarEstado(estado, "Primero genera el enlace del receptor.", "error");
    return;
  }

  const advertencia = advertirLinkLocalNoCompartible(inputLink.value);

  if (advertencia) {
    alert(advertencia);
  }

  const mensaje = [
    "Hola 👋",
    "Te envío este enlace de BHUZ para confirmar la ubicación donde recibirás el paquete:",
    "",
    inputLink.value,
    "",
    "Ábrelo, acepta el permiso de ubicación y confirma el punto de entrega."
  ].join("\n");

  const urlWhatsapp = `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
  window.open(urlWhatsapp, "_blank", "noopener,noreferrer");

  actualizarEstado(
    estado,
    "WhatsApp abierto. Envía el enlace al receptor para que confirme su ubicación.",
    "ok"
  );
}

async function detectarFlujoReceptorEnvioTemporal() {
  const parametros = new URLSearchParams(window.location.search);
  const tokenEnvio = parametros.get("confirmar_envio") || parametros.get("confirmar_entrega");

  if (!tokenEnvio) return;

  BHUZ_SERVICES_STATE.receptorToken = tokenEnvio;
  aplicarMejorasVisualesReceptor();

  const formulario = document.getElementById("formulario-envio-paquete");
  const resumen = document.querySelector(".envios-resumen");
  const hero = document.querySelector(".envios-hero");
  const panelReceptor = document.getElementById("envio-receptor-panel");
  const nota = document.getElementById("envio-receptor-nota");

  if (formulario) formulario.style.display = "none";
  if (resumen) resumen.style.display = "none";

  if (hero) {
    hero.querySelector("h1").textContent = "Confirmar entrega";
    hero.querySelector("p").textContent =
      "Confirma tu ubicación para que el repartidor sepa exactamente dónde entregar el paquete.";
  }

  if (panelReceptor) panelReceptor.style.display = "grid";

  compactarVistaReceptor();
  actualizarEstadoReceptorTemporal("esperando_ubicacion", { silencioso: true });

  try {
    const respuesta = await fetchConTimeout(construirUrlApi(`/api/services/confirmar/${encodeURIComponent(tokenEnvio)}`));
    const data = await respuesta.json().catch(() => ({}));

    if (!respuesta.ok || !data.ok) {
      throw new Error(data.message || "No se pudo consultar el enlace del envío.");
    }

    BHUZ_SERVICES_STATE.serviceId = data.service?.id || "";
    BHUZ_SERVICES_STATE.token = tokenEnvio;

    procesarServicioReceptor(data.service, data.token, { silencioso: true });
    iniciarPollingReceptor(BHUZ_SERVICES_STATE.serviceId);
  } catch (error) {
    console.error("BHUZ consultar token receptor:", error);
    actualizarEstadoReceptorTemporal("error");
    if (nota) {
      nota.textContent = error.message || "No se pudo consultar el enlace. Intenta nuevamente.";
    }
  }
}

function confirmarUbicacionReceptorTemporal() {
  const nota = document.getElementById("envio-receptor-nota");
  const boton = document.getElementById("btn-confirmar-ubicacion-receptor");
  const parametros = new URLSearchParams(window.location.search);
  const tokenEnvio = parametros.get("confirmar_envio") || parametros.get("confirmar_entrega");

  if (!tokenEnvio) {
    if (nota) nota.textContent = "No se encontró el token del envío.";
    actualizarEstadoReceptorTemporal("error");
    return;
  }

  if (!navigator.geolocation) {
    if (nota) nota.textContent = "Tu navegador no permite obtener ubicación.";
    actualizarEstadoReceptorTemporal("error");
    return;
  }

  desbloquearSonidosReceptor();

  if (boton?.dataset.confirmando === "true" || boton?.dataset.confirmado === "true") return;

  if (boton) {
    boton.dataset.confirmando = "true";
    boton.disabled = true;
    boton.textContent = "📡 Confirmando ubicación...";
  }

  if (nota) nota.textContent = "Solicitando permiso de ubicación...";
  actualizarEstadoReceptorTemporal("solicitando_ubicacion");

  navigator.geolocation.getCurrentPosition(
    async (posicion) => {
      const lat = posicion.coords.latitude;
      const lng = posicion.coords.longitude;

      try {
        const respuesta = await fetchConTimeout(construirUrlApi(`/api/services/confirmar/${encodeURIComponent(tokenEnvio)}`), {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            latitude: lat,
            longitude: lng
          })
        });

        const data = await respuesta.json().catch(() => ({}));

        if (!respuesta.ok || !data.ok) {
          throw new Error(data.message || "No se pudo confirmar la ubicación.");
        }

        bloquearBotonConfirmarUbicacionReceptor(true);

        if (nota) {
          nota.textContent = "Ubicación confirmada. Entrega el código únicamente al repartidor cuando recibas el paquete.";
        }

        procesarServicioReceptor(data.service, data.token);
        iniciarPollingReceptor(data.service?.id || BHUZ_SERVICES_STATE.serviceId);

        const estadoEntrega = document.getElementById("estado-ubicacion-entrega");
        actualizarEstado(
          estadoEntrega,
          `Ubicación del receptor confirmada. Lat: ${Number(lat).toFixed(6)}, Lng: ${Number(lng).toFixed(6)}`,
          "ok"
        );
      } catch (error) {
        console.error("BHUZ confirmar ubicación receptor:", error);
        if (nota) {
          nota.textContent = error.message || "No se pudo confirmar la ubicación. Intenta nuevamente.";
        }
        actualizarEstadoReceptorTemporal("error");
        bloquearBotonConfirmarUbicacionReceptor(false);
      }
    },
    (error) => {
      console.warn("BHUZ ubicación receptor:", error);
      if (nota) {
        nota.textContent =
          "No se pudo obtener la ubicación. Permite el acceso GPS desde el navegador e intenta nuevamente.";
      }
      actualizarEstadoReceptorTemporal("error");
      bloquearBotonConfirmarUbicacionReceptor(false);
    },
    {
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 0
    }
  );
}

function compactarVistaReceptor() {
  const card = document.querySelector(".envio-receptor-card");
  const hero = document.querySelector(".envios-hero");
  const volver = document.getElementById("btn-volver-inicio-desde-envios");

  if (card) card.classList.add("bhuz-receptor-compacto");
  if (volver) volver.style.display = "none";

  if (hero) {
    hero.style.padding = "18px";
    hero.style.borderRadius = "24px";
  }
}

function bloquearBotonConfirmarUbicacionReceptor(confirmado) {
  const boton = document.getElementById("btn-confirmar-ubicacion-receptor");
  if (!boton) return;

  boton.dataset.confirmando = "false";
  boton.dataset.confirmado = confirmado ? "true" : "false";
  boton.disabled = Boolean(confirmado);
  boton.classList.toggle("bhuz-btn-confirmado", Boolean(confirmado));
  boton.textContent = confirmado ? "✅ Ubicación confirmada" : "📡 Confirmar mi ubicación";
}

function iniciarPollingReceptor(serviceId) {
  detenerPollingReceptor();
  if (!serviceId) return;

  BHUZ_SERVICES_STATE.receptorPollingId = setInterval(async () => {
    try {
      const service = await consultarServicioBackend(serviceId);
      procesarServicioReceptor(service, null, { desdePolling: true });
    } catch (error) {
      console.warn("BHUZ polling receptor:", error.message);
    }
  }, 5000);
}

function detenerPollingReceptor() {
  if (BHUZ_SERVICES_STATE.receptorPollingId) {
    clearInterval(BHUZ_SERVICES_STATE.receptorPollingId);
    BHUZ_SERVICES_STATE.receptorPollingId = null;
  }
}

function procesarServicioReceptor(service, tokenData = null, opciones = {}) {
  if (!service) return;

  const nota = document.getElementById("envio-receptor-nota");
  const confirmadoPorToken = Boolean(tokenData?.receiverConfirmed);
  const tieneUbicacion = Boolean(
    Number(service.deliveryLatitude || service.delivery_latitude || 0) &&
    Number(service.deliveryLongitude || service.delivery_longitude || 0)
  );
  const ubicacionConfirmada = confirmadoPorToken || tieneUbicacion;

  if (ubicacionConfirmada) {
    bloquearBotonConfirmarUbicacionReceptor(true);
    mostrarCodigoEntregaDesdeServicio(service);
  }

  const estadoVisual = mapearEstadoReceptorDesdeServicio(service, ubicacionConfirmada);
  actualizarEstadoReceptorTemporal(estadoVisual, opciones);

  if (nota) {
    if (estadoVisual === "cancelado") {
      nota.textContent = "Este envío fue cancelado por la persona que lo creó.";
    } else if (estadoVisual === "recibido") {
      nota.textContent = "Entrega finalizada correctamente. Gracias por utilizar BHUZ.";
    } else if (estadoVisual === "repartidor_retiro") {
      nota.textContent = "Un repartidor aceptó el envío y va camino a buscar el paquete.";
    } else if (estadoVisual === "paquete_retirado") {
      nota.textContent = "El repartidor ya retiró el paquete y se dirige a tu ubicación.";
    } else if (estadoVisual === "en_camino") {
      nota.textContent = "Tu paquete va en camino. Ten a mano el código de entrega.";
    } else if (ubicacionConfirmada) {
      nota.textContent = "Ubicación confirmada. Entrega el código únicamente al repartidor cuando recibas el paquete.";
    }
  }

  if (estadoVisual === "cancelado") {
    bloquearBotonConfirmarUbicacionReceptor(true);
    detenerPollingReceptor();
  }

  if (estadoVisual === "recibido") {
    mostrarCierreReceptorConEncuesta();
    detenerPollingReceptor();
  }
}

function mapearEstadoReceptorDesdeServicio(service, ubicacionConfirmada) {
  const status = limpiarTexto(service?.status || service?.estado || "").toUpperCase();

  if (status === "CANCELLED") return "cancelado";
  if (status === "DELIVERED") return "recibido";

  if (["DRIVER_ASSIGNED", "GOING_TO_PICKUP"].includes(status)) {
    return ubicacionConfirmada ? "repartidor_retiro" : "esperando_ubicacion";
  }

  if (status === "PACKAGE_PICKED") {
    return ubicacionConfirmada ? "paquete_retirado" : "esperando_ubicacion";
  }

  if (status === "GOING_TO_DELIVERY") {
    return ubicacionConfirmada ? "en_camino" : "esperando_ubicacion";
  }

  if (["SEARCHING_DRIVER", "PAID"].includes(status)) {
    return ubicacionConfirmada ? "ubicacion_confirmada" : "esperando_ubicacion";
  }

  return ubicacionConfirmada ? "ubicacion_confirmada" : "esperando_ubicacion";
}

function mostrarCierreReceptorConEncuesta() {
  const card = document.querySelector(".envio-receptor-card");
  if (!card || document.getElementById("bhuz-receptor-final")) return;

  const finalBox = document.createElement("div");
  finalBox.id = "bhuz-receptor-final";
  finalBox.className = "bhuz-receptor-final";
  finalBox.innerHTML = `
    <h3>✅ Entrega realizada</h3>
    <p>Tu paquete fue entregado correctamente.</p>
    <p><strong>¿Cómo fue tu experiencia?</strong></p>
    <div class="bhuz-receptor-stars" aria-label="Calificar experiencia">
      ${[1, 2, 3, 4, 5].map((n) => `<button class="bhuz-receptor-star" data-bhuz-star="${n}" type="button" aria-label="${n} estrella${n === 1 ? "" : "s"}">★</button>`).join("")}
    </div>
    <div class="bhuz-receptor-rating-actions">
      <button id="bhuz-receptor-rating-btn" class="bhuz-receptor-rating-btn" data-bhuz-enviar-rating="true" type="button" style="display:none;">Enviar opinión</button>
      <p id="bhuz-receptor-rating-msg">Tu opinión nos ayuda a mejorar.</p>
    </div>
  `;

  card.appendChild(finalBox);
}

function manejarEncuestaReceptor(valor) {
  const rating = Number(valor || 0);
  const botones = document.querySelectorAll("[data-bhuz-star]");
  const mensaje = document.getElementById("bhuz-receptor-rating-msg");
  const botonEnviar = document.getElementById("bhuz-receptor-rating-btn");

  BHUZ_SERVICES_STATE.receptorRating = rating;

  botones.forEach((boton) => {
    const value = Number(boton.dataset.bhuzStar || 0);
    boton.classList.toggle("is-selected", value <= rating);
  });

  if (botonEnviar) {
    botonEnviar.style.display = rating > 0 ? "block" : "none";
    botonEnviar.disabled = false;
    botonEnviar.textContent = "Enviar opinión";
  }

  if (mensaje) {
    mensaje.textContent = "Listo. Presiona Enviar opinión para cerrar tu calificación.";
  }
}

function enviarEncuestaReceptor() {
  const rating = Number(BHUZ_SERVICES_STATE.receptorRating || 0);
  const botones = document.querySelectorAll("[data-bhuz-star]");
  const mensaje = document.getElementById("bhuz-receptor-rating-msg");
  const botonEnviar = document.getElementById("bhuz-receptor-rating-btn");

  if (!rating) {
    if (mensaje) mensaje.textContent = "Selecciona una calificación antes de enviar.";
    return;
  }

  botones.forEach((boton) => {
    boton.disabled = true;
    boton.style.cursor = "default";
  });

  if (botonEnviar) {
    botonEnviar.disabled = true;
    botonEnviar.textContent = "Opinión enviada";
  }

  if (mensaje) {
    mensaje.textContent = rating >= 4
      ? "Gracias por confiar en BHUZ 💚"
      : "Gracias. Tomaremos en cuenta tu experiencia.";
  }

  /*
    Preparado para siguiente fase:
    aquí podremos enviar la calificación al backend/PostgreSQL
    sin cambiar la experiencia visual del receptor.
  */
}

function obtenerSrcSonidoReceptor(estado) {
  const sonidos = {
    ubicacion_confirmada: "assets/sounds/bhuz-pedido-aceptado.mp3",
    repartidor_retiro: "assets/sounds/bhuz-pedido-en-camino.mp3",
    paquete_retirado: "assets/sounds/bhuz-pedido-en-camino.mp3",
    en_camino: "assets/sounds/bhuz-pedido-en-camino.mp3",
    recibido: "assets/sounds/bhuz-pedido-aceptado.mp3",
    cancelado: "assets/sounds/bhuz-pedido-restaurant.mp3",
    error: "assets/sounds/bhuz-pedido-restaurant.mp3"
  };

  return sonidos[estado] || "";
}

function obtenerAudioReceptor(estado) {
  const src = obtenerSrcSonidoReceptor(estado);
  if (!src) return null;

  if (!BHUZ_SERVICES_STATE.receptorAudioCache) {
    BHUZ_SERVICES_STATE.receptorAudioCache = {};
  }

  if (!BHUZ_SERVICES_STATE.receptorAudioCache[src]) {
    const audio = new Audio(src);
    audio.preload = "auto";
    audio.volume = 0.65;
    BHUZ_SERVICES_STATE.receptorAudioCache[src] = audio;
  }

  return BHUZ_SERVICES_STATE.receptorAudioCache[src];
}

function desbloquearSonidosReceptor() {
  if (BHUZ_SERVICES_STATE.receptorAudioDesbloqueado) return;

  try {
    ["ubicacion_confirmada", "repartidor_retiro", "paquete_retirado", "en_camino", "recibido", "cancelado"].forEach((estado) => {
      const audio = obtenerAudioReceptor(estado);
      if (!audio) return;
      audio.muted = true;
      audio.play()
        .then(() => {
          audio.pause();
          audio.currentTime = 0;
          audio.muted = false;
        })
        .catch(() => {
          audio.muted = false;
        });
    });

    BHUZ_SERVICES_STATE.receptorAudioDesbloqueado = true;
  } catch {
    BHUZ_SERVICES_STATE.receptorAudioDesbloqueado = true;
  }
}

function reproducirSonidoReceptor(estado) {
  if (!BHUZ_SERVICES_STATE.receptorSonidoHabilitado) return;

  const audio = obtenerAudioReceptor(estado);
  if (!audio) return;

  try {
    audio.pause();
    audio.currentTime = 0;
    audio.muted = false;
    audio.volume = 0.65;
    audio.play().catch(() => {
      /* Algunos navegadores bloquean audio automático. Se desbloquea con el botón de confirmar ubicación. */
    });
  } catch {}
}


function mostrarCodigoEntregaDesdeServicio(service) {
  const cajaCodigo = document.getElementById("envio-codigo-entrega");
  const textoCodigo = document.getElementById("envio-codigo-entrega-texto");

  const codigo = limpiarTexto(service?.deliveryCode || service?.delivery_code || "");

  if (!codigo) return "";

  if (textoCodigo) textoCodigo.textContent = codigo;
  if (cajaCodigo) cajaCodigo.style.display = "grid";

  return codigo;
}

function generarCodigoCortoEntrega() {
  const numero = Math.floor(100000 + Math.random() * 900000);
  return String(numero);
}

function actualizarEstadoReceptorTemporal(estado, opciones = {}) {
  const texto = document.getElementById("envio-receptor-status-text");
  const dot = document.getElementById("envio-receptor-status-dot");
  const cajaEstado = document.getElementById("envio-estado-receptor");
  const cajaTexto = document.getElementById("envio-estado-receptor-texto");

  const estados = {
    esperando_ubicacion: "Esperando ubicación",
    solicitando_ubicacion: "Solicitando ubicación",
    ubicacion_confirmada: "Ubicación confirmada",
    repartidor_retiro: "Repartidor va al retiro",
    paquete_retirado: "Paquete retirado",
    en_camino: "En camino a tu ubicación",
    recibido: "Recibido",
    cancelado: "Envío cancelado",
    error: "Error de ubicación"
  };

  const mensaje = estados[estado] || estados.esperando_ubicacion;
  const estadoAnterior = BHUZ_SERVICES_STATE.receptorUltimoEstadoVisual;
  const cambioEstado = estadoAnterior && estadoAnterior !== estado;

  BHUZ_SERVICES_STATE.receptorUltimoEstadoVisual = estado;

  if (cambioEstado && !opciones.silencioso) {
    reproducirSonidoReceptor(estado);
  }

  if (texto) texto.textContent = mensaje;
  if (dot) dot.dataset.estado = estado;

  if (cajaEstado) {
    cajaEstado.style.display = "grid";
    cajaEstado.dataset.estado = estado;
  }

  if (cajaTexto) {
    cajaTexto.textContent = mensaje;
  }

  actualizarLineasSeguimientoReceptor(estado);
}

function actualizarLineasSeguimientoReceptor(estado) {
  const esperando = document.getElementById("estado-linea-esperando");
  const enCamino = document.getElementById("estado-linea-en-camino");
  const recibido = document.getElementById("estado-linea-recibido");

  const lineas = [esperando, enCamino, recibido].filter(Boolean);

  lineas.forEach((item) => {
    item.classList.remove("is-activa", "is-completada");
  });

  configurarLineaReceptor(esperando, "1", "Ubicación confirmada");
  configurarLineaReceptor(enCamino, "2", "Repartidor va a buscar el paquete");
  configurarLineaReceptor(recibido, "3", "Entregado");

  if (estado === "cancelado") {
    configurarLineaReceptor(esperando, "✕", "Envío cancelado");
    configurarLineaReceptor(enCamino, "2", "Sin retiro");
    configurarLineaReceptor(recibido, "3", "No entregado");
    if (esperando) esperando.classList.add("is-activa");
    return;
  }

  if (["esperando_ubicacion", "solicitando_ubicacion", "error"].includes(estado)) {
    configurarLineaReceptor(esperando, "1", "Esperando ubicación");
    configurarLineaReceptor(enCamino, "2", "Repartidor va a buscar el paquete");
    configurarLineaReceptor(recibido, "3", "Entregado");
    if (esperando) esperando.classList.add("is-activa");
    return;
  }

  if (estado === "ubicacion_confirmada") {
    configurarLineaReceptor(esperando, "✓", "Ubicación confirmada");
    configurarLineaReceptor(enCamino, "2", "Esperando repartidor");
    configurarLineaReceptor(recibido, "3", "Entregado");
    if (esperando) esperando.classList.add("is-completada");
    if (enCamino) enCamino.classList.add("is-activa");
    return;
  }

  if (estado === "repartidor_retiro") {
    configurarLineaReceptor(esperando, "✓", "Ubicación confirmada");
    configurarLineaReceptor(enCamino, "2", "Repartidor va a buscar el paquete");
    configurarLineaReceptor(recibido, "3", "Entregado");
    if (esperando) esperando.classList.add("is-completada");
    if (enCamino) enCamino.classList.add("is-activa");
    return;
  }

  if (estado === "paquete_retirado") {
    configurarLineaReceptor(esperando, "✓", "Ubicación confirmada");
    configurarLineaReceptor(enCamino, "✓", "Paquete retirado, va en camino");
    configurarLineaReceptor(recibido, "3", "Entregado");
    if (esperando) esperando.classList.add("is-completada");
    if (enCamino) enCamino.classList.add("is-activa");
    return;
  }

  if (estado === "en_camino") {
    configurarLineaReceptor(esperando, "✓", "Ubicación confirmada");
    configurarLineaReceptor(enCamino, "✓", "Repartidor en camino a tu ubicación");
    configurarLineaReceptor(recibido, "3", "Entregado");
    if (esperando) esperando.classList.add("is-completada");
    if (enCamino) enCamino.classList.add("is-activa");
    return;
  }

  if (estado === "recibido") {
    configurarLineaReceptor(esperando, "✓", "Ubicación confirmada");
    configurarLineaReceptor(enCamino, "✓", "Paquete recibido por el repartidor");
    configurarLineaReceptor(recibido, "✓", "Entregado");
    if (esperando) esperando.classList.add("is-completada");
    if (enCamino) enCamino.classList.add("is-completada");
    if (recibido) recibido.classList.add("is-activa");
  }
}

function configurarLineaReceptor(elemento, numero, texto) {
  if (!elemento) return;
  const span = elemento.querySelector("span");
  const strong = elemento.querySelector("strong");
  if (span) span.textContent = numero;
  if (strong) strong.textContent = texto;
}


/* ==========================================================
   BACKEND SERVICES / SINCRONIZACIÓN
========================================================== */

async function crearServicioEnvioBackend({ datos, distanciaKm, totalEnvio }) {
  const payload = {
    serviceType: "PACKAGE",

    customerEmail: obtenerEmailClienteActual(),
    customerName: obtenerNombreClienteActual(),
    customerPhone: "",

    receiverName: datos.contacto,
    receiverPhone: datos.contacto,

    pickupAddress: datos.origen,
    pickupReference: datos.referenciaRetiro,
    pickupLatitude: datos.retiroLat || "",
    pickupLongitude: datos.retiroLng || "",

    deliveryAddress: datos.destino,
    deliveryReference: datos.referenciaEntrega,
    deliveryLatitude: "",
    deliveryLongitude: "",

    packageDescription: datos.descripcion,
    packageSize: datos.tamano,
    packagePhotoUrl: "",

    distanceKm: distanciaKm,
    totalAmount: totalEnvio,
    paymentStatus: "PENDING",
    paymentMethod: "",
    status: "PENDING_PAYMENT"
  };

  const respuesta = await fetchConTimeout(construirUrlApi("/api/services"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    credentials: "include",
    body: JSON.stringify(payload)
  });

  const data = await respuesta.json().catch(() => ({}));

  if (!respuesta.ok || !data.ok) {
    throw new Error(data.message || "No se pudo crear el envío en BHUZ.");
  }

  return data.service;
}

async function generarTokenReceptorBackend(serviceId) {
  const respuesta = await fetchConTimeout(construirUrlApi(`/api/services/${encodeURIComponent(serviceId)}/receiver-token`), {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    credentials: "include",
    body: JSON.stringify({})
  });

  const data = await respuesta.json().catch(() => ({}));

  if (!respuesta.ok || !data.ok) {
    throw new Error(data.message || "No se pudo generar el link del receptor.");
  }

  return data;
}

async function consultarServicioBackend(serviceId) {
  const respuesta = await fetchConTimeout(construirUrlApi(`/api/services/${encodeURIComponent(serviceId)}`), {
    credentials: "include",
    cache: "no-store"
  });

  const data = await respuesta.json().catch(() => ({}));

  if (!respuesta.ok || !data.ok) {
    throw new Error(data.message || "No se pudo consultar el envío.");
  }

  return data.service;
}

function iniciarPollingServicio(serviceId) {
  detenerPollingServicio();

  if (!serviceId) return;

  BHUZ_SERVICES_STATE.pollingId = setInterval(async () => {
    try {
      const service = await consultarServicioBackend(serviceId);
      procesarServicioActualizado(service);
    } catch (error) {
      console.warn("BHUZ polling servicio:", error.message);
    }
  }, 5000);
}

function detenerPollingServicio() {
  if (BHUZ_SERVICES_STATE.pollingId) {
    clearInterval(BHUZ_SERVICES_STATE.pollingId);
    BHUZ_SERVICES_STATE.pollingId = null;
  }
}

function procesarServicioActualizado(service) {
  if (!service) return;

  BHUZ_SERVICES_STATE.ultimoServicio = service;

  const estadoServicioActual = limpiarTexto(service.status || service.estado || "").toUpperCase();
  if (estadoServicioActual === "CANCELLED") {
    BHUZ_SERVICES_STATE.envioCancelado = true;
    BHUZ_SERVICES_STATE.envioPublicado = true;
    actualizarComprobanteEnvioPublicado(service);
    bloquearBotonEnviarHastaConfirmacion();
    return;
  }

  const estadoEntrega = document.getElementById("estado-ubicacion-entrega");
  const inputLat = document.getElementById("envio-entrega-lat");
  const inputLng = document.getElementById("envio-entrega-lng");

  const lat = service.deliveryLatitude || service.delivery_latitude || "";
  const lng = service.deliveryLongitude || service.delivery_longitude || "";
  const receptorConfirmado = Boolean(Number(lat) && Number(lng));

  if (receptorConfirmado) {
    BHUZ_SERVICES_STATE.receptorConfirmado = true;

    if (inputLat) inputLat.value = lat;
    if (inputLng) inputLng.value = lng;

    const datosActuales = obtenerDatosFormularioEnvio();
    const distanciaBackend = normalizarNumeroServicio(service.distanceKm ?? service.distance_km);
    const totalBackend = normalizarNumeroServicio(service.totalAmount ?? service.total_amount);

    const distanciaFinal = distanciaBackend > 0
      ? distanciaBackend
      : calcularDistanciaTemporal(datosActuales);

    const totalFinal = totalBackend > 0
      ? totalBackend
      : calcularMontoCliente(distanciaFinal);

    BHUZ_SERVICES_STATE.distanceKm = distanciaFinal;
    BHUZ_SERVICES_STATE.totalAmount = totalFinal;
    BHUZ_SERVICES_STATE.calculoListo = distanciaFinal > 0 && totalFinal > 0;

    actualizarEstado(
      estadoEntrega,
      `Receptor confirmó ubicación. Distancia calculada: ${distanciaFinal} km. Total: $${totalFinal}.`,
      "ok"
    );

    actualizarResumenCalculo({
      distanciaKm: distanciaFinal,
      clientePaga: totalFinal
    });

    const resumenFormulario = document.getElementById("envio-resumen-formulario");
    const accionFinal = document.getElementById("envio-accion-final");
    const notaCalculo = document.getElementById("envio-nota-calculo");
    const notaFinal = document.getElementById("envio-nota-final");

    const linkAccion = document.getElementById("envio-link-accion");

    if (resumenFormulario) resumenFormulario.style.display = "grid";
    if (linkAccion) linkAccion.style.display = "grid";
    if (accionFinal) accionFinal.style.display = "grid";

    if (notaCalculo) {
      notaCalculo.textContent = "Ubicación del receptor confirmada. Distancia real calculada desde PostgreSQL. Revisa el total y continúa con Enviar paquete.";
    }

    if (notaFinal) {
      notaFinal.textContent = "Listo para continuar con el cobro. La pasarela de pago se conectará aquí.";
    }

    if (BHUZ_SERVICES_STATE.envioPublicado) {
      actualizarComprobanteEnvioPublicado(service);
    }

    bloquearBotonEnviarHastaConfirmacion();

    if (!BHUZ_SERVICES_STATE.envioPublicado) {
      detenerPollingServicio();
    }
  } else {
    if (BHUZ_SERVICES_STATE.envioPublicado) {
      actualizarComprobanteEnvioPublicado(service);
    }
    bloquearBotonEnviarHastaConfirmacion();
  }
}

function bloquearBotonEnviarHastaConfirmacion() {
  const accionFinal = document.getElementById("envio-accion-final");
  const botonEnviar = document.getElementById("btn-enviar-paquete");
  const notaFinal = document.getElementById("envio-nota-final");

  if (BHUZ_SERVICES_STATE.envioPublicado || BHUZ_SERVICES_STATE.envioCancelado) {
    if (accionFinal) accionFinal.style.display = "grid";
    if (botonEnviar) {
      botonEnviar.disabled = true;
      botonEnviar.dataset.publicado = "true";
      botonEnviar.style.display = "none";
    }
    return;
  }

  if (!BHUZ_SERVICES_STATE.receptorConfirmado) {
    if (accionFinal) accionFinal.style.display = "none";
    if (botonEnviar) botonEnviar.disabled = true;
    if (notaFinal) {
      notaFinal.textContent = "Enviar paquete se activará cuando el receptor confirme su ubicación.";
    }
    return;
  }

  if (accionFinal) accionFinal.style.display = "grid";
  if (botonEnviar) {
    botonEnviar.disabled = false;
    botonEnviar.style.display = "inline-flex";
  }
}

function guardarEnvioTemporalEnStorage() {
  /*
    No se guarda el envío real en localStorage.
    La fuente real es PostgreSQL.
  */
}

function restaurarEnvioTemporalDesdeStorage() {
  /*
    No se restaura el envío desde localStorage.
    Más adelante el módulo de usuario consultará sus envíos desde PostgreSQL.
  */
}

function obtenerEmailClienteActual() {
  try {
    const user = JSON.parse(localStorage.getItem("bhuz_user") || localStorage.getItem("deli_user") || "{}");
    return limpiarTexto(user.email || "");
  } catch {
    return "";
  }
}

function obtenerNombreClienteActual() {
  try {
    const user = JSON.parse(localStorage.getItem("bhuz_user") || localStorage.getItem("deli_user") || "{}");
    return limpiarTexto(user.fullName || user.name || "");
  } catch {
    return "";
  }
}

/* ==========================================================
   FOTO DEL PAQUETE
========================================================== */

function mostrarVistaPreviaFoto(event) {
  const archivo = event.target.files && event.target.files[0];
  const preview = document.getElementById("envio-foto-preview");
  const imagen = document.getElementById("envio-foto-img");

  if (!archivo || !preview || !imagen) return;

  if (!archivo.type.startsWith("image/")) {
    alert("Por favor selecciona una imagen válida.");
    event.target.value = "";
    preview.style.display = "none";
    imagen.removeAttribute("src");
    return;
  }

  const lector = new FileReader();

  lector.onload = () => {
    imagen.src = lector.result;
    preview.style.display = "block";
  };

  lector.readAsDataURL(archivo);
}

/* ==========================================================
   VALIDACIÓN Y CÁLCULO TEMPORAL
========================================================== */

function calcularEnvioTemporal() {
  alert("El cálculo se realizará automáticamente cuando el receptor confirme su ubicación.");
}

function obtenerDatosFormularioEnvio() {
  return {
    origen: limpiarTexto(document.getElementById("envio-origen")?.value),
    referenciaRetiro: limpiarTexto(document.getElementById("envio-referencia-retiro")?.value),
    retiroLat: Number(document.getElementById("envio-retiro-lat")?.value || 0),
    retiroLng: Number(document.getElementById("envio-retiro-lng")?.value || 0),

    destino: limpiarTexto(document.getElementById("envio-destino")?.value),
    referenciaEntrega: limpiarTexto(document.getElementById("envio-referencia-entrega")?.value),
    contacto: limpiarTexto(document.getElementById("envio-contacto")?.value),
    entregaLat: Number(document.getElementById("envio-entrega-lat")?.value || 0),
    entregaLng: Number(document.getElementById("envio-entrega-lng")?.value || 0),

    descripcion: limpiarTexto(document.getElementById("envio-descripcion")?.value),
    tamano: limpiarTexto(document.getElementById("envio-tamano")?.value),
    aceptaTerminos: Boolean(document.getElementById("envio-acepta-terminos")?.checked)
  };
}

function validarDatosEnvio(datos) {
  const errores = [];

  if (!datos.origen) errores.push("Coloca la dirección o referencia de retiro.");
  if (!datos.referenciaRetiro) errores.push("Coloca una referencia adicional de retiro.");
  if (!datos.destino) errores.push("Coloca la dirección o referencia de entrega.");
  if (!datos.referenciaEntrega) errores.push("Coloca una referencia adicional de entrega.");
  if (!datos.contacto) errores.push("Coloca el nombre y teléfono de quien recibe.");
  if (!datos.descripcion) errores.push("Describe qué vas a enviar.");
  if (!datos.tamano) errores.push("Selecciona el tamaño aproximado del paquete.");
  if (!datos.retiroLat || !datos.retiroLng) errores.push('Captura la ubicación de retiro con el botón "Usar mi ubicación actual".');
  if (!datos.aceptaTerminos) errores.push("Debes aceptar los términos y condiciones del envío.");

  return errores;
}

function calcularDistanciaTemporal(datos) {
  const tieneCoordenadasRetiro = datos.retiroLat && datos.retiroLng;
  const tieneCoordenadasEntrega = datos.entregaLat && datos.entregaLng;

  if (tieneCoordenadasRetiro && tieneCoordenadasEntrega) {
    return redondear(calcularDistanciaKm(
      datos.retiroLat,
      datos.retiroLng,
      datos.entregaLat,
      datos.entregaLng
    ));
  }

  /*
    Fallback temporal:
    Mientras no tengamos la confirmación real del receptor,
    calculamos una distancia referencial para probar la vista.
  */
  return 3.5;
}

function calcularMontoCliente(distanciaKm) {
  /*
    Fórmula temporal Venezuela:
    - Base: 2.00 USD
    - Km: 0.65 USD por km
    - Mínimo: 2.50 USD

    Luego podemos ajustar por zona, lluvia, horario, disponibilidad, etc.
  */
  const base = 2.0;
  const porKm = 0.65;
  const minimo = 2.5;

  return redondear(Math.max(minimo, base + distanciaKm * porKm));
}

function actualizarResumenCalculo({ distanciaKm, clientePaga }) {
  const distancia = document.getElementById("envio-resumen-distancia");
  const cliente = document.getElementById("envio-resumen-cliente");

  const distanciaFinal = redondear(distanciaKm);
  const clienteFinal = redondear(clientePaga);

  if (distancia) distancia.textContent = `Distancia: ${distanciaFinal} km aprox.`;
  if (cliente) cliente.textContent = `Total del envío: $${clienteFinal}`;
}

/* ==========================================================
   PREPARAR ENVÍO PARA PAGO / CREACIÓN REAL
========================================================== */

async function prepararEnvioParaPagoTemporal() {
  const botonEnviar = document.getElementById("btn-enviar-paquete");
  const notaFinal = document.getElementById("envio-nota-final");

  if (botonEnviar?.dataset.enviando === "true") return;

  const datos = obtenerDatosFormularioEnvio();
  const errores = validarDatosEnvio(datos);

  if (errores.length > 0) {
    alert("Antes de enviar el paquete revisa estos puntos:\n\n" + errores.map((e) => `• ${e}`).join("\n"));
    return;
  }

  if (!BHUZ_SERVICES_STATE.serviceId) {
    alert("Primero genera el enlace del receptor y espera que confirme su ubicación.");
    return;
  }

  if (!BHUZ_SERVICES_STATE.receptorConfirmado) {
    alert("Todavía falta que el receptor confirme su ubicación. Cuando confirme, se activará el envío.");
    return;
  }

  const distanciaKm = BHUZ_SERVICES_STATE.distanceKm || normalizarNumeroServicio(BHUZ_SERVICES_STATE.ultimoServicio?.distanceKm) || calcularDistanciaTemporal(datos);
  const totalEnvio = BHUZ_SERVICES_STATE.totalAmount || normalizarNumeroServicio(BHUZ_SERVICES_STATE.ultimoServicio?.totalAmount) || calcularMontoCliente(distanciaKm);

  /*
    PREPARADO PARA PASARELA DE PAGO:
    Este servicio ya existe en PostgreSQL.
    Aquí conectaremos el cobro real antes de pasar a buscar repartidor.

    Flujo futuro:
    1. Crear intento de pago en backend.
    2. Redirigir o abrir pasarela de pago.
    3. Confirmar pago.
    4. Cambiar estado a PAID / SEARCHING_DRIVER.
    5. Mostrarlo en panel repartidor.
  */

  try {
    if (botonEnviar) {
      botonEnviar.dataset.enviando = "true";
      botonEnviar.disabled = true;
      botonEnviar.textContent = "Publicando envío...";
    }

    if (notaFinal) {
      notaFinal.textContent = "Publicando el envío para que lo vea el repartidor...";
    }

    const respuesta = await fetchConTimeout(construirUrlApi(`/api/services/${encodeURIComponent(BHUZ_SERVICES_STATE.serviceId)}/status`), {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        status: "SEARCHING_DRIVER",
        changedBy: "customer",
        notes: "Cliente presionó Enviar paquete. Servicio listo para búsqueda/asignación de repartidor."
      })
    });

    const data = await respuesta.json().catch(() => ({}));

    if (!respuesta.ok || !data.ok) {
      const detalle = data.error ? ` (${data.error})` : "";
      throw new Error(`${data.message || "No se pudo preparar el envío."}${detalle}`);
    }

    BHUZ_SERVICES_STATE.envioPublicado = true;
    BHUZ_SERVICES_STATE.ultimoServicio = data.service || BHUZ_SERVICES_STATE.ultimoServicio;

    if (notaFinal) {
      notaFinal.textContent = "Envío publicado correctamente. Ahora está disponible para repartidores.";
    }

    mostrarComprobanteEnvioPublicado({
      service: data.service || BHUZ_SERVICES_STATE.ultimoServicio,
      distanciaKm,
      totalEnvio
    });

    iniciarPollingServicio(BHUZ_SERVICES_STATE.serviceId);
  } catch (error) {
    console.error("BHUZ enviar paquete:", error);
    if (notaFinal) {
      notaFinal.textContent = error.message || "No se pudo publicar el envío.";
    }
    alert(error.message || "No se pudo preparar el envío.");
  } finally {
    if (botonEnviar) {
      botonEnviar.dataset.enviando = "false";

      if (BHUZ_SERVICES_STATE.envioPublicado) {
        botonEnviar.disabled = true;
        botonEnviar.textContent = "✅ Envío publicado";
        botonEnviar.classList.add("bhuz-btn-envio-publicado-oculto");
        botonEnviar.style.display = "none";
      } else {
        botonEnviar.disabled = false;
        botonEnviar.textContent = "Enviar paquete";
      }
    }
  }
}

function mostrarComprobanteEnvioPublicado({ service, distanciaKm, totalEnvio }) {
  aplicarMejorasVisualesReceptor();

  const accionFinal = document.getElementById("envio-accion-final");
  const botonEnviar = document.getElementById("btn-enviar-paquete");
  const notaFinal = document.getElementById("envio-nota-final");
  const resumenFormulario = document.getElementById("envio-resumen-formulario");

  if (botonEnviar) {
    botonEnviar.disabled = true;
    botonEnviar.textContent = "✅ Envío publicado";
    botonEnviar.dataset.publicado = "true";
    botonEnviar.classList.add("bhuz-btn-envio-publicado-oculto");
    botonEnviar.style.display = "none";
  }

  if (notaFinal) {
    notaFinal.textContent = "Tu envío ya fue publicado. Te avisaremos cuando un repartidor lo tome.";
  }

  if (resumenFormulario) {
    resumenFormulario.style.display = "grid";
  }

  const existente = document.getElementById("bhuz-envio-publicado-box");
  if (existente) existente.remove();

  const serviceId = limpiarTexto(service?.id || BHUZ_SERVICES_STATE.serviceId || "");
  const codigoEntrega = limpiarTexto(service?.deliveryCode || service?.delivery_code || "");
  const estadoTexto = obtenerEstadoClienteServicioTexto(service);
  const driverTexto = limpiarTexto(service?.driverName || service?.driver_name || "") || "Pendiente por asignar";
  const distanciaTexto = Number(distanciaKm || 0) < 0.1 && Number(distanciaKm || 0) > 0
    ? "Menos de 100 m"
    : `${redondear(distanciaKm)} km`;
  const totalTexto = `$${redondear(totalEnvio)}`;

  BHUZ_SERVICES_STATE.comprobanteUltimoEstado = limpiarTexto(service?.status || "SEARCHING_DRIVER").toUpperCase();

  const box = document.createElement("div");
  box.id = "bhuz-envio-publicado-box";
  box.className = "bhuz-envio-publicado-box";
  box.innerHTML = `
    <h3>✅ Envío creado correctamente</h3>
    <p>Tu paquete ya está registrado en BHUZ. No necesitas presionar Enviar paquete otra vez.</p>

    <div class="bhuz-envio-publicado-status">
      <span>Estado actual</span>
      <strong id="bhuz-envio-publicado-estado">${escapeHtmlCorto(estadoTexto)}</strong>
      <p id="bhuz-envio-publicado-driver">Repartidor: ${escapeHtmlCorto(driverTexto)}</p>
    </div>

    <div class="bhuz-envio-publicado-grid">
      <div class="bhuz-envio-publicado-item codigo">
        <span>Código receptor</span>
        <strong>${escapeHtmlCorto(codigoEntrega || "Por generar")}</strong>
      </div>
      <div class="bhuz-envio-publicado-item id-envio">
        <span>ID envío</span>
        <strong>${escapeHtmlCorto(serviceId)}</strong>
        <button type="button" class="bhuz-track-btn" data-bhuz-track-service="${escapeHtmlCorto(serviceId)}">📍 Ver paquete en tiempo real</button>
      </div>
      <div class="bhuz-envio-publicado-item">
        <span>Total</span>
        <strong>${totalTexto}</strong>
      </div>
      <div class="bhuz-envio-publicado-item">
        <span>Distancia</span>
        <strong>${distanciaTexto}</strong>
      </div>
    </div>

    <div class="bhuz-envio-publicado-actions">
      <button class="bhuz-envio-publicado-primary" data-bhuz-ver-seguimiento-cliente="true" type="button">Ver seguimiento</button>
      <button class="bhuz-envio-publicado-cancel" data-bhuz-cancelar-envio="true" type="button">Cancelar envío</button>
      <button class="bhuz-envio-publicado-secondary" data-bhuz-crear-otro-envio="true" type="button">Crear otro envío</button>
    </div>
  `;

  if (accionFinal) {
    accionFinal.appendChild(box);
    box.scrollIntoView({ behavior: "smooth", block: "center" });
  } else {
    const modulo = document.getElementById("modulo-envios");
    if (modulo) modulo.appendChild(box);
  }
}

function actualizarComprobanteEnvioPublicado(service) {
  if (!service || !document.getElementById("bhuz-envio-publicado-box")) return;

  const estado = limpiarTexto(service.status || service.estado || "").toUpperCase();
  const estadoTexto = obtenerEstadoClienteServicioTexto(service);
  const driverTexto = limpiarTexto(service.driverName || service.driver_name || "") || "Pendiente por asignar";
  const estadoEl = document.getElementById("bhuz-envio-publicado-estado");
  const driverEl = document.getElementById("bhuz-envio-publicado-driver");

  if (estadoEl) estadoEl.textContent = estadoTexto;
  if (driverEl) driverEl.textContent = `Repartidor: ${driverTexto}`;

  const box = document.getElementById("bhuz-envio-publicado-box");
  if (box) box.classList.toggle("is-cancelado", estado === "CANCELLED");

  const botonCancelar = document.querySelector("[data-bhuz-cancelar-envio]");
  if (botonCancelar && ["CANCELLED", "DELIVERED"].includes(estado)) {
    botonCancelar.disabled = true;
    botonCancelar.textContent = estado === "CANCELLED" ? "Envío cancelado" : "Entrega completada";
  }

  const anterior = BHUZ_SERVICES_STATE.comprobanteUltimoEstado;
  if (estado && anterior && estado !== anterior) {
    BHUZ_SERVICES_STATE.comprobanteUltimoEstado = estado;
    if (["DRIVER_ASSIGNED", "GOING_TO_PICKUP"].includes(estado)) reproducirSonidoReceptor("repartidor_retiro");
    if (estado === "PACKAGE_PICKED") reproducirSonidoReceptor("paquete_retirado");
    if (estado === "GOING_TO_DELIVERY") reproducirSonidoReceptor("en_camino");
    if (estado === "CANCELLED") reproducirSonidoReceptor("cancelado");
  } else if (estado && !anterior) {
    BHUZ_SERVICES_STATE.comprobanteUltimoEstado = estado;
  }
}

async function cancelarEnvioPublicado() {
  if (!BHUZ_SERVICES_STATE.serviceId) return;

  const confirmar = window.confirm("¿Seguro que quieres cancelar este envío? El receptor verá que fue cancelado.");
  if (!confirmar) return;

  const botonCancelar = document.querySelector("[data-bhuz-cancelar-envio]");

  try {
    if (botonCancelar) {
      botonCancelar.disabled = true;
      botonCancelar.textContent = "Cancelando...";
    }

    const respuesta = await fetchConTimeout(construirUrlApi(`/api/services/${encodeURIComponent(BHUZ_SERVICES_STATE.serviceId)}/status`), {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        status: "CANCELLED",
        changedBy: "customer",
        notes: "Cliente canceló el envío desde la ficha de seguimiento."
      })
    });

    const data = await respuesta.json().catch(() => ({}));

    if (!respuesta.ok || !data.ok) {
      throw new Error(data.message || "No se pudo cancelar el envío.");
    }

    BHUZ_SERVICES_STATE.envioCancelado = true;
    BHUZ_SERVICES_STATE.envioPublicado = true;
    BHUZ_SERVICES_STATE.ultimoServicio = data.service || BHUZ_SERVICES_STATE.ultimoServicio;

    actualizarComprobanteEnvioPublicado(data.service || { status: "CANCELLED" });

    const notaFinal = document.getElementById("envio-nota-final");
    if (notaFinal) notaFinal.textContent = "Envío cancelado correctamente.";

    alert("Envío cancelado correctamente.");
  } catch (error) {
    console.error("BHUZ cancelar envío:", error);
    if (botonCancelar) {
      botonCancelar.disabled = false;
      botonCancelar.textContent = "Cancelar envío";
    }
    alert(error.message || "No se pudo cancelar el envío.");
  }
}

function obtenerEstadoClienteServicioTexto(service) {
  const status = limpiarTexto(service?.status || service?.estado || "SEARCHING_DRIVER").toUpperCase();

  const estados = {
    PENDING_PAYMENT: "Pendiente por publicar",
    PAID: "Pago confirmado",
    SEARCHING_DRIVER: "Buscando repartidor",
    DRIVER_ASSIGNED: "Repartidor aceptó el envío",
    GOING_TO_PICKUP: "Repartidor en camino al retiro",
    PACKAGE_PICKED: "Paquete retirado",
    GOING_TO_DELIVERY: "En camino al receptor",
    DELIVERED: "Entregado",
    CANCELLED: "Cancelado"
  };

  return estados[status] || "Buscando repartidor";
}

function escapeHtmlCorto(value) {
  const clean = limpiarTexto(value);
  const corto = clean.length > 22 ? `${clean.slice(0, 8)}...${clean.slice(-6)}` : clean;
  return corto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* ==========================================================
   UTILIDADES
========================================================== */

function actualizarEstado(elemento, mensaje, tipo) {
  if (!elemento) return;

  elemento.textContent = mensaje;
  elemento.dataset.estado = tipo || "info";
}

function limpiarTexto(valor) {
  return String(valor || "").trim();
}

function normalizarNumeroServicio(valor) {
  const numero = Number(valor);
  return Number.isFinite(numero) ? redondear(numero) : 0;
}

function generarCodigoTemporal() {
  return "BHUZ-" + Date.now().toString(36).toUpperCase();
}

function redondear(numero) {
  return Math.round(Number(numero || 0) * 100) / 100;
}

function calcularDistanciaKm(lat1, lng1, lat2, lng2) {
  const radioTierraKm = 6371;
  const dLat = gradosARadianes(lat2 - lat1);
  const dLng = gradosARadianes(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(gradosARadianes(lat1)) *
      Math.cos(gradosARadianes(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return radioTierraKm * c;
}

function gradosARadianes(grados) {
  return grados * (Math.PI / 180);
}

window.addEventListener("beforeunload", () => {
  detenerPollingServicio();
  detenerPollingReceptor();
});






























/* BHUZ seguimiento + push para envíos */
document.addEventListener('click',function(event){
  const btn=event.target.closest('[data-bhuz-track-service]');
  if(btn&&window.BHUZ_TRACKING)window.BHUZ_TRACKING.open('PACKAGE',btn.dataset.bhuzTrackService,{title:'Seguimiento de tu paquete'});
});
window.BHUZ_ABRIR_SEGUIMIENTO_ENVIO=function(serviceId){if(window.BHUZ_TRACKING&&serviceId)window.BHUZ_TRACKING.open('PACKAGE',serviceId,{title:'Seguimiento de tu paquete'});};
