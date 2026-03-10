// ─────────────────────────────────────────────
// EventBus — lightweight pub/sub
// ─────────────────────────────────────────────
// All communication between input modules and
// UI/game modules flows through an EventBus
// instance. Nothing is global — the bus is
// created in main.js and injected into each
// module via its constructor.
// ─────────────────────────────────────────────

export class EventBus {
  constructor() {
    /** @type {Map<string, Set<Function>>} */
    this._listeners = new Map();
  }

  /**
   * Subscribe to an event.
   * @param {string} event
   * @param {Function} callback
   * @returns {Function} unsubscribe function
   */
  on(event, callback) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event).add(callback);

    // Return an unsubscribe handle
    return () => this.off(event, callback);
  }

  /**
   * Unsubscribe from an event.
   * @param {string} event
   * @param {Function} callback
   */
  off(event, callback) {
    const set = this._listeners.get(event);
    if (set) {
      set.delete(callback);
      if (set.size === 0) this._listeners.delete(event);
    }
  }

  /**
   * Publish an event to all subscribers.
   * @param {string} event
   * @param {*} data
   */
  emit(event, data) {
    const set = this._listeners.get(event);
    if (!set) return;
    for (const cb of set) {
      try { cb(data); }
      catch (err) { console.error(`[EventBus] Error in "${event}" handler:`, err); }
    }
  }

  /**
   * Remove all listeners (useful for teardown / hot-reload).
   */
  clear() {
    this._listeners.clear();
  }
}
