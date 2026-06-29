document.addEventListener("DOMContentLoaded", async () => {
  if (!window.DELI_SESSION_READY && typeof loadCurrentSession === "function") {
    await loadCurrentSession();
  }

  const API_BASE_URL = obtenerBackendBaseUrl();
  const POLLING_MS = 5000;

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

  const user = typeof getCurrentUser === "function" ? getCurrentUser() : null;

  const state = {
    darkMode: false,
    online: true,
    loading: false,
    availableServices: [],
    activeService: null,
    history: [],
    currentView: "home",
    pollingId: null,
    driver: crearDriverDesdeSesion(user)
  };

  if (els.menuDriverName) els.menuDriverName.textContent = state.driver.name;

  applyTheme();
  renderAll();
  await refrescarPanelRepartidor({ silent: true });
  iniciarPolling();

  function obtenerBackendBaseUrl() {
    const backend = window.BHUZ_API_URL || window.API_BASE_URL || "https://deligo-backend-i554.onrender.com";
    return String(backend).replace(/\/+$/, "");
  }

  function construirUrlApi(ruta) {
    return `${API_BASE_URL}${ruta}`;
  }

  async function fetchJson(url, opciones = {}) {
    const respuesta = await fetch(url, {
      credentials: "include",
      cache: "no-store",
      ...opciones,
      headers: {
        "Content-Type": "application/json",
        ...(opciones.headers || {})
      }
    });

    const data = await respuesta.json().catch(() => ({}));

    if (!respuesta.ok || data.ok === false) {
      throw new Error(data.message || "No se pudo completar la solicitud.");
    }

    return data;
  }

  function crearDriverDesdeSesion(currentUser) {
    const rawId = currentUser?.id || currentUser?.email || currentUser?.name || "repartidor-bhuz-demo";
    const id = String(rawId).trim().toLowerCase().replace(/[^a-z0-9@._-]/g, "-");

    return {
      id: id || "repartidor-bhuz-demo",
      name: currentUser?.name || currentUser?.fullName || "Repartidor BHUZ",
      phone: currentUser?.phone || "No visible para cliente",
      zone: "Punto Fijo",
      vehicle: "Moto",
      rating: "4.9"
    };
  }

  function iniciarPolling() {
    detenerPolling();
    state.pollingId = setInterval(() => {
      if (state.online) refrescarPanelRepartidor({ silent: true });
    }, POLLING_MS);
  }

  function detenerPolling() {
    if (state.pollingId) {
      clearInterval(state.pollingId);
      state.pollingId = null;
    }
  }

  async function refrescarPanelRepartidor({ silent = false } = {}) {
    if (state.loading) return;

    state.loading = true;
    if (!silent) renderHomeLoading();

    try {
      const [activeData, availableData, historyData] = await Promise.all([
        fetchJson(construirUrlApi(`/api/services/driver/${encodeURIComponent(state.driver.id)}/active`)),
        fetchJson(construirUrlApi("/api/services/driver/available")),
        fetchJson(construirUrlApi(`/api/services/driver/${encodeURIComponent(state.driver.id)}/history`))
      ]);

      state.activeService = activeData.service || null;
      state.availableServices = Array.isArray(availableData.services) ? availableData.services : [];
      state.history = Array.isArray(historyData.services) ? historyData.services : [];

      renderAll();
    } catch (error) {
      console.error("BHUZ panel repartidor:", error);
      if (!silent) showToast(error.message || "No se pudo conectar con el backend.");
      renderAll();
    } finally {
      state.loading = false;
    }
  }

  function renderAll() {
    renderHome();
    renderDeliveries();
    renderEarnings();
    renderProfile();
    renderMenuAvailability();
  }

  function renderHomeLoading() {
    if (!els.homeView) return;
    els.homeView.innerHTML = `
      ${statusPill("available", "Conectando")}
      <article class="main-card center-card">
        <div class="radar">🛵</div>
        <h1>Consultando servicios reales</h1>
        <p>Buscando envíos disponibles en PostgreSQL.</p>
      </article>
    `;
  }

  function renderHome() {
    if (!els.homeView) return;

    if (!state.online) {
      els.homeView.innerHTML = `
        ${statusPill("offline", "No disponible")}
        ${renderQuickSummary()}
        ${renderAvailabilityCard()}
        <article class="main-card center-card">
          <div class="radar">⏸</div>
          <h1>Estás en modo descanso</h1>
          <p>Activa tu disponibilidad para consultar servicios reales del backend.</p>
        </article>
      `;
      return;
    }

    if (state.activeService) {
      els.homeView.innerHTML = renderActiveService(state.activeService);
      return;
    }

    if (state.availableServices.length > 0) {
      els.homeView.innerHTML = `
        ${statusPill("new", `${state.availableServices.length} servicio${state.availableServices.length === 1 ? "" : "s"} disponible${state.availableServices.length === 1 ? "" : "s"}`)}
        ${renderQuickSummary()}
        ${renderAvailabilityCard()}
        <div class="info-card">
          <h1>Servicios disponibles</h1>
          <p class="small-text">Estos envíos vienen desde PostgreSQL. Ya no se usa pedido demo ni localStorage.</p>
        </div>
        ${state.availableServices.map(renderAvailableServiceCard).join("")}
      `;
      return;
    }

    els.homeView.innerHTML = `
      ${statusPill("available", "Disponible")}
      ${renderQuickSummary()}
      ${renderAvailabilityCard()}
      <article class="main-card center-card">
        <div class="radar">🛵</div>
        <h1>Esperando nuevo envío</h1>
        <p>Cuando un cliente presione Enviar paquete, aparecerá aquí automáticamente.</p>
        <div class="action-stack">
          <button class="btn btn-light" data-refresh-services="true" type="button">Actualizar servicios</button>
        </div>
      </article>
    `;
  }

  function renderQuickSummary() {
    const entregas = state.history.length;
    const ganancias = state.history.reduce((total, service) => total + calcularGananciaRepartidor(service), 0);

    return `
      <div class="quick-summary" aria-label="Resumen del día">
        <div class="quick-summary-item"><span>Entregas</span><strong>${entregas}</strong></div>
        <div class="quick-summary-item"><span>Ganancias</span><strong>${money(ganancias)}</strong></div>
        <div class="quick-summary-item"><span>Estado</span><strong>${state.online ? "Online" : "Pausa"}</strong></div>
      </div>
    `;
  }

  function renderAvailabilityCard() {
    return `
      <div class="availability-card">
        <div>
          <strong>${state.online ? "Disponible para recibir envíos" : "No disponible"}</strong>
          <p>${state.online ? "Conectado al backend y esperando servicios reales." : "Pausado temporalmente."}</p>
        </div>
        <button class="switch-btn ${state.online ? "on" : ""}" data-toggle-availability="true" type="button" aria-label="Cambiar disponibilidad"></button>
      </div>
    `;
  }

  function renderMenuAvailability() {
    if (!els.menuAvailabilityBtn) return;
    els.menuAvailabilityBtn.innerHTML = state.online
      ? "🟢 Disponible <span>Conectado para recibir envíos</span>"
      : "🔴 No disponible <span>Pausado temporalmente</span>";
  }

  function renderAvailableServiceCard(service) {
    const distancia = obtenerDistanciaTexto(service);
    const ganancia = calcularGananciaRepartidor(service);

    return `
      <article class="main-card">
        <div class="order-header">
          <div class="logo-circle">📦</div>
          <div>
            <h1>Envío de paquete</h1>
            <p>Servicio #${escapeHtml(service.id)}</p>
            <p class="small-text">${escapeHtml(service.packageSize || "Tamaño no indicado")}</p>
          </div>
        </div>

        <div class="section-line">
          <strong>Descripción breve</strong>
          <ul class="brief-list">
            <li>${escapeHtml(service.packageDescription || "Paquete sin descripción")}</li>
          </ul>
        </div>

        <div class="restaurant-box">
          <strong>Retiro</strong>
          <p>${escapeHtml(service.pickupAddress || "Dirección de retiro")}</p>
          <p class="small-text">${escapeHtml(service.pickupReference || "Sin referencia adicional")}</p>
        </div>

        <div class="customer-box">
          <strong>Entrega a</strong>
          <p>${escapeHtml(service.receiverName || "Receptor")}</p>
          <p class="small-text">${escapeHtml(service.deliveryAddress || "Dirección de entrega")}</p>
        </div>

        <div class="order-meta">
          <div class="meta-box green"><span>Distancia</span><strong>${distancia}</strong></div>
          <div class="meta-box blue"><span>Total</span><strong>${money(service.totalAmount)}</strong></div>
          <div class="meta-box green"><span>Ganancia</span><strong>${money(ganancia)}</strong></div>
        </div>

        <div class="action-stack">
          <button class="btn btn-green" data-accept-service="${escapeHtml(service.id)}" type="button">Aceptar servicio</button>
          <button class="btn btn-blue" data-open-pickup-map="${escapeHtml(service.id)}" type="button">⌁ Ver retiro</button>
        </div>
      </article>
    `;
  }

  function renderActiveService(service) {
    const status = service.status || "DRIVER_ASSIGNED";

    if (status === "DRIVER_ASSIGNED") return renderGoingToPickup(service);
    if (status === "GOING_TO_PICKUP") return renderGoingToPickup(service);
    if (status === "PACKAGE_PICKED") return renderPackagePicked(service);
    if (status === "GOING_TO_DELIVERY") return renderGoingToDelivery(service);

    return renderGoingToPickup(service);
  }

  function renderGoingToPickup(service) {
    return `
      ${statusPill("local", "En camino al retiro")}
      <article class="main-card">
        <div class="order-header">
          <div class="step-icon">📍</div>
          <div>
            <h1>Retirar paquete</h1>
            <p>${escapeHtml(service.pickupAddress || "Dirección de retiro")}</p>
          </div>
        </div>
        <div class="map-preview" aria-label="Vista previa del mapa"></div>
        <div class="order-meta">
          <div class="meta-box orange"><span>Distancia total</span><strong>${obtenerDistanciaTexto(service)}</strong></div>
          <div class="meta-box blue"><span>Total</span><strong>${money(service.totalAmount)}</strong></div>
          <div class="meta-box green"><span>Ganancia</span><strong>${money(calcularGananciaRepartidor(service))}</strong></div>
        </div>
        <div class="notice-box">
          <strong>Referencia de retiro</strong>
          <p class="small-text">${escapeHtml(service.pickupReference || "Sin referencia adicional")}</p>
        </div>
        <div class="action-stack">
          <button class="btn btn-blue" data-open-active-map="pickup" type="button">⌁ Abrir mapa retiro</button>
          <button class="btn btn-light" data-status-service="GOING_TO_PICKUP" type="button">Voy al retiro</button>
          <button class="btn btn-green" data-status-service="PACKAGE_PICKED" type="button">Paquete retirado</button>
        </div>
      </article>
    `;
  }

  function renderPackagePicked(service) {
    return `
      ${statusPill("pickup", "Paquete retirado")}
      <article class="main-card">
        <div class="order-header">
          <div class="step-icon">📦</div>
          <div>
            <h1>Paquete retirado</h1>
            <p>Servicio #${escapeHtml(service.id)}</p>
          </div>
        </div>
        <div class="section-line">
          <strong>Descripción breve</strong>
          <ul class="brief-list"><li>${escapeHtml(service.packageDescription || "Paquete")}</li></ul>
        </div>
        <div class="customer-box">
          <strong>Entrega a</strong>
          <p>${escapeHtml(service.receiverName || "Receptor")}</p>
          <p class="small-text">${escapeHtml(service.deliveryAddress || "Dirección de entrega")}</p>
        </div>
        <div class="action-stack">
          <button class="btn btn-green" data-status-service="GOING_TO_DELIVERY" type="button">Ir a entregar</button>
        </div>
      </article>
    `;
  }

  function renderGoingToDelivery(service) {
    return `
      ${statusPill("client", "En camino al receptor")}
      <article class="main-card">
        <div class="order-header">
          <div class="step-icon">👤</div>
          <div>
            <p>Entrega a</p>
            <h1>${escapeHtml(service.receiverName || "Receptor")}</h1>
            <p>${escapeHtml(service.deliveryAddress || "Dirección de entrega")}</p>
          </div>
        </div>
        <div class="section-line">
          <strong>Descripción breve</strong>
          <ul class="brief-list"><li>${escapeHtml(service.packageDescription || "Paquete")}</li></ul>
        </div>
        <div class="order-meta">
          <div class="meta-box orange"><span>Distancia</span><strong>${obtenerDistanciaTexto(service)}</strong></div>
          <div class="meta-box blue"><span>Total</span><strong>${money(service.totalAmount)}</strong></div>
          <div class="meta-box green"><span>Ganancia</span><strong>${money(calcularGananciaRepartidor(service))}</strong></div>
        </div>
        <div class="notice-box">
          <strong>Importante</strong>
          <p class="small-text">Pide el código único al receptor antes de cerrar la entrega.</p>
        </div>
        <div class="action-stack">
          <button class="btn btn-orange" data-open-active-map="delivery" type="button">⌁ Abrir mapa entrega</button>
          <button class="btn btn-light" data-show-code-panel="true" type="button">Llegué al receptor</button>
        </div>
        <div id="driver-code-panel" class="notice-box" style="display:none; margin-top:14px;">
          <strong>Código de entrega</strong>
          <p class="small-text">Ingresa el código que ve el receptor en su pantalla.</p>
          <input id="driver-delivery-code-input" inputmode="numeric" maxlength="6" placeholder="Código de 6 dígitos" style="width:100%;padding:14px;border-radius:14px;border:1px solid rgba(255,255,255,.15);font-size:18px;text-align:center;" />
          <div class="action-stack" style="margin-top:12px;">
            <button class="btn btn-green" data-confirm-delivery="true" type="button">Confirmar entrega</button>
          </div>
        </div>
      </article>
    `;
  }

  function renderDeliveries() {
    if (!els.deliveriesView) return;

    const historyItems = state.history.length
      ? state.history.map((item) => `
        <div class="history-item">
          <div>
            <strong>${escapeHtml(item.id)}</strong>
            <p class="small-text">${escapeHtml(item.pickupAddress || "Retiro")} → ${escapeHtml(item.deliveryAddress || "Entrega")}</p>
          </div>
          <strong>${money(calcularGananciaRepartidor(item))}</strong>
        </div>
      `).join("")
      : `<div class="empty-card"><strong>Sin entregas todavía</strong><p class="small-text">Cuando completes servicios reales aparecerán aquí.</p></div>`;

    els.deliveriesView.innerHTML = `
      <div class="info-card">
        <h1>Mis entregas</h1>
        <p class="small-text">Historial real de servicios entregados desde PostgreSQL.</p>
        ${historyItems}
      </div>
    `;
  }

  function renderEarnings() {
    if (!els.earningsView) return;

    const entregas = state.history.length;
    const ganancias = state.history.reduce((total, service) => total + calcularGananciaRepartidor(service), 0);

    els.earningsView.innerHTML = `
      ${renderAvailabilityCard()}
      <div class="summary-card">
        <h1>Ganancias</h1>
        <p class="small-text">Resumen real basado en servicios entregados.</p>
        <div class="summary-grid">
          <div class="summary-item"><span>Entregas</span><strong>${entregas}</strong></div>
          <div class="summary-item"><span>Ganancias</span><strong>${money(ganancias)}</strong></div>
          <div class="summary-item"><span>Disponible</span><strong>${state.online ? "Sí" : "No"}</strong></div>
          <div class="summary-item"><span>Calificación</span><strong>${state.driver.rating} ⭐</strong></div>
        </div>
      </div>
    `;
  }

  function renderProfile() {
    if (!els.profileView) return;

    els.profileView.innerHTML = `
      ${renderAvailabilityCard()}
      <div class="info-card profile-header">
        <div class="avatar">R</div>
        <h1>${escapeHtml(state.driver.name)}</h1>
        <p class="small-text">Repartidor BHUZ</p>
      </div>
      <div class="info-card">
        <div class="profile-row"><span>ID</span><strong>${escapeHtml(state.driver.id)}</strong></div>
        <div class="profile-row"><span>Zona</span><strong>${escapeHtml(state.driver.zone)}</strong></div>
        <div class="profile-row"><span>Vehículo</span><strong>${escapeHtml(state.driver.vehicle)}</strong></div>
        <div class="profile-row"><span>Teléfono</span><strong>${escapeHtml(state.driver.phone)}</strong></div>
        <div class="profile-row"><span>Calificación</span><strong>${state.driver.rating} ⭐</strong></div>
      </div>
    `;
  }

  async function aceptarServicio(serviceId) {
    try {
      const data = await fetchJson(construirUrlApi(`/api/services/${encodeURIComponent(serviceId)}/accept`), {
        method: "POST",
        body: JSON.stringify({
          driverId: state.driver.id,
          driverName: state.driver.name,
          driverPhone: state.driver.phone
        })
      });

      state.activeService = data.service;
      state.availableServices = state.availableServices.filter((service) => service.id !== serviceId);
      renderAll();
      showToast("Servicio aceptado. Ve al punto de retiro.");
    } catch (error) {
      showToast(error.message || "No se pudo aceptar el servicio.");
      await refrescarPanelRepartidor({ silent: true });
    }
  }

  async function cambiarEstadoServicio(status) {
    if (!state.activeService?.id) return;

    try {
      const data = await fetchJson(construirUrlApi(`/api/services/${encodeURIComponent(state.activeService.id)}/status`), {
        method: "POST",
        body: JSON.stringify({
          status,
          changedBy: state.driver.id,
          notes: `Repartidor actualizó estado a ${status}`
        })
      });

      state.activeService = data.service;
      renderAll();
      showToast(mensajeEstado(status));
    } catch (error) {
      showToast(error.message || "No se pudo actualizar el estado.");
    }
  }

  async function confirmarEntrega() {
    if (!state.activeService?.id) return;

    const input = document.getElementById("driver-delivery-code-input");
    const code = String(input?.value || "").trim();

    if (code.length < 4) {
      showToast("Ingresa el código de entrega.");
      return;
    }

    try {
      const data = await fetchJson(construirUrlApi(`/api/services/${encodeURIComponent(state.activeService.id)}/confirm-delivery`), {
        method: "POST",
        body: JSON.stringify({
          deliveryCode: code,
          driverId: state.driver.id,
          driverName: state.driver.name
        })
      });

      state.history.unshift(data.service);
      state.activeService = null;
      await refrescarPanelRepartidor({ silent: true });
      setView("home");
      showToast("Entrega confirmada correctamente.");
    } catch (error) {
      showToast(error.message || "Código incorrecto o entrega no confirmada.");
    }
  }

  function toggleAvailability() {
    if (state.activeService) {
      showToast("Termina el servicio activo antes de cambiar disponibilidad.");
      return;
    }

    state.online = !state.online;
    renderAll();
    showToast(state.online ? "Estás disponible para recibir envíos." : "Modo descanso activado.");

    if (state.online) refrescarPanelRepartidor({ silent: true });
  }

  function openMapByService(service, type) {
    if (!service) return;

    const lat = type === "pickup" ? service.pickupLatitude : service.deliveryLatitude;
    const lng = type === "pickup" ? service.pickupLongitude : service.deliveryLongitude;
    const address = type === "pickup" ? service.pickupAddress : service.deliveryAddress;

    const query = Number(lat) && Number(lng) ? `${lat},${lng}` : address;
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query || "Punto Fijo")}`;
    window.open(url, "_blank", "noopener");
  }

  function setView(viewName) {
    state.currentView = viewName;

    const views = {
      home: els.homeView,
      deliveries: els.deliveriesView,
      earnings: els.earningsView,
      profile: els.profileView
    };

    Object.entries(views).forEach(([name, element]) => {
      if (element) element.classList.toggle("active", name === viewName);
    });

    els.navButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.view === viewName);
    });
  }

  function statusPill(type, label) {
    return `<div class="status-pill ${type}">● ${escapeHtml(label)}</div>`;
  }

  function money(value) {
    const amount = Number(value || 0);
    return `$${amount.toFixed(2)}`;
  }

  function obtenerDistanciaTexto(service) {
    const distancia = Number(service?.distanceKm || 0);
    if (!distancia) return "Por calcular";
    if (distancia < 0.1) return "Menos de 100 m";
    return `${distancia.toFixed(2)} km`;
  }

  function calcularGananciaRepartidor(service) {
    const total = Number(service?.totalAmount || 0);
    if (!total) return 0;
    return redondear(Math.max(1, total * 0.1));
  }

  function redondear(value) {
    return Math.round(Number(value || 0) * 100) / 100;
  }

  function mensajeEstado(status) {
    const mensajes = {
      GOING_TO_PICKUP: "Vas en camino al retiro.",
      PACKAGE_PICKED: "Paquete marcado como retirado.",
      GOING_TO_DELIVERY: "Vas en camino al receptor."
    };
    return mensajes[status] || "Estado actualizado.";
  }

  function showToast(message) {
    if (!els.toast) return;
    els.toast.textContent = message;
    els.toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => els.toast.classList.remove("show"), 2600);
  }

  function applyTheme() {
    document.body.classList.toggle("dark-mode", Boolean(state.darkMode));
    if (els.themeToggleBtn) els.themeToggleBtn.textContent = state.darkMode ? "☾" : "☀";
  }

  function closeMenu() {
    if (!els.sideMenu) return;
    els.sideMenu.classList.remove("open");
    els.sideMenu.setAttribute("aria-hidden", "true");
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  document.body.addEventListener("click", async (event) => {
    const nav = event.target.closest(".nav-btn");
    if (nav) setView(nav.dataset.view);

    if (event.target.closest("[data-refresh-services]")) {
      await refrescarPanelRepartidor({ silent: false });
    }

    const acceptButton = event.target.closest("[data-accept-service]");
    if (acceptButton) {
      await aceptarServicio(acceptButton.dataset.acceptService);
    }

    const statusButton = event.target.closest("[data-status-service]");
    if (statusButton) {
      await cambiarEstadoServicio(statusButton.dataset.statusService);
    }

    if (event.target.closest("[data-show-code-panel]")) {
      const panel = document.getElementById("driver-code-panel");
      if (panel) panel.style.display = "block";
      const input = document.getElementById("driver-delivery-code-input");
      if (input) input.focus();
    }

    if (event.target.closest("[data-confirm-delivery]")) {
      await confirmarEntrega();
    }

    const pickupMapButton = event.target.closest("[data-open-pickup-map]");
    if (pickupMapButton) {
      const service = state.availableServices.find((item) => item.id === pickupMapButton.dataset.openPickupMap);
      openMapByService(service, "pickup");
    }

    const activeMapButton = event.target.closest("[data-open-active-map]");
    if (activeMapButton) {
      openMapByService(state.activeService, activeMapButton.dataset.openActiveMap);
    }

    if (event.target.closest("[data-toggle-availability]")) toggleAvailability();
    if (event.target.closest("[data-close-menu]")) closeMenu();

    const menuView = event.target.closest("[data-menu-view]");
    if (menuView) {
      setView(menuView.dataset.menuView);
      closeMenu();
    }
  });

  document.body.addEventListener("input", (event) => {
    const input = event.target.closest("#driver-delivery-code-input");
    if (!input) return;
    input.value = input.value.replace(/[^0-9]/g, "").slice(0, 6);
  });

  if (els.openMenuBtn) {
    els.openMenuBtn.addEventListener("click", () => {
      els.sideMenu.classList.add("open");
      els.sideMenu.setAttribute("aria-hidden", "false");
    });
  }

  if (els.themeToggleBtn) {
    els.themeToggleBtn.addEventListener("click", () => {
      state.darkMode = !state.darkMode;
      applyTheme();
    });
  }

  window.addEventListener("beforeunload", detenerPolling);
});





