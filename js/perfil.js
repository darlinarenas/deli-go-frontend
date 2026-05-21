
(function initBhuzPerfil() {
  "use strict";

  /* =========================================================
     CONFIGURACIÓN BACKEND
     - Usa la misma URL real que ya usa el frontend.
     - Si más adelante existe window.DELI_API_URL, la respeta.
  ========================================================= */
  const API_URL = window.DELI_API_URL || "https://deligo-backend-i554.onrender.com";
  const profileParams = new URLSearchParams(window.location.search || "");
  const checkoutReturnUrl = profileParams.get("returnTo") || "";
  const cameFromCheckout = profileParams.get("from") === "checkout" && Boolean(checkoutReturnUrl);

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
  const profileCurrentPasswordInput = document.getElementById("profileCurrentPassword");
  const profileNewPasswordInput = document.getElementById("profileNewPassword");
  const profileConfirmPasswordInput = document.getElementById("profileConfirmPassword");
  const editProfileBtn = document.getElementById("editProfileBtn");
  const saveProfileBtn = document.getElementById("saveProfileBtn");
  const cancelProfileEditBtn = document.getElementById("cancelProfileEditBtn");
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
  const openAddressFormBtn = document.getElementById("openAddressFormBtn");
  const addressFormSection = document.getElementById("nuevaDireccion");
  const addressFormTitle = document.getElementById("addressFormTitle");

  let cancelEditAddressBtn = document.getElementById("cancelEditAddressBtn");

  /* =========================================================
     ESTADO INTERNO DE ESTA PÁGINA
  ========================================================= */
  let currentUser = null;
  let userAddresses = [];
  let capturedGpsLocation = null;
  let isSavingAddress = false;
  let isSavingProfile = false;
  let isProfileEditEnabled = false;
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

  function showAddressForm(mode) {
    if (addressFormSection) {
      addressFormSection.classList.add("is-visible");
      addressFormSection.style.display = "block";
    }

    if (addressFormTitle) {
      addressFormTitle.textContent = mode === "edit" ? "Editar dirección guardada" : "Agregar dirección guardada";
    }

    if (openAddressFormBtn) {
      openAddressFormBtn.textContent = mode === "edit" ? "Editando dirección" : "Formulario abierto";
      openAddressFormBtn.disabled = mode === "edit";
    }

    if (addressFormSection) {
      setTimeout(() => {
        addressFormSection.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
    }
  }

  function hideAddressForm() {
    if (addressFormSection) {
      addressFormSection.classList.remove("is-visible");
      addressFormSection.style.display = "none";
    }

    if (addressFormTitle) {
      addressFormTitle.textContent = "Agregar dirección guardada";
    }

    if (openAddressFormBtn) {
      openAddressFormBtn.disabled = false;
      openAddressFormBtn.textContent = "＋ Agregar nueva dirección";
    }
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

  function isSafeReturnUrl(url) {
    const value = safeText(url);
    if (!value) return false;
    if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("//")) return false;
    return value.includes("restaurant.html");
  }

  function returnToCheckoutAfterSelectingAddress(addressId) {
    if (!cameFromCheckout || !isSafeReturnUrl(checkoutReturnUrl)) return false;

    try {
      sessionStorage.setItem("bhuzSelectedCheckoutAddressId", String(addressId || ""));
    } catch (error) {
      console.warn("No se pudo guardar temporalmente la dirección seleccionada:", error);
    }

    setAddressMessage("Dirección seleccionada. Volviendo al checkout para confirmar tu pedido...", "ok");

    setTimeout(() => {
      window.location.href = checkoutReturnUrl;
    }, 650);

    return true;
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

  function setProfileEditMode(enabled, options) {
    const hasUser = Boolean(currentUser || options?.user);
    isProfileEditEnabled = Boolean(enabled && hasUser);

    if (profileForm) {
      profileForm.classList.toggle("is-editing", isProfileEditEnabled);
    }

    if (profileNameInput) {
      profileNameInput.disabled = !isProfileEditEnabled;
    }

    if (profilePhoneInput) {
      profilePhoneInput.disabled = !isProfileEditEnabled;
    }

    if (profileEmailInput) {
      profileEmailInput.disabled = true;
    }

    if (profileCurrentPasswordInput) {
      profileCurrentPasswordInput.disabled = !isProfileEditEnabled;
    }

    if (profileNewPasswordInput) {
      profileNewPasswordInput.disabled = !isProfileEditEnabled;
    }

    if (profileConfirmPasswordInput) {
      profileConfirmPasswordInput.disabled = !isProfileEditEnabled;
    }

    if (editProfileBtn) {
      editProfileBtn.style.display = hasUser && !isProfileEditEnabled ? "inline-flex" : "none";
      editProfileBtn.disabled = !hasUser || isSavingProfile;
    }

    if (saveProfileBtn) {
      saveProfileBtn.style.display = hasUser && isProfileEditEnabled ? "inline-flex" : "none";
      saveProfileBtn.disabled = !hasUser || !isProfileEditEnabled || isSavingProfile;
      saveProfileBtn.textContent = "Guardar cambios";
    }

    if (cancelProfileEditBtn) {
      cancelProfileEditBtn.style.display = hasUser && isProfileEditEnabled ? "inline-flex" : "none";
      cancelProfileEditBtn.disabled = isSavingProfile;
    }
  }

  function enableProfileEditing() {
    if (!currentUser) {
      setProfileMessage("Debes iniciar sesión para editar tu perfil.", "error");
      return;
    }

    const confirmed = window.confirm(
      "¿Quieres editar tu perfil?\n\nLos cambios guardados quedarán activos en tu cuenta."
    );

    if (!confirmed) return;

    setProfileEditMode(true);
    setProfileMessage("Edición activada. Guarda solo cuando estés seguro.", "info");
    profileNameInput?.focus();
  }

  function cancelProfileEditing() {
    fillProfileForm(currentUser);
    setProfileEditMode(false);
    setProfileMessage("Edición cancelada. No se guardaron cambios.", "info");
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

    if (profileCurrentPasswordInput) {
      profileCurrentPasswordInput.value = "";
    }

    if (profileNewPasswordInput) {
      profileNewPasswordInput.value = "";
    }

    if (profileConfirmPasswordInput) {
      profileConfirmPasswordInput.value = "";
    }

    setProfileEditMode(false, { user });
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
    const useButtonText = cameFromCheckout ? "Usar esta dirección y volver al checkout" : "Usar esta dirección";

    return `
      <article class="address-card${isDefault ? " is-default" : ""}" data-address-id="${escapeHtml(id)}">
        <div class="address-card-head">
          <div>
            <strong>${escapeHtml(label)}</strong>
            ${isDefault ? '<span class="default-badge">Principal</span>' : ""}
          </div>
          <span class="gps-mini-badge">📍 GPS guardado</span>
        </div>

        <p class="address-text">${escapeHtml(text)}</p>
        <p class="address-reference"><strong>Referencia:</strong> ${escapeHtml(reference)}</p>

        <div class="address-gps-line" aria-hidden="true">
          <span>Lat: ${escapeHtml(latitude || "—")}</span>
          <span>Lng: ${escapeHtml(longitude || "—")}</span>
        </div>

        <div class="address-card-actions">
          <button type="button" class="profile-btn primary js-set-default-address" data-address-id="${escapeHtml(id)}">${escapeHtml(useButtonText)}</button>
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
    hideAddressForm();
    setGpsStatus("GPS pendiente. Debes capturar ubicación antes de guardar.", false);

    if (captureGpsBtn) {
      captureGpsBtn.disabled = false;
      captureGpsBtn.textContent = "📍 Usar mi ubicación actual";
    }
  }

  function prepareNewAddressForm() {
    if (addressForm) addressForm.reset();
    if (addressLatitudeInput) addressLatitudeInput.value = "";
    if (addressLongitudeInput) addressLongitudeInput.value = "";
    if (addressDefaultInput) addressDefaultInput.checked = userAddresses.length === 0;

    capturedGpsLocation = null;
    setAddressEditMode(null);
    setGpsStatus("GPS pendiente. Debes capturar ubicación antes de guardar.", false);
    setAddressMessage("Completa la dirección, referencia y GPS para guardarla.", "info");
    showAddressForm("new");

    if (addressLabelInput) addressLabelInput.focus();
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

    showAddressForm("edit");
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
        /* =========================================================
           CAMBIO BHUZ - EDICIÓN SEGURA DE DIRECCIONES
           - Primero intenta editar con PUT si el backend lo soporta.
           - Si el backend actual todavía no tiene PUT para direcciones,
             hace un reemplazo seguro: crea la dirección corregida y luego
             elimina la anterior.
           - No crea rutas nuevas ni toca backend.
        ========================================================= */
        try {
          await fetchJson(`${API_URL}/users/${encodeURIComponent(email)}/addresses/${encodeURIComponent(editingAddressId)}`, {
            method: "PUT",
            body: JSON.stringify(payload)
          });

          setAddressMessage("Dirección actualizada correctamente.", "ok");
        } catch (updateError) {
          console.warn("El backend no permitió PUT para editar dirección. Aplicando reemplazo seguro:", updateError);
          setAddressMessage("Actualizando dirección con método seguro...", "info");

          await fetchJson(`${API_URL}/users/${encodeURIComponent(email)}/addresses`, {
            method: "POST",
            body: JSON.stringify(payload)
          });

          await fetchJson(`${API_URL}/users/${encodeURIComponent(email)}/addresses/${encodeURIComponent(editingAddressId)}`, {
            method: "DELETE"
          });

          setAddressMessage("Dirección actualizada correctamente.", "ok");
        }
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

    setAddressMessage(cameFromCheckout ? "Seleccionando dirección para este pedido..." : "Usando esta dirección como principal...", "info");

    try {
      await fetchJson(`${API_URL}/users/${encodeURIComponent(email)}/addresses/${encodeURIComponent(addressId)}/default`, {
        method: "PUT"
      });

      setAddressMessage(cameFromCheckout ? "Dirección seleccionada. Volviendo al checkout..." : "Esta dirección quedó como principal para tus próximos pedidos.", "ok");
      await loadAddresses();

      returnToCheckoutAfterSelectingAddress(addressId);
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
    if (isSavingProfile) return;

    if (!isProfileEditEnabled) {
      setProfileMessage("Presiona Editar perfil antes de cambiar tus datos.", "info");
      return;
    }

    const email = getUserEmail(currentUser);

    if (!email) {
      setProfileMessage("Debes iniciar sesión para editar tu perfil.", "error");
      return;
    }

    const fullName = safeText(profileNameInput?.value);
    const phone = safeText(profilePhoneInput?.value);
    const currentPassword = String(profileCurrentPasswordInput?.value || "");
    const newPassword = String(profileNewPasswordInput?.value || "");
    const confirmPassword = String(profileConfirmPasswordInput?.value || "");

    if (!fullName) {
      setProfileMessage("Escribe tu nombre completo.", "error");
      profileNameInput?.focus();
      return;
    }

    if (!phone) {
      setProfileMessage("Escribe tu número de teléfono.", "error");
      profilePhoneInput?.focus();
      return;
    }

    if (newPassword || confirmPassword || currentPassword) {
      if (!currentPassword) {
        setProfileMessage("Para cambiar la contraseña debes escribir la contraseña actual.", "error");
        profileCurrentPasswordInput?.focus();
        return;
      }

      if (!newPassword) {
        setProfileMessage("Escribe la nueva contraseña.", "error");
        profileNewPasswordInput?.focus();
        return;
      }

      if (newPassword.length < 6) {
        setProfileMessage("La nueva contraseña debe tener mínimo 6 caracteres.", "error");
        profileNewPasswordInput?.focus();
        return;
      }

      if (newPassword !== confirmPassword) {
        setProfileMessage("La confirmación no coincide con la nueva contraseña.", "error");
        profileConfirmPasswordInput?.focus();
        return;
      }
    }

    const payload = {
      fullName,
      name: fullName,
      phone
    };

    if (newPassword) {
      payload.currentPassword = currentPassword;
      payload.newPassword = newPassword;
    }

    isSavingProfile = true;
    setButtonLoading(saveProfileBtn, true, "Guardando perfil...", "Guardar cambios");
    setProfileMessage("Guardando cambios en backend/PostgreSQL...", "info");

    try {
      const data = await fetchJson(`${API_URL}/users/${encodeURIComponent(email)}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });

      const updatedUser = data?.user || null;

      if (updatedUser) {
        currentUser = {
          ...currentUser,
          ...updatedUser,
          role: currentUser?.role || updatedUser.role || "customer"
        };

        if (typeof setCurrentUser === "function") {
          setCurrentUser(currentUser);
        } else {
          window.DELI_CURRENT_USER = currentUser;
        }

        fillProfileForm(currentUser);
        updateSummary();
      }

      setProfileMessage("Perfil actualizado correctamente.", "ok");
    } catch (error) {
      console.error("Error actualizando perfil BHUZ:", error);
      setProfileMessage(error.message || "No se pudo completar la solicitud.", "error");
    } finally {
      isSavingProfile = false;
      setButtonLoading(saveProfileBtn, false, "Guardando perfil...", "Guardar cambios");
      setProfileEditMode(isProfileEditEnabled);
    }
  }

  function bindEvents() {
    if (profileForm) {
      profileForm.addEventListener("submit", handleProfileSubmit);
    }

    if (editProfileBtn) {
      editProfileBtn.addEventListener("click", enableProfileEditing);
    }

    if (cancelProfileEditBtn) {
      cancelProfileEditBtn.addEventListener("click", cancelProfileEditing);
    }

    if (openAddressFormBtn) {
      openAddressFormBtn.addEventListener("click", prepareNewAddressForm);
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
    hideAddressForm();
    bindEvents();

    /* =========================================================
       CAMBIO BHUZ - PERFIL BLOQUEADO AL CARGAR
       - Evita que el usuario edite por accidente.
       - El botón Editar perfil queda visible cuando hay sesión.
       - Guardar/Cancelar quedan ocultos hasta activar edición.
    ========================================================= */
    setProfileEditMode(false);

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

    if (cameFromCheckout) {
      setAddressMessage("Selecciona una dirección y volverás al checkout para confirmar el pedido.", "info");
    }

    await loadAddresses();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

