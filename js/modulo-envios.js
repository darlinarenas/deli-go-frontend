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
  receptorConfirmado: false
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
    btnEnviarPaquete.addEventListener("click", prepararEnvioParaPagoTemporal);
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

  actualizarEstadoReceptorTemporal("esperando_ubicacion");

  try {
    const respuesta = await fetchConTimeout(construirUrlApi(`/api/services/confirmar/${encodeURIComponent(tokenEnvio)}`));
    const data = await respuesta.json().catch(() => ({}));

    if (!respuesta.ok || !data.ok) {
      throw new Error(data.message || "No se pudo consultar el enlace del envío.");
    }

    BHUZ_SERVICES_STATE.serviceId = data.service?.id || "";
    BHUZ_SERVICES_STATE.token = tokenEnvio;

    if (data.token?.receiverConfirmed) {
      actualizarEstadoReceptorTemporal("ubicacion_confirmada");
      mostrarCodigoEntregaDesdeServicio(data.service);
      if (nota) {
        nota.textContent = "Tu ubicación ya fue confirmada. Entrega el código únicamente al repartidor cuando recibas el paquete.";
      }
    }
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

        if (nota) {
          nota.textContent = "Ubicación confirmada correctamente. Entrega el código únicamente al repartidor cuando recibas el paquete.";
        }

        actualizarEstadoReceptorTemporal("ubicacion_confirmada");
        mostrarCodigoEntregaDesdeServicio(data.service);

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
      }
    },
    (error) => {
      console.warn("BHUZ ubicación receptor:", error);
      if (nota) {
        nota.textContent =
          "No se pudo obtener la ubicación. Permite el acceso GPS desde el navegador e intenta nuevamente.";
      }
      actualizarEstadoReceptorTemporal("error");
    },
    {
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 0
    }
  );
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

function actualizarEstadoReceptorTemporal(estado) {
  const texto = document.getElementById("envio-receptor-status-text");
  const dot = document.getElementById("envio-receptor-status-dot");
  const cajaEstado = document.getElementById("envio-estado-receptor");
  const cajaTexto = document.getElementById("envio-estado-receptor-texto");

  const estados = {
    esperando_ubicacion: "Esperando ubicación",
    solicitando_ubicacion: "Solicitando ubicación",
    ubicacion_confirmada: "Ubicación confirmada",
    en_camino: "En camino",
    recibido: "Recibido",
    error: "Error de ubicación"
  };

  const mensaje = estados[estado] || estados.esperando_ubicacion;

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

  [esperando, enCamino, recibido].forEach((item) => {
    if (item) item.classList.remove("is-activa", "is-completada");
  });

  if (estado === "recibido") {
    if (esperando) esperando.classList.add("is-completada");
    if (enCamino) enCamino.classList.add("is-completada");
    if (recibido) recibido.classList.add("is-activa");
    return;
  }

  if (estado === "en_camino") {
    if (esperando) esperando.classList.add("is-completada");
    if (enCamino) enCamino.classList.add("is-activa");
    return;
  }

  if (esperando) esperando.classList.add("is-activa");
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
    credentials: "include"
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

  const estadoEntrega = document.getElementById("estado-ubicacion-entrega");
  const inputLat = document.getElementById("envio-entrega-lat");
  const inputLng = document.getElementById("envio-entrega-lng");

  const lat = service.deliveryLatitude || "";
  const lng = service.deliveryLongitude || "";
  const receptorConfirmado = Boolean(lat && lng);

  if (receptorConfirmado) {
    BHUZ_SERVICES_STATE.receptorConfirmado = true;

    if (inputLat) inputLat.value = lat;
    if (inputLng) inputLng.value = lng;

    actualizarEstado(
      estadoEntrega,
      "Receptor confirmó ubicación. Ya puedes enviar el paquete.",
      "ok"
    );

    actualizarResumenCalculo({
      distanciaKm: service.distanceKm || calcularDistanciaTemporal(obtenerDatosFormularioEnvio()),
      clientePaga: service.totalAmount || calcularMontoCliente(service.distanceKm || 0)
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
      notaCalculo.textContent = "Ubicación del receptor confirmada. Distancia real calculada. Revisa el total y continúa con Enviar paquete.";
    }

    if (notaFinal) {
      notaFinal.textContent = "Listo para continuar con el cobro. La pasarela de pago se conectará aquí.";
    }

    detenerPollingServicio();
  } else {
    bloquearBotonEnviarHastaConfirmacion();
  }
}

function bloquearBotonEnviarHastaConfirmacion() {
  const accionFinal = document.getElementById("envio-accion-final");
  const botonEnviar = document.getElementById("btn-enviar-paquete");
  const notaFinal = document.getElementById("envio-nota-final");

  if (!BHUZ_SERVICES_STATE.receptorConfirmado) {
    if (accionFinal) accionFinal.style.display = "none";
    if (botonEnviar) botonEnviar.disabled = true;
    if (notaFinal) {
      notaFinal.textContent = "Enviar paquete se activará cuando el receptor confirme su ubicación.";
    }
    return;
  }

  if (accionFinal) accionFinal.style.display = "grid";
  if (botonEnviar) botonEnviar.disabled = false;
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

  if (distancia) distancia.textContent = `Distancia: ${distanciaKm} km aprox.`;
  if (cliente) cliente.textContent = `Total del envío: $${clientePaga}`;
}

/* ==========================================================
   PREPARAR ENVÍO PARA PAGO / CREACIÓN REAL
========================================================== */

async function prepararEnvioParaPagoTemporal() {
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

  const distanciaKm = calcularDistanciaTemporal(datos);
  const totalEnvio = calcularMontoCliente(distanciaKm);

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
    const respuesta = await fetchConTimeout(construirUrlApi(`/api/services/${encodeURIComponent(BHUZ_SERVICES_STATE.serviceId)}/status`), {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        status: "PENDING_PAYMENT",
        changedBy: "customer",
        notes: "Cliente presionó Enviar paquete. Pendiente conexión con pasarela de pago."
      })
    });

    const data = await respuesta.json().catch(() => ({}));

    if (!respuesta.ok || !data.ok) {
      throw new Error(data.message || "No se pudo preparar el envío.");
    }

    alert(
      `Envío preparado en BHUZ.\n\nTotal a pagar: $${totalEnvio}\nDistancia: ${distanciaKm} km aprox.\n\nPróxima fase: conectar pasarela de pago y luego buscar repartidor.`
    );
  } catch (error) {
    console.error("BHUZ enviar paquete:", error);
    alert(error.message || "No se pudo preparar el envío.");
  }
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



















