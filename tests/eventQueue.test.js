import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createEventQueue } from "../src/eventQueue.js";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("event queue", () => {
  it("sends batches on a timer", async () => {
    const send = vi.fn().mockResolvedValue();
    const queue = createEventQueue({ send, interval: 5000, now: () => 42 });
    queue.start();
    queue.push("opened");
    queue.push("cell_edited", { key: "mass" });
    await vi.advanceTimersByTimeAsync(5000);
    expect(send).toHaveBeenCalledWith(
      [
        { type: "opened", time: 42, data: {} },
        { type: "cell_edited", time: 42, data: { key: "mass" } },
      ],
      { keepalive: false }
    );
    queue.stop();
  });

  it("sends at once when a batch is full", () => {
    const send = vi.fn().mockResolvedValue();
    const queue = createEventQueue({ send, maxBatch: 3 });
    queue.push("a");
    queue.push("b");
    expect(send).not.toHaveBeenCalled();
    queue.push("c");
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("puts a failed batch back in front, in order", async () => {
    const send = vi.fn().mockRejectedValueOnce(new Error("down")).mockResolvedValue();
    const queue = createEventQueue({ send });
    queue.push("a");
    queue.push("b");
    const flushing = queue.flush();
    queue.push("c");
    await flushing;
    await queue.flush();
    expect(send.mock.calls[1][0].map((e) => e.type)).toEqual(["a", "b", "c"]);
  });

  it("keeps at most maxQueued events", () => {
    const send = vi.fn().mockResolvedValue();
    const queue = createEventQueue({ send, maxBatch: 100, maxQueued: 3 });
    ["a", "b", "c", "d"].forEach((t) => queue.push(t));
    expect(queue.size()).toBe(3);
  });

  it("sends with keepalive when the page closes", () => {
    const send = vi.fn().mockResolvedValue();
    const queue = createEventQueue({ send });
    queue.push("closed");
    queue.flushOnUnload();
    expect(send.mock.calls[0][1]).toEqual({ keepalive: true });
    expect(queue.size()).toBe(0);
  });
});
