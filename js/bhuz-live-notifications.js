/* ======================================================
   BHUZ LIVE NOTIFICATIONS GLOBAL
   Archivo completo listo para copiar y pegar

   OBJETIVO:
   - Activar notificaciones globales en index.
   - Hacer que la campanita tenga actividad real.
   - Mostrar tarjeta superior del último pedido activo.
   - Mostrar resumen del pedido después del checkout.
   - Escuchar cambios de estado usando backend vía orders.js.
   - Mantener checkout, carrito, PostgreSQL y paneles sin romper.

   IMPORTANTE:
   - Este archivo debe cargarse en index.html después de js/orders.js.
   - Este archivo NO reemplaza orders.js: lo complementa.
====================================================== */

(function initBhuzGlobalLiveNotifications() {
  "use strict";

  const BHUZ_GLOBAL_LIVE_CONFIG = {
    apiUrl: "https://deligo-backend-i554.onrender.com",
    pollingMs: 8000,
    bootDelayMs: 500,
    retryMs: 700,
    maxBootRetries: 18,
    orderSuccessParam: "orderSuccess",
    orderIdParam: "orderId",
    deliveredHoldMs: 9000
  };

  let pollingId = null;
  let firstSyncDone = false;
  let lastKnownOrderId = null;
  let lastKnownStatusByOrderId = new Map();
  let lastRenderedOrder = null;
  let unreadCount = 0;
  let bootRetries = 0;

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

    const normalized = String(status || "pendiente").trim().toLowerCase();

    if (normalized === "pending") return "pendiente";
    if (normalized === "accepted") return "aceptado";
    if (normalized === "preparing") return "preparando";
    if (normalized === "ready") return "listo";
    if (normalized === "on_the_way" || normalized === "on-the-way" || normalized === "en camino") return "en_camino";
    if (normalized === "delivered" || normalized === "completed" || normalized === "finished") return "entregado";

    return normalized || "pendiente";
  }

  function getStatusLabelSafe(status) {
    const api = getOrdersApi();

    if (api && typeof api.getStatusLabel === "function") {
      return api.getStatusLabel(status);
    }

    const labels = {
      pendiente: "Pendiente",
      aceptado: "Aceptado",
      preparando: "Preparando",
      listo: "Listo",
      en_camino: "En camino",
      entregado: "Entregado"
    };

    return labels[normalizeStatusSafe(status)] || "Pendiente";
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

  function getUrlParam(name) {
    const params = new URLSearchParams(window.location.search || "");
    return String(params.get(name) || "").trim();
  }

  function hasOrderSuccessParam() {
    return getUrlParam(BHUZ_GLOBAL_LIVE_CONFIG.orderSuccessParam) === "1";
  }

  function getSuccessOrderId() {
    return getUrlParam(BHUZ_GLOBAL_LIVE_CONFIG.orderIdParam);
  }

  function cleanOrderSuccessParams() {
    const url = new URL(window.location.href);

    url.searchParams.delete(BHUZ_GLOBAL_LIVE_CONFIG.orderSuccessParam);
    url.searchParams.delete(BHUZ_GLOBAL_LIVE_CONFIG.orderIdParam);

    window.history.replaceState({}, document.title, url.toString());
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

  function getOrderById(orders, orderId) {
    if (!Array.isArray(orders) || !orderId) return null;

    return orders.find((order) => String(order.id || "") === String(orderId)) || null;
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

  function getStatusMessage(order, isPostCheckout = false) {
    const status = normalizeStatusSafe(order?.status);
    const restaurant = order?.restaurantName || "el restaurante";

    if (isPostCheckout) {
      return `Pedido confirmado: ${getOrderItemsText(order)}`;
    }

    switch (status) {
      case "pendiente":
        return `Tu pedido fue enviado a ${restaurant}. Esperando confirmación.`;
      case "aceptado":
        return `${restaurant} aceptó tu pedido.`;
      case "preparando":
        return `${restaurant} está preparando tu comida.`;
      case "listo":
        return "Tu pedido está listo para salir.";
      case "en_camino":
        return "Tu pedido va en camino a tu ubicación.";
      case "entregado":
        return `Pedido entregado: ${getOrderItemsText(order)}`;
      default:
        return "Tu pedido fue actualizado.";
    }
  }

  function getStatusBadgeText(status, isPostCheckout = false) {
    if (isPostCheckout) return "✅ Pedido confirmado";

    const normalized = normalizeStatusSafe(status);

    if (normalized === "entregado") return "✅ Pedido finalizado";
    if (normalized === "en_camino") return "🛵 Pedido activo";
    if (normalized === "preparando") return "👨‍🍳 Pedido activo";
    if (normalized === "aceptado") return "🟢 Pedido activo";
    if (normalized === "listo") return "🔥 Pedido activo";

    return "🟢 Pedido activo";
  }

  function getStatusIcon(status) {
    switch (normalizeStatusSafe(status)) {
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

  function vibrateSoft() {
    try {
      if (navigator.vibrate) {
        navigator.vibrate([90, 45, 90]);
      }
    } catch {
      // Silencioso.
    }
  }

  function getLiveElements() {
    return {
      section: document.getElementById("bhuzLiveOrderSection"),
      restaurant: document.getElementById("bhuzLiveOrderRestaurant"),
      message: document.getElementById("bhuzLiveOrderMessage"),
      status: document.getElementById("bhuzLiveOrderStatus"),
      total: document.getElementById("bhuzLiveOrderTotal"),
      openBtn: document.getElementById("bhuzOpenOrdersBtn"),
      bellBtn: document.getElementById("openNotifications"),
      notificationList: document.querySelector("#notificationsPanel .notification-list")
    };
  }

  function ensureLiveToastRoot() {
    let root = document.getElementById("bhuzLiveRoot");

    if (!root) {
      root = document.createElement("div");
      root.id = "bhuzLiveRoot";
      root.className = "bhuz-live-root";
      document.body.appendChild(root);
    }

    return root;
  }

  function showGlobalToast(order, nextStatus, options = {}) {
    if (!document.body || !order) return;

    if (window.BHUZ_LIVE_NOTIFICATIONS && typeof window.BHUZ_LIVE_NOTIFICATIONS.showToast === "function" && !options.forceOwnToast) {
      window.BHUZ_LIVE_NOTIFICATIONS.showToast(order, options.previousStatus || null, nextStatus || order.status);
      return;
    }

    const normalizedStatus = normalizeStatusSafe(nextStatus || order.status);
    const root = ensureLiveToastRoot();
    const toast = document.createElement("div");

    const title = options.title || (
      options.isPostCheckout
        ? "Pedido confirmado"
        : `Pedido ${getStatusLabelSafe(normalizedStatus).toLowerCase()}`
    );

    const message = options.message || getStatusMessage(order, options.isPostCheckout);

    toast.className = `bhuz-live-toast bhuz-live-${normalizedStatus}`;
    toast.innerHTML = `
      <div class="bhuz-live-icon">${getStatusIcon(normalizedStatus)}</div>
      <div class="bhuz-live-content">
        <strong>${escapeHtml(title)}</strong>
        <span>${escapeHtml(message)}</span>
        <small>${escapeHtml(order.restaurantName || "BHUZ")}</small>
      </div>
      <button class="bhuz-live-close" type="button" aria-label="Cerrar notificación">×</button>
    `;

    root.appendChild(toast);

    toast.querySelector(".bhuz-live-close")?.addEventListener("click", () => removeToast(toast));

    setTimeout(() => removeToast(toast), 6500);
  }

  function removeToast(toast) {
    if (!toast || toast.classList.contains("is-hiding")) return;

    toast.classList.add("is-hiding");

    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 260);
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

  function updateBellState(hasActivity) {
    const { bellBtn } = getLiveElements();

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

  function bindStaticLiveActions() {
    const { openBtn, bellBtn } = getLiveElements();

    if (openBtn && openBtn.dataset.bhuzLiveBound !== "1") {
      openBtn.dataset.bhuzLiveBound = "1";
      openBtn.addEventListener("click", () => {
        window.location.href = "mis-pedidos.html";
      });
    }

    if (bellBtn && bellBtn.dataset.bhuzLiveBellBound !== "1") {
      bellBtn.dataset.bhuzLiveBellBound = "1";
      bellBtn.addEventListener("click", () => {
        unreadCount = 0;
        updateBellState(false);
      });
    }
  }

  function renderNotificationPanel(order, isPostCheckout = false) {
    const { notificationList } = getLiveElements();

    if (!notificationList) return;

    if (!order) {
      notificationList.innerHTML = `
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
    const message = getStatusMessage(order, isPostCheckout);
    const itemsText = getOrderItemsText(order);
    const totalText = formatPriceSafe(order.total || 0);

    notificationList.innerHTML = `
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

  function renderLiveOrderCard(order, options = {}) {
    const elements = getLiveElements();

    if (!elements.section) {
      console.warn("BHUZ LIVE GLOBAL: Falta #bhuzLiveOrderSection en index.html.");
      return;
    }

    if (!order) {
      elements.section.style.display = "none";
      lastRenderedOrder = null;
      renderNotificationPanel(null);
      return;
    }

    const status = normalizeStatusSafe(order.status);
    const restaurantName = order.restaurantName || "Restaurante";
    const message = getStatusMessage(order, Boolean(options.isPostCheckout));

    elements.section.style.display = "block";

    const badge = elements.section.querySelector(".bhuz-live-order-badge");

    if (badge) {
      badge.textContent = getStatusBadgeText(status, Boolean(options.isPostCheckout));
    }

    if (elements.restaurant) elements.restaurant.textContent = restaurantName;
    if (elements.message) elements.message.textContent = message;
    if (elements.status) elements.status.textContent = getStatusLabelSafe(status);
    if (elements.total) elements.total.textContent = formatPriceSafe(order.total || 0);

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
    renderNotificationPanel(order, Boolean(options.isPostCheckout));
  }

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

  async function fetchOrdersFallbackFromBackend() {
    try {
      const response = await fetch(`${BHUZ_GLOBAL_LIVE_CONFIG.apiUrl}/orders?t=${Date.now()}`, {
        method: "GET",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json"
        }
      });

      if (!response.ok) return [];

      const data = await response.json();

      if (Array.isArray(data)) return data;
      if (data && Array.isArray(data.orders)) return data.orders;

      return [];
    } catch (error) {
      console.warn("BHUZ LIVE GLOBAL: No se pudo usar fallback /orders.", error);
      return [];
    }
  }

  async function fetchOrderForSuccess() {
    const orderId = getSuccessOrderId();

    let orders = await fetchCustomerOrders();

    if (orderId) {
      const foundByCustomer = getOrderById(orders, orderId);

      if (foundByCustomer) return foundByCustomer;
    }

    if (orders.length) {
      return getLatestOrder(orders);
    }

    if (orderId) {
      const fallbackOrders = await fetchOrdersFallbackFromBackend();
      return getOrderById(fallbackOrders, orderId);
    }

    return null;
  }

  async function fetchAndRenderLatestOrder(forceShowLatest = false) {
    const orders = await fetchCustomerOrders();

    if (!orders.length) {
      if (!forceShowLatest) renderLiveOrderCard(null);
      return null;
    }

    const latestActive = getLatestActiveOrder(orders);
    const latestAny = getLatestOrder(orders);
    const orderToRender = latestActive || (forceShowLatest ? latestAny : null);

    if (!orderToRender) {
      renderLiveOrderCard(null);
      return null;
    }

    const orderId = String(orderToRender.id || "");
    const status = normalizeStatusSafe(orderToRender.status);
    const previousStatus = lastKnownStatusByOrderId.get(orderId);

    if (firstSyncDone && previousStatus && previousStatus !== status) {
      markBellActivity();
      vibrateSoft();

      renderLiveOrderCard(orderToRender, {
        animate: true,
        isPostCheckout: status === "entregado"
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

    return orderToRender;
  }

  async function handleOrderSuccessLanding() {
    if (!hasOrderSuccessParam()) return false;

    const order = await fetchOrderForSuccess();

    if (!order) {
      console.warn("BHUZ LIVE GLOBAL: Se llegó al index con orderSuccess=1, pero no se encontró el pedido.");
      cleanOrderSuccessParams();
      return false;
    }

    renderLiveOrderCard(order, {
      animate: true,
      isPostCheckout: true
    });

    markBellActivity();
    vibrateSoft();

    showGlobalToast(order, order.status || "pendiente", {
      isPostCheckout: true,
      title: "Pedido confirmado",
      message: getStatusMessage(order, true),
      forceOwnToast: false
    });

    setTimeout(() => {
      const { section } = getLiveElements();

      if (section) {
        section.scrollIntoView({
          behavior: "smooth",
          block: "center"
        });
      }
    }, 350);

    cleanOrderSuccessParams();
    return true;
  }

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
          isPostCheckout: nextStatus === "entregado"
        }
      );

      if (nextStatus === "entregado") {
        setTimeout(() => {
          fetchAndRenderLatestOrder(true);
        }, BHUZ_GLOBAL_LIVE_CONFIG.deliveredHoldMs);
      }
    });
  }

  function startPolling() {
    if (pollingId) return;

    pollingId = setInterval(() => {
      fetchAndRenderLatestOrder(false);
    }, BHUZ_GLOBAL_LIVE_CONFIG.pollingMs);
  }

  function canBootNow() {
    const api = getOrdersApi();
    const elements = getLiveElements();

    return Boolean(
      api &&
      typeof api.getOrdersByCustomer === "function" &&
      elements.section
    );
  }

  function bootLive() {
    if (!isIndexPage()) return;

    bindStaticLiveActions();
    bindLiveStatusEvents();

    if (!canBootNow()) {
      bootRetries += 1;

      if (bootRetries <= BHUZ_GLOBAL_LIVE_CONFIG.maxBootRetries) {
        setTimeout(bootLive, BHUZ_GLOBAL_LIVE_CONFIG.retryMs);
      } else {
        console.warn("BHUZ LIVE GLOBAL: No se pudo iniciar. Revisa que index tenga la card LIVE y cargue orders.js antes de bhuz-live-notifications.js.");
      }

      return;
    }

    setTimeout(async () => {
      const handledSuccess = await handleOrderSuccessLanding();

      if (!handledSuccess) {
        await fetchAndRenderLatestOrder(false);
      }

      startPolling();
    }, BHUZ_GLOBAL_LIVE_CONFIG.bootDelayMs);
  }

  window.addEventListener("deli:session-ready", () => {
    bootRetries = 0;
    bootLive();
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootLive);
  } else {
    bootLive();
  }

  window.BHUZ_GLOBAL_LIVE = {
    refresh: fetchAndRenderLatestOrder,
    renderLiveOrderCard,
    markBellActivity,
    showGlobalToast,
    config: BHUZ_GLOBAL_LIVE_CONFIG
  };
})();

