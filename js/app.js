/* BHUZ: archivo de compatibilidad. La conexión API vive en config.js y api.js. */
(function (global) {
  "use strict";
  global.DELI_DB = global.DELI_DB || { restaurants: [], user: null, orders: [] };
})(window);
