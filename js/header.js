/* ======================================================
   DELI FOODS
   HEADER.JS

   Renderiza el menú superior usando únicamente la sesión
   validada por backend en auth.js.
====================================================== */

document.addEventListener("DOMContentLoaded", () => {
  const userNav = document.getElementById("userNav");
  if (!userNav) return;

  function renderHeader() {
    const currentUser =
      (typeof getCurrentUser === "function" && getCurrentUser()) || null;

    if (currentUser) {
      if (currentUser.role === "restaurant") {
        userNav.innerHTML = `
          <a href="index.html">Inicio</a>
          <span class="user-greeting">Hola, ${currentUser.name || "Restaurante"}</span>
          <a href="panel-restaurant.html">Mi panel</a>
          <a href="#" id="logoutBtn">Cerrar sesión</a>
        `;
      } else {
        userNav.innerHTML = `
          <a href="index.html">Inicio</a>
          <a href="mis-pedidos.html">Mis pedidos</a>
          <span class="user-greeting">Hola, ${currentUser.fullName || currentUser.name || "Usuario"}</span>
          <a href="#" id="logoutBtn">Cerrar sesión</a>
        `;
      }

      const logoutBtn = document.getElementById("logoutBtn");

      if (logoutBtn) {
        logoutBtn.addEventListener("click", (e) => {
          e.preventDefault();

          if (typeof logout === "function") {
            logout();
            return;
          }

          window.location.href = "index.html";
        });
      }

      return;
    }

    userNav.innerHTML = `
      <a href="index.html">Inicio</a>
      <a href="#" id="openLoginCustomer">Iniciar sesión</a>
      <a href="#" id="openRegisterCustomer">Regístrate</a>
      <a href="#" id="openRegisterRestaurant">Registro restaurante</a>
      <a href="#">Quiénes somos</a>
    `;

    const openLoginCustomer = document.getElementById("openLoginCustomer");
    const openRegisterCustomer = document.getElementById("openRegisterCustomer");
    const openRegisterRestaurant = document.getElementById("openRegisterRestaurant");

    if (openRegisterCustomer) {
      openRegisterCustomer.addEventListener("click", (e) => {
        e.preventDefault();

        if (typeof showRegister === "function") {
          showRegister();
          return;
        }

        const registerScreen = document.getElementById("registerScreen");
        if (registerScreen) {
          registerScreen.style.display = "flex";
        }
      });
    }

    if (openLoginCustomer) {
      openLoginCustomer.addEventListener("click", (e) => {
        e.preventDefault();

        if (typeof showLogin === "function") {
          showLogin("customer");
          return;
        }

        const loginScreen = document.getElementById("loginScreen");
        if (loginScreen) {
          loginScreen.style.display = "flex";
          return;
        }

        alert("Aún no has creado la pantalla de iniciar sesión en esta página.");
      });
    }

    if (openRegisterRestaurant) {
      openRegisterRestaurant.addEventListener("click", (e) => {
        e.preventDefault();

        if (typeof showRestaurantRegister === "function") {
          showRestaurantRegister();
          return;
        }

        const restaurantRegisterScreen = document.getElementById("restaurantRegisterScreen");
        if (restaurantRegisterScreen) {
          restaurantRegisterScreen.style.display = "flex";
        }
      });
    }
  }

  renderHeader();
  window.addEventListener("deli:session-ready", renderHeader);
});
