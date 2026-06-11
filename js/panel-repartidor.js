document.addEventListener("DOMContentLoaded", async () => {
  if (!window.DELI_SESSION_READY && typeof loadCurrentSession === "function") {
    await loadCurrentSession();
  }

  const STORAGE_KEY = "bhuzDriverPremiumPanelDemo";
  const DELIVERY_CODE = "4829";

  const DEMO_ORDER = {
    id: "BHZ-1045",
    restaurant: "Burger House",
    restaurantAddress: "Av. Jacinto Lara, Punto Fijo",
    restaurantDistance: "1.7 km",
    customer: "Juan Pérez",
    customerAddress: "Urb. Santa Irene, Calle 4, Casa N° 12",
    customerDistance: "2.3 km",
    briefItems: ["1 Hamburguesa clásica", "1 Papas medianas", "1 Gaseosa 355ml"],
    pickupNote: "Retirar en mesón principal. Validar que el pedido esté sellado.",
    deliveryNote: "Pedir código de 4 dígitos al cliente antes de cerrar la entrega.",
    etaLocal: "6 min",
    etaCustomer: "8 min",
    commission: 3200,
    status: "available"
  };

  const els = {
    homeView: document.getElementById("homeView"),
    deliveriesView: document.getElementById("deliveriesView"),
    earningsView: document.getElementById("earningsView"),
    profileView: document.getElementById("profileView"),
    navButtons: document.querySelectorAll(".nav-btn"),
    openMenuBtn: document.getElementById("openMenuBtn"),
    sideMenu: document.getElementById("sideMenu"),
    themeToggleBtn: document.getElementById("themeToggleBtn"),
    toast: document.getElementById("toast"),
    menuDriverName: document.getElementById("menuDriverName"),
    menuAvailabilityBtn: document.getElementById("menuAvailabilityBtn")
  };

  const state = loadState();
  const user = typeof getCurrentUser === "function" ? getCurrentUser() : null;

  if (user && user.name) {
    state.driver.name = user.name;
    els.menuDriverName.textContent = user.name;
  } else {
    els.menuDriverName.textContent = state.driver.name;
  }

  applyTheme();
  renderAll();

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved && saved.driver && saved.currentStatus) return saved;
    } catch (error) {
      console.warn("No se pudo cargar panel repartidor premium", error);
    }

    return {
      darkMode: false,
      online: true,
      currentStatus: "available",
      order: { ...DEMO_ORDER },
      history: [],
      driver: {
        name: "Repartidor BHUZ",
        zone: "Punto Fijo",
        vehicle: "Moto",
        phone: "No visible para cliente",
        rating: "4.9"
      },
      today: {
        deliveries: 0,
        earnings: 0,
        onlineTime: "3h 45m"
      }
    };
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function renderAll() {
    renderHome();
    renderDeliveries();
    renderEarnings();
    renderProfile();
    renderMenuAvailability();
  }


  function renderQuickSummary() {
    return `
      <div class="quick-summary" aria-label="Resumen del día">
        <div class="quick-summary-item"><span>Entregas</span><strong>${state.today.deliveries}</strong></div>
        <div class="quick-summary-item"><span>Ganancias</span><strong>${money(state.today.earnings)}</strong></div>
        <div class="quick-summary-item"><span>Online</span><strong>${state.today.onlineTime}</strong></div>
      </div>
    `;
  }

  function renderAvailabilityCard() {
    return `
      <div class="availability-card">
        <div>
          <strong>${state.online ? "Disponible para recibir pedidos" : "No disponible"}</strong>
          <p>${state.online ? "Conectado y esperando despachos." : "Pausado para comer, descansar o resolver algo."}</p>
        </div>
        <button class="switch-btn ${state.online ? "on" : ""}" data-toggle-availability="true" type="button" aria-label="Cambiar disponibilidad"></button>
      </div>
    `;
  }

  function renderMenuAvailability() {
    if (!els.menuAvailabilityBtn) return;
    els.menuAvailabilityBtn.innerHTML = state.online
      ? "🟢 Disponible <span>Conectado para recibir pedidos</span>"
      : "🔴 No disponible <span>Pausado temporalmente</span>";
  }

  function toggleAvailability() {
    if (!["available", "new_order"].includes(state.currentStatus)) {
      showToast("Termina el pedido activo antes de cambiar disponibilidad.");
      return;
    }

    state.online = !state.online;

    if (!state.online && state.currentStatus === "new_order") {
      state.currentStatus = "available";
    }

    saveState();
    renderAll();
    showToast(state.online ? "Estás disponible para recibir pedidos." : "Modo descanso activado. No recibirás pedidos.");
  }

  function renderHome() {
    const status = state.currentStatus;

    if (status === "available") {
      els.homeView.innerHTML = `
        ${statusPill(state.online ? "available" : "offline", state.online ? "Disponible" : "No disponible")}
        ${renderQuickSummary()}
        ${renderAvailabilityCard()}
        <article class="main-card center-card">
          <div class="radar">🛵</div>
          <h1>${state.online ? "Esperando nuevo pedido" : "Estás en modo descanso"}</h1>
          <p>${state.online ? "Te avisaremos cuando haya un despacho disponible para ti." : "Activa tu disponibilidad cuando quieras volver a recibir pedidos."}</p>
          <div class="action-stack">
            <button class="btn btn-green" data-demo-new-order="true" ${state.online ? "" : "disabled"} type="button">Simular nuevo pedido</button>
          </div>
        </article>
      `;
      return;
    }

    if (status === "new_order") {
      els.homeView.innerHTML = renderNewOrder();
      return;
    }

    if (status === "to_local") {
      els.homeView.innerHTML = renderToLocal();
      return;
    }

    if (status === "waiting_pickup") {
      els.homeView.innerHTML = renderWaitingPickup();
      return;
    }

    if (status === "to_customer") {
      els.homeView.innerHTML = renderToCustomer();
      return;
    }

    if (status === "confirm_code") {
      els.homeView.innerHTML = renderConfirmCode();
      setTimeout(focusCodeInput, 50);
      return;
    }

    if (status === "completed") {
      els.homeView.innerHTML = renderCompleted();
    }
  }

  function renderNewOrder() {
    const order = state.order;
    return `
      ${statusPill("new", "Nuevo pedido")}
      <article class="main-card">
        <div class="order-header">
          <div class="logo-circle">🍔</div>
          <div>
            <h1>${order.restaurant}</h1>
            <p>📍 A ${order.restaurantDistance} de ti</p>
            <p>${order.restaurantAddress}</p>
          </div>
        </div>

        <div class="section-line">
          <strong>Descripción breve</strong>
          <ul class="brief-list">
            ${order.briefItems.map((item) => `<li>${item}</li>`).join("")}
          </ul>
        </div>

        <div class="restaurant-box">
          <strong>Local de retiro</strong>
          <p>${order.restaurant}</p>
          <p class="small-text">${order.pickupNote}</p>
        </div>

        <div class="customer-box">
          <strong>Entrega a</strong>
          <p>${order.customer}</p>
          <p class="small-text">${order.customerAddress}</p>
        </div>

        <div class="order-meta">
          <div class="meta-box green"><span>Distancia</span><strong>${order.restaurantDistance}</strong></div>
          <div class="meta-box blue"><span>Tiempo</span><strong>${order.etaLocal}</strong></div>
          <div class="meta-box green"><span>Ganancia</span><strong>${money(order.commission)}</strong></div>
        </div>

        <div class="action-stack">
          <button class="btn btn-green" data-accept-order="true" type="button">Aceptar pedido</button>
          <button class="btn btn-danger" data-reject-order="true" type="button">Rechazar</button>
        </div>
      </article>
    `;
  }

  function renderToLocal() {
    const order = state.order;
    return `
      ${statusPill("local", "En camino al local")}
      <article class="main-card">
        <div class="order-header">
          <div class="step-icon">🏪</div>
          <div>
            <h1>${order.restaurant}</h1>
            <p>${order.restaurantAddress}</p>
          </div>
        </div>
        <div class="map-preview" aria-label="Vista previa del mapa"></div>
        <div class="order-meta">
          <div class="meta-box orange"><span>Distancia</span><strong>${order.restaurantDistance}</strong></div>
          <div class="meta-box blue"><span>Tiempo estimado</span><strong>${order.etaLocal}</strong></div>
          <div class="meta-box green"><span>Ganancia</span><strong>${money(order.commission)}</strong></div>
        </div>
        <div class="action-stack">
          <button class="btn btn-blue" data-open-map="restaurant" type="button">⌁ Abrir mapa</button>
          <button class="btn btn-light" data-arrived-local="true" type="button">Ya llegué al local</button>
        </div>
      </article>
    `;
  }

  function renderWaitingPickup() {
    const order = state.order;
    return `
      ${statusPill("pickup", "Esperando retiro")}
      <article class="main-card">
        <div class="order-header">
          <div class="step-icon">🛍️</div>
          <div>
            <h1>${order.restaurant}</h1>
            <p>Pedido #${order.id}</p>
          </div>
        </div>

        <div class="section-line">
          <strong>Descripción breve</strong>
          <ul class="brief-list">
            ${order.briefItems.map((item) => `<li>${item}</li>`).join("")}
          </ul>
        </div>

        <div class="notice-box">
          <strong>Antes de salir</strong>
          <p class="small-text">${order.pickupNote}</p>
        </div>

        <div class="action-stack">
          <button class="btn btn-green" data-picked-up="true" type="button">Marcar como pedido retirado</button>
        </div>
      </article>
    `;
  }

  function renderToCustomer() {
    const order = state.order;
    return `
      ${statusPill("client", "En camino al cliente")}
      <article class="main-card">
        <div class="order-header">
          <div class="step-icon">👤</div>
          <div>
            <p>Entrega a</p>
            <h1>${order.customer}</h1>
            <p>${order.customerAddress}</p>
          </div>
        </div>

        <div class="section-line">
          <strong>Descripción breve</strong>
          <ul class="brief-list">
            ${order.briefItems.map((item) => `<li>${item}</li>`).join("")}
          </ul>
        </div>

        <div class="order-meta">
          <div class="meta-box orange"><span>Distancia</span><strong>${order.customerDistance}</strong></div>
          <div class="meta-box blue"><span>Tiempo estimado</span><strong>${order.etaCustomer}</strong></div>
          <div class="meta-box green"><span>Ganancia</span><strong>${money(order.commission)}</strong></div>
        </div>

        <div class="notice-box">
          <strong>Importante</strong>
          <p class="small-text">${order.deliveryNote}</p>
        </div>

        <div class="action-stack">
          <button class="btn btn-orange" data-open-map="customer" type="button">⌁ Abrir mapa</button>
          <button class="btn btn-light" data-arrived-customer="true" type="button">Llegué al cliente</button>
        </div>
      </article>
    `;
  }

  function renderConfirmCode() {
    return `
      ${statusPill("delivery", "Entregando")}
      <article class="main-card center-card">
        <div class="step-icon">✅</div>
        <h1>Ingresa el código de entrega</h1>
        <p>Pide al cliente el código de 4 dígitos para confirmar que recibió el pedido.</p>

        <div class="delivery-code" aria-label="Código de entrega">
          <input inputmode="numeric" maxlength="1" class="code-input" aria-label="Dígito 1" />
          <input inputmode="numeric" maxlength="1" class="code-input" aria-label="Dígito 2" />
          <input inputmode="numeric" maxlength="1" class="code-input" aria-label="Dígito 3" />
          <input inputmode="numeric" maxlength="1" class="code-input" aria-label="Dígito 4" />
        </div>

        <p class="small-text">Demo: código ${DELIVERY_CODE}</p>

        <div class="action-stack">
          <button class="btn btn-green" data-confirm-code="true" type="button">Confirmar entrega</button>
          <button class="btn btn-light" data-back-customer="true" type="button">Cancelar</button>
        </div>
      </article>
    `;
  }

  function renderCompleted() {
    return `
      ${statusPill("completed", "Pedido entregado")}
      <article class="main-card center-card">
        <div class="success-icon">✓</div>
        <h1>¡Entrega completada!</h1>
        <p>Gracias por brindar un excelente servicio.</p>
        <div class="section-line" style="width:100%;">
          <p>Ganancia por entrega</p>
          <h1 style="color:var(--green);">${money(state.order.commission)}</h1>
        </div>
        <div class="action-stack" style="width:100%;">
          <button class="btn btn-green" data-ready-next="true" type="button">Disponible para otro pedido</button>
        </div>
      </article>
    `;
  }

  function renderDeliveries() {
    const historyItems = state.history.length
      ? state.history.map((item) => `
        <div class="history-item">
          <div>
            <strong>${item.id}</strong>
            <p class="small-text">${item.restaurant} → ${item.customer}</p>
          </div>
          <strong>${money(item.commission)}</strong>
        </div>
      `).join("")
      : `<div class="empty-card"><strong>Sin entregas todavía</strong><p class="small-text">Cuando completes pedidos aparecerán aquí.</p></div>`;

    els.deliveriesView.innerHTML = `
      <div class="info-card">
        <h1>Mis entregas</h1>
        <p class="small-text">Historial simple de entregas completadas.</p>
        ${historyItems}
      </div>
    `;
  }

  function renderEarnings() {
    els.earningsView.innerHTML = `
      ${renderAvailabilityCard()}
      <div class="summary-card">
        <h1>Ganancias</h1>
        <p class="small-text">Resumen del día del repartidor.</p>
        <div class="summary-grid">
          <div class="summary-item"><span>Entregas</span><strong>${state.today.deliveries}</strong></div>
          <div class="summary-item"><span>Ganancias</span><strong>${money(state.today.earnings)}</strong></div>
          <div class="summary-item"><span>Tiempo online</span><strong>${state.today.onlineTime}</strong></div>
          <div class="summary-item"><span>Calificación</span><strong>${state.driver.rating} ⭐</strong></div>
        </div>
      </div>

      <div class="info-card">
        <strong>Consejo del día</strong>
        <p class="small-text">Mantén buena comunicación y confirma siempre el código de entrega.</p>
      </div>
    `;
  }

  function renderProfile() {
    els.profileView.innerHTML = `
      ${renderAvailabilityCard()}
      <div class="info-card profile-header">
        <div class="avatar">R</div>
        <h1>${state.driver.name}</h1>
        <p class="small-text">Repartidor BHUZ</p>
      </div>

      <div class="info-card">
        <div class="profile-row"><span>Zona</span><strong>${state.driver.zone}</strong></div>
        <div class="profile-row"><span>Vehículo</span><strong>${state.driver.vehicle}</strong></div>
        <div class="profile-row"><span>Teléfono</span><strong>${state.driver.phone}</strong></div>
        <div class="profile-row"><span>Calificación</span><strong>${state.driver.rating} ⭐</strong></div>
      </div>
    `;
  }

  function statusPill(type, label) {
    return `<div class="status-pill ${type}">● ${label}</div>`;
  }

  function money(value) {
    return `$${Number(value || 0).toLocaleString("es-CL")}`;
  }

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => els.toast.classList.remove("show"), 2400);
  }

  function setStatus(status) {
    state.currentStatus = status;
    saveState();
    renderAll();
  }

  function setView(viewName) {
    const views = {
      home: els.homeView,
      deliveries: els.deliveriesView,
      earnings: els.earningsView,
      profile: els.profileView
    };

    Object.entries(views).forEach(([name, element]) => {
      element.classList.toggle("active", name === viewName);
    });

    els.navButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.view === viewName);
    });
  }

  function openMap(type) {
    const query = type === "restaurant" ? state.order.restaurantAddress : state.order.customerAddress;
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
    window.open(url, "_blank", "noopener");
  }

  function focusCodeInput() {
    const input = document.querySelector(".code-input");
    if (input) input.focus();
  }

  function getTypedCode() {
    return Array.from(document.querySelectorAll(".code-input")).map((input) => input.value).join("");
  }

  function confirmDeliveryCode() {
    const typedCode = getTypedCode();

    if (typedCode.length < 4) {
      showToast("Ingresa los 4 dígitos del código.");
      return;
    }

    if (typedCode !== DELIVERY_CODE) {
      showToast("Código incorrecto. Verifica con el cliente.");
      return;
    }

    state.today.deliveries += 1;
    state.today.earnings += state.order.commission;
    state.history.unshift({
      ...state.order,
      deliveredAt: new Date().toISOString()
    });

    setStatus("completed");
    showToast("Entrega confirmada correctamente.");
  }

  function resetForNextOrder() {
    state.order = { ...DEMO_ORDER };
    setStatus("available");
  }

  function applyTheme() {
    document.body.classList.toggle("dark-mode", Boolean(state.darkMode));
    els.themeToggleBtn.textContent = state.darkMode ? "☾" : "☀";
  }

  document.body.addEventListener("click", (event) => {
    const nav = event.target.closest(".nav-btn");
    if (nav) setView(nav.dataset.view);

    if (event.target.closest("[data-demo-new-order]")) {
      if (!state.online) {
        showToast("Actívate para recibir pedidos.");
      } else {
        setStatus("new_order");
      }
    }

    if (event.target.closest("[data-accept-order]")) {
      setStatus("to_local");
      showToast("Pedido aceptado. Vas en camino al local.");
    }

    if (event.target.closest("[data-reject-order]")) {
      setStatus("available");
      showToast("Pedido rechazado. Esperando otro despacho.");
    }

    const mapButton = event.target.closest("[data-open-map]");
    if (mapButton) openMap(mapButton.dataset.openMap);

    if (event.target.closest("[data-arrived-local]")) setStatus("waiting_pickup");
    if (event.target.closest("[data-picked-up]")) setStatus("to_customer");
    if (event.target.closest("[data-arrived-customer]")) setStatus("confirm_code");
    if (event.target.closest("[data-back-customer]")) setStatus("to_customer");
    if (event.target.closest("[data-confirm-code]")) confirmDeliveryCode();
    if (event.target.closest("[data-ready-next]")) resetForNextOrder();

    if (event.target.closest("[data-toggle-availability]")) toggleAvailability();

    if (event.target.closest("[data-close-menu]")) closeMenu();

    const menuView = event.target.closest("[data-menu-view]");
    if (menuView) {
      setView(menuView.dataset.menuView);
      closeMenu();
    }
  });

  document.body.addEventListener("input", (event) => {
    const input = event.target.closest(".code-input");
    if (!input) return;

    input.value = input.value.replace(/[^0-9]/g, "").slice(0, 1);
    if (input.value && input.nextElementSibling && input.nextElementSibling.classList.contains("code-input")) {
      input.nextElementSibling.focus();
    }
  });

  document.body.addEventListener("keydown", (event) => {
    const input = event.target.closest(".code-input");
    if (!input) return;

    if (event.key === "Backspace" && !input.value && input.previousElementSibling && input.previousElementSibling.classList.contains("code-input")) {
      input.previousElementSibling.focus();
    }
  });

  els.openMenuBtn.addEventListener("click", () => {
    els.sideMenu.classList.add("open");
    els.sideMenu.setAttribute("aria-hidden", "false");
  });

  els.themeToggleBtn.addEventListener("click", () => {
    state.darkMode = !state.darkMode;
    saveState();
    applyTheme();
  });

  function closeMenu() {
    els.sideMenu.classList.remove("open");
    els.sideMenu.setAttribute("aria-hidden", "true");
  }
});




