# Changelog — automatik-widget

## v1.0.1 — 2026-05-29

### Cambios
- `loader.js`: agregado CSS base de n8n (`@n8n/chat/style.css`) para posicionamiento correcto
- `loader.js`: removido `async` del snippet — `document.currentScript` no funciona con async
- `loader.js`: agregado fallback de detección de `data-store` si `currentScript` es null
- `widget.css`: agregado `position: fixed` en `.n8n-chat` (luego revertido — se maneja desde theme.liquid)

### Decisión de arquitectura
El CSS base de n8n debe cargarse ANTES que el widget (directo en theme.liquid, no vía loader).
Si se carga dinámicamente, el widget se posiciona mal (abajo a la izquierda en vez de fixed abajo a la derecha).

### Snippet final en theme.liquid
```liquid
{% if true %}
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@n8n/chat/style.css" />
{% if request.page_type == 'product' %}
<style>
  .chat-window-toggle { opacity: 0 !important; pointer-events: none !important; }
  .chat-window-toggle[data-flor-badge] { opacity: 1 !important; pointer-events: auto !important; }
</style>
{% endif %}
<script>
window.FlorShopifyConfig = {
  customerLoggedIn: {% if customer %}true{% else %}false{% endif %},
  customerOrders:   {{ customer.orders_count | default: 0 | json }},
  customerName:     {{ customer.first_name   | default: '' | json }},
  pageType:         {{ request.page_type | json }}
};
</script>
<script src="https://automatik-ai.github.io/automatik-widget/loader.js?v=1.0.1" data-store="alto-mate"></script>
{% endif %}
```

---

## v1.0.0 — 2026-05-29

### Migración inicial
- Extracción del bloque gigante (~600 líneas) embebido en theme.liquid de Alto Maté
- Separación en `widget.js` + `widget.css` hosteados en GitHub Pages
- Creación del repo `automatik-ai/automatik-widget` con seguridad completa:
  - Branch protection en main (PR obligatorio)
  - 2FA en cuenta GitHub
  - Secret scanning + push protection activados
  - `.gitignore` con exclusión de secrets y dependencias

### Infraestructura SaaS creada
- Supabase proyecto `automatik-platform` (separado del de Alto Maté)
  - Región: South America (São Paulo)
  - RLS desactivado en `widget_stores` (acceso controlado por grants)
  - Grant `select` otorgado al rol `anon`
- Tabla `widget_stores`:
  ```sql
  store_id    text primary key
  active      boolean not null default true
  plan        text not null default 'basic'
  client_name text
  domain      text
  created_at  timestamptz not null default now()
  updated_at  timestamptz not null default now()
  ```
- Primer registro: `alto-mate | true | basic | Alto Maté | altomate.com.ar`
- Edge Function `widget-config` deployada en Supabase:
  - URL: `https://yvwxjpujeekphepnskjd.supabase.co/functions/v1/widget-config`
  - JWT verification: OFF (necesario para acceso público sin token)
  - Recibe `?store=alto-mate` → devuelve `{"active":true}` o `{"active":false}`
- `loader.js` creado — consulta Edge Function antes de cargar el widget

### Control de acceso
Para desactivar un cliente sin tocar su Shopify:
```sql
update widget_stores set active = false where store_id = 'alto-mate';
```

### Lecciones aprendidas
- `SUPABASE_SERVICE_ROLE_KEY` y `SUPABASE_ANON_KEY` están deprecated en Edge Functions nuevas
- Usar anon key hardcodeada temporalmente para debug — es pública por diseño
- `document.currentScript` devuelve null con `async` — el loader NO debe tener async
- CSS de n8n debe cargarse en el HTML antes de que el widget se inicialice
