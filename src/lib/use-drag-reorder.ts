"use client";

import { useEffect, useRef, useState } from "react";

// Pointer-driven drag-to-reorder for a vertical list of ids.
//
// EXTRACTED VERBATIM FROM PriorityRanker (matchmaker.tsx), NOT REWRITTEN.
// That implementation cost two real-device passes to get right, and every
// non-obvious decision below is load-bearing -- see the comments. Rewriting
// the mechanics for the ranked-preference questions would have meant
// rediscovering the same four bugs. The logic is entirely id/index based
// with nothing priority-specific in it, so it generalises without change.
//
// WHY POINTER EVENTS AND NOT HTML5 DRAG-AND-DROP: native drag-and-drop has
// no touch support on mobile browsers at all -- touch-and-drag silently
// does nothing. That was the original bug this replaced.

/** Travel required before a second swap can commit, in DOCUMENT pixels. */
const SWAP_DEAD_ZONE_PX = 10;
/** Distance from a viewport edge at which dragging scrolls the page. */
const AUTOSCROLL_ZONE_PX = 80;
const AUTOSCROLL_MIN_SPEED_PX = 2;
const AUTOSCROLL_MAX_SPEED_PX = 14;

export interface DragReorder {
  /** Index currently being dragged, for the lift styling. */
  dragIndex: number | null;
  /** Ref callback for each row element, keyed by its id. */
  setItemRef: (id: string) => (el: HTMLElement | null) => void;
  handlePointerDown: (e: React.PointerEvent<HTMLElement>, index: number) => void;
  handlePointerMove: (e: React.PointerEvent<HTMLElement>) => void;
  handlePointerEnd: (e: React.PointerEvent<HTMLElement>) => void;
}

export function useDragReorder(order: string[], onReorder: (next: string[]) => void): DragReorder {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const dragIndexRef = useRef<number | null>(null);
  const itemRefs = useRef<Map<string, HTMLElement>>(new Map());

  // DOCUMENT-space Y of the last committed swap (clientY + scrollY), not
  // viewport-space, and that is essential rather than incidental: during
  // autoscroll the finger is typically held perfectly still, so its clientY
  // never changes, and a viewport-space dead zone would block every swap
  // after the first for the rest of the gesture. What the dead zone
  // actually cares about is relative travel between pointer and content,
  // which is document-space displacement.
  const lastSwapDocYRef = useRef<number | null>(null);
  // Most recent pointer Y, viewport coordinates. The rAF loop reads this
  // rather than waiting for a pointermove: while the finger is held still
  // inside an autoscroll zone no pointer events fire at all, but content is
  // moving underneath it, so rows still need re-evaluating every frame or
  // the drag silently does nothing while the page flies past.
  const lastClientYRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  // The loop must never read order/onReorder from the render closure it was
  // created in -- the caller lifts state, so a running loop's captured
  // props go stale the instant the first swap commits. Re-synced each render.
  const orderRef = useRef(order);
  orderRef.current = order;
  const onReorderRef = useRef(onReorder);
  onReorderRef.current = onReorder;

  function setItemRef(id: string) {
    return (el: HTMLElement | null) => {
      if (el) itemRefs.current.set(id, el);
      else itemRefs.current.delete(id);
    };
  }

  // Single-step neighbour test, not a nearest-slot scan. "Which row's
  // midpoint is the pointer past" could resolve differently on consecutive
  // events once the dragged row moved into its new slot, so a finger parked
  // near a boundary swapped back and forth indefinitely. This asks only
  // whether the pointer crossed the midpoint of the row immediately above
  // or below and moves at most one position, leaving a natural gap after
  // each swap. Live rects, not a pointerdown snapshot, because row heights
  // genuinely differ once labels wrap at phone widths.
  function neighbourSwapDirection(clientY: number): -1 | 0 | 1 {
    const current = dragIndexRef.current;
    if (current === null) return 0;
    const list = orderRef.current;

    if (current > 0) {
      const above = itemRefs.current.get(list[current - 1]);
      if (above) {
        const rect = above.getBoundingClientRect();
        if (clientY < rect.top + rect.height / 2) return -1;
      }
    }
    if (current < list.length - 1) {
      const below = itemRefs.current.get(list[current + 1]);
      if (below) {
        const rect = below.getBoundingClientRect();
        if (clientY > rect.top + rect.height / 2) return 1;
      }
    }
    return 0;
  }

  function maybeSwap(clientY: number) {
    const current = dragIndexRef.current;
    if (current === null) return;
    const docY = clientY + window.scrollY;
    if (
      lastSwapDocYRef.current !== null &&
      Math.abs(docY - lastSwapDocYRef.current) < SWAP_DEAD_ZONE_PX
    ) {
      return;
    }
    const direction = neighbourSwapDirection(clientY);
    if (direction === 0) return;

    const list = orderRef.current;
    const target = current + direction;
    if (target < 0 || target >= list.length) return;

    const next = [...list];
    [next[current], next[target]] = [next[target], next[current]];
    dragIndexRef.current = target;
    // Updated synchronously rather than left to the next render's re-sync
    // -- a later frame in this same tick would otherwise still see the old
    // order and compute the swap all over again.
    orderRef.current = next;
    lastSwapDocYRef.current = docY;
    setDragIndex(target);
    onReorderRef.current(next);
  }

  function autoScrollDelta(clientY: number): number {
    const viewportHeight = window.innerHeight;
    const speedAt = (depth: number) =>
      AUTOSCROLL_MIN_SPEED_PX +
      Math.min(Math.max(depth, 0), 1) * (AUTOSCROLL_MAX_SPEED_PX - AUTOSCROLL_MIN_SPEED_PX);

    if (clientY < AUTOSCROLL_ZONE_PX) {
      return -speedAt((AUTOSCROLL_ZONE_PX - clientY) / AUTOSCROLL_ZONE_PX);
    }
    if (clientY > viewportHeight - AUTOSCROLL_ZONE_PX) {
      return speedAt((clientY - (viewportHeight - AUTOSCROLL_ZONE_PX)) / AUTOSCROLL_ZONE_PX);
    }
    return 0;
  }

  function stopLoop() {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }

  function tick() {
    const clientY = lastClientYRef.current;
    if (dragIndexRef.current === null || clientY === null) {
      rafRef.current = null;
      return;
    }
    const delta = autoScrollDelta(clientY);
    // Instant, not smooth -- nothing in this codebase sets scroll-behavior:
    // smooth, which would animate against the loop and make each frame
    // fight the last.
    if (delta !== 0) window.scrollBy(0, delta);
    // Runs every frame, including when delta is 0. maybeSwap is itself
    // dead-zone guarded, so a stationary finger produces no swaps -- this
    // costs one geometry read per frame and is what makes the
    // held-still-in-the-edge-zone case work at all.
    maybeSwap(clientY);
    rafRef.current = requestAnimationFrame(tick);
  }

  function startLoop() {
    if (rafRef.current === null) rafRef.current = requestAnimationFrame(tick);
  }

  // Belt-and-braces against a leaked loop: pointerup/pointercancel already
  // stop it, but this can unmount mid-drag (step navigation, Start Over),
  // and a pointercancel is not guaranteed to arrive first.
  useEffect(() => stopLoop, []);

  function handlePointerDown(e: React.PointerEvent<HTMLElement>, index: number) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    // setPointerCapture throws NotFoundError if the browser doesn't (yet,
    // or no longer) consider this pointerId active -- a real if rare race
    // in some browser/OS input pipelines, e.g. an extremely fast
    // tap-release. Capture is what keeps pointermove routing to this handle
    // when it works; track the drag by index either way rather than letting
    // a swallowed browser race abort the whole gesture.
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // no-op -- see comment above
    }
    dragIndexRef.current = index;
    lastClientYRef.current = e.clientY;
    // Seeded at the grab point so the first swap needs a real 10px of
    // travel -- otherwise a stationary tap on the handle could commit a
    // swap the moment a neighbour's midpoint happened to sit under it.
    lastSwapDocYRef.current = e.clientY + window.scrollY;
    setDragIndex(index);
    startLoop();
  }

  function handlePointerMove(e: React.PointerEvent<HTMLElement>) {
    if (dragIndexRef.current === null) return;
    // Only records position. The rAF loop owns all swapping, so exactly one
    // code path decides reorders whether the pointer is moving, stationary,
    // or in an autoscroll zone.
    lastClientYRef.current = e.clientY;
  }

  function handlePointerEnd(e: React.PointerEvent<HTMLElement>) {
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // no-op -- same defensive guard as handlePointerDown above
    }
    stopLoop();
    dragIndexRef.current = null;
    lastClientYRef.current = null;
    lastSwapDocYRef.current = null;
    setDragIndex(null);
  }

  return { dragIndex, setItemRef, handlePointerDown, handlePointerMove, handlePointerEnd };
}
