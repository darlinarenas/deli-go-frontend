/* ==========================================================
   BHUZ - MÓDULO ENVIAR PAQUETES
   Archivo: js/modulo-envios.js

   Objetivo:
   - Mantener toda la lógica de envíos separada del index.
   - No tocar comida, restaurantes, carrito, pedidos ni backend.
   - Preparar GPS, link receptor, foto, términos y cálculo temporal.
========================================================== */

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
  const btnCalcular = document.getElementById("btn-calcular-envio");
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

  if (btnCalcular) {
    btnCalcular.addEventListener("click", calcularEnvioTemporal);
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

function generarEnlaceReceptor() {
  const contacto = limpiarTexto(document.getElementById("envio-contacto")?.value);
  const destino = limpiarTexto(document.getElementById("envio-destino")?.value);
  const cajaLink = document.getElementById("envio-link-receptor");
  const inputLink = document.getElementById("envio-link-confirmacion");
  const estado = document.getElementById("estado-ubicacion-entrega");

  if (!contacto || !destino) {
    actualizarEstado(
      estado,
      "Para generar el enlace, coloca primero la dirección de entrega y el contacto del receptor.",
      "error"
    );
    return;
  }

  const codigoTemporal = generarCodigoTemporal();
  const baseUrl = window.location.origin + window.location.pathname;
  const enlace = `${baseUrl}?confirmar_entrega=${codigoTemporal}#envios`;

  if (inputLink) inputLink.value = enlace;
  if (cajaLink) cajaLink.style.display = "grid";

  actualizarEstado(
    estado,
    "Enlace generado. Envíalo por WhatsApp para que el receptor confirme su ubicación.",
    "ok"
  );
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
  const datos = obtenerDatosFormularioEnvio();
  const errores = validarDatosEnvio(datos);

  if (errores.length > 0) {
    alert("Revisa estos puntos:\n\n" + errores.map((e) => `• ${e}`).join("\n"));
    return;
  }

  const distanciaKm = calcularDistanciaTemporal(datos);
  const clientePaga = calcularMontoCliente(distanciaKm);
  const comisionBhuz = redondear(clientePaga * 0.18);
  const repartidorRecibe = redondear(clientePaga - comisionBhuz);

  actualizarResumenCalculo({
    distanciaKm,
    clientePaga,
    repartidorRecibe,
    comisionBhuz
  });

  const notaFinal = document.getElementById("envio-nota-final");
  if (notaFinal) {
    notaFinal.textContent = "Cálculo temporal listo. En la fase backend se guardará la solicitud y se asignará repartidor.";
  }
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

function actualizarResumenCalculo({ distanciaKm, clientePaga, repartidorRecibe, comisionBhuz }) {
  const distancia = document.getElementById("envio-resumen-distancia");
  const cliente = document.getElementById("envio-resumen-cliente");
  const repartidor = document.getElementById("envio-resumen-repartidor");
  const bhuz = document.getElementById("envio-resumen-bhuz");

  if (distancia) distancia.textContent = `Distancia: ${distanciaKm} km aprox.`;
  if (cliente) cliente.textContent = `Cliente paga: $${clientePaga}`;
  if (repartidor) repartidor.textContent = `Repartidor recibe: $${repartidorRecibe}`;
  if (bhuz) bhuz.textContent = `Comisión BHUZ: $${comisionBhuz}`;
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


