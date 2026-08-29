/**
 * automatik-widget / widget.js
 * Versión: 1.3.2
 * Fecha:   2026-08-29
 * Descripción: Chat Flor para Alto Maté — JS completo cargado externamente.
 *              Lee config Shopify desde window.FlorShopifyConfig (inyectado por theme.liquid).
 *              Incluye: init del chat n8n, header custom, quick replies,
 *                       tarjetas de producto, analytics, trigger carrito.
 *
 * Dependencia: @n8n/chat (cargado desde jsdelivr CDN)
 * Repo:        https://github.com/automatik-ai/automatik-widget
 *
 * IMPORTANTE:
 *   - Las URLs de webhook n8n están aquí por diseño (son endpoints públicos recibidores).
 *   - No contiene tokens de acceso, service role keys ni secrets de lectura.
 *   - Para rotar URLs de webhook: actualizar WEBHOOK_CHAT y WEBHOOK_ANALYTICS,
 *     hacer commit con bump de versión y actualizar cache-buster en theme.liquid.
 */

import { createChat } from 'https://cdn.jsdelivr.net/npm/@n8n/chat@0.9.1/chat.bundle.es.js';

/* ── Configuración ──────────────────────────────────────── */

// URLs de webhook n8n (endpoints recibidores — no son secrets)
const WEBHOOK_CHAT      = 'https://mostri.app.n8n.cloud/webhook/flor-altomate-soporte-web/chat';
const WEBHOOK_ANALYTICS = 'https://mostri.app.n8n.cloud/webhook/altomate-chat-eventos';

// Config Shopify inyectada por theme.liquid vía window.FlorShopifyConfig
const shopify = window.FlorShopifyConfig || {};

// Quick replies iniciales
const QUICK_OPTIONS = [
  { label: 'Seguimiento de pedido', message: 'Quiero consultar el seguimiento de mi pedido' },
  { label: 'Otra consulta',         message: null }
];

const MOBILE_BREAKPOINT = 767;
const MOBILE_QUERY = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);

let florChatOpen = false;
let florViewportFrame = null;
let florPageLock = null;
let florLastFocusedElement = null;
let florNearConversationEnd = true;
let florMobileViewportBaseline = 0;

function isMobileChatViewport() {
  return MOBILE_QUERY.matches;
}

function getChatScrollContainer() {
  return document.querySelector('.chat-body');
}

function scrollConversationToEnd(behavior = 'auto') {
  const container = getChatScrollContainer();
  if (!container) return;
  if (typeof container.scrollTo === 'function') {
    container.scrollTo({ top: container.scrollHeight, behavior });
  } else {
    container.scrollTop = container.scrollHeight;
  }
  florNearConversationEnd = true;
}

function updateMobileViewport() {
  florViewportFrame = null;
  if (!florChatOpen || !isMobileChatViewport()) return;

  const viewport = window.visualViewport;
  const height = Math.round(viewport?.height || window.innerHeight);
  const offsetTop = Math.round(viewport?.offsetTop || 0);
  const active = document.activeElement;
  const inputFocused = active?.matches(
    '.chat-input textarea, .chat-footer textarea, .chat-input input[type="text"], .flor-order-input'
  );

  // Android can shrink innerHeight and visualViewport together. Keep the
  // pre-keyboard height so keyboard detection still works in that mode.
  if (!inputFocused) {
    florMobileViewportBaseline = Math.max(
      height,
      window.innerHeight,
      document.documentElement.clientHeight || 0
    );
  }
  const layoutHeight = Math.max(
    florMobileViewportBaseline,
    window.innerHeight,
    document.documentElement.clientHeight || 0
  );
  const keyboardOpen = Boolean(inputFocused && layoutHeight - height > 120);

  document.documentElement.style.setProperty('--flor-viewport-height', `${height}px`);
  document.documentElement.style.setProperty('--flor-viewport-top', `${offsetTop}px`);
  document.documentElement.classList.toggle('flor-keyboard-open', keyboardOpen);

  if (inputFocused) {
    requestAnimationFrame(() => scrollConversationToEnd());
  }
}

function scheduleMobileViewportUpdate() {
  if (florViewportFrame !== null) return;
  florViewportFrame = requestAnimationFrame(updateMobileViewport);
}

function lockStorePage() {
  if (florPageLock || !isMobileChatViewport()) return;

  const body = document.body;
  const html = document.documentElement;
  const scrollY = window.scrollY;
  florPageLock = {
    scrollY,
    body: {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow
    },
    htmlOverflow: html.style.overflow
  };

  body.style.position = 'fixed';
  body.style.top = `-${scrollY}px`;
  body.style.left = '0';
  body.style.right = '0';
  body.style.width = '100%';
  body.style.overflow = 'hidden';
  html.style.overflow = 'hidden';
}

function unlockStorePage() {
  if (!florPageLock) return;
  const body = document.body;
  const html = document.documentElement;
  const saved = florPageLock;
  florPageLock = null;

  Object.assign(body.style, saved.body);
  html.style.overflow = saved.htmlOverflow;
  requestAnimationFrame(() => window.scrollTo(0, saved.scrollY));
}

function setMobileChatEnvironment(isOpen) {
  const wasOpen = florChatOpen;
  const wasMobileOpen = wasOpen && document.documentElement.classList.contains('flor-mobile-chat-open');
  florChatOpen = isOpen;
  const mobileOpen = isOpen && isMobileChatViewport();
  document.documentElement.classList.toggle('flor-chat-open', isOpen);
  document.body.classList.toggle('flor-chat-open', isOpen);
  document.documentElement.classList.toggle('flor-mobile-chat-open', mobileOpen);
  document.body.classList.toggle('flor-mobile-chat-open', mobileOpen);

  const chatWindow = document.querySelector('.chat-window');
  if (chatWindow) {
    chatWindow.setAttribute('role', 'dialog');
    chatWindow.setAttribute('aria-label', 'Chat de ALTO MATÉ');
    if (mobileOpen) chatWindow.setAttribute('aria-modal', 'true');
    else chatWindow.removeAttribute('aria-modal');
  }

  if (mobileOpen) {
    if (!wasMobileOpen) {
      florLastFocusedElement = document.activeElement;
      florMobileViewportBaseline = Math.max(
        window.visualViewport?.height || 0,
        window.innerHeight,
        document.documentElement.clientHeight || 0
      );
      lockStorePage();
    }
    scheduleMobileViewportUpdate();
    requestAnimationFrame(() => scrollConversationToEnd());
  } else {
    document.documentElement.classList.remove('flor-keyboard-open');
    document.documentElement.style.removeProperty('--flor-viewport-height');
    document.documentElement.style.removeProperty('--flor-viewport-top');
    if (wasMobileOpen) unlockStorePage();
    if (!isOpen && wasOpen && florLastFocusedElement?.isConnected) {
      const focusTarget = florLastFocusedElement;
      requestAnimationFrame(() => {
        if (focusTarget?.isConnected) focusTarget.focus({ preventScroll: true });
      });
    }
    if (!isOpen && wasOpen) florLastFocusedElement = null;
    if (!mobileOpen) florMobileViewportBaseline = 0;
  }
}

window.visualViewport?.addEventListener('resize', scheduleMobileViewportUpdate);
window.visualViewport?.addEventListener('scroll', scheduleMobileViewportUpdate);
window.addEventListener('resize', scheduleMobileViewportUpdate);
window.addEventListener('orientationchange', scheduleMobileViewportUpdate);
MOBILE_QUERY.addEventListener?.('change', () => setMobileChatEnvironment(florChatOpen));

/* ── Helpers horario ────────────────────────────────────── */
const argHour = () => {
  const utc = Date.now() + new Date().getTimezoneOffset() * 60000;
  return new Date(utc - 3 * 3600000).getHours();
};
const isOnline = argHour() >= 7;
if (!isOnline) document.documentElement.classList.add('flor-offline');

/* ── Analytics ──────────────────────────────────────────── */
function getFlorSessionId() {
  const key = 'flor_analytics_session';
  let value = sessionStorage.getItem(key);
  if (!value) {
    value = 'flor_' + (crypto.randomUUID
      ? crypto.randomUUID()
      : Date.now() + '_' + Math.random().toString(36).slice(2));
    sessionStorage.setItem(key, value);
  }
  return value.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 100);
}
const florSessionId = getFlorSessionId();

function trackFlorEvent(evento, extra = {}) {
  fetch(WEBHOOK_ANALYTICS, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ session_id: florSessionId, evento, origen: 'widget', ...extra }),
    keepalive: true
  }).catch(() => {});
}

async function markAssistedCart() {
  try {
    await fetch((window.Shopify?.routes?.root || '/') + 'cart/update.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attributes: { automatik_session: florSessionId } })
    });
  } catch (_) {}
}

window.__florTrack           = trackFlorEvent;
window.__florSetCartSession  = markAssistedCart;

/* ── Init chat ──────────────────────────────────────────── */
createChat({
  webhookUrl: WEBHOOK_CHAT,
  mode: 'window',
  initialMessages: [
    isOnline
      ? 'Hola, soy Flor. ¿Te ayudo a elegir, o querés ver cómo viene tu pedido?'
      : 'Hola, soy Flor. Te respondo ahora, a cualquier hora. Si hace falta una persona del equipo, te escribe desde las 7 AM.'
  ],
  metadata: {
    customer_logged_in: shopify.customerLoggedIn ?? false,
    customer_orders:    shopify.customerOrders   ?? 0,
    customer_name:      shopify.customerName     ?? '',
    page_type:          shopify.pageType         ?? '',
    flor_session_id:    florSessionId
  },
  i18n: {
    en: {
      title:               'FLOR',
      subtitle:            isOnline ? 'ALTO MATÉ · En línea' : 'ALTO MATÉ · Respondo ahora',
      inputPlaceholder:    'Escribí tu consulta...',
      getStarted:          'Iniciar chat',
      closeButtonTooltip:  'Cerrar'
    }
  }
});

/* ── Inyección de header custom ─────────────────────────── */
function injectHeader() {
  const header = document.querySelector('.chat-header');
  if (!header || header.querySelector('.flor-avatar')) return;

  const avatar = document.createElement('div');
  avatar.className = 'flor-avatar';
  avatar.innerHTML = `<img src="https://altomatee.com.ar/cdn/shop/files/sin_fd.png?width=128" alt="" aria-hidden="true">`;

  const textDiv = document.createElement('div');
  textDiv.className = 'flor-header-text';
  textDiv.innerHTML = `
    <div class="flor-header-title">FLOR</div>
    <div class="flor-header-subtitle">
      <span class="flor-dot"></span>
      <span>ALTO MATÉ <span class="flor-sep">&#9670;</span> ${isOnline ? 'EN LÍNEA' : 'RESPONDO AHORA'}</span>
    </div>`;

  const closeBtn = document.createElement('button');
  closeBtn.className = 'flor-close-btn';
  closeBtn.setAttribute('aria-label', 'Cerrar chat');
  closeBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`;
  closeBtn.addEventListener('click', () => {
    document.querySelector('.chat-window-toggle')?.click();
  });

  header.prepend(textDiv);
  header.prepend(avatar);
  header.appendChild(closeBtn);
}

/* ── Estado abierto/cerrado ─────────────────────────────── */
function setupChatStateObserver() {
  const chatWin = document.querySelector('.chat-window');
  if (!chatWin || chatWin.dataset.florObserved) return;
  chatWin.dataset.florObserved = '1';
  const update = () => {
    const isOpen = getComputedStyle(chatWin).display !== 'none' && chatWin.offsetHeight > 0;
    setMobileChatEnvironment(isOpen);
    if (isOpen) {
      document.querySelector('.flor-preview-bubble')?.remove();
      if (!chatWin.dataset.florOpenTracked) {
        chatWin.dataset.florOpenTracked = '1';
        trackFlorEvent('chat_abierto');
      }
    }
  };
  update();
  new MutationObserver(update).observe(chatWin, { attributes: true, attributeFilter: ['class', 'style'] });
}

function setupMobileInputBehavior() {
  const input = document.querySelector('.chat-input textarea, .chat-footer textarea, .chat-input input[type="text"]');
  if (!input || input.dataset.florMobileReady) return;
  input.dataset.florMobileReady = '1';
  input.setAttribute('enterkeyhint', 'send');

  input.addEventListener('focus', () => {
    if (!isMobileChatViewport()) return;
    window.__florQuickRepliesDismissed = true;
    document.querySelector('.flor-quick-wrap')?.remove();
    scheduleMobileViewportUpdate();
    setTimeout(() => scrollConversationToEnd(), 80);
  });
  input.addEventListener('blur', scheduleMobileViewportUpdate);
}

function setupConversationScroll() {
  const container = getChatScrollContainer();
  if (!container || container.dataset.florScrollReady) return;
  container.dataset.florScrollReady = '1';
  const updatePosition = () => {
    florNearConversationEnd = container.scrollHeight - container.scrollTop - container.clientHeight < 80;
  };
  container.addEventListener('scroll', updatePosition, { passive: true });
  updatePosition();
}

/* The proactive cart notice lives outside n8n's Vue message list. Move its
   block before the first customer message so n8n's typing indicator and
   response remain below the question that triggered them. */
function positionProactiveBlocks() {
  document.querySelectorAll('.flor-proactive-block').forEach(block => {
    if (block.dataset.florPositioned === '1') return;
    const list = block.parentElement;
    if (!list?.classList.contains('chat-messages-list')) return;
    const existingUsers = block.__florExistingUsers || new Set();
    const nextUserMessage = Array.from(list.children).find(child =>
      child !== block &&
      child.classList?.contains('chat-message-from-user') &&
      !existingUsers.has(child)
    );
    if (nextUserMessage && block.nextElementSibling !== nextUserMessage) {
      list.insertBefore(block, nextUserMessage);
      block.dataset.florPositioned = '1';
    }
  });
}

/* ── Envío de mensajes programático ─────────────────────── */
function sendFlorMessage(message) {
  const input = document.querySelector('.chat-input textarea, .chat-footer textarea, .chat-input input[type="text"]');
  if (!input || !message) return;
  const proto = Object.getPrototypeOf(input);
  const setter = Object.getOwnPropertyDescriptor(proto, 'value');
  if (setter?.set) setter.set.call(input, message);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  setTimeout(() => {
    document.querySelector('.chat-input-send-button, .chat-input button[type="submit"], .chat-footer button[type="submit"]')?.click();
  }, 80);
}
window.__florSendMessage = sendFlorMessage;

/* ── Quick replies ──────────────────────────────────────── */
function injectQuickReplies() {
  if (window.__florQuickRepliesDismissed) return;
  if (document.querySelectorAll('.chat-message-from-user').length > 0) {
    document.querySelector('.flor-quick-wrap')?.remove();
    return;
  }
  if (document.querySelector('.flor-quick-wrap')) return;
  const list = document.querySelector('.chat-messages-list');
  if (!list?.parentNode) return;

  const wrap = document.createElement('div');
  wrap.className = 'flor-quick-replies';
  QUICK_OPTIONS.forEach(option => {
    const btn = document.createElement('button');
    btn.className = 'flor-quick-btn';
    btn.textContent = option.label;
    btn.addEventListener('click', () => {
      window.__florQuickRepliesDismissed = true;
      if (option.message) sendFlorMessage(option.message);
      else document.querySelector('.chat-input textarea, .chat-footer textarea')?.focus();
      outerWrap.remove();
    });
    wrap.appendChild(btn);
  });

  const outerWrap = document.createElement('div');
  outerWrap.className = 'flor-quick-wrap';
  outerWrap.appendChild(wrap);
  list.appendChild(outerWrap);
}

/* ── Links del bot ──────────────────────────────────────── */
// @n8n/chat renderiza con markdown-it y sus opciones de fábrica, así que los <a> salen sin
// target: el link se abre en la MISMA pestaña y el cliente que está comprando pierde el chat
// y el carrito. markdown-it tampoco deja pasar HTML crudo (html: false), así que el target no
// se puede mandar desde el mensaje: va acá, después de cada render.
function openLinksInNewTab() {
  document.querySelectorAll('.chat-message-from-bot .chat-message-markdown a:not([data-flor-link])').forEach(link => {
    link.dataset.florLink = '1';
    const href = link.getAttribute('href') || '';
    // mailto: y tel: abren la app del sistema; una pestaña vacía de más sólo molesta.
    if (/^(mailto:|tel:|#)/i.test(href)) return;
    link.target = '_blank';
    link.rel    = 'noopener noreferrer';
  });
}

// Saca un marcador del mensaje SIN tocar el HTML que lo rodea.
// Asignar `textContent` reemplaza todo el contenido del nodo por texto plano: los <a> que
// markdown-it había generado desaparecen y el link deja de poder tocarse. Se recorren sólo los
// nodos de texto, que es donde vive el marcador.
function stripMarker(container, pattern) {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const hits = [];
  while (walker.nextNode()) {
    if (pattern.test(walker.currentNode.nodeValue)) hits.push(walker.currentNode);
  }
  hits.forEach(node => { node.nodeValue = node.nodeValue.replace(pattern, ''); });
  // El párrafo que quedó vacío porque SÓLO tenía el marcador no deja un hueco en la burbuja.
  container.querySelectorAll('p').forEach(p => {
    if (!p.textContent.trim() && !p.querySelector('img, a, br')) p.remove();
  });
}

/* ── Tarjetas de producto ───────────────────────────────── */
const PRODUCT_CARD_PATTERN = /\[\[PRODUCT_CARD:([^\s:[\]]+):([0-9]+)\]\]/i;
// La misma, con `g`, SÓLO para recorrer todas las coincidencias del mensaje.
// ⚠️ No usar ésta en stripMarker: ahí el pattern pasa por `test()` dentro de un while y un
// regex global es stateful (lastIndex avanza entre llamadas), así que saltearía nodos de texto.
const PRODUCT_CARD_PATTERN_ALL = /\[\[PRODUCT_CARD:([^\s:[\]]+):([0-9]+)\]\]/gi;

async function injectProductCards() {
  document.querySelectorAll('.chat-message-from-bot:not([data-flor-card-checked])').forEach(async message => {
    const markdown = message.querySelector('.chat-message-markdown');
    if (!markdown) return;
    // TODAS las tarjetas del mensaje, no sólo la primera: una compra de pack son 3 o 4
    // productos, y con una por mensaje el cliente necesita un turno para ver cada uno.
    const matches = [...markdown.textContent.matchAll(PRODUCT_CARD_PATTERN_ALL)];
    if (!matches.length) { message.dataset.florCardChecked = '1'; return; }
    message.dataset.florCardChecked = '1';

    for (const match of matches) {
    const handle    = match[1];
    const variantId = match[2];
    // Sin `g`: cada llamada borra el primer marcador que queda, que es el que se acaba de leer.
    stripMarker(markdown, PRODUCT_CARD_PATTERN);

    try {
      const root     = window.Shopify?.routes?.root || '/';
      const response = await fetch(root + 'products/' + encodeURIComponent(handle) + '.js');
      if (!response.ok) continue;   // el siguiente marcador puede estar bien
      const product = await response.json();
      const variant  = (product.variants || []).find(v => String(v.id) === variantId && v.available);
      if (!variant) continue;        // agotada: se saltea, las otras siguen

      const card = document.createElement('div');
      card.className = 'flor-product-card';
      message.classList.add('flor-has-card');

      const url = root + 'products/' + encodeURIComponent(handle) + '?variant=' + variantId;
      const linkWrap = (child) => {
        const a = document.createElement('a');
        a.className = 'flor-product-link';
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.addEventListener('click', () => trackFlorEvent('producto_abierto', { product_handle: handle, variant_id: variantId }));
        a.appendChild(child);
        return a;
      };

      // La foto de la VARIANTE elegida, no la del producto: en la Edición Limitada el diseño es
      // la decisión de compra y los 10 diseños comparten la imagen principal. Si la variante no
      // tiene imagen propia (los accesorios, que son de variante única), cae en la del producto.
      const cardImage = (variant.featured_image && variant.featured_image.src) || product.featured_image;
      if (cardImage) {
        const img = document.createElement('img');
        img.src = cardImage;
        img.alt = product.title + (variant.title !== 'Default Title' ? ' - ' + variant.title : '');
        card.appendChild(linkWrap(img));
      }

      const content = document.createElement('div');
      content.className = 'flor-product-content';

      const title = document.createElement('p');
      title.className = 'flor-product-title';
      title.textContent = product.title;

      const option = document.createElement('p');
      option.className = 'flor-product-option';
      option.textContent = variant.title === 'Default Title' ? 'Disponible' : variant.title;

      const row   = document.createElement('div');
      row.className = 'flor-product-row';

      const price = document.createElement('span');
      price.className = 'flor-product-price';
      price.textContent = new Intl.NumberFormat('es-AR', {
        style: 'currency', currency: 'ARS', maximumFractionDigits: 0
      }).format(variant.price / 100);

      if (variant.compare_at_price > variant.price) {
        const old = document.createElement('span');
        old.className = 'flor-product-price-old';
        old.textContent = new Intl.NumberFormat('es-AR', {
          style: 'currency', currency: 'ARS', maximumFractionDigits: 0
        }).format(variant.compare_at_price / 100);
        price.classList.add('flor-product-price--sale');
        row.append(old);
      }

      const add = document.createElement('button');
      add.className  = 'flor-add-btn';
      add.type       = 'button';
      add.textContent = 'Agregar';
      let yaAgregado = false;
      add.addEventListener('click', async () => {
        if (yaAgregado) {
          trackFlorEvent('ir_al_carrito', { product_handle: handle });
          window.location.href = root + 'cart';
          return;
        }
        add.disabled    = true;
        add.textContent = 'Agregando...';
        try {
          const res = await fetch(root + 'cart/add.js', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: [{ id: Number(variantId), quantity: 1 }] })
          });
          if (!res.ok) throw new Error('cart');
          await markAssistedCart();
          trackFlorEvent('agregado_carrito_chat', { product_handle: handle, variant_id: variantId });
          yaAgregado      = true;
          add.disabled    = false;
          add.innerHTML   = 'Ir al carrito &nbsp;&rarr;';
          document.dispatchEvent(new CustomEvent('cart:refresh'));
        } catch (_) {
          add.disabled    = false;
          add.textContent = 'Reintentar';
        }
      });

      row.append(price, add);
      content.append(linkWrap(title), option, row);
      card.appendChild(content);
      message.appendChild(card);
      trackFlorEvent('producto_recomendado',   { product_handle: handle, variant_id: variantId });
      trackFlorEvent('tarjeta_producto_vista', { product_handle: handle, variant_id: variantId });
    } catch (_) {}
    }
  });
}

/* ── Tarjeta consulta de pedido ─────────────────────────── */
const ORDER_LOOKUP_PATTERN = /\[\[ORDER_LOOKUP\]\]/i;

function injectOrderLookup() {
  document.querySelectorAll('.chat-message-from-bot:not([data-flor-order-checked])').forEach(message => {
    const markdown = message.querySelector('.chat-message-markdown');
    if (!markdown) return;
    if (!ORDER_LOOKUP_PATTERN.test(markdown.textContent)) {
      message.dataset.florOrderChecked = '1';
      return;
    }
    message.dataset.florOrderChecked = '1';

    stripMarker(markdown, ORDER_LOOKUP_PATTERN);
    if (!markdown.textContent.trim()) markdown.style.display = 'none';
    message.classList.add('flor-has-card');

    const card = document.createElement('div');
    card.className = 'flor-order-card';
    card.innerHTML = `
      <div class="flor-order-title">Consultar estado de tu pedido</div>
      <div class="flor-order-desc">Ingresá el email con el que compraste y tu número de pedido. El número está en el mail de confirmación de la compra: son 5 cifras, tipo #21234.</div>
      <div class="flor-order-field">
        <label class="flor-order-label">Email</label>
        <input class="flor-order-input" type="email" placeholder="tu@email.com" autocomplete="email" />
        <span class="flor-order-error">Este campo es obligatorio</span>
      </div>
      <div class="flor-order-field">
        <label class="flor-order-label">Número de pedido</label>
        <input class="flor-order-input" type="text" inputmode="numeric" enterkeyhint="send" placeholder="ej: 21234" autocomplete="off" />
        <span class="flor-order-error">Este campo es obligatorio</span>
      </div>
      <button class="flor-order-btn" type="button">Consultar pedido &nbsp;&rarr;</button>
    `;

    const [emailInput, orderInput] = card.querySelectorAll('.flor-order-input');
    const [emailError, orderError] = card.querySelectorAll('.flor-order-error');
    const submitBtn = card.querySelector('.flor-order-btn');


    function clearError(input, errorEl) {
      input.classList.remove('flor-order-input--error');
      errorEl.classList.remove('flor-order-error--visible');
      errorEl.textContent = 'Este campo es obligatorio';
    }

    // Los inputs cuelgan de divs, no de un <form>: sin esto Enter no hace nada.
    [emailInput, orderInput].forEach(input => {
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); submitBtn.click(); }
      });
    });
    emailInput.addEventListener('input', () => clearError(emailInput, emailError));
    orderInput.addEventListener('input', () => clearError(orderInput, orderError));

    submitBtn.addEventListener('click', () => {
      let valid = true;
      if (!emailInput.value.trim()) {
        emailInput.classList.add('flor-order-input--error');
        emailError.classList.add('flor-order-error--visible');
        valid = false;
      }
      if (emailInput.value.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailInput.value.trim())) {
        emailInput.classList.add('flor-order-input--error');
        emailError.textContent = 'Revisá el email: parece que falta algo';
        emailError.classList.add('flor-order-error--visible');
        valid = false;
      }
      if (!orderInput.value.trim()) {
        orderInput.classList.add('flor-order-input--error');
        orderError.classList.add('flor-order-error--visible');
        valid = false;
      }
      if (!valid) return;

      submitBtn.disabled    = true;
      submitBtn.textContent = 'Consultando...';
      card.querySelectorAll('.flor-order-input').forEach(i => i.disabled = true);

      sendFlorMessage(`Mi email es ${emailInput.value.trim()} y mi número de orden es ${orderInput.value.trim()}`);
      trackFlorEvent('consulta_pedido_enviada');
    });

    message.appendChild(card);
  });
}

/* ── Tracking mensajes usuario ──────────────────────────── */
function trackUserMessages() {
  document.querySelectorAll('.chat-message-from-user:not([data-flor-tracked])').forEach(msg => {
    msg.dataset.florTracked = '1';
    trackFlorEvent('mensaje_enviado');
  });
}

/* ── Ícono toggle custom (burbuja estilo WhatsApp) ──────── */
function injectToggleIcon() {
  const toggle = document.querySelector('.chat-window-toggle');
  if (!toggle) return;
  if (toggle.querySelector('svg[data-flor-icon]')) return;
  toggle.querySelectorAll('svg, img').forEach(el => el.remove());
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '27');
  svg.setAttribute('height', '27');
  svg.setAttribute('fill', 'white');
  svg.setAttribute('data-flor-icon', '1');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.cssText = 'display:block;pointer-events:none;flex-shrink:0';
  svg.innerHTML = '<path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>';
  toggle.appendChild(svg);
}

/* ── Animación toggle ───────────────────────────────────── */
function animateToggle() {
  const toggle = document.querySelector('.chat-window-toggle');
  if (!toggle || toggle.dataset.florAnim) return;
  toggle.dataset.florAnim = '1';
  toggle.style.animation = 'florToggleIn 0.35s ease-out 0.7s both';
  toggle.addEventListener('animationend', () => { toggle.style.animation = ''; }, { once: true });
}

function autoStart() {
  if (window.__florStarted) return;
  const btn = document.querySelector('.chat-get-started-footer button');
  if (btn) { window.__florStarted = true; btn.click(); }
}

function hideBranding() {
  document.querySelectorAll('.chat-powered-by').forEach(el => {
    el.style.cssText += 'display:none!important';
  });
}

/* ── Status messages (pensando) auto-remove ─────────────── */
const TRANSIENT_STATUS_MESSAGES = new Set(['Buscando...', 'Consultando...', 'Procesando...']);

function markAndCleanStatusMessages() {
  const botMessages = document.querySelectorAll('.chat-message-from-bot');
  botMessages.forEach(msg => {
    const markdown = msg.querySelector('.chat-message-markdown');
    if (!markdown) return;
    const text = markdown.textContent.trim();
    if (TRANSIENT_STATUS_MESSAGES.has(text) && !msg.dataset.florStatusChecked) {
      msg.dataset.florStatusChecked = '1';
      msg.dataset.florStatus = 'pending';
      msg.style.cssText += 'transition:opacity 0.25s,max-height 0.3s;';
    }
    if (!TRANSIENT_STATUS_MESSAGES.has(text) && text.length > 0 && !msg.dataset.florStatusChecked) {
      msg.dataset.florStatusChecked = '1';
      document.querySelectorAll('[data-flor-status="pending"]').forEach(status => {
        status.style.opacity = '0';
        status.style.maxHeight = '0';
        status.style.overflow = 'hidden';
        status.style.marginTop = '0';
        status.style.marginBottom = '0';
        setTimeout(() => status.remove(), 300);
      });
    }
  });
}

/* ── Datos copiables ────────────────────────────────────── */
// La tienda bloquea copiar con un `user-select: none` global más `selectstart`/`contextmenu`
// en preventDefault, y eso alcanza a las burbujas del chat: el cliente NO puede copiar el
// número de seguimiento ni el mail de soporte que le da Flor. Ganarle a esos handlers desde
// acá se puede, pero se rompe el día que alguien toque el theme, y en el celular seleccionar
// 19 dígitos a dedo dentro de una burbuja es un suplicio igual. Así que el dato deja de ser
// texto para seleccionar y pasa a ser un botón.
//
// Medido sobre 337 respuestas reales: el mail aparece en el 27,9 % y el seguimiento en el
// 4,2 %. Los 9 números de seguimiento distintos son TODOS de 19 dígitos con prefijo 93621, y
// no hay ningún otro número de 17+ dígitos en las respuestas: por eso alcanza con detectarlo
// por forma, sin pedirle al bot que emita un marcador.
const COPIABLES = [
  { tipo: 'seguimiento', rx: /\b\d{17,22}\b/g,                    mono: true  },
  { tipo: 'mail',        rx: /[a-z0-9._%+-]+@altomatee\.com\.ar/gi, mono: false },
];
const OCA_SEGUIMIENTOS = 'https://www.oca.com.ar/Busquedas/Seguimientos';

const ICONO_COPIAR = '<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path fill="currentColor" d="M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1Zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Zm0 16H8V7h11v14Z"/></svg>';
const ICONO_LISTO  = '<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path fill="currentColor" d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17Z"/></svg>';

// El portapapeles moderno pide contexto seguro y gesto del usuario; el click lo es. El
// fallback necesita `user-select: text` PROPIO: si no, el bloqueo global de la tienda le pega
// justo al textarea que usamos para copiar y falla en silencio.
async function florCopiar(texto) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(texto);
      return true;
    }
  } catch (_) { }
  try {
    const ta = document.createElement('textarea');
    ta.value = texto;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:-1000px;left:-1000px;opacity:0;user-select:text!important;-webkit-user-select:text!important;';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, texto.length);
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch (_) { return false; }
}

function florChipCopiable(valor, tipo, mono) {
  const chip = document.createElement('span');
  chip.className = 'flor-copy' + (mono ? ' flor-copy-mono' : '');
  chip.setAttribute('role', 'button');
  chip.setAttribute('tabindex', '0');
  chip.setAttribute('aria-label', 'Copiar ' + (tipo === 'mail' ? 'el mail' : 'el número de seguimiento') + ': ' + valor);
  chip.dataset.florValor = valor;
  chip.innerHTML = '<span class="flor-copy-txt"></span><span class="flor-copy-ico">' + ICONO_COPIAR + '</span>';
  chip.querySelector('.flor-copy-txt').textContent = valor;

  let volviendo;
  const copiar = async () => {
    const ok = await florCopiar(valor);
    const txt = chip.querySelector('.flor-copy-txt');
    const ico = chip.querySelector('.flor-copy-ico');
    // Sin confirmación visible el cliente toca dos veces y no sabe si funcionó.
    chip.classList.add(ok ? 'flor-copy-ok' : 'flor-copy-fallo');
    txt.textContent = ok ? '¡Copiado!' : 'Copialo a mano';
    ico.innerHTML = ok ? ICONO_LISTO : ICONO_COPIAR;
    clearTimeout(volviendo);
    volviendo = setTimeout(() => {
      chip.classList.remove('flor-copy-ok', 'flor-copy-fallo');
      txt.textContent = valor;
      ico.innerHTML = ICONO_COPIAR;
    }, 2000);
  };
  chip.addEventListener('click', copiar);
  chip.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); copiar(); }
  });
  return chip;
}

function injectCopyables() {
  document.querySelectorAll('.chat-message-from-bot .chat-message-markdown:not([data-flor-copy])').forEach(markdown => {
    markdown.dataset.florCopy = '1';

    // Se camina por nodos de TEXTO: tocar innerHTML rompería los <a> que ya armó markdown-it.
    const paseo = document.createTreeWalker(markdown, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.parentElement.closest('a, .flor-copy'))
        ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
    });
    const textos = [];
    for (let n = paseo.nextNode(); n; n = paseo.nextNode()) textos.push(n);

    let hubo = null;
    for (const nodo of textos) {
      const original = nodo.nodeValue;
      let corte = 0;
      const frag = document.createDocumentFragment();
      const golpes = [];
      for (const { tipo, rx, mono } of COPIABLES) {
        rx.lastIndex = 0;
        for (let m = rx.exec(original); m; m = rx.exec(original)) {
          golpes.push({ inicio: m.index, fin: m.index + m[0].length, valor: m[0], tipo, mono });
        }
      }
      if (!golpes.length) continue;
      golpes.sort((a, b) => a.inicio - b.inicio);

      for (const g of golpes) {
        if (g.inicio < corte) continue;                       // solapados: gana el primero
        if (g.inicio > corte) frag.appendChild(document.createTextNode(original.slice(corte, g.inicio)));
        frag.appendChild(florChipCopiable(g.valor, g.tipo, g.mono));
        corte = g.fin;
        if (g.tipo === 'seguimiento') hubo = g.valor;
      }
      if (corte < original.length) frag.appendChild(document.createTextNode(original.slice(corte)));
      nodo.parentNode.replaceChild(frag, nodo);
    }

    // El link que da Flor es genérico (no lleva el número), así que el flujo real del cliente
    // es copiar → abrir → pegar. El atajo hace los dos primeros pasos de un toque.
    if (hubo && !markdown.querySelector('.flor-copy-oca')) {
      const fila = document.createElement('div');
      fila.className = 'flor-copy-acciones';
      const a = document.createElement('a');
      a.className = 'flor-copy-oca';
      a.href = OCA_SEGUIMIENTOS;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = 'Copiar y abrir OCA →';
      a.addEventListener('click', () => { florCopiar(hubo); });
      fila.appendChild(a);
      markdown.appendChild(fila);
    }
  });
}

/* ── Observer principal ─────────────────────────────────── */
let florCardDebounce;
let florHydrationFrame = null;
let florConversationChanged = false;

function hydrateWidget() {
  florHydrationFrame = null;
  injectHeader();
  hideBranding();
  autoStart();
  injectQuickReplies();
  injectOrderLookup();
  openLinksInNewTab();
  markAndCleanStatusMessages();
  clearTimeout(florCardDebounce);
  florCardDebounce = setTimeout(() => { injectProductCards(); injectCopyables(); }, 500);
  trackUserMessages();
  injectToggleIcon();
  animateToggle();
  setupChatStateObserver();
  setupMobileInputBehavior();
  setupConversationScroll();
  positionProactiveBlocks();

  if (florConversationChanged && florNearConversationEnd) {
    requestAnimationFrame(() => scrollConversationToEnd());
  }
  florConversationChanged = false;
}

new MutationObserver(records => {
  if (records.some(record => {
    const target = record.target.nodeType === Node.ELEMENT_NODE ? record.target : record.target.parentElement;
    return target?.closest?.('.chat-messages-list') ||
      Array.from(record.addedNodes).some(node => node.nodeType === Node.ELEMENT_NODE &&
        (node.matches?.('.chat-message, .chat-message-typing') || node.querySelector?.('.chat-message, .chat-message-typing')));
  })) florConversationChanged = true;

  if (florHydrationFrame === null) florHydrationFrame = requestAnimationFrame(hydrateWidget);
}).observe(document.body, { childList: true, subtree: true, characterData: true });

/* ── Trigger carrito inactivo ───────────────────────────── */
(function () {
  const CART_TIMEOUT_MS = 120_000; // 2 minutos
  const STORAGE_KEY     = 'flor_trigger_fired_v2';

  function wasFired(tipo) {
    try { return !!JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}')[tipo]; } catch (_) { return false; }
  }
  function markFired(tipo) {
    try {
      const data = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}');
      data[tipo] = true;
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (_) {}
  }
  function clearFired(tipo) {
    try {
      const data = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}');
      delete data[tipo];
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (_) {}
  }

  function showPreviewBubble(msg) {
    if (document.querySelector('.flor-preview-bubble')) return;
    const bubble = document.createElement('div');
    bubble.className = 'flor-preview-bubble';
    bubble.textContent = msg;
    bubble.setAttribute('role', 'button');
    bubble.setAttribute('tabindex', '0');
    bubble.setAttribute('aria-label', 'Abrir soporte');
    const openFromBubble = () => {
      bubble.remove();
      openChat();
    };
    bubble.addEventListener('click', openFromBubble);
    bubble.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openFromBubble();
      }
    });
    document.body.appendChild(bubble);
  }

  function showBadge() {
    const toggle = document.querySelector('.chat-window-toggle');
    if (!toggle || toggle.querySelector('.flor-badge')) return;
    toggle.dataset.florBadge = '1';
    const badge = document.createElement('div');
    badge.className   = 'flor-badge';
    badge.textContent = '1';
    toggle.style.position = 'relative';
    toggle.appendChild(badge);
    toggle.addEventListener('click', function removeBadge() {
      toggle.querySelector('.flor-badge')?.remove();
      delete toggle.dataset.florBadge;
      toggle.removeEventListener('click', removeBadge);
    }, { once: true });
  }

  function openChat() {
    const toggle  = document.querySelector('.chat-window-toggle');
    const chatWin = document.querySelector('.chat-window');
    if (toggle && chatWin && !chatWin.classList.contains('chat-open')) toggle.click();
  }

  function injectBotMessage(msg) {
    const attempt = (remaining) => {
      const lista = document.querySelector('.chat-messages-list');
      if (!lista) {
        if (remaining > 0) setTimeout(() => attempt(remaining - 1), 500);
        return;
      }
      if (lista.querySelector('.flor-proactive-block')) return;

      const block = document.createElement('div');
      block.className = 'flor-proactive-block';
      block.__florExistingUsers = new Set(
        Array.from(lista.children).filter(child =>
          child.classList?.contains('chat-message-from-user')
        )
      );
      const wrapper = document.createElement('div');
      wrapper.className = 'chat-message chat-message-from-bot';
      wrapper.dataset.florProactiveMessage = '1';
      wrapper.innerHTML = `<div class="chat-message-bubble"><div class="chat-message-markdown">${msg}</div></div>`;
      block.appendChild(wrapper);

      if (msg === '¿Necesitás ayuda antes de confirmar tu compra?') {
        const actions = document.createElement('div');
        actions.className = 'flor-cart-actions';
        [
          ['Consultar envío',   'Estoy por terminar mi compra y quiero consultar el envío.'],
          ['Medios de pago',    'Estoy por terminar mi compra y quiero consultar los medios de pago.']
        ].forEach(([label, text]) => {
          const btn = document.createElement('button');
          btn.type        = 'button';
          btn.className   = 'flor-cart-action';
          btn.textContent = label;
          btn.addEventListener('click', () => {
            trackFlorEvent('aviso_carrito_respondido', { trigger_type: 'carrito_inactivo' });
            sendFlorMessage(text);
            actions.remove();
          });
          actions.appendChild(btn);
        });
        block.appendChild(actions);
      }
      lista.appendChild(block);
      positionProactiveBlocks();
      lista.scrollTop = lista.scrollHeight;
    };
    attempt(12);
  }

  function fireTrigger(tipo, msg) {
    if (wasFired(tipo)) return;
    markFired(tipo);
    markAssistedCart();
    trackFlorEvent('aviso_carrito_mostrado', { trigger_type: tipo });
    showBadge();
    showPreviewBubble(msg);  // burbuja chiquita, no abre el chat
    injectBotMessage(msg);   // mensaje ya listo adentro cuando abra
  }

  let cartTimer      = null;
  let carritoAbierto = false;

  function isCartOpen() {
    return document.documentElement.classList.contains('kaching-body__cart-open') ||
      document.body.classList.contains('kaching-body__cart-open');
  }

  function syncCartState() {
    const abierto = isCartOpen();
    if (abierto && !carritoAbierto) {
      carritoAbierto = true;
      if (!wasFired('carrito_inactivo')) {
        clearTimeout(cartTimer);
        cartTimer = setTimeout(
          () => fireTrigger('carrito_inactivo', '¿Necesitás ayuda antes de confirmar tu compra?'),
          CART_TIMEOUT_MS
        );
      }
    } else if (!abierto && carritoAbierto) {
      carritoAbierto = false;
      clearTimeout(cartTimer);
      clearFired('carrito_inactivo');
      document.querySelector('.flor-preview-bubble')?.remove();
    }
  }

  new MutationObserver(() => {
    syncCartState();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  new MutationObserver(syncCartState).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  syncCartState();
})();
