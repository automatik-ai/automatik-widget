/**
 * automatik-widget / loader.js
 * Versión: 1.0.1
 * Fecha:   2026-05-29
 * Descripción: Loader del widget Flor. Consulta la Edge Function de Supabase
 *              para verificar si la tienda está activa antes de cargar el widget.
 *              Si active=false, no carga nada — control de acceso sin tocar Shopify.
 *
 * Uso en theme.liquid (sin async — necesario para document.currentScript):
 *   <script src="https://automatik-ai.github.io/automatik-widget/loader.js"
 *     data-store="alto-mate"></script>
 *
 * Para agregar un cliente nuevo: insertar fila en widget_stores en Supabase automatik-platform.
 * Para cortar acceso: cambiar active=false en esa tabla.
 */

(function () {
  'use strict';

  var CONFIG_URL = 'https://yvwxjpujeekphepnskjd.supabase.co/functions/v1/widget-config';
  var WIDGET_JS  = 'https://automatik-ai.github.io/automatik-widget/widget.js?v=1.0.0';
  var WIDGET_CSS = 'https://automatik-ai.github.io/automatik-widget/widget.css?v=1.0.0';

  // document.currentScript no funciona con async — el script NO debe tener async
  var script  = document.currentScript;
  var storeId = script ? script.getAttribute('data-store') : null;

  // Fallback: buscar el script por src si currentScript no está disponible
  if (!storeId) {
    var scripts = document.querySelectorAll('script[data-store]');
    if (scripts.length) storeId = scripts[scripts.length - 1].getAttribute('data-store');
  }

  if (!storeId) return;

  fetch(CONFIG_URL + '?store=' + encodeURIComponent(storeId))
    .then(function (res) { return res.json(); })
    .then(function (config) {
      if (!config.active) return;

      // Inyectar CSS
      var link  = document.createElement('link');
      link.rel  = 'stylesheet';
      link.href = WIDGET_CSS;
      document.head.appendChild(link);

      // Inyectar JS (module)
      var js    = document.createElement('script');
      js.type   = 'module';
      js.src    = WIDGET_JS;
      document.head.appendChild(js);
    })
    .catch(function () {
      // Falla silenciosa — si el endpoint no responde, no rompe la tienda
    });
})();
