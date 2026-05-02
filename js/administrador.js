/* =====================================================
   PANEL ADMINISTRATIVO DELI
   Conectado al backend
====================================================== */

const API_URL = "https://deligo-backend-i554.onrender.com"; // CAMBIO: conectar frontend con backend Render

let adminData = {
  users: [],
  restaurants: [],
  orders: []
};

const ADMIN_ACTIVE_SECTION_KEY = "deliAdminActiveSection";

document.addEventListener("DOMContentLoaded", () => {
  protegerPanelAdministrador();
  prepararMenuAdministrador();

  /*
    Restaurar vista guardada desde el primer momento.
    Esto evita que, al recargar la página completa, el HTML vuelva visualmente
    al Resumen antes de que lleguen los datos del backend.
  */
  const savedSection = localStorage.getItem(ADMIN_ACTIVE_SECTION_KEY);
  if (savedSection) {
    abrirSeccionAdministrador(savedSection, { silentScroll: true });
  }

  cargarDatosAdministrador();
});

/* =====================================================
   PROTECCIÓN DE SESIÓN
====================================================== */
function protegerPanelAdministrador() {
  const admin = obtenerAdminCache();

  if (!admin || admin.role !== "admin") {
    window.location.href = "acceso-administrativo.html";
    return;
  }

  const sessionText = document.getElementById("adminSessionText");
  if (sessionText) {
    sessionText.textContent = admin.email || "Administrador";
  }
}

function obtenerAdminCache() {
  try {
    return JSON.parse(localStorage.getItem("deliAdmin")) || null;
  } catch (error) {
    return null;
  }
}

function cerrarSesionAdministrador() {
  localStorage.removeItem("deliAdmin");
  window.location.href = "acceso-administrativo.html";
}

/* =====================================================
   NAVEGACIÓN INTERNA
====================================================== */
function prepararMenuAdministrador() {
  const buttons = document.querySelectorAll(".admin-menu-btn");

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      abrirSeccionAdministrador(button.dataset.section);
    });
  });
}

/*
  Permite abrir una sección desde el menú o desde las tarjetas del resumen.
  Así las tarjetas de reportes pueden llevar directamente a la acción correspondiente.
*/
function abrirSeccionAdministrador(target, options = {}) {
  if (!target) return;

  /*
    Guardamos SIEMPRE la sección activa.
    Así, aunque la página se recargue completa, el panel vuelve a la vista
    donde el administrador estaba trabajando.
  */
  localStorage.setItem(ADMIN_ACTIVE_SECTION_KEY, target);

  const buttons = document.querySelectorAll(".admin-menu-btn");
  const sections = document.querySelectorAll(".admin-section");

  buttons.forEach((item) => {
    item.classList.toggle("active", item.dataset.section === target);
  });

  sections.forEach((section) => {
    section.classList.toggle("active", section.id === target);
  });

  if (!options.silentScroll) {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

/* =====================================================
   CARGA DE DATOS DESDE BACKEND
====================================================== */
async function cargarDatosAdministrador() {
  /*
    IMPORTANTE:
    En una recarga completa, el HTML marca por defecto Resumen como activo.
    Por eso NO usamos primero ".admin-section.active".
    Primero usamos lo guardado en localStorage.
  */
  const sectionToRestore =
    localStorage.getItem(ADMIN_ACTIVE_SECTION_KEY) ||
    document.querySelector(".admin-section.active")?.id ||
    "resumenSection";

  try {
    const response = await fetch(`${API_URL}/admin/datos`);
    const data = await response.json();

    if (!data.ok) {
      alert(data.message || "No se pudieron cargar los datos administrativos");
      return;
    }

    /*
      CORRECCIÓN:
      El backend /admin/datos devuelve:
      {
        ok: true,
        data: {
          users: [],
          restaurants: [],
          orders: []
        }
      }

      Por eso leemos primero data.data para no mostrar listas vacías.
    */
    const payload = data.data || {};

    adminData.users = Array.isArray(payload.users) ? payload.users : [];
    adminData.restaurants = Array.isArray(payload.restaurants) ? payload.restaurants : [];
    adminData.orders = Array.isArray(payload.orders) ? payload.orders : [];

    renderResumen();
    renderUsuarios();
    setTimeout(activarClickUsuarios, 0);
    /*
      NUEVA ARQUITECTURA MODULAR RESTAURANTES:
      Si existe el módulo separado js/admin/admin_restaurants.js,
      usamos ese módulo para pintar la vista PRO de restaurantes.

      Si por cualquier motivo el módulo no carga,
      mantenemos renderRestaurantes() como respaldo seguro.
    */
    if (window.initAdminRestaurants) {
      window.initAdminRestaurants(adminData.restaurants, adminData.orders);
      setTimeout(activarEdicionRestaurantesModulares, 0);
    } else {
      renderRestaurantes();
    }

    /*
      NUEVA ARQUITECTURA MODULAR:
      Si existe el módulo separado js/admin/admin-orders.js,
      usamos ese módulo para pintar la vista PRO de pedidos.

      Si por cualquier motivo el módulo no carga,
      mantenemos renderPedidos() como respaldo seguro.
    */
    if (window.initAdminOrders) {
      window.initAdminOrders(adminData.orders);
    } else {
      renderPedidos();
    }

    renderComisiones();

    /*
      Restaurar vista después de repintar todas las secciones.
      Esto evita que el administrador salga de Pedidos, Usuarios,
      Restaurantes o Comisiones cuando se recargan datos.
    */
    abrirSeccionAdministrador(sectionToRestore, { silentScroll: true });
  } catch (error) {
    console.error("Error cargando datos admin:", error);
    alert("Error conectando con el backend administrativo");
  }
}

/* =====================================================
   RESUMEN
====================================================== */
function renderResumen() {
  const totalUsuarios = adminData.users.length;
  const totalRestaurantes = adminData.restaurants.length;
  const totalPedidos = adminData.orders.length;
  const ventasBrutas = adminData.orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const comisionDeli = calcularComisionTotal();
  const pendientes = adminData.restaurants.filter((restaurant) => obtenerEstadoRestaurante(restaurant) === "pending").length;

  setText("totalUsuarios", totalUsuarios);
  setText("totalRestaurantes", totalRestaurantes);
  setText("totalPedidos", totalPedidos);
  setText("ventasBrutas", formatMoney(ventasBrutas));
  setText("comisionDeli", formatMoney(comisionDeli));
  setText("restaurantesPendientes", pendientes);

  prepararTarjetasResumen();
}

/*
  Convierte las tarjetas del resumen en accesos rápidos.
  No modifica el HTML original: lo hace desde JavaScript para evitar tocar estructura.
*/
function prepararTarjetasResumen() {
  const links = [
    { id: "totalUsuarios", section: "usuariosSection" },
    { id: "totalRestaurantes", section: "restaurantesSection" },
    { id: "totalPedidos", section: "pedidosSection" },
    { id: "ventasBrutas", section: "pedidosSection" },
    { id: "comisionDeli", section: "comisionesSection" },
    { id: "restaurantesPendientes", section: "restaurantesSection" }
  ];

  links.forEach((item) => {
    const numberEl = document.getElementById(item.id);
    const card = numberEl ? numberEl.closest(".stat-card") : null;

    if (!card || card.dataset.linkReady === "true") return;

    card.dataset.linkReady = "true";
    card.style.cursor = "pointer";
    card.title = "Abrir sección correspondiente";

    card.addEventListener("click", () => {
      abrirSeccionAdministrador(item.section);
    });
  });
}

function calcularComisionTotal() {
  return adminData.orders.reduce((sum, order) => {
    const restaurant = adminData.restaurants.find(
      (item) => normalizeEmail(item.email) === normalizeEmail(order.restaurantEmail)
    );

    const commissionPercent = Number(restaurant?.commissionPercent ?? restaurant?.commission ?? 15);
    return sum + (Number(order.total || 0) * commissionPercent / 100);
  }, 0);
}

/* =====================================================
   USUARIOS
====================================================== */
function renderUsuarios() {
  const container = document.getElementById("usuariosList");
  if (!container) return;

  if (!adminData.users.length) {
    container.innerHTML = `<div class="empty-box">No hay usuarios registrados.</div>`;
    return;
  }

  container.innerHTML = `
    <table class="admin-table">
      <thead>
        <tr>
          <th>Nombre</th>
          <th>Correo</th>
          <th>Teléfono</th>
          <th>Dirección</th>
          <th>Pedidos</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
        ${adminData.users.map((user) => {
          const userOrders = adminData.orders.filter(
            (order) => normalizeEmail(order.customer?.email) === normalizeEmail(user.email)
          );

          const userId = encodeURIComponent(user.id || user.email || "");

          return `
            <tr>
              <td>${escapeHtml(user.fullName || "Usuario")}</td>
              <td>${escapeHtml(user.email || "-")}</td>
              <td>${escapeHtml(user.phone || "-")}</td>
              <td>${escapeHtml(user.address || "-")}</td>
              <td>${userOrders.length}</td>
              <td>
                <div class="action-row">
                  <button class="action-btn btn-view-edit" type="button" onclick="verDetalleUsuario('${encodeURIComponent(user.email || "")}')">Ver datos</button>
                </div>
              </td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;
}

/* =====================================================
   RESTAURANTES
====================================================== */
function renderRestaurantes() {
  const container = document.getElementById("restaurantesList");
  if (!container) return;

  if (!adminData.restaurants.length) {
    container.innerHTML = `<div class="empty-box">No hay restaurantes registrados.</div>`;
    return;
  }

  container.innerHTML = `
    <table class="admin-table">
      <thead>
        <tr>
          <th>Restaurante</th>
          <th>Correo</th>
          <th>Teléfono</th>
          <th>Estado</th>
          <th>Comisión</th>
          <th>Pedidos</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
        ${adminData.restaurants.map((restaurant) => {
          const status = obtenerEstadoRestaurante(restaurant);
          const restaurantOrders = adminData.orders.filter(
            (order) => normalizeEmail(order.restaurantEmail) === normalizeEmail(restaurant.email)
          );

          return `
            <tr class="admin-clickable-row" onclick="verDetalleRestaurante('${encodeURIComponent(restaurant.id || restaurant.email)}')">
              <td>${escapeHtml(restaurant.name || "Restaurante")}</td>
              <td>${escapeHtml(restaurant.email || "-")}</td>
              <td>${escapeHtml(restaurant.phone || "-")}</td>
              <td>${renderEstado(status)}</td>
              <td>${Number(restaurant.commissionPercent ?? restaurant.commission ?? 15)}%</td>
              <td>${restaurantOrders.length}</td>
              <td>
                <div class="action-row">
                  <button class="action-btn btn-approve" onclick="event.stopPropagation(); actualizarEstadoRestaurante('${encodeURIComponent(restaurant.id || restaurant.email)}', 'approved')">Aprobar</button>
                  <button class="action-btn btn-block" onclick="event.stopPropagation(); actualizarEstadoRestaurante('${encodeURIComponent(restaurant.id || restaurant.email)}', 'blocked')">Bloquear</button>
                  <button class="action-btn btn-delete" onclick="event.stopPropagation(); eliminarRestaurante('${encodeURIComponent(restaurant.id || restaurant.email)}', '${encodeURIComponent(restaurant.name || "Restaurante")}')">Eliminar</button>
                </div>
              </td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;
}

function obtenerEstadoRestaurante(restaurant) {
  const status = String(restaurant.status || "pending").trim().toLowerCase();

  /*
    Simplificación administrativa:
    - pending: pendiente de aprobación
    - approved: visible y con acceso al panel
    - blocked: pausado/bloqueado temporalmente
    Si existiera algún registro viejo con "paused", lo tratamos como "blocked"
    para no manejar dos botones que hacen prácticamente lo mismo.
  */
  if (status === "paused") return "blocked";

  return status;
}

function renderEstado(status) {
  status = obtenerEstadoRestaurante({ status });

  const labels = {
    approved: "Aprobado",
    pending: "Pendiente",
    blocked: "Bloqueado"
  };

  const classes = {
    approved: "status-approved",
    pending: "status-pending",
    blocked: "status-blocked"
  };

  return `<span class="status-pill ${classes[status] || "status-pending"}">${labels[status] || "Pendiente"}</span>`;
}

async function leerRespuestaBackend(response) {
  const raw = await response.text();

  try {
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    return {
      ok: false,
      message: raw || "Respuesta no válida del backend"
    };
  }
}

async function actualizarEstadoRestaurante(encodedRestaurantId, status) {
  const restaurantId = decodeURIComponent(encodedRestaurantId);

  try {
    /*
      CORRECCIÓN:
      El backend real usa /admin/restaurantes/:id/estado.
      También se acepta ID o correo para no romper datos antiguos.
    */
    const response = await fetch(`${API_URL}/admin/restaurantes/${encodeURIComponent(restaurantId)}/estado`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ status })
    });

    const data = await leerRespuestaBackend(response);

    if (!response.ok || !data.ok) {
      alert(data.message || "No se pudo actualizar el restaurante");
      return;
    }

    await cargarDatosAdministrador();
  } catch (error) {
    console.error("Error actualizando restaurante:", error);
    alert("Error conectando con el backend. Revisa que el servidor esté reiniciado en el puerto 3001.");
  }
}

async function eliminarRestaurante(encodedRestaurantId, restaurantName) {
  const restaurantId = decodeURIComponent(encodedRestaurantId);
  const cleanRestaurantName = decodeURIComponent(restaurantName || "Restaurante");
  const confirmDelete = confirm(`¿Seguro que quieres eliminar el restaurante "${cleanRestaurantName}"? Esta acción no se puede deshacer.`);

  if (!confirmDelete) return;

  try {
    const response = await fetch(`${API_URL}/admin/restaurantes/${encodeURIComponent(restaurantId)}`, {
      method: "DELETE"
    });

    const data = await leerRespuestaBackend(response);

    if (!response.ok || !data.ok) {
      alert(data.message || "No se pudo eliminar el restaurante");
      return;
    }

    await cargarDatosAdministrador();
  } catch (error) {
    console.error("Error eliminando restaurante:", error);
    alert("Error conectando con el backend. Revisa que el servidor esté reiniciado en el puerto 3001.");
  }
}


/* =====================================================
   EDICIÓN ADMINISTRATIVA DE USUARIOS Y RESTAURANTES
   - No usa localStorage como fuente de datos.
   - Guarda cambios reales en backend / JSON.
   - Se inyecta el formulario por JS para no tocar HTML.
====================================================== */
function ensureAdminEditModal() {
  let modal = document.getElementById("adminEditModal");

  if (modal) return modal;

  modal = document.createElement("div");
  modal.id = "adminEditModal";
  modal.className = "admin-edit-modal hidden";
  modal.innerHTML = `
    <div class="admin-edit-backdrop" onclick="cerrarEditorAdmin()"></div>
    <div class="admin-edit-card" role="dialog" aria-modal="true">
      <div class="admin-edit-head">
        <div>
          <h3 id="adminEditTitle">Editar</h3>
          <p id="adminEditSubtitle">Modifica los datos y guarda en backend.</p>
        </div>
        <button class="admin-edit-close" type="button" onclick="cerrarEditorAdmin()">✕</button>
      </div>
      <div id="adminEditBody"></div>
    </div>
  `;

  document.body.appendChild(modal);
  return modal;
}

function cerrarEditorAdmin() {
  const modal = document.getElementById("adminEditModal");
  if (modal) modal.classList.add("hidden");
}

function getUserByIdOrEmail(idOrEmail) {
  const clean = decodeURIComponent(idOrEmail || "");

  return adminData.users.find((user) => {
    return (
      String(user.id || "").trim() === clean ||
      normalizeEmail(user.email) === normalizeEmail(clean)
    );
  }) || null;
}

function getRestaurantByIdOrEmail(idOrEmail) {
  const clean = decodeURIComponent(idOrEmail || "");

  return adminData.restaurants.find((restaurant) => {
    return (
      String(restaurant.id || "").trim() === clean ||
      normalizeEmail(restaurant.email) === normalizeEmail(clean)
    );
  }) || null;
}

function fieldValue(value) {
  return escapeHtml(value || "");
}

function getAdminUserPasswordValue(user) {
  return String(user?.password || "");
}

function getAdminRestaurantPasswordValue(restaurant) {
  return String(restaurant?.password || "");
}

function setAdminEditFieldsEnabled(enabled) {
  const modal = document.getElementById("adminEditModal");
  if (!modal) return;

  modal.querySelectorAll("[data-edit-field]").forEach((field) => {
    field.disabled = !enabled;
  });

  modal.querySelectorAll("[data-edit-only]").forEach((item) => {
    item.style.display = enabled ? "" : "none";
  });

  modal.querySelectorAll("[data-view-only]").forEach((item) => {
    item.style.display = enabled ? "none" : "";
  });
}

function abrirEditorUsuario(encodedUserId) {
  const user = getUserByIdOrEmail(encodedUserId);

  if (!user) {
    alert("No se encontró el usuario para editar.");
    return;
  }

  const modal = ensureAdminEditModal();
  const title = document.getElementById("adminEditTitle");
  const subtitle = document.getElementById("adminEditSubtitle");
  const body = document.getElementById("adminEditBody");

  if (title) title.textContent = "Editar usuario";
  if (subtitle) subtitle.textContent = "Modifica solo los datos necesarios y guarda en backend.";

  if (body) {
    body.innerHTML = `
      <form class="admin-edit-form" onsubmit="guardarEdicionUsuario(event, '${encodeURIComponent(user.id || user.email || "")}')">
        <div class="admin-edit-grid">
          <label>
            ID interno
            <input type="text" value="${fieldValue(user.id || "")}" disabled>
          </label>

          <label>
            Rol
            <input type="text" value="${fieldValue(user.role || "customer")}" disabled>
          </label>

          <label>
            Nombre completo
            <input id="editUserFullName" type="text" value="${fieldValue(user.fullName || user.name || "")}" required>
          </label>

          <label>
            Correo
            <input id="editUserEmail" type="email" value="${fieldValue(user.email || "")}" required>
          </label>

          <label>
            Teléfono
            <input id="editUserPhone" type="text" value="${fieldValue(user.phone || "")}">
          </label>

          <label>
            Dirección
            <input id="editUserAddress" type="text" value="${fieldValue(user.address || "")}">
          </label>

          <label>
            Referencia
            <input id="editUserReference" type="text" value="${fieldValue(user.reference || "")}">
          </label>

          <label>
            Contraseña
            <input id="editUserPassword" type="text" value="${fieldValue(getAdminUserPasswordValue(user))}">
          </label>

          <label>
            Latitud GPS
            <input id="editUserLat" type="text" value="${fieldValue(user.location?.lat || "")}">
          </label>

          <label>
            Longitud GPS
            <input id="editUserLng" type="text" value="${fieldValue(user.location?.lng || "")}">
          </label>
        </div>

        <div class="admin-edit-actions">
          <button class="action-btn btn-save" type="submit">Guardar cambios</button>
          <button class="action-btn btn-light" type="button" onclick="cerrarEditorAdmin()">Cancelar</button>
        </div>
      </form>
    `;
  }

  modal.classList.remove("hidden");
}

async function guardarEdicionUsuario(event, encodedUserId) {
  event.preventDefault();

  const userId = decodeURIComponent(encodedUserId || "");

  const payload = {
    fullName: document.getElementById("editUserFullName")?.value.trim() || "",
    email: document.getElementById("editUserEmail")?.value.trim().toLowerCase() || "",
    phone: document.getElementById("editUserPhone")?.value.trim() || "",
    address: document.getElementById("editUserAddress")?.value.trim() || "",
    reference: document.getElementById("editUserReference")?.value.trim() || "",
    password: document.getElementById("editUserPassword")?.value || "",
    location: {
      lat: document.getElementById("editUserLat")?.value.trim() || "",
      lng: document.getElementById("editUserLng")?.value.trim() || ""
    }
  };

  if (!payload.fullName || !payload.email) {
    alert("Nombre y correo son obligatorios.");
    return;
  }

  try {
    const response = await fetch(`${API_URL}/admin/users/${encodeURIComponent(userId)}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await leerRespuestaBackend(response);

    if (!response.ok || !data.ok) {
      alert(data.message || "No se pudo editar el usuario");
      return;
    }

    cerrarEditorAdmin();
    await cargarDatosAdministrador();
  } catch (error) {
    console.error("Error editando usuario:", error);
    alert("Error conectando con el backend al editar usuario.");
  }
}

function abrirEditorRestaurante(encodedRestaurantId) {
  const restaurant = getRestaurantByIdOrEmail(encodedRestaurantId);

  if (!restaurant) {
    alert("No se encontró el restaurante para editar.");
    return;
  }

  const status = obtenerEstadoRestaurante(restaurant);
  const commission = Number(restaurant.commissionPercent ?? restaurant.commission ?? 15);

  const modal = ensureAdminEditModal();
  const title = document.getElementById("adminEditTitle");
  const subtitle = document.getElementById("adminEditSubtitle");
  const body = document.getElementById("adminEditBody");

  if (title) title.textContent = "Editar restaurante";
  if (subtitle) subtitle.textContent = "Modifica solo los datos necesarios y guarda en backend.";

  if (body) {
    body.innerHTML = `
      <form class="admin-edit-form" onsubmit="guardarEdicionRestaurante(event, '${encodeURIComponent(restaurant.id || restaurant.email || "")}')">
        <div class="admin-edit-grid">
          <label>
            ID interno
            <input type="text" value="${fieldValue(restaurant.id || "")}" disabled>
          </label>

          <label>
            Rol
            <input type="text" value="${fieldValue(restaurant.role || "restaurant")}" disabled>
          </label>

          <label>
            Nombre del restaurante
            <input id="editRestaurantName" type="text" value="${fieldValue(restaurant.name || "")}" required>
          </label>

          <label>
            Correo
            <input id="editRestaurantEmail" type="email" value="${fieldValue(restaurant.email || "")}" required>
          </label>

          <label>
            Teléfono
            <input id="editRestaurantPhone" type="text" value="${fieldValue(restaurant.phone || "")}">
          </label>

          <label>
            Dirección
            <input id="editRestaurantAddress" type="text" value="${fieldValue(restaurant.address || "")}">
          </label>

          <label>
            Categoría
            <input id="editRestaurantCategory" type="text" value="${fieldValue(restaurant.category || "Comida")}">
          </label>

          <label>
            Estado
            <select id="editRestaurantStatus">
              <option value="pending" ${status === "pending" ? "selected" : ""}>Pendiente</option>
              <option value="approved" ${status === "approved" ? "selected" : ""}>Aprobado</option>
              <option value="blocked" ${status === "blocked" ? "selected" : ""}>Bloqueado</option>
            </select>
          </label>

          <label>
            Comisión (%)
            <input id="editRestaurantCommission" type="number" min="0" max="100" value="${commission}">
          </label>

          <label>
            Contraseña
            <input id="editRestaurantPassword" type="text" value="${fieldValue(getAdminRestaurantPasswordValue(restaurant))}">
          </label>
        </div>

        <label class="admin-edit-full">
          Descripción
          <textarea id="editRestaurantDescription" rows="3">${fieldValue(restaurant.description || "")}</textarea>
        </label>

        <div class="admin-edit-warning">
          Si cambias el correo del restaurante, el backend migrará platos y pedidos asociados para no romper relaciones.
        </div>

        <div class="admin-edit-actions">
          <button class="action-btn btn-save" type="submit">Guardar cambios</button>
          <button class="action-btn btn-light" type="button" onclick="cerrarEditorAdmin()">Cancelar</button>
        </div>
      </form>
    `;
  }

  modal.classList.remove("hidden");
}

async function guardarEdicionRestaurante(event, encodedRestaurantId) {
  event.preventDefault();

  const restaurantId = decodeURIComponent(encodedRestaurantId || "");

  const payload = {
    name: document.getElementById("editRestaurantName")?.value.trim() || "",
    email: document.getElementById("editRestaurantEmail")?.value.trim().toLowerCase() || "",
    phone: document.getElementById("editRestaurantPhone")?.value.trim() || "",
    address: document.getElementById("editRestaurantAddress")?.value.trim() || "",
    category: document.getElementById("editRestaurantCategory")?.value.trim() || "Comida",
    status: document.getElementById("editRestaurantStatus")?.value || "pending",
    commissionPercent: Number(document.getElementById("editRestaurantCommission")?.value || 15),
    description: document.getElementById("editRestaurantDescription")?.value.trim() || "",
    password: document.getElementById("editRestaurantPassword")?.value || ""
  };

  if (!payload.name || !payload.email) {
    alert("Nombre y correo son obligatorios.");
    return;
  }

  if (Number.isNaN(payload.commissionPercent) || payload.commissionPercent < 0 || payload.commissionPercent > 100) {
    alert("La comisión debe estar entre 0 y 100.");
    return;
  }

  try {
    const response = await fetch(`${API_URL}/admin/restaurantes/${encodeURIComponent(restaurantId)}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await leerRespuestaBackend(response);

    if (!response.ok || !data.ok) {
      alert(data.message || "No se pudo editar el restaurante");
      return;
    }

    cerrarEditorAdmin();
    await cargarDatosAdministrador();
  } catch (error) {
    console.error("Error editando restaurante:", error);
    alert("Error conectando con el backend al editar restaurante.");
  }
}

function activarEdicionRestaurantesModulares() {
  /*
    CORRECCIÓN IMPORTANTE:
    En la vista PRO de restaurantes, la tabla no la pinta renderRestaurantes(),
    la pinta window.initAdminRestaurants().
    Por eso aquí NO debemos desactivar la función.
    Esta función deja cada fila clickeable y abre la ficha completa del restaurante,
    donde está el botón claro "Editar datos".
  */
  const container = document.getElementById("restaurantesList");
  if (!container) return;

  const possibleRows = Array.from(
    container.querySelectorAll("tr, article, .restaurant-card, .admin-restaurant-card, .restaurant-item")
  );

  adminData.restaurants.forEach((restaurant) => {
    const restaurantId = restaurant.id || restaurant.email || "";
    const email = normalizeEmail(restaurant.email);

    possibleRows.forEach((row) => {
      const text = normalizeEmail(row.textContent || "");
      if (!email || !text.includes(email)) return;

      row.dataset.adminEditInjected = "true";
      row.classList.add("admin-clickable-row");
      row.title = "Haz clic para ver datos y editar";

      if (row.dataset.restaurantClickReady === "true") return;
      row.dataset.restaurantClickReady = "true";

      row.addEventListener("click", (event) => {
        if (event.target.closest("button, a, input, select, textarea")) return;
        verDetalleRestaurante(encodeURIComponent(restaurantId));
      });
    });
  });
}


/* =====================================================
   DETALLE RESTAURANTE INTEGRADO
   Sin modal: usa el ancho del panel Restaurantes
====================================================== */
function ensureRestauranteDetallePanel() {
  let panel = document.getElementById("restauranteDetallePanel");

  if (panel) return panel;

  const container = document.getElementById("restaurantesList");
  panel = document.createElement("div");
  panel.id = "restauranteDetallePanel";
  panel.className = "hidden";

  if (container && container.parentNode) {
    container.insertAdjacentElement("afterend", panel);
  } else {
    document.body.appendChild(panel);
  }

  return panel;
}

function cerrarDetalleRestaurante() {
  /*
    CORRECCIÓN:
    El botón "Cerrar detalle" debe ocultar siempre la ficha del restaurante,
    aunque el panel haya sido creado dinámicamente o esté en otra posición del DOM.
  */
  const panel = document.getElementById("restauranteDetallePanel");

  if (!panel) return;

  panel.classList.add("hidden");
  panel.innerHTML = "";
}

function getRestaurantTotalSales(restaurant) {
  return adminData.orders
    .filter((order) => normalizeEmail(order.restaurantEmail) === normalizeEmail(restaurant.email))
    .reduce((sum, order) => sum + Number(order.total || 0), 0);
}

function getRestaurantOrdersList(restaurant) {
  return adminData.orders.filter((order) => {
    return normalizeEmail(order.restaurantEmail) === normalizeEmail(restaurant.email);
  });
}

function getRestaurantLastOrder(restaurant) {
  const orders = getRestaurantOrdersList(restaurant);

  if (!orders.length) return null;

  return [...orders].sort((a, b) => {
    const da = getOrderDateObject(a)?.getTime() || 0;
    const db = getOrderDateObject(b)?.getTime() || 0;
    return db - da;
  })[0];
}

function verDetalleRestaurante(encodedRestaurantId) {
  const restaurant = getRestaurantByIdOrEmail(encodedRestaurantId);

  if (!restaurant) return;

  const orders = getRestaurantOrdersList(restaurant);
  const totalSales = getRestaurantTotalSales(restaurant);
  const status = obtenerEstadoRestaurante(restaurant);
  const commission = Number(restaurant.commissionPercent ?? restaurant.commission ?? 15);
  const lastOrder = getRestaurantLastOrder(restaurant);
  const panel = ensureRestauranteDetallePanel();

  panel.classList.remove("hidden");

  panel.innerHTML = `
    <div class="user-page-header">
      <div class="user-page-title">
        <h3>${escapeHtml(restaurant.name || "Restaurante")}</h3>
        <p>Ficha administrativa del restaurante · revisa los datos y usa "Editar datos del restaurante" para modificarlo.</p>
      </div>

      <div class="user-page-actions">
        <span class="user-detail-badge">${orders.length} pedido(s)</span>
        <button class="user-page-btn dark" type="button" onclick="abrirEditorRestaurante('${encodeURIComponent(restaurant.id || restaurant.email || "")}')">Editar datos del restaurante</button>
        <button class="user-page-btn light" type="button" onclick="cerrarDetalleRestaurante()">Cerrar detalle</button>
      </div>
    </div>

    <div class="user-page-body">
      <div class="user-page-summary">
        <div class="user-page-card">
          <span>Ventas acumuladas</span>
          <strong>${formatMoney(totalSales)}</strong>
        </div>

        <div class="user-page-card">
          <span>Pedidos</span>
          <strong>${orders.length}</strong>
        </div>

        <div class="user-page-card">
          <span>Comisión DELI</span>
          <strong>${commission}%</strong>
        </div>

        <div class="user-page-card">
          <span>Última venta</span>
          <strong>${lastOrder ? escapeHtml(getOrderDateText(lastOrder)) : "-"}</strong>
        </div>
      </div>

      <div class="user-page-info">
        <div class="user-page-info-item">
          <span>ID interno</span>
          <strong>${escapeHtml(restaurant.id || "-")}</strong>
        </div>

        <div class="user-page-info-item">
          <span>Correo</span>
          <strong>${escapeHtml(restaurant.email || "-")}</strong>
        </div>

        <div class="user-page-info-item">
          <span>Teléfono</span>
          <strong>${escapeHtml(restaurant.phone || "-")}</strong>
        </div>

        <div class="user-page-info-item">
          <span>Dirección</span>
          <strong>${escapeHtml(restaurant.address || "-")}</strong>
        </div>

        <div class="user-page-info-item">
          <span>Categoría</span>
          <strong>${escapeHtml(restaurant.category || "Comida")}</strong>
        </div>

        <div class="user-page-info-item">
          <span>Estado</span>
          <strong>${escapeHtml(status)}</strong>
        </div>

        <div class="user-page-info-item">
          <span>Contraseña</span>
          <strong>${escapeHtml(restaurant.password || "-")}</strong>
        </div>

        <div class="user-page-info-item">
          <span>Fecha de registro</span>
          <strong>${escapeHtml(restaurant.createdAt || "-")}</strong>
        </div>
      </div>

      <div class="user-page-mini" style="margin-top:10px;">
        <span>Descripción</span>
        <strong>${escapeHtml(restaurant.description || "Sin descripción")}</strong>
      </div>
    </div>
  `;

  setTimeout(() => {
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 0);
}


/* =====================================================
   PEDIDOS
====================================================== */
function renderPedidos() {
  const container = document.getElementById("pedidosList");
  if (!container) return;

  if (!adminData.orders.length) {
    container.innerHTML = `<div class="empty-box">No hay pedidos registrados.</div>`;
    return;
  }

  container.innerHTML = `
    <table class="admin-table">
      <thead>
        <tr>
          <th>Pedido</th>
          <th>Restaurante</th>
          <th>Cliente</th>
          <th>Total</th>
          <th>Estado</th>
          <th>Fecha</th>
        </tr>
      </thead>
      <tbody>
        ${adminData.orders.map((order) => `
          <tr>
            <td>${escapeHtml(order.id || "-")}</td>
            <td>${escapeHtml(order.restaurantName || order.restaurantEmail || "-")}</td>
            <td>${escapeHtml(order.customer?.fullName || order.customer?.email || "-")}</td>
            <td>${formatMoney(order.total || 0)}</td>
            <td>${escapeHtml(order.status || "pendiente")}</td>
            <td>${escapeHtml(order.date || order.createdAt || "-")}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

/* =====================================================
   COMISIONES
====================================================== */
function renderComisiones() {
  const container = document.getElementById("comisionesList");
  if (!container) return;

  if (!adminData.restaurants.length) {
    container.innerHTML = `<div class="empty-box">No hay restaurantes para configurar comisión.</div>`;
    return;
  }

  container.innerHTML = `
    <table class="admin-table">
      <thead>
        <tr>
          <th>Restaurante</th>
          <th>Correo</th>
          <th>Comisión actual</th>
          <th>Nueva comisión</th>
          <th>Acción</th>
        </tr>
      </thead>
      <tbody>
        ${adminData.restaurants.map((restaurant, index) => `
          <tr>
            <td>${escapeHtml(restaurant.name || "Restaurante")}</td>
            <td>${escapeHtml(restaurant.email || "-")}</td>
            <td>${Number(restaurant.commissionPercent ?? restaurant.commission ?? 15)}%</td>
            <td>
              <input class="commission-input" id="commissionInput${index}" type="number" min="0" max="100" value="${Number(restaurant.commissionPercent ?? restaurant.commission ?? 15)}">
            </td>
            <td>
              <button class="action-btn btn-save" onclick="guardarComisionRestaurante('${encodeURIComponent(restaurant.id || restaurant.email)}', 'commissionInput${index}')">Guardar</button>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

async function guardarComisionRestaurante(encodedRestaurantId, inputId) {
  const restaurantId = decodeURIComponent(encodedRestaurantId);
  const input = document.getElementById(inputId);
  const commissionPercent = Number(input?.value || 0);

  if (commissionPercent < 0 || commissionPercent > 100) {
    alert("La comisión debe estar entre 0 y 100");
    return;
  }

  try {
    const response = await fetch(`${API_URL}/admin/restaurantes/${encodeURIComponent(restaurantId)}/comision`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ commissionPercent })
    });

    const data = await response.json();

    if (!data.ok) {
      alert(data.message || "No se pudo guardar la comisión");
      return;
    }

    await cargarDatosAdministrador();
  } catch (error) {
    console.error("Error guardando comisión:", error);
    alert("Error conectando con el backend");
  }
}

/* =====================================================
   ESTILOS DINÁMICOS ADMIN
   Se agregan por JS para no tocar el HTML ni el CSS actual.
====================================================== */
function inyectarEstilosAdmin() {
  if (document.getElementById("deli-admin-extra-styles")) return;

  const style = document.createElement("style");
  style.id = "deli-admin-extra-styles";
  style.textContent = `
    #restauranteDetallePanel.hidden {
      display: none !important;
    }


    .action-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .btn-delete {
      background: #111827;
      color: #ffffff;
    }

    .btn-edit {
      background: #2563eb;
      color: #ffffff;
    }

    .btn-view-edit {
      background: #eef2ff;
      color: #3730a3;
      border: 1px solid #c7d2fe;
      font-size: 12px;
      padding: 7px 10px;
      opacity: 0.92;
    }

    .btn-view-edit:hover {
      opacity: 1;
      background: #e0e7ff;
    }

    .admin-clickable-row {
      cursor: pointer;
    }

    .admin-clickable-row:hover td {
      background: #fff7f7;
    }

    .admin-clickable-row:hover {
      transform: scale(1.002);
    }

    .admin-clickable-row td:first-child {
      border-left: 3px solid transparent;
    }

    .admin-clickable-row:hover td:first-child {
      border-left: 3px solid #ff4d4d;
    }


    .btn-light {
      background: #f3f4f6;
      color: #111827;
    }

    .admin-edit-modal.hidden {
      display: none;
    }

    .admin-edit-modal {
      position: fixed;
      inset: 0;
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 18px;
    }

    .admin-edit-backdrop {
      position: absolute;
      inset: 0;
      background: rgba(17, 24, 39, 0.58);
    }

    .admin-edit-card {
      position: relative;
      width: min(920px, 100%);
      max-height: 90vh;
      overflow: auto;
      background: #ffffff;
      border-radius: 22px;
      box-shadow: 0 24px 70px rgba(0,0,0,0.22);
      padding: 22px;
    }

    .admin-edit-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 18px;
    }

    .admin-edit-head h3 {
      margin: 0 0 4px;
      font-size: 22px;
      color: #111827;
    }

    .admin-edit-head p {
      margin: 0;
      color: #6b7280;
      font-size: 14px;
    }

    .admin-edit-close {
      border: 0;
      background: #f3f4f6;
      width: 38px;
      height: 38px;
      border-radius: 999px;
      cursor: pointer;
      font-weight: 800;
    }

    .admin-edit-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
    }

    .admin-edit-form label {
      display: flex;
      flex-direction: column;
      gap: 7px;
      font-size: 13px;
      font-weight: 700;
      color: #374151;
    }

    .admin-edit-form input,
    .admin-edit-form select,
    .admin-edit-form textarea {
      width: 100%;
      border: 1px solid #d1d5db;
      border-radius: 12px;
      padding: 11px 12px;
      font: inherit;
      color: #111827;
      background: #ffffff;
      outline: none;
    }

    .admin-edit-form input:focus,
    .admin-edit-form select:focus,
    .admin-edit-form textarea:focus {
      border-color: #ff4d4d;
      box-shadow: 0 0 0 3px rgba(255, 77, 77, 0.12);
    }

    .admin-edit-full {
      margin-top: 14px;
    }

    .admin-edit-warning {
      margin-top: 14px;
      padding: 12px 14px;
      border-radius: 14px;
      background: #fff7ed;
      border: 1px solid #fed7aa;
      color: #9a3412;
      font-size: 13px;
      font-weight: 700;
    }

    .admin-edit-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      justify-content: flex-end;
      margin-top: 18px;
    }

    @media (max-width: 720px) {
      .admin-edit-grid {
        grid-template-columns: 1fr;
      }

      .admin-edit-card {
        padding: 18px;
      }
    }
  `;

  document.head.appendChild(style);
}

inyectarEstilosAdmin();



/*
  REFRESCO MANUAL DEL PANEL:
  No usamos auto-refresh para evitar parpadeos y que el administrador pierda
  concentración mientras trabaja. El botón "Actualizar pedidos" llama esta
  función solo cuando el administrador decide refrescar.
*/
async function refrescarPanelAdministradorManual() {
  const activeSection = document.querySelector(".admin-section.active")?.id || "pedidosSection";
  localStorage.setItem(ADMIN_ACTIVE_SECTION_KEY, activeSection);

  if (window.adminOrdersSaveViewState) {
    window.adminOrdersSaveViewState();
  }

  await cargarDatosAdministrador();
}

window.refrescarPanelAdministradorManual = refrescarPanelAdministradorManual;

/*
  Si el navegador recarga la página completa, guardamos la sección activa
  justo antes de salir. Esto protege el flujo del administrador.
*/
window.addEventListener("beforeunload", () => {
  const activeSection = document.querySelector(".admin-section.active")?.id;
  if (activeSection) {
    localStorage.setItem(ADMIN_ACTIVE_SECTION_KEY, activeSection);
  }
});

/* =====================================================
   UTILIDADES
====================================================== */
function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function formatMoney(value) {
  return `$${Number(value || 0).toLocaleString("es-VE")}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


/* =====================================================
   DETALLE USUARIO INTEGRADO
   Sin modal: usa todo el ancho del panel Usuarios
====================================================== */
let selectedUserOrdersCache = [];
let selectedUserOrdersOriginalCache = [];
let selectedUserEmailCache = "";
let selectedUserDataCache = null;

function cerrarDetalleUsuario() {
  const panel = document.getElementById("usuarioDetallePanel");
  if (panel) panel.classList.add("hidden");
}

function getOrderCustomerEmail(order) {
  return normalizeEmail(order?.customer?.email || order?.email || "");
}

function getOrderRestaurantName(order) {
  return order?.restaurantName || order?.restaurant?.name || order?.restaurantEmail || "Restaurante";
}

function getOrderDateObject(order) {
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

function getOrderDateKey(order) {
  const date = getOrderDateObject(order);
  if (!date) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getOrderDateText(order) {
  const parsed = getOrderDateObject(order);

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

  if (date || time) {
    return `${date} ${time}`.trim();
  }

  return "-";
}

function getOrderHourText(order) {
  const parsed = getOrderDateObject(order);

  if (parsed) {
    return parsed.toLocaleTimeString("es-CL", {
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  return order?.time || "-";
}

function getOrderItems(order) {
  return Array.isArray(order?.items) ? order.items : [];
}

function getOrderItemsCount(order) {
  return getOrderItems(order).reduce((sum, item) => {
    return sum + Number(item?.qty || 0);
  }, 0);
}

function getOrderTotalSafe(order) {
  const directTotal = Number(order?.total || 0);

  if (directTotal > 0) return directTotal;

  return getOrderItems(order).reduce((sum, item) => {
    const qty = Number(item?.qty || 0);
    const price = Number(item?.price || 0);
    const subtotal = Number(item?.subtotal || 0);
    return sum + (subtotal > 0 ? subtotal : qty * price);
  }, 0);
}

function getUserTotalSpent(orders) {
  return orders.reduce((sum, order) => sum + getOrderTotalSafe(order), 0);
}

function getUserLastOrder(orders) {
  if (!orders.length) return null;

  return [...orders].sort((a, b) => {
    const da = getOrderDateObject(a)?.getTime() || 0;
    const db = getOrderDateObject(b)?.getTime() || 0;
    return db - da;
  })[0];
}

function getUserRestaurantsCount(orders) {
  const restaurants = new Set();

  orders.forEach((order) => {
    const name = normalizeEmail(order.restaurantEmail || getOrderRestaurantName(order));
    if (name) restaurants.add(name);
  });

  return restaurants.size;
}

function getStatusLabelAdmin(status) {
  const raw = String(status || "pendiente")
    .trim()
    .toLowerCase()
    .replaceAll("-", "_")
    .replaceAll(" ", "_");

  const labels = {
    pendiente: "Pendiente",
    aceptado: "Aceptado",
    preparando: "Preparando",
    listo: "Listo",
    en_camino: "En camino",
    entregado: "Entregado",
    delivered: "Entregado",
    completed: "Entregado",
    finished: "Entregado"
  };

  return labels[raw] || status || "Pendiente";
}

function getSortedUserOrders(orders) {
  return [...orders].sort((a, b) => {
    const da = getOrderDateObject(a)?.getTime() || 0;
    const db = getOrderDateObject(b)?.getTime() || 0;
    return db - da;
  });
}

function orderMatchesUserSearch(order, searchText) {
  const query = String(searchText || "").trim().toLowerCase();

  if (!query) return true;

  const items = getOrderItems(order);

  const searchable = [
    order?.id,
    order?.restaurantName,
    order?.restaurantEmail,
    order?.status,
    getOrderRestaurantName(order),
    ...items.flatMap((item) => [
      item?.id,
      item?.name,
      item?.category
    ])
  ]
    .map((value) => String(value || "").toLowerCase())
    .join(" ");

  return searchable.includes(query);
}

function orderMatchesDateRange(order, fromValue, toValue) {
  const dateKey = getOrderDateKey(order);

  if (!dateKey && (fromValue || toValue)) return false;

  if (fromValue && dateKey < fromValue) return false;
  if (toValue && dateKey > toValue) return false;

  return true;
}

function filtrarPedidosUsuario() {
  const searchInput = document.getElementById("userOrderSearchInput");
  const fromInput = document.getElementById("userOrderDateFrom");
  const toInput = document.getElementById("userOrderDateTo");

  const searchText = searchInput?.value || "";
  const fromValue = fromInput?.value || "";
  const toValue = toInput?.value || "";

  selectedUserOrdersCache = selectedUserOrdersOriginalCache.filter((order) => {
    return (
      orderMatchesUserSearch(order, searchText) &&
      orderMatchesDateRange(order, fromValue, toValue)
    );
  });

  refrescarVistaPedidosUsuario();
}

function limpiarFiltrosUsuario() {
  const searchInput = document.getElementById("userOrderSearchInput");
  const fromInput = document.getElementById("userOrderDateFrom");
  const toInput = document.getElementById("userOrderDateTo");

  if (searchInput) searchInput.value = "";
  if (fromInput) fromInput.value = "";
  if (toInput) toInput.value = "";

  selectedUserOrdersCache = [...selectedUserOrdersOriginalCache];
  refrescarVistaPedidosUsuario();
}

function groupUserOrdersByDate(orders) {
  const grouped = {};

  orders.forEach((order) => {
    const key = getOrderDateKey(order) || "Sin fecha";

    if (!grouped[key]) {
      grouped[key] = {
        date: key,
        count: 0,
        total: 0
      };
    }

    grouped[key].count += 1;
    grouped[key].total += getOrderTotalSafe(order);
  });

  return Object.values(grouped).sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

function seleccionarDiaUsuario(dateKey) {
  const fromInput = document.getElementById("userOrderDateFrom");
  const toInput = document.getElementById("userOrderDateTo");

  if (!dateKey || dateKey === "Sin fecha") return;

  if (fromInput) fromInput.value = dateKey;
  if (toInput) toInput.value = dateKey;

  filtrarPedidosUsuario();
}

function renderUserPurchaseChart(orders) {
  const grouped = groupUserOrdersByDate(orders);

  if (!grouped.length) {
    return `<div class="empty-box">No hay datos para mostrar con estos filtros.</div>`;
  }

  return `
    <div class="user-day-grid">
      ${grouped.map((item) => `
        <button class="user-day-card" type="button" onclick="seleccionarDiaUsuario('${escapeHtml(item.date)}')">
          <span>${escapeHtml(item.date)}</span>
          <strong>${formatMoney(item.total)}</strong>
          <small>${item.count} compra(s). Toca para filtrar.</small>
        </button>
      `).join("")}
    </div>
  `;
}

function renderUserFilterPanel() {
  return `
    <section class="user-page-filters">
      <div class="user-page-filter-title">
        <div>
          <h4>Comportamiento de compra</h4>
          <p>Busca por ID de pedido, ID/nombre de producto, restaurante o estado. También puedes tocar un día.</p>
        </div>
      </div>

      <div class="user-page-filter-grid">
        <div class="user-page-field">
          <label>Buscar compra o producto</label>
          <input id="userOrderSearchInput" type="text" placeholder="Ej: DL-177, alitas, producto_123">
        </div>

        <div class="user-page-field">
          <label>Desde</label>
          <input id="userOrderDateFrom" type="date">
        </div>

        <div class="user-page-field">
          <label>Hasta</label>
          <input id="userOrderDateTo" type="date">
        </div>

        <div class="user-page-filter-actions">
          <button class="primary" type="button" onclick="filtrarPedidosUsuario()">Filtrar</button>
          <button class="light" type="button" onclick="limpiarFiltrosUsuario()">Limpiar</button>
        </div>
      </div>

      <div id="userPurchaseChartWrap">
        ${renderUserPurchaseChart(selectedUserOrdersCache)}
      </div>
    </section>
  `;
}

function renderUserOrdersList(orders) {
  if (!orders.length) {
    return `<div class="empty-box">No hay compras que coincidan con el filtro aplicado.</div>`;
  }

  return orders.map((order, index) => {
    const total = getOrderTotalSafe(order);
    const itemsCount = getOrderItemsCount(order);

    return `
      <article
        class="user-page-order-card ${index === 0 ? "active" : ""}"
        id="userOrderCard${index}"
        onclick="seleccionarPedidoUsuario(${index})"
      >
        <div class="user-page-order-top">
          <div>
            <div class="user-page-order-id">#${escapeHtml(order.id || "-")}</div>
            <div class="user-page-order-meta">${escapeHtml(getOrderRestaurantName(order))}</div>
          </div>

          <div class="user-page-order-total">${formatMoney(total)}</div>
        </div>

        <div class="user-page-order-meta">
          ${escapeHtml(getOrderDateText(order))}<br>
          ${itemsCount} producto(s)
        </div>

        <span class="user-page-status">${escapeHtml(getStatusLabelAdmin(order.status))}</span>
      </article>
    `;
  }).join("");
}

function renderSelectedUserOrderDetail(order) {
  const target = document.getElementById("selectedUserOrderDetail");

  if (!target) return;

  if (!order) {
    target.innerHTML = `
      <div class="user-page-empty">
        <div>
          <strong>Selecciona una compra</strong><br>
          Haz clic sobre un pedido para ver el detalle completo.
        </div>
      </div>
    `;
    return;
  }

  const total = getOrderTotalSafe(order);
  const items = getOrderItems(order);
  const address = order?.customer?.address || order?.address || "-";
  const phone = order?.customer?.phone || order?.phone || "-";
  const customerName = order?.customer?.fullName || order?.customer?.name || "-";
  const notes = order?.notes || "Sin notas";

  const itemsHtml = items.length
    ? items.map((item) => {
        const qty = Number(item?.qty || 0);
        const price = Number(item?.price || 0);
        const subtotal = Number(item?.subtotal || (qty * price));

        return `
          <div class="user-page-product-row">
            <div>
              <strong>${escapeHtml(item?.name || "Producto")}</strong><br>
              <small>ID: ${escapeHtml(item?.id || "-")} · Cantidad: ${qty} · Precio unitario: ${formatMoney(price)}</small>
            </div>
            <strong>${formatMoney(subtotal)}</strong>
          </div>
        `;
      }).join("")
    : `<div class="empty-box">Este pedido no tiene productos visibles.</div>`;

  target.innerHTML = `
    <div class="user-page-detail-title">
      <div>
        <h4>Pedido #${escapeHtml(order.id || "-")}</h4>
        <p>${escapeHtml(getOrderRestaurantName(order))} · ${escapeHtml(getStatusLabelAdmin(order.status))}</p>
      </div>

      <div class="user-page-total-pill">${formatMoney(total)}</div>
    </div>

    <div class="user-page-detail-grid">
      <div class="user-page-mini">
        <span>Fecha y hora</span>
        <strong>${escapeHtml(getOrderDateText(order))}</strong>
      </div>

      <div class="user-page-mini">
        <span>Hora</span>
        <strong>${escapeHtml(getOrderHourText(order))}</strong>
      </div>

      <div class="user-page-mini">
        <span>Productos</span>
        <strong>${getOrderItemsCount(order)}</strong>
      </div>

      <div class="user-page-mini">
        <span>Cliente</span>
        <strong>${escapeHtml(customerName)}</strong>
      </div>

      <div class="user-page-mini">
        <span>Teléfono</span>
        <strong>${escapeHtml(phone)}</strong>
      </div>

      <div class="user-page-mini">
        <span>Estado</span>
        <strong>${escapeHtml(getStatusLabelAdmin(order.status))}</strong>
      </div>
    </div>

    <div class="user-page-mini">
      <span>Dirección de entrega</span>
      <strong>${escapeHtml(address)}</strong>
    </div>

    <div class="user-page-mini" style="margin-top:10px;">
      <span>Notas del pedido</span>
      <strong>${escapeHtml(notes)}</strong>
    </div>

    <h4 class="order-detail-section-title">Productos comprados</h4>
    <div class="user-page-products">
      ${itemsHtml}
    </div>
  `;
}

function seleccionarPedidoUsuario(index) {
  const order = selectedUserOrdersCache[index];

  document.querySelectorAll(".user-page-order-card").forEach((card) => {
    card.classList.remove("active");
  });

  const selectedCard = document.getElementById(`userOrderCard${index}`);
  if (selectedCard) selectedCard.classList.add("active");

  renderSelectedUserOrderDetail(order);
}

function refrescarVistaPedidosUsuario() {
  const listWrap = document.getElementById("userOrdersListWrap");
  const chartWrap = document.getElementById("userPurchaseChartWrap");

  if (listWrap) {
    listWrap.innerHTML = renderUserOrdersList(selectedUserOrdersCache);
  }

  if (chartWrap) {
    chartWrap.innerHTML = renderUserPurchaseChart(selectedUserOrdersCache);
  }

  setTimeout(() => {
    renderSelectedUserOrderDetail(selectedUserOrdersCache[0] || null);
  }, 0);
}

function descargarPDFUsuario() {
  if (!selectedUserDataCache) {
    alert("No hay datos de usuario para exportar.");
    return;
  }

  if (!window.jspdf || !window.jspdf.jsPDF) {
    alert("No se pudo cargar la librería PDF. Revisa tu conexión a internet.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  const user = selectedUserDataCache;
  const orders = selectedUserOrdersOriginalCache;
  const totalSpent = getUserTotalSpent(orders);
  const deliveredOrders = orders.filter((order) => {
    return getStatusLabelAdmin(order.status).toLowerCase() === "entregado";
  }).length;

  let y = 16;

  doc.setFillColor(255, 77, 77);
  doc.roundedRect(10, y, 190, 18, 5, 5, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.text("Reporte de Cliente - DELI GO", 16, y + 12);

  y += 28;
  doc.setTextColor(17, 24, 39);
  doc.setFontSize(13);
  doc.text(`Cliente: ${user.fullName || "Usuario"}`, 10, y);
  y += 7;
  doc.setFontSize(10);
  doc.text(`Correo: ${user.email || "-"}`, 10, y);
  y += 6;
  doc.text(`Telefono: ${user.phone || "-"}`, 10, y);
  y += 6;
  doc.text(`Direccion: ${user.address || "-"}`, 10, y);

  y += 12;
  doc.setFontSize(11);
  doc.text(`Total gastado: ${formatMoney(totalSpent)}`, 10, y);
  y += 6;
  doc.text(`Compras totales: ${orders.length}`, 10, y);
  y += 6;
  doc.text(`Compras entregadas: ${deliveredOrders}`, 10, y);

  y += 12;
  doc.setFontSize(13);
  doc.text("Historial de compras", 10, y);
  y += 8;

  doc.setFontSize(9);

  orders.forEach((order, index) => {
    if (y > 270) {
      doc.addPage();
      y = 16;
    }

    const orderLine = `${index + 1}. Pedido #${order.id || "-"} | ${getOrderDateText(order)} | ${getOrderRestaurantName(order)} | ${formatMoney(getOrderTotalSafe(order))}`;
    doc.text(orderLine.slice(0, 110), 10, y);
    y += 5;

    const items = getOrderItems(order);

    items.forEach((item) => {
      if (y > 270) {
        doc.addPage();
        y = 16;
      }

      const qty = Number(item?.qty || 0);
      const price = Number(item?.price || 0);
      const subtotal = Number(item?.subtotal || qty * price);
      const itemLine = `   - ${item?.name || "Producto"} x${qty} | Unit: ${formatMoney(price)} | Subtotal: ${formatMoney(subtotal)}`;

      doc.text(itemLine.slice(0, 110), 12, y);
      y += 4;
    });

    y += 3;
  });

  const fileName = `reporte_cliente_${String(user.fullName || user.email || "usuario").replace(/[^a-z0-9]/gi, "_").toLowerCase()}.pdf`;
  doc.save(fileName);
}

function verDetalleUsuario(email) {
  const decodedEmail = decodeURIComponent(email || "");
  const user = adminData.users.find((item) => {
    return normalizeEmail(item.email) === normalizeEmail(decodedEmail);
  });

  if (!user) return;

  const orders = getSortedUserOrders(
    adminData.orders.filter((order) => {
      return getOrderCustomerEmail(order) === normalizeEmail(user.email);
    })
  );

  selectedUserEmailCache = user.email || "";
  selectedUserDataCache = user;
  selectedUserOrdersOriginalCache = orders;
  selectedUserOrdersCache = [...orders];

  const totalSpent = getUserTotalSpent(orders);
  const deliveredOrders = orders.filter((order) => {
    return getStatusLabelAdmin(order.status).toLowerCase() === "entregado";
  }).length;
  const lastOrder = getUserLastOrder(orders);
  const restaurantsCount = getUserRestaurantsCount(orders);

  const panel = document.getElementById("usuarioDetallePanel");
  if (!panel) return;

  panel.classList.remove("hidden");

  panel.innerHTML = `
    <div class="user-page-header">
      <div class="user-page-title">
        <h3>${escapeHtml(user.fullName || "Usuario")}</h3>
        <p>Ficha administrativa del cliente · historial, compras y comportamiento</p>
      </div>

      <div class="user-page-actions">
        <span class="user-detail-badge">${orders.length} compra(s)</span>
        <button class="user-page-btn dark" type="button" onclick="abrirEditorUsuario('${encodeURIComponent(user.id || user.email || "")}')">Editar datos</button>
        <button class="user-page-btn dark" type="button" onclick="abrirEditorUsuario('${encodeURIComponent(user.id || user.email || "")}')">Editar datos</button>
        <button class="user-page-btn dark" type="button" onclick="descargarPDFUsuario()">Descargar PDF</button>
        <button class="user-page-btn light" type="button" onclick="cerrarDetalleUsuario()">Cerrar detalle</button>
      </div>
    </div>

    <div class="user-page-body">
      <div class="user-page-summary">
        <div class="user-page-card">
          <span>Total gastado</span>
          <strong>${formatMoney(totalSpent)}</strong>
        </div>

        <div class="user-page-card">
          <span>Compras</span>
          <strong>${orders.length}</strong>
        </div>

        <div class="user-page-card">
          <span>Entregadas</span>
          <strong>${deliveredOrders}</strong>
        </div>

        <div class="user-page-card">
          <span>Restaurantes usados</span>
          <strong>${restaurantsCount}</strong>
        </div>
      </div>

      <div class="user-page-info">
        <div class="user-page-info-item">
          <span>Correo</span>
          <strong>${escapeHtml(user.email || "-")}</strong>
        </div>

        <div class="user-page-info-item">
          <span>Teléfono</span>
          <strong>${escapeHtml(user.phone || "-")}</strong>
        </div>

        <div class="user-page-info-item">
          <span>Dirección principal</span>
          <strong>${escapeHtml(user.address || "-")}</strong>
        </div>

        <div class="user-page-info-item">
          <span>Última compra</span>
          <strong>${lastOrder ? escapeHtml(getOrderDateText(lastOrder)) : "-"}</strong>
        </div>
      </div>

      ${renderUserFilterPanel()}

      <div class="user-page-layout">
        <section class="user-page-orders">
          <div class="user-page-panel-head">
            <h4>Compras del cliente</h4>
            <p>Selecciona una compra para revisar el detalle.</p>
          </div>

          <div class="user-page-orders-list" id="userOrdersListWrap">
            ${renderUserOrdersList(selectedUserOrdersCache)}
          </div>
        </section>

        <section class="user-page-order-detail">
          <div class="user-page-panel-head">
            <h4>Detalle de compra</h4>
            <p>Productos, hora, dirección, teléfono y estado.</p>
          </div>

          <div class="user-page-detail-content" id="selectedUserOrderDetail"></div>
        </section>
      </div>
    </div>
  `;

  setTimeout(() => {
    renderSelectedUserOrderDetail(selectedUserOrdersCache[0] || null);
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 0);
}

/* =====================================================
   EVENTO CLICK USUARIOS (SEGURO)
====================================================== */
function activarClickUsuarios() {
  const rows = document.querySelectorAll("#usuariosList tbody tr");

  rows.forEach((row, index) => {
    const user = adminData.users[index];
    if (!user) return;

    if (row.dataset.userClickReady === "true") return;

    row.dataset.userClickReady = "true";
    row.classList.add("admin-clickable-row");

    row.addEventListener("click", (event) => {
      if (event.target.closest("button, a, input, select, textarea")) return;
      verDetalleUsuario(encodeURIComponent(user.email || ""));
    });
  });
}

/* =====================================================
   EXPORTS EDICIÓN ADMINISTRATIVA
====================================================== */
window.abrirEditorUsuario = abrirEditorUsuario;
window.guardarEdicionUsuario = guardarEdicionUsuario;
window.abrirEditorRestaurante = abrirEditorRestaurante;
window.guardarEdicionRestaurante = guardarEdicionRestaurante;
window.cerrarEditorAdmin = cerrarEditorAdmin;
window.setAdminEditFieldsEnabled = setAdminEditFieldsEnabled;
window.cerrarDetalleRestaurante = cerrarDetalleRestaurante;
window.verDetalleRestaurante = verDetalleRestaurante;

// FIN administrador.js corregido sobre administrador(12).js - vista integrada















































































