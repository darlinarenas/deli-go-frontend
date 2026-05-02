/* ======================================================
   DELI - app.js
   Inicializa la página principal
====================================================== */

/* ==========================================
   Detectar ciudad del usuario
========================================== */
const cityElement = document.getElementById("city");

if (cityElement) {
  fetch("https://ipapi.co/json/")
    .then((r) => r.json())
    .then((d) => {
      cityElement.textContent = d.city || "Ubicación no disponible";
    })
    .catch(() => {
      cityElement.textContent = "No se pudo detectar ubicación";
    });
}

/* ==========================================
   Conectar buscador
   OJO: usamos la variable searchInput que ya existe
   en restaurants.js, no la volvemos a declarar aquí
========================================== */
if (typeof searchInput !== "undefined" && searchInput) {
  searchInput.oninput = updateRestaurants;
}

/* ==========================================
   Arranque inicial
========================================== */
renderCategories();
updateRestaurants();

if (typeof loadUser === "function") {
  loadUser();
}



/* ==========================================
   RESETEAR DATOS DE PRUEBA
========================================== */
function resetTestData() {

  const confirmReset = confirm("¿Seguro que quieres borrar todos los datos de prueba de DELI?");

  if (!confirmReset) return;

  localStorage.removeItem("deliUsers");
  localStorage.removeItem("deliRestaurantAccounts");
  localStorage.removeItem("deliCurrentUser");
  localStorage.removeItem("user");
  localStorage.removeItem("deliUser");

  localStorage.removeItem("deliRestaurantDishes");
  localStorage.removeItem("deliOrders");
  localStorage.removeItem("deliCustomerOrders");
  localStorage.removeItem("deliPublicRestaurant");

  alert("Datos de prueba eliminados");

  location.reload();
}