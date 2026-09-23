/**
 * carousel.js — Cinta continua (marquee) "Nuestros Trabajos".
 *
 * Deriva constante de derecha a izquierda (~75 px/s ≈ 60 s por ciclo en
 * desktop), loop infinito por clones con offset en px envuelto módulo el
 * ancho del contenido, pausa por hover del puntero, arrastre activo y foco
 * por teclado, y arrastre manual con Pointer Events que al soltar retoma
 * la deriva desde el offset liberado (sin snap). Con prefers-reduced-motion
 * nunca deriva solo (el arrastre y los botones siguen habilitados).
 */

/**
 * Envuelve un offset en px al rango [0, cycle) para el loop infinito.
 * Acepta negativos (arrastre hacia atrás) y valores mayores al ciclo.
 */
export function wrapOffset(offset, cycle) {
  if (!cycle) return 0;
  return ((offset % cycle) + cycle) % cycle;
}

/** Velocidad de la cinta en px/s (ciclo desktop ~4480 px ≈ 60 s). */
export const MARQUEE_SPEED_PX_PER_SEC = 45;

/** Duración del empujón de los botones prev/next (ms). */
const NUDGE_MS = 400;

/** Indica si el usuario prefiere movimiento reducido (bloquea la deriva). */
function prefersReducedMotion() {
  return typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** true si el foco llegó por teclado (:focus-visible) y no por un clic. */
function isKeyboardFocus(element) {
  if (!element || typeof element.matches !== 'function') return false;
  try {
    return element.matches(':focus-visible');
  } catch (_error) {
    return false; // entornos sin :focus-visible (p. ej. jsdom)
  }
}

/** ease-out cúbico para que el empujón de los botones se sienta suave. */
function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

/** Inicializa la cinta si su markup existe en el DOM (guardas defensivas). */
function initCarousel() {
  const carousel = document.querySelector('.trabajos-carousel');
  const viewport = carousel && carousel.querySelector('.carousel-viewport');
  const track = viewport && viewport.querySelector('.carousel-track');
  const prevButton = carousel && carousel.querySelector('.carousel-btn-prev');
  const nextButton = carousel && carousel.querySelector('.carousel-btn-next');
  if (!viewport || !track) return;

  const originals = Array.from(track.children);
  const itemCount = originals.length;
  if (!itemCount) return;

  // Evitar el arrastre nativo de imágenes (fantasma de drag)
  track.querySelectorAll('img').forEach((img) => {
    img.draggable = false;
  });
  track.addEventListener('dragstart', (event) => event.preventDefault());

  // Clones de un juego antes y otro después: hacen invisible el wrap del loop
  const buildCloneFragment = () => {
    const fragment = document.createDocumentFragment();
    originals.forEach((node) => {
      const clone = node.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      fragment.appendChild(clone);
    });
    return fragment;
  };
  track.insertBefore(buildCloneFragment(), track.firstChild);
  track.appendChild(buildCloneFragment());

  // Estado: offset libre en px (positivo = deriva hacia la izquierda)
  let stride = 0; // px entre el inicio de una tarjeta y la siguiente
  let cycle = 0; // ancho de un juego completo de tarjetas (stride * itemCount)
  let offset = 0;
  let hovering = false;
  let focused = false;
  let dragging = false;
  let activePointerId = null;
  let dragStartX = 0;
  let dragStartOffset = 0;
  let nudge = null; // { from, to, startedAt } mientras animan los botones
  let lastFrameAt = 0;

  // Image-only pinch zoom: two fingers scale the touched gallery image
  // (1x-3x via CSS transform, so layout never shifts). iOS Safari drives
  // it through gesture events; every other browser uses the two-pointer
  // Pointer Events fallback below. While zooming, marquee drift and
  // one-finger drag stay paused and resume on release.
  const PINCH_MAX_SCALE = 3;
  const PINCH_SNAP_BACK_BELOW = 1.05; // under this the image snaps back to 1x
  const pinchPointers = new Map(); // pointerId -> { x, y } of live touches
  const pinchScales = new WeakMap(); // img -> last released zoom (>= threshold persists)
  let pinching = false; // true while two pointers are scaling an image
  let gestureZoom = false; // true while Safari gesture events own the zoom
  let pinchImg = null; // the <img> under the pinch
  let pinchScale = 1; // live scale being painted
  let pinchStartDistance = 0;
  let pinchStartScale = 1;
  let gestureBaseScale = 1; // pinchScale captured at Safari gesturestart

  /** Mide el paso horizontal entre tarjetas y recalcula el ciclo. */
  function measure() {
    const first = track.children[0];
    const second = track.children[1];
    if (!first || !second) return;
    stride = second.getBoundingClientRect().left - first.getBoundingClientRect().left;
    cycle = stride * itemCount;
    if (cycle > 0) offset = wrapOffset(offset, cycle);
  }

  /** Aplica translateX al track desde el offset libre (sin transiciones). */
  function render() {
    track.style.transform = `translate3d(${-offset}px, 0, 0)`;
  }

  /** Empuja exactamente una tarjeta (±1) sin romper el estado del loop. */
  function nudgeBy(cards) {
    if (!cycle) return;
    nudge = { from: offset, to: offset + cards * stride, startedAt: performance.now() };
  }

  /** Bucle único: anima el empujón o la deriva y pinta en cada frame. */
  function tick(now) {
    // clamp del dt: evita un salto si la pestaña estuvo dormida
    const dt = lastFrameAt ? Math.min(now - lastFrameAt, 100) : 0;
    lastFrameAt = now;
    if (nudge) {
      const progress = Math.min((now - nudge.startedAt) / NUDGE_MS, 1);
      offset = nudge.from + (nudge.to - nudge.from) * easeOutCubic(progress);
      if (progress >= 1) {
        offset = wrapOffset(nudge.to, cycle);
        nudge = null;
      }
    } else if (
      dt > 0
      && cycle > 0
      && !prefersReducedMotion()
      && !hovering
      && !dragging
      && !focused
      && !pinching // two-finger zoom freezes the drift; it resumes on release
    ) {
      offset = wrapOffset(offset + MARQUEE_SPEED_PX_PER_SEC * (dt / 1000), cycle);
    }
    render();
    window.requestAnimationFrame(tick);
  }

  /** Scale kept for an image between pinches (1 when never zoomed). */
  function pinchCurrentScale(img) {
    return pinchScales.get(img) || 1;
  }

  /** Midpoint of the two live pointers, in client coordinates. */
  function pinchMidpoint() {
    const points = Array.from(pinchPointers.values());
    return { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
  }

  /** Distance between the two live pointers, in client px. */
  function pinchDistance() {
    const points = Array.from(pinchPointers.values());
    return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
  }

  /** Paint the scale on the image, snapping back to 1x under the threshold. */
  function renderPinch(scale) {
    pinchScale = Math.min(PINCH_MAX_SCALE, Math.max(1, scale));
    if (!pinchImg) return pinchScale;
    if (pinchScale < PINCH_SNAP_BACK_BELOW) {
      pinchScale = 1;
      pinchImg.style.transform = '';
      pinchImg.style.transformOrigin = '';
    } else {
      pinchImg.style.transform = `scale(${pinchScale})`;
    }
    return pinchScale;
  }

  /** Clear zoom state from an image (snap back to 1x, restore stacking). */
  function releasePinchZoom(img) {
    img.style.transform = '';
    img.style.transformOrigin = '';
    const item = img.closest('.trabajo-item');
    if (item) {
      item.style.zIndex = '';
      item.style.position = '';
    }
    pinchScales.delete(img);
  }

  /** Start scaling the touched image; freeze drift and drag. */
  function beginPinch(img, originClient) {
    // A pinch landing on another image releases the previous one first.
    if (pinchImg && pinchImg !== img) releasePinchZoom(pinchImg);
    pinchImg = img;
    pinching = true;
    dragging = false; // the two-finger gesture cancels any scrub in course
    const item = img.closest('.trabajo-item');
    if (item) {
      // transform never disturbs layout; the raised z-index only lets the
      // scaled image overlap its neighbors cleanly. Zoomed edges still
      // clip at .carousel-viewport (overflow hidden) by design.
      item.style.position = 'relative';
      item.style.zIndex = '3';
    }
    if (originClient) {
      const rect = img.getBoundingClientRect();
      const originX = rect.width ? ((originClient.x - rect.left) / rect.width) * 100 : 50;
      const originY = rect.height ? ((originClient.y - rect.top) / rect.height) * 100 : 50;
      img.style.transformOrigin = `${originX.toFixed(1)}% ${originY.toFixed(1)}%`;
    }
    pinchStartScale = pinchCurrentScale(img);
    pinchStartDistance = pinchDistance();
    renderPinch(pinchStartScale);
  }

  /** End the active pinch: snap back under ~1.05x, else keep the zoom. */
  function endPinch() {
    if (pinchImg) {
      if (pinchScale < PINCH_SNAP_BACK_BELOW) {
        releasePinchZoom(pinchImg);
      } else {
        pinchScales.set(pinchImg, pinchScale); // zoom persists after release
      }
    }
    pinchImg = null;
    pinchScale = 1;
    pinching = false;
    gestureZoom = false;
    dragging = false;
    activePointerId = null;
  }

  /** Gallery image under the event, if the gesture started on one. */
  function pinchTargetFromEvent(event) {
    const target = event.target && event.target.closest
      ? event.target.closest('.trabajo-item img')
      : null;
    return target && viewport.contains(target) ? target : null;
  }

  /** pointerdown: congela la deriva y arranca el arrastre libre. */
  function handlePointerDown(event) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (!cycle) return;
    pinchPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pinchPointers.size >= 2) {
      // Two fingers down: one-finger drag stays paused. The Pointer Events
      // fallback owns the gesture only when it started on a gallery image
      // (and Safari gesture events are not driving it).
      dragging = false;
      if (pinchPointers.size === 2 && !gestureZoom && !pinching) {
        const target = pinchTargetFromEvent(event);
        if (target) beginPinch(target, pinchMidpoint());
      }
      return;
    }
    if (pinching) return;
    dragging = true;
    nudge = null; // el gesto manual cancela un empujón en curso
    activePointerId = event.pointerId;
    dragStartX = event.clientX;
    dragStartOffset = offset;
  }

  /** pointermove: traslada la pista siguiendo al puntero (scrub libre). */
  function handlePointerMove(event) {
    if (pinchPointers.has(event.pointerId)) {
      pinchPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }
    // Two-pointer fallback (skipped while Safari gesture events drive).
    if (pinching && !gestureZoom && pinchImg && pinchPointers.size >= 2) {
      const distance = pinchDistance();
      if (pinchStartDistance > 0 && distance > 0) {
        renderPinch(pinchStartScale * (distance / pinchStartDistance));
      }
      return;
    }
    if (!dragging || event.pointerId !== activePointerId) return;
    offset = wrapOffset(dragStartOffset - (event.clientX - dragStartX), cycle);
  }

  /** pointerup/cancel: suelta sin snap; la deriva retoma desde el offset. */
  function handlePointerUp(event) {
    pinchPointers.delete(event.pointerId);
    if (pinching && pinchPointers.size < 2) {
      endPinch();
      // Resume the scrub with the finger that stayed down, if any, so the
      // release hands control straight back to drift + drag.
      if (pinchPointers.size === 1) {
        const remaining = Array.from(pinchPointers.entries())[0];
        activePointerId = remaining[0];
        dragStartX = remaining[1].x;
        dragStartOffset = offset;
        dragging = true;
      }
    }
    if (!dragging || event.pointerId !== activePointerId) return;
    dragging = false;
    activePointerId = null;
  }

  // Pausa por hover sobre la cinta (incluye los botones)
  carousel.addEventListener('pointerenter', () => {
    hovering = true;
  });
  carousel.addEventListener('pointerleave', () => {
    hovering = false;
  });

  // Pausa mientras el foco de teclado esté dentro del carrusel
  carousel.addEventListener('focusin', (event) => {
    focused = isKeyboardFocus(event.target);
  });
  carousel.addEventListener('focusout', (event) => {
    if (!carousel.contains(event.relatedTarget)) {
      focused = false;
    }
  });

  // Arrastre con Pointer Events (ratón, táctil y lápiz)
  viewport.addEventListener('pointerdown', handlePointerDown);
  window.addEventListener('pointermove', handlePointerMove, { passive: true });
  window.addEventListener('pointerup', handlePointerUp);
  window.addEventListener('pointercancel', handlePointerUp);

  // Safari gesture events (iOS path): the script owns the pinch, and
  // preventDefault() plus the CSS touch-action policy (no pinch-zoom
  // keyword anywhere on mobile) keep the browser page zoom off.
  // Browsers without these events use the two-pointer fallback above;
  // Android pinch is best-effort and works wherever Pointer Events
  // keep firing for both touches (no gesturestart/gesturechange there).
  viewport.addEventListener('gesturestart', (event) => {
    event.preventDefault();
    const target = pinchTargetFromEvent(event);
    if (!target) return;
    gestureZoom = true;
    if (!pinching) {
      beginPinch(target, pinchPointers.size >= 2 ? pinchMidpoint() : null);
    }
    gestureBaseScale = pinchScale;
  });
  viewport.addEventListener('gesturechange', (event) => {
    event.preventDefault();
    if (!pinching || !pinchImg) return;
    renderPinch(gestureBaseScale * event.scale);
  });
  viewport.addEventListener('gestureend', (event) => {
    if (event.cancelable) event.preventDefault();
    if (!pinching) {
      gestureZoom = false;
      return;
    }
    endPinch();
  });

  // Botones manuales (opcionales) para accesibilidad
  if (prevButton) prevButton.addEventListener('click', () => nudgeBy(-1));
  if (nextButton) nextButton.addEventListener('click', () => nudgeBy(1));

  // Resize: re-mide el paso y reenvuelve el offset sin saltos visibles
  window.addEventListener('resize', () => {
    measure();
    render();
  }, { passive: true });

  measure();
  if (!cycle) return;
  render();
  window.requestAnimationFrame(tick);
}

// Arranque defensivo: solo si el DOM de la sección ya está disponible
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCarousel, { once: true });
} else {
  initCarousel();
}
