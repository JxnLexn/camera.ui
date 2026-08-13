import type { Ref } from 'vue';

const EDGE_SIZE = 72;
const MAX_SPEED = 18;

export function useDragAutoScroll(elRef: Ref<HTMLElement | null>, dragging: Ref<boolean>): void {
  let frame: number | undefined;
  let container: HTMLElement | null = null;
  let pointerY: number | undefined;

  function onMove(event: Event): void {
    const point = 'touches' in event ? (event as TouchEvent).touches[0] : (event as MouseEvent);
    if (point) {
      pointerY = point.clientY;
    }
  }

  function step(): void {
    frame = requestAnimationFrame(step);
    if (!container || pointerY === undefined) {
      return;
    }

    const rect = container.getBoundingClientRect();
    const fromTop = pointerY - rect.top;
    const fromBottom = rect.bottom - pointerY;

    if (fromTop < EDGE_SIZE) {
      container.scrollTop -= speed(EDGE_SIZE - fromTop);
    } else if (fromBottom < EDGE_SIZE) {
      container.scrollTop += speed(EDGE_SIZE - fromBottom);
    }
  }

  function start(): void {
    container = scrollParent(elRef.value);
    if (!container) {
      return;
    }

    pointerY = undefined;
    for (const type of ['dragover', 'pointermove', 'touchmove']) {
      window.addEventListener(type, onMove, { passive: true });
    }
    frame = requestAnimationFrame(step);
  }

  function stop(): void {
    if (frame !== undefined) {
      cancelAnimationFrame(frame);
      frame = undefined;
    }
    for (const type of ['dragover', 'pointermove', 'touchmove']) {
      window.removeEventListener(type, onMove);
    }
    container = null;
  }

  watch(dragging, (isDragging) => (isDragging ? start() : stop()));
  onBeforeUnmount(stop);
}

function speed(depth: number): number {
  return Math.ceil((Math.min(depth, EDGE_SIZE) / EDGE_SIZE) * MAX_SPEED);
}

function scrollParent(el: HTMLElement | null): HTMLElement | null {
  let node = el?.parentElement ?? null;
  while (node) {
    const { overflowY } = getComputedStyle(node);
    if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}
