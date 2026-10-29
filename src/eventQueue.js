/**
 * Collects log events and sends them in batches: every `interval` ms, or as soon as `maxBatch` are waiting.
 * A failed batch goes back to the front of the queue; at most `maxQueued` events are kept.
 *
 * send(events, { keepalive }) must return a promise. An event is { type, time, data }.
 */
export function createEventQueue({ send, interval = 5000, maxBatch = 50, maxQueued = 500, now = Date.now }) {
  let queue = [];
  let timer = null;
  let sending = false;

  function push(type, data = {}) {
    queue.push({ type, time: now(), data });
    if (queue.length > maxQueued) queue = queue.slice(queue.length - maxQueued);
    if (queue.length >= maxBatch) flush();
  }

  async function flush() {
    if (sending || queue.length === 0) return;
    const batch = queue;
    queue = [];
    sending = true;
    try {
      await send(batch, { keepalive: false });
    } catch (e) {
      queue = batch.concat(queue).slice(-maxQueued);
    } finally {
      sending = false;
    }
  }

  function flushOnUnload() {
    if (queue.length === 0) return;
    const batch = queue;
    queue = [];
    try {
      send(batch, { keepalive: true });
    } catch (e) {
      // Nothing more can be done while the page closes
    }
  }

  function start() {
    if (!timer) timer = setInterval(flush, interval);
  }

  function stop() {
    clearInterval(timer);
    timer = null;
  }

  return { push, flush, flushOnUnload, start, stop, size: () => queue.length };
}
