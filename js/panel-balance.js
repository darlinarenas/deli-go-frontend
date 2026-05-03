/* =========================================
   DELI FOODS
   panel-balance.js

   MÓDULO INDEPENDIENTE DE BALANCES
   - Ventas de hoy
   - Ventas de esta semana
   - Ventas de este mes
   - Neto a pagar al restaurante

   IMPORTANTE:
   - NO modifica panel-restaurante.js
   - Lee pedidos desde orders.js
   - Solo cuenta pedidos ENTREGADOS
   - Por ahora solo muestra la comisión del restaurante
   - La comisión del repartidor queda interna para futuro
========================================= */

document.addEventListener("DOMContentLoaded", () => {
  const RESTAURANTS_API_URL = "https://deligo-backend-i554.onrender.com";

  /* =========================================
     CONFIGURACIÓN BASE DE COMISIONES
  ========================================= */
  function getCommissionConfig() {
    return {
      restaurantCommission: 15,
      courierCommission: 10
    };
  }

  /*
    COMISIÓN REAL DEL RESTAURANTE DESDE BACKEND

    El panel administrativo guarda la comisión individual en restaurants.json.
    Por eso el panel del restaurante debe leer su propio restaurante desde:
    GET http://localhost:3001/restaurants

    Si no se puede conectar al backend, se mantiene fallback 15%
    para no romper la vista del balance.
  */
  async function getRestaurantCommissionPercent(restaurantEmail) {
    const fallbackConfig = getCommissionConfig();
    const fallbackCommission = Number(fallbackConfig.restaurantCommission || 15);
    const normalizedEmail = normalizeText(restaurantEmail);

    if (!normalizedEmail) {
      return fallbackCommission;
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
        return normalizeText(item?.email) === normalizedEmail;
      });

      const backendCommission = Number(
        restaurant?.commissionPercent ?? restaurant?.commission
      );

      if (!Number.isNaN(backendCommission) && backendCommission >= 0) {
        return backendCommission;
      }
    } catch (error) {
      console.warn("No se pudo leer la comisión del restaurante desde backend:", error);
    }

    return fallbackCommission;
  }

  /* =========================================
     RESTAURANTE ACTUAL
  ========================================= */
  function getCurrentRestaurant() {
    const fromSaved =
      typeof getSavedRestaurant === "function" ? getSavedRestaurant() : null;

    const fromCurrent =
      typeof getCurrentUser === "function" ? getCurrentUser() : null;

    const restaurant = fromSaved || fromCurrent || null;

    if (!restaurant || restaurant.role !== "restaurant") {
      return null;
    }

    return restaurant;
  }

  /* =========================================
     HELPERS GENERALES
  ========================================= */
  function normalizeText(value) {
    return String(value || "").trim().toLowerCase();
  }

  function formatMoney(value) {
    const amount = Number(value || 0);

    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function safeJsonParse(value, fallback = null) {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  function normalizeStatus(status) {
    if (typeof normalizeOrderStatus === "function") {
      return normalizeOrderStatus(status);
    }

    const raw = normalizeText(status)
      .replaceAll("-", "_")
      .replaceAll(" ", "_");

    switch (raw) {
      case "pending":
        return "pendiente";
      case "accepted":
        return "aceptado";
      case "preparing":
        return "preparando";
      case "ready":
        return "listo";
      case "on_the_way":
      case "en_camino":
        return "en_camino";
      case "delivered":
      case "completed":
      case "finished":
      case "finalizado":
      case "entregado":
        return "entregado";
      default:
        return raw;
    }
  }

  function isDelivered(order) {
    return normalizeStatus(order?.status) === "entregado";
  }

  function getOrderRestaurantEmail(order) {
    return normalizeText(
      order?.restaurantEmail ||
      order?.restaurant?.email ||
      ""
    );
  }

  function getOrderTotal(order) {
    const rawTotal = Number(order?.total || 0);

    if (rawTotal > 0) return rawTotal;

    if (Array.isArray(order?.items)) {
      return order.items.reduce((sum, item) => {
        const subtotal = Number(item?.subtotal || 0);

        if (subtotal > 0) return sum + subtotal;

        const qty = Number(item?.qty || 0);
        const price = Number(item?.price || 0);

        return sum + (qty * price);
      }, 0);
    }

    return 0;
  }

  /* =========================================
     PARSEO DE FECHAS
     SOPORTA:
     - createdAt ISO del backend
     - date tipo 19-04-2026
     - time tipo 08:41 p. m. / 08:41 pm / 20:41
  ========================================= */
  function parseSpanishDateTime(dateValue, timeValue) {
    const dateText = String(dateValue || "").trim();
    const timeText = String(timeValue || "").trim().toLowerCase();

    if (!dateText) return null;

    let day = 0;
    let month = 0;
    let year = 0;

    if (dateText.includes("-")) {
      const parts = dateText.split("-").map((part) => part.trim());

      if (parts.length === 3) {
        day = Number(parts[0]);
        month = Number(parts[1]);
        year = Number(parts[2]);
      }
    } else if (dateText.includes("/")) {
      const parts = dateText.split("/").map((part) => part.trim());

      if (parts.length === 3) {
        day = Number(parts[0]);
        month = Number(parts[1]);
        year = Number(parts[2]);
      }
    }

    if (!day || !month || !year) {
      return null;
    }

    let hours = 0;
    let minutes = 0;

    if (timeText) {
      const normalizedTime = timeText
        .replaceAll("a. m.", "am")
        .replaceAll("p. m.", "pm")
        .replaceAll("a.m.", "am")
        .replaceAll("p.m.", "pm")
        .replaceAll(" a m", "am")
        .replaceAll(" p m", "pm")
        .replaceAll(".", "")
        .trim();

      const match = normalizedTime.match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i);

      if (match) {
        hours = Number(match[1]);
        minutes = Number(match[2]);
        const meridiem = (match[3] || "").toLowerCase();

        if (meridiem === "pm" && hours < 12) {
          hours += 12;
        }

        if (meridiem === "am" && hours === 12) {
          hours = 0;
        }
      }
    }

    const parsed = new Date(year, month - 1, day, hours, minutes, 0, 0);

    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    return parsed;
  }

  function getOrderDate(order) {
    if (order?.createdAt) {
      const createdAtDate = new Date(order.createdAt);

      if (!Number.isNaN(createdAtDate.getTime())) {
        return createdAtDate;
      }
    }

    const parsedFromDateTime = parseSpanishDateTime(order?.date, order?.time);

    if (parsedFromDateTime) {
      return parsedFromDateTime;
    }

    return null;
  }

  function getStartOfToday(now) {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  }

  function getStartOfWeek(now) {
    const current = new Date(now);
    const day = current.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;

    current.setDate(current.getDate() + diffToMonday);
    current.setHours(0, 0, 0, 0);

    return current;
  }

  function getStartOfMonth(now) {
    return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  }

  /* =========================================
     LECTURA DE PEDIDOS
  ========================================= */
  async function getRestaurantOrders(restaurantEmail) {
    const normalizedRestaurantEmail = normalizeText(restaurantEmail);

    if (typeof getOrdersByRestaurant === "function") {
      try {
        const orders = await getOrdersByRestaurant(normalizedRestaurantEmail);

        if (Array.isArray(orders) && orders.length) {
          return orders.filter((order) => {
            const email = getOrderRestaurantEmail(order);
            return !email || email === normalizedRestaurantEmail;
          });
        }
      } catch (error) {
        console.warn("No se pudieron leer pedidos desde orders.js:", error);
      }
    }

    return [];
  }

  /* =========================================
     CÁLCULO PRINCIPAL
  ========================================= */
  function calculateBalanceData(orders, restaurantCommissionPercent) {
    const now = new Date();
    const startToday = getStartOfToday(now);
    const startWeek = getStartOfWeek(now);
    const startMonth = getStartOfMonth(now);

    const deliveredOrders = orders.filter(isDelivered);

    let salesToday = 0;
    let salesWeek = 0;
    let salesMonth = 0;
    let grossTotal = 0;

    deliveredOrders.forEach((order) => {
      const total = getOrderTotal(order);
      const orderDate = getOrderDate(order);

      grossTotal += total;

      if (orderDate && orderDate >= startToday) {
        salesToday += total;
      }

      if (orderDate && orderDate >= startWeek) {
        salesWeek += total;
      }

      if (orderDate && orderDate >= startMonth) {
        salesMonth += total;
      }
    });

    const safeRestaurantCommissionPercent = Number(
      restaurantCommissionPercent || 0
    );

    const restaurantCommissionAmount =
      grossTotal * (safeRestaurantCommissionPercent / 100);

    const restaurantNetAmount = grossTotal - restaurantCommissionAmount;

    return {
      salesToday,
      salesWeek,
      salesMonth,
      grossTotal,
      deliveredCount: deliveredOrders.length,
      restaurantCommissionPercent: safeRestaurantCommissionPercent,
      restaurantCommissionAmount,
      restaurantNetAmount
    };
  }

  /* =========================================
     RENDER
  ========================================= */
  function renderBalanceCards(balance) {
    setText("salesTodayAmount", formatMoney(balance.salesToday));
    setText("salesWeekAmount", formatMoney(balance.salesWeek));
    setText("salesMonthAmount", formatMoney(balance.salesMonth));
    setText("restaurantNetAmount", formatMoney(balance.restaurantNetAmount));

    setText(
      "restaurantCommissionInfo",
      `Comisión Deli ${balance.restaurantCommissionPercent}% · ${formatMoney(balance.restaurantCommissionAmount)}`
    );

    setText(
      "restaurantBalanceSummary",
      `Pedidos entregados: ${balance.deliveredCount} · Ventas brutas: ${formatMoney(balance.grossTotal)}`
    );
  }

  async function refreshRestaurantBalances() {
    const restaurant = getCurrentRestaurant();

    if (!restaurant) return;

    const restaurantEmail = normalizeText(restaurant.email || "");

    if (!restaurantEmail) return;

    const orders = await getRestaurantOrders(restaurantEmail);
    const restaurantCommissionPercent =
      await getRestaurantCommissionPercent(restaurantEmail);

    const balance = calculateBalanceData(orders, restaurantCommissionPercent);

    renderBalanceCards(balance);
  }

  /* =========================================
     INICIO
  ========================================= */
  refreshRestaurantBalances();

  /* Refresco automático suave */
  setInterval(refreshRestaurantBalances, 10000);
});




