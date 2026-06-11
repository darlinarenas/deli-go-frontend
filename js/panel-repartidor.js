document.addEventListener("DOMContentLoaded", async () => {
  if (!window.DELI_SESSION_READY && typeof loadCurrentSession === "function") {
    await loadCurrentSession();
  }

  const STORAGE_KEY = "bhuzDriverAssistantPanelDemo";

  const DEMO_ORDER = {
    id: "BHZ-1042",
    restaurant: "Burger Punto",
    restaurantAddress: "Av. Jacinto Lara, Punto Fijo",
    restaurantDistance: "1.8 km",
    customer: "María González",
    customerPhone: "+584121112233",
    customerAddress: "Santa Irene, calle 4, casa azul",
    customerDistance: "3.4 km",
    items: "2 Hamburguesas clásicas, 1 papas grandes",
    payment: "Pago móvil",
    total: 18.5,
    deliveryFee: 2.5,
    commission: 2.0,
    etaPickup: "8 min",
    etaDelivery: "15 min"
  };

  const STEPS = [
    {
      key: "waiting",
      label: "Esperando pedido"
    },
    {
      key: "new_order",
      label: "Pedido recibido"
    },
    {
      key: "to_restaurant",
      label: "En camino al local"
    },
    {
      key: "at_restaurant",
      label: "Llegué al local"
    },
    {
      key: "to_customer",
      label: "En camino al cliente"
    },
    {
      key: "delivered",
      label: "Pedido entregado"
    }
  ];

  const els = {
    driverStatusText: document.getElementById("driverStatusText"),
    toggleDriverStatusBtn: document.getElementById("toggleDriverStatusBtn"),
    mainFlowBox: document.getElementById("mainFlowBox"),
    sidePanel: document.getElementById("sidePanel"),
    sidePanelTitle: document.getElementById("sidePanelTitle"),
    sidePanelBody: document.getElementById("sidePanelBody"),
    toast: document.getElementById("toast")
  };

  let state = loadState();

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved && saved.flow) return saved;
    } catch (error) {
      console.warn("No se pudo cargar demo repartidor", error);
    }

    return {
      online: true,
      flow: "new_order",
      activeOrder: DEMO_ORDER,
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

  function render() {
    renderHeader();
    renderMainFlow();
  }

  function renderHeader() {
    els.driverStatusText.textContent = state.online ? "Disponible" : "Pausado";
    els.toggleDriverStatusBtn.textContent = state.online ? "Pausar" : "Activarme";
  }

  function renderMainFlow() {
    if (!state.online) {
      els.mainFlowBox.innerHTML = renderPaused();
      return;
    }

    if (!state.activeOrder && state.flow !== "delivered") {
      els.mainFlowBox.innerHTML = renderWaiting();
      return;
    }

    const screens = {
      waiting: renderWaiting,
      new_order: renderNewOrder,
      to_restaurant: renderToRestaurant,
      at_restaurant: renderAtRestaurant,
      to_customer: renderToCustomer,
      delivered: renderDelivered
    };

    els.mainFlowBox.innerHTML = (screens[state.flow] || renderWaiting)();
  }

  function renderPaused() {
    return `
      <div class="flow-screen">
        <div class="flow-top">
          <div class="flow-icon">⏸️</div>
          <h1>Estás pausado</h1>
          <p>Actívate cuando estés listo para recibir despachos.</p>
        </div>

        <div class="primary-actions">
          <button class="btn btn-primary" data-toggle-online="true" type="button">Activarme</button>
        </div>
      </div>
    `;
  }

  function renderWaiting() {
    return `
      <div class="flow-screen">
        <div class="flow-top">
          <div class="waiting-pulse">🛵</div>
          <h1>Esperando pedido</h1>
          <p>Cuando entre un despacho, BHUZ te mostrará solo uno a la vez.</p>
        </div>

        <div class="primary-actions">
          <button class="btn btn-light" data-demo-new-order="true" type="button">Simular nuevo pedido</button>
        </div>
      </div>
    `;
  }

  function renderNewOrder() {
    const order = state.activeOrder;

    return `
      <div class="flow-screen">
        <div class="flow-top">
          <div class="flow-icon">🔔</div>
          <h1>Nuevo despacho</h1>
          <p>Revisa lo importante y decide si lo aceptas.</p>
        </div>

        <div class="big-info-card">
          <div class="restaurant-name">${order.restaurant}</div>
          <p>Retiro a ${order.restaurantDistance} de ti.</p>

          <div class="route-summary">
            <div class="route-item">
              <span>Retiro</span>
              <strong>${order.restaurantDistance} · ${order.etaPickup}</strong>
            </div>
            <div class="route-item">
              <span>Entrega</span>
              <strong>${order.customerDistance} · ${order.etaDelivery}</strong>
            </div>
          </div>
        </div>

        <div class="earnings-highlight">
          <span>Ganarás por este despacho</span>
          <strong>${money(order.commission)}</strong>
        </div>

        <div class="primary-actions">
          <button class="btn btn-primary" data-accept-order="true" type="button">Aceptar despacho</button>
          <button class="btn btn-light" data-open-maps="${order.restaurantAddress}" type="button">Ver restaurante en mapa</button>
        </div>

        <div class="secondary-actions">
          <button class="btn btn-light" data-panel="order" type="button">Ver detalles</button>
          <button class="btn btn-danger" data-reject-order="true" type="button">Rechazar</button>
        </div>
      </div>
    `;
  }

  function renderToRestaurant() {
    const order = state.activeOrder;

    return `
      <div class="flow-screen">
        <div class="flow-top">
          <div class="flow-icon">🏪</div>
          <h1>Ve al local</h1>
          <p>El pedido quedó aceptado y estás en camino hacia el restaurante.</p>
        </div>

        ${renderProgress("to_restaurant")}

        <div class="big-info-card">
          <div class="restaurant-name">${order.restaurant}</div>
          <p>${order.restaurantAddress}</p>

          <div class="route-summary">
            <div class="route-item">
              <span>Distancia al local</span>
              <strong>${order.restaurantDistance}</strong>
            </div>
            <div class="route-item">
              <span>Tiempo estimado</span>
              <strong>${order.etaPickup}</strong>
            </div>
          </div>
        </div>

        <div class="primary-actions">
          <button class="btn btn-dark" data-open-maps="${order.restaurantAddress}" type="button">Abrir GPS al local</button>
          <button class="btn btn-primary" data-next-flow="at_restaurant" type="button">Ya llegué al local</button>
        </div>

        <div class="secondary-actions">
          <button class="btn btn-light" data-panel="order" type="button">Ver detalles</button>
          <button class="btn btn-light" data-panel="support" type="button">Ayuda</button>
        </div>
      </div>
    `;
  }

  function renderAtRestaurant() {
    const order = state.activeOrder;

    return `
      <div class="flow-screen">
        <div class="flow-top">
          <div class="flow-icon">📦</div>
          <h1>Retira el pedido</h1>
          <p>Confirma solo cuando el restaurante te entregue el pedido.</p>
        </div>

        ${renderProgress("at_restaurant")}

        <div class="big-info-card">
          <div class="restaurant-name">Pedido ${order.id}</div>
          <p>Local: ${order.restaurant}</p>
        </div>

        <div class="primary-actions">
          <button class="btn btn-primary" data-next-flow="to_customer" type="button">Pedido retirado</button>
        </div>

        <div class="secondary-actions">
          <button class="btn btn-light" data-panel="order" type="button">Ver productos</button>
          <button class="btn btn-light" data-panel="support" type="button">Ayuda</button>
        </div>
      </div>
    `;
  }

  function renderToCustomer() {
    const order = state.activeOrder;

    return `
      <div class="flow-screen">
        <div class="flow-top">
          <div class="flow-icon">🚚</div>
          <h1>Entrega al cliente</h1>
          <p>Dirígete a la dirección del cliente y marca entregado al finalizar.</p>
        </div>

        ${renderProgress("to_customer")}

        <div class="big-info-card">
          <div class="restaurant-name">Cliente a ${order.customerDistance}</div>
          <p>${order.customerAddress}</p>

          <div class="route-summary">
            <div class="route-item">
              <span>Tiempo estimado</span>
              <strong>${order.etaDelivery}</strong>
            </div>
            <div class="route-item">
              <span>Ganancia</span>
              <strong>${money(order.commission)}</strong>
            </div>
          </div>
        </div>

        <div class="primary-actions">
          <button class="btn btn-dark" data-open-maps="${order.customerAddress}" type="button">Abrir GPS al cliente</button>
          <button class="btn btn-primary" data-next-flow="delivered" type="button">Pedido entregado</button>
        </div>

        <div class="secondary-actions">
          <button class="btn btn-light" data-panel="client" type="button">Ver cliente</button>
          <button class="btn btn-light" data-panel="payment" type="button">Ver pago</button>
        </div>
      </div>
    `;
  }

  function renderDelivered() {
    const lastOrder = state.history[0];

    return `
      <div class="flow-screen">
        <div class="flow-top">
          <div class="flow-icon">✅</div>
          <h1>Entrega completada</h1>
          <p>Buen trabajo. Quedaste disponible para el próximo despacho.</p>
        </div>

        <div class="earnings-highlight">
          <span>Ganaste</span>
          <strong>${money(lastOrder ? lastOrder.commission : 0)}</strong>
        </div>

        <div class="primary-actions">
          <button class="btn btn-primary" data-finish-delivery="true" type="button">Esperar próximo pedido</button>
        </div>

        <div class="secondary-actions">
          <button class="btn btn-light" data-panel="earnings" type="button">Ganancias</button>
          <button class="btn btn-light" data-panel="history" type="button">Historial</button>
        </div>
      </div>
    `;
  }

  function renderProgress(currentFlow) {
    const progress = [
      { key: "to_restaurant", label: "Aceptado · camino al local" },
      { key: "at_restaurant", label: "Llegué al local" },
      { key: "to_customer", label: "Pedido retirado · camino al cliente" },
      { key: "delivered", label: "Entregado" }
    ];

    const currentIndex = progress.findIndex((item) => item.key === currentFlow);

    return `
      <div class="progress-box">
        ${progress.map((item, index) => `
          <div class="progress-step ${index <= currentIndex ? "done" : ""}">
            <span class="progress-dot"></span>
            <span>${item.label}</span>
          </div>
        `).join("")}
      </div>
    `;
  }

  function acceptOrder() {
    state.flow = "to_restaurant";
    saveState();
    render();
    showToast("Pedido aceptado. Estado: en camino al local.");
  }

  function rejectOrder() {
    state.activeOrder = null;
    state.flow = "waiting";
    saveState();
    render();
    showToast("Pedido rechazado. Se enviará a otro repartidor.");
  }

  function nextFlow(flow) {
    if (flow === "delivered") {
      state.history.unshift({
        ...state.activeOrder,
        deliveredAt: new Date().toISOString()
      });
      state.activeOrder = null;
      state.flow = "delivered";
      saveState();
      render();
      showToast("Pedido entregado. Ganancia registrada.");
      return;
    }

    state.flow = flow;
    saveState();
    render();

    const labels = {
      at_restaurant: "Llegaste al local.",
      to_customer: "Pedido retirado. Estado: en camino al cliente."
    };

    showToast(labels[flow] || "Estado actualizado.");
  }

  function finishDelivery() {
    state.flow = "waiting";
    state.activeOrder = null;
    saveState();
    render();
  }

  function simulateNewOrder() {
    state.activeOrder = { ...DEMO_ORDER, id: `BHZ-${Math.floor(1000 + Math.random() * 8999)}` };
    state.flow = "new_order";
    saveState();
    render();
    showToast("Nuevo despacho recibido.");
  }

  function openMaps(address) {
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    window.open(url, "_blank", "noopener");
  }

  function openPanel(panelName) {
    const order = state.activeOrder || state.history[0] || DEMO_ORDER;
    const earnings = state.history.reduce((sum, item) => sum + Number(item.commission || 0), 0);

    const panels = {
      order: {
        title: "Detalles del pedido",
        body: `
          <div class="info-list">
            <div class="info-item"><span>Pedido</span><strong>${order.id}</strong></div>
            <div class="info-item"><span>Restaurante</span><p>${order.restaurant}<br>${order.restaurantAddress}</p></div>
            <div class="info-item"><span>Productos</span><p>${order.items}</p></div>
            <div class="info-item"><span>Entrega</span><p>${order.customerAddress}</p></div>
            <div class="info-item"><span>Ganancia</span><strong>${money(order.commission)}</strong></div>
          </div>
        `
      },
      client: {
        title: "Datos del cliente",
        body: `
          <div class="info-list">
            <div class="info-item"><span>Cliente</span><strong>${order.customer}</strong></div>
            <div class="info-item"><span>Dirección</span><p>${order.customerAddress}</p></div>
            <div class="info-item"><span>Teléfono</span><p>${order.customerPhone}</p></div>
            <a class="btn btn-primary" href="https://wa.me/${cleanPhone(order.customerPhone)}" target="_blank" rel="noopener">WhatsApp cliente</a>
          </div>
        `
      },
      payment: {
        title: "Pago del pedido",
        body: `
          <div class="info-list">
            <div class="info-item"><span>Método</span><strong>${order.payment}</strong></div>
            <div class="info-item"><span>Total pedido</span><strong>${money(order.total)}</strong></div>
            <div class="info-item"><span>Delivery</span><strong>${money(order.deliveryFee)}</strong></div>
            <div class="info-item"><span>Ganancia repartidor</span><strong>${money(order.commission)}</strong></div>
          </div>
        `
      },
      earnings: {
        title: "Mis ganancias",
        body: `
          <div class="info-list">
            <div class="info-item"><span>Ganancia acumulada demo</span><strong>${money(earnings)}</strong></div>
            <div class="info-item"><span>Entregas completadas</span><strong>${state.history.length}</strong></div>
            <div class="info-item"><span>Estado</span><p>Esta vista todavía es demo frontend. Luego se conectará al backend.</p></div>
          </div>
        `
      },
      history: {
        title: "Historial",
        body: state.history.length
          ? `<div class="info-list">${state.history.map((item) => `
              <div class="info-item">
                <span>${item.id}</span>
                <strong>${item.restaurant}</strong>
                <p>${item.customerAddress}</p>
                <p>Ganancia: ${money(item.commission)}</p>
              </div>
            `).join("")}</div>`
          : `<div class="info-list"><div class="info-item"><span>Historial</span><p>Aún no tienes entregas completadas en esta demo.</p></div></div>`
      },
      profile: {
        title: "Perfil repartidor",
        body: `
          <div class="info-list">
            <div class="info-item"><span>Nombre</span><strong>Repartidor BHUZ</strong></div>
            <div class="info-item"><span>Zona</span><p>Punto Fijo</p></div>
            <div class="info-item"><span>Vehículo</span><p>Moto</p></div>
            <div class="info-item"><span>Estado</span><p>${state.online ? "Disponible" : "Pausado"}</p></div>
          </div>
        `
      },
      support: {
        title: "Ayuda",
        body: `
          <div class="info-list">
            <div class="info-item"><span>Problema con el local</span><p>Más adelante aquí irá contacto con soporte BHUZ.</p></div>
            <div class="info-item"><span>Problema con el cliente</span><p>El repartidor podrá reportar incidencia sin llenar la pantalla principal.</p></div>
          </div>
        `
      }
    };

    const panel = panels[panelName] || panels.order;
    els.sidePanelTitle.textContent = panel.title;
    els.sidePanelBody.innerHTML = panel.body;
    els.sidePanel.classList.add("open");
    els.sidePanel.setAttribute("aria-hidden", "false");
  }

  function closePanel() {
    els.sidePanel.classList.remove("open");
    els.sidePanel.setAttribute("aria-hidden", "true");
  }

  function cleanPhone(phone) {
    return String(phone || "").replace(/[^0-9]/g, "");
  }

  document.body.addEventListener("click", (event) => {
    const toggleOnline = event.target.closest("[data-toggle-online]");
    if (toggleOnline) {
      state.online = true;
      saveState();
      render();
      showToast("Repartidor disponible.");
      return;
    }

    const acceptButton = event.target.closest("[data-accept-order]");
    if (acceptButton) {
      acceptOrder();
      return;
    }

    const rejectButton = event.target.closest("[data-reject-order]");
    if (rejectButton) {
      rejectOrder();
      return;
    }

    const nextButton = event.target.closest("[data-next-flow]");
    if (nextButton) {
      nextFlow(nextButton.dataset.nextFlow);
      return;
    }

    const finishButton = event.target.closest("[data-finish-delivery]");
    if (finishButton) {
      finishDelivery();
      return;
    }

    const demoButton = event.target.closest("[data-demo-new-order]");
    if (demoButton) {
      simulateNewOrder();
      return;
    }

    const mapsButton = event.target.closest("[data-open-maps]");
    if (mapsButton) {
      openMaps(mapsButton.dataset.openMaps);
      return;
    }

    const panelButton = event.target.closest("[data-panel]");
    if (panelButton) {
      openPanel(panelButton.dataset.panel);
      return;
    }

    const closeButton = event.target.closest("[data-close-panel]");
    if (closeButton) {
      closePanel();
    }
  });

  els.toggleDriverStatusBtn.addEventListener("click", () => {
    state.online = !state.online;
    saveState();
    render();
    showToast(state.online ? "Repartidor disponible." : "Repartidor pausado.");
  });

  render();
});

