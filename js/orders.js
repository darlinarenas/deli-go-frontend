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
   BHUZ LIVE NOTIFICATIONS GLOBAL V3
   - Pop-up GLOBAL: index, mis pedidos y cualquier página que cargue orders.js.
   - Botón discreto "Activar sonidos BHUZ" para dar permiso real en móvil.
   - Vibración como respaldo cuando el navegador permite navigator.vibrate().
   - Evita mostrar notificaciones al restaurante.
   - Evita duplicados cuando mis-pedidos y el polling global consultan a la vez.
   - Mantiene backend/PostgreSQL intactos: solo escucha estados desde backend.
====================================================== */
const BHUZ_LIVE_SOUND_CONFIG = {
  enabled: true,
  volume: 0.78,
  toastDurationMs: 14000,
  globalPollingMs: 7000,
  useSoftFallbackBeep: true,
  useVibrationOnMobile: true,

  /*
    SONIDOS TEMPORALES / PERSONALIZABLES:
    Coloca tus audios propios en:
      assets/sounds/

    y reemplaza estos nombres cuando grabes tus sonidos BHUZ originales.
  */
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
    badge: "¡GENIAL!",
    title: "¡Tu pedido fue aceptado!",
    highlight: "aceptado",
    message: "El restaurante aceptó tu pedido y ya está en proceso."
  },
  preparando: {
    badge: "EN PREPARACIÓN",
    title: "¡Tu pedido está en preparación!",
    highlight: "preparación",
    message: "Tu comida ya se está preparando."
  },
  listo: {
    badge: "CASI LISTO",
    title: "¡Tu pedido está listo!",
    highlight: "listo",
    message: "Tu pedido está listo para salir."
  },
  en_camino: {
    badge: "EN CAMINO",
    title: "¡Tu pedido va en camino!",
    highlight: "camino",
    message: "El repartidor va hacia tu ubicación."
  },
  entregado: {
    badge: "ENTREGADO",
    title: "¡Pedido entregado!",
    highlight: "entregado",
    message: "Tu pedido fue marcado como entregado."
  }
};

function createBhuzLiveNotifications() {
  const statusCache = new Map();
  const notifiedCache = new Map();
  const audioElements = new Map();

  const STORAGE_STATUS_CACHE = "BHUZ_LIVE_STATUS_CACHE_V3";
  const STORAGE_SOUND_ENABLED = "BHUZ_LIVE_SOUND_ENABLED_V3";

  let firstCustomerSyncDone = false;
  let audioUnlocked = false;
  let globalPollingStarted = false;
  let lastCustomerEmailPolled = "";

  function ensureStyles() {
    if (document.getElementById("bhuzLiveStyles")) return;

    const style = document.createElement("style");
    style.id = "bhuzLiveStyles";
    style.textContent = `
      .bhuz-live-root{
        position:fixed;
        left:50%;
        top:calc(env(safe-area-inset-top, 0px) + 14px);
        transform:translateX(-50%);
        width:min(940px, calc(100% - 24px));
        z-index:999999;
        display:flex;
        flex-direction:column;
        gap:12px;
        pointer-events:none;
      }

      .bhuz-live-toast{
        --bhuz-toast-duration:14s;
        position:relative;
        overflow:hidden;
        width:100%;
        min-height:116px;
        display:grid;
        grid-template-columns:auto minmax(0,1fr) auto;
        align-items:center;
        gap:18px;
        padding:18px 20px;
        border-radius:26px;
        color:#fff;
        border:1px solid rgba(0,255,140,.68);
        background:
          radial-gradient(circle at 13% 52%, rgba(0,255,140,.27), transparent 28%),
          radial-gradient(circle at 88% 52%, rgba(0,210,106,.20), transparent 24%),
          linear-gradient(135deg, rgba(5,9,14,.98), rgba(12,18,28,.96));
        box-shadow:
          0 0 0 1px rgba(0,255,140,.14) inset,
          0 22px 60px rgba(0,0,0,.60),
          0 0 36px rgba(0,255,140,.34);
        pointer-events:auto;
        animation:bhuzToastIn .34s cubic-bezier(.2,.9,.22,1.18);
      }

      .bhuz-live-toast::before{
        content:"";
        position:absolute;
        inset:0;
        background:
          linear-gradient(90deg, transparent, rgba(255,255,255,.08), transparent),
          radial-gradient(circle at 75% 35%, rgba(255,221,0,.15), transparent 16%);
        pointer-events:none;
      }

      .bhuz-live-toast::after{
        content:"";
        position:absolute;
        left:0;
        bottom:0;
        height:4px;
        width:100%;
        background:linear-gradient(90deg,#7cff00,#00d26a,#18f08a);
        transform-origin:left;
        animation:bhuzToastTimer var(--bhuz-toast-duration) linear forwards;
        box-shadow:0 0 16px rgba(0,255,140,.75);
      }

      .bhuz-live-icon-wrap{
        position:relative;
        width:82px;
        height:82px;
        display:flex;
        align-items:center;
        justify-content:center;
        border-radius:50%;
        background:radial-gradient(circle, rgba(124,255,0,.34), rgba(0,210,106,.14));
        border:1px solid rgba(124,255,0,.58);
        box-shadow:0 0 28px rgba(124,255,0,.36);
        flex:0 0 auto;
      }

      .bhuz-live-icon-wrap::before{
        content:"";
        position:absolute;
        inset:-10px;
        border-radius:50%;
        border:1px solid rgba(124,255,0,.28);
        animation:bhuzPulse 1.7s ease-in-out infinite;
      }

      .bhuz-live-icon{
        position:relative;
        z-index:2;
        font-size:38px;
        filter:drop-shadow(0 0 12px rgba(0,255,140,.4));
      }

      .bhuz-live-content{
        position:relative;
        z-index:2;
        min-width:0;
      }

      .bhuz-live-badge{
        display:inline-flex;
        width:fit-content;
        margin-bottom:6px;
        padding:4px 9px;
        border-radius:999px;
        background:linear-gradient(135deg,#7cff00,#00d26a);
        color:#061006;
        font-size:11px;
        font-weight:1000;
        letter-spacing:.02em;
      }

      .bhuz-live-content strong{
        display:block;
        color:#ffffff;
        font-size:clamp(19px, 3.4vw, 30px);
        line-height:1.05;
        font-weight:1000;
        letter-spacing:-.04em;
      }

      .bhuz-live-content strong .bhuz-live-highlight{
        color:#7cff00;
        font-style:italic;
        text-shadow:0 0 16px rgba(124,255,0,.34);
      }

      .bhuz-live-content span{
        display:block;
        margin-top:7px;
        color:rgba(255,255,255,.88);
        font-size:clamp(13px, 2.6vw, 17px);
        line-height:1.35;
        font-weight:700;
      }

      .bhuz-live-content small{
        display:block;
        margin-top:5px;
        color:rgba(124,255,0,.78);
        font-size:12px;
        font-weight:900;
      }

      .bhuz-live-food{
        position:relative;
        z-index:2;
        width:92px;
        height:72px;
        display:flex;
        align-items:center;
        justify-content:center;
        font-size:50px;
        filter:drop-shadow(0 0 18px rgba(0,255,140,.26));
      }

      .bhuz-live-close{
        position:absolute;
        top:12px;
        right:14px;
        z-index:5;
        width:34px;
        height:34px;
        border:0;
        border-radius:50%;
        background:rgba(255,255,255,.08);
        color:#fff;
        font-size:26px;
        line-height:1;
        cursor:pointer;
        display:flex;
        align-items:center;
        justify-content:center;
      }

      .bhuz-live-close:hover{
        background:rgba(255,255,255,.15);
      }

      .bhuz-live-preparando{
        border-color:rgba(250,204,21,.70);
        box-shadow:0 22px 60px rgba(0,0,0,.60), 0 0 34px rgba(250,204,21,.27);
      }

      .bhuz-live-preparando::after{
        background:linear-gradient(90deg,#facc15,#f97316);
      }

      .bhuz-live-en_camino{
        border-color:rgba(56,189,248,.74);
        box-shadow:0 22px 60px rgba(0,0,0,.60), 0 0 34px rgba(56,189,248,.27);
      }

      .bhuz-live-en_camino::after{
        background:linear-gradient(90deg,#38bdf8,#00d26a);
      }

      .bhuz-live-entregado{
        border-color:rgba(168,85,247,.74);
        box-shadow:0 22px 60px rgba(0,0,0,.60), 0 0 34px rgba(168,85,247,.27);
      }

      .bhuz-live-entregado::after{
        background:linear-gradient(90deg,#a855f7,#00d26a);
      }

      .bhuz-live-toast.is-hiding{
        animation:bhuzToastOut .25s ease forwards;
      }

      .bhuz-live-card-updated{
        border-color:rgba(0,255,140,.78)!important;
        box-shadow:0 0 34px rgba(0,255,140,.33)!important;
      }

      .bhuz-sound-unlock{
        position:fixed;
        right:14px;
        bottom:calc(env(safe-area-inset-bottom, 0px) + 88px);
        z-index:999998;
        display:flex;
        align-items:center;
        gap:8px;
        border:1px solid rgba(0,255,140,.28);
        border-radius:999px;
        padding:10px 13px;
        color:#061006;
        background:linear-gradient(135deg,#7cff00,#00d26a);
        box-shadow:0 14px 34px rgba(0,210,106,.26);
        font-size:13px;
        font-weight:1000;
        cursor:pointer;
        opacity:.94;
      }

      .bhuz-sound-unlock:hover{
        opacity:1;
        transform:translateY(-1px);
      }

      .bhuz-sound-unlock.is-hidden{
        display:none;
      }

      @keyframes bhuzToastIn{
        from{ opacity:0; transform:translateY(-22px) scale(.96); }
        to{ opacity:1; transform:translateY(0) scale(1); }
      }

      @keyframes bhuzToastOut{
        from{ opacity:1; transform:translateY(0) scale(1); }
        to{ opacity:0; transform:translateY(-18px) scale(.97); }
      }

      @keyframes bhuzToastTimer{
        from{ transform:scaleX(1); }
        to{ transform:scaleX(0); }
      }

      @keyframes bhuzPulse{
        0%,100%{ transform:scale(.94); opacity:.65; }
        50%{ transform:scale(1.08); opacity:1; }
      }

      @media(max-width:640px){
        .bhuz-live-root{
          top:calc(env(safe-area-inset-top, 0px) + 8px);
          width:calc(100% - 18px);
          gap:10px;
        }

        .bhuz-live-toast{
          min-height:104px;
          grid-template-columns:auto minmax(0,1fr);
          gap:12px;
          padding:14px 42px 14px 13px;
          border-radius:20px;
        }

        .bhuz-live-icon-wrap{
          width:60px;
          height:60px;
        }

        .bhuz-live-icon-wrap::before{
          inset:-7px;
        }

        .bhuz-live-icon{
          font-size:28px;
        }

        .bhuz-live-badge{
          font-size:9px;
          padding:3px 7px;
          margin-bottom:5px;
        }

        .bhuz-live-content strong{
          font-size:17px;
          letter-spacing:-.025em;
        }

        .bhuz-live-content span{
          font-size:12px;
          margin-top:5px;
        }

        .bhuz-live-content small{
          display:none;
        }

        .bhuz-live-food{
          display:none;
        }

        .bhuz-live-close{
          top:9px;
          right:9px;
          width:30px;
          height:30px;
          font-size:23px;
        }

        .bhuz-sound-unlock{
          right:12px;
          bottom:calc(env(safe-area-inset-bottom, 0px) + 78px);
          padding:9px 11px;
          font-size:12px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function ensureRoot() {
    ensureStyles();

    let root = document.getElementById("bhuzLiveRoot");

    if (!root) {
      root = document.createElement("div");
      root.id = "bhuzLiveRoot";
      root.className = "bhuz-live-root";
      document.body.appendChild(root);
    }

    return root;
  }

  function getCurrentCustomerForLive() {
    const user = getCurrentUser();

    if (!user || typeof user !== "object") return null;

    const role = normalizeText(user.role || user.type || "");
    const email = normalizeText(user.email || "");

    if (!email) return null;

    if (role && role !== "customer" && role !== "cliente" && role !== "user" && role !== "usuario") {
      return null;
    }

    return {
      ...user,
      email
    };
  }

  function readStatusCacheFromSession() {
    try {
      const saved = ordersSafeParse(sessionStorage.getItem(STORAGE_STATUS_CACHE), {});
      if (!saved || typeof saved !== "object") return;

      Object.entries(saved).forEach(([orderId, status]) => {
        if (orderId) statusCache.set(String(orderId), normalizeOrderStatus(status));
      });
    } catch {
      // Silencioso.
    }
  }

  function saveStatusCacheToSession() {
    try {
      const plain = {};
      statusCache.forEach((status, orderId) => {
        plain[orderId] = status;
      });
      sessionStorage.setItem(STORAGE_STATUS_CACHE, JSON.stringify(plain));
    } catch {
      // Silencioso.
    }
  }

  function hasSoundPermissionSaved() {
    try {
      return sessionStorage.getItem(STORAGE_SOUND_ENABLED) === "1";
    } catch {
      return false;
    }
  }

  function saveSoundPermission() {
    try {
      sessionStorage.setItem(STORAGE_SOUND_ENABLED, "1");
    } catch {
      // Silencioso.
    }
  }

  function ensureSoundUnlockButton() {
    ensureStyles();

    if (audioUnlocked || hasSoundPermissionSaved()) {
      return;
    }

    if (document.getElementById("bhuzSoundUnlock")) return;

    const button = document.createElement("button");
    button.id = "bhuzSoundUnlock";
    button.className = "bhuz-sound-unlock";
    button.type = "button";
    button.innerHTML = "🔊 Activar sonidos BHUZ";

    button.addEventListener("click", async () => {
      await unlockAudioNow(true);
      hideSoundUnlockButton();
      showMiniActivationToast();
    });

    document.body.appendChild(button);
  }

  function hideSoundUnlockButton() {
    const button = document.getElementById("bhuzSoundUnlock");
    if (button) {
      button.classList.add("is-hidden");
      setTimeout(() => {
        if (button.parentNode) button.parentNode.removeChild(button);
      }, 250);
    }
  }

  async function unlockAudioNow(userRequested = false) {
    audioUnlocked = true;
    saveSoundPermission();
    prepareAudioElements();

    await warmUpAudio();

    if (userRequested) {
      playFallbackBeep("aceptado");
      vibrateSoftly("aceptado");
    }
  }

  function bindPassiveAudioUnlockEvents() {
    /*
      Esto ayuda en PC y algunos Android, pero el botón sigue siendo la forma
      más estable para dar permiso real en móvil.
    */
    ["click", "touchstart", "pointerdown", "keydown"].forEach((eventName) => {
      window.addEventListener(eventName, () => {
        if (!audioUnlocked && hasSoundPermissionSaved()) {
          unlockAudioNow(false);
        }
      }, { once: false, passive: true });
    });
  }

  function prepareAudioElements() {
    try {
      Object.entries(BHUZ_LIVE_SOUND_CONFIG.customSounds).forEach(([status, src]) => {
        if (!src || audioElements.has(status)) return;

        const audio = new Audio(src);
        audio.preload = "auto";
        audio.playsInline = true;
        audio.volume = BHUZ_LIVE_SOUND_CONFIG.volume;

        try {
          audio.load();
        } catch {
          // Silencioso.
        }

        audioElements.set(status, audio);
      });
    } catch {
      // Silencioso.
    }
  }

  async function warmUpAudio() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;

      const audioContext = new AudioContext();

      if (audioContext.state === "suspended" && typeof audioContext.resume === "function") {
        await audioContext.resume();
      }

      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();

      gain.gain.value = 0.0001;
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start();

      setTimeout(() => {
        oscillator.stop();
        audioContext.close();
      }, 45);
    } catch {
      // Silencioso.
    }
  }

  function vibrateSoftly(status) {
    if (!BHUZ_LIVE_SOUND_CONFIG.useVibrationOnMobile) return;
    if (!navigator || typeof navigator.vibrate !== "function") return;

    try {
      switch (normalizeOrderStatus(status)) {
        case "aceptado":
          navigator.vibrate([80, 45, 80]);
          break;
        case "preparando":
          navigator.vibrate([100]);
          break;
        case "en_camino":
          navigator.vibrate([80, 40, 80, 40, 80]);
          break;
        case "entregado":
          navigator.vibrate([120, 60, 120]);
          break;
        default:
          navigator.vibrate([80]);
      }
    } catch {
      // Silencioso.
    }
  }

  function playFallbackBeep(status) {
    if (!BHUZ_LIVE_SOUND_CONFIG.useSoftFallbackBeep) return;

    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;

      const audioContext = new AudioContext();

      if (audioContext.state === "suspended" && typeof audioContext.resume === "function") {
        audioContext.resume();
      }

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
      oscillator.frequency.value = statusFrequency[normalizeOrderStatus(status)] || 650;
      gain.gain.value = 0.065;

      oscillator.connect(gain);
      gain.connect(audioContext.destination);

      oscillator.start();
      setTimeout(() => {
        oscillator.stop();
        audioContext.close();
      }, 190);
    } catch {
      // Silencioso.
    }
  }

  function playStatusSound(status) {
    if (!BHUZ_LIVE_SOUND_CONFIG.enabled) return;

    const normalizedStatus = normalizeOrderStatus(status);
    const soundSrc = BHUZ_LIVE_SOUND_CONFIG.customSounds[normalizedStatus];

    vibrateSoftly(normalizedStatus);

    if (!audioUnlocked && hasSoundPermissionSaved()) {
      unlockAudioNow(false);
    }

    if (!audioUnlocked) {
      ensureSoundUnlockButton();
      return;
    }

    if (soundSrc) {
      try {
        let audio = audioElements.get(normalizedStatus);

        if (!audio) {
          audio = new Audio(soundSrc);
          audio.preload = "auto";
          audio.playsInline = true;
          audioElements.set(normalizedStatus, audio);
        }

        audio.pause();
        audio.currentTime = 0;
        audio.volume = BHUZ_LIVE_SOUND_CONFIG.volume;

        audio.play().catch(() => {
          playFallbackBeep(normalizedStatus);
        });

        return;
      } catch {
        playFallbackBeep(normalizedStatus);
        return;
      }
    }

    playFallbackBeep(normalizedStatus);
  }

  function getNotificationCopy(status) {
    const normalizedStatus = normalizeOrderStatus(status);

    return BHUZ_LIVE_STATUS_MESSAGES[normalizedStatus] || {
      badge: "ACTUALIZADO",
      title: "Pedido actualizado",
      highlight: "actualizado",
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
    }, 3200);
  }

  function showToast(order, previousStatus, nextStatus, options = {}) {
    if (typeof document === "undefined" || !document.body) return;

    const settings = {
      sound: options.sound !== false,
      activation: options.activation === true
    };

    const normalizedStatus = normalizeOrderStatus(nextStatus);
    const copy = settings.activation
      ? {
          badge: "SONIDOS ACTIVADOS",
          title: "BHUZ ya puede sonar",
          highlight: "sonar",
          message: "Cuando cambie el estado de tu pedido recibirás sonido y vibración."
        }
      : getNotificationCopy(normalizedStatus);

    const root = ensureRoot();

    const toast = document.createElement("div");
    toast.className = `bhuz-live-toast bhuz-live-${normalizedStatus}`;
    toast.style.setProperty("--bhuz-toast-duration", `${BHUZ_LIVE_SOUND_CONFIG.toastDurationMs}ms`);

    toast.innerHTML = `
      <div class="bhuz-live-icon-wrap">
        <div class="bhuz-live-icon">${settings.activation ? "🔊" : getStatusIcon(normalizedStatus)}</div>
      </div>

      <div class="bhuz-live-content">
        <div class="bhuz-live-badge">${escapeLiveHtml(copy.badge)}</div>
        <strong>${buildHighlightedTitle(copy.title, copy.highlight)}</strong>
        <span>${escapeLiveHtml(copy.message)}</span>
        <small>${escapeLiveHtml(order.restaurantName || order.restaurant?.name || "BHUZ")}</small>
      </div>

      <div class="bhuz-live-food">${settings.activation ? "✨" : getStatusFoodIcon(normalizedStatus)}</div>

      <button class="bhuz-live-close" type="button" aria-label="Cerrar notificación">×</button>
    `;

    root.appendChild(toast);

    const closeBtn = toast.querySelector(".bhuz-live-close");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => removeToast(toast));
    }

    setTimeout(() => removeToast(toast), BHUZ_LIVE_SOUND_CONFIG.toastDurationMs);

    if (settings.sound && !settings.activation) {
      playStatusSound(normalizedStatus);
    }

    if (!settings.activation) {
      glowOrderCard(order.id);
    }

    window.dispatchEvent(new CustomEvent("bhuz:order-status-changed", {
      detail: {
        order,
        previousStatus,
        nextStatus: normalizedStatus
      }
    }));
  }

  function showMiniActivationToast() {
    showToast(
      { id: "bhuz_sound_activation", restaurantName: "BHUZ" },
      "pendiente",
      "aceptado",
      {
        sound: false,
        activation: true
      }
    );
  }

  function removeToast(toast) {
    if (!toast || toast.classList.contains("is-hiding")) return;

    toast.classList.add("is-hiding");
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 260);
  }

  function buildHighlightedTitle(title, highlight) {
    const safeTitle = escapeLiveHtml(title);
    const safeHighlight = escapeLiveHtml(highlight || "");

    if (!safeHighlight) return safeTitle;

    const index = safeTitle.toLowerCase().indexOf(safeHighlight.toLowerCase());
    if (index < 0) return safeTitle;

    return (
      safeTitle.slice(0, index) +
      `<span class="bhuz-live-highlight">${safeTitle.slice(index, index + safeHighlight.length)}</span>` +
      safeTitle.slice(index + safeHighlight.length)
    );
  }

  function getStatusIcon(status) {
    switch (normalizeOrderStatus(status)) {
      case "aceptado":
        return "🛍️";
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

  function getStatusFoodIcon(status) {
    switch (normalizeOrderStatus(status)) {
      case "aceptado":
        return "🍔";
      case "preparando":
        return "🍲";
      case "listo":
        return "🥡";
      case "en_camino":
        return "🛵";
      case "entregado":
        return "✅";
      default:
        return "🍽️";
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

  function wasRecentlyNotified(orderId, status) {
    const key = `${String(orderId)}_${normalizeOrderStatus(status)}`;
    const lastTime = Number(notifiedCache.get(key) || 0);

    if (Date.now() - lastTime < 5000) {
      return true;
    }

    notifiedCache.set(key, Date.now());
    return false;
  }

  function processCustomerOrders(orders) {
    const customer = getCurrentCustomerForLive();

    // Seguridad: si esta página es de restaurante/admin, no mostrar popup al restaurante.
    if (!customer) return;

    if (!Array.isArray(orders)) return;

    const normalizedOrders = normalizeOrdersList(orders);

    normalizedOrders.forEach((order) => {
      const orderId = String(order.id || "");
      if (!orderId) return;

      const nextStatus = normalizeOrderStatus(order.status);
      const previousStatus = statusCache.get(orderId);

      if (
        firstCustomerSyncDone &&
        shouldNotify(previousStatus, nextStatus) &&
        !wasRecentlyNotified(orderId, nextStatus)
      ) {
        showToast(order, previousStatus, nextStatus);
      }

      statusCache.set(orderId, nextStatus);
    });

    saveStatusCacheToSession();
    firstCustomerSyncDone = true;
  }

  async function pollCustomerOrdersGlobally() {
    const customer = getCurrentCustomerForLive();

    if (!customer || !customer.email) return;

    if (lastCustomerEmailPolled && lastCustomerEmailPolled !== customer.email) {
      statusCache.clear();
      firstCustomerSyncDone = false;
      saveStatusCacheToSession();
    }

    lastCustomerEmailPolled = customer.email;

    try {
      const response = await fetch(
        `${DELI_ORDERS_API_URL}/orders/customer/${encodeURIComponent(customer.email)}?t=${Date.now()}`
      );

      const data = await response.json();

      if (response.ok && data.ok) {
        processCustomerOrders(normalizeOrdersList(data.orders));
      }
    } catch {
      // Silencioso para no ensuciar consola ni interrumpir UX.
    }
  }

  function startGlobalPolling() {
    if (globalPollingStarted) return;

    globalPollingStarted = true;

    readStatusCacheFromSession();

    if (statusCache.size > 0) {
      firstCustomerSyncDone = true;
    }

    ensureRoot();
    ensureSoundUnlockButton();

    setTimeout(pollCustomerOrdersGlobally, 900);
    setTimeout(pollCustomerOrdersGlobally, 3500);

    setInterval(pollCustomerOrdersGlobally, BHUZ_LIVE_SOUND_CONFIG.globalPollingMs);

    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        pollCustomerOrdersGlobally();
      }
    });

    window.addEventListener("focus", pollCustomerOrdersGlobally);
  }

  bindPassiveAudioUnlockEvents();

  window.addEventListener("deli:session-ready", () => {
    startGlobalPolling();
    pollCustomerOrdersGlobally();
  });

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", startGlobalPolling);
    } else {
      startGlobalPolling();
    }
  }

  return {
    processCustomerOrders,
    pollCustomerOrdersGlobally,
    playStatusSound,
    showToast,
    unlockAudioNow,
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







































































































































































































































































































































































