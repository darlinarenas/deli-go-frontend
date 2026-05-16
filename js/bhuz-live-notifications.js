/* ======================================================
   BHUZ LIVE NOTIFICATIONS GLOBAL
   Archivo completo listo para copiar y pegar

   OBJETIVO:
   - Activar notificaciones globales en index.
   - Hacer que la campanita tenga actividad real.
   - Mostrar tarjeta superior del último pedido activo.
   - Escuchar cambios de estado usando backend vía orders.js.
   - Mantener checkout, carrito, PostgreSQL y paneles sin romper.
   - Este archivo NO reemplaza orders.js: lo complementa.

   REQUISITOS:
   - index.html debe cargar este archivo después de js/orders.js.
   - orders.js debe exponer window.DELI_ORDERS.
====================================================== */

(function initBhuzGlobalLiveNotifications() {
  "use strict";

  /* ======================================================
     BLOQUE 1
     CONFIGURACIÓN GENERAL
  ====================================================== */
  const BHUZ_GLOBAL_LIVE_CONFIG = {
    pollingMs: 8000,
    firstLoadDelayMs: 700,
    orderSuccessParam: "orderSuccess",
    deliveredHoldMs: 9000
  };

  let pollingId = null;
  let firstSyncDone = false;
  let lastKnownOrderId = null;
  let lastKnownStatusByOrderId = new Map();
  let lastRenderedOrder = null;
  let unreadCount = 0;

  /* ======================================================
     BLOQUE 2
     HELPERS SEGUROS
  ====================================================== */
  function isIndexPage() {
    const path = String(window.location.pathname || "").toLowerCase();

    return (
      path.endsWith("/") ||
      path.endsWith("/index.html") ||
      path === "" ||
      path.includes("index.html")
    );
  }

  function getOrdersApi() {
    return window.DELI_ORDERS || null;
  }

  function getCurrentUserSafe() {
    const api = getOrdersApi();

    if (api && typeof api.getCurrentUser === "function") {
      return api.getCurrentUser();
    }

    return window.DELI_CURRENT_USER || null;
  }

  function normalizeStatusSafe(status) {
    const api = getOrdersApi();

    if (api && typeof api.normalizeOrderStatus === "function") {
      return api.normalizeOrderStatus(status);
    }

    return String(status || "pendiente").trim().toLowerCase();
  }

  function getStatusLabelSafe(status) {
    const api = getOrdersApi();

    if (api && typeof api.getStatusLabel === "function") {
      return api.getStatusLabel(status);
    }

    const normalized = normalizeStatusSafe(status);

    const labels = {
      pendiente: "Pendiente",
      aceptado: "Aceptado",
      preparando: "Preparando",
      listo: "Listo",
      en_camino: "En camino",
      entregado: "Entregado"
    };

    return labels[normalized] || "Pendiente";
  }

  function formatPriceSafe(value) {
    const api = getOrdersApi();

    if (api && typeof api.formatPrice === "function") {
      return api.formatPrice(value || 0);
    }

    const amount = Number(value || 0);

    try {
      return new Intl.NumberFormat("es-CL", {
        style: "currency",
        currency: "CLP",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(amount);
    } catch {
      return `$${amount}`;
    }
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function isActiveOrder(order) {
    if (!order) return false;

    const status = normalizeStatusSafe(order.status);

    return !["entregado", "cancelado", "cancelled", "canceled"].includes(status);
  }

  function sortOrdersNewestFirst(orders) {
    return [...orders].sort((a, b) => {
      const dateA = new Date(a.createdAt || a.date || 0).getTime();
      const dateB = new Date(b.createdAt || b.date || 0).getTime();

      return dateB - dateA;
    });
  }

  function getLatestOrder(orders) {
    if (!Array.isArray(orders) || !orders.length) return null;

    return sortOrdersNewestFirst(orders)[0] || null;
  }

  function getLatestActiveOrder(orders) {
    if (!Array.isArray(orders) || !orders.length) return null;

    return sortOrdersNewestFirst(orders).find(isActiveOrder) || null;
  }

  function getOrderItemsText(order) {
    const items = Array.isArray(order?.items) ? order.items : [];

    if (!items.length) return "Pedido realizado en BHUZ.";

    const firstItems = items.slice(0, 2).map((item) => {
      const qty = Number(item.qty || 1);
      return `${item.name || "Producto"} x${qty}`;
    });

    const extraCount = Math.max(items.length - 2, 0);
    const suffix = extraCount > 0 ? ` +${extraCount} más` : "";

    return `${firstItems.join(", ")}${suffix}`;
  }

  function getStatusMessage(order) {
    const status = normalizeStatusSafe(order?.status);
    const restaurant = order?.restaurantName || "el restaurante";

    switch (status) {
      case "pendiente":
        return `Tu pedido fue enviado a ${restaurant}. Estamos esperando confirmación.`;

      case "aceptado":
        return `${restaurant} aceptó tu pedido.`;

      case "preparando":
        return `${restaurant} está preparando tu comida.`;

      case "listo":
        return "Tu pedido está listo para salir.";

      case "en_camino":
        return "Tu pedido va en camino a tu ubicación.";

      case "entregado":
        return "Pedido entregado. Aquí tienes el resumen de tu compra.";

      default:
        return "Tu pedido fue actualizado.";
    }
  }

  function getStatusBadgeText(status) {
    const normalized = normalizeStatusSafe(status);

    if (normalized === "entregado") {
      return "✅ Pedido finalizado";
    }

    if (normalized === "en_camino") {
      return "🛵 Pedido activo";
    }

    if (normalized === "preparando") {
      return "👨‍🍳 Pedido activo";
    }

    if (normalized === "aceptado") {
      return "🟢 Pedido activo";
    }

    if (normalized === "listo") {
      return "🔥 Pedido activo";
    }

    return "🟢 Pedido activo";
  }

  function vibrateSoft() {
    try {
      if (navigator.vibrate) {
        navigator.vibrate([90, 45, 90]);
      }
    } catch {
      // Algunos navegadores no permiten vibración.
    }
  }

  /* ======================================================
     BLOQUE 3
     ELEMENTOS DEL DOM
  ====================================================== */
  function getLiveElements() {
    return {
      section: document.getElementById("bhuzLiveOrderSection"),
      restaurant: document.getElementById("bhuzLiveOrderRestaurant"),
      message: document.getElementById("bhuzLiveOrderMessage"),
      status: document.getElementById("bhuzLiveOrderStatus"),
      total: document.getElementById("bhuzLiveOrderTotal"),
      openBtn: document.getElementById("bhuzOpenOrdersBtn"),
      bellBtn: document.getElementById("openNotifications"),
      notificationsPanel: document.getElementById("notificationsPanel"),
      notificationList: document.querySelector("#notificationsPanel .notification-list")
    };
  }

  function ensureBellBadge(bellBtn) {
    if (!bellBtn) return null;

    let badge = bellBtn.querySelector(".bhuz-live-bell-badge");

    if (!badge) {
      badge = document.createElement("span");
      badge.className = "bhuz-live-bell-badge";
      bellBtn.appendChild(badge);
    }

    return badge;
  }

  function bindLiveOrderButton() {
    const elements = getLiveElements();

    if (!elements.openBtn || elements.openBtn.dataset.bhuzLiveBound === "1") return;

    elements.openBtn.dataset.bhuzLiveBound = "1";

    elements.openBtn.addEventListener("click", () => {
      window.location.href = "mis-pedidos.html";
    });
  }

  function bindNotificationBell() {
    const elements = getLiveElements();

    if (!elements.bellBtn || elements.bellBtn.dataset.bhuzLiveBellBound === "1") return;

    elements.bellBtn.dataset.bhuzLiveBellBound = "1";

    elements.bellBtn.addEventListener("click", () => {
      unreadCount = 0;
      updateBellState(false);
    });
  }

  /* ======================================================
     BLOQUE 4
     CAMPANITA ACTIVA
  ====================================================== */
  function updateBellState(hasActivity) {
    const elements = getLiveElements();
    const bellBtn = elements.bellBtn;

    if (!bellBtn) return;

    const badge = ensureBellBadge(bellBtn);

    if (hasActivity && unreadCount > 0) {
      bellBtn.classList.add("has-live-update");
      bellBtn.setAttribute("aria-label", `Notificaciones: ${unreadCount} actualización nueva`);

      if (badge) {
        badge.textContent = String(unreadCount > 9 ? "9+" : unreadCount);
        badge.style.display = "inline-flex";
      }

      return;
    }

    bellBtn.classList.remove("has-live-update");
    bellBtn.setAttribute("aria-label", "Notificaciones");

    if (badge) {
      badge.textContent = "";
      badge.style.display = "none";
    }
  }

  function markBellActivity() {
    unreadCount += 1;
    updateBellState(true);
  }

  /* ======================================================
     BLOQUE 5
     PANEL DE NOTIFICACIONES
  ====================================================== */
  function renderNotificationPanel(order) {
    const elements = getLiveElements();

    if (!elements.notificationList) return;

    if (!order) {
      elements.notificationList.innerHTML = `
        <a href="mis-pedidos.html" class="notification-card">
          <strong>🛍️ Mis pedidos</strong>
          <span>Consulta estado, historial y detalles.</span>
        </a>

        <div class="notification-card muted">
          <strong>🔔 Avisos BHUZ</strong>
          <span>Cuando tengas un pedido activo, aquí verás su estado en tiempo real.</span>
        </div>
      `;
      return;
    }

    const statusLabel = getStatusLabelSafe(order.status);
    const message = getStatusMessage(order);
    const itemsText = getOrderItemsText(order);
    const totalText = formatPriceSafe(order.total || 0);

    elements.notificationList.innerHTML = `
      <a href="mis-pedidos.html" class="notification-card">
        <strong>🛍️ Ver mis pedidos</strong>
        <span>Consulta el detalle completo y el historial.</span>
      </a>

      <div class="notification-card">
        <strong>🔔 Último pedido: ${escapeHtml(statusLabel)}</strong>
        <span>${escapeHtml(order.restaurantName || "Restaurante")}</span>
        <span>${escapeHtml(message)}</span>
      </div>

      <div class="notification-card">
        <strong>🧾 Resumen</strong>
        <span>${escapeHtml(itemsText)}</span>
        <span>Total: ${escapeHtml(totalText)}</span>
      </div>
    `;
  }

  /* ======================================================
     BLOQUE 6
     TARJETA GLOBAL SUPERIOR
  ====================================================== */
  function renderLiveOrderCard(order, options = {}) {
    const elements = getLiveElements();

    if (!elements.section) return;

    if (!order) {
      elements.section.style.display = "none";
      lastRenderedOrder = null;
      renderNotificationPanel(null);
      return;
    }

    const status = normalizeStatusSafe(order.status);
    const statusLabel = getStatusLabelSafe(status);
    const totalText = formatPriceSafe(order.total || 0);
    const restaurantName = order.restaurantName || "Restaurante";
    const message = options.forceDeliveredSummary
      ? `Pedido entregado: ${getOrderItemsText(order)}`
      : getStatusMessage(order);

    elements.section.style.display = "block";

    const badge = elements.section.querySelector(".bhuz-live-order-badge");

    if (badge) {
      badge.textContent = getStatusBadgeText(status);
    }

    if (elements.restaurant) {
      elements.restaurant.textContent = restaurantName;
    }

    if (elements.message) {
      elements.message.textContent = message;
    }

    if (elements.status) {
      elements.status.textContent = statusLabel;
    }

    if (elements.total) {
      elements.total.textContent = totalText;
    }

    if (elements.openBtn) {
      elements.openBtn.textContent = status === "entregado" ? "Ver resumen" : "Ver pedido";
    }

    if (options.animate) {
      elements.section.classList.remove("bhuz-live-order-updated");
      void elements.section.offsetWidth;
      elements.section.classList.add("bhuz-live-order-updated");

      setTimeout(() => {
        elements.section.classList.remove("bhuz-live-order-updated");
      }, 2200);
    }

    lastRenderedOrder = order;
    renderNotificationPanel(order);
  }

  /* ======================================================
     BLOQUE 7
     EVENTOS LIVE DEL orders.js
  ====================================================== */
  function bindLiveStatusEvents() {
    if (window.__BHUZ_GLOBAL_LIVE_EVENTS_BOUND__) return;
    window.__BHUZ_GLOBAL_LIVE_EVENTS_BOUND__ = true;

    window.addEventListener("bhuz:order-status-changed", (event) => {
      const detail = event.detail || {};
      const order = detail.order || null;

      if (!order) return;

      const nextStatus = normalizeStatusSafe(detail.nextStatus || order.status);

      markBellActivity();
      vibrateSoft();

      renderLiveOrderCard(
        {
          ...order,
          status: nextStatus
        },
        {
          animate: true,
          forceDeliveredSummary: nextStatus === "entregado"
        }
      );

      if (nextStatus === "entregado") {
        setTimeout(() => {
          fetchAndRenderLatestOrder(true);
        }, BHUZ_GLOBAL_LIVE_CONFIG.deliveredHoldMs);
      }
    });
  }

  /* ======================================================
     BLOQUE 8
     LECTURA DE PEDIDOS DESDE BACKEND
  ====================================================== */
  async function fetchCustomerOrders() {
    const api = getOrdersApi();

    if (!api || typeof api.getOrdersByCustomer !== "function") {
      return [];
    }

    const currentUser = getCurrentUserSafe();

    if (!currentUser || !currentUser.email) {
      return [];
    }

    const orders = await api.getOrdersByCustomer(currentUser.email);

    return Array.isArray(orders) ? orders : [];
  }

  async function fetchAndRenderLatestOrder(forceShowLatest = false) {
    const orders = await fetchCustomerOrders();

    if (!orders.length) {
      renderLiveOrderCard(null);
      return;
    }

    const latestActive = getLatestActiveOrder(orders);
    const latestAny = getLatestOrder(orders);
    const orderToRender = latestActive || (forceShowLatest ? latestAny : null);

    if (!orderToRender) {
      renderLiveOrderCard(null);
      return;
    }

    const orderId = String(orderToRender.id || "");
    const status = normalizeStatusSafe(orderToRender.status);
    const previousStatus = lastKnownStatusByOrderId.get(orderId);

    if (firstSyncDone && previousStatus && previousStatus !== status) {
      markBellActivity();
      vibrateSoft();
      renderLiveOrderCard(orderToRender, {
        animate: true,
        forceDeliveredSummary: status === "entregado"
      });
    } else {
      renderLiveOrderCard(orderToRender, {
        animate: lastKnownOrderId !== orderId
      });
    }

    lastKnownOrderId = orderId;

    orders.forEach((order) => {
      if (!order || !order.id) return;

      lastKnownStatusByOrderId.set(
        String(order.id),
        normalizeStatusSafe(order.status)
      );
    });

    firstSyncDone = true;
  }

  function startPolling() {
    if (pollingId) return;

    pollingId = setInterval(() => {
      fetchAndRenderLatestOrder(false);
    }, BHUZ_GLOBAL_LIVE_CONFIG.pollingMs);
  }

  /* ======================================================
     BLOQUE 9
     POST CHECKOUT / ORDER SUCCESS
     - Si el checkout redirige a index.html?orderSuccess=1,
       este bloque muestra la tarjeta resumen al llegar al index.
  ====================================================== */
  function hasOrderSuccessParam() {
    const params = new URLSearchParams(window.location.search || "");
    return params.get(BHUZ_GLOBAL_LIVE_CONFIG.orderSuccessParam) === "1";
  }

  function cleanOrderSuccessParam() {
    const url = new URL(window.location.href);
    url.searchParams.delete(BHUZ_GLOBAL_LIVE_CONFIG.orderSuccessParam);

    window.history.replaceState({}, document.title, url.toString());
  }

  async function handleOrderSuccessLanding() {
    if (!hasOrderSuccessParam()) return;

    await fetchAndRenderLatestOrder(true);

    const elements = getLiveElements();

    if (elements.section) {
      elements.section.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
    }

    markBellActivity();

    if (lastRenderedOrder && window.BHUZ_LIVE_NOTIFICATIONS?.showToast) {
      window.BHUZ_LIVE_NOTIFICATIONS.showToast(
        lastRenderedOrder,
        null,
        lastRenderedOrder.status || "pendiente"
      );
    }

    cleanOrderSuccessParam();
  }

  /* ======================================================
     BLOQUE 10
     ESPERAR DEPENDENCIAS
  ====================================================== */
  function waitForOrdersApi(callback, attempts = 0) {
    const api = getOrdersApi();

    if (api && typeof api.getOrdersByCustomer === "function") {
      callback();
      return;
    }

    if (attempts >= 30) {
      console.warn("BHUZ LIVE GLOBAL: No se encontró window.DELI_ORDERS.");
      return;
    }

    setTimeout(() => {
      waitForOrdersApi(callback, attempts + 1);
    }, 250);
  }

  function boot() {
    if (!isIndexPage()) return;

    bindLiveOrderButton();
    bindNotificationBell();
    bindLiveStatusEvents();

    waitForOrdersApi(async () => {
      setTimeout(async () => {
        await handleOrderSuccessLanding();
        await fetchAndRenderLatestOrder(false);
        startPolling();
      }, BHUZ_GLOBAL_LIVE_CONFIG.firstLoadDelayMs);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  /* ======================================================
     BLOQUE 11
     API GLOBAL DE DEPURACIÓN SEGURA
  ====================================================== */
  window.BHUZ_GLOBAL_LIVE = {
    refresh: fetchAndRenderLatestOrder,
    renderLiveOrderCard,
    markBellActivity,
    config: BHUZ_GLOBAL_LIVE_CONFIG
  };
})();
