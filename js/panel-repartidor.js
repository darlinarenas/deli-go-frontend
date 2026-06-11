document.addEventListener("DOMContentLoaded", async () => {
  if (!window.DELI_SESSION_READY && typeof loadCurrentSession === "function") {
    await loadCurrentSession();
  }

  const DEMO_ORDERS = [
    {
      id: "BHZ-1042",
      restaurant: "Burger Punto",
      restaurantAddress: "Av. Jacinto Lara, Punto Fijo",
      customer: "María González",
      customerPhone: "+584121112233",
      customerAddress: "Santa Irene, calle 4, casa azul",
      items: "2 Hamburguesas clásicas, 1 papas grandes",
      payment: "Pago móvil",
      total: 18.5,
      deliveryFee: 2.5,
      commission: 2.0,
      distance: "2.4 km",
      eta: "18 min",
      status: "disponible"
    },
    {
      id: "BHZ-1043",
      restaurant: "Arepas La 70",
      restaurantAddress: "Centro, cerca de Plaza Bolívar",
      customer: "Carlos Prieto",
      customerPhone: "+584141234567",
      customerAddress: "Puerta Maraven, edificio Sol, piso 2",
      items: "3 Arepas mixtas, 2 jugos naturales",
      payment: "Efectivo USD",
      total: 14.0,
      deliveryFee: 2.0,
      commission: 1.8,
      distance: "1.7 km",
      eta: "13 min",
      status: "disponible"
    },
    {
      id: "BHZ-1044",
      restaurant: "Pizza Norte",
      restaurantAddress: "Calle Comercio, local 12",
      customer: "Andrea Soto",
      customerPhone: "+584241112244",
      customerAddress: "Las Margaritas, manzana 8",
      items: "1 Pizza familiar, 1 refresco 1.5L",
      payment: "Zelle confirmado",
      total: 22.0,
      deliveryFee: 3.0,
      commission: 2.4,
      distance: "3.1 km",
      eta: "22 min",
      status: "disponible"
    }
  ];

  const STATUS_STEPS = [
    { key: "aceptado", label: "Pedido aceptado" },
    { key: "voy_restaurante", label: "Voy al restaurante" },
    { key: "retirado", label: "Pedido retirado" },
    { key: "en_camino", label: "En camino al cliente" },
    { key: "entregado", label: "Entregado" }
  ];

  const STORAGE_KEY = "bhuzDriverPanelDemo";

  const els = {
    driverStatusPill: document.getElementById("driverStatusPill"),
    toggleDriverStatusBtn: document.getElementById("toggleDriverStatusBtn"),
    driverName: document.getElementById("driverName"),
    driverZone: document.getElementById("driverZone"),
    menuButtons: document.querySelectorAll(".menu-btn"),
    sections: document.querySelectorAll(".content-section"),
    goAvailableBtn: document.getElementById("goAvailableBtn"),
    refreshOrdersBtn: document.getElementById("refreshOrdersBtn"),
    availableCount: document.getElementById("availableCount"),
    activeCount: document.getElementById("activeCount"),
    deliveredTodayCount: document.getElementById("deliveredTodayCount"),
    todayEarnings: document.getElementById("todayEarnings"),
    recommendedOrder: document.getElementById("recommendedOrder"),
    availableOrdersList: document.getElementById("availableOrdersList"),
    activeOrderBox: document.getElementById("activeOrderBox"),
    historyList: document.getElementById("historyList"),
    toast: document.getElementById("toast")
  };

  let state = loadState();

  const user = typeof getCurrentUser === "function" ? getCurrentUser() : null;
  if (user && user.name) {
    els.driverName.textContent = user.name;
  }

  if (user && user.zone) {
    els.driverZone.textContent = `Zona: ${user.zone}`;
  }

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved && Array.isArray(saved.orders)) return saved;
    } catch (error) {
      console.warn("No se pudo cargar demo repartidor", error);
    }

    return {
      online: true,
      orders: DEMO_ORDERS,
      activeOrder: null,
      history: []
    };
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function money(value) {
    return `$${Number(value || 0).toFixed(2)}`;
  }

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => els.toast.classList.remove("show"), 2600);
  }

  function setSection(sectionName) {
    els.menuButtons.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.section === sectionName);
    });

    els.sections.forEach((section) => {
      section.classList.toggle("active", section.id === `section-${sectionName}`);
    });
  }

  function render() {
    renderDriverStatus();
    renderStats();
    renderRecommendedOrder();
    renderAvailableOrders();
    renderActiveOrder();
    renderHistory();
  }

  function renderDriverStatus() {
    els.driverStatusPill.textContent = state.online ? "Disponible" : "Pausado";
    els.driverStatusPill.classList.toggle("online", state.online);
    els.driverStatusPill.classList.toggle("offline", !state.online);
    els.toggleDriverStatusBtn.textContent = state.online ? "Pausar" : "Activarme";
  }

  function renderStats() {
    const available = state.orders.filter((order) => order.status === "disponible").length;
    const active = state.activeOrder ? 1 : 0;
    const earnings = state.history.reduce((sum, order) => sum + Number(order.commission || 0), 0);

    els.availableCount.textContent = available;
    els.activeCount.textContent = active;
    els.deliveredTodayCount.textContent = state.history.length;
    els.todayEarnings.textContent = money(earnings);
  }

  function renderRecommendedOrder() {
    const order = state.orders.find((item) => item.status === "disponible");
    els.recommendedOrder.innerHTML = order ? orderCard(order, true) : emptyState("No hay pedidos disponibles por ahora.");
  }

  function renderAvailableOrders() {
    const availableOrders = state.orders.filter((order) => order.status === "disponible");
    els.availableOrdersList.innerHTML = availableOrders.length
      ? availableOrders.map((order) => orderCard(order, true)).join("")
      : emptyState("No hay pedidos disponibles. Prueba actualizar la demo.");
  }

  function renderActiveOrder() {
    if (!state.activeOrder) {
      els.activeOrderBox.innerHTML = emptyState("Todavía no tienes un pedido activo. Acepta uno desde pedidos disponibles.");
      return;
    }

    const order = state.activeOrder;
    const currentIndex = STATUS_STEPS.findIndex((step) => step.key === order.driverStatus);
    const nextStep = STATUS_STEPS[currentIndex + 1];

    els.activeOrderBox.innerHTML = `
      <div class="active-order-main">
        ${orderCard(order, false)}
        <div class="order-card">
          <div class="order-head">
            <div>
              <h3>Avance de entrega</h3>
              <p>Actualiza cada paso cuando realmente ocurra.</p>
            </div>
            <span class="status-chip">${getStatusLabel(order.driverStatus)}</span>
          </div>
          <div class="status-steps">
            ${STATUS_STEPS.map((step, index) => `
              <div class="step-row ${index <= currentIndex ? "done" : ""}">
                <span class="step-dot"></span>
                <span>${step.label}</span>
              </div>
            `).join("")}
          </div>
          <div class="status-actions">
            ${nextStep ? `<button class="btn btn-primary" data-next-status="${nextStep.key}" type="button">Marcar: ${nextStep.label}</button>` : ""}
            <button class="btn btn-warning" data-open-maps="${order.customerAddress}" type="button">Abrir Maps</button>
            <a class="btn btn-light" href="https://wa.me/${cleanPhone(order.customerPhone)}" target="_blank" rel="noopener">WhatsApp cliente</a>
            <button class="btn btn-danger" data-cancel-active="true" type="button">Liberar pedido</button>
          </div>
        </div>
      </div>
    `;
  }

  function renderHistory() {
    els.historyList.innerHTML = state.history.length
      ? state.history.map((order) => `
        <article class="history-item">
          <div>
            <strong>${order.id} · ${order.restaurant}</strong>
            <p>${order.customer} · ${order.customerAddress}</p>
          </div>
          <strong>${money(order.commission)}</strong>
        </article>
      `).join("")
      : emptyState("Aún no tienes entregas completadas en esta demo.");
  }

  function orderCard(order, canAccept) {
    const disabled = !state.online || Boolean(state.activeOrder);
    return `
      <article class="order-card">
        <div class="order-head">
          <div>
            <h3>${order.id} · ${order.restaurant}</h3>
            <p>${order.items}</p>
          </div>
          <span class="status-chip">${order.distance} · ${order.eta}</span>
        </div>
        <div class="order-grid">
          <div class="order-detail"><strong>Restaurante</strong>${order.restaurantAddress}</div>
          <div class="order-detail"><strong>Cliente</strong>${order.customer}<br>${order.customerAddress}</div>
          <div class="order-detail"><strong>Pago</strong>${order.payment}<br>Total: ${money(order.total)}</div>
        </div>
        <div class="order-grid">
          <div class="order-detail"><strong>Delivery</strong>${money(order.deliveryFee)}</div>
          <div class="order-detail"><strong>Ganancia repartidor</strong>${money(order.commission)}</div>
          <div class="order-detail"><strong>Estado</strong>${getStatusLabel(order.driverStatus || order.status)}</div>
        </div>
        ${canAccept ? `
          <div class="order-actions">
            <button class="btn btn-primary" data-accept-order="${order.id}" ${disabled ? "disabled" : ""} type="button">
              ${state.activeOrder ? "Ya tienes un pedido" : state.online ? "Aceptar pedido" : "Pausado"}
            </button>
            <button class="btn btn-light" data-open-maps="${order.restaurantAddress}" type="button">Ver restaurante</button>
          </div>
        ` : ""}
      </article>
    `;
  }

  function emptyState(message) {
    return `<div class="empty-state">${message}</div>`;
  }

  function getStatusLabel(status) {
    const labels = {
      disponible: "Disponible",
      aceptado: "Aceptado por repartidor",
      voy_restaurante: "Voy al restaurante",
      retirado: "Pedido retirado",
      en_camino: "En camino al cliente",
      entregado: "Entregado"
    };
    return labels[status] || "Sin estado";
  }

  function cleanPhone(phone) {
    return String(phone || "").replace(/[^0-9]/g, "");
  }

  function acceptOrder(orderId) {
    if (!state.online) {
      showToast("Actívate para aceptar pedidos.");
      return;
    }

    if (state.activeOrder) {
      showToast("Ya tienes un pedido activo.");
      return;
    }

    const order = state.orders.find((item) => item.id === orderId);
    if (!order) return;

    state.activeOrder = {
      ...order,
      status: "activo",
      driverStatus: "aceptado",
      acceptedAt: new Date().toISOString()
    };

    state.orders = state.orders.filter((item) => item.id !== orderId);
    saveState();
    render();
    setSection("activo");
    showToast("Pedido aceptado correctamente.");
  }

  function updateActiveStatus(nextStatus) {
    if (!state.activeOrder) return;

    state.activeOrder.driverStatus = nextStatus;

    if (nextStatus === "entregado") {
      state.history.unshift({
        ...state.activeOrder,
        deliveredAt: new Date().toISOString()
      });
      state.activeOrder = null;
      showToast("Entrega completada. Ganancia registrada.");
      setSection("historial");
    } else {
      showToast(`Estado actualizado: ${getStatusLabel(nextStatus)}.`);
    }

    saveState();
    render();
  }

  function cancelActiveOrder() {
    if (!state.activeOrder) return;

    const restored = {
      ...state.activeOrder,
      status: "disponible",
      driverStatus: undefined
    };

    delete restored.acceptedAt;
    state.orders.unshift(restored);
    state.activeOrder = null;
    saveState();
    render();
    setSection("disponibles");
    showToast("Pedido liberado y devuelto a disponibles.");
  }

  function openMaps(address) {
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    window.open(url, "_blank", "noopener");
  }

  document.body.addEventListener("click", (event) => {
    const menuButton = event.target.closest(".menu-btn");
    if (menuButton) setSection(menuButton.dataset.section);

    const acceptButton = event.target.closest("[data-accept-order]");
    if (acceptButton) acceptOrder(acceptButton.dataset.acceptOrder);

    const nextStatusButton = event.target.closest("[data-next-status]");
    if (nextStatusButton) updateActiveStatus(nextStatusButton.dataset.nextStatus);

    const cancelButton = event.target.closest("[data-cancel-active]");
    if (cancelButton) cancelActiveOrder();

    const mapsButton = event.target.closest("[data-open-maps]");
    if (mapsButton) openMaps(mapsButton.dataset.openMaps);
  });

  els.toggleDriverStatusBtn.addEventListener("click", () => {
    state.online = !state.online;
    saveState();
    render();
    showToast(state.online ? "Repartidor disponible." : "Repartidor pausado.");
  });

  els.goAvailableBtn.addEventListener("click", () => setSection("disponibles"));

  els.refreshOrdersBtn.addEventListener("click", () => {
    state.orders = DEMO_ORDERS.filter((demoOrder) => {
      const isActive = state.activeOrder && state.activeOrder.id === demoOrder.id;
      const isDelivered = state.history.some((historyOrder) => historyOrder.id === demoOrder.id);
      return !isActive && !isDelivered;
    });
    saveState();
    render();
    showToast("Pedidos demo actualizados.");
  });

  render();
});
