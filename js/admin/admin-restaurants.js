/* =====================================================
   ADMIN RESTAURANTS PRO - DELI GO
   Archivo nuevo y separado para la sección Restaurantes.

   IMPORTANTE:
   - No reemplaza ni elimina lógica antigua.
   - No modifica backend.
   - Reemplaza visualmente la tabla simple de restaurantes.
   - Lee restaurantes y pedidos desde adminData, que ya carga administrador.js.
   - Mantiene acciones existentes: aprobar, bloquear, eliminar y comisión.
====================================================== */

/* =====================================================
   ESTADO LOCAL DEL MÓDULO RESTAURANTES
====================================================== */
let adminRestaurantsSourceCache = [];
let adminRestaurantsOrdersCache = [];
let adminRestaurantsFilteredCache = [];
let adminRestaurantsSelectedIndex = 0;
let adminRestaurantsSelectedOrderId = "";
let adminRestaurantsSelectedChartDay = "";
let adminRestaurantsActiveDetailTab = "resumen";

let adminRestaurantsViewStateMemory = {};

/* =====================================================
   UTILIDADES SEGURAS
====================================================== */
function adminRestaurantsEscape(value) {
  if (typeof escapeHtml === "function") return escapeHtml(value);

  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function adminRestaurantsMoney(value) {
  if (typeof formatMoney === "function") return formatMoney(value);
  return `$${Number(value || 0).toLocaleString("es-VE")}`;
}

function adminRestaurantsNormalize(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function adminRestaurantsEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function adminRestaurantsGetStatus(restaurant) {
  const raw = adminRestaurantsNormalize(restaurant?.status || "pending");

  if (raw === "paused") return "blocked";
  if (raw === "aprobado") return "approved";
  if (raw === "pendiente") return "pending";
  if (raw === "bloqueado") return "blocked";

  return raw || "pending";
}

function adminRestaurantsStatusLabel(status) {
  const normalized = adminRestaurantsGetStatus({ status });

  const labels = {
    approved: "Aprobado",
    pending: "Pendiente",
    blocked: "Bloqueado"
  };

  return labels[normalized] || "Pendiente";
}

function adminRestaurantsStatusClass(status) {
  return `admin-restaurant-status-${adminRestaurantsGetStatus({ status })}`;
}

function adminRestaurantsGetName(restaurant) {
  return restaurant?.name || restaurant?.restaurantName || "Restaurante";
}

function adminRestaurantsGetEmail(restaurant) {
  return restaurant?.email || restaurant?.restaurantEmail || "";
}

function adminRestaurantsGetPhone(restaurant) {
  return restaurant?.phone || restaurant?.telefono || "-";
}

function adminRestaurantsGetAddress(restaurant) {
  return restaurant?.address || restaurant?.direccion || "Punto Fijo";
}

function adminRestaurantsGetCategory(restaurant) {
  return restaurant?.category || restaurant?.type || "Comida";
}

function adminRestaurantsGetCommission(restaurant) {
  return Number(restaurant?.commissionPercent ?? restaurant?.commission ?? 15);
}

function adminRestaurantsGetId(restaurant) {
  return restaurant?.id || restaurant?.email || restaurant?.name || "";
}

function adminRestaurantsGetOrders(restaurant) {
  const email = adminRestaurantsEmail(adminRestaurantsGetEmail(restaurant));
  const name = adminRestaurantsNormalize(adminRestaurantsGetName(restaurant));

  return adminRestaurantsOrdersCache.filter((order) => {
    const orderEmail = adminRestaurantsEmail(order?.restaurantEmail || order?.restaurant?.email || "");
    const orderName = adminRestaurantsNormalize(order?.restaurantName || order?.restaurant?.name || "");

    return (
      (email && orderEmail === email) ||
      (name && orderName === name)
    );
  });
}

function adminRestaurantsGetOrderTotal(order) {
  const direct = Number(order?.total || 0);
  if (direct > 0) return direct;

  const items = Array.isArray(order?.items) ? order.items : [];
  return items.reduce((sum, item) => {
    const qty = Number(item?.qty || item?.quantity || 0);
    const price = Number(item?.price || 0);
    const subtotal = Number(item?.subtotal || 0);
    return sum + (subtotal > 0 ? subtotal : qty * price);
  }, 0);
}

function adminRestaurantsGetLastOrder(orders) {
  if (!orders.length) return null;

  return [...orders].sort((a, b) => {
    const da = adminRestaurantsGetDateObject(a)?.getTime() || 0;
    const db = adminRestaurantsGetDateObject(b)?.getTime() || 0;
    return db - da;
  })[0];
}

function adminRestaurantsGetDateObject(order) {
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

function adminRestaurantsGetDateText(order) {
  const parsed = adminRestaurantsGetDateObject(order);

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

function adminRestaurantsGetRestaurantStats(restaurant) {
  const orders = adminRestaurantsGetOrders(restaurant);
  const sales = orders.reduce((sum, order) => sum + adminRestaurantsGetOrderTotal(order), 0);
  const commissionPercent = adminRestaurantsGetCommission(restaurant);
  const deliCommission = sales * commissionPercent / 100;
  const avgTicket = orders.length ? sales / orders.length : 0;
  const lastOrder = adminRestaurantsGetLastOrder(orders);

  const delivered = orders.filter((order) => {
    const status = adminRestaurantsNormalize(order?.status || "");
    return status === "entregado" || status === "delivered" || status === "completed" || status === "finished";
  }).length;

  return {
    orders,
    sales,
    commissionPercent,
    deliCommission,
    avgTicket,
    lastOrder,
    delivered
  };
}

function adminRestaurantsGetOrderCustomerName(order) {
  return order?.customer?.fullName || order?.customer?.name || order?.customer?.email || "Cliente";
}

function adminRestaurantsGetOrderCustomerPhone(order) {
  return order?.customer?.phone || order?.phone || "-";
}

function adminRestaurantsGetOrderCustomerAddress(order) {
  return order?.customer?.address || order?.address || order?.deliveryAddress || "-";
}

function adminRestaurantsGetOrderCustomerEmail(order) {
  return order?.customer?.email || order?.email || "-";
}

function adminRestaurantsGetOrderItems(order) {
  return Array.isArray(order?.items) ? order.items : [];
}

function adminRestaurantsGetOrderItemsCount(order) {
  return adminRestaurantsGetOrderItems(order).reduce((sum, item) => {
    return sum + Number(item?.qty || item?.quantity || 0);
  }, 0);
}

function adminRestaurantsNormalizeOrderStatus(status) {
  return adminRestaurantsNormalize(status || "pendiente")
    .replaceAll("-", "_")
    .replaceAll(" ", "_");
}

function adminRestaurantsGetOrderStatusLabel(order) {
  if (typeof getStatusLabelAdmin === "function") {
    return getStatusLabelAdmin(order?.status);
  }

  const labels = {
    pendiente: "Pendiente",
    aceptado: "Aceptado",
    preparando: "Preparando",
    listo: "Listo",
    en_camino: "En camino",
    entregado: "Entregado",
    finalizado: "Entregado"
  };

  return labels[adminRestaurantsNormalizeOrderStatus(order?.status)] || "Pendiente";
}

function adminRestaurantsBuildDailyStats(orders) {
  const grouped = {};

  orders.forEach((order) => {
    const date = adminRestaurantsGetDateObject(order);
    const key = date
      ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
      : "Sin fecha";

    if (!grouped[key]) {
      grouped[key] = {
        date: key,
        orders: 0,
        sales: 0
      };
    }

    grouped[key].orders += 1;
    grouped[key].sales += adminRestaurantsGetOrderTotal(order);
  });

  return Object.values(grouped)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .slice(-7);
}

function renderAdminRestaurantMiniChart(orders) {
  const data = adminRestaurantsBuildDailyStats(orders);

  if (!data.length) {
    return `<div class="empty-box">Aún no hay datos suficientes para graficar.</div>`;
  }

  if (!adminRestaurantsSelectedChartDay) {
    adminRestaurantsSelectedChartDay = data[data.length - 1]?.date || "";
  }

  const maxOrders = Math.max(...data.map((item) => item.orders), 1);

  return `
    <div class="admin-restaurant-day-chart">
      ${data.map((item) => {
        const percent = Math.max(8, Math.round((item.orders / maxOrders) * 100));
        const isActive = String(item.date) === String(adminRestaurantsSelectedChartDay);
        const label = item.date === "Sin fecha" ? "Sin fecha" : item.date.slice(5).replace("-", "/");

        return `
          <button
            type="button"
            class="admin-restaurant-day-card ${isActive ? "active" : ""}"
            onclick="seleccionarDiaRestauranteAdmin('${adminRestaurantsEscape(item.date)}')"
          >
            <div class="admin-restaurant-day-info">
              <strong>${adminRestaurantsEscape(label)}</strong>
              <span>${item.orders} pedido(s)</span>
            </div>

            <div class="admin-restaurant-day-progress">
              <span style="width:${percent}%"></span>
            </div>

            <small>${adminRestaurantsMoney(item.sales)}</small>
          </button>
        `;
      }).join("")}
    </div>

    <div id="adminRestaurantDayOrdersWrap" class="admin-restaurant-day-orders-wrap">
      ${renderAdminRestaurantDayOrders(orders, adminRestaurantsSelectedChartDay)}
    </div>
  `;
}

function renderAdminRestaurantDayOrders(orders, dayKey) {
  if (!dayKey) {
    return `
      <div class="admin-restaurant-order-detail-empty">
        <strong>Selecciona un día</strong>
        <span>Al tocar un día de la gráfica, verás aquí sus pedidos.</span>
      </div>
    `;
  }

  const dayOrders = orders.filter((order) => {
    const date = adminRestaurantsGetDateObject(order);
    const key = date
      ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
      : "Sin fecha";

    return String(key) === String(dayKey);
  });

  if (!dayOrders.length) {
    return `<div class="empty-box">No hay pedidos registrados para este día.</div>`;
  }

  const totalDay = dayOrders.reduce((sum, order) => sum + adminRestaurantsGetOrderTotal(order), 0);

  return `
    <div class="admin-restaurant-day-orders-head">
      <div>
        <h4>Pedidos del día</h4>
        <p>${adminRestaurantsEscape(dayKey)} · ${dayOrders.length} pedido(s)</p>
      </div>
      <strong>${adminRestaurantsMoney(totalDay)}</strong>
    </div>

    <div class="admin-restaurant-day-orders-list">
      ${dayOrders.map((order) => {
        const total = adminRestaurantsGetOrderTotal(order);
        const customer = adminRestaurantsGetOrderCustomerName(order);
        const statusLabel = adminRestaurantsGetOrderStatusLabel(order);

        return `
          <article
            class="admin-restaurant-day-order"
            onclick="seleccionarPedidoRestauranteAdmin('${adminRestaurantsEscape(String(order?.id || ""))}')"
          >
            <div>
              <strong>#${adminRestaurantsEscape(order?.id || "-")}</strong>
              <small>${adminRestaurantsEscape(customer)} · ${adminRestaurantsEscape(adminRestaurantsGetDateText(order))}</small>
            </div>
            <div>
              <strong>${adminRestaurantsMoney(total)}</strong>
              <small>${adminRestaurantsEscape(statusLabel)}</small>
            </div>
          </article>
        `;
      }).join("")}
    </div>
  `;
}

function seleccionarDiaRestauranteAdmin(dayKey) {
  adminRestaurantsSelectedChartDay = String(dayKey || "");
  cambiarTabRestauranteAdmin("grafica");

  const restaurant = adminRestaurantsFilteredCache[adminRestaurantsSelectedIndex];
  if (!restaurant) return;

  const orders = adminRestaurantsGetOrders(restaurant);
  const chartWrap = document.getElementById("adminRestaurantChartWrap");

  if (chartWrap) {
    chartWrap.innerHTML = renderAdminRestaurantMiniChart(orders);
  }
}

function renderAdminRestaurantOrderDetail(order) {
  if (!order) {
    return `
      <div class="admin-restaurant-order-detail-empty">
        <strong>Selecciona un pedido</strong>
        <span>Al tocar un pedido de la lista, verás aquí su información completa.</span>
      </div>
    `;
  }

  const total = adminRestaurantsGetOrderTotal(order);
  const items = adminRestaurantsGetOrderItems(order);

  const itemsHtml = items.length
    ? items.map((item) => {
        const qty = Number(item?.qty || item?.quantity || 0);
        const price = Number(item?.price || 0);
        const subtotal = Number(item?.subtotal || qty * price);

        return `
          <div class="admin-restaurant-order-product">
            <div>
              <strong>${adminRestaurantsEscape(item?.name || "Producto")}</strong>
              <small>Cantidad: ${qty} · Unitario: ${adminRestaurantsMoney(price)}</small>
            </div>
            <strong>${adminRestaurantsMoney(subtotal)}</strong>
          </div>
        `;
      }).join("")
    : `<div class="empty-box">Este pedido no tiene productos visibles.</div>`;

  return `
    <div class="admin-restaurant-order-detail-box">
      <div class="admin-restaurant-section-head">
        <h4>Detalle del pedido</h4>
        <strong>${adminRestaurantsMoney(total)}</strong>
      </div>

      <div class="admin-restaurant-order-detail-title">
        <strong>#${adminRestaurantsEscape(order?.id || "-")}</strong>
        <span>${adminRestaurantsEscape(adminRestaurantsGetOrderStatusLabel(order))}</span>
      </div>

      <div class="admin-restaurant-order-detail-grid">
        <div><span>Cliente</span><strong>${adminRestaurantsEscape(adminRestaurantsGetOrderCustomerName(order))}</strong></div>
        <div><span>Teléfono</span><strong>${adminRestaurantsEscape(adminRestaurantsGetOrderCustomerPhone(order))}</strong></div>
        <div><span>Correo</span><strong>${adminRestaurantsEscape(adminRestaurantsGetOrderCustomerEmail(order))}</strong></div>
        <div><span>Fecha</span><strong>${adminRestaurantsEscape(adminRestaurantsGetDateText(order))}</strong></div>
        <div class="wide"><span>Dirección</span><strong>${adminRestaurantsEscape(adminRestaurantsGetOrderCustomerAddress(order))}</strong></div>
        <div><span>Productos</span><strong>${adminRestaurantsGetOrderItemsCount(order)}</strong></div>
      </div>

      <div class="admin-restaurant-order-products">
        ${itemsHtml}
      </div>
    </div>
  `;
}

function seleccionarPedidoRestauranteAdmin(orderId) {
  adminRestaurantsSelectedOrderId = String(orderId || "");
  cambiarTabRestauranteAdmin("pedidos");

  document.querySelectorAll(".admin-restaurant-order-item").forEach((item) => {
    item.classList.toggle("active", String(item.dataset.orderId || "") === adminRestaurantsSelectedOrderId);
  });

  const restaurant = adminRestaurantsFilteredCache[adminRestaurantsSelectedIndex];
  const orders = restaurant ? adminRestaurantsGetOrders(restaurant) : [];
  const selectedOrder = orders.find((order) => String(order?.id || "") === adminRestaurantsSelectedOrderId) || null;
  const target = document.getElementById("adminRestaurantSelectedOrderDetail");

  if (target) {
    target.innerHTML = renderAdminRestaurantOrderDetail(selectedOrder);
    target.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}



/* =====================================================
   ESTADO DE VISTA
====================================================== */
function adminRestaurantsReadViewState() {
  return adminRestaurantsViewStateMemory || {};
}

function adminRestaurantsSaveViewState() {
  const state = {
    searchText: document.getElementById("adminRestaurantSearchInput")?.value || "",
    selectedStatus: document.getElementById("adminRestaurantStatusFilter")?.value || "todos",
    selectedSales: document.getElementById("adminRestaurantSalesFilter")?.value || "todos",
    selectedRestaurantId: adminRestaurantsFilteredCache[adminRestaurantsSelectedIndex]
      ? adminRestaurantsGetId(adminRestaurantsFilteredCache[adminRestaurantsSelectedIndex])
      : ""
  };

  adminRestaurantsViewStateMemory = state;
}

/* =====================================================
   FILTROS
====================================================== */
function adminRestaurantsMatchSearch(restaurant, searchText) {
  const query = adminRestaurantsNormalize(searchText);
  if (!query) return true;

  const stats = adminRestaurantsGetRestaurantStats(restaurant);

  const searchable = [
    adminRestaurantsGetName(restaurant),
    adminRestaurantsGetEmail(restaurant),
    adminRestaurantsGetPhone(restaurant),
    adminRestaurantsGetAddress(restaurant),
    adminRestaurantsGetCategory(restaurant),
    adminRestaurantsStatusLabel(adminRestaurantsGetStatus(restaurant)),
    stats.orders.length,
    stats.sales
  ]
    .map(adminRestaurantsNormalize)
    .join(" ");

  return searchable.includes(query);
}

function adminRestaurantsMatchStatus(restaurant, selectedStatus) {
  if (!selectedStatus || selectedStatus === "todos") return true;
  return adminRestaurantsGetStatus(restaurant) === selectedStatus;
}

function adminRestaurantsMatchSales(restaurant, selectedSales) {
  if (!selectedSales || selectedSales === "todos") return true;

  const stats = adminRestaurantsGetRestaurantStats(restaurant);

  if (selectedSales === "con_ventas") return stats.orders.length > 0;
  if (selectedSales === "sin_ventas") return stats.orders.length === 0;

  return true;
}

function filtrarRestaurantesAdmin(options = {}) {
  const searchInput = document.getElementById("adminRestaurantSearchInput");
  const statusInput = document.getElementById("adminRestaurantStatusFilter");
  const salesInput = document.getElementById("adminRestaurantSalesFilter");

  const searchText = searchInput?.value || "";
  const selectedStatus = statusInput?.value || "todos";
  const selectedSales = salesInput?.value || "todos";

  const previousRestaurantId =
    options.selectedRestaurantId ||
    (adminRestaurantsFilteredCache[adminRestaurantsSelectedIndex]
      ? adminRestaurantsGetId(adminRestaurantsFilteredCache[adminRestaurantsSelectedIndex])
      : "");

  adminRestaurantsFilteredCache = [...adminRestaurantsSourceCache].filter((restaurant) => {
    return (
      adminRestaurantsMatchSearch(restaurant, searchText) &&
      adminRestaurantsMatchStatus(restaurant, selectedStatus) &&
      adminRestaurantsMatchSales(restaurant, selectedSales)
    );
  });

  const restoredIndex = adminRestaurantsFilteredCache.findIndex((restaurant) => {
    return String(adminRestaurantsGetId(restaurant)) === String(previousRestaurantId || "");
  });

  adminRestaurantsSelectedIndex = restoredIndex >= 0 ? restoredIndex : 0;

  adminRestaurantsSaveViewState();
  adminRestaurantsRefreshView();
}

function limpiarFiltrosRestaurantesAdmin() {
  const searchInput = document.getElementById("adminRestaurantSearchInput");
  const statusInput = document.getElementById("adminRestaurantStatusFilter");
  const salesInput = document.getElementById("adminRestaurantSalesFilter");

  if (searchInput) searchInput.value = "";
  if (statusInput) statusInput.value = "todos";
  if (salesInput) salesInput.value = "todos";

  adminRestaurantsViewStateMemory = {};

  adminRestaurantsFilteredCache = [...adminRestaurantsSourceCache];
  adminRestaurantsSelectedIndex = 0;
  adminRestaurantsRefreshView();
}

function adminRestaurantsRestoreViewState() {
  const state = adminRestaurantsReadViewState();

  const searchInput = document.getElementById("adminRestaurantSearchInput");
  const statusInput = document.getElementById("adminRestaurantStatusFilter");
  const salesInput = document.getElementById("adminRestaurantSalesFilter");

  if (searchInput) searchInput.value = state.searchText || "";
  if (statusInput) statusInput.value = state.selectedStatus || "todos";
  if (salesInput) salesInput.value = state.selectedSales || "todos";

  filtrarRestaurantesAdmin({
    selectedRestaurantId: state.selectedRestaurantId || ""
  });
}

/* =====================================================
   RENDER PRINCIPAL
====================================================== */
function renderAdminRestaurantsPro() {
  const container = document.getElementById("restaurantesList");
  if (!container) return;

  adminRestaurantsFilteredCache = [...adminRestaurantsSourceCache];
  adminRestaurantsSelectedIndex = 0;

  if (!adminRestaurantsSourceCache.length) {
    container.innerHTML = `<div class="empty-box">No hay restaurantes registrados.</div>`;
    return;
  }

  container.classList.remove("table-wrapper");

  container.innerHTML = `
    <div class="admin-restaurants-pro">
      <section class="admin-restaurants-filters">
        <div class="admin-restaurants-search">
          <input id="adminRestaurantSearchInput" type="text" placeholder="Buscar por restaurante, correo, teléfono..." oninput="filtrarRestaurantesAdmin()">
          <span>⌕</span>
        </div>

        <select id="adminRestaurantStatusFilter" onchange="filtrarRestaurantesAdmin()">
          <option value="todos">Todos los estados</option>
          <option value="pending">Pendientes</option>
          <option value="approved">Aprobados</option>
          <option value="blocked">Bloqueados</option>
        </select>

        <select id="adminRestaurantSalesFilter" onchange="filtrarRestaurantesAdmin()">
          <option value="todos">Todos</option>
          <option value="con_ventas">Con ventas</option>
          <option value="sin_ventas">Sin ventas</option>
        </select>

        <button type="button" class="admin-restaurants-btn refresh" onclick="refrescarRestaurantesAdminManual()">Actualizar</button>
        <button type="button" class="admin-restaurants-btn outline" onclick="limpiarFiltrosRestaurantesAdmin()">Limpiar</button>
      </section>

      <section class="admin-restaurants-layout">
        <div class="admin-restaurants-table-panel">
          <div id="adminRestaurantsTableWrap"></div>
          <div class="admin-restaurants-footer" id="adminRestaurantsFooter"></div>
        </div>

        <aside class="admin-restaurants-detail-side">
          <div id="adminSelectedRestaurantDetail"></div>
        </aside>
      </section>
    </div>
  `;

  adminRestaurantsRestoreViewState();
}

function adminRestaurantsRefreshView() {
  const tableWrap = document.getElementById("adminRestaurantsTableWrap");
  const footer = document.getElementById("adminRestaurantsFooter");

  if (tableWrap) {
    tableWrap.innerHTML = renderAdminRestaurantsTable(adminRestaurantsFilteredCache);
  }

  if (footer) {
    footer.textContent = adminRestaurantsFilteredCache.length
      ? `Mostrando ${adminRestaurantsFilteredCache.length} restaurante(s)`
      : "No hay restaurantes para mostrar";
  }

  renderAdminSelectedRestaurantDetail(adminRestaurantsFilteredCache[adminRestaurantsSelectedIndex] || null);
}

function renderAdminRestaurantsTable(restaurants) {
  if (!restaurants.length) {
    return `<div class="empty-box">No hay restaurantes que coincidan con los filtros.</div>`;
  }

  return `
    <table class="admin-restaurants-clean-table">
      <thead>
        <tr>
          <th>Restaurante</th>
          <th>Estado</th>
          <th>Comisión</th>
          <th>Pedidos</th>
          <th>Ventas</th>
          <th>Última venta</th>
        </tr>
      </thead>
      <tbody>
        ${restaurants.map((restaurant, index) => {
          const stats = adminRestaurantsGetRestaurantStats(restaurant);
          const isActive = index === adminRestaurantsSelectedIndex;
          const status = adminRestaurantsGetStatus(restaurant);
          const lastOrderText = stats.lastOrder ? adminRestaurantsGetDateText(stats.lastOrder) : "-";

          return `
            <tr class="admin-restaurant-row ${isActive ? "active" : ""}" id="adminRestaurantRow${index}" onclick="seleccionarRestauranteAdmin(${index})">
              <td>
                <strong>${adminRestaurantsEscape(adminRestaurantsGetName(restaurant))}</strong>
                <small>${adminRestaurantsEscape(adminRestaurantsGetEmail(restaurant) || "-")}</small>
              </td>
              <td><span class="admin-restaurant-status ${adminRestaurantsStatusClass(status)}">${adminRestaurantsEscape(adminRestaurantsStatusLabel(status))}</span></td>
              <td><strong>${adminRestaurantsGetCommission(restaurant)}%</strong></td>
              <td>${stats.orders.length}</td>
              <td><strong>${adminRestaurantsMoney(stats.sales)}</strong></td>
              <td>${adminRestaurantsEscape(lastOrderText)}</td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;
}

function seleccionarRestauranteAdmin(index) {
  adminRestaurantsSelectedIndex = index;
  adminRestaurantsSelectedOrderId = "";
  adminRestaurantsSelectedChartDay = "";

  document.querySelectorAll(".admin-restaurant-row").forEach((row) => {
    row.classList.remove("active");
  });

  const selected = document.getElementById(`adminRestaurantRow${index}`);
  if (selected) selected.classList.add("active");

  renderAdminSelectedRestaurantDetail(adminRestaurantsFilteredCache[index] || null);
  adminRestaurantsSaveViewState();
}


function cambiarTabRestauranteAdmin(tabName) {
  adminRestaurantsActiveDetailTab = String(tabName || "resumen");

  document.querySelectorAll(".admin-restaurant-tab-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === adminRestaurantsActiveDetailTab);
  });

  document.querySelectorAll(".admin-restaurant-tab-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.panel === adminRestaurantsActiveDetailTab);
  });
}

function renderAdminRestaurantTabs() {
  const tabs = [
    { id: "resumen", label: "Resumen" },
    { id: "pedidos", label: "Pedidos" },
    { id: "grafica", label: "Gráfica" },
    { id: "control", label: "Control" }
  ];

  return `
    <div class="admin-restaurant-tabs">
      ${tabs.map((tab) => `
        <button
          type="button"
          class="admin-restaurant-tab-btn ${adminRestaurantsActiveDetailTab === tab.id ? "active" : ""}"
          data-tab="${tab.id}"
          onclick="cambiarTabRestauranteAdmin('${tab.id}')"
        >
          ${tab.label}
        </button>
      `).join("")}
    </div>
  `;
}

function renderAdminSelectedRestaurantDetail(restaurant) {
  const target = document.getElementById("adminSelectedRestaurantDetail");
  if (!target) return;

  if (!restaurant) {
    target.innerHTML = `
      <div class="admin-restaurants-empty">
        <strong>Selecciona un restaurante</strong>
        <span>Haz clic sobre un restaurante para ver su operación.</span>
      </div>
    `;
    return;
  }

  const stats = adminRestaurantsGetRestaurantStats(restaurant);
  const status = adminRestaurantsGetStatus(restaurant);
  const encodedId = encodeURIComponent(adminRestaurantsGetId(restaurant));
  const encodedName = encodeURIComponent(adminRestaurantsGetName(restaurant));
  const commissionInputId = `restaurantCommissionDetail_${String(adminRestaurantsGetId(restaurant)).replace(/[^a-z0-9]/gi, "_")}`;

  const recentOrders = stats.orders.slice(0, 12);

  const ordersHtml = recentOrders.length
    ? recentOrders.map((order) => {
        const total = adminRestaurantsGetOrderTotal(order);
        const customer = order?.customer?.fullName || order?.customer?.name || order?.customer?.email || "Cliente";
        const statusLabel = typeof getStatusLabelAdmin === "function" ? getStatusLabelAdmin(order?.status) : (order?.status || "Pendiente");

        return `
          <article
            class="admin-restaurant-order-item ${String(order?.id || "") === String(adminRestaurantsSelectedOrderId || "") ? "active" : ""}"
            data-order-id="${adminRestaurantsEscape(order?.id || "")}"
            onclick="seleccionarPedidoRestauranteAdmin('${adminRestaurantsEscape(String(order?.id || ""))}')"
          >
            <div>
              <strong>#${adminRestaurantsEscape(order?.id || "-")}</strong>
              <small>${adminRestaurantsEscape(customer)} · ${adminRestaurantsEscape(adminRestaurantsGetDateText(order))}</small>
            </div>
            <div>
              <strong>${adminRestaurantsMoney(total)}</strong>
              <small>${adminRestaurantsEscape(statusLabel)}</small>
            </div>
          </article>
        `;
      }).join("")
    : `<div class="empty-box">Este restaurante aún no tiene pedidos.</div>`;

  target.innerHTML = `
    <div class="admin-restaurant-detail-head compact">
      <div>
        <span class="admin-restaurant-status ${adminRestaurantsStatusClass(status)}">${adminRestaurantsEscape(adminRestaurantsStatusLabel(status))}</span>
        <h3>${adminRestaurantsEscape(adminRestaurantsGetName(restaurant))}</h3>
        <p>${adminRestaurantsEscape(adminRestaurantsGetCategory(restaurant))} · ${adminRestaurantsEscape(adminRestaurantsGetAddress(restaurant))}</p>
      </div>
    </div>

    ${renderAdminRestaurantTabs()}

    <div class="admin-restaurant-tab-content">
      <section class="admin-restaurant-tab-panel ${adminRestaurantsActiveDetailTab === "resumen" ? "active" : ""}" data-panel="resumen">
        <section class="admin-restaurant-metrics">
          <div>
            <span>Ventas brutas</span>
            <strong>${adminRestaurantsMoney(stats.sales)}</strong>
          </div>

          <div>
            <span>Pedidos</span>
            <strong>${stats.orders.length}</strong>
          </div>

          <div>
            <span>Ticket promedio</span>
            <strong>${adminRestaurantsMoney(stats.avgTicket)}</strong>
          </div>

          <div>
            <span>Comisión DELI</span>
            <strong>${adminRestaurantsMoney(stats.deliCommission)}</strong>
          </div>
        </section>

        <section class="admin-restaurant-info-block clean">
          <h4>Datos del restaurante</h4>

          <div class="admin-restaurant-info-grid">
            <div><span>Correo</span><strong>${adminRestaurantsEscape(adminRestaurantsGetEmail(restaurant) || "-")}</strong></div>
            <div><span>Teléfono</span><strong>${adminRestaurantsEscape(adminRestaurantsGetPhone(restaurant))}</strong></div>
            <div><span>Dirección</span><strong>${adminRestaurantsEscape(adminRestaurantsGetAddress(restaurant))}</strong></div>
            <div><span>Entregados</span><strong>${stats.delivered}</strong></div>
          </div>
        </section>
      </section>

      <section class="admin-restaurant-tab-panel ${adminRestaurantsActiveDetailTab === "pedidos" ? "active" : ""}" data-panel="pedidos">
        <section class="admin-restaurant-info-block clean first">
          <div class="admin-restaurant-section-head">
            <h4>Últimos pedidos</h4>
            <strong>${adminRestaurantsMoney(stats.sales)}</strong>
          </div>

          <div class="admin-restaurant-orders-list tab-scroll">
            ${ordersHtml}
          </div>

          <div id="adminRestaurantSelectedOrderDetail" class="admin-restaurant-selected-order-detail">
            ${renderAdminRestaurantOrderDetail(
              stats.orders.find((order) => String(order?.id || "") === String(adminRestaurantsSelectedOrderId || "")) || null
            )}
          </div>
        </section>
      </section>

      <section class="admin-restaurant-tab-panel ${adminRestaurantsActiveDetailTab === "grafica" ? "active" : ""}" data-panel="grafica">
        <section class="admin-restaurant-info-block clean first">
          <div class="admin-restaurant-section-head">
            <h4>Pedidos por día</h4>
            <strong>Toca un día</strong>
          </div>

          <div id="adminRestaurantChartWrap">
            ${renderAdminRestaurantMiniChart(stats.orders)}
          </div>
        </section>
      </section>

      <section class="admin-restaurant-tab-panel ${adminRestaurantsActiveDetailTab === "control" ? "active" : ""}" data-panel="control">
        <section class="admin-restaurant-info-block clean first">
          <h4>Control operativo</h4>

          <div class="admin-restaurant-actions">
            <button type="button" class="admin-restaurants-btn approve" onclick="actualizarEstadoRestaurante('${encodedId}', 'approved')">Aprobar</button>
            <button type="button" class="admin-restaurants-btn block" onclick="actualizarEstadoRestaurante('${encodedId}', 'blocked')">Bloquear</button>
            <button type="button" class="admin-restaurants-btn danger" onclick="eliminarRestaurante('${encodedId}', '${encodedName}')">Eliminar</button>
          </div>

          <div class="admin-restaurant-commission-box">
            <div>
              <span>Comisión actual</span>
              <strong>${adminRestaurantsGetCommission(restaurant)}%</strong>
            </div>

            <input id="${adminRestaurantsEscape(commissionInputId)}" type="number" min="0" max="100" value="${adminRestaurantsGetCommission(restaurant)}">

            <button type="button" class="admin-restaurants-btn save" onclick="guardarComisionRestaurante('${encodedId}', '${adminRestaurantsEscape(commissionInputId)}')">Guardar comisión</button>
          </div>
        </section>
      </section>
    </div>
  `;
}

function refrescarRestaurantesAdminManual() {
  adminRestaurantsSaveViewState();

  if (window.refrescarPanelAdministradorManual) {
    window.refrescarPanelAdministradorManual();
    return;
  }

  adminRestaurantsRestoreViewState();
}

/* =====================================================
   ESTILOS DEL MÓDULO
====================================================== */
function inyectarEstilosAdminRestaurants() {
  if (document.getElementById("deli-admin-restaurants-styles")) return;

  const style = document.createElement("style");
  style.id = "deli-admin-restaurants-styles";
  style.textContent = `
    .admin-restaurants-pro {
      display: grid;
      gap: 18px;
    }

    .admin-restaurants-filters,
    .admin-restaurants-table-panel,
    .admin-restaurants-detail-side {
      background: #ffffff;
      border: 1px solid #eef0f4;
      border-radius: 18px;
      box-shadow: 0 16px 36px rgba(15, 23, 42, 0.06);
    }

    .admin-restaurants-filters {
      display: grid;
      grid-template-columns: minmax(260px, 1.5fr) minmax(160px, .8fr) minmax(160px, .8fr) auto auto;
      gap: 14px;
      align-items: center;
      padding: 18px;
    }

    .admin-restaurants-search {
      position: relative;
    }

    .admin-restaurants-search input,
    .admin-restaurants-filters select {
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

    .admin-restaurants-search input {
      padding: 0 44px 0 16px;
    }

    .admin-restaurants-search span {
      position: absolute;
      right: 14px;
      top: 50%;
      transform: translateY(-50%);
      color: #111827;
      font-size: 20px;
      pointer-events: none;
    }

    .admin-restaurants-filters select {
      padding: 0 14px;
      cursor: pointer;
    }

    .admin-restaurants-search input:focus,
    .admin-restaurants-filters select:focus {
      border-color: #ff4d4d;
      box-shadow: 0 0 0 3px rgba(255, 77, 77, .10);
    }

    .admin-restaurants-layout {
      display: grid;
      grid-template-columns: minmax(620px, 1.4fr) minmax(380px, .8fr);
      gap: 20px;
      align-items: start;
    }

    .admin-restaurants-table-panel {
      overflow: hidden;
      min-width: 0;
    }

    .admin-restaurants-clean-table {
      width: 100%;
      border-collapse: collapse;
      min-width: 760px;
      font-size: 14px;
    }

    .admin-restaurants-clean-table thead {
      background: #ffffff;
      box-shadow: 0 1px 0 #eef0f4;
    }

    .admin-restaurants-clean-table th {
      text-transform: uppercase;
      font-size: 11px;
      letter-spacing: .02em;
      color: #6b7280;
      text-align: left;
      padding: 16px 18px;
      font-weight: 900;
    }

    .admin-restaurants-clean-table td {
      padding: 15px 18px;
      border-bottom: 1px solid #eef0f4;
      color: #111827;
      vertical-align: middle;
    }

    .admin-restaurants-clean-table td small {
      display: block;
      color: #6b7280;
      margin-top: 3px;
      font-size: 12px;
    }

    .admin-restaurant-row {
      cursor: pointer;
      transition: .16s ease;
      background: #ffffff;
    }

    .admin-restaurant-row:hover {
      background: #fff7f7;
    }

    .admin-restaurant-row.active {
      background: linear-gradient(90deg, rgba(255,77,77,.12), rgba(255,255,255,1) 55%);
      box-shadow: inset 4px 0 0 #ff4d4d;
    }

    .admin-restaurant-status {
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

    .admin-restaurant-status-approved {
      background: #dcfce7;
      color: #047857;
    }

    .admin-restaurant-status-pending {
      background: #fff7ed;
      color: #ea580c;
    }

    .admin-restaurant-status-blocked {
      background: #fee2e2;
      color: #b91c1c;
    }

    .admin-restaurants-footer {
      padding: 14px 18px;
      color: #6b7280;
      font-size: 13px;
      background: #ffffff;
    }

    .admin-restaurants-detail-side {
      padding: 24px;
      position: sticky;
      top: 18px;
    }

    .admin-restaurant-detail-head {
      padding-bottom: 18px;
      border-bottom: 1px solid #eef0f4;
    }

    .admin-restaurant-detail-head h3 {
      margin: 12px 0 6px;
      color: #111827;
      font-size: 24px;
    }

    .admin-restaurant-detail-head p {
      margin: 0;
      color: #6b7280;
      font-size: 14px;
    }

    .admin-restaurant-metrics {
      display: grid;
      grid-template-columns: repeat(2, minmax(120px, 1fr));
      gap: 12px;
      margin: 18px 0;
    }

    .admin-restaurant-metrics div,
    .admin-restaurant-info-grid div {
      border: 1px solid #eef0f4;
      background: #f9fafb;
      border-radius: 14px;
      padding: 12px;
    }

    .admin-restaurant-metrics span,
    .admin-restaurant-info-grid span,
    .admin-restaurant-commission-box span {
      display: block;
      color: #6b7280;
      font-size: 12px;
      font-weight: 700;
    }

    .admin-restaurant-metrics strong,
    .admin-restaurant-info-grid strong,
    .admin-restaurant-commission-box strong {
      display: block;
      color: #111827;
      margin-top: 5px;
      word-break: break-word;
    }

    .admin-restaurant-info-block {
      border-top: 1px solid #eef0f4;
      padding-top: 18px;
      margin-top: 18px;
    }

    .admin-restaurant-info-block h4 {
      margin: 0 0 12px;
      color: #111827;
    }

    .admin-restaurant-info-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(130px, 1fr));
      gap: 12px;
    }

    .admin-restaurant-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-bottom: 14px;
    }

    .admin-restaurants-btn {
      border: 0;
      border-radius: 10px;
      padding: 11px 14px;
      cursor: pointer;
      font-weight: 900;
      white-space: nowrap;
    }

    .admin-restaurants-btn.refresh {
      background: #111827;
      color: #ffffff;
    }

    .admin-restaurants-btn.outline {
      background: #ffffff;
      color: #ff4d4d;
      border: 1px solid #ff4d4d;
    }

    .admin-restaurants-btn.approve {
      background: #16a34a;
      color: #ffffff;
    }

    .admin-restaurants-btn.block {
      background: #f59e0b;
      color: #111827;
    }

    .admin-restaurants-btn.danger {
      background: #111827;
      color: #ffffff;
    }

    .admin-restaurants-btn.save {
      background: #ff4d4d;
      color: #ffffff;
    }

    .admin-restaurant-commission-box {
      display: grid;
      grid-template-columns: 1fr 90px auto;
      gap: 10px;
      align-items: center;
      background: #fff7f7;
      border: 1px dashed #ff4d4d;
      border-radius: 16px;
      padding: 12px;
    }

    .admin-restaurant-commission-box input {
      width: 100%;
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      padding: 11px 10px;
      font: inherit;
      outline: none;
    }

    .admin-restaurant-section-head,
    .admin-restaurant-order-item {
      display: flex;
      justify-content: space-between;
      gap: 14px;
      align-items: flex-start;
    }

    .admin-restaurant-section-head strong {
      color: #ff4d4d;
    }

    .admin-restaurant-orders-list {
      display: grid;
      gap: 10px;
    }

    .admin-restaurant-order-item {
      border: 1px solid #eef0f4;
      border-radius: 14px;
      padding: 12px;
      background: #ffffff;
    }

    .admin-restaurant-order-item small {
      display: block;
      margin-top: 4px;
      color: #6b7280;
      font-size: 12px;
    }

    .admin-restaurants-empty {
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


    .admin-restaurant-day-chart {
      display: grid;
      gap: 10px;
    }

    .admin-restaurant-day-card {
      width: 100%;
      border: 1px solid #eef0f4;
      background: #ffffff;
      border-radius: 14px;
      padding: 12px;
      display: grid;
      gap: 8px;
      cursor: pointer;
      text-align: left;
      transition: .16s ease;
    }

    .admin-restaurant-day-card:hover,
    .admin-restaurant-day-card.active {
      border-color: #ff4d4d;
      background: #fff7f7;
      box-shadow: 0 10px 22px rgba(255, 77, 77, .10);
    }

    .admin-restaurant-day-info {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      align-items: center;
    }

    .admin-restaurant-day-info strong {
      color: #111827;
    }

    .admin-restaurant-day-info span,
    .admin-restaurant-day-card small {
      color: #6b7280;
      font-size: 12px;
      font-weight: 800;
    }

    .admin-restaurant-day-progress {
      height: 9px;
      border-radius: 999px;
      background: #f3f4f6;
      overflow: hidden;
    }

    .admin-restaurant-day-progress span {
      display: block;
      height: 100%;
      border-radius: 999px;
      background: linear-gradient(90deg, #ff4d4d, #ff9a9a);
    }

    .admin-restaurant-day-orders-wrap {
      margin-top: 14px;
      border: 1px solid #eef0f4;
      background: #f9fafb;
      border-radius: 16px;
      padding: 12px;
    }

    .admin-restaurant-day-orders-head {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: flex-start;
      margin-bottom: 12px;
    }

    .admin-restaurant-day-orders-head h4 {
      margin: 0;
      color: #111827;
    }

    .admin-restaurant-day-orders-head p {
      margin: 4px 0 0;
      color: #6b7280;
      font-size: 12px;
    }

    .admin-restaurant-day-orders-head strong {
      color: #ff4d4d;
      white-space: nowrap;
    }

    .admin-restaurant-day-orders-list {
      display: grid;
      gap: 8px;
      max-height: 260px;
      overflow: auto;
    }

    .admin-restaurant-day-order {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: flex-start;
      border: 1px solid #eef0f4;
      border-radius: 14px;
      background: #ffffff;
      padding: 10px;
      cursor: pointer;
      transition: .16s ease;
    }

    .admin-restaurant-day-order:hover {
      border-color: #ff4d4d;
      background: #fff7f7;
    }

    .admin-restaurant-day-order small {
      display: block;
      color: #6b7280;
      margin-top: 3px;
      font-size: 12px;
    }

    .admin-restaurant-order-item {
      cursor: pointer;
      transition: .16s ease;
    }

    .admin-restaurant-order-item:hover,
    .admin-restaurant-order-item.active {
      border-color: #ff4d4d;
      background: #fff7f7;
      box-shadow: 0 10px 22px rgba(255, 77, 77, .10);
    }

    .admin-restaurant-selected-order-detail {
      margin-top: 16px;
    }

    .admin-restaurant-order-detail-empty {
      display: grid;
      gap: 4px;
      text-align: center;
      color: #6b7280;
      border: 1px dashed #d1d5db;
      background: #f9fafb;
      border-radius: 16px;
      padding: 18px;
    }

    .admin-restaurant-order-detail-empty strong {
      color: #111827;
    }

    .admin-restaurant-order-detail-box {
      border: 1px solid #eef0f4;
      border-radius: 18px;
      background: #ffffff;
      padding: 14px;
    }

    .admin-restaurant-order-detail-title {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: center;
      margin: 12px 0;
      padding: 12px;
      border-radius: 14px;
      background: #fff7f7;
    }

    .admin-restaurant-order-detail-title strong {
      color: #111827;
    }

    .admin-restaurant-order-detail-title span {
      display: inline-flex;
      padding: 6px 10px;
      border-radius: 999px;
      background: #dcfce7;
      color: #047857;
      font-size: 12px;
      font-weight: 900;
    }

    .admin-restaurant-order-detail-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(120px, 1fr));
      gap: 10px;
      margin-bottom: 12px;
    }

    .admin-restaurant-order-detail-grid div {
      border: 1px solid #eef0f4;
      background: #f9fafb;
      border-radius: 14px;
      padding: 10px;
    }

    .admin-restaurant-order-detail-grid div.wide {
      grid-column: 1 / -1;
    }

    .admin-restaurant-order-detail-grid span {
      display: block;
      color: #6b7280;
      font-size: 12px;
      font-weight: 800;
    }

    .admin-restaurant-order-detail-grid strong {
      display: block;
      color: #111827;
      margin-top: 4px;
      word-break: break-word;
    }

    .admin-restaurant-order-products {
      display: grid;
      gap: 8px;
    }

    .admin-restaurant-order-product {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      border-top: 1px solid #eef0f4;
      padding-top: 10px;
    }

    .admin-restaurant-order-product small {
      display: block;
      color: #6b7280;
      margin-top: 4px;
      font-size: 12px;
    }



    .admin-restaurant-detail-head.compact {
      padding-bottom: 14px;
    }

    .admin-restaurant-detail-head.compact h3 {
      font-size: 22px;
    }

    .admin-restaurant-tabs {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin: 14px 0 4px;
      background: #f9fafb;
      border: 1px solid #eef0f4;
      border-radius: 14px;
      padding: 6px;
      position: sticky;
      top: 0;
      z-index: 3;
    }

    .admin-restaurant-tab-btn {
      border: 0;
      border-radius: 10px;
      padding: 10px 8px;
      background: transparent;
      color: #6b7280;
      font-weight: 900;
      cursor: pointer;
      transition: .16s ease;
    }

    .admin-restaurant-tab-btn:hover,
    .admin-restaurant-tab-btn.active {
      background: #ff4d4d;
      color: #ffffff;
      box-shadow: 0 8px 18px rgba(255, 77, 77, .18);
    }

    .admin-restaurant-tab-content {
      margin-top: 12px;
    }

    .admin-restaurant-tab-panel {
      display: none;
      animation: adminRestaurantFade .16s ease;
    }

    .admin-restaurant-tab-panel.active {
      display: block;
    }

    @keyframes adminRestaurantFade {
      from {
        opacity: 0;
        transform: translateY(4px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .admin-restaurant-info-block.clean {
      border-top: 0;
      margin-top: 0;
      padding-top: 0;
    }

    .admin-restaurant-info-block.clean.first {
      margin-top: 0;
    }

    .admin-restaurant-orders-list.tab-scroll {
      max-height: 330px;
      overflow: auto;
      padding-right: 4px;
    }

    .admin-restaurant-day-orders-list {
      max-height: 300px;
    }

    .admin-restaurant-selected-order-detail {
      max-height: 430px;
      overflow: auto;
      padding-right: 4px;
    }

    .admin-restaurants-detail-side {
      max-height: calc(100vh - 150px);
      overflow: auto;
    }


    @media (max-width: 1280px) {
      .admin-restaurants-layout {
        grid-template-columns: 1fr;
      }

      .admin-restaurants-detail-side {
        position: static;
      }
    }

    @media (max-width: 1000px) {
      .admin-restaurants-filters {
        grid-template-columns: 1fr 1fr;
      }

      .admin-restaurant-commission-box {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 680px) {
      .admin-restaurants-filters,
      .admin-restaurant-metrics,
      .admin-restaurant-info-grid,
      .admin-restaurant-order-detail-grid,
      .admin-restaurant-tabs {
        grid-template-columns: 1fr;
      }

      .admin-restaurant-day-orders-head,
      .admin-restaurant-day-order {
        flex-direction: column;
      }
    }
  `;

  document.head.appendChild(style);
}

/* =====================================================
   PUENTE PÚBLICO DEL MÓDULO
====================================================== */
window.initAdminRestaurants = function initAdminRestaurants(restaurants, orders) {
  adminRestaurantsSourceCache = Array.isArray(restaurants) ? restaurants : [];
  adminRestaurantsOrdersCache = Array.isArray(orders) ? orders : [];
  renderAdminRestaurantsPro();
};

window.filtrarRestaurantesAdmin = filtrarRestaurantesAdmin;
window.limpiarFiltrosRestaurantesAdmin = limpiarFiltrosRestaurantesAdmin;
window.seleccionarRestauranteAdmin = seleccionarRestauranteAdmin;
window.cambiarTabRestauranteAdmin = cambiarTabRestauranteAdmin;
window.seleccionarPedidoRestauranteAdmin = seleccionarPedidoRestauranteAdmin;
window.seleccionarDiaRestauranteAdmin = seleccionarDiaRestauranteAdmin;
window.refrescarRestaurantesAdminManual = refrescarRestaurantesAdminManual;

inyectarEstilosAdminRestaurants();




