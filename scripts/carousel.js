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
export const MARQUEE_SPEED_PX_PER_SEC = 75;

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
    ) {
      offset = wrapOffset(offset + MARQUEE_SPEED_PX_PER_SEC * (dt / 1000), cycle);
    }
    render();
    window.requestAnimationFrame(tick);
  }

  /** pointerdown: congela la deriva y arranca el arrastre libre. */
  function handlePointerDown(event) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (!cycle) return;
    dragging = true;
    nudge = null; // el gesto manual cancela un empujón en curso
    activePointerId = event.pointerId;
    dragStartX = event.clientX;
    dragStartOffset = offset;
  }

  /** pointermove: traslada la pista siguiendo al puntero (scrub libre). */
  function handlePointerMove(event) {
    if (!dragging || event.pointerId !== activePointerId) return;
    offset = wrapOffset(dragStartOffset - (event.clientX - dragStartX), cycle);
  }

  /** pointerup/cancel: suelta sin snap; la deriva retoma desde el offset. */
  function handlePointerUp(event) {
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
