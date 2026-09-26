"use client";

import { useEffect } from "react";

export const UNREAD_CHANGED_EVENT = "levr:unread-changed";

/** Tell the header's unread-messages badge to recount. */
export function announceUnreadChanged() {
  window.dispatchEvent(new Event(UNREAD_CHANGED_EVENT));
}

/**
 * Rendered by the thread page, which marks the thread read while rendering.
 * The header's own route-change recount can land before that write, so this
 * asks for one more recount once the page is actually on screen.
 */
export function UnreadCountRefresh() {
  useEffect(() => {
    announceUnreadChanged();
  }, []);
  return null;
}
