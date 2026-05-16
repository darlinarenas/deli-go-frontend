/* ======================================================
   BHUZ
   orders.js

   PUENTE ENTRE FRONTEND Y BACKEND
   - Crear pedido
   - Obtener pedidos por restaurante
   - Obtener pedidos por cliente
   - Actualizar estado
   - Helpers para historial y panel
   - Backend como única fuente real de pedidos
====================================================== */

/* ======================================================
   BLOQUE 0
   CONFIGURACIÓN BACKEND
====================================================== */
const DELI_ORDERS_API_URL = "https://deligo-backend-i554.onrender.com"; // CAMBIO: conectar frontend con backend Render
// La única fuente real de pedidos es el backend Node + JSON.

/* ======================================================
   BLOQUE 1
   HELPERS GENERALES
====================================================== */
function ordersSafeParse(value, fallback = null) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

/* ======================================================
   BLOQUE 2
   SESIÓN ACTUAL
====================================================== */
function getCurrentUser() {
  /*
    CORRECCIÓN SEGURA:
    En navegador, esta función también puede quedar expuesta como window.getCurrentUser.
    Si llamamos window.getCurrentUser() desde aquí, puede llamarse a sí misma infinitamente
    y provocar: RangeError: Maximum call stack size exceeded.
  */
  if (
    typeof window.getCurrentUser === "function" &&
    window.getCurrentUser !== getCurrentUser
  ) {
    return window.getCurrentUser();
  }

  return window.DELI_CURRENT_USER || null;
}

/* ======================================================
   BLOQUE 3
   FORMATO DE PRECIO
====================================================== */
function formatPrice(value) {
  const amount = Number(value || 0);

  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

/* ======================================================
   BLOQUE 4
   ESTADOS
====================================================== */
function normalizeOrderStatus(status) {
  const normalized = normalizeText(status);

  switch (normalized) {
    case "pending":
      return "pendiente";

    case "accepted":
      return "aceptado";

    case "preparing":
      return "preparando";

    case "ready":
      return "listo";

    case "on_the_way":
    case "on-the-way":
    case "en camino":
      return "en_camino";

    case "delivered":
    case "completed":
    case "finished":
      return "entregado";

    case "pendiente":
    case "aceptado":
    case "preparando":
    case "listo":
    case "en_camino":
    case "entregado":
      return normalized;

    default:
      return "pendiente";
  }
}

function getStatusLabel(status) {
  switch (normalizeOrderStatus(status)) {
    case "pendiente":
      return "Pendiente";

    case "aceptado":
      return "Aceptado";

    case "preparando":
      return "Preparando";

    case "listo":
      return "Listo";

    case "en_camino":
      return "En camino";

    case "entregado":
      return "Entregado";

    default:
      return "Pendiente";
  }
}

function getStatusClass(status) {
  switch (normalizeOrderStatus(status)) {
    case "pendiente":
      return "status-pendiente";

    case "aceptado":
    case "preparando":
      return "status-preparando";

    case "listo":
      return "status-listo";

    case "en_camino":
      return "status-camino";

    case "entregado":
      return "status-entregado";

    default:
      return "status-pendiente";
  }
}

/* ======================================================
   BLOQUE 5
   COMPATIBILIDAD SIN LOCALSTORAGE OPERATIVO
   - Se mantienen estas funciones para no romper dependencias viejas.
   - Ya NO leen ni escriben pedidos reales en el navegador.
   - Backend es la única fuente de verdad.
====================================================== */
function getLocalOrders() {
  // Backend puro:
  // No se leen pedidos desde backend para evitar datos viejos,
  // pedidos fantasmas o diferencias entre dispositivos.
  return [];
}

function saveLocalOrders(orders) {
  // Backend puro:
  // No se guardan pedidos en backend.
  // Se deja la función para no romper llamadas existentes dentro del proyecto.
  return orders;
}

/* ======================================================
   BLOQUE 6
   NORMALIZAR ESTRUCTURA DE PEDIDO
====================================================== */
function normalizeOrder(order) {
  if (!order || typeof order !== "object") return null;

  const restaurantObject =
    order.restaurant && typeof order.restaurant === "object"
      ? order.restaurant
      : {};

  const customerObject =
    order.customer && typeof order.customer === "object"
      ? order.customer
      : {};

  const items = Array.isArray(order.items)
    ? order.items.map((item) => {
        const qty = Number(item?.qty || 0);
        const price = Number(item?.price || 0);

        return {
          id: item?.id || "",
          name: item?.name || "Producto",
          qty,
          price,
          subtotal: Number(
            item?.subtotal != null ? item.subtotal : qty * price
          )
        };
      })
    : [];

  return {
    id: order.id || `order_${Date.now()}`,
    restaurantEmail: normalizeText(
      order.restaurantEmail || restaurantObject.email || ""
    ),
    restaurantName:
      order.restaurantName || restaurantObject.name || "Restaurante",
    restaurant: {
      email: normalizeText(
        restaurantObject.email || order.restaurantEmail || ""
      ),
      name: restaurantObject.name || order.restaurantName || "Restaurante",
      id: restaurantObject.id || order.restaurantId || ""
    },
    items,
    total: Number(order.total || 0),
    customer: {
      fullName:
        customerObject.fullName ||
        customerObject.name ||
        order.fullName ||
        "",
      phone:
        customerObject.phone ||
        order.phone ||
        "",
      address:
        customerObject.address ||
        order.address ||
        "",
      email:
        customerObject.email ||
        order.email ||
        ""
    },
    status: normalizeOrderStatus(order.status),
    paymentMethod: order.paymentMethod || "pendiente",
    notes: order.notes || "",
    date: order.date || "",
    time: order.time || "",
    createdAt: order.createdAt || new Date().toISOString()
  };
}

function normalizeOrdersList(list) {
  if (!Array.isArray(list)) return [];
  return list.map(normalizeOrder).filter(Boolean);
}

/* ======================================================
   BLOQUE 7
   CREAR PEDIDO
====================================================== */
async function createOrder(order) {
  const normalizedOrder = normalizeOrder(order);

  try {
    const response = await fetch(`${DELI_ORDERS_API_URL}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(normalizedOrder)
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      console.error("Error backend al crear pedido:", data.message);
      return null;
    }

    const savedOrder = normalizeOrder(data.order);

    if (!savedOrder) {
      console.error("El backend no devolvió un pedido válido.");
      return null;
    }

    // IMPORTANTE:
    // El pedido ya fue guardado por el backend en orders.json.
    // No duplicamos el pedido en backend.

    // CAMBIO BHUZ LIVE GLOBAL:
    // Guardamos SOLO un resumen temporal de UI para que index/header.js
    // pueda mostrar la información del último pedido en la campanita.
    // No se usa como fuente real de pedidos. La fuente real sigue siendo backend/PostgreSQL.
    try {
      sessionStorage.setItem("bhuzLastOrderSummary", JSON.stringify({
        id: savedOrder.id,
        restaurantName: savedOrder.restaurantName || savedOrder.restaurant?.name || "BHUZ",
        status: savedOrder.status || "pendiente",
        total: savedOrder.total || 0,
        createdAt: savedOrder.createdAt || new Date().toISOString()
      }));
    } catch (error) {
      console.warn("No se pudo guardar resumen temporal del último pedido:", error);
    }

    window.dispatchEvent(new CustomEvent("bhuz:order-created", {
      detail: {
        order: savedOrder
      }
    }));

    return savedOrder;
  } catch (error) {
    console.error("No se pudo conectar con el backend al crear pedido:", error);
    return null;
  }
}

/* ======================================================
   BLOQUE 8
   PEDIDOS DEL RESTAURANTE
====================================================== */
async function getOrdersByRestaurant(email) {
  const normalizedEmail = normalizeText(email);

  try {
    const response = await fetch(
      `${DELI_ORDERS_API_URL}/orders/restaurant/${encodeURIComponent(normalizedEmail)}`
    );

    const data = await response.json();

    if (response.ok && data.ok) {
      const normalizedOrders = normalizeOrdersList(data.orders);

      // CAMBIO BHUZ LIVE:
      // Cada vez que la vista de cliente refresca pedidos desde backend,
      // se comparan estados en memoria y se muestran notificaciones premium
      // solo cuando un pedido cambia de estado después de la primera carga.
      if (window.BHUZ_LIVE_NOTIFICATIONS) {
        window.BHUZ_LIVE_NOTIFICATIONS.processCustomerOrders(normalizedOrders);
      }

      return normalizedOrders;
    }
  } catch (error) {
    console.warn("No se pudo leer pedidos del restaurante desde backend:", error);
  }

  // CAMBIO: conectar frontend con backend Render - no usar backend como fuente principal si falla el backend
  return [];
}

/* ======================================================
   BLOQUE 9
   PEDIDOS DEL CLIENTE
====================================================== */
async function getOrdersByCustomer(email) {
  const normalizedEmail = normalizeText(email);

  try {
    const response = await fetch(
      `${DELI_ORDERS_API_URL}/orders/customer/${encodeURIComponent(normalizedEmail)}`
    );

    const data = await response.json();

    if (response.ok && data.ok) {
      const normalizedOrders = normalizeOrdersList(data.orders);

      // CAMBIO BHUZ LIVE:
      // La vista de cliente usa getOrdersByCustomer().
      // Aquí se detectan cambios de estado para mostrar:
      // - popup premium
      // - glow neón
      // - sonidos
      if (window.BHUZ_LIVE_NOTIFICATIONS) {
        window.BHUZ_LIVE_NOTIFICATIONS.processCustomerOrders(normalizedOrders);
      }

      return normalizedOrders;
    }
  } catch (error) {
    console.warn("No se pudo leer pedidos del cliente desde backend:", error);
  }

  // CAMBIO: conectar frontend con backend Render - no usar backend como fuente principal si falla el backend
  return [];
}

/* ======================================================
   BLOQUE 10
   ACTUALIZAR ESTADO
====================================================== */
async function updateOrderStatus(orderId, status) {
  const normalizedStatus = normalizeOrderStatus(status);

  try {
    const response = await fetch(
      `${DELI_ORDERS_API_URL}/orders/${encodeURIComponent(orderId)}/status`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ status: normalizedStatus })
      }
    );

    const data = await response.json();

    if (response.ok && data.ok) {
      const updatedOrder = normalizeOrder(data.order);

      if (
        updatedOrder &&
        normalizeOrderStatus(updatedOrder.status) === normalizedStatus
      ) {
        const orders = getLocalOrders();

        const index = orders.findIndex(
          (order) => String(order.id) === String(orderId)
        );

        if (index >= 0) {
          orders[index] = updatedOrder;
        } else {
          orders.unshift(updatedOrder);
        }

        saveLocalOrders(orders);
        return updatedOrder;
      }

      console.warn(
        "El backend respondió, pero no confirmó el estado esperado:",
        {
          esperado: normalizedStatus,
          recibido: updatedOrder?.status || data?.order?.status || null
        }
      );
    }
  } catch (error) {
    console.warn("No se pudo actualizar estado en backend:", error);
  }

  // Backend puro:
  // Si el backend no confirmó el cambio, NO actualizamos localmente.
  // Esto evita que el panel muestre estados falsos que no existen en orders.json.
  return null;
}

/* ======================================================
   BLOQUE 11
   BHUZ LIVE NOTIFICATIONS
   - Notificaciones visuales premium para cambios de estado.
   - Preparado para sonidos personalizados grabados por el usuario.
   - No modifica backend, PostgreSQL, pedidos ni respuestas JSON.
   - Solo compara estados recibidos desde backend en memoria del navegador.
====================================================== */
const BHUZ_LIVE_SOUND_CONFIG = {
  /*
    CAMBIO FUTURO PARA SONIDOS PERSONALIZADOS:
    Cuando tengas tus audios propios, colócalos en esta ruta del frontend:

      assets/sounds/

    Y reemplaza los nombres de archivo de abajo por los tuyos.
    Formatos recomendados: .mp3, .webm o .wav corto.

    Ejemplo:
      aceptado: "assets/sounds/mi-voz-pedido-aceptado.mp3"
  */
  enabled: true,
  volume: 0.35,
  useSoftFallbackBeep: true,
  customSounds: {
    aceptado: "assets/sounds/bhuz-pedido-aceptado.mp3",
    preparando: "assets/sounds/bhuz-pedido-preparando.mp3",
    listo: "assets/sounds/bhuz-pedido-listo.mp3",
    en_camino: "assets/sounds/bhuz-pedido-en-camino.mp3",
    entregado: "assets/sounds/bhuz-pedido-entregado.mp3"
  }
};

const BHUZ_LIVE_STATUS_MESSAGES = {
  aceptado: {
    title: "Pedido aceptado",
    message: "El restaurante ya aceptó tu pedido."
  },
  preparando: {
    title: "Pedido en preparación",
    message: "Tu comida ya se está preparando."
  },
  listo: {
    title: "Pedido listo",
    message: "Tu pedido está listo para salir."
  },
  en_camino: {
    title: "Pedido en camino",
    message: "El repartidor va hacia tu ubicación."
  },
  entregado: {
    title: "Pedido entregado",
    message: "Tu pedido fue marcado como entregado."
  }
};

function createBhuzLiveNotifications() {
  const statusCache = new Map();
  let firstCustomerSyncDone = false;
  let audioUnlocked = false;

  function ensureRoot() {
    let root = document.getElementById("bhuzLiveRoot");

    if (!root) {
      root = document.createElement("div");
      root.id = "bhuzLiveRoot";
      root.className = "bhuz-live-root";
      document.body.appendChild(root);
    }

    return root;
  }

  function unlockAudioOnce() {
    if (audioUnlocked) return;
    audioUnlocked = true;
  }

  function bindAudioUnlockEvents() {
    ["click", "touchstart", "keydown"].forEach((eventName) => {
      window.addEventListener(eventName, unlockAudioOnce, { once: true, passive: true });
    });
  }

  function playFallbackBeep(status) {
    if (!BHUZ_LIVE_SOUND_CONFIG.useSoftFallbackBeep) return;

    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;

      const audioContext = new AudioContext();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();

      const statusFrequency = {
        aceptado: 620,
        preparando: 680,
        listo: 760,
        en_camino: 820,
        entregado: 540
      };

      oscillator.type = "sine";
      oscillator.frequency.value = statusFrequency[status] || 650;
      gain.gain.value = 0.035;

      oscillator.connect(gain);
      gain.connect(audioContext.destination);

      oscillator.start();
      setTimeout(() => {
        oscillator.stop();
        audioContext.close();
      }, 150);
    } catch (error) {
      // Silencioso: algunos navegadores bloquean audio si no hubo interacción.
    }
  }

  function playStatusSound(status) {
    if (!BHUZ_LIVE_SOUND_CONFIG.enabled) return;

    const normalizedStatus = normalizeOrderStatus(status);
    const soundSrc = BHUZ_LIVE_SOUND_CONFIG.customSounds[normalizedStatus];

    if (!audioUnlocked) {
      // Antes de la primera interacción del usuario, muchos navegadores bloquean audio.
      // Igual se muestra la notificación visual premium.
      return;
    }

    if (soundSrc) {
      try {
        const audio = new Audio(soundSrc);
        audio.volume = BHUZ_LIVE_SOUND_CONFIG.volume;

        audio.play().catch(() => {
          playFallbackBeep(normalizedStatus);
        });
        return;
      } catch (error) {
        playFallbackBeep(normalizedStatus);
        return;
      }
    }

    playFallbackBeep(normalizedStatus);
  }

  function getNotificationCopy(status) {
    const normalizedStatus = normalizeOrderStatus(status);

    return BHUZ_LIVE_STATUS_MESSAGES[normalizedStatus] || {
      title: "Pedido actualizado",
      message: `Tu pedido ahora está ${getStatusLabel(normalizedStatus).toLowerCase()}.`
    };
  }

  function safeCssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === "function") {
      return window.CSS.escape(value);
    }

    return String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
  }

  function glowOrderCard(orderId) {
    const safeId = String(orderId || "");
    if (!safeId) return;

    const escapedId = safeCssEscape(safeId);

    const selectors = [
      `[data-order-id="${escapedId}"]`,
      `.order-card[data-id="${escapedId}"]`,
      `.order-card[data-order="${escapedId}"]`
    ];

    const card = document.querySelector(selectors.join(","));
    if (!card) return;

    card.classList.remove("updated-glow", "bhuz-live-card-updated");
    void card.offsetWidth;
    card.classList.add("updated-glow", "bhuz-live-card-updated");

    setTimeout(() => {
      card.classList.remove("bhuz-live-card-updated");
    }, 2400);
  }

  function showToast(order, previousStatus, nextStatus) {
    if (typeof document === "undefined" || !document.body) return;

    const normalizedStatus = normalizeOrderStatus(nextStatus);
    const copy = getNotificationCopy(normalizedStatus);
    const root = ensureRoot();

    const toast = document.createElement("div");
    toast.className = `bhuz-live-toast bhuz-live-${normalizedStatus}`;
    toast.innerHTML = `
      <div class="bhuz-live-icon">${getStatusIcon(normalizedStatus)}</div>
      <div class="bhuz-live-content">
        <strong>${escapeLiveHtml(copy.title)}</strong>
        <span>${escapeLiveHtml(copy.message)}</span>
        <small>${escapeLiveHtml(order.restaurantName || "BHUZ")}</small>
      </div>
      <button class="bhuz-live-close" type="button" aria-label="Cerrar notificación">×</button>
    `;

    root.appendChild(toast);

    const closeBtn = toast.querySelector(".bhuz-live-close");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => removeToast(toast));
    }

    setTimeout(() => removeToast(toast), 6500);
    playStatusSound(normalizedStatus);

    // CAMBIO BHUZ LIVE GLOBAL:
    // Vibración real en móviles compatibles, sin afectar desktop.
    if (navigator.vibrate) {
      navigator.vibrate([80, 40, 80]);
    }

    glowOrderCard(order.id);

    window.dispatchEvent(new CustomEvent("bhuz:order-status-changed", {
      detail: {
        order,
        previousStatus,
        nextStatus: normalizedStatus
      }
    }));
  }

  function removeToast(toast) {
    if (!toast || toast.classList.contains("is-hiding")) return;

    toast.classList.add("is-hiding");
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 260);
  }

  function getStatusIcon(status) {
    switch (normalizeOrderStatus(status)) {
      case "aceptado":
        return "✅";
      case "preparando":
        return "👨‍🍳";
      case "listo":
        return "🔥";
      case "en_camino":
        return "🛵";
      case "entregado":
        return "🎉";
      default:
        return "🔔";
    }
  }

  function escapeLiveHtml(text) {
    return String(text || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function shouldNotify(previousStatus, nextStatus) {
    const previous = normalizeOrderStatus(previousStatus);
    const next = normalizeOrderStatus(nextStatus);

    if (!previous || previous === next) return false;
    if (next === "pendiente") return false;

    return true;
  }

  function processCustomerOrders(orders) {
    if (!Array.isArray(orders)) return;

    const normalizedOrders = normalizeOrdersList(orders);

    normalizedOrders.forEach((order) => {
      const orderId = String(order.id || "");
      if (!orderId) return;

      const nextStatus = normalizeOrderStatus(order.status);
      const previousStatus = statusCache.get(orderId);

      if (firstCustomerSyncDone && shouldNotify(previousStatus, nextStatus)) {
        showToast(order, previousStatus, nextStatus);
      }

      statusCache.set(orderId, nextStatus);
    });

    firstCustomerSyncDone = true;
  }

  bindAudioUnlockEvents();

  return {
    processCustomerOrders,
    playStatusSound,
    showToast,
    config: BHUZ_LIVE_SOUND_CONFIG
  };
}

window.BHUZ_LIVE_NOTIFICATIONS = window.BHUZ_LIVE_NOTIFICATIONS || createBhuzLiveNotifications();

/* ======================================================
   BLOQUE 12
   EXPORT GLOBAL
====================================================== */
window.DELI_ORDERS = {
  createOrder,
  getOrdersByRestaurant,
  getOrdersByCustomer,
  updateOrderStatus,
  getCurrentUser,
  formatPrice,
  getStatusLabel,
  getStatusClass,
  normalizeOrderStatus,
  bhuzLiveNotifications: window.BHUZ_LIVE_NOTIFICATIONS
};











































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































