/**
 * automatik-widget / widget.js
 * Versión: 1.1.3
 * Fecha:   2026-05-29
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

import { createChat } from 'https://cdn.jsdelivr.net/npm/@n8n/chat/chat.bundle.es.js';

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

/* ── Helpers horario ────────────────────────────────────── */
const argHour = () => {
  const utc = Date.now() + new Date().getTimezoneOffset() * 60000;
  return new Date(utc - 3 * 3600000).getHours();
};
const isOnline = argHour() >= 7;
if (!isOnline) document.documentElement.classList.add('chat-offline');

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
      ? 'Hola. ¿En qué te podemos ayudar?'
      : 'Hola. Ahora estamos fuera de horario; respondemos desde las 7 AM.'
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
      title:               'Soporte',
      subtitle:            isOnline ? 'En línea' : 'Volvemos a las 7 AM',
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
  avatar.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a8 8 0 0 0-8 8v5a3 3 0 0 0 3 3h2v-7H6v-1a6 6 0 0 1 12 0v1h-3v7h3a3 3 0 0 0 3-3v-5a8 8 0 0 0-8-8Z"/></svg>`;

  const textDiv = document.createElement('div');
  textDiv.className = 'flor-header-text';
  textDiv.innerHTML = `
    <div class="flor-header-title">Soporte</div>
    <div class="flor-header-subtitle">
      <span class="flor-dot"></span>
      <span>${isOnline ? 'ALTO MATÉ' : 'Volvemos a las 7 AM'}</span>
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
    document.body.classList.toggle('flor-chat-open', isOpen);
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
      if (option.message) sendFlorMessage(option.message);
      else document.querySelector('.chat-input textarea, .chat-footer textarea')?.focus();
      outerWrap.remove();
    });
    wrap.appendChild(btn);
  });

  const outerWrap = document.createElement('div');
  outerWrap.className = 'flor-quick-wrap';
  outerWrap.appendChild(wrap);
  list.parentNode.insertBefore(outerWrap, list);
}

/* ── Tarjetas de producto ───────────────────────────────── */
const PRODUCT_CARD_PATTERN = /\[\[PRODUCT_CARD:([^\s:[\]]+):([0-9]+)\]\]/i;

async function injectProductCards() {
  document.querySelectorAll('.chat-message-from-bot:not([data-flor-card-checked])').forEach(async message => {
    const markdown = message.querySelector('.chat-message-markdown');
    if (!markdown) return;
    const match = markdown.textContent.match(PRODUCT_CARD_PATTERN);
    if (!match) { message.dataset.florCardChecked = '1'; return; }
    message.dataset.florCardChecked = '1';

    const handle    = match[1];
    const variantId = match[2];
    markdown.textContent = markdown.textContent.replace(PRODUCT_CARD_PATTERN, '').trim();

    try {
      const root     = window.Shopify?.routes?.root || '/';
      const response = await fetch(root + 'products/' + encodeURIComponent(handle) + '.js');
      if (!response.ok) return;
      const product = await response.json();
      const variant  = (product.variants || []).find(v => String(v.id) === variantId && v.available);
      if (!variant) return;

      const card = document.createElement('div');
      card.className = 'flor-product-card';
      message.classList.add('flor-has-card');

      if (product.featured_image) {
        const img = document.createElement('img');
        img.src = product.featured_image;
        img.alt = product.title;
        card.appendChild(img);
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

      const add = document.createElement('button');
      add.className  = 'flor-add-btn';
      add.type       = 'button';
      add.textContent = 'Agregar';
      add.addEventListener('click', async () => {
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
          add.textContent = 'Agregado';
          document.dispatchEvent(new CustomEvent('cart:refresh'));
        } catch (_) {
          add.disabled    = false;
          add.textContent = 'Reintentar';
        }
      });

      row.append(price, add);
      content.append(title, option, row);
      card.appendChild(content);
      message.appendChild(card);
      trackFlorEvent('producto_recomendado',   { product_handle: handle, variant_id: variantId });
      trackFlorEvent('tarjeta_producto_vista', { product_handle: handle, variant_id: variantId });
    } catch (_) {}
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

    markdown.textContent = markdown.textContent.replace(ORDER_LOOKUP_PATTERN, '').trim();
    if (!markdown.textContent) markdown.style.display = 'none';
    message.classList.add('flor-has-card');

    const card = document.createElement('div');
    card.className = 'flor-order-card';
    card.innerHTML = `
      <div class="flor-order-title">Consultar estado de tu pedido</div>
      <div class="flor-order-desc">Para encontrar tu pedido necesitamos verificar tu identidad.</div>
      <div class="flor-order-field">
        <label class="flor-order-label">Email <span class="flor-order-req">*</span></label>
        <input class="flor-order-input" type="email" placeholder="tu@email.com" autocomplete="email" />
        <span class="flor-order-error">Este campo es obligatorio</span>
      </div>
      <div class="flor-order-field">
        <label class="flor-order-label">Número de orden <span class="flor-order-req">*</span></label>
        <input class="flor-order-input" type="text" placeholder="ej: 1234" autocomplete="off" />
        <span class="flor-order-error">Este campo es obligatorio</span>
      </div>
      <div class="flor-order-note">* Campos obligatorios</div>
      <button class="flor-order-btn" type="button" disabled>Consultar pedido</button>
    `;

    const [emailInput, orderInput] = card.querySelectorAll('.flor-order-input');
    const [emailError, orderError] = card.querySelectorAll('.flor-order-error');
    const submitBtn = card.querySelector('.flor-order-btn');

    function checkFields() {
      submitBtn.disabled = !(emailInput.value.trim() && orderInput.value.trim());
    }
    emailInput.addEventListener('input', checkFields);
    orderInput.addEventListener('input', checkFields);

    function clearError(input, errorEl) {
      input.classList.remove('flor-order-input--error');
      errorEl.classList.remove('flor-order-error--visible');
    }
    emailInput.addEventListener('input', () => clearError(emailInput, emailError));
    orderInput.addEventListener('input', () => clearError(orderInput, orderError));

    submitBtn.addEventListener('click', () => {
      let valid = true;
      if (!emailInput.value.trim()) {
        emailInput.classList.add('flor-order-input--error');
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
  toggle.style.animation = 'florToggleIn 0.55s cubic-bezier(0.34,1.56,0.64,1) 0.7s both';
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

/* ── Observer principal ─────────────────────────────────── */
let florCardDebounce;
new MutationObserver(() => {
  injectHeader();
  hideBranding();
  autoStart();
  injectQuickReplies();
  injectOrderLookup();
  clearTimeout(florCardDebounce);
  florCardDebounce = setTimeout(injectProductCards, 500);
  trackUserMessages();
  injectToggleIcon();
  animateToggle();
  setupChatStateObserver();
}).observe(document.body, { childList: true, subtree: true, characterData: true });

/* ── Trigger carrito inactivo ───────────────────────────── */
(function () {
  const CART_TIMEOUT_MS = 120_000; // 2 minutos
  const STORAGE_KEY     = 'flor_trigger_fired';

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

  function showPreviewBubble(msg) {
    if (document.querySelector('.flor-preview-bubble')) return;
    const bubble = document.createElement('div');
    bubble.className = 'flor-preview-bubble';
    bubble.textContent = msg;
    bubble.addEventListener('click', () => {
      bubble.remove();
      openChat();
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
    setTimeout(() => {
      const lista = document.querySelector('.chat-messages-list');
      if (!lista) return;
      const wrapper = document.createElement('div');
      wrapper.className = 'chat-message chat-message-from-bot';
      wrapper.innerHTML = `<div class="chat-message-bubble"><div class="chat-message-markdown">${msg}</div></div>`;
      lista.appendChild(wrapper);

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
        lista.appendChild(actions);
      }
      lista.scrollTop = lista.scrollHeight;
    }, 600);
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

  new MutationObserver(() => {
    const abierto = document.documentElement.classList.contains('kaching-body__cart-open');
    if (abierto && !carritoAbierto) {
      carritoAbierto = true;
      if (!wasFired('carrito_inactivo')) {
        cartTimer = setTimeout(
          () => fireTrigger('carrito_inactivo', '¿Necesitás ayuda antes de confirmar tu compra?'),
          CART_TIMEOUT_MS
        );
      }
    } else if (!abierto && carritoAbierto) {
      carritoAbierto = false;
      clearTimeout(cartTimer);
      document.querySelector('.flor-preview-bubble')?.remove();
    }
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
})();
