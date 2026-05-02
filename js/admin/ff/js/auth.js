const registerScreen = document.getElementById("registerScreen");
const loginScreen = document.getElementById("loginScreen");
const restaurantRegisterScreen = document.getElementById("restaurantRegisterScreen");

/* =========================
   REGISTRO CLIENTE
========================= */
const fullNameInput = document.getElementById("fullName");
const addressInput = document.getElementById("address");
const phoneInput = document.getElementById("phone");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const confirmPasswordInput = document.getElementById("confirmPassword");
const messageEl = document.getElementById("message");

/* =========================
   LOGIN
========================= */
const loginRoleInput = document.getElementById("loginRole");
const loginEmailInput = document.getElementById("loginEmail");
const loginPasswordInput = document.getElementById("loginPassword");
const loginMessageEl = document.getElementById("loginMessage");

/* =========================
   REGISTRO RESTAURANTE
========================= */
const restaurantNameInput = document.getElementById("restaurantName");
const restaurantAddressInput = document.getElementById("restaurantAddress");
const restaurantPhoneInput = document.getElementById("restaurantPhone");
const restaurantEmailInput = document.getElementById("restaurantEmail");
const restaurantPasswordInput = document.getElementById("restaurantPassword");
const restaurantConfirmPasswordInput = document.getElementById("restaurantConfirmPassword");
const restaurantMessageEl = document.getElementById("restaurantMessage");

/* =========================
   CLAVES LOCALSTORAGE
========================= */
const USERS_KEY = "deliUsers";
const RESTAURANTS_AUTH_KEY = "deliRestaurantAccounts";
const CURRENT_USER_KEY = "deliCurrentUser";

/* =========================
   HELPERS
========================= */
function safeParse(value, fallback = null) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function getUsers() {
  return safeParse(localStorage.getItem(USERS_KEY), []) || [];
}

function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function getRestaurantAccounts() {
  return safeParse(localStorage.getItem(RESTAURANTS_AUTH_KEY), []) || [];
}

function saveRestaurantAccounts(accounts) {
  localStorage.setItem(RESTAURANTS_AUTH_KEY, JSON.stringify(accounts));
}

function getCurrentUser() {
  return safeParse(localStorage.getItem(CURRENT_USER_KEY), null);
}

function saveCurrentUser(user) {
  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
}

function clearCurrentUser() {
  localStorage.removeItem(CURRENT_USER_KEY);
}

function normalizeEmail(email) {
  return (email || "").trim().toLowerCase();
}

function getPageName() {
  const path = window.location.pathname.split("/").pop();
  return path || "index.html";
}

function isRestaurantPanelPage() {
  return getPageName() === "panel-restaurant.html";
}

function migrateLegacyUserIfNeeded() {
  const legacyUser =
    safeParse(localStorage.getItem("user"), null) ||
    safeParse(localStorage.getItem("deliUser"), null);

  if (!legacyUser || !legacyUser.email) return;

  const users = getUsers();
  const email = normalizeEmail(legacyUser.email);

  const exists = users.some((u) => normalizeEmail(u.email) === email);

  if (!exists) {
    users.push({
      id: Date.now(),
      fullName: legacyUser.fullName || "",
      address: legacyUser.address || "",
      phone: legacyUser.phone || "",
      email: legacyUser.email || "",
      password: "",
      role: "customer"
    });
    saveUsers(users);
  }
}

/* =========================
   MOSTRAR / CERRAR MODALES
========================= */
function showRegister() {
  if (registerScreen) registerScreen.style.display = "flex";
}

function closeRegister() {
  if (registerScreen) registerScreen.style.display = "none";
}

function showLogin(role = "customer") {
  if (loginScreen) {
    loginScreen.style.display = "flex";
  }

  if (loginRoleInput) {
    loginRoleInput.value = role;
  }

  if (loginMessageEl) {
    loginMessageEl.textContent = "";
  }
}

function closeLogin() {
  if (loginScreen) loginScreen.style.display = "none";
}

function showRestaurantRegister() {
  if (restaurantRegisterScreen) {
    restaurantRegisterScreen.style.display = "flex";
  }
}

function closeRestaurantRegister() {
  if (restaurantRegisterScreen) {
    restaurantRegisterScreen.style.display = "none";
  }
}

/* =========================
   LIMPIAR FORMULARIOS
========================= */
function clearRegisterForm() {
  if (fullNameInput) fullNameInput.value = "";
  if (addressInput) addressInput.value = "";
  if (phoneInput) phoneInput.value = "";
  if (emailInput) emailInput.value = "";
  if (passwordInput) passwordInput.value = "";
  if (confirmPasswordInput) confirmPasswordInput.value = "";
  if (messageEl) messageEl.textContent = "";
}

function clearLoginForm() {
  if (loginEmailInput) loginEmailInput.value = "";
  if (loginPasswordInput) loginPasswordInput.value = "";
  if (loginMessageEl) loginMessageEl.textContent = "";
}

function clearRestaurantRegisterForm() {
  if (restaurantNameInput) restaurantNameInput.value = "";
  if (restaurantAddressInput) restaurantAddressInput.value = "";
  if (restaurantPhoneInput) restaurantPhoneInput.value = "";
  if (restaurantEmailInput) restaurantEmailInput.value = "";
  if (restaurantPasswordInput) restaurantPasswordInput.value = "";
  if (restaurantConfirmPasswordInput) restaurantConfirmPasswordInput.value = "";
  if (restaurantMessageEl) restaurantMessageEl.textContent = "";
}

/* =========================
   REGISTRO CLIENTE
========================= */
function registerUser() {
  const fullName = fullNameInput ? fullNameInput.value.trim() : "";
  const address = addressInput ? addressInput.value.trim() : "";
  const phone = phoneInput ? phoneInput.value.trim() : "";
  const email = emailInput ? emailInput.value.trim() : "";
  const password = passwordInput ? passwordInput.value : "";
  const confirm = confirmPasswordInput ? confirmPasswordInput.value : "";

  if (!fullName || !address || !phone || !email || !password || !confirm) {
    if (messageEl) {
      messageEl.textContent = "Completa todos los campos";
    } else {
      alert("Completa todos los campos");
    }
    return;
  }

  if (password !== confirm) {
    if (messageEl) {
      messageEl.textContent = "Las contraseñas no coinciden";
    } else {
      alert("Las contraseñas no coinciden");
    }
    return;
  }

  const users = getUsers();
  const normalizedEmail = normalizeEmail(email);

  const emailExistsInUsers = users.some(
    (user) => normalizeEmail(user.email) === normalizedEmail
  );
  const emailExistsInRestaurants = getRestaurantAccounts().some(
    (restaurant) => normalizeEmail(restaurant.email) === normalizedEmail
  );

  if (emailExistsInUsers || emailExistsInRestaurants) {
    if (messageEl) {
      messageEl.textContent = "Ese correo ya está registrado";
    } else {
      alert("Ese correo ya está registrado");
    }
    return;
  }

  const userData = {
    id: Date.now(),
    fullName,
    address,
    phone,
    email,
    password,
    role: "customer"
  };

  users.push(userData);
  saveUsers(users);
  saveCurrentUser(userData);

  /* Compatibilidad con tu lógica anterior */
  localStorage.setItem("user", JSON.stringify(userData));
  localStorage.setItem("deliUser", JSON.stringify(userData));

  if (messageEl) {
    messageEl.textContent = "Cuenta creada con éxito";
  }

  setTimeout(() => {
    closeRegister();
    clearRegisterForm();
    window.location.reload();
  }, 200);
}

/* =========================
   REGISTRO RESTAURANTE
========================= */
function registerRestaurant() {
  const name = restaurantNameInput ? restaurantNameInput.value.trim() : "";
  const address = restaurantAddressInput ? restaurantAddressInput.value.trim() : "";
  const phone = restaurantPhoneInput ? restaurantPhoneInput.value.trim() : "";
  const email = restaurantEmailInput ? restaurantEmailInput.value.trim() : "";
  const password = restaurantPasswordInput ? restaurantPasswordInput.value : "";
  const confirm = restaurantConfirmPasswordInput
    ? restaurantConfirmPasswordInput.value
    : "";

  if (!name || !address || !phone || !email || !password || !confirm) {
    if (restaurantMessageEl) {
      restaurantMessageEl.textContent = "Completa todos los campos";
    } else {
      alert("Completa todos los campos");
    }
    return;
  }

  if (password !== confirm) {
    if (restaurantMessageEl) {
      restaurantMessageEl.textContent = "Las contraseñas no coinciden";
    } else {
      alert("Las contraseñas no coinciden");
    }
    return;
  }

  const normalizedEmail = normalizeEmail(email);
  const users = getUsers();
  const accounts = getRestaurantAccounts();

  const emailExistsInUsers = users.some(
    (user) => normalizeEmail(user.email) === normalizedEmail
  );
  const emailExistsInRestaurants = accounts.some(
    (account) => normalizeEmail(account.email) === normalizedEmail
  );

  if (emailExistsInUsers || emailExistsInRestaurants) {
    if (restaurantMessageEl) {
      restaurantMessageEl.textContent = "Ese correo ya está registrado";
    } else {
      alert("Ese correo ya está registrado");
    }
    return;
  }

  const restaurantData = {
    id: Date.now(),
    name,
    address,
    phone,
    email,
    password,
    role: "restaurant"
  };

  accounts.push(restaurantData);
  saveRestaurantAccounts(accounts);
  saveCurrentUser(restaurantData);

  if (restaurantMessageEl) {
    restaurantMessageEl.textContent = "Restaurante registrado con éxito";
  }

  setTimeout(() => {
    closeRestaurantRegister();
    clearRestaurantRegisterForm();
    window.location.href = "panel-restaurant.html";
  }, 200);
}

/* =========================
   LOGIN
========================= */
function loginUser() {
  const role = loginRoleInput ? loginRoleInput.value : "customer";
  const email = loginEmailInput ? loginEmailInput.value.trim() : "";
  const password = loginPasswordInput ? loginPasswordInput.value : "";

  if (!email || !password) {
    if (loginMessageEl) {
      loginMessageEl.textContent = "Completa correo y contraseña";
    } else {
      alert("Completa correo y contraseña");
    }
    return;
  }

  const normalizedEmail = normalizeEmail(email);

  if (role === "restaurant") {
    const accounts = getRestaurantAccounts();
    const restaurant = accounts.find(
      (account) =>
        normalizeEmail(account.email) === normalizedEmail &&
        account.password === password
    );

    if (!restaurant) {
      if (loginMessageEl) {
        loginMessageEl.textContent = "Datos inválidos para restaurante";
      } else {
        alert("Datos inválidos para restaurante");
      }
      return;
    }

    saveCurrentUser(restaurant);
    closeLogin();
    clearLoginForm();
    window.location.href = "panel-restaurant.html";
    return;
  }

  const users = getUsers();
  const user = users.find(
    (item) =>
      normalizeEmail(item.email) === normalizedEmail &&
      item.password === password
  );

  if (!user) {
    if (loginMessageEl) {
      loginMessageEl.textContent = "Correo o contraseña incorrectos";
    } else {
      alert("Correo o contraseña incorrectos");
    }
    return;
  }

  saveCurrentUser(user);

  /* Compatibilidad con tu lógica anterior */
  localStorage.setItem("user", JSON.stringify(user));
  localStorage.setItem("deliUser", JSON.stringify(user));

  closeLogin();
  clearLoginForm();

  if (isRestaurantPanelPage()) {
    window.location.href = "index.html";
  } else {
    window.location.reload();
  }
}

/* =========================
   SESIÓN / USUARIO
========================= */
function getSavedUser() {
  const currentUser = getCurrentUser();

  if (currentUser && currentUser.role === "customer") {
    return currentUser;
  }

  return (
    safeParse(localStorage.getItem("user"), null) ||
    safeParse(localStorage.getItem("deliUser"), null) ||
    {}
  );
}

function getSavedRestaurant() {
  const currentUser = getCurrentUser();

  if (currentUser && currentUser.role === "restaurant") {
    return currentUser;
  }

  return null;
}

function isCustomerLoggedIn() {
  const currentUser = getCurrentUser();
  return !!(currentUser && currentUser.role === "customer");
}

function isRestaurantLoggedIn() {
  const currentUser = getCurrentUser();
  return !!(currentUser && currentUser.role === "restaurant");
}

function logout() {
  const wasRestaurant = isRestaurantLoggedIn();

  clearCurrentUser();

  /* Compatibilidad con tu lógica anterior */
  localStorage.removeItem("user");
  localStorage.removeItem("deliUser");

  if (wasRestaurant || isRestaurantPanelPage()) {
    window.location.href = "index.html";
  } else {
    location.reload();
  }
}

function logoutRestaurant() {
  logout();
}

/* =========================
   PROTECCIÓN DE RUTAS
========================= */
function protectRestaurantPanel() {
  if (!isRestaurantPanelPage()) return;

  const currentUser = getCurrentUser();

  if (!currentUser || currentUser.role !== "restaurant") {
    window.location.href = "index.html";
  }
}

/* =========================
   INICIALIZACIÓN
========================= */
migrateLegacyUserIfNeeded();
protectRestaurantPanel();

/* =========================
   EXPONER FUNCIONES
========================= */
window.showRegister = showRegister;
window.closeRegister = closeRegister;
window.registerUser = registerUser;

window.showLogin = showLogin;
window.closeLogin = closeLogin;
window.loginUser = loginUser;

window.showRestaurantRegister = showRestaurantRegister;
window.closeRestaurantRegister = closeRestaurantRegister;
window.registerRestaurant = registerRestaurant;

window.logout = logout;
window.logoutRestaurant = logoutRestaurant;

window.getSavedUser = getSavedUser;
window.getSavedRestaurant = getSavedRestaurant;
window.getCurrentUser = getCurrentUser;
window.isCustomerLoggedIn = isCustomerLoggedIn;
window.isRestaurantLoggedIn = isRestaurantLoggedIn;