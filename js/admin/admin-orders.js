/* =====================================================
   ADMIN ORDERS PRO - DELI GO
   Archivo nuevo y separado para la sección Pedidos.

   IMPORTANTE:
   - No modifica administrador.js.
   - Reemplaza visualmente renderPedidos() desde este archivo.
   - Lee los pedidos desde adminData.orders, que ya carga administrador.js.
   - Deja preparada la estructura para asignar repartidores más adelante.
   - No refresca automáticamente: usa botón manual para evitar parpadeos.
====================================================== */

/* =====================================================
   ESTADO LOCAL DEL MÓDULO PEDIDOS
====================================================== */
let adminOrdersSourceCache = [];
let adminOrdersFilteredCache = [];
let adminOrdersSelectedIndex = 0;

let adminOrdersViewStateMemory = {};

/*
  Estado interno de Pedidos mientras el panel está abierto.
  Guarda filtros como: pendiente, aceptado, preparando, listo, en camino, entregado.
*/
function adminOrdersReadViewState() {
  return adminOrdersViewStateMemory || {};
}

function adminOrdersSaveViewState() {
  const state = {
    searchText: document.getElementById("adminOrderSearchInput")?.value || "",
    selectedStatus: document.getElementById("adminOrderStatusFilter")?.value || "todos",
    selectedRestaurant: document.getElementById("adminOrderRestaurantFilter")?.value || "todos",
    fromValue: document.getElementById("adminOrderDateFrom")?.value || "",
    toValue: document.getElementById("adminOrderDateTo")?.value || "",
    selectedOrderId: adminOrdersFilteredCache[adminOrdersSelectedIndex]?.id || ""
  };

  adminOrdersViewStateMemory = state;
}

function adminOrdersClearViewState() {
  adminOrdersViewStateMemory = {};
}

/* =====================================================
   NORMALIZACIÓN Y UTILIDADES LOCALES
====================================================== */
function adminOrdersEscape(value) {
  if (typeof escapeHtml === "function") return escapeHtml(value);

  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function adminOrdersMoney(value) {
  if (typeof formatMoney === "function") return formatMoney(value);
  return `$${Number(value || 0).toLocaleString("es-VE")}`;
}

function adminOrdersNormalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function adminOrdersNormalizeStatus(status) {
  const raw = adminOrdersNormalizeText(status || "pendiente")
    .replaceAll("-", "_")
    .replaceAll(" ", "_");

  const map = {
    pendiente: "pendiente",
    pending: "pendiente",
    aceptado: "aceptado",
    accepted: "aceptado",
    preparando: "preparando",
    preparacion: "preparando",
    en_preparacion: "preparando",
    listo: "listo",
    ready: "listo",
    en_camino: "en_camino",
    camino: "en_camino",
    on_the_way: "en_camino",
    entregado: "entregado",
    delivered: "entregado",
    completed: "entregado",
    finished: "entregado"
  };

  return map[raw] || raw || "pendiente";
}

function adminOrdersStatusLabel(status) {
  if (typeof getStatusLabelAdmin === "function") {
    return getStatusLabelAdmin(status);
  }

  const labels = {
    pendiente: "Pendiente",
    aceptado: "Aceptado",
    preparando: "Preparando",
    listo: "Listo",
    en_camino: "En camino",
    entregado: "Entregado"
  };

  return labels[adminOrdersNormalizeStatus(status)] || "Pendiente";
}

function adminOrdersStatusClass(status) {
  return `admin-order-status-${adminOrdersNormalizeStatus(status).replaceAll("_", "-")}`;
}

function adminOrdersGetOrders() {
  return Array.isArray(adminOrdersSourceCache) ? adminOrdersSourceCache : [];
}

function adminOrdersGetItems(order) {
  return Array.isArray(order?.items) ? order.items : [];
}

function adminOrdersGetTotal(order) {
  const directTotal = Number(order?.total || 0);
  if (directTotal > 0) return directTotal;

  return adminOrdersGetItems(order).reduce((sum, item) => {
    const qty = Number(item?.qty || item?.quantity || 0);
    const price = Number(item?.price || 0);
    const subtotal = Number(item?.subtotal || 0);
    return sum + (subtotal > 0 ? subtotal : qty * price);
  }, 0);
}

function adminOrdersGetItemsCount(order) {
  return adminOrdersGetItems(order).reduce((sum, item) => {
    return sum + Number(item?.qty || item?.quantity || 0);
  }, 0);
}

function adminOrdersGetCustomerName(order) {
  return order?.customer?.fullName || order?.customer?.name || order?.customerName || order?.customer?.email || "Cliente";
}

function adminOrdersGetCustomerEmail(order) {
  return order?.customer?.email || order?.email || "";
}

function adminOrdersGetCustomerPhone(order) {
  return order?.customer?.phone || order?.phone || "-";
}

function adminOrdersGetAddress(order) {
  return order?.customer?.address || order?.address || order?.deliveryAddress || "-";
}

function adminOrdersGetRestaurantName(order) {
  return order?.restaurantName || order?.restaurant?.name || order?.restaurantEmail || "Restaurante";
}

function adminOrdersGetDateObject(order) {
  if (order?.createdAt) {
    const created = new Date(order.createdAt);
    if (!Number.isNaN(created.getTime())) return created;
  }

  if (order?.date) {
    const rawDate = String(order.date || "").trim();
    const rawTime = String(order.time || "").trim();
    const dateParts = rawDate.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);

    if (dateParts) {
      const day = Number(dateParts[1]);
      const month = Number(dateParts[2]) - 1;
      const year = Number(dateParts[3]);
      let hour = 0;
      let minute = 0;

      const normalizedTime = rawTime
        .toLowerCase()
        .replaceAll("a. m.", "am")
        .replaceAll("p. m.", "pm")
        .replaceAll("a.m.", "am")
        .replaceAll("p.m.", "pm")
        .replaceAll(".", "")
        .trim();

      const timeParts = normalizedTime.match(/(\d{1,2})[:.](\d{2})\s*(am|pm)?/);

      if (timeParts) {
        hour = Number(timeParts[1]);
        minute = Number(timeParts[2]);

        if (timeParts[3] === "pm" && hour < 12) hour += 12;
        if (timeParts[3] === "am" && hour === 12) hour = 0;
      }

      const parsed = new Date(year, month, day, hour, minute, 0, 0);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
  }

  return null;
}

function adminOrdersGetDateText(order) {
  const parsed = adminOrdersGetDateObject(order);

  if (parsed) {
    return parsed.toLocaleString("es-CL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  const date = order?.date || "";
  const time = order?.time || "";
  return `${date} ${time}`.trim() || "-";
}

function adminOrdersGetDateKey(order) {
  const parsed = adminOrdersGetDateObject(order);
  if (!parsed) return "";

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function adminOrdersSorted(orders) {
  return [...orders].sort((a, b) => {
    const da = adminOrdersGetDateObject(a)?.getTime() || 0;
    const db = adminOrdersGetDateObject(b)?.getTime() || 0;
    return db - da;
  });
}

/* =====================================================
   FILTROS
====================================================== */
function adminOrdersMatchSearch(order, searchText) {
  const query = adminOrdersNormalizeText(searchText);
  if (!query) return true;

  const items = adminOrdersGetItems(order);
  const searchable = [
    order?.id,
    order?.status,
    adminOrdersStatusLabel(order?.status),
    adminOrdersGetRestaurantName(order),
    order?.restaurantEmail,
    adminOrdersGetCustomerName(order),
    adminOrdersGetCustomerEmail(order),
    adminOrdersGetCustomerPhone(order),
    adminOrdersGetAddress(order),
    ...items.flatMap((item) => [item?.id, item?.name, item?.category])
  ]
    .map(adminOrdersNormalizeText)
    .join(" ");

  return searchable.includes(query);
}

function adminOrdersMatchStatus(order, selectedStatus) {
  if (!selectedStatus || selectedStatus === "todos") return true;
  return adminOrdersNormalizeStatus(order?.status) === selectedStatus;
}

function adminOrdersMatchRestaurant(order, selectedRestaurant) {
  if (!selectedRestaurant || selectedRestaurant === "todos") return true;
  return adminOrdersNormalizeText(adminOrdersGetRestaurantName(order)) === selectedRestaurant;
}

function adminOrdersPopulateRestaurantFilter() {
  const select = document.getElementById("adminOrderRestaurantFilter");
  if (!select) return;

  const restaurants = [...new Set(
    adminOrdersGetOrders()
      .map((order) => adminOrdersGetRestaurantName(order))
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b, "es"));

  select.innerHTML = `
    <option value="todos">Todos los restaurantes</option>
    ${restaurants.map((name) => `
      <option value="${adminOrdersEscape(adminOrdersNormalizeText(name))}">${adminOrdersEscape(name)}</option>
    `).join("")}
  `;
}

function adminOrdersMatchDate(order, fromValue, toValue) {
  const dateKey = adminOrdersGetDateKey(order);

  if (!dateKey && (fromValue || toValue)) return false;
  if (fromValue && dateKey < fromValue) return false;
  if (toValue && dateKey > toValue) return false;

  return true;
}

function filtrarPedidosAdmin(options = {}) {
  const searchInput = document.getElementById("adminOrderSearchInput");
  const statusInput = document.getElementById("adminOrderStatusFilter");
  const restaurantInput = document.getElementById("adminOrderRestaurantFilter");
  const fromInput = document.getElementById("adminOrderDateFrom");
  const toInput = document.getElementById("adminOrderDateTo");

  const searchText = searchInput?.value || "";
  const selectedStatus = statusInput?.value || "todos";
  const selectedRestaurant = restaurantInput?.value || "todos";
  const fromValue = fromInput?.value || "";
  const toValue = toInput?.value || "";

  const previousSelectedOrderId =
    options.selectedOrderId ||
    adminOrdersFilteredCache[adminOrdersSelectedIndex]?.id ||
    "";

  adminOrdersFilteredCache = adminOrdersSorted(adminOrdersGetOrders()).filter((order) => {
    return (
      adminOrdersMatchSearch(order, searchText) &&
      adminOrdersMatchStatus(order, selectedStatus) &&
      adminOrdersMatchRestaurant(order, selectedRestaurant) &&
      adminOrdersMatchDate(order, fromValue, toValue)
    );
  });

  const restoredIndex = adminOrdersFilteredCache.findIndex((order) => {
    return String(order?.id || "") === String(previousSelectedOrderId || "");
  });

  adminOrdersSelectedIndex = restoredIndex >= 0 ? restoredIndex : 0;

  adminOrdersSaveViewState();
  adminOrdersRefreshView();
}

function limpiarFiltrosPedidosAdmin() {
  const searchInput = document.getElementById("adminOrderSearchInput");
  const statusInput = document.getElementById("adminOrderStatusFilter");
  const restaurantInput = document.getElementById("adminOrderRestaurantFilter");
  const fromInput = document.getElementById("adminOrderDateFrom");
  const toInput = document.getElementById("adminOrderDateTo");

  if (searchInput) searchInput.value = "";
  if (statusInput) statusInput.value = "todos";
  if (restaurantInput) restaurantInput.value = "todos";
  if (fromInput) fromInput.value = "";
  if (toInput) toInput.value = "";

  adminOrdersFilteredCache = adminOrdersSorted(adminOrdersGetOrders());
  adminOrdersSelectedIndex = 0;
  adminOrdersClearViewState();
  adminOrdersRefreshView();
}

function adminOrdersRestoreViewState() {
  const state = adminOrdersReadViewState();

  const searchInput = document.getElementById("adminOrderSearchInput");
  const statusInput = document.getElementById("adminOrderStatusFilter");
  const restaurantInput = document.getElementById("adminOrderRestaurantFilter");
  const fromInput = document.getElementById("adminOrderDateFrom");
  const toInput = document.getElementById("adminOrderDateTo");

  if (searchInput) searchInput.value = state.searchText || "";
  if (statusInput) statusInput.value = state.selectedStatus || "todos";
  if (restaurantInput) restaurantInput.value = state.selectedRestaurant || "todos";
  if (fromInput) fromInput.value = state.fromValue || "";
  if (toInput) toInput.value = state.toValue || "";

  filtrarPedidosAdmin({
    selectedOrderId: state.selectedOrderId || ""
  });
}

function refrescarPedidosAdminManual() {
  adminOrdersSaveViewState();

  if (window.refrescarPanelAdministradorManual) {
    window.refrescarPanelAdministradorManual();
    return;
  }

  /*
    Respaldo seguro:
    Si por alguna razón administrador.js no expone la función manual,
    repintamos solo con la data actual sin romper la vista.
  */
  adminOrdersRestoreViewState();
}

/* =====================================================
   RENDER PRINCIPAL
====================================================== */
function renderAdminOrdersPro() {
  const container = document.getElementById("pedidosList");
  if (!container) return;

  const orders = adminOrdersSorted(adminOrdersGetOrders());
  adminOrdersFilteredCache = orders;
  adminOrdersSelectedIndex = 0;

  if (!orders.length) {
    container.innerHTML = `<div class="empty-box">No hay pedidos registrados.</div>`;
    return;
  }

  container.classList.remove("table-wrapper");
  container.innerHTML = `
    <div class="admin-orders-pro admin-orders-table-mode">
      <section class="admin-orders-filters admin-orders-filters-reference">
        <div class="admin-orders-search-wrap">
          <input id="adminOrderSearchInput" type="text" placeholder="Buscar por ID, cliente o restaurante..." oninput="filtrarPedidosAdmin()">
          <span class="admin-orders-search-icon">⌕</span>
        </div>

        <div class="admin-orders-field clean">
          <select id="adminOrderStatusFilter" onchange="filtrarPedidosAdmin()">
            <option value="todos">Todos los estados</option>
            <option value="pendiente">Pendiente</option>
            <option value="aceptado">Aceptado</option>
            <option value="preparando">Preparando</option>
            <option value="listo">Listo</option>
            <option value="en_camino">En camino</option>
            <option value="entregado">Entregado</option>
          </select>
        </div>

        <div class="admin-orders-field clean">
          <select id="adminOrderRestaurantFilter" onchange="filtrarPedidosAdmin()">
            <option value="todos">Todos los restaurantes</option>
          </select>
        </div>

        <div class="admin-orders-date-group">
          <span>▣</span>
          <input id="adminOrderDateFrom" type="date" onchange="filtrarPedidosAdmin()">
          <small>—</small>
          <input id="adminOrderDateTo" type="date" onchange="filtrarPedidosAdmin()">
        </div>

        <div class="admin-orders-manual-actions">
          <button type="button" class="admin-orders-btn refresh" onclick="refrescarPedidosAdminManual()">Actualizar pedidos</button>
          <button type="button" class="admin-orders-btn outline" onclick="limpiarFiltrosPedidosAdmin()">Limpiar filtros</button>
        </div>
      </section>

      <section class="admin-orders-layout-reference">
        <div class="admin-orders-table-panel">
          <div class="admin-orders-table-wrap" id="adminOrdersListWrap"></div>
          <div class="admin-orders-footer" id="adminOrdersFooterText"></div>
        </div>

        <aside class="admin-orders-detail-side">
          <div id="adminSelectedOrderDetail"></div>
        </aside>
      </section>
    </div>
  `;

  adminOrdersPopulateRestaurantFilter();
  adminOrdersRestoreViewState();
}

function adminOrdersRefreshView() {
  const listWrap = document.getElementById("adminOrdersListWrap");
  const countText = document.getElementById("adminOrdersCountText");
  const footerText = document.getElementById("adminOrdersFooterText");

  if (countText) {
    countText.textContent = `${adminOrdersFilteredCache.length} pedido(s)`;
  }

  if (footerText) {
    footerText.textContent = adminOrdersFilteredCache.length
      ? `Mostrando 1 a ${adminOrdersFilteredCache.length} de ${adminOrdersFilteredCache.length} pedidos`
      : "No hay pedidos para mostrar";
  }

  if (listWrap) {
    listWrap.innerHTML = renderAdminOrdersList(adminOrdersFilteredCache);
  }

  renderAdminSelectedOrderDetail(adminOrdersFilteredCache[adminOrdersSelectedIndex] || null);
}

function renderAdminOrdersList(orders) {
  if (!orders.length) {
    return `<div class="empty-box">No hay pedidos que coincidan con los filtros.</div>`;
  }

  return `
    <table class="admin-orders-clean-table">
      <thead>
        <tr>
          <th>Pedido</th>
          <th>Restaurante</th>
          <th>Cliente</th>
          <th>Total</th>
          <th>Estado</th>
          <th>Fecha</th>
        </tr>
      </thead>
      <tbody>
        ${orders.map((order, index) => {
          const isActive = index === adminOrdersSelectedIndex;
          const total = adminOrdersGetTotal(order);
          const statusLabel = adminOrdersStatusLabel(order?.status);

          return `
            <tr class="admin-order-row ${isActive ? "active" : ""}" id="adminOrderCard${index}" onclick="seleccionarPedidoAdmin(${index})">
              <td class="order-id-cell">DL-${adminOrdersEscape(String(order?.id || "-").replace(/^DL-/, ""))}</td>
              <td>${adminOrdersEscape(adminOrdersGetRestaurantName(order))}</td>
              <td>${adminOrdersEscape(adminOrdersGetCustomerName(order))}</td>
              <td><strong>${adminOrdersMoney(total)}</strong></td>
              <td><span class="admin-order-status ${adminOrdersStatusClass(order?.status)}">${adminOrdersEscape(statusLabel)}</span></td>
              <td>${adminOrdersEscape(adminOrdersGetDateText(order))}</td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;
}

function seleccionarPedidoAdmin(index) {
  adminOrdersSelectedIndex = index;

  document.querySelectorAll(".admin-order-row").forEach((card) => {
    card.classList.remove("active");
  });

  const selectedCard = document.getElementById(`adminOrderCard${index}`);
  if (selectedCard) selectedCard.classList.add("active");

  renderAdminSelectedOrderDetail(adminOrdersFilteredCache[index] || null);
  adminOrdersSaveViewState();
}

function renderAdminSelectedOrderDetail(order) {
  const target = document.getElementById("adminSelectedOrderDetail");
  if (!target) return;

  if (!order) {
    target.innerHTML = `
      <div class="admin-orders-empty-detail">
        <strong>Selecciona un pedido</strong>
        <span>Cuando hagas clic en un pedido, verás aquí toda la información.</span>
      </div>
    `;
    return;
  }

  const items = adminOrdersGetItems(order);
  const total = adminOrdersGetTotal(order);
  const statusLabel = adminOrdersStatusLabel(order?.status);
  const itemsHtml = items.length ? items.map((item) => {
    const qty = Number(item?.qty || item?.quantity || 0);
    const price = Number(item?.price || 0);
    const subtotal = Number(item?.subtotal || qty * price);

    return `
      <div class="admin-order-product-row reference">
        <div class="admin-product-thumb">🍽️</div>
        <div>
          <strong>${adminOrdersEscape(item?.name || "Producto")}</strong>
          <small>Cantidad: ${qty}</small>
        </div>
        <strong>${adminOrdersMoney(subtotal)}</strong>
      </div>
    `;
  }).join("") : `<div class="empty-box">Este pedido no tiene productos visibles.</div>`;

  target.innerHTML = `
    <div class="admin-order-side-head">
      <div>
        <h3>Detalle del pedido</h3>
        <p>Cliente, restaurante, productos, dirección y estado.</p>
      </div>
      <button type="button" class="admin-order-side-close" title="Panel de detalle">×</button>
    </div>

    <div class="admin-order-detail-title compact">
      <span class="admin-order-status ${adminOrdersStatusClass(order?.status)}">${adminOrdersEscape(statusLabel)}</span>
      <h3>Pedido: DL-${adminOrdersEscape(String(order?.id || "-").replace(/^DL-/, ""))}</h3>
      <p>Realizado el: ${adminOrdersEscape(adminOrdersGetDateText(order))}</p>
    </div>

    <section class="admin-order-info-block compact">
      <h4>Información general</h4>

      <div class="admin-order-general-grid">
        <div class="admin-order-general-left">
          <div class="admin-order-line"><span>⌂</span><div><small>Restaurante</small><strong>${adminOrdersEscape(adminOrdersGetRestaurantName(order))}</strong></div></div>
          <div class="admin-order-line"><span>♙</span><div><small>Cliente</small><strong>${adminOrdersEscape(adminOrdersGetCustomerName(order))}</strong><em>${adminOrdersEscape(adminOrdersGetCustomerEmail(order) || "-")}</em></div></div>
          <div class="admin-order-line"><span>☏</span><div><small>Teléfono</small><strong>${adminOrdersEscape(adminOrdersGetCustomerPhone(order))}</strong></div></div>
          <div class="admin-order-line"><span>⌖</span><div><small>Dirección</small><strong>${adminOrdersEscape(adminOrdersGetAddress(order))}</strong></div></div>
          <div class="admin-order-line"><span>▣</span><div><small>Método de pago</small><strong>${adminOrdersEscape(order?.paymentMethod || "Efectivo")}</strong></div></div>
        </div>

        <div class="admin-order-general-right">
          <div><small>Subtotal</small><strong>${adminOrdersMoney(total)}</strong></div>
          <div><small>Envío</small><strong>${adminOrdersMoney(order?.deliveryFee || 0)}</strong></div>
          <div><small>Total</small><strong class="danger">${adminOrdersMoney(total)}</strong></div>
          <div><small>Items</small><strong>${adminOrdersGetItemsCount(order)} producto(s)</strong></div>
        </div>
      </div>
    </section>

    <section class="admin-order-info-block compact">
      <div class="admin-order-section-head">
        <h4>Productos del pedido</h4>
      </div>

      <div class="admin-order-products">
        ${itemsHtml}
      </div>

      <div class="admin-order-total-line">
        <strong>Total del pedido</strong>
        <strong>${adminOrdersMoney(total)}</strong>
      </div>
    </section>
  `;
}

/* =====================================================
   ESTILOS DEL MÓDULO
   Se inyectan aquí para no tocar administrador.css todavía.
====================================================== */
function inyectarEstilosAdminOrders() {
  if (document.getElementById("deli-admin-orders-styles")) return;

  const style = document.createElement("style");
  style.id = "deli-admin-orders-styles";
  style.textContent = `
    .admin-orders-pro {
      display: grid;
      gap: 18px;
    }

    .admin-orders-filters-reference,
    .admin-orders-table-panel,
    .admin-orders-detail-side {
      background: #ffffff;
      border: 1px solid #eef0f4;
      border-radius: 18px;
      box-shadow: 0 16px 36px rgba(15, 23, 42, 0.06);
    }

    .admin-orders-filters-reference {
      display: grid;
      grid-template-columns: minmax(260px, 1.5fr) minmax(170px, .95fr) minmax(190px, 1fr) minmax(240px, 1.1fr) auto;
      gap: 14px;
      align-items: center;
      padding: 18px;
    }

    .admin-orders-manual-actions {
      display: flex;
      gap: 10px;
      align-items: center;
      justify-content: flex-end;
      flex-wrap: wrap;
    }

    .admin-orders-search-wrap {
      position: relative;
    }

    .admin-orders-search-wrap input,
    .admin-orders-field.clean select,
    .admin-orders-date-group {
      width: 100%;
      min-height: 42px;
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      background: #ffffff;
      font: inherit;
      color: #111827;
      outline: none;
      transition: .18s ease;
    }

    .admin-orders-search-wrap input {
      padding: 0 44px 0 16px;
    }

    .admin-orders-search-icon {
      position: absolute;
      right: 14px;
      top: 50%;
      transform: translateY(-50%);
      color: #111827;
      font-size: 20px;
      pointer-events: none;
    }

    .admin-orders-field.clean select {
      padding: 0 14px;
      cursor: pointer;
    }

    .admin-orders-date-group {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 0 12px;
      color: #6b7280;
    }

    .admin-orders-date-group input {
      border: 0;
      outline: none;
      font: inherit;
      width: 100%;
      min-width: 0;
      color: #6b7280;
      background: transparent;
    }

    .admin-orders-search-wrap input:focus,
    .admin-orders-field.clean select:focus-within,
    .admin-orders-date-group:focus-within {
      border-color: #ff4d4d;
      box-shadow: 0 0 0 3px rgba(255, 77, 77, .10);
    }

    .admin-orders-btn {
      border: 0;
      border-radius: 10px;
      padding: 12px 16px;
      cursor: pointer;
      font-weight: 800;
      white-space: nowrap;
    }

    .admin-orders-btn.outline {
      background: #ffffff;
      color: #ff4d4d;
      border: 1px solid #ff4d4d;
    }

    .admin-orders-btn.refresh {
      background: #111827;
      color: #ffffff;
      border: 1px solid #111827;
    }

    .admin-orders-layout-reference {
      display: grid;
      grid-template-columns: minmax(620px, 1.55fr) minmax(360px, .72fr);
      gap: 20px;
      align-items: stretch;
    }

    .admin-orders-table-panel {
      overflow: hidden;
      min-width: 0;
    }

    .admin-orders-table-wrap {
      overflow: auto;
      max-height: 640px;
    }

    .admin-orders-clean-table {
      width: 100%;
      border-collapse: collapse;
      min-width: 760px;
      font-size: 14px;
    }

    .admin-orders-clean-table thead {
      position: sticky;
      top: 0;
      z-index: 2;
      background: #ffffff;
      box-shadow: 0 1px 0 #eef0f4;
    }

    .admin-orders-clean-table th {
      text-transform: uppercase;
      font-size: 11px;
      letter-spacing: .02em;
      color: #6b7280;
      text-align: left;
      padding: 16px 18px;
      font-weight: 900;
    }

    .admin-orders-clean-table td {
      padding: 15px 18px;
      border-bottom: 1px solid #eef0f4;
      color: #111827;
      vertical-align: middle;
    }

    .admin-order-row {
      cursor: pointer;
      transition: .16s ease;
      background: #ffffff;
    }

    .admin-order-row:hover {
      background: #fff7f7;
    }

    .admin-order-row.active {
      background: linear-gradient(90deg, rgba(255,77,77,.12), rgba(255,255,255,1) 55%);
      box-shadow: inset 4px 0 0 #ff4d4d;
    }

    .order-id-cell {
      color: #ff4d4d !important;
      font-weight: 900;
    }

    .admin-order-status {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 7px 12px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 900;
      background: #f3f4f6;
      color: #374151;
      white-space: nowrap;
    }

    .admin-order-status-pendiente {
      background: #fff7ed;
      color: #ea580c;
    }

    .admin-order-status-preparando,
    .admin-order-status-aceptado {
      background: #eff6ff;
      color: #1d4ed8;
    }

    .admin-order-status-listo {
      background: #ecfdf5;
      color: #047857;
    }

    .admin-order-status-en-camino {
      background: #f5f3ff;
      color: #6d28d9;
    }

    .admin-order-status-entregado {
      background: #dcfce7;
      color: #047857;
    }

    .admin-orders-footer {
      padding: 14px 18px;
      color: #6b7280;
      font-size: 13px;
      background: #ffffff;
    }

    .admin-orders-detail-side {
      padding: 26px;
      align-self: start;
      position: sticky;
      top: 18px;
      min-height: 640px;
    }

    .admin-order-side-head {
      display: flex;
      justify-content: space-between;
      gap: 14px;
      align-items: flex-start;
      margin-bottom: 22px;
    }

    .admin-order-side-head h3,
    .admin-order-detail-title h3,
    .admin-order-info-block h4 {
      margin: 0;
      color: #111827;
    }

    .admin-order-side-head p,
    .admin-order-detail-title p,
    .admin-order-line small,
    .admin-order-general-right small,
    .admin-order-product-row small {
      margin: 5px 0 0;
      color: #6b7280;
      font-size: 13px;
    }

    .admin-order-side-close {
      border: 0;
      background: transparent;
      font-size: 28px;
      line-height: 1;
      cursor: default;
      color: #111827;
    }

    .admin-order-detail-title.compact {
      display: grid;
      gap: 10px;
      padding-bottom: 22px;
      border-bottom: 1px solid #eef0f4;
    }

    .admin-order-info-block.compact {
      padding: 22px 0;
      border-bottom: 1px solid #eef0f4;
    }

    .admin-order-general-grid {
      display: grid;
      grid-template-columns: 1.4fr .75fr;
      gap: 20px;
      margin-top: 16px;
    }

    .admin-order-general-left {
      display: grid;
      gap: 14px;
    }

    .admin-order-line {
      display: grid;
      grid-template-columns: 22px 1fr;
      gap: 10px;
      align-items: start;
    }

    .admin-order-line > span {
      color: #6b7280;
      font-size: 16px;
      line-height: 1.2;
    }

    .admin-order-line strong,
    .admin-order-general-right strong {
      display: block;
      color: #111827;
      font-size: 14px;
      margin-top: 2px;
      word-break: break-word;
    }

    .admin-order-line em {
      display: block;
      color: #ff4d4d;
      font-style: normal;
      font-size: 12px;
      margin-top: 3px;
      word-break: break-word;
    }

    .admin-order-general-right {
      display: grid;
      gap: 14px;
      align-content: start;
    }

    .admin-order-general-right .danger,
    .admin-order-total-line strong:last-child {
      color: #ff4d4d;
    }

    .admin-order-section-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 12px;
    }

    .admin-order-products {
      display: grid;
      gap: 12px;
    }

    .admin-order-product-row.reference {
      display: grid;
      grid-template-columns: 48px 1fr auto;
      align-items: center;
      gap: 14px;
      padding: 12px 0;
      border-bottom: 1px solid #eef0f4;
    }

    .admin-product-thumb {
      width: 44px;
      height: 44px;
      border-radius: 10px;
      display: grid;
      place-items: center;
      background: #fff7ed;
      font-size: 25px;
    }

    .admin-order-product-row strong {
      color: #111827;
    }

    .admin-order-total-line {
      display: flex;
      justify-content: space-between;
      gap: 14px;
      margin-top: 20px;
      font-size: 15px;
    }

    .admin-orders-empty-detail {
      min-height: 260px;
      display: grid;
      place-items: center;
      text-align: center;
      color: #6b7280;
      background: #f9fafb;
      border: 1px dashed #d1d5db;
      border-radius: 18px;
      padding: 22px;
    }

    @media (max-width: 1280px) {
      .admin-orders-layout-reference {
        grid-template-columns: 1fr;
      }

      .admin-orders-detail-side {
        position: static;
        min-height: auto;
      }
    }

    @media (max-width: 1100px) {
      .admin-orders-filters-reference {
        grid-template-columns: 1fr 1fr;
      }

      .admin-orders-manual-actions {
        justify-content: flex-start;
      }
    }

    @media (max-width: 720px) {
      .admin-orders-filters-reference,
      .admin-order-general-grid {
        grid-template-columns: 1fr;
      }

      .admin-orders-detail-side {
        padding: 18px;
      }
    }
  `;

  document.head.appendChild(style);
}


/* =====================================================
   PUENTE PÚBLICO DEL MÓDULO
   administrador.js llama a window.initAdminOrders(adminData.orders)
   después de cargar los datos del backend.
====================================================== */
window.initAdminOrders = function initAdminOrders(orders) {
  adminOrdersSourceCache = Array.isArray(orders) ? orders : [];
  renderAdminOrdersPro();
};

/*
  Exponemos estas funciones porque el HTML interno usa onclick/oninput.
  Así evitamos errores de alcance entre archivos separados.
*/
window.filtrarPedidosAdmin = filtrarPedidosAdmin;
window.limpiarFiltrosPedidosAdmin = limpiarFiltrosPedidosAdmin;
window.seleccionarPedidoAdmin = seleccionarPedidoAdmin;
window.adminOrdersSaveViewState = adminOrdersSaveViewState;
window.adminOrdersRestoreViewState = adminOrdersRestoreViewState;
window.refrescarPedidosAdminManual = refrescarPedidosAdminManual;


inyectarEstilosAdminOrders();








