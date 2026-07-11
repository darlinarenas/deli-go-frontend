/* ======================================================
   BHUZ - CLIENTE API COMPATIBLE
   Depende de js/config.js.

   IMPORTANTE:
   Este archivo NO debe reemplazar las funciones globales
   de autenticación creadas por auth.js (loginUser,
   registerUser, etc.).
====================================================== */
(function iniciarClienteApi(global) {
  "use strict";

  const API_URL =
    global.DELI_API_URL ||
    global.BHUZ_API_URL ||
    global.API_BASE_URL ||
    "https://deligo-backend-i554.onrender.com";

  global.DELI_DB = global.DELI_DB || {
    restaurants: [],
    user: null,
    orders: []
  };

  async function apiRequest(endpoint, method = "GET", body = null) {
    const config = {
      method,
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      }
    };

    if (body !== null && body !== undefined) {
      config.body = JSON.stringify(body);
    }

    const response = await fetch(`${API_URL}${endpoint}`, config);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || `Error HTTP ${response.status}`);
    }

    return data;
  }

  async function fetchRestaurants() {
    const data = await apiRequest("/restaurants");
    global.DELI_DB.restaurants = Array.isArray(data)
      ? data
      : data.restaurants || [];

    return global.DELI_DB.restaurants;
  }

  function fetchRestaurantById(id) {
    return apiRequest(`/restaurants/${encodeURIComponent(id)}`);
  }

  /*
    Funciones auxiliares con nombres propios para evitar
    sobrescribir las funciones de interfaz declaradas en auth.js.
  */
  function apiLoginUser(email, password, role = "customer") {
    return apiRequest("/login", "POST", { email, password, role });
  }

  function apiRegisterUser(userData) {
    return apiRequest("/register", "POST", userData);
  }

  function apiCreateOrder(orderData) {
    return apiRequest("/orders", "POST", orderData);
  }

  global.apiRequest = global.apiRequest || apiRequest;
  global.fetchRestaurants = global.fetchRestaurants || fetchRestaurants;
  global.fetchRestaurantById = global.fetchRestaurantById || fetchRestaurantById;

  global.BHUZ_API = {
    ...(global.BHUZ_API || {}),
    request: apiRequest,
    fetchRestaurants,
    fetchRestaurantById,
    loginUser: apiLoginUser,
    registerUser: apiRegisterUser,
    createOrder: apiCreateOrder
  };

  /*
    Compatibilidad: solo se crean estos alias si ningún otro
    módulo los declaró previamente. Así auth.js conserva el
    control del botón "Entrar".
  */
  if (typeof global.loginUser !== "function") {
    global.loginUser = apiLoginUser;
  }

  if (typeof global.registerUser !== "function") {
    global.registerUser = apiRegisterUser;
  }

  if (typeof global.createOrder !== "function") {
    global.createOrder = apiCreateOrder;
  }
})(window);
