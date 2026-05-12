// ARCHIVO CORREGIDO: presupuesto conectado a backend / datos reales del index
(() => {
  const resultado = document.getElementById("resultado");

  /*
    IMPORTANTE:
    Este archivo ya NO usa almacenamiento del navegador como fuente de platos/restaurantes.
    Ahora toma los platos reales desde:
    1) window.allDishes / window.restaurants, cargados por restaurants.js
    2) Backend Render como respaldo seguro si todavía no terminaron de cargar
  */
  const API_URL = window.DELI_API_URL || "https://deligo-backend-i554.onrender.com";
  const RESTAURANTS_API_URL = `${API_URL}/restaurants`;

  function budgetNormalize(value) {
    return String(value || "").trim().toLowerCase();
  }

  function budgetEscapeText(text) {
    return String(text || "").replace(/'/g, "\\'");
  }

  function formatBudgetPrice(value) {
    const number = Number(value || 0);

    return new Intl.NumberFormat("es-VE", {
      maximumFractionDigits: 0
    }).format(number);
  }

  function isApprovedRestaurant(restaurant) {
    const status = budgetNormalize(restaurant?.status || "");

    /*
      Si un restaurante viejo no tiene status, lo dejamos pasar para no romper datos antiguos.
      Si tiene status, solo recomendamos aprobados/activos.
    */
    if (!status) return true;

    return status === "approved" || status === "active";
  }

  function isOpenRestaurant(restaurant) {
    const openValue = restaurant?.open;
    const isOpenValue = restaurant?.isOpen;
    const storeStatus = budgetNormalize(
      restaurant?.storeStatus || restaurant?.availability || ""
    );

    if (openValue === false || isOpenValue === false) return false;

    if (["closed", "cerrado", "inactive", "inactivo", "disabled", "bloqueado"].includes(storeStatus)) {
      return false;
    }

    return true;
  }

  function normalizeBudgetDish(dish, restaurant = {}) {
    const precio = Number(dish?.price || 0);

    if (!precio || precio <= 0) return null;
    if (dish?.available === false) return null;

    const restaurantEmail =
      dish?.restaurantEmail ||
      restaurant?.email ||
      "";

    if (!restaurantEmail) return null;

    return {
      dishId: String(dish?.id || "").trim(),
      nombre: String(dish?.name || "Plato").trim(),
      precio,
      rest: String(
        dish?.restaurantName ||
        restaurant?.name ||
        "Restaurante"
      ).trim(),
      restaurantEmail: String(restaurantEmail).trim().toLowerCase(),
      time: String(dish?.prepTime || restaurant?.time || "20-40 min").trim(),
      categoria: String(dish?.category || restaurant?.category || "General").trim(),
      emoji: String(dish?.emoji || "🍽️").trim()
    };
  }

  function getBudgetOptionsFromWindow() {
    /*
      Caso principal:
      restaurants.js ya cargó los restaurantes y platos reales del backend.
    */
    const options = [];

    const restaurants = Array.isArray(window.restaurants)
      ? window.restaurants
      : [];

    restaurants.forEach((restaurant) => {
      if (!isApprovedRestaurant(restaurant)) return;
      if (!isOpenRestaurant(restaurant)) return;

      const dishes = Array.isArray(restaurant.dishes)
        ? restaurant.dishes
        : [];

      dishes.forEach((dish) => {
        const option = normalizeBudgetDish(dish, restaurant);
        if (option) options.push(option);
      });
    });

    /*
      Respaldo:
      algunos puntos del index también exponen window.allDishes.
    */
    const allDishes = Array.isArray(window.allDishes)
      ? window.allDishes
      : [];

    allDishes.forEach((dish) => {
      const option = normalizeBudgetDish(dish, {
        email: dish.restaurantEmail,
        name: dish.restaurantName,
        time: dish.time
      });

      if (!option) return;

      const exists = options.some((item) => {
        return (
          budgetNormalize(item.restaurantEmail) === budgetNormalize(option.restaurantEmail) &&
          String(item.dishId || "") === String(option.dishId || "") &&
          budgetNormalize(item.nombre) === budgetNormalize(option.nombre)
        );
      });

      if (!exists) {
        options.push(option);
      }
    });

    return options;
  }

  async function fetchRestaurantsFromBackendForBudget() {
    const response = await fetch(`${RESTAURANTS_API_URL}?t=${Date.now()}`, {
      method: "GET",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(`Error HTTP ${response.status}`);
    }

    const data = await response.json();

    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.restaurants)) return data.restaurants;

    return [];
  }

  async function fetchDishesFromBackendForBudget(email) {
    const normalizedEmail = String(email || "").trim().toLowerCase();

    if (!normalizedEmail) return [];

    try {
      const response = await fetch(
        `${API_URL}/restaurants/${encodeURIComponent(normalizedEmail)}/dishes?t=${Date.now()}`,
        {
          method: "GET",
          cache: "no-store",
          headers: {
            "Content-Type": "application/json"
          }
        }
      );

      if (!response.ok) return [];

      const data = await response.json();

      if (Array.isArray(data)) return data;
      if (data && Array.isArray(data.dishes)) return data.dishes;

      return [];
    } catch (error) {
      console.warn("No se pudieron cargar platos para presupuesto:", normalizedEmail, error);
      return [];
    }
  }

  async function getBudgetOptionsFromBackend() {
    const restaurants = await fetchRestaurantsFromBackendForBudget();
    const approvedOpenRestaurants = restaurants.filter((restaurant) => {
      return isApprovedRestaurant(restaurant) && isOpenRestaurant(restaurant);
    });

    const results = await Promise.all(
      approvedOpenRestaurants.map(async (restaurant) => {
        const dishes = await fetchDishesFromBackendForBudget(restaurant.email);

        return dishes
          .map((dish) => normalizeBudgetDish(dish, restaurant))
          .filter(Boolean);
      })
    );

    return results.flat();
  }

  async function getAllBudgetOptions() {
    /*
      Primero intentamos con los datos ya cargados por restaurants.js.
      Si todavía no están listos o vienen vacíos, consultamos backend directamente.
    */
    const windowOptions = getBudgetOptionsFromWindow();

    if (windowOptions.length) {
      return windowOptions;
    }

    return await getBudgetOptionsFromBackend();
  }

  function pedir(dishId, restaurantEmail) {
    const normalizedRestaurantEmail = String(restaurantEmail || "").trim();
    const normalizedDishId = String(dishId || "").trim();

    if (!normalizedRestaurantEmail) {
      alert("No se pudo identificar el restaurante.");
      return;
    }

    const restaurantParam = encodeURIComponent(normalizedRestaurantEmail);
    const dishParam = encodeURIComponent(normalizedDishId);

    if (normalizedDishId) {
      window.location.href =
        `restaurant.html?restaurant=${restaurantParam}&addDish=${dishParam}&openCart=1`;
      return;
    }

    window.location.href = `restaurant.html?restaurant=${restaurantParam}`;
  }

  async function generarRecomendacion() {
    const budgetInput = document.getElementById("budget");
    const presupuesto = Number(budgetInput ? budgetInput.value : 0);

    if (!resultado) {
      alert("No se encontró el contenedor del resultado.");
      return;
    }

    if (!presupuesto || presupuesto <= 0) {
      resultado.innerHTML = "⚠️ Ingrese un presupuesto válido";
      return;
    }

    resultado.innerHTML = "⏳ Buscando opciones disponibles...";

    try {
      const allOptions = await getAllBudgetOptions();

      const opciones = allOptions.filter((item) => {
        return Number(item.precio) <= presupuesto && item.restaurantEmail;
      });

      if (opciones.length === 0) {
        resultado.innerHTML = "❌ Lo sentimos, aumenta tu presupuesto un poco más.";
        return;
      }

      opciones.sort((a, b) => Number(b.precio) - Number(a.precio));

      const mejor = opciones[0];
      const alternativa = opciones[1] || opciones[0];
      const economica = opciones[opciones.length - 1];

      resultado.innerHTML = `
        <div class="result-card">
          <h3>🥇 Mejor opción</h3>
          ${mejor.emoji} ${mejor.nombre}<br>
          💰 $${formatBudgetPrice(mejor.precio)}<br>
          📍 ${mejor.rest}<br>
          ⏱ ${mejor.time}
          <button onclick="pedir('${budgetEscapeText(mejor.dishId)}','${budgetEscapeText(mejor.restaurantEmail)}')">
            Pedir
          </button>
        </div>

        <div class="result-card">
          <h3>🔄 Alternativa</h3>
          ${alternativa.emoji} ${alternativa.nombre}<br>
          💰 $${formatBudgetPrice(alternativa.precio)}<br>
          📍 ${alternativa.rest}<br>
          ⏱ ${alternativa.time}
          <button onclick="pedir('${budgetEscapeText(alternativa.dishId)}','${budgetEscapeText(alternativa.restaurantEmail)}')">
            Pedir
          </button>
        </div>

        <div class="result-card">
          <h3>💸 Económica</h3>
          ${economica.emoji} ${economica.nombre}<br>
          💰 $${formatBudgetPrice(economica.precio)}<br>
          📍 ${economica.rest}<br>
          ⏱ ${economica.time}
          <button onclick="pedir('${budgetEscapeText(economica.dishId)}','${budgetEscapeText(economica.restaurantEmail)}')">
            Pedir
          </button>
        </div>
      `;
    } catch (error) {
      console.error("Error generando recomendación por presupuesto:", error);
      resultado.innerHTML = "❌ No se pudieron cargar opciones. Intenta de nuevo.";
    }
  }

  window.generarRecomendacion = generarRecomendacion;
  window.pedir = pedir;
})();





