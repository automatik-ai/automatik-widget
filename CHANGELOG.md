# Changelog — automatik-widget

## v1.3.2 — 2026-08-29

### Cambios
- `widget.js`: el chat dibuja **todas** las tarjetas del mensaje, no sólo la primera.
  `PRODUCT_CARD_PATTERN` no tenía flag `g` y se usaba con `.match()`, que devuelve una sola
  coincidencia: si el bot emitía dos marcadores, se renderizaba la primera tarjeta y la segunda
  le quedaba al cliente **escrita como texto crudo** (`[[PRODUCT_CARD:…]]`) en la burbuja. Por eso
  el prompt de Flor tiene la orden "Solo una tarjeta por respuesta", y por eso una compra de pack
  necesita un turno por producto. Con la promo de packs (3 unidades = $10.000 menos) esa es la
  conversación más cara: medido el 29/8, una sesión usó 4 turnos para ver 3 diseños y otra se
  comió el rate limit del bot en el mensaje 12 con 3 mates en el carrito.
- `widget.js`: los dos `return` de adentro del `try` de `injectProductCards` pasan a `continue`.
  Cortaban la función entera, así que si la **primera** variante estaba agotada o su handle no
  existía se perdían **todas** las tarjetas del mensaje. Medido con jsdom: en ese caso el código
  anterior dibuja 0 tarjetas aunque las siguientes estén disponibles.

### Detalle de implementación
- Se agrega `PRODUCT_CARD_PATTERN_ALL` (la misma expresión con `g`) **sólo** para `matchAll`.
  ⚠️ El pattern sin `g` se conserva y se sigue usando en `stripMarker`: ese helper hace
  `pattern.test(nodo)` dentro de un `while`, y un regex global es stateful (`lastIndex` avanza
  entre llamadas), así que pasarle el global saltearía uno de cada dos nodos de texto.
- `stripMarker` se llama una vez por vuelta del `for`, con el pattern sin `g`: cada llamada borra
  el primer marcador que queda, que es justo el que se acaba de dibujar.

### Probado
Con jsdom y un Shopify falso, corriendo la función real de las dos versiones sobre los mismos
mensajes — 5/5:

| caso | antes | después |
|---|---|---|
| una tarjeta (lo de siempre) | 1 | 1 — sin regresión |
| tres marcadores (compra de pack) | 1 + marcador crudo a la vista | 3, burbuja limpia |
| dos, la primera agotada | 0 | 1 |
| dos, la primera con handle inexistente | 0 | 1 |
| sin marcadores | 0 | 0 |

### Pendiente del lado del bot (n8n `NOmAW8DMMDzVVBOb`)
Mientras esto no esté en producción, el prompt de Flor tiene que seguir diciendo "Solo una
tarjeta por respuesta". Recién cuando el widget lo soporte se le saca esa línea y se le enseña a
mandar 2-3 juntas. Es un cambio aparte, no sale solo con este merge.

## v1.2.0 — 2026-08-25

### Cambios
- `widget.css`: rework de marca. La paleta y la tipografía ahora son las de ALTO MATÉ® y no las de
  la plantilla: cream `#f5f2eb` de fondo, header negro plano `#2e2e2e` (la banda de los mails) en
  vez del degradé verde, Poppins declarada, y el sage del theme (`--color-base-accent-1`,
  `#81a080`) como acento. Los rellenos que llevan texto blanco usan `#546f53`: el sage de marca
  sobre blanco da 2,89:1 y no llega al mínimo legible; el tono nuevo, con el mismo matiz, da 5,56:1.
- `widget.css`: se mapean las variables del propio `@n8n/chat` (`--chat--font-family`,
  `--chat--color-*`). Sin esto medio rework era un no-op: el `style.css` del paquete se carga dentro
  del `<body>` de la tienda y le ganaba a la hoja del widget por orden, así que el panel salía con
  la tipografía del sistema y el botón de "Iniciar chat" con el rosa `#e74266` de n8n.
- `widget.css`: sistema explícito de radios (4/6/12/100), espaciados múltiplos de 4 con gutter de
  16px, cinco tamaños tipográficos y sólo los pesos 400 y 700 — los únicos que el theme sirve.
  Las sombras difusas se van de burbujas y tarjetas (el sistema pide sombra sólida o borde a secas);
  quedan las tres de lo que flota sobre la tienda.
- `widget.css`: la firma de CTA de la marca (relleno + esquina de 6px + sombra sólida sin desenfoque)
  queda para los dos botones que venden. El de enviar pasa a tinta: copiaba la misma firma y en el
  panel del formulario quedaban dos botones verdes iguales compitiendo.
- `widget.css`: la foto de la tarjeta de producto pasa a `contain` sobre 176px. Las imágenes de
  variante son 4:5 verticales y recortadas a 290×126 mostraban el 35 % del medio, sin bombilla ni
  tapa. El precio sube a 20px y manda en la fila.
- `widget.css`: estados que faltaban — `:focus-visible` en botones y chips, el deshabilitado del
  botón de enviar (salía idéntico al activo), `::placeholder` con el gris de la paleta, y
  `prefers-reduced-motion` sobre los puntos del "escribiendo", que rebotaban igual porque la
  animación vive en los hijos.
- `widget.css`: los campos suben a 16px en cualquier dispositivo táctil (`pointer: coarse`). El bump
  vivía sólo bajo 767px y un iPad vertical cae del lado de escritorio: Safari hacía auto-zoom al
  enfocar y dejaba la tienda zoomeada.
- `widget.css`: el namespace de las variables pasa de `--am-*` a `--flor-*`. La tienda ya define
  `--am-ink` (#111111) y `--am-line` (#ececec) con otros valores.
- `widget.js`: el avatar deja de ser un headset de call center y pasa a ser el isotipo de la marca
  —el favicon de la propia tienda, no un dibujo nuevo— sobre un tile cream; y el header dice
  "Flor · ALTO MATE® ◆ ATENCIÓN" en vez de "Soporte", con el `aria-label` acorde. La marca va sin
  acento en el header, por decisión del dueño de la tienda.
- `widget.js`: el mensaje inicial nocturno ya no anuncia ausencia. El bot responde a cualquier hora
  (medido: 4 de 4 mensajes entre las 00 y las 7, mediana 4,8 s); lo que espera a las 7 AM es la
  persona del equipo, no la respuesta.
- `widget.js`: las respuestas rápidas se insertan debajo del saludo y no arriba, para que el orden
  de lectura sea saludo → opciones → escribir.
- `widget.js`: la tarjeta de producto lleva la foto y el título a la ficha, muestra el precio tachado
  cuando hay descuento y, una vez agregado, el botón pasa a "Ir al carrito".
- `widget.js`: el formulario de pedido ya no nace deshabilitado, Enter envía y el email se valida por
  formato (un typo volvía como "no encontramos tu pedido"). Se van los dos asteriscos y la leyenda de
  campos obligatorios: los dos campos lo son.
- `widget.js`: la animación del botón flotante deja de rebotar y libera el `transform` al terminar,
  que era lo que dejaba muerto el `:hover` del paquete.
- `loader.js`: cache-bust actualizado a `1.2.0`.

## v1.1.9 — 2026-08-24

### Cambios
- `widget.js`: los links de los mensajes del bot se abren en una pestaña nueva
  (`target="_blank"` + `rel="noopener noreferrer"`). `@n8n/chat` renderiza con markdown-it y sus
  opciones de fábrica, así que los `<a>` salían sin `target` y el cliente que tocaba un link
  perdía el chat y el carrito. `mailto:`, `tel:` y las anclas quedan como estaban.
- `widget.js`: sacar `[[PRODUCT_CARD]]` y `[[ORDER_LOOKUP]]` ya no borra el resto del mensaje.
  Las dos inyecciones hacían `markdown.textContent = markdown.textContent.replace(...)`, y asignar
  `textContent` reemplaza todo el contenido del nodo por texto plano: en esos mensajes los `<a>`
  que markdown-it había generado desaparecían y el link dejaba de poder tocarse. Ahora el marcador
  se saca recorriendo sólo los nodos de texto (`stripMarker`), y el párrafo que queda vacío se
  elimina para no dejar un hueco en la burbuja.
- `loader.js`: cache-bust actualizado a `1.1.9`.

## v1.1.8 — 2026-08-13

### Cambios
- Mobile: chat de pantalla completa hasta 767 px, con header y footer fijos dentro del layout.
- Mobile: altura sincronizada con `visualViewport`, con fallback a `innerHeight`, para teclados Android/iOS y navegadores embebidos.
- Mobile: bloqueo y restauración del scroll de Shopify mientras el chat está abierto.
- Mobile: inputs de 16 px para evitar zoom automático en iPhone; número de pedido con teclado numérico.
- Mobile: respuestas rápidas se ocultan al escribir para liberar espacio sobre el teclado.
- Conversación: scroll inteligente al final sin arrastrar al cliente si está leyendo mensajes anteriores.
- Accesibilidad: diálogo modal en mobile, foco restaurado y soporte para movimiento reducido.
- Dependencia: `@n8n/chat` fijada en `0.9.1`; se elimina la segunda carga dinámica del CSS base.
- Rendimiento: hidratación del widget agrupada por frame y detección de mensajes transitorios explícita.

## v1.1.6 — 2026-08-12

### Cambios
- `widget.js`: copy del formulario de consulta de pedido. Medido en las conversaciones del 11-12/8:
  8 de 10 clientes lo abandonaban, y uno de los que lo completó puso un número que no era de pedido.
  La descripción ahora dice dónde encontrar el número (mail de confirmación, 5 cifras), el label pasa
  de "Número de orden" a "Número de pedido" (como figura en el mail de Shopify) y el placeholder
  muestra un formato real (`ej: 21234` en vez de `ej: 1234`).
- `loader.js`: cache-bust actualizado a `1.1.6`.

## v1.1.5 — 2026-08-12

### Cambios
- `widget.css`: margen desktop aumentado para que el panel no quede pegado al borde.
- `widget.js`: trigger de carrito detecta clase Kaching en `html` y `body`.
- `widget.js`: trigger sincroniza estado al cargar y reintenta inyección si el chat aún no está montado.
- `loader.js`: cache-bust actualizado a `1.1.5`.
- El trigger se reinicia al cerrar el carrito y usa una clave nueva para no quedar bloqueado por sesiones anteriores.

## v1.1.4 — 2026-08-11

### Cambios
- `widget.css`: panel separado del borde derecho en desktop y mobile.
- `widget.css`: indicador de carga compacto y alineado dentro del flujo de conversación.
- `widget.js`: aviso de carrito agrupado y reposicionado antes del primer mensaje del cliente.
- `widget.js`: burbuja de carrito con foco de teclado y cache-bust `1.1.4`.

## v1.1.0 — 2026-05-29

### Cambios
- `widget.js`: nueva función `injectOrderLookup()` — detecta marcador `[[ORDER_LOOKUP]]` en mensajes del bot
- `widget.js`: renderiza card con campos email + número de orden (ambos obligatorios)
- `widget.js`: botón "Consultar pedido" deshabilitado hasta que ambos campos tengan valor
- `widget.js`: validación client-side — borde rojo + mensaje de error si campo vacío al intentar submit
- `widget.js`: on submit — manda UN mensaje combinado ("Mi email es X y mi número de orden es Y")
- `widget.js`: trackea evento `consulta_pedido_enviada` en analytics
- `widget.css`: estilos para `.flor-order-card`, campos, errores, botón

### Cómo funciona
1. Bot detecta intención de seguimiento → responde exactamente con `[[ORDER_LOOKUP]]`
2. widget.js detecta el marcador → elimina el texto → renderiza la card debajo del bubble
3. Usuario completa email + nro de orden → click "Consultar pedido"
4. Se manda un único mensaje al bot con los dos datos
5. Bot ejecuta `consultar_estado_pedido` una sola vez → 0 ejecuciones extra de n8n

### Cambio requerido en el prompt de Flor (n8n)
Agregar en la sección de seguimiento de pedido:
> Cuando el usuario pregunta por el estado de su pedido (seguimiento, tracking, dónde está mi pedido, etc.), respondé EXACTAMENTE con esto y nada más: `[[ORDER_LOOKUP]]`. No pidas email ni número de orden en texto.

---

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
