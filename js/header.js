/* ======================================================
   BHUZ / DELI GO - HEADER.JS
   Archivo completo listo para copiar y pegar

   OBJETIVO:
   - Mantener login/sesión actual de auth.js.
   - Hacer funcional menú hamburguesa.
   - Hacer funcional campanita / pedidos.
   - Hacer funcional perfil / login.
   - Mantener backend y PostgreSQL sin cambios.
====================================================== */

document.addEventListener("DOMContentLoaded", () => {
  const userNav = document.getElementById("userNav");

  const backdrop = document.getElementById("bhuzBackdrop");
  const drawer = document.getElementById("bhuzDrawer");
  const notificationsPanel = document.getElementById("notificationsPanel");
  const profilePanel = document.getElementById("profilePanel");
  const profileActionsPanel = document.getElementById("profileActionsPanel");
  const drawerLinks = document.querySelector(".drawer-links");

  const openSideMenu = document.getElementById("openSideMenu");
  const closeSideMenu = document.getElementById("closeSideMenu");
  const openNotifications = document.getElementById("openNotifications");
  const closeNotifications = document.getElementById("closeNotifications");
  const openProfileMenu = document.getElementById("openProfileMenu");
  const closeProfilePanel = document.getElementById("closeProfilePanel");

  const bottomSearchBtn = document.getElementById("bottomSearchBtn");
  const bottomFavoritesBtn = document.getElementById("bottomFavoritesBtn");
  const bottomProfileBtn = document.getElementById("bottomProfileBtn");

  const bhuzLastOrderCard = document.getElementById("bhuzLastOrderCard");
  const bhuzLastOrderTitle = document.getElementById("bhuzLastOrderTitle");
  const bhuzLastOrderText = document.getElementById("bhuzLastOrderText");
  const bhuzLastOrderRestaurant = document.getElementById("bhuzLastOrderRestaurant");
  const bhuzLastOrderStatus = document.getElementById("bhuzLastOrderStatus");
  const bhuzLastOrderTotal = document.getElementById("bhuzLastOrderTotal");
  const bhuzLastOrderTime = document.getElementById("bhuzLastOrderTime");
  const bhuzLastOrderProducts = document.getElementById("bhuzLastOrderProducts");
  const bhuzLastOrderCountdown = document.getElementById("bhuzLastOrderCountdown");
  const bhuzLastOrderClose = document.getElementById("bhuzLastOrderClose");
  const bhuzActivateSoundBtn = document.getElementById("bhuzActivateSoundBtn");
  const bhuzNotificationSoundBtn = document.getElementById("bhuzNotificationSoundBtn");
  const bhuzGlobalSoundBtn = document.getElementById("bhuzGlobalSoundBtn");
  let bhuzLastOrderTimer = null;

  /* ======================================================
     BHUZ LIVE GLOBAL - CAMPANITA / INDEX
     - Módulo aislado del carrito y checkout.
     - Escucha eventos emitidos por orders.js.
     - Hace polling seguro SOLO para el cliente logueado.
     - Usa sessionStorage solo como memoria temporal de UI.
  ====================================================== */
  const notificationBadge = document.getElementById("notificationBadge");
  const notificationsList = document.getElementById("notificationsList");
  const LIVE_NOTIFICATIONS_KEY = "bhuzLiveNotifications";
  const LIVE_LAST_ORDER_KEY = "bhuzLastOrderSummary";
  const LIVE_POLL_MS = 7000;

  let liveNotifications = readLiveNotifications();
  let livePollTimer = null;
  let livePollRunning = false;

  function readLiveNotifications() {
    try {
      const saved = sessionStorage.getItem(LIVE_NOTIFICATIONS_KEY);
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  function saveLiveNotifications() {
    try {
      sessionStorage.setItem(LIVE_NOTIFICATIONS_KEY, JSON.stringify(liveNotifications.slice(0, 20)));
    } catch (error) {
      console.warn("No se pudieron guardar notificaciones temporales BHUZ:", error);
    }
  }

  function escapeLiveText(text) {
    return String(text || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function getOrderStatusLabel(status) {
    if (window.DELI_ORDERS && typeof window.DELI_ORDERS.getStatusLabel === "function") {
      return window.DELI_ORDERS.getStatusLabel(status);
    }

    const normalized = String(status || "pendiente").replaceAll("_", " ");
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }

  function getOrderStatusIcon(status) {
    const value = String(status || "").toLowerCase();

    if (value.includes("acept")) return "✅";
    if (value.includes("prepar")) return "👨‍🍳";
    if (value.includes("list")) return "🔥";
    if (value.includes("camino")) return "🛵";
    if (value.includes("entreg")) return "🎉";

    return "🔔";
  }

  function updateNotificationBadge() {
    if (!notificationBadge) return;

    const count = liveNotifications.length;

    if (!count) {
      notificationBadge.style.display = "none";
      notificationBadge.textContent = "0";
      return;
    }

    notificationBadge.style.display = "flex";
    notificationBadge.textContent = count > 9 ? "9+" : String(count);
  }

  function renderNotificationsPanel() {
    if (!notificationsList) return;

    const baseCard = `
      <a href="mis-pedidos.html" class="notification-card">
        <strong>🛍️ Mis pedidos</strong>
        <span>Consulta estado, historial y detalles.</span>
      </a>
    `;

    if (!liveNotifications.length) {
      notificationsList.innerHTML = `
        ${baseCard}
        <div class="notification-card muted">
          <strong>🔔 Avisos BHUZ</strong>
          <span>Cuando tu pedido cambie de estado, aparecerá aquí automáticamente.</span>
        </div>
      `;
      return;
    }

    const liveHtml = liveNotifications.map((item) => {
      const icon = getOrderStatusIcon(item.status);
      const statusLabel = getOrderStatusLabel(item.status);
      const title = item.type === "created" ? "Pedido confirmado" : "Pedido actualizado";
      const message = item.type === "created"
        ? "Tu pedido fue enviado correctamente. Puedes seguirlo en Mis pedidos."
        : `Tu pedido ahora está ${statusLabel.toLowerCase()}.`;

      return `
        <button type="button" class="notification-card live notification-card-action" data-notification-key="${escapeLiveText(item.uniqueKey || "")}" title="Marcar como visto">
          <strong>${icon} ${escapeLiveText(title)}</strong>
          <span>${escapeLiveText(message)}</span>
          <small>${escapeLiveText(item.restaurantName || "BHUZ")} · Pedido ${escapeLiveText(item.orderId || "")}</small>
          <em>Marcar como visto</em>
        </button>
      `;
    }).join("");

    notificationsList.innerHTML = `${liveHtml}${baseCard}`;
  }

  function markNotificationAsRead(uniqueKey) {
    if (!uniqueKey) return;

    const beforeLength = liveNotifications.length;
    liveNotifications = liveNotifications.filter((item) => item.uniqueKey !== uniqueKey);

    if (liveNotifications.length === beforeLength) return;

    saveLiveNotifications();
    renderNotificationsPanel();
    updateNotificationBadge();
  }

  function bindNotificationsListActions() {
    if (!notificationsList) return;

    notificationsList.addEventListener("click", (event) => {
      const actionCard = event.target.closest(".notification-card-action");
      if (!actionCard) return;

      event.preventDefault();
      markNotificationAsRead(actionCard.dataset.notificationKey || "");
    });
  }

  function pushLiveNotification(data) {
    if (!data || !data.orderId) return;

    const uniqueKey = `${data.type || "status"}:${data.orderId}:${data.status || ""}`;

    const alreadyExists = liveNotifications.some((item) => item.uniqueKey === uniqueKey);
    if (alreadyExists) return;

    liveNotifications.unshift({
      uniqueKey,
      type: data.type || "status",
      orderId: String(data.orderId),
      restaurantName: data.restaurantName || "BHUZ",
      status: data.status || "pendiente",
      createdAt: Date.now()
    });

    liveNotifications = liveNotifications.slice(0, 20);
    saveLiveNotifications();
    renderNotificationsPanel();
    updateNotificationBadge();
  }

  function readLastCreatedOrderFromSession() {
    try {
      const saved = sessionStorage.getItem(LIVE_LAST_ORDER_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch (error) {
      return null;
    }
  }

  function hydrateLastCreatedOrder() {
    const lastOrder = readLastCreatedOrderFromSession();
    if (!lastOrder || !lastOrder.id) return;

    pushLiveNotification({
      type: "created",
      orderId: lastOrder.id,
      restaurantName: lastOrder.restaurantName || "BHUZ",
      status: lastOrder.status || "pendiente"
    });
  }

  function bindLiveOrderEvents() {
    window.addEventListener("bhuz:order-created", (event) => {
      const order = event.detail?.order || null;
      if (!order || !order.id) return;

      pushLiveNotification({
        type: "created",
        orderId: order.id,
        restaurantName: order.restaurantName || order.restaurant?.name || "BHUZ",
        status: order.status || "pendiente"
      });
    });

    window.addEventListener("bhuz:order-status-changed", (event) => {
      const detail = event.detail || {};
      const order = detail.order || null;
      if (!order || !order.id) return;

      pushLiveNotification({
        type: "status",
        orderId: order.id,
        restaurantName: order.restaurantName || order.restaurant?.name || "BHUZ",
        status: detail.nextStatus || order.status || "pendiente"
      });
    });
  }

  async function pollCustomerOrdersForIndex() {
    if (livePollRunning) return;

    const currentUser = currentUserSafe();

    if (!currentUser || currentUser.role === "restaurant" || !currentUser.email) {
      return;
    }

    if (!window.DELI_ORDERS || typeof window.DELI_ORDERS.getOrdersByCustomer !== "function") {
      return;
    }

    livePollRunning = true;

    try {
      await window.DELI_ORDERS.getOrdersByCustomer(currentUser.email);
    } catch (error) {
      console.warn("No se pudo actualizar LIVE en index:", error);
    } finally {
      livePollRunning = false;
    }
  }

  function startLivePolling() {
    if (livePollTimer) {
      clearInterval(livePollTimer);
      livePollTimer = null;
    }

    const currentUser = currentUserSafe();

    if (!currentUser || currentUser.role === "restaurant" || !currentUser.email) {
      return;
    }

    pollCustomerOrdersForIndex();
    livePollTimer = setInterval(pollCustomerOrdersForIndex, LIVE_POLL_MS);
  }

  /* ======================================================
     CAMBIO BHUZ LIVE INDEX
     - Muestra resumen corto de la última compra al volver al index.
     - Desaparece automáticamente en 15 segundos o al pulsar X.
     - Usa sessionStorage solo como memoria temporal de UI.
  ====================================================== */
  function hasOrderSuccessParam() {
    const params = new URLSearchParams(window.location.search || "");
    return params.get("orderSuccess") === "1";
  }

  function cleanOrderSuccessUrl() {
    if (!hasOrderSuccessParam()) return;

    const url = new URL(window.location.href);
    url.searchParams.delete("orderSuccess");
    url.searchParams.delete("orderId");
    window.history.replaceState({}, document.title, url.toString());
  }

  function readTemporaryLastOrder() {
    try {
      const created = sessionStorage.getItem("bhuzLastCreatedOrder");
      if (created) return JSON.parse(created);

      const summary = sessionStorage.getItem(LIVE_LAST_ORDER_KEY);
      if (summary) return JSON.parse(summary);
    } catch (error) {
      console.warn("No se pudo leer el resumen temporal del último pedido:", error);
    }

    return null;
  }

  function formatLivePrice(value) {
    if (window.DELI_ORDERS && typeof window.DELI_ORDERS.formatPrice === "function") {
      return window.DELI_ORDERS.formatPrice(value || 0);
    }

    const amount = Number(value || 0);

    try {
      return new Intl.NumberFormat("es-CL", {
        style: "currency",
        currency: "CLP",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(amount);
    } catch (error) {
      return `$${amount}`;
    }
  }

  function buildLastOrderItemsText(order) {
    const items = Array.isArray(order?.items) ? order.items : [];

    if (!items.length) return "Tu pedido fue enviado correctamente.";

    const firstItems = items.slice(0, 2).map((item) => {
      const qty = Number(item.qty || item.quantity || 1);
      return `${qty}x ${item.name || item.dishName || "Producto"}`;
    });

    const extraCount = Math.max(items.length - 2, 0);
    return `${firstItems.join(", ")}${extraCount > 0 ? ` +${extraCount} más` : ""}`;
  }

  function buildLastOrderProductsText(order) {
    const items = Array.isArray(order?.items) ? order.items : [];

    if (!items.length) return "Tu pedido fue enviado correctamente.";

    return items.map((item) => {
      const qty = Number(item.qty || item.quantity || 1);
      const name = item.name || item.dishName || "Producto";
      return `${qty}x ${name}`;
    }).join(", ");
  }

  function buildLastOrderReceiptHtml(order) {
    const items = Array.isArray(order?.items) ? order.items : [];

    if (!items.length) {
      return `
        <div class="bhuz-last-order-empty">
          <span>🛍️</span>
          <p>Tu pedido fue enviado correctamente.</p>
        </div>
      `;
    }

    const rows = items.map((item) => {
      const qty = Number(item.qty || item.quantity || item.cantidad || 1);
      const safeQty = Number.isFinite(qty) && qty > 0 ? qty : 1;
      const name = item.name || item.dishName || item.productName || item.title || "Producto";
      const subtotal = Number(item.subtotal || (Number(item.price || item.unitPrice || 0) * safeQty) || 0);
      const subtotalHtml = subtotal > 0 ? `<em>${escapeLiveText(formatLivePrice(subtotal))}</em>` : "";

      return `
        <div class="bhuz-receipt-row">
          <span class="bhuz-receipt-qty">${escapeLiveText(safeQty)}</span>
          <span class="bhuz-receipt-name">${escapeLiveText(name)}</span>
          ${subtotalHtml}
        </div>
      `;
    }).join("");

    return `
      <div class="bhuz-receipt-box">
        <div class="bhuz-receipt-title">
          <span>🧾</span>
          <strong>Detalle del pedido</strong>
        </div>
        <div class="bhuz-receipt-list">
          ${rows}
        </div>
      </div>
    `;
  }

  function formatLastOrderTime(value) {
    const date = value ? new Date(value) : new Date();

    if (Number.isNaN(date.getTime())) {
      return "🕒 Hoy";
    }

    try {
      return `🕒 Hoy, ${date.toLocaleTimeString("es-CL", {
        hour: "2-digit",
        minute: "2-digit"
      })}`;
    } catch (error) {
      return "🕒 Hoy";
    }
  }

  function setSoundButtonState(isActive) {
    const buttons = [bhuzActivateSoundBtn, bhuzNotificationSoundBtn, bhuzGlobalSoundBtn].filter(Boolean);

    buttons.forEach((button) => {
      if (isActive) {
        button.classList.add("is-active");
        button.textContent = "✅ Sonido activado en este teléfono";
        if (button === bhuzGlobalSoundBtn) {
          button.style.display = "none";
        }
      } else {
        button.classList.remove("is-active");
        button.textContent = "🔊 Activar sonido en este teléfono";
        if (button === bhuzGlobalSoundBtn) {
          button.style.display = "inline-flex";
        }
      }
    });
  }

  async function activateBhuzSound(event) {
    if (event) event.preventDefault();

    let activated = false;

    try {
      if (window.BHUZ_LIVE_NOTIFICATIONS && typeof window.BHUZ_LIVE_NOTIFICATIONS.unlockAudio === "function") {
        activated = await window.BHUZ_LIVE_NOTIFICATIONS.unlockAudio();
      }

      if (window.BHUZ_LIVE_NOTIFICATIONS && typeof window.BHUZ_LIVE_NOTIFICATIONS.playStatusSound === "function") {
        window.BHUZ_LIVE_NOTIFICATIONS.playStatusSound("aceptado");
        activated = true;
      }
    } catch (error) {
      console.warn("No se pudo activar sonido BHUZ:", error);
    }

    setSoundButtonState(Boolean(activated));
  }

  function hideLastOrderCard() {
    if (!bhuzLastOrderCard) return;

    if (bhuzLastOrderTimer) {
      clearTimeout(bhuzLastOrderTimer);
      bhuzLastOrderTimer = null;
    }

    bhuzLastOrderCard.classList.add("is-hiding");

    setTimeout(() => {
      bhuzLastOrderCard.classList.remove("is-visible", "is-hiding");
      bhuzLastOrderCard.style.display = "none";
    }, 260);
  }

  function showLastOrderCard(order) {
    if (!bhuzLastOrderCard || !order) return;

    const statusLabel = getOrderStatusLabel(order.status || "pendiente");

    if (bhuzLastOrderTitle) bhuzLastOrderTitle.textContent = "¡Pedido realizado con éxito! 🎉";
    if (bhuzLastOrderText) bhuzLastOrderText.textContent = "Tu pedido ya fue recibido por el restaurante.";
    if (bhuzLastOrderRestaurant) bhuzLastOrderRestaurant.textContent = order.restaurantName || order.restaurant?.name || "BHUZ";
    if (bhuzLastOrderStatus) bhuzLastOrderStatus.textContent = statusLabel;
    if (bhuzLastOrderTotal) bhuzLastOrderTotal.textContent = formatLivePrice(order.total || 0);
    if (bhuzLastOrderTime) bhuzLastOrderTime.textContent = formatLastOrderTime(order.createdAt || order.created_at || order.date);
    if (bhuzLastOrderProducts) bhuzLastOrderProducts.innerHTML = buildLastOrderReceiptHtml(order);
    if (bhuzLastOrderCountdown) bhuzLastOrderCountdown.textContent = "⏱️ Se cerrará en 15 segundos";

    bhuzLastOrderCard.style.display = "grid";
    bhuzLastOrderCard.classList.remove("is-hiding");
    bhuzLastOrderCard.classList.add("is-visible");

    const progressBar = bhuzLastOrderCard.querySelector(".bhuz-last-order-progress span");
    if (progressBar) {
      progressBar.style.animation = "none";
      void progressBar.offsetWidth;
      progressBar.style.animation = "bhuzLastOrderTimer 15s linear forwards";
    }

    if (bhuzLastOrderTimer) clearTimeout(bhuzLastOrderTimer);
    bhuzLastOrderTimer = setTimeout(hideLastOrderCard, 15000);
  }

  function initLastOrderLandingCard() {
    if (!hasOrderSuccessParam()) return;

    const lastOrder = readTemporaryLastOrder();

    if (lastOrder && lastOrder.id) {
      showLastOrderCard(lastOrder);

      pushLiveNotification({
        type: "created",
        orderId: lastOrder.id,
        restaurantName: lastOrder.restaurantName || lastOrder.restaurant?.name || "BHUZ",
        status: lastOrder.status || "pendiente"
      });
    }

    cleanOrderSuccessUrl();
  }

  function currentUserSafe() {
    return (typeof getCurrentUser === "function" && getCurrentUser()) || null;
  }

  function closeAllPanels() {
    if (drawer) drawer.classList.remove("open");
    if (notificationsPanel) notificationsPanel.classList.remove("open");
    if (profilePanel) profilePanel.classList.remove("open");
    if (backdrop) backdrop.classList.remove("show");
  }

  function openDrawer() {
    renderSideMenu();
    closeAllPanels();
    if (drawer) drawer.classList.add("open");
    if (backdrop) backdrop.classList.add("show");
  }

  function openPanel(panel) {
    closeAllPanels();
    if (panel) panel.classList.add("open");
    if (backdrop) backdrop.classList.add("show");
  }

  function goToSearch() {
    const searchInput = document.querySelector(".search");
    const searchCard = document.querySelector(".search-card");

    if (searchCard) {
      searchCard.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    setTimeout(() => {
      if (searchInput) searchInput.focus();
    }, 350);
  }

  function showFavoritesMessage() {
    alert("Favoritos estará disponible pronto. Por ahora puedes buscar y pedir desde restaurantes y platos populares.");
  }

  function showComingSoonMessage(label) {
    alert(`${label} estará disponible pronto. Lo vamos a conectar en el siguiente paso con datos reales.`);
  }

  function openLoginModal(role = "customer") {
    closeAllPanels();

    if (typeof showLogin === "function") {
      showLogin(role);
      return;
    }

    const loginScreen = document.getElementById("loginScreen");
    if (loginScreen) loginScreen.style.display = "flex";
  }

  function openRegisterModal() {
    closeAllPanels();

    if (typeof showRegister === "function") {
      showRegister();
      return;
    }

    const registerScreen = document.getElementById("registerScreen");
    if (registerScreen) registerScreen.style.display = "flex";
  }

  function openRestaurantRegisterModal() {
    closeAllPanels();

    if (typeof showRestaurantRegister === "function") {
      showRestaurantRegister();
      return;
    }

    const restaurantRegisterScreen = document.getElementById("restaurantRegisterScreen");
    if (restaurantRegisterScreen) restaurantRegisterScreen.style.display = "flex";
  }

  function logoutSafe(event) {
    if (event) event.preventDefault();

    if (typeof logout === "function") {
      logout();
      return;
    }

    window.location.href = "index.html";
  }

  function bindStaticActions() {
    if (openSideMenu) openSideMenu.addEventListener("click", openDrawer);
    if (closeSideMenu) closeSideMenu.addEventListener("click", closeAllPanels);
    if (backdrop) backdrop.addEventListener("click", closeAllPanels);

    if (openNotifications) {
      openNotifications.addEventListener("click", () => {
        renderNotificationsPanel();
        updateNotificationBadge();
        openPanel(notificationsPanel);
      });
    }

    if (closeNotifications) closeNotifications.addEventListener("click", closeAllPanels);

    if (openProfileMenu) {
      openProfileMenu.addEventListener("click", () => openPanel(profilePanel));
    }

    if (closeProfilePanel) closeProfilePanel.addEventListener("click", closeAllPanels);

    if (bhuzLastOrderClose) {
      bhuzLastOrderClose.addEventListener("click", hideLastOrderCard);
    }

    if (bhuzActivateSoundBtn) {
      bhuzActivateSoundBtn.addEventListener("click", activateBhuzSound);
    }

    if (bhuzNotificationSoundBtn) {
      bhuzNotificationSoundBtn.addEventListener("click", activateBhuzSound);
    }

    if (bhuzGlobalSoundBtn) {
      bhuzGlobalSoundBtn.addEventListener("click", activateBhuzSound);
      setSoundButtonState(
        Boolean(window.BHUZ_LIVE_NOTIFICATIONS && typeof window.BHUZ_LIVE_NOTIFICATIONS.isAudioUnlocked === "function" && window.BHUZ_LIVE_NOTIFICATIONS.isAudioUnlocked())
      );
    }

    if (bottomSearchBtn) {
      bottomSearchBtn.addEventListener("click", (e) => {
        e.preventDefault();
        goToSearch();
      });
    }

    if (bottomFavoritesBtn) {
      bottomFavoritesBtn.addEventListener("click", (e) => {
        e.preventDefault();
        showFavoritesMessage();
      });
    }

    if (bottomProfileBtn) {
      bottomProfileBtn.addEventListener("click", (e) => {
        e.preventDefault();
        openPanel(profilePanel);
      });
    }
  }


  function bindDrawerActionButtons() {
    const drawerFavoritesBtn = document.getElementById("drawerFavoritesBtn");
    const drawerLoginBtn = document.getElementById("drawerLoginBtn");
    const drawerRegisterBtn = document.getElementById("drawerRegisterBtn");
    const drawerRestaurantBtn = document.getElementById("drawerRestaurantBtn");
    const drawerLogoutBtn = document.getElementById("drawerLogoutBtn");
    const drawerAddressBtn = document.getElementById("drawerAddressBtn");
    const drawerPaymentBtn = document.getElementById("drawerPaymentBtn");
    const drawerNotificationsBtn = document.getElementById("drawerNotificationsBtn");
    const drawerSupportBtn = document.getElementById("drawerSupportBtn");
    const drawerProfileBtn = document.getElementById("drawerProfileBtn");

    if (drawerFavoritesBtn) {
      drawerFavoritesBtn.addEventListener("click", (e) => {
        e.preventDefault();
        closeAllPanels();
        showFavoritesMessage();
      });
    }

    if (drawerAddressBtn) {
      drawerAddressBtn.addEventListener("click", (e) => {
        e.preventDefault();
        closeAllPanels();
        showComingSoonMessage("Direcciones y ubicación GPS");
      });
    }

    if (drawerPaymentBtn) {
      drawerPaymentBtn.addEventListener("click", (e) => {
        e.preventDefault();
        closeAllPanels();
        showComingSoonMessage("Métodos de pago");
      });
    }

    if (drawerNotificationsBtn) {
      drawerNotificationsBtn.addEventListener("click", (e) => {
        e.preventDefault();
        renderNotificationsPanel();
        updateNotificationBadge();
        openPanel(notificationsPanel);
      });
    }

    if (drawerSupportBtn) {
      drawerSupportBtn.addEventListener("click", (e) => {
        e.preventDefault();
        closeAllPanels();
        showComingSoonMessage("Soporte y ayuda");
      });
    }

    if (drawerProfileBtn) {
      drawerProfileBtn.addEventListener("click", (e) => {
        e.preventDefault();
        openPanel(profilePanel);
      });
    }

    if (drawerLoginBtn) {
      drawerLoginBtn.addEventListener("click", (e) => {
        e.preventDefault();
        openLoginModal("customer");
      });
    }

    if (drawerRegisterBtn) {
      drawerRegisterBtn.addEventListener("click", (e) => {
        e.preventDefault();
        openRegisterModal();
      });
    }

    if (drawerRestaurantBtn) {
      drawerRestaurantBtn.addEventListener("click", (e) => {
        e.preventDefault();
        openRestaurantRegisterModal();
      });
    }

    if (drawerLogoutBtn) {
      drawerLogoutBtn.addEventListener("click", logoutSafe);
    }
  }

  function renderSideMenu() {
    if (!drawerLinks) return;

    const currentUser = currentUserSafe();

    if (currentUser) {
      const isRestaurant = currentUser.role === "restaurant";

      if (isRestaurant) {
        drawerLinks.innerHTML = `
          <a href="index.html">🏠 Inicio</a>
          <a href="panel-restaurant.html">🏪 Mi panel restaurante</a>
          <a href="panel-restaurant.html#orders">🛍️ Pedidos del restaurante</a>
          <a href="#" id="drawerNotificationsBtn">🔔 Notificaciones</a>
          <a href="#" id="drawerSupportBtn">❔ Ayuda / soporte</a>
          <a href="#" id="drawerLogoutBtn">🚪 Cerrar sesión</a>
        `;

        bindDrawerActionButtons();
        return;
      }

      drawerLinks.innerHTML = `
        <a href="index.html">🏠 Inicio</a>
        <a href="mis-pedidos.html">🛍️ Mis pedidos</a>
        <a href="#restaurantList">🍽️ Restaurantes</a>
        <a href="#topDishesSection">🔥 Platos populares</a>
        <a href="#" id="drawerFavoritesBtn">♡ Favoritos</a>
        <a href="#" id="drawerAddressBtn">📍 Direcciones / ubicación GPS</a>
        <a href="#" id="drawerPaymentBtn">💳 Métodos de pago</a>
        <a href="#" id="drawerNotificationsBtn">🔔 Notificaciones</a>
        <a href="#" id="drawerProfileBtn">👤 Mi perfil</a>
        <a href="#" id="drawerSupportBtn">❔ Ayuda / soporte</a>
        <a href="#" id="drawerLogoutBtn">🚪 Cerrar sesión</a>
      `;

      bindDrawerActionButtons();
      return;
    }

    drawerLinks.innerHTML = `
      <a href="index.html">🏠 Inicio</a>
      <a href="#restaurantList">🍽️ Restaurantes</a>
      <a href="#topDishesSection">🔥 Platos populares</a>
      <a href="mis-pedidos.html">🛍️ Mis pedidos</a>
      <a href="#" id="drawerFavoritesBtn">♡ Favoritos</a>
      <a href="#" id="drawerLoginBtn">👤 Iniciar sesión</a>
      <a href="#" id="drawerRegisterBtn">✨ Registrarme</a>
      <a href="#" id="drawerRestaurantBtn">🏪 Registrar restaurante</a>
    `;

    bindDrawerActionButtons();
  }

  function renderProfilePanel() {
    if (!profileActionsPanel) return;

    const currentUser = currentUserSafe();

    if (currentUser) {
      const displayName = currentUser.fullName || currentUser.name || "Usuario";
      const isRestaurant = currentUser.role === "restaurant";

      profileActionsPanel.innerHTML = `
        <div class="profile-mini-card">
          <strong>Hola, ${displayName}</strong>
          <span>${isRestaurant ? "Cuenta restaurante" : "Cuenta cliente"}</span>
        </div>
        <a href="index.html">Inicio</a>
        ${isRestaurant ? '<a href="panel-restaurant.html">Mi panel restaurante</a>' : '<a href="mis-pedidos.html">Mis pedidos</a>'}
        ${!isRestaurant ? '<button type="button" id="profileAddressBtn">Agregar dirección / GPS</button>' : ''}
        ${!isRestaurant ? '<button type="button" id="profilePaymentBtn">Agregar método de pago</button>' : ''}
        <button type="button" id="profileSupportBtn">Ayuda / soporte</button>
        <button type="button" id="profileLogoutBtn">Cerrar sesión</button>
      `;

      const profileLogoutBtn = document.getElementById("profileLogoutBtn");
      const profileAddressBtn = document.getElementById("profileAddressBtn");
      const profilePaymentBtn = document.getElementById("profilePaymentBtn");
      const profileSupportBtn = document.getElementById("profileSupportBtn");

      if (profileLogoutBtn) profileLogoutBtn.addEventListener("click", logoutSafe);
      if (profileAddressBtn) profileAddressBtn.addEventListener("click", () => showComingSoonMessage("Direcciones y ubicación GPS"));
      if (profilePaymentBtn) profilePaymentBtn.addEventListener("click", () => showComingSoonMessage("Métodos de pago"));
      if (profileSupportBtn) profileSupportBtn.addEventListener("click", () => showComingSoonMessage("Soporte y ayuda"));
      return;
    }

    profileActionsPanel.innerHTML = `
      <button type="button" id="profileLoginBtn">Iniciar sesión</button>
      <button type="button" id="profileRegisterBtn">Crear cuenta</button>
      <button type="button" id="profileRestaurantBtn">Registrar restaurante</button>
      <a href="mis-pedidos.html">Ver mis pedidos</a>
    `;

    const profileLoginBtn = document.getElementById("profileLoginBtn");
    const profileRegisterBtn = document.getElementById("profileRegisterBtn");
    const profileRestaurantBtn = document.getElementById("profileRestaurantBtn");

    if (profileLoginBtn) profileLoginBtn.addEventListener("click", () => openLoginModal("customer"));
    if (profileRegisterBtn) profileRegisterBtn.addEventListener("click", openRegisterModal);
    if (profileRestaurantBtn) profileRestaurantBtn.addEventListener("click", openRestaurantRegisterModal);
  }

  function renderHeader() {
    if (!userNav) return;

    const currentUser = currentUserSafe();

    if (currentUser) {
      if (currentUser.role === "restaurant") {
        userNav.innerHTML = `
          <a href="index.html">Inicio</a>
          <span class="user-greeting">Hola, ${currentUser.name || "Restaurante"}</span>
          <a href="panel-restaurant.html">Mi panel</a>
          <a href="#" id="logoutBtn">Cerrar sesión</a>
        `;
      } else {
        userNav.innerHTML = `
          <a href="index.html">Inicio</a>
          <a href="mis-pedidos.html">Mis pedidos</a>
          <span class="user-greeting">Hola, ${currentUser.fullName || currentUser.name || "Usuario"}</span>
          <a href="#" id="logoutBtn">Cerrar sesión</a>
        `;
      }

      const logoutBtn = document.getElementById("logoutBtn");
      if (logoutBtn) logoutBtn.addEventListener("click", logoutSafe);

      renderProfilePanel();
      return;
    }

    userNav.innerHTML = `
      <a href="index.html">Inicio</a>
      <a href="#" id="openLoginCustomer">Iniciar sesión</a>
      <a href="#" id="openRegisterCustomer">Regístrate</a>
      <a href="#" id="openRegisterRestaurant">Registro restaurante</a>
      <a href="#restaurantList">Restaurantes</a>
    `;

    const openLoginCustomer = document.getElementById("openLoginCustomer");
    const openRegisterCustomer = document.getElementById("openRegisterCustomer");
    const openRegisterRestaurant = document.getElementById("openRegisterRestaurant");

    if (openLoginCustomer) {
      openLoginCustomer.addEventListener("click", (e) => {
        e.preventDefault();
        openLoginModal("customer");
      });
    }

    if (openRegisterCustomer) {
      openRegisterCustomer.addEventListener("click", (e) => {
        e.preventDefault();
        openRegisterModal();
      });
    }

    if (openRegisterRestaurant) {
      openRegisterRestaurant.addEventListener("click", (e) => {
        e.preventDefault();
        openRestaurantRegisterModal();
      });
    }

    renderProfilePanel();
  }

  bindLiveOrderEvents();
  hydrateLastCreatedOrder();
  initLastOrderLandingCard();
  renderNotificationsPanel();
  updateNotificationBadge();

  bindNotificationsListActions();
  bindStaticActions();
  renderSideMenu();
  renderHeader();
  startLivePolling();

  window.addEventListener("deli:session-ready", () => {
    renderSideMenu();
    renderHeader();
    startLivePolling();
  });
});























































































































































