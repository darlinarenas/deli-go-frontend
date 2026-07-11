/* ======================================================
   BHUZ - CLIENTE API COMPATIBLE
   Depende de js/config.js. No contiene una URL duplicada.
====================================================== */
(function iniciarClienteApi(global) {
  "use strict";

  const API_URL = global.DELI_API_URL || "https://deligo-backend-i554.onrender.com";

  global.DELI_DB = global.DELI_DB || { restaurants: [], user: null, orders: [] };

  async function apiRequest(endpoint, method = "GET", body = null) {
    const config = {
      method,
      credentials: "include",
      headers: { "Content-Type": "application/json" }
    };
    if (body !== null && body !== undefined) config.body = JSON.stringify(body);

    const response = await fetch(`${API_URL}${endpoint}`, config);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || `Error HTTP ${response.status}`);
    return data;
  }

  global.apiRequest = apiRequest;
  global.fetchRestaurants = async function fetchRestaurants() {
    const data = await apiRequest("/restaurants");
    global.DELI_DB.restaurants = Array.isArray(data) ? data : (data.restaurants || []);
    return global.DELI_DB.restaurants;
  };
  global.fetchRestaurantById = (id) => apiRequest(`/restaurants/${encodeURIComponent(id)}`);
  global.loginUser = (email, password) => apiRequest("/login", "POST", { email, password });
  global.registerUser = (userData) => apiRequest("/register", "POST", userData);
  global.createOrder = (orderData) => apiRequest("/orders", "POST", orderData);
})(window);
