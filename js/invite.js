/* ======================================================
   BHUZ
   invite.js

   Página pública para "Invitar comida"
   - Receptor NO necesita cuenta.
   - Lee el token del link.
   - Muestra información básica del pedido.
   - Captura GPS obligatorio + referencia.
   - Envía la ubicación al backend.
====================================================== */

document.addEventListener("DOMContentLoaded", () => {
  const API_URL = "https://deligo-backend-i554.onrender.com";

  const params = new URLSearchParams(window.location.search);
  const token = String(params.get("token") || "").trim();

  const inviteTitle = document.getElementById("inviteTitle");
  const inviteDescription = document.getElementById("inviteDescription");
  const inviteOrderSummary = document.getElementById("inviteOrderSummary");
  const inviteLocationForm = document.getElementById("inviteLocationForm");
  const inviteReceiverReference = document.getElementById("inviteReceiverReference");
  const inviteReceiverAddress = document.getElementById("inviteReceiverAddress");
  const inviteGpsStatus = document.getElementById("inviteGpsStatus");
  const captureInviteGpsBtn = document.getElementById("captureInviteGpsBtn");
  const inviteSuccessBox = document.getElementById("inviteSuccessBox");

  let currentInvite = null;
  let capturedLocation = null;

  function escapeHtml(text) {
    return String(text || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatPrice(value) {
    const amount = Number(value || 0);

    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  function setGpsStatus(message, ok = false) {
    if (!inviteGpsStatus) return;

    inviteGpsStatus.textContent = message;
    inviteGpsStatus.classList.toggle("ok", Boolean(ok));
  }

  function renderInvite(invite, order) {
    const recipientName = invite?.recipientName || "";
    const senderName = invite?.senderName || "Alguien";
    const restaurantName = order?.restaurantName || "un restaurante BHUZ";

    if (inviteTitle) {
      inviteTitle.textContent = recipientName
        ? `${recipientName}, te invitaron comida`
        : "Te invitaron comida";
    }

    if (inviteDescription) {
      inviteDescription.textContent = `${senderName} te envió un pedido con BHUZ. Comparte tu ubicación GPS para recibirlo.`;
    }

    if (inviteOrderSummary) {
      inviteOrderSummary.innerHTML = `
        <div><strong>Restaurante:</strong> ${escapeHtml(restaurantName)}</div>
        <div><strong>Total:</strong> ${formatPrice(order?.total || 0)}</div>
        <div><strong>Estado:</strong> ${escapeHtml(order?.status || "pendiente")}</div>
      `;
    }

    if (invite?.status === "location_confirmed") {
      if (inviteLocationForm) inviteLocationForm.style.display = "none";
      if (inviteSuccessBox) inviteSuccessBox.style.display = "block";
      setGpsStatus("Ubicación ya confirmada.", true);
      return;
    }

    if (inviteLocationForm) {
      inviteLocationForm.style.display = "block";
    }
  }

  async function loadInvite() {
    if (!token) {
      if (inviteDescription) {
        inviteDescription.textContent = "El link de invitación no es válido.";
      }
      return;
    }

    try {
      const response = await fetch(`${API_URL}/invite/${encodeURIComponent(token)}`);
      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.message || "No se pudo cargar la invitación");
      }

      currentInvite = data.invite;
      renderInvite(data.invite, data.order);
    } catch (error) {
      console.error("Error cargando invitación:", error);

      if (inviteDescription) {
        inviteDescription.textContent = "No se pudo cargar la invitación. Verifica que el link sea correcto.";
      }
    }
  }

  async function captureGps() {
    if (!navigator.geolocation) {
      alert("Tu navegador no permite compartir ubicación GPS.");
      return;
    }

    setGpsStatus("Solicitando ubicación GPS...", false);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        capturedLocation = {
          lat: String(position.coords.latitude),
          lng: String(position.coords.longitude)
        };

        setGpsStatus("✅ Ubicación GPS cargada correctamente.", true);
      },
      (error) => {
        console.warn("Error GPS invitación:", error);
        capturedLocation = null;
        setGpsStatus("No se pudo obtener la ubicación. Activa el GPS y vuelve a intentar.", false);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }
    );
  }

  async function submitLocation(event) {
    event.preventDefault();

    const reference = String(inviteReceiverReference?.value || "").trim();
    const address = String(inviteReceiverAddress?.value || "").trim();

    if (!reference) {
      alert("Escribe una referencia para que el repartidor pueda ubicarte.");
      return;
    }

    if (!capturedLocation?.lat || !capturedLocation?.lng) {
      alert("Primero debes compartir tu ubicación GPS.");
      return;
    }

    try {
      const response = await fetch(`${API_URL}/invite/${encodeURIComponent(token)}/location`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          address,
          reference,
          latitude: capturedLocation.lat,
          longitude: capturedLocation.lng,
          location: capturedLocation
        })
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.message || "No se pudo confirmar la ubicación");
      }

      if (inviteLocationForm) inviteLocationForm.style.display = "none";
      if (inviteSuccessBox) inviteSuccessBox.style.display = "block";
      setGpsStatus("✅ Ubicación confirmada.", true);
    } catch (error) {
      console.error("Error confirmando ubicación:", error);
      alert(error.message || "No se pudo confirmar la ubicación.");
    }
  }

  captureInviteGpsBtn?.addEventListener("click", captureGps);
  inviteLocationForm?.addEventListener("submit", submitLocation);

  loadInvite();
});
