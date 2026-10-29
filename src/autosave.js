/**
 * Saves the latest table a short time after the last change. Saves go one at a time, in order,
 * so an older save can never land after a newer one. A failed save is kept and retried.
 *
 * save(doc, { keepalive }) must return a promise. onState gets "unsaved" | "saving" | "saved" | "error",
 * and for "error" also the error the save failed with.
 */
export function createAutosave({ save, delay = 1000, retryDelay = 5000, onState = () => {} }) {
  let pending = null;
  let timer = null;
  let inFlight = null;

  function schedule(doc) {
    pending = doc;
    onState("unsaved");
    clearTimeout(timer);
    timer = setTimeout(flush, delay);
  }

  async function flush() {
    clearTimeout(timer);
    timer = null;
    while (inFlight) await inFlight;
    if (!pending) return;
    const doc = pending;
    pending = null;
    onState("saving");
    inFlight = Promise.resolve()
      .then(() => save(doc, { keepalive: false }))
      .then(
        () => {
          if (!pending) onState("saved");
        },
        (error) => {
          // Keep the failed doc unless a newer one is already waiting
          if (!pending) pending = doc;
          onState("error", error);
          clearTimeout(timer);
          timer = setTimeout(flush, retryDelay);
        }
      )
      .finally(() => {
        inFlight = null;
      });
    await inFlight;
  }

  /** For the page closing: send what is waiting without waiting for an answer. */
  function flushOnUnload() {
    clearTimeout(timer);
    timer = null;
    if (!pending) return;
    const doc = pending;
    pending = null;
    try {
      save(doc, { keepalive: true });
    } catch (e) {
      // Nothing more can be done while the page closes
    }
  }

  function cancel() {
    clearTimeout(timer);
    timer = null;
    pending = null;
  }

  return { schedule, flush, flushOnUnload, cancel, hasPending: () => pending !== null };
}
