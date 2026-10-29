import { describe, it, expect, vi } from "vitest";
import { createHttpAdapter } from "../src/httpAdapter.js";

const reply = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

describe("http adapter", () => {
  it("loads with the token, and treats 404 as nothing saved", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(reply(200, { rows: [] })).mockResolvedValueOnce(reply(404));
    const api = createHttpAdapter({ baseURL: "https://agent.example.org/", getToken: () => "t0k", fetch });
    expect(await api.load("lesson 1")).toEqual({ rows: [] });
    expect(await api.load("lesson2")).toBe(null);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("https://agent.example.org/app/api/datatables/lesson%201");
    expect(init.method).toBe("GET");
    expect(init.headers.Authorization).toBe("Bearer t0k");
  });

  it("saves and logs as JSON, passing keepalive through", async () => {
    const fetch = vi.fn().mockResolvedValue(reply(200, {}));
    const api = createHttpAdapter({ baseURL: "http://x", getToken: () => "t", fetch });
    await api.save("lesson1", { rows: [] }, { keepalive: true });
    await api.log("lesson1", [{ type: "opened" }]);
    expect(fetch.mock.calls[0][0]).toBe("http://x/app/api/datatables/lesson1");
    expect(fetch.mock.calls[0][1]).toMatchObject({ method: "PUT", keepalive: true, body: '{"rows":[]}' });
    expect(fetch.mock.calls[1][0]).toBe("http://x/app/api/datatables/lesson1/events");
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ events: [{ type: "opened" }] });
  });

  it("throws with the status on failure", async () => {
    const fetch = vi.fn().mockResolvedValue(reply(401));
    const api = createHttpAdapter({ baseURL: "http://x", getToken: () => null, fetch });
    await expect(api.save("t", {})).rejects.toMatchObject({ status: 401 });
    expect(fetch.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  it("builds the admin URLs", async () => {
    const fetch = vi.fn().mockResolvedValue(reply(200, []));
    const api = createHttpAdapter({ baseURL: "http://x", getToken: () => "t", fetch });
    await api.adminList({ taskId: "lesson1" });
    await api.adminList();
    await api.adminGet("sam", "lesson2");
    expect(fetch.mock.calls.map((c) => c[0])).toEqual([
      "http://x/app/api/admin/datatables?taskId=lesson1",
      "http://x/app/api/admin/datatables",
      "http://x/app/api/admin/datatables/sam/lesson2",
    ]);
  });
});
