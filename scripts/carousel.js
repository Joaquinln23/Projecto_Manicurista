/**
 * carousel.js — Carrusel "Nuestros Trabajos".
 *
 * Autoplay cada 4,5 s con looping continuo (un juego de clones antes y otro
 * después de las tarjetas originales), pausas por hover del puntero, arrastre
 * activo y foco por teclado, y arrastre manual con Pointer Events que al
 * soltar toma la tarjeta más cercana. Con prefers-reduced-motion nunca hace
 * autoplay (el arrastre y los botones siguen habilitados).
 */

/**
 * Redondea una posición fraccionaria (en unidades de tarjeta) al entero
 * más cercano. El wrapping al rango válido lo resuelve wrapIndex.
 */
export function snapToNearest(position) {
  return Math.round(position);
}

/**
 * Envuelve un índice al rango [0, itemCount) para el looping infinito.
 * Acepta negativos (arrastre hacia atrás) y valores mayores al total.
 */
export function wrapIndex(index, itemCount) {
  if (!itemCount) return 0;
  return ((index % itemCount) + itemCount) % itemCount;
}

// Configuración del carrusel
const AUTOPLAY_MS = 4500;
const SETTLE_MS = 680; // transición CSS (600 ms) + margen para el wrap

/** Indica si el usuario prefiere movimiento reducido (bloquea el autoplay). */
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

/** Extrae el desplazamiento X en px de la matriz de transform computada. */
function readTranslateX(element) {
  const computed = window.getComputedStyle(element).transform;
  if (!computed || computed === 'none') return null;
  const values = computed.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi);
  if (!values) return null;
  const parsed = values.map(Number);
  if (parsed.length === 6) return parsed[4]; // matrix(a,b,c,d,tx,ty)
  if (parsed.length === 16) return parsed[12]; // matrix3d → tx en [12]
  return null;
}

/** Inicializa el carrusel si su markup existe en el DOM (guardas defensivas). */
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

  // Clones de un juego antes y otro después: hacen invisible el wrap del looping
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

  // Estado: index en unidades de tarjeta (fraccionario durante el arrastre)
  let index = 0;
  let stride = 0; // px entre el inicio de una tarjeta y la siguiente
  let hovering = false;
  let focused = false;
  let dragging = false;
  let activePointerId = null;
  let dragStartX = 0;
  let dragStartIndex = 0;
  let settleTimer = 0;
  let autoplayTimer = 0;
  let instantMode = false; // true cuando el track está sin transición

  /** Mide el paso horizontal entre tarjetas (ancho + hueco). */
  function measure() {
    const first = track.children[0];
    const second = track.children[1];
    if (!first || !second) return;
    stride = second.getBoundingClientRect().left - first.getBoundingClientRect().left;
  }

  /** Aplica translateX al track; withTransition=false para saltos invisibles. */
  function render(withTransition) {
    if (instantMode === withTransition) {
      track.classList.toggle('no-transition', !withTransition);
      instantMode = !withTransition;
      void track.offsetWidth; // fuerza reflow antes de retomar la transición
    }
    track.style.transform = `translate3d(${-index * stride}px, 0, 0)`;
  }

  /** Anima hacia la tarjeta objetivo y normaliza el índice al terminar. */
  function animateTo(target) {
    index = target;
    render(true);
    window.clearTimeout(settleTimer);
    settleTimer = window.setTimeout(() => {
      index = wrapIndex(index, itemCount);
      render(false); // salto invisible: mismo contenido gracias a los clones
    }, SETTLE_MS);
  }

  /** Congela la posición visual actual (por si hay una transición en curso). */
  function freezePosition() {
    window.clearTimeout(settleTimer);
    if (stride > 0) {
      const translateX = readTranslateX(track);
      if (translateX !== null) index = -translateX / stride;
    }
    render(false);
  }

  /** Condiciones de autoplay: sin reduce-motion, hover, arrastre ni foco. */
  function canAutoplay() {
    return !prefersReducedMotion() && !hovering && !dragging && !focused;
  }

  /** (Re)programa el avance automático; se cancela si no debe correr. */
  function scheduleAutoplay() {
    window.clearTimeout(autoplayTimer);
    if (!canAutoplay()) return;
    autoplayTimer = window.setTimeout(() => {
      if (canAutoplay() && stride > 0) animateTo(index + 1);
      scheduleAutoplay();
    }, AUTOPLAY_MS);
  }

  /** Mueve una tarjeta en la dirección dada (±1) con animación. */
  function moveBy(direction) {
    if (!stride) return;
    freezePosition(); // posición visual real si hay una animación en curso
    index = wrapIndex(index, itemCount); // salto invisible: mismo contenido
    render(false);
    animateTo(index + direction);
    scheduleAutoplay(); // reinicia el temporizador si sigue permitido
  }

  /** pointerdown: congela la posición y arranca el arrastre. */
  function handlePointerDown(event) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (!stride) return;
    dragging = true;
    activePointerId = event.pointerId;
    dragStartX = event.clientX;
    freezePosition();
    dragStartIndex = index;
    scheduleAutoplay(); // dragging → cancela el autoplay de inmediato
  }

  /** pointermove: traslada la pista siguiendo al puntero (scrub). */
  function handlePointerMove(event) {
    if (!dragging || event.pointerId !== activePointerId) return;
    const offsetCards = (event.clientX - dragStartX) / stride;
    index = wrapIndex(dragStartIndex - offsetCards, itemCount);
    render(false);
  }

  /** pointerup/cancel: suelta, alinea a la tarjeta más cercana y reprograma. */
  function handlePointerUp(event) {
    if (!dragging || event.pointerId !== activePointerId) return;
    dragging = false;
    activePointerId = null;
    animateTo(snapToNearest(index));
    scheduleAutoplay();
  }

  // Pausa por hover sobre el carrusel (incluye los botones)
  carousel.addEventListener('pointerenter', () => {
    hovering = true;
    scheduleAutoplay();
  });
  carousel.addEventListener('pointerleave', () => {
    hovering = false;
    scheduleAutoplay();
  });

  // Pausa mientras el foco de teclado esté dentro del carrusel
  carousel.addEventListener('focusin', (event) => {
    focused = isKeyboardFocus(event.target);
    scheduleAutoplay();
  });
  carousel.addEventListener('focusout', (event) => {
    if (!carousel.contains(event.relatedTarget)) {
      focused = false;
      scheduleAutoplay();
    }
  });

  // Arrastre con Pointer Events (ratón, táctil y lápiz)
  viewport.addEventListener('pointerdown', handlePointerDown);
  window.addEventListener('pointermove', handlePointerMove, { passive: true });
  window.addEventListener('pointerup', handlePointerUp);
  window.addEventListener('pointercancel', handlePointerUp);

  // Botones manuales (opcionales) para accesibilidad
  if (prevButton) prevButton.addEventListener('click', () => moveBy(-1));
  if (nextButton) nextButton.addEventListener('click', () => moveBy(1));

  // Resize: re-mide el paso y reposiciona sin animación residual
  window.addEventListener('resize', () => {
    measure();
    index = wrapIndex(index, itemCount);
    render(true);
  }, { passive: true });

  measure();
  if (!stride) return;
  render(true);
  scheduleAutoplay();
}

// Arranque defensivo: solo si el DOM de la sección ya está disponible
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCarousel, { once: true });
} else {
  initCarousel();
}
