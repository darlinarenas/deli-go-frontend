/* ======================================================
   BHUZ - CONFIGURACIÓN CENTRAL DEL FRONTEND
   Cambia la URL aquí solamente si cambia el backend.
====================================================== */
(function configurarBhuz(global) {
  "use strict";

  const PRODUCCION = "https://deligo-backend-i554.onrender.com";
  const LOCAL = "http://localhost:3000";
  const host = String(global.location?.hostname || "").toLowerCase();
  const esLocal = host === "localhost" || host === "127.0.0.1";

  global.DELI_API_URL = global.DELI_API_URL || (esLocal ? LOCAL : PRODUCCION);
  global.BHUZ_API_URL = global.BHUZ_API_URL || global.DELI_API_URL;
  global.API_BASE_URL = global.API_BASE_URL || global.DELI_API_URL;
})(window);
