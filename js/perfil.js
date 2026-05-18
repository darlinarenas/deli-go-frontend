/* =========================================================
   BHUZ - PERFIL.JS
   Archivo completo listo para copiar y pegar

   OBJETIVO DE ESTE PASO:
   - Crear la lógica real de perfil del cliente.
   - Cargar usuario actual desde auth.js / sesión temporal.
   - Cargar direcciones guardadas desde backend/PostgreSQL.
   - Crear nuevas direcciones usando endpoints existentes.
   - Editar direcciones usando endpoint PUT si está disponible en backend.
   - Marcar dirección principal usando endpoints existentes.
   - Eliminar direcciones usando endpoints existentes con confirmación segura.

   IMPORTANTE:
   - NO crea tablas.
   - NO toca backend.
   - NO toca pedidos.
   - NO toca checkout.
   - NO usa localStorage como fuente de negocio.
   - PostgreSQL sigue siendo la fuente real mediante el backend.
========================================================= */

(function initBhuzPerfil() {
  "use strict";

  /* =========================================================
     CONFIGURACIÓN BACKEND
     - Usa la misma URL real que ya usa el frontend.
     - Si más adelante existe window.DELI_API_URL, la respeta.
  ========================================================= */
  const API_URL = window.DELI_API_URL || "https://deligo-backend-i554.onrender.com";

  /* =========================================================
     ELEMENTOS DOM
  ========================================================= */
  const profileGreeting = document.getElementById("profileGreeting");
  const profileStatusPill = document.getElementById("profileStatusPill");
  const profileAddressCount = document.getElementById("profileAddressCount");
  const profileDefaultAddress = document.getElementById("profileDefaultAddress");

  const profileForm = document.getElementById("profileForm");
  const profileNameInput = document.getElementById("profileName");
  const profilePhoneInput = document.getElementById("profilePhone");
  const profileEmailInput = document.getElementById("profileEmail");
  const saveProfileBtn = document.getElementById("saveProfileBtn");
  const profileMessage = document.getElementById("profileMessage");

  const addressesList = document.getElementById("addressesList");
  const addressesEmptyState = document.getElementById("addressesEmptyState");

  const addressForm = document.getElementById("addressForm");
  const addressLabelInput = document.getElementById("addressLabel");
  const addressTextInput = document.getElementById("addressText");
  const addressReferenceInput = document.getElementById("addressReference");
  const captureGpsBtn = document.getElementById("captureGpsBtn");
  const gpsStatus = document.getElementById("gpsStatus");
  const addressLatitudeInput = document.getElementById("addressLatitude");
  const addressLongitudeInput = document.getElementById("addressLongitude");
  const addressDefaultInput = document.getElementById("addressDefault");
  const saveAddressBtn = document.getElementById("saveAddressBtn");
  const addressMessage = document.getElementById("addressMessage");

  let cancelEditAddressBtn = document.getElementById("cancelEditAddressBtn");

  /* =========================================================
     ESTADO INTERNO DE ESTA PÁGINA
  ========================================================= */
  let currentUser = null;
  let userAddresses = [];
  let capturedGpsLocation = null;
  let isSavingAddress = false;
  let isLoadingAddresses = false;
  let editingAddressId = null;

  /* =========================================================
     HELPERS GENERALES
  ========================================================= */
  function safeText(value) {
    return String(value || "").trim();
  }

  function normalizeEmail(email) {
    return safeText(email).toLowerCase();
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function setMessage(element, message, type) {
    if (!element) return;

    const finalType = type || "info";
    element.textContent = message || "";
    element.classList.remove("is-ok", "is-error", "is-info");

    if (!message) return;

    if (finalType === "ok") {
      element.classList.add("is-ok");
      return;
    }

    if (finalType === "error") {
      element.classList.add("is-error");
      return;
    }

    element.classList.add("is-info");
  }

  function setProfileMessage(message, type) {
    setMessage(profileMessage, message, type);
  }

  function setAddressMessage(message, type) {
    setMessage(addressMessage, message, type);
  }

  function setGpsStatus(message, isOk) {
    if (!gpsStatus) return;

    gpsStatus.textContent = message || "";
    gpsStatus.classList.toggle("is-ok", Boolean(isOk));
    gpsStatus.classList.toggle("is-error", Boolean(message && !isOk));
  }

  function setButtonLoading(button, isLoading, loadingText, normalText) {
    if (!button) return;

    button.disabled = Boolean(isLoading);
    button.textContent = isLoading ? loadingText : normalText;
  }

  function ensureEditControls() {
    if (!saveAddressBtn || cancelEditAddressBtn) return;

    cancelEditAddressBtn = document.createElement("button");
    cancelEditAddressBtn.id = "cancelEditAddressBtn";
    cancelEditAddressBtn.type = "button";
    cancelEditAddressBtn.className = "profile-btn secondary";
    cancelEditAddressBtn.textContent = "Cancelar edición";
    cancelEditAddressBtn.style.display = "none";

    saveAddressBtn.insertAdjacentElement("afterend", cancelEditAddressBtn);
  }

  function setAddressEditMode(address) {
    editingAddressId = address ? getAddressId(address) : null;

    if (saveAddressBtn) {
      saveAddressBtn.textContent = editingAddressId ? "Guardar cambios" : "Guardar dirección";
    }

    if (cancelEditAddressBtn) {
      cancelEditAddressBtn.style.display = editingAddressId ? "inline-flex" : "none";
    }

    if (!addressForm) return;

    addressForm.classList.toggle("is-editing", Boolean(editingAddressId));
  }

  function getCurrentUserSafe() {
    if (typeof getCurrentUser === "function") {
      return getCurrentUser() || null;
    }

    if (window.DELI_CURRENT_USER) {
      return window.DELI_CURRENT_USER;
    }

    return null;
  }

  function waitForSessionReady() {
    return new Promise((resolve) => {
      if (window.DELI_SESSION_READY || typeof getCurrentUser === "function") {
        resolve(getCurrentUserSafe());
        return;
      }

      const timeoutId = setTimeout(() => {
        resolve(getCurrentUserSafe());
      }, 1600);

      window.addEventListener(
        "deli:session-ready",
        () => {
          clearTimeout(timeoutId);
          resolve(getCurrentUserSafe());
        },
        { once: true }
      );
    });
  }

  function getUserDisplayName(user) {
    return safeText(user?.fullName || user?.name || user?.nombre || "Usuario");
  }

  function getUserPhone(user) {
    return safeText(user?.phone || user?.telefono || user?.customerPhone || "");
  }

  function getUserEmail(user) {
    return normalizeEmail(user?.email || user?.correo || user?.userEmail || "");
  }

  function getAddressId(address) {
    return safeText(address?.id || address?.addressId || address?._id || "");
  }

  function getAddressLabel(address) {
    return safeText(address?.label || address?.alias || "Casa");
  }

  function getAddressText(address) {
    return safeText(address?.address || address?.deliveryAddress || "");
  }

  function getAddressReference(address) {
    return safeText(address?.reference || address?.deliveryReference || "");
  }

  function getAddressLatitude(address) {
    return safeText(address?.latitude || address?.lat || address?.location?.lat || "");
  }

  function getAddressLongitude(address) {
    return safeText(address?.longitude || address?.lng || address?.location?.lng || "");
  }

  function isDefaultAddress(address) {
    return Boolean(address?.isDefault || address?.is_default);
  }

  function updateSummary() {
    const total = userAddresses.length;
    const defaultAddress = userAddresses.find(isDefaultAddress) || userAddresses[0] || null;

    if (profileAddressCount) {
      profileAddressCount.textContent = String(total);
    }

    if (profileDefaultAddress) {
      profileDefaultAddress.textContent = defaultAddress ? getAddressLabel(defaultAddress) : "—";
    }

    if (profileStatusPill) {
      if (!currentUser) {
        profileStatusPill.textContent = "Sesión requerida";
        profileStatusPill.classList.remove("is-ok");
        return;
      }

      if (total > 0 && defaultAddress) {
        profileStatusPill.textContent = "GPS activo";
        profileStatusPill.classList.add("is-ok");
        return;
      }

      profileStatusPill.textContent = "GPS requerido";
      profileStatusPill.classList.remove("is-ok");
    }
  }

  function fillProfileForm(user) {
    const displayName = getUserDisplayName(user);
    const phone = getUserPhone(user);
    const email = getUserEmail(user);

    if (profileGreeting) {
      profileGreeting.textContent = user ? `Hola, ${displayName} 👋` : "Hola 👋";
    }

    if (profileNameInput) {
      profileNameInput.value = displayName === "Usuario" ? "" : displayName;
    }

    if (profilePhoneInput) {
      profilePhoneInput.value = phone;
    }

    if (profileEmailInput) {
      profileEmailInput.value = email;
    }
  }

  function renderLoggedOutState() {
    fillProfileForm(null);
    userAddresses = [];
    updateSummary();

    if (addressesList) {
      addressesList.innerHTML = `
        <div class="address-empty">
          Debes iniciar sesión para ver y guardar tus direcciones.
          <br><br>
          <a class="profile-btn primary" href="index.html">Ir al inicio e iniciar sesión</a>
        </div>
      `;
    }

    if (profileForm) {
      profileForm.classList.add("is-disabled");
    }

    if (addressForm) {
      addressForm.classList.add("is-disabled");
    }

    setProfileMessage("Inicia sesión para administrar tu perfil.", "info");
    setAddressMessage("Inicia sesión para guardar direcciones.", "info");
  }

  function renderAddressCard(address) {
    const id = getAddressId(address);
    const label = getAddressLabel(address);
    const text = getAddressText(address);
    const reference = getAddressReference(address);
    const latitude = getAddressLatitude(address);
    const longitude = getAddressLongitude(address);
    const isDefault = isDefaultAddress(address);

    return `
      <article class="address-card${isDefault ? " is-default" : ""}" data-address-id="${escapeHtml(id)}">
        <div class="address-card-head">
          <div>
            <strong>${escapeHtml(label)}</strong>
            ${isDefault ? '<span class="default-badge">Principal</span>' : ""}
          </div>
          <span class="gps-mini-badge">📍 GPS</span>
        </div>

        <p class="address-text">${escapeHtml(text)}</p>
        <p class="address-reference"><strong>Referencia:</strong> ${escapeHtml(reference)}</p>

        <div class="address-gps-line">
          <span>Lat: ${escapeHtml(latitude || "—")}</span>
          <span>Lng: ${escapeHtml(longitude || "—")}</span>
        </div>

        <div class="address-card-actions">
          ${!isDefault ? `<button type="button" class="profile-btn primary js-set-default-address" data-address-id="${escapeHtml(id)}">Usar esta dirección</button>` : `<button type="button" class="profile-btn secondary" disabled>Dirección en uso</button>`}
          <button type="button" class="profile-btn secondary js-edit-address" data-address-id="${escapeHtml(id)}">Editar</button>
          <button type="button" class="profile-btn danger js-delete-address" data-address-id="${escapeHtml(id)}">Eliminar</button>
        </div>
      </article>
    `;
  }

  function renderAddresses() {
    updateSummary();

    if (!addressesList) return;

    if (isLoadingAddresses) {
      addressesList.innerHTML = `
        <div class="address-empty">
          Cargando direcciones guardadas...
        </div>
      `;
      return;
    }

    if (!userAddresses.length) {
      addressesList.innerHTML = `
        <div class="address-empty" id="addressesEmptyState">
          No tienes direcciones guardadas todavía. Agrega una dirección con referencia y GPS para poder pedir más rápido.
        </div>
      `;
      return;
    }

    addressesList.innerHTML = userAddresses.map(renderAddressCard).join("");
  }

  async function fetchJson(url, options) {
    const response = await fetch(url, {
      cache: "no-store",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      },
      ...(options || {})
    });

    let data = null;

    try {
      data = await response.json();
    } catch (error) {
      data = null;
    }

    if (!response.ok) {
      const message = data?.message || data?.error || "No se pudo completar la solicitud";
      throw new Error(message);
    }

    return data;
  }

  async function loadUserFromBackend(email) {
    if (!email) return null;

    try {
      const data = await fetchJson(`${API_URL}/users/${encodeURIComponent(email)}?t=${Date.now()}`);
      return data?.user || null;
    } catch (error) {
      console.warn("No se pudo refrescar usuario desde backend:", error.message);
      return null;
    }
  }

  async function loadAddresses() {
    const email = getUserEmail(currentUser);

    if (!email) {
      renderLoggedOutState();
      return;
    }

    isLoadingAddresses = true;
    renderAddresses();

    try {
      const data = await fetchJson(`${API_URL}/users/${encodeURIComponent(email)}/addresses?t=${Date.now()}`);
      userAddresses = Array.isArray(data?.addresses) ? data.addresses : [];
      setAddressMessage("Direcciones cargadas correctamente.", "ok");
    } catch (error) {
      console.error("Error cargando direcciones BHUZ:", error);
      userAddresses = [];
      setAddressMessage(error.message || "No se pudieron cargar tus direcciones.", "error");
    } finally {
      isLoadingAddresses = false;
      renderAddresses();
    }
  }

  function resetAddressForm() {
    if (addressForm) addressForm.reset();
    if (addressLatitudeInput) addressLatitudeInput.value = "";
    if (addressLongitudeInput) addressLongitudeInput.value = "";

    capturedGpsLocation = null;
    setAddressEditMode(null);
    setGpsStatus("GPS pendiente. Debes capturar ubicación antes de guardar.", false);

    if (captureGpsBtn) {
      captureGpsBtn.disabled = false;
      captureGpsBtn.textContent = "📍 Usar mi ubicación actual";
    }
  }

  function captureGpsLocation() {
    if (!navigator.geolocation) {
      capturedGpsLocation = null;
      setGpsStatus("Tu navegador no permite capturar ubicación GPS.", false);
      return;
    }

    if (captureGpsBtn) {
      captureGpsBtn.disabled = true;
      captureGpsBtn.textContent = "📍 Obteniendo ubicación...";
    }

    setGpsStatus("Acepta el permiso de ubicación para guardar esta dirección.", false);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        capturedGpsLocation = {
          lat: String(position.coords.latitude),
          lng: String(position.coords.longitude)
        };

        if (addressLatitudeInput) addressLatitudeInput.value = capturedGpsLocation.lat;
        if (addressLongitudeInput) addressLongitudeInput.value = capturedGpsLocation.lng;

        if (captureGpsBtn) {
          captureGpsBtn.disabled = false;
          captureGpsBtn.textContent = "✅ Ubicación capturada";
        }

        setGpsStatus("Ubicación GPS capturada correctamente.", true);
      },
      (error) => {
        capturedGpsLocation = null;

        if (addressLatitudeInput) addressLatitudeInput.value = "";
        if (addressLongitudeInput) addressLongitudeInput.value = "";

        if (captureGpsBtn) {
          captureGpsBtn.disabled = false;
          captureGpsBtn.textContent = "📍 Usar mi ubicación actual";
        }

        let message = "No se pudo capturar la ubicación. Debes permitir el GPS para guardar la dirección.";

        if (error && error.code === 1) {
          message = "Permiso de ubicación rechazado. Activa el GPS para guardar esta dirección.";
        }

        if (error && error.code === 2) {
          message = "No se pudo detectar tu ubicación. Revisa la señal o el GPS del teléfono.";
        }

        if (error && error.code === 3) {
          message = "La ubicación tardó demasiado. Intenta de nuevo.";
        }

        setGpsStatus(message, false);
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0
      }
    );
  }

  function startEditAddress(addressId) {
    const address = userAddresses.find((item) => getAddressId(item) === safeText(addressId));

    if (!address) {
      setAddressMessage("No se encontró la dirección que quieres editar.", "error");
      return;
    }

    setAddressEditMode(address);

    if (addressLabelInput) addressLabelInput.value = getAddressLabel(address);
    if (addressTextInput) addressTextInput.value = getAddressText(address);
    if (addressReferenceInput) addressReferenceInput.value = getAddressReference(address);
    if (addressLatitudeInput) addressLatitudeInput.value = getAddressLatitude(address);
    if (addressLongitudeInput) addressLongitudeInput.value = getAddressLongitude(address);
    if (addressDefaultInput) addressDefaultInput.checked = isDefaultAddress(address);

    capturedGpsLocation = {
      lat: getAddressLatitude(address),
      lng: getAddressLongitude(address)
    };

    if (capturedGpsLocation.lat && capturedGpsLocation.lng) {
      setGpsStatus("GPS cargado desde esta dirección. Puedes capturarlo de nuevo si cambiaste de ubicación.", true);
    } else {
      setGpsStatus("Esta dirección no tiene GPS. Captura ubicación antes de guardar cambios.", false);
    }

    setAddressMessage("Modo edición activo. Cambia los datos y presiona Guardar cambios.", "info");

    if (addressForm) {
      addressForm.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  async function saveAddress(event) {
    if (event) event.preventDefault();
    if (isSavingAddress) return;

    const email = getUserEmail(currentUser);

    if (!email) {
      setAddressMessage("Debes iniciar sesión para guardar direcciones.", "error");
      return;
    }

    const label = safeText(addressLabelInput?.value);
    const address = safeText(addressTextInput?.value);
    const reference = safeText(addressReferenceInput?.value);
    const latitude = safeText(addressLatitudeInput?.value || capturedGpsLocation?.lat);
    const longitude = safeText(addressLongitudeInput?.value || capturedGpsLocation?.lng);
    const isDefault = Boolean(addressDefaultInput?.checked) || userAddresses.length === 0;

    if (!label) {
      setAddressMessage("Escribe un alias para esta dirección. Ejemplo: Casa, Trabajo, Mamá, Oficina.", "error");
      addressLabelInput?.focus();
      return;
    }

    if (!address) {
      setAddressMessage("Escribe la dirección antes de guardar.", "error");
      addressTextInput?.focus();
      return;
    }

    if (!reference) {
      setAddressMessage("La referencia es obligatoria para evitar errores de entrega.", "error");
      addressReferenceInput?.focus();
      return;
    }

    if (!latitude || !longitude) {
      setAddressMessage("Debes capturar la ubicación GPS antes de guardar.", "error");
      return;
    }

    const isEditing = Boolean(editingAddressId);
    const normalButtonText = isEditing ? "Guardar cambios" : "Guardar dirección";

    isSavingAddress = true;
    setButtonLoading(saveAddressBtn, true, isEditing ? "Guardando cambios..." : "Guardando dirección...", normalButtonText);
    setAddressMessage(isEditing ? "Actualizando dirección en backend/PostgreSQL..." : "Guardando dirección en backend/PostgreSQL...", "info");

    try {
      const payload = {
        label,
        address,
        reference,
        latitude,
        longitude,
        location: {
          lat: latitude,
          lng: longitude
        },
        isDefault
      };

      if (isEditing) {
        await fetchJson(`${API_URL}/users/${encodeURIComponent(email)}/addresses/${encodeURIComponent(editingAddressId)}`, {
          method: "PUT",
          body: JSON.stringify(payload)
        });

        setAddressMessage("Dirección actualizada correctamente.", "ok");
      } else {
        await fetchJson(`${API_URL}/users/${encodeURIComponent(email)}/addresses`, {
          method: "POST",
          body: JSON.stringify(payload)
        });

        setAddressMessage("Dirección guardada correctamente.", "ok");
      }

      resetAddressForm();
      await loadAddresses();
    } catch (error) {
      console.error("Error guardando dirección BHUZ:", error);
      setAddressMessage(
        error.message || (isEditing ? "No se pudo actualizar la dirección." : "No se pudo guardar la dirección."),
        "error"
      );
    } finally {
      isSavingAddress = false;
      setButtonLoading(saveAddressBtn, false, isEditing ? "Guardando cambios..." : "Guardando dirección...", normalButtonText);
      if (saveAddressBtn) saveAddressBtn.textContent = editingAddressId ? "Guardar cambios" : "Guardar dirección";
    }
  }

  async function setDefaultAddress(addressId) {
    const email = getUserEmail(currentUser);

    if (!email || !addressId) return;

    setAddressMessage("Usando esta dirección como principal...", "info");

    try {
      await fetchJson(`${API_URL}/users/${encodeURIComponent(email)}/addresses/${encodeURIComponent(addressId)}/default`, {
        method: "PUT"
      });

      setAddressMessage("Esta dirección quedó como principal para tus próximos pedidos.", "ok");
      await loadAddresses();
    } catch (error) {
      console.error("Error marcando dirección principal:", error);
      setAddressMessage(error.message || "No se pudo marcar la dirección principal.", "error");
    }
  }

  async function deleteAddress(addressId) {
    const email = getUserEmail(currentUser);

    if (!email || !addressId) return;

    const confirmed = window.confirm("¿Estás seguro de que deseas eliminar esta dirección?\n\nEsta acción no se puede deshacer. Si eliminas esta dirección, tendrás que crearla nuevamente con su referencia y GPS.");
    if (!confirmed) return;

    setAddressMessage("Eliminando dirección...", "info");

    try {
      await fetchJson(`${API_URL}/users/${encodeURIComponent(email)}/addresses/${encodeURIComponent(addressId)}`, {
        method: "DELETE"
      });

      setAddressMessage("Dirección eliminada correctamente.", "ok");
      await loadAddresses();
    } catch (error) {
      console.error("Error eliminando dirección:", error);
      setAddressMessage(error.message || "No se pudo eliminar la dirección.", "error");
    }
  }

  async function handleProfileSubmit(event) {
    if (event) event.preventDefault();

    /*
      IMPORTANTE:
      En el backend actual del proyecto sí existe GET /users/:email,
      pero no se confirmó una ruta segura PUT /users/:email para editar datos.
      Por eso este paso NO inventa endpoint ni toca backend.
      La edición real de nombre/teléfono queda para el siguiente paso si se decide crear
      o confirmar una ruta existente.
    */
    setProfileMessage(
      "Datos visibles cargados. La edición real de nombre/teléfono necesita confirmar o crear endpoint seguro en backend.",
      "info"
    );
  }

  function bindEvents() {
    if (profileForm) {
      profileForm.addEventListener("submit", handleProfileSubmit);
    }

    if (captureGpsBtn) {
      captureGpsBtn.addEventListener("click", captureGpsLocation);
    }

    if (addressForm) {
      addressForm.addEventListener("submit", saveAddress);
    }

    if (cancelEditAddressBtn) {
      cancelEditAddressBtn.addEventListener("click", () => {
        resetAddressForm();
        setAddressMessage("Edición cancelada. No se guardaron cambios.", "info");
      });
    }

    if (addressesList) {
      addressesList.addEventListener("click", (event) => {
        const defaultButton = event.target.closest(".js-set-default-address");
        const editButton = event.target.closest(".js-edit-address");
        const deleteButton = event.target.closest(".js-delete-address");

        if (defaultButton) {
          event.preventDefault();
          setDefaultAddress(defaultButton.dataset.addressId || "");
          return;
        }

        if (editButton) {
          event.preventDefault();
          startEditAddress(editButton.dataset.addressId || "");
          return;
        }

        if (deleteButton) {
          event.preventDefault();
          deleteAddress(deleteButton.dataset.addressId || "");
        }
      });
    }
  }

  async function init() {
    ensureEditControls();
    bindEvents();
    setGpsStatus("GPS pendiente. Debes capturar ubicación antes de guardar.", false);

    currentUser = await waitForSessionReady();

    if (!currentUser) {
      renderLoggedOutState();
      return;
    }

    const email = getUserEmail(currentUser);

    if (!email) {
      renderLoggedOutState();
      return;
    }

    const backendUser = await loadUserFromBackend(email);

    if (backendUser) {
      currentUser = {
        ...currentUser,
        ...backendUser
      };
    }

    fillProfileForm(currentUser);
    updateSummary();
    setProfileMessage("Perfil cargado correctamente.", "ok");

    await loadAddresses();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

