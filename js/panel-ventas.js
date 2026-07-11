/* =========================================
   DELI FOODS
   panel-ventas.js
   PREMIUM + GRÁFICO + SCROLL INTERNO + PDF VISUAL
========================================= */

document.addEventListener("DOMContentLoaded", async () => {
  const RESTAURANTS_API_URL = window.DELI_API_URL || "https://deligo-backend-i554.onrender.com";

  /*
    La comisión ya no queda fija en 15%.
    Se carga desde el backend según el restaurante actual.
    Fallback seguro: 15%.
  */
  let COMMISSION_PERCENT = 15;
  let COMMISSION = COMMISSION_PERCENT / 100;

  let currentFilter = "all";
  let deliveredOrders = [];
  let customDateFrom = "";
  let customDateTo = "";
  let salesChart = null;

  function getRestaurant() {
    if (typeof getSavedRestaurant === "function") {
      const r = getSavedRestaurant();
      if (r) return r;
    }

    if (typeof getCurrentUser === "function") {
      const r = getCurrentUser();
      if (r && r.role === "restaurant") return r;
    }

    window.location.href = "index.html";
    return null;
  }

  function normalizeEmail(value) {
    return String(value || "").trim().toLowerCase();
  }

  /*
    Lee la comisión individual del restaurante desde backend.
    El panel administrativo puede cambiarla, por ejemplo de 15% a 30%.
    Esta función sincroniza esa comisión con el desglose de ventas.
  */
  async function loadRestaurantCommission(restaurantEmail) {
    const normalizedEmail = normalizeEmail(restaurantEmail);

    if (!normalizedEmail) {
      COMMISSION_PERCENT = 15;
      COMMISSION = 0.15;
      return;
    }

    try {
      const response = await fetch(RESTAURANTS_API_URL);
      const data = await response.json();

      const restaurants = Array.isArray(data)
        ? data
        : Array.isArray(data.restaurants)
          ? data.restaurants
          : [];

      const restaurant = restaurants.find((item) => {
        return normalizeEmail(item?.email) === normalizedEmail;
      });

      const backendCommission = Number(
        restaurant?.commissionPercent ?? restaurant?.commission
      );

      if (!Number.isNaN(backendCommission) && backendCommission >= 0) {
        COMMISSION_PERCENT = backendCommission;
        COMMISSION = backendCommission / 100;
        return;
      }
    } catch (error) {
      console.warn("No se pudo leer la comisión desde backend:", error);
    }

    COMMISSION_PERCENT = 15;
    COMMISSION = 0.15;
  }

  /*
    Muestra la comisión aplicada de forma visible pero no invasiva.
    Se inserta automáticamente debajo del subtítulo principal del panel,
    sin modificar ventas-restaurante.html ni romper la estructura existente.
  */
  function renderCommissionBadge() {
    if (document.getElementById("restaurantCommissionBadge")) return;

    const subtitle = document.querySelector("body > p");
    const title = document.querySelector("h1");

    const badge = document.createElement("div");
    badge.id = "restaurantCommissionBadge";
    badge.textContent = `Comisión aplicada por DELI: ${COMMISSION_PERCENT}%`;
    badge.style.display = "inline-flex";
    badge.style.alignItems = "center";
    badge.style.gap = "8px";
    badge.style.marginTop = "10px";
    badge.style.marginBottom = "18px";
    badge.style.padding = "9px 14px";
    badge.style.borderRadius = "999px";
    badge.style.background = "#fff7ed";
    badge.style.border = "1px solid #fed7aa";
    badge.style.color = "#c2410c";
    badge.style.fontWeight = "700";
    badge.style.fontSize = "14px";
    badge.style.boxShadow = "0 8px 20px rgba(0,0,0,0.04)";

    if (subtitle && subtitle.parentNode) {
      subtitle.insertAdjacentElement("afterend", badge);
      return;
    }

    if (title && title.parentNode) {
      title.insertAdjacentElement("afterend", badge);
    }
  }

  async function getOrdersFromBackend(email) {
    if (
      window.DELI_ORDERS &&
      typeof window.DELI_ORDERS.getOrdersByRestaurant === "function"
    ) {
      try {
        const orders = await window.DELI_ORDERS.getOrdersByRestaurant(email);
        return Array.isArray(orders) ? orders : [];
      } catch (error) {
        console.warn("No se pudieron obtener las ventas desde backend:", error);
      }
    }
    return [];
  }

  function formatMoney(value) {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      minimumFractionDigits: 0
    }).format(Number(value || 0));
  }

  function getTotal(order) {
    if (order.total) return Number(order.total);

    if (Array.isArray(order.items)) {
      return order.items.reduce((sum, item) => {
        const qty = Number(item.qty || 0);
        const price = Number(item.price || 0);
        const subtotal = Number(item.subtotal || 0);
        return sum + (subtotal > 0 ? subtotal : qty * price);
      }, 0);
    }

    return 0;
  }

  function normalizeStatus(status) {
    const raw = String(status || "")
      .toLowerCase()
      .trim()
      .replaceAll("-", "_")
      .replaceAll(" ", "_");

    if (
      raw === "delivered" ||
      raw === "finalizado" ||
      raw === "finished" ||
      raw === "completed"
    ) {
      return "entregado";
    }

    return raw;
  }

  function getStatusLabel(status) {
    const s = normalizeStatus(status);

    switch (s) {
      case "pendiente": return "Pendiente";
      case "aceptado": return "Aceptado";
      case "preparando": return "Preparando";
      case "listo": return "Listo";
      case "en_camino": return "En camino";
      case "entregado": return "Entregado";
      default: return s || "-";
    }
  }

  function isDelivered(order) {
    return normalizeStatus(order.status) === "entregado";
  }

  function sameRestaurant(order, email) {
    const r = String(order.restaurantEmail || order.restaurant?.email || "").toLowerCase().trim();
    return r === String(email || "").toLowerCase().trim();
  }

  function parseDateFromDDMMYYYY(dateStr) {
    const raw = String(dateStr || "").trim();
    const match = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (!match) return null;

    const day = Number(match[1]);
    const month = Number(match[2]) - 1;
    const year = Number(match[3]);

    const parsed = new Date(year, month, day);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function getDate(order) {
    if (order.createdAt) {
      const d = new Date(order.createdAt);
      if (!Number.isNaN(d.getTime())) return d;
    }

    if (order.date) {
      const ddmmyyyy = parseDateFromDDMMYYYY(order.date);
      if (ddmmyyyy) {
        if (order.time) {
          const withTime = new Date(ddmmyyyy);
          const rawTime = String(order.time || "").toLowerCase().trim();
          let hours = 0;
          let minutes = 0;

          const timeMatch = rawTime.match(/(\d{1,2})[:.](\d{2})/);
          if (timeMatch) {
            hours = Number(timeMatch[1]);
            minutes = Number(timeMatch[2]);

            if (rawTime.includes("p. m.") || rawTime.includes("pm")) {
              if (hours < 12) hours += 12;
            }

            if (rawTime.includes("a. m.") || rawTime.includes("am")) {
              if (hours === 12) hours = 0;
            }
          }

          withTime.setHours(hours, minutes, 0, 0);
          return withTime;
        }

        return ddmmyyyy;
      }

      const fallback = new Date(order.date);
      if (!Number.isNaN(fallback.getTime())) return fallback;
    }

    return new Date();
  }

  function formatDate(order) {
    return getDate(order).toLocaleString("es-CL");
  }

  function formatOnlyDate(dateValue) {
    return dateValue.toLocaleDateString("es-CL", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  }

  function getDateKey(dateValue) {
    const year = dateValue.getFullYear();
    const month = String(dateValue.getMonth() + 1).padStart(2, "0");
    const day = String(dateValue.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function startOfToday() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  function startOfWeek() {
    const today = startOfToday();
    const day = today.getDay();
    const diff = day === 0 ? 6 : day - 1;
    const monday = new Date(today);
    monday.setDate(today.getDate() - diff);
    monday.setHours(0, 0, 0, 0);
    return monday;
  }

  function startOfMonth() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }

  function getCustomerName(order) {
    return order.customer?.fullName || order.customer?.name || order.fullName || "Cliente";
  }

  function getCustomerPhone(order) {
    return order.customer?.phone || order.phone || "-";
  }

  function getCustomerAddress(order) {
    return order.customer?.address || order.address || "-";
  }

  function getCurrentFilterLabel() {
    if (customDateFrom || customDateTo) return "Rango personalizado";
    if (currentFilter === "today") return "Hoy";
    if (currentFilter === "week") return "Semana";
    if (currentFilter === "month") return "Mes";
    return "Todas";
  }

  function isWithinCustomRange(orderDate) {
    if (!customDateFrom && !customDateTo) return true;

    const value = new Date(orderDate.getFullYear(), orderDate.getMonth(), orderDate.getDate(), 12, 0, 0, 0);

    if (customDateFrom) {
      const [y, m, d] = customDateFrom.split("-").map(Number);
      const from = new Date(y, m - 1, d, 0, 0, 0, 0);
      if (value < from) return false;
    }

    if (customDateTo) {
      const [y, m, d] = customDateTo.split("-").map(Number);
      const to = new Date(y, m - 1, d, 23, 59, 59, 999);
      if (value > to) return false;
    }

    return true;
  }

  function getFilteredOrders(filter = "all") {
    let list = [...deliveredOrders];

    if (filter === "today") {
      const todayStart = startOfToday();
      list = list.filter(order => getDate(order) >= todayStart);
    }

    if (filter === "week") {
      const weekStart = startOfWeek();
      list = list.filter(order => getDate(order) >= weekStart);
    }

    if (filter === "month") {
      const monthStart = startOfMonth();
      list = list.filter(order => getDate(order) >= monthStart);
    }

    list = list.filter(order => isWithinCustomRange(getDate(order)));

    return list.sort((a, b) => getDate(b) - getDate(a));
  }

  function groupOrdersByDay(list) {
    const grouped = new Map();

    list.forEach(order => {
      const dateObj = getDate(order);
      const key = getDateKey(dateObj);
      const total = getTotal(order);

      if (!grouped.has(key)) {
        grouped.set(key, {
          key,
          date: dateObj,
          total: 0,
          count: 0,
          net: 0
        });
      }

      const current = grouped.get(key);
      current.total += total;
      current.count += 1;
      current.net += total * (1 - COMMISSION);
    });

    return Array.from(grouped.values()).sort((a, b) => a.date - b.date);
  }

  function fillSummaryCards() {
    const todayStart = startOfToday();
    const weekStart = startOfWeek();
    const monthStart = startOfMonth();

    let totalToday = 0;
    let totalWeek = 0;
    let totalMonth = 0;
    let totalAll = 0;

    deliveredOrders.forEach(order => {
      const total = getTotal(order);
      const d = getDate(order);

      totalAll += total;

      if (d >= todayStart) totalToday += total;
      if (d >= weekStart) totalWeek += total;
      if (d >= monthStart) totalMonth += total;
    });

    const net = totalAll * (1 - COMMISSION);

    const elToday = document.getElementById("salesToday");
    const elWeek = document.getElementById("salesWeek");
    const elMonth = document.getElementById("salesMonth");
    const elNet = document.getElementById("salesNet");

    if (elToday) elToday.textContent = formatMoney(totalToday);
    if (elWeek) elWeek.textContent = formatMoney(totalWeek);
    if (elMonth) elMonth.textContent = formatMoney(totalMonth);
    if (elNet) elNet.textContent = formatMoney(net);
  }

  function renderFilterSummary(filter = "all") {
    const list = getFilteredOrders(filter);
    const gross = list.reduce((sum, order) => sum + getTotal(order), 0);
    const commission = gross * COMMISSION;
    const avg = list.length ? gross / list.length : 0;

    const setText = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    };

    setText("filterOrdersCount", String(list.length));
    setText("filterGrossTotal", formatMoney(gross));
    setText("filterCommissionTotal", formatMoney(commission));
    setText("filterAverageTicket", formatMoney(avg));

    const summaryLabel = document.getElementById("filterSummaryLabel");
    if (summaryLabel) {
      summaryLabel.textContent = `Métricas del período visible: ${getCurrentFilterLabel()}.`;
    }
  }

  function renderDailyChart(filter = "all") {
    const list = getFilteredOrders(filter);
    const grouped = groupOrdersByDay(list);
    const chartSummaryLabel = document.getElementById("chartSummaryLabel");

    if (chartSummaryLabel) {
      chartSummaryLabel.textContent = `Visualización diaria según el filtro: ${getCurrentFilterLabel()}.`;
    }

    const ctx = document.getElementById("dailySalesChart");
    if (!ctx) return;

    if (salesChart) {
      salesChart.destroy();
      salesChart = null;
    }

    salesChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: grouped.map(item => formatOnlyDate(item.date)),
        datasets: [
          {
            label: "Ventas por día",
            data: grouped.map(item => item.total),
            borderRadius: 8
          }
        ]
      },
      options: {
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: (context) => formatMoney(context.raw)
            }
          }
        },
        scales: {
          y: {
            ticks: {
              callback: (value) => formatMoney(value)
            }
          }
        }
      }
    });
  }

  function renderDailySummary(filter = "all") {
    const list = getFilteredOrders(filter);
    const dailySalesList = document.getElementById("dailySalesList");
    const dailySummaryLabel = document.getElementById("dailySummaryLabel");

    if (!dailySalesList) return;

    if (dailySummaryLabel) {
      dailySummaryLabel.textContent = `Aquí verás cuánto vendiste cada día según el filtro: ${getCurrentFilterLabel()}.`;
    }

    if (!list.length) {
      dailySalesList.innerHTML = `
        <div class="empty-sales">
          No hay ventas diarias para mostrar en este filtro.
        </div>
      `;
      return;
    }

    const groupedList = groupOrdersByDay(list).sort((a, b) => b.date - a.date);

    dailySalesList.innerHTML = groupedList.map(day => `
      <article class="sales-daily-card">
        <div class="sales-daily-top">
          <div>
            <div class="sales-daily-date">${formatOnlyDate(day.date)}</div>
            <div class="sales-daily-meta">${day.count} pedido(s)</div>
          </div>

          <div style="text-align:right;">
            <div class="sales-daily-amount">${formatMoney(day.total)}</div>
            <div class="sales-daily-meta">Neto: ${formatMoney(day.net)}</div>
          </div>
        </div>

        <div class="sales-daily-orders">
          Promedio por pedido: ${formatMoney(day.count ? day.total / day.count : 0)}
        </div>
      </article>
    `).join("");
  }

  function renderTable(filter = "all") {
    const tbody = document.getElementById("salesTableBody");
    if (!tbody) return;

    const list = getFilteredOrders(filter);

    if (!list.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="empty-sales">
            No hay ventas para mostrar en este filtro.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = list.map(order => {
      const total = getTotal(order);
      const commission = total * COMMISSION;
      const net = total - commission;

      return `
        <tr>
          <td>#${order.id || "-"}</td>
          <td>${getCustomerName(order)}</td>
          <td>${formatMoney(total)}</td>
          <td>${formatMoney(commission)}</td>
          <td>${formatMoney(net)}</td>
          <td>${formatDate(order)}</td>
          <td>
            <button class="btn-detail view-sale-detail-btn" type="button" data-id="${order.id || ""}">
              Ver detalle
            </button>
          </td>
        </tr>
      `;
    }).join("");

    document.querySelectorAll(".view-sale-detail-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const orderId = String(btn.dataset.id || "");
        const selected = deliveredOrders.find(order => String(order.id || "") === orderId);
        if (selected) showSaleDetail(selected);
      });
    });
  }

  function showSaleDetail(order) {
    const panel = document.getElementById("saleDetailPanel");
    const itemsList = document.getElementById("detailItemsList");

    const total = getTotal(order);
    const commission = total * COMMISSION;
    const net = total - commission;

    const setText = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    };

    setText("detailOrderId", `#${order.id || "-"}`);
    setText("detailCustomerName", getCustomerName(order));
    setText("detailCustomerPhone", getCustomerPhone(order));
    setText("detailCustomerAddress", getCustomerAddress(order));
    setText("detailTotal", formatMoney(total));
    setText("detailCommission", formatMoney(commission));
    setText("detailNet", formatMoney(net));
    setText("detailStatus", getStatusLabel(order.status));
    setText("detailDate", formatDate(order));
    setText("detailNotes", order.notes || "Sin notas.");

    if (itemsList) {
      const items = Array.isArray(order.items) ? order.items : [];

      if (!items.length) {
        itemsList.innerHTML = `<div>Este pedido no tiene productos visibles.</div>`;
      } else {
        itemsList.innerHTML = items.map(item => {
          const qty = Number(item.qty || 0);
          const price = Number(item.price || 0);
          const subtotal = Number(item.subtotal || (qty * price));

          return `
            <div class="sale-item-row">
              <div>${item.name || "Producto"} x${qty}</div>
              <div>${formatMoney(subtotal)}</div>
            </div>
          `;
        }).join("");
      }
    }

    if (panel) {
      panel.classList.remove("hidden");
      panel.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function hideSaleDetail() {
    const panel = document.getElementById("saleDetailPanel");
    if (panel) panel.classList.add("hidden");
  }

  function drawPdfCard(doc, x, y, w, h, title, value) {
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(x, y, w, h, 4, 4, "F");
    doc.setTextColor(107, 114, 128);
    doc.setFontSize(10);
    doc.text(title, x + 4, y + 7);
    doc.setTextColor(17, 24, 39);
    doc.setFontSize(14);
    doc.text(value, x + 4, y + 16);
  }

  function exportPdf() {
    const list = getFilteredOrders(currentFilter);

    if (!list.length) {
      alert("No hay ventas para exportar en este filtro.");
      return;
    }

    if (!window.jspdf || !window.jspdf.jsPDF) {
      alert("No se pudo cargar la librería del PDF.");
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const totalGross = list.reduce((sum, order) => sum + getTotal(order), 0);
    const totalCommission = totalGross * COMMISSION;
    const totalNet = totalGross - totalCommission;
    const avgTicket = list.length ? totalGross / list.length : 0;

    let y = 16;

    doc.setFillColor(255, 107, 53);
    doc.roundedRect(10, y, 190, 20, 6, 6, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.text("Reporte de Ventas - Deli", 16, y + 13);

    y += 28;
    doc.setTextColor(17, 24, 39);
    doc.setFontSize(11);
    doc.text(`Filtro aplicado: ${getCurrentFilterLabel()}`, 14, y);
    y += 6;

    if (customDateFrom || customDateTo) {
      doc.text(`Rango: ${customDateFrom || "inicio"} hasta ${customDateTo || "hoy"}`, 14, y);
      y += 6;
    }

    drawPdfCard(doc, 14, y, 42, 22, "Pedidos", String(list.length));
    drawPdfCard(doc, 60, y, 42, 22, "Bruto", formatMoney(totalGross));
    drawPdfCard(doc, 106, y, 42, 22, "Comisión", formatMoney(totalCommission));
    drawPdfCard(doc, 152, y, 42, 22, "Promedio", formatMoney(avgTicket));
    y += 30;

    doc.setFontSize(14);
    doc.setTextColor(17, 24, 39);
    doc.text("Resumen por día", 14, y);
    y += 8;

    const groupedList = groupOrdersByDay(list).sort((a, b) => b.date - a.date);

    groupedList.forEach(day => {
      if (y > 260) {
        doc.addPage();
        y = 20;
      }

      doc.setFillColor(250, 250, 250);
      doc.roundedRect(14, y, 182, 16, 4, 4, "F");
      doc.setFontSize(10);
      doc.setTextColor(17, 24, 39);
      doc.text(formatOnlyDate(day.date), 18, y + 6.5);
      doc.text(`${day.count} pedido(s)`, 85, y + 6.5);
      doc.text(`Neto ${formatMoney(day.net)}`, 125, y + 6.5);
      doc.text(formatMoney(day.total), 170, y + 6.5, { align: "right" });
      y += 20;
    });

    if (y > 230) {
      doc.addPage();
      y = 20;
    }

    doc.setFontSize(14);
    doc.text("Detalle de pedidos", 14, y);
    y += 8;

    list.forEach(order => {
      const total = getTotal(order);
      const commission = total * COMMISSION;
      const net = total - commission;

      if (y > 248) {
        doc.addPage();
        y = 20;
      }

      doc.setFillColor(255, 255, 255);
      doc.roundedRect(14, y, 182, 24, 4, 4, "S");

      doc.setFontSize(10);
      doc.text(`#${order.id || "-"}`, 18, y + 7);
      doc.text(getCustomerName(order), 45, y + 7);
      doc.text(formatDate(order), 18, y + 14);
      doc.text(`Bruto: ${formatMoney(total)}`, 120, y + 7);
      doc.text(`Comisión: ${formatMoney(commission)}`, 120, y + 14);
      doc.text(`Neto: ${formatMoney(net)}`, 120, y + 21);

      y += 28;
    });

    const date = new Date().toISOString().slice(0, 10);
    doc.save(`ventas-restaurante-${date}.pdf`);
  }

  function refreshView() {
    fillSummaryCards();
    renderFilterSummary(currentFilter);
    renderDailyChart(currentFilter);
    renderTable(currentFilter);
    renderDailySummary(currentFilter);
    hideSaleDetail();
  }

  function bindFilters() {
    const buttons = document.querySelectorAll(".sales-filters button");

    buttons.forEach(btn => {
      btn.addEventListener("click", () => {
        buttons.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        currentFilter = btn.dataset.filter || "all";
        refreshView();
      });
    });
  }

  function bindRangeActions() {
    const fromInput = document.getElementById("salesDateFrom");
    const toInput = document.getElementById("salesDateTo");
    const applyBtn = document.getElementById("applyRangeBtn");
    const clearBtn = document.getElementById("clearRangeBtn");

    if (applyBtn) {
      applyBtn.addEventListener("click", () => {
        customDateFrom = fromInput?.value || "";
        customDateTo = toInput?.value || "";
        refreshView();
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        customDateFrom = "";
        customDateTo = "";
        if (fromInput) fromInput.value = "";
        if (toInput) toInput.value = "";
        refreshView();
      });
    }
  }

  function bindActions() {
    const exportBtn = document.getElementById("exportPdfBtn");
    const closeDetailBtn = document.getElementById("closeSaleDetailBtn");

    if (exportBtn) {
      exportBtn.addEventListener("click", exportPdf);
    }

    if (closeDetailBtn) {
      closeDetailBtn.addEventListener("click", hideSaleDetail);
    }
  }

  const restaurant = getRestaurant();
  if (!restaurant) return;

  await loadRestaurantCommission(restaurant.email);
  renderCommissionBadge();

  const restaurantEmail = String(restaurant.email || "").toLowerCase().trim();
  const orders = await getOrdersFromBackend(restaurantEmail);

  deliveredOrders = orders
    .filter(order => sameRestaurant(order, restaurantEmail))
    .filter(isDelivered);

  fillSummaryCards();
  renderFilterSummary(currentFilter);
  renderDailyChart(currentFilter);
  renderTable(currentFilter);
  renderDailySummary(currentFilter);
  bindFilters();
  bindRangeActions();
  bindActions();
});






