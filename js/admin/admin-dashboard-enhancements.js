(() => {
  "use strict";

  const REFRESH_MS = 20000;
  let refreshing = false;
  let timer = null;

  function applyTheme(theme) {
    document.documentElement.dataset.adminTheme = theme;
    localStorage.setItem("bhuzAdminTheme", theme);
    const button = document.getElementById("adminThemeToggle");
    if (button) button.textContent = theme === "dark" ? "☀️ Modo claro" : "🌙 Modo oscuro";
  }

  function initTheme() {
    const saved = localStorage.getItem("bhuzAdminTheme");
    const preferred = saved || (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    applyTheme(preferred);
    document.getElementById("adminThemeToggle")?.addEventListener("click", () => {
      applyTheme(document.documentElement.dataset.adminTheme === "dark" ? "light" : "dark");
    });
  }

  function userIsEditing() {
    const active = document.activeElement;
    if (!active) return false;
    return ["INPUT", "TEXTAREA", "SELECT"].includes(active.tagName) || active.isContentEditable;
  }

  function setStatus(text, state = "ok") {
    const el = document.getElementById("adminAutoRefreshStatus");
    if (!el) return;
    el.textContent = text;
    el.dataset.state = state;
  }

  async function silentRefresh() {
    if (refreshing || document.hidden || userIsEditing()) return;
    if (typeof window.cargarDatosAdministrador !== "function" && typeof cargarDatosAdministrador !== "function") return;

    refreshing = true;
    const x = window.scrollX;
    const y = window.scrollY;
    const activeSection = document.querySelector(".admin-section.active")?.id;
    setStatus("Actualizando…", "loading");

    try {
      const loader = window.cargarDatosAdministrador || cargarDatosAdministrador;
      await loader();
      if (typeof window.refreshAdminServicesSilently === "function") {
        await window.refreshAdminServicesSilently();
      }
      if (activeSection && typeof window.abrirSeccionAdministrador === "function") {
        window.abrirSeccionAdministrador(activeSection, { silentScroll: true });
      }
      requestAnimationFrame(() => window.scrollTo(x, y));
      setStatus(`Actualizado ${new Date().toLocaleTimeString("es-CL", {hour:"2-digit", minute:"2-digit"})}`, "ok");
    } catch (error) {
      console.warn("Actualización automática administrativa:", error);
      setStatus("Sin conexión · reintentando", "error");
    } finally {
      refreshing = false;
    }
  }

  function initRefresh() {
    clearInterval(timer);
    timer = setInterval(silentRefresh, REFRESH_MS);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) silentRefresh();
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    initRefresh();
  });
})();
