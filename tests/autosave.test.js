import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createAutosave } from "../src/autosave.js";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("autosave", () => {
  it("saves once, after the last change", async () => {
    const save = vi.fn().mockResolvedValue();
    const autosave = createAutosave({ save, delay: 1000 });
    autosave.schedule({ n: 1 });
    await vi.advanceTimersByTimeAsync(500);
    autosave.schedule({ n: 2 });
    await vi.advanceTimersByTimeAsync(999);
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith({ n: 2 }, { keepalive: false });
  });

  it("sends saves one at a time, in order", async () => {
    const order = [];
    let release;
    const save = vi.fn((doc) => {
      order.push(`start ${doc.n}`);
      return new Promise((resolve) => {
        release = () => {
          order.push(`end ${doc.n}`);
          resolve();
        };
      });
    });
    const autosave = createAutosave({ save });
    autosave.schedule({ n: 1 });
    const first = autosave.flush();
    autosave.schedule({ n: 2 });
    const second = autosave.flush();
    await vi.advanceTimersByTimeAsync(0);
    expect(order).toEqual(["start 1"]);
    release();
    await first;
    await vi.advanceTimersByTimeAsync(0);
    release();
    await second;
    expect(order).toEqual(["start 1", "end 1", "start 2", "end 2"]);
  });

  it("keeps a failed save and retries it", async () => {
    const states = [];
    const save = vi.fn().mockRejectedValueOnce(new Error("down")).mockResolvedValue();
    const autosave = createAutosave({ save, retryDelay: 5000, onState: (s) => states.push(s) });
    autosave.schedule({ n: 1 });
    await autosave.flush();
    expect(autosave.hasPending()).toBe(true);
    await vi.advanceTimersByTimeAsync(5000);
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1][0]).toEqual({ n: 1 });
    expect(autosave.hasPending()).toBe(false);
    expect(states).toEqual(["unsaved", "saving", "error", "saving", "saved"]);
  });

  it("passes the error to onState", async () => {
    const failure = Object.assign(new Error("expired"), { status: 401 });
    const onState = vi.fn();
    const autosave = createAutosave({ save: vi.fn().mockRejectedValue(failure), onState });
    autosave.schedule({ n: 1 });
    await autosave.flush();
    expect(onState).toHaveBeenLastCalledWith("error", failure);
    autosave.cancel();
  });

  it("does not let a failed older save replace a newer change", async () => {
    let fail;
    const save = vi.fn((doc) => (doc.n === 1 ? new Promise((_, reject) => (fail = reject)) : Promise.resolve()));
    const autosave = createAutosave({ save });
    autosave.schedule({ n: 1 });
    const flushing = autosave.flush();
    autosave.schedule({ n: 2 });
    await vi.advanceTimersByTimeAsync(0);
    fail(new Error("down"));
    await flushing;
    await autosave.flush();
    expect(save.mock.calls.map((c) => c[0].n)).toEqual([1, 2]);
  });

  it("sends with keepalive when the page closes", () => {
    const save = vi.fn().mockResolvedValue();
    const autosave = createAutosave({ save });
    autosave.schedule({ n: 1 });
    autosave.flushOnUnload();
    expect(save).toHaveBeenCalledWith({ n: 1 }, { keepalive: true });
    expect(autosave.hasPending()).toBe(false);
  });
});
