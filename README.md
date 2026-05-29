# automatik-widget

Widget de chat Flor para Alto Maté, hosteado vía GitHub Pages.  
Reemplaza el bloque gigante embebido en `theme.liquid` por un snippet de 6 líneas.

---

## Estructura

```
automatik-widget/
├── widget.css      Estilos del chat (sin secrets)
├── widget.js       Lógica completa (ES module, sin secrets)
└── README.md       Este archivo
```

---

## URLs públicas (GitHub Pages)

```
https://automatik-ai.github.io/automatik-widget/widget.css
https://automatik-ai.github.io/automatik-widget/widget.js
```

---

## Snippet para theme.liquid

Reemplazar TODO el bloque `{% if true %} ... {% endif %}` por esto:

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

> ⚠️ El CSS de n8n DEBE estar en el HTML antes del loader — si se carga dinámicamente el widget se posiciona mal.
> El parámetro `?v=1.0.1` fuerza cache-bust. Actualizarlo junto al bump de versión.

## Control de acceso

Para desactivar un cliente sin tocar su Shopify:
```sql
update widget_stores set active = false where store_id = 'alto-mate';
```

Para reactivar:
```sql
update widget_stores set active = true where store_id = 'alto-mate';
```

---

## Seguridad

| Qué                        | Estado     | Nota                                                  |
|----------------------------|------------|-------------------------------------------------------|
| Tokens Shopify             | ✅ Ausente  | Nunca incluir                                         |
| Service role Supabase      | ✅ Ausente  | Nunca incluir                                         |
| OpenAI / Anthropic keys    | ✅ Ausente  | Nunca incluir                                         |
| URLs webhook n8n           | ⚠️ Públicas | Son endpoints recibidores, sin lectura de datos. OK.  |
| Variables Liquid Shopify   | ✅ Separadas | Inyectadas inline por theme, no en este repo          |

---

## Cómo actualizar

1. Editar `widget.js` o `widget.css` localmente.
2. Bumpar versión en el header del archivo (`Versión: X.Y.Z`) y en la tabla de changelog abajo.
3. Commit + push a `main`.
4. GitHub Pages se actualiza en ~60 segundos.
5. Actualizar `?v=X.Y.Z` en el snippet del theme para forzar cache-bust en los browsers.

---

## Changelog

| Versión | Fecha      | Cambios                                               |
|---------|------------|-------------------------------------------------------|
| 1.0.0   | 2026-05-29 | Migración inicial desde bloque embebido en theme.liquid |
