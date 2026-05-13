/* ======================================================
   BHUZ / DELI GO - HEADER.JS
   Archivo completo listo para copiar y pegar

   OBJETIVO:
   - Mantener login/sesión actual de auth.js.
   - Hacer funcional menú hamburguesa.
   - Hacer funcional campanita / pedidos.
   - Hacer funcional perfil / login.
   - Mantener backend y PostgreSQL sin cambios.
====================================================== */

document.addEventListener("DOMContentLoaded", () => {
  const userNav = document.getElementById("userNav");

  const backdrop = document.getElementById("bhuzBackdrop");
  const drawer = document.getElementById("bhuzDrawer");
  const notificationsPanel = document.getElementById("notificationsPanel");
  const profilePanel = document.getElementById("profilePanel");
  const profileActionsPanel = document.getElementById("profileActionsPanel");
  const drawerLinks = document.querySelector(".drawer-links");

  const openSideMenu = document.getElementById("openSideMenu");
  const closeSideMenu = document.getElementById("closeSideMenu");
  const openNotifications = document.getElementById("openNotifications");
  const closeNotifications = document.getElementById("closeNotifications");
  const openProfileMenu = document.getElementById("openProfileMenu");
  const closeProfilePanel = document.getElementById("closeProfilePanel");

  const bottomSearchBtn = document.getElementById("bottomSearchBtn");
  const bottomFavoritesBtn = document.getElementById("bottomFavoritesBtn");
  const bottomProfileBtn = document.getElementById("bottomProfileBtn");

  function currentUserSafe() {
    return (typeof getCurrentUser === "function" && getCurrentUser()) || null;
  }

  function closeAllPanels() {
    if (drawer) drawer.classList.remove("open");
    if (notificationsPanel) notificationsPanel.classList.remove("open");
    if (profilePanel) profilePanel.classList.remove("open");
    if (backdrop) backdrop.classList.remove("show");
  }

  function openDrawer() {
    renderSideMenu();
    closeAllPanels();
    if (drawer) drawer.classList.add("open");
    if (backdrop) backdrop.classList.add("show");
  }

  function openPanel(panel) {
    closeAllPanels();
    if (panel) panel.classList.add("open");
    if (backdrop) backdrop.classList.add("show");
  }

  function goToSearch() {
    const searchInput = document.querySelector(".search");
    const searchCard = document.querySelector(".search-card");

    if (searchCard) {
      searchCard.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    setTimeout(() => {
      if (searchInput) searchInput.focus();
    }, 350);
  }

  function showFavoritesMessage() {
    alert("Favoritos estará disponible pronto. Por ahora puedes buscar y pedir desde restaurantes y platos populares.");
  }

  function showComingSoonMessage(label) {
    alert(`${label} estará disponible pronto. Lo vamos a conectar en el siguiente paso con datos reales.`);
  }

  function openLoginModal(role = "customer") {
    closeAllPanels();

    if (typeof showLogin === "function") {
      showLogin(role);
      return;
    }

    const loginScreen = document.getElementById("loginScreen");
    if (loginScreen) loginScreen.style.display = "flex";
  }

  function openRegisterModal() {
    closeAllPanels();

    if (typeof showRegister === "function") {
      showRegister();
      return;
    }

    const registerScreen = document.getElementById("registerScreen");
    if (registerScreen) registerScreen.style.display = "flex";
  }

  function openRestaurantRegisterModal() {
    closeAllPanels();

    if (typeof showRestaurantRegister === "function") {
      showRestaurantRegister();
      return;
    }

    const restaurantRegisterScreen = document.getElementById("restaurantRegisterScreen");
    if (restaurantRegisterScreen) restaurantRegisterScreen.style.display = "flex";
  }

  function logoutSafe(event) {
    if (event) event.preventDefault();

    if (typeof logout === "function") {
      logout();
      return;
    }

    window.location.href = "index.html";
  }

  function bindStaticActions() {
    if (openSideMenu) openSideMenu.addEventListener("click", openDrawer);
    if (closeSideMenu) closeSideMenu.addEventListener("click", closeAllPanels);
    if (backdrop) backdrop.addEventListener("click", closeAllPanels);

    if (openNotifications) {
      openNotifications.addEventListener("click", () => openPanel(notificationsPanel));
    }

    if (closeNotifications) closeNotifications.addEventListener("click", closeAllPanels);

    if (openProfileMenu) {
      openProfileMenu.addEventListener("click", () => openPanel(profilePanel));
    }

    if (closeProfilePanel) closeProfilePanel.addEventListener("click", closeAllPanels);

    if (bottomSearchBtn) {
      bottomSearchBtn.addEventListener("click", (e) => {
        e.preventDefault();
        goToSearch();
      });
    }

    if (bottomFavoritesBtn) {
      bottomFavoritesBtn.addEventListener("click", (e) => {
        e.preventDefault();
        showFavoritesMessage();
      });
    }

    if (bottomProfileBtn) {
      bottomProfileBtn.addEventListener("click", (e) => {
        e.preventDefault();
        openPanel(profilePanel);
      });
    }
  }


  function bindDrawerActionButtons() {
    const drawerFavoritesBtn = document.getElementById("drawerFavoritesBtn");
    const drawerLoginBtn = document.getElementById("drawerLoginBtn");
    const drawerRegisterBtn = document.getElementById("drawerRegisterBtn");
    const drawerRestaurantBtn = document.getElementById("drawerRestaurantBtn");
    const drawerLogoutBtn = document.getElementById("drawerLogoutBtn");
    const drawerAddressBtn = document.getElementById("drawerAddressBtn");
    const drawerPaymentBtn = document.getElementById("drawerPaymentBtn");
    const drawerNotificationsBtn = document.getElementById("drawerNotificationsBtn");
    const drawerSupportBtn = document.getElementById("drawerSupportBtn");
    const drawerProfileBtn = document.getElementById("drawerProfileBtn");

    if (drawerFavoritesBtn) {
      drawerFavoritesBtn.addEventListener("click", (e) => {
        e.preventDefault();
        closeAllPanels();
        showFavoritesMessage();
      });
    }

    if (drawerAddressBtn) {
      drawerAddressBtn.addEventListener("click", (e) => {
        e.preventDefault();
        closeAllPanels();
        showComingSoonMessage("Direcciones y ubicación GPS");
      });
    }

    if (drawerPaymentBtn) {
      drawerPaymentBtn.addEventListener("click", (e) => {
        e.preventDefault();
        closeAllPanels();
        showComingSoonMessage("Métodos de pago");
      });
    }

    if (drawerNotificationsBtn) {
      drawerNotificationsBtn.addEventListener("click", (e) => {
        e.preventDefault();
        openPanel(notificationsPanel);
      });
    }

    if (drawerSupportBtn) {
      drawerSupportBtn.addEventListener("click", (e) => {
        e.preventDefault();
        closeAllPanels();
        showComingSoonMessage("Soporte y ayuda");
      });
    }

    if (drawerProfileBtn) {
      drawerProfileBtn.addEventListener("click", (e) => {
        e.preventDefault();
        openPanel(profilePanel);
      });
    }

    if (drawerLoginBtn) {
      drawerLoginBtn.addEventListener("click", (e) => {
        e.preventDefault();
        openLoginModal("customer");
      });
    }

    if (drawerRegisterBtn) {
      drawerRegisterBtn.addEventListener("click", (e) => {
        e.preventDefault();
        openRegisterModal();
      });
    }

    if (drawerRestaurantBtn) {
      drawerRestaurantBtn.addEventListener("click", (e) => {
        e.preventDefault();
        openRestaurantRegisterModal();
      });
    }

    if (drawerLogoutBtn) {
      drawerLogoutBtn.addEventListener("click", logoutSafe);
    }
  }

  function renderSideMenu() {
    if (!drawerLinks) return;

    const currentUser = currentUserSafe();

    if (currentUser) {
      const isRestaurant = currentUser.role === "restaurant";

      if (isRestaurant) {
        drawerLinks.innerHTML = `
          <a href="index.html">🏠 Inicio</a>
          <a href="panel-restaurant.html">🏪 Mi panel restaurante</a>
          <a href="panel-restaurant.html#orders">🛍️ Pedidos del restaurante</a>
          <a href="#" id="drawerNotificationsBtn">🔔 Notificaciones</a>
          <a href="#" id="drawerSupportBtn">❔ Ayuda / soporte</a>
          <a href="#" id="drawerLogoutBtn">🚪 Cerrar sesión</a>
        `;

        bindDrawerActionButtons();
        return;
      }

      drawerLinks.innerHTML = `
        <a href="index.html">🏠 Inicio</a>
        <a href="mis-pedidos.html">🛍️ Mis pedidos</a>
        <a href="#restaurantList">🍽️ Restaurantes</a>
        <a href="#topDishesSection">🔥 Platos populares</a>
        <a href="#" id="drawerFavoritesBtn">♡ Favoritos</a>
        <a href="#" id="drawerAddressBtn">📍 Direcciones / ubicación GPS</a>
        <a href="#" id="drawerPaymentBtn">💳 Métodos de pago</a>
        <a href="#" id="drawerNotificationsBtn">🔔 Notificaciones</a>
        <a href="#" id="drawerProfileBtn">👤 Mi perfil</a>
        <a href="#" id="drawerSupportBtn">❔ Ayuda / soporte</a>
        <a href="#" id="drawerLogoutBtn">🚪 Cerrar sesión</a>
      `;

      bindDrawerActionButtons();
      return;
    }

    drawerLinks.innerHTML = `
      <a href="index.html">🏠 Inicio</a>
      <a href="#restaurantList">🍽️ Restaurantes</a>
      <a href="#topDishesSection">🔥 Platos populares</a>
      <a href="mis-pedidos.html">🛍️ Mis pedidos</a>
      <a href="#" id="drawerFavoritesBtn">♡ Favoritos</a>
      <a href="#" id="drawerLoginBtn">👤 Iniciar sesión</a>
      <a href="#" id="drawerRegisterBtn">✨ Registrarme</a>
      <a href="#" id="drawerRestaurantBtn">🏪 Registrar restaurante</a>
    `;

    bindDrawerActionButtons();
  }

  function renderProfilePanel() {
    if (!profileActionsPanel) return;

    const currentUser = currentUserSafe();

    if (currentUser) {
      const displayName = currentUser.fullName || currentUser.name || "Usuario";
      const isRestaurant = currentUser.role === "restaurant";

      profileActionsPanel.innerHTML = `
        <div class="profile-mini-card">
          <strong>Hola, ${displayName}</strong>
          <span>${isRestaurant ? "Cuenta restaurante" : "Cuenta cliente"}</span>
        </div>
        <a href="index.html">Inicio</a>
        ${isRestaurant ? '<a href="panel-restaurant.html">Mi panel restaurante</a>' : '<a href="mis-pedidos.html">Mis pedidos</a>'}
        ${!isRestaurant ? '<button type="button" id="profileAddressBtn">Agregar dirección / GPS</button>' : ''}
        ${!isRestaurant ? '<button type="button" id="profilePaymentBtn">Agregar método de pago</button>' : ''}
        <button type="button" id="profileSupportBtn">Ayuda / soporte</button>
        <button type="button" id="profileLogoutBtn">Cerrar sesión</button>
      `;

      const profileLogoutBtn = document.getElementById("profileLogoutBtn");
      const profileAddressBtn = document.getElementById("profileAddressBtn");
      const profilePaymentBtn = document.getElementById("profilePaymentBtn");
      const profileSupportBtn = document.getElementById("profileSupportBtn");

      if (profileLogoutBtn) profileLogoutBtn.addEventListener("click", logoutSafe);
      if (profileAddressBtn) profileAddressBtn.addEventListener("click", () => showComingSoonMessage("Direcciones y ubicación GPS"));
      if (profilePaymentBtn) profilePaymentBtn.addEventListener("click", () => showComingSoonMessage("Métodos de pago"));
      if (profileSupportBtn) profileSupportBtn.addEventListener("click", () => showComingSoonMessage("Soporte y ayuda"));
      return;
    }

    profileActionsPanel.innerHTML = `
      <button type="button" id="profileLoginBtn">Iniciar sesión</button>
      <button type="button" id="profileRegisterBtn">Crear cuenta</button>
      <button type="button" id="profileRestaurantBtn">Registrar restaurante</button>
      <a href="mis-pedidos.html">Ver mis pedidos</a>
    `;

    const profileLoginBtn = document.getElementById("profileLoginBtn");
    const profileRegisterBtn = document.getElementById("profileRegisterBtn");
    const profileRestaurantBtn = document.getElementById("profileRestaurantBtn");

    if (profileLoginBtn) profileLoginBtn.addEventListener("click", () => openLoginModal("customer"));
    if (profileRegisterBtn) profileRegisterBtn.addEventListener("click", openRegisterModal);
    if (profileRestaurantBtn) profileRestaurantBtn.addEventListener("click", openRestaurantRegisterModal);
  }

  function renderHeader() {
    if (!userNav) return;

    const currentUser = currentUserSafe();

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
      if (logoutBtn) logoutBtn.addEventListener("click", logoutSafe);

      renderProfilePanel();
      return;
    }

    userNav.innerHTML = `
      <a href="index.html">Inicio</a>
      <a href="#" id="openLoginCustomer">Iniciar sesión</a>
      <a href="#" id="openRegisterCustomer">Regístrate</a>
      <a href="#" id="openRegisterRestaurant">Registro restaurante</a>
      <a href="#restaurantList">Restaurantes</a>
    `;

    const openLoginCustomer = document.getElementById("openLoginCustomer");
    const openRegisterCustomer = document.getElementById("openRegisterCustomer");
    const openRegisterRestaurant = document.getElementById("openRegisterRestaurant");

    if (openLoginCustomer) {
      openLoginCustomer.addEventListener("click", (e) => {
        e.preventDefault();
        openLoginModal("customer");
      });
    }

    if (openRegisterCustomer) {
      openRegisterCustomer.addEventListener("click", (e) => {
        e.preventDefault();
        openRegisterModal();
      });
    }

    if (openRegisterRestaurant) {
      openRegisterRestaurant.addEventListener("click", (e) => {
        e.preventDefault();
        openRestaurantRegisterModal();
      });
    }

    renderProfilePanel();
  }

  bindStaticActions();
  renderSideMenu();
  renderHeader();

  window.addEventListener("deli:session-ready", () => {
    renderSideMenu();
    renderHeader();
  });
});









