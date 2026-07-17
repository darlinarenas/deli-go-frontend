(() => {
  "use strict";

  const API_URL = window.DELI_API_URL || "https://deligo-backend-i554.onrender.com";
  let services = [];
  let selectedId = "";
  let eventsBound = false;
  let loadedOnce = false;

  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[char]);

  const statusLabels = {
    PENDING_PAYMENT: "Pendiente de pago",
    PAID: "Pagado",
    WAITING_RECEIVER_LOCATION: "Esperando ubicación",
    SEARCHING_DRIVER: "Buscando repartidor",
    DRIVER_ASSIGNED: "Repartidor asignado",
    GOING_TO_PICKUP: "En camino al retiro",
    PACKAGE_PICKED: "Paquete retirado",
    GOING_TO_DELIVERY: "En camino a la entrega",
    DELIVERED: "Entregado",
    CANCELLED: "Cancelado"
  };

  const statusLabel = (value) => statusLabels[String(value || "").toUpperCase()] || String(value || "Pendiente").replaceAll("_", " ");
  const money = (value) => `$${Number(value || 0).toFixed(2)}`;
  const isActive = (service) => !["DELIVERED", "CANCELLED"].includes(String(service.status || "").toUpperCase());
  const formatDate = (value) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat("es-VE", { dateStyle: "medium", timeStyle: "short" }).format(date);
  };

  function getFilteredServices() {
    const query = (document.getElementById("adminServicesSearch")?.value || "").trim().toLowerCase();
    const filter = document.getElementById("adminServicesStatus")?.value || "ALL";

    return services.filter((service) => {
      const status = String(service.status || "").toUpperCase();
      const statusMatches = filter === "ALL" || (filter === "ACTIVE" && isActive(service)) || status === filter;
      const searchable = [
        service.id, service.customerName, service.customerEmail, service.customerPhone,
        service.receiverName, service.receiverPhone, service.pickupAddress,
        service.deliveryAddress, service.driverName, service.driverVehiclePlate,
        service.packageDescription
      ].join(" ").toLowerCase();
      return statusMatches && (!query || searchable.includes(query));
    });
  }

  function renderStats() {
    const box = document.getElementById("adminServicesStats");
    if (!box) return;

    const active = services.filter(isActive).length;
    const searching = services.filter((service) => String(service.status).toUpperCase() === "SEARCHING_DRIVER").length;
    const delivered = services.filter((service) => String(service.status).toUpperCase() === "DELIVERED");
    const billed = delivered.reduce((total, service) => total + Number(service.totalAmount || 0), 0);

    box.innerHTML = `
      <article><span>Total</span><strong>${services.length}</strong></article>
      <article><span>Activos</span><strong>${active}</strong></article>
      <article><span>Buscando repartidor</span><strong>${searching}</strong></article>
      <article><span>Entregados</span><strong>${delivered.length}</strong></article>
      <article><span>Facturación entregada</span><strong>${money(billed)}</strong></article>`;

    const badge = document.getElementById("enviosActivosBadge");
    if (badge) {
      badge.textContent = String(active);
      badge.classList.toggle("hidden", active === 0);
    }
  }

  function renderDetail() {
    const box = document.getElementById("adminServiceDetail");
    if (!box) return;
    const service = services.find((item) => item.id === selectedId);
    if (!service) {
      box.innerHTML = '<div class="empty-box">Selecciona un paquete para ver sus detalles.</div>';
      return;
    }

    const driver = service.driverName
      ? `${service.driverName}${service.driverVehicleType ? ` · ${service.driverVehicleType}` : ""}${service.driverVehiclePlate ? ` · ${service.driverVehiclePlate}` : ""}`
      : "Aún sin repartidor";

    box.innerHTML = `
      <div class="service-detail-head">
        <div><span class="mini-label">${esc(service.id)}</span><h3>${esc(service.packageDescription || "Paquete")}</h3><p>${esc(statusLabel(service.status))}</p></div>
        <span class="service-status status-${esc(String(service.status || "").toLowerCase())}">${esc(statusLabel(service.status))}</span>
      </div>
      <details open><summary>Ruta y entrega</summary><div class="service-detail-grid">
        <p><b>Retiro</b>${esc(service.pickupAddress || "—")}<small>${esc(service.pickupReference || "Sin referencia")}</small></p>
        <p><b>Entrega</b>${esc(service.deliveryAddress || "—")}<small>${esc(service.deliveryReference || "Sin referencia")}</small></p>
        <p><b>Retiro → entrega</b>${Number(service.routeDistanceKm ?? service.distanceKm ?? 0).toFixed(2)} km</p><p><b>Distancia recorrida</b>${Number(service.actualDistanceKm || 0).toFixed(2)} km</p><p><b>Total</b>${money(service.totalAmount)}</p>
      </div></details>
      <details><summary>Personas responsables</summary><div class="service-detail-grid">
        <p><b>Quién envía</b>${esc(service.customerName || "—")}<small>${esc(service.customerEmail || "—")} · ${esc(service.customerPhone || "—")}</small></p>
        <p><b>Quién recibe</b>${esc(service.receiverName || "—")}<small>${esc(service.receiverPhone || "—")}</small></p>
        <p class="wide"><b>Repartidor</b>${esc(driver)}<small>${esc(service.driverPhone || "Sin teléfono")}</small></p>
      </div></details>
      <details><summary>Fechas y operación</summary><div class="service-detail-grid">
        <p><b>Creado</b>${esc(formatDate(service.createdAt))}</p><p><b>Actualizado</b>${esc(formatDate(service.updatedAt))}</p>
        <p><b>Asignado</b>${esc(formatDate(service.acceptedAt))}</p><p><b>Retirado</b>${esc(formatDate(service.pickedUpAt))}</p>
        <p><b>Entregado</b>${esc(formatDate(service.deliveredAt))}</p><p><b>Pago</b>${esc(service.paymentStatus || "Pendiente")} · ${esc(service.paymentMethod || "Sin método")}</p>
      </div></details>`;
  }

  function renderList() {
    const box = document.getElementById("adminServicesList");
    if (!box) return;
    const list = getFilteredServices();

    if (!list.length) {
      box.innerHTML = '<div class="empty-box">No hay paquetes con esos filtros.</div>';
      const detail = document.getElementById("adminServiceDetail");
      if (detail) detail.innerHTML = '<div class="empty-box">Sin resultados para mostrar.</div>';
      return;
    }

    if (!selectedId || !list.some((service) => service.id === selectedId)) selectedId = list[0].id;

    box.innerHTML = list.map((service) => `
      <button type="button" class="admin-service-row ${service.id === selectedId ? "active" : ""}" data-service-id="${esc(service.id)}">
        <span class="service-row-icon">📦</span>
        <span class="service-row-main"><b>${esc(service.customerName || service.customerEmail || "Cliente")}</b><small>${esc(service.receiverName || "Receptor")} · ${esc(formatDate(service.createdAt))}</small></span>
        <span class="service-row-end"><em class="service-status status-${esc(String(service.status || "").toLowerCase())}">${esc(statusLabel(service.status))}</em><strong>${money(service.totalAmount)}</strong></span>
      </button>`).join("");

    box.querySelectorAll("[data-service-id]").forEach((button) => {
      button.addEventListener("click", () => {
        selectedId = button.dataset.serviceId || "";
        renderList();
        renderDetail();
      });
    });
    renderDetail();
  }

  async function loadServices(options = {}) {
    const list = document.getElementById("adminServicesList");
    const previousScroll = list?.closest(".admin-services-list-panel")?.scrollTop || 0;
    const silent = options.silent === true;
    if (list && !silent) list.innerHTML = '<div class="empty-box">Cargando paquetes...</div>';

    try {
      const response = await fetch(`${API_URL}/admin/services`, { headers: { Accept: "application/json" } });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) throw new Error(payload.message || "No se pudieron cargar los paquetes");
      services = Array.isArray(payload.services) ? payload.services : [];
      loadedOnce = true;
      renderStats();
      renderList();
      requestAnimationFrame(() => {
        const panel = document.getElementById("adminServicesList")?.closest(".admin-services-list-panel");
        if (panel) panel.scrollTop = previousScroll;
      });
    } catch (error) {
      console.error("Error cargando paquetes administrativos:", error);
      if (list) list.innerHTML = `<div class="empty-box error">${esc(error.message || "No se pudieron cargar los paquetes.")}</div>`;
    }
  }

  function bindEvents() {
    if (eventsBound) return;
    eventsBound = true;
    document.getElementById("adminServicesSearch")?.addEventListener("input", renderList);
    document.getElementById("adminServicesStatus")?.addEventListener("change", renderList);
    document.getElementById("refreshAdminServicesBtn")?.addEventListener("click", loadServices);
    document.querySelector('[data-section="enviosSection"]')?.addEventListener("click", () => {
      if (!loadedOnce) loadServices();
    });
  }

  window.refreshAdminServicesSilently = () => loadServices({ silent: true });

  document.addEventListener("DOMContentLoaded", () => {
    bindEvents();
  });
})();
