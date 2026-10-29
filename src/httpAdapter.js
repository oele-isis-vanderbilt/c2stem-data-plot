/**
 * Adapter for the C2STEM agent server's data-table API. Every request carries the login token.
 *
 *   GET  {prefix}/datatables/{taskId}           → saved doc, or 404 when there is none
 *   PUT  {prefix}/datatables/{taskId}           ← doc
 *   POST {prefix}/datatables/{taskId}/events    ← { events }
 *   GET  {prefix}/admin/datatables?taskId=&username=
 *   GET  {prefix}/admin/datatables/{username}/{taskId}
 */
export function createHttpAdapter({ baseURL, getToken, prefix = "/app/api", fetch: fetchFn }) {
  const root = String(baseURL).replace(/\/+$/, "") + prefix;
  const doFetch = fetchFn || ((...args) => globalThis.fetch(...args));
  const enc = encodeURIComponent;

  async function request(method, path, body, { keepalive = false } = {}) {
    const headers = { Accept: "application/json" };
    const token = getToken && getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const response = await doFetch(root + path, {
      method,
      headers,
      keepalive,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (response.status === 404 && method === "GET") return null;
    if (!response.ok) {
      const error = new Error(`${method} ${path} failed with ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return response.status === 204 ? null : response.json();
  }

  return {
    load: (taskId) => request("GET", `/datatables/${enc(taskId)}`),
    save: (taskId, doc, opts) => request("PUT", `/datatables/${enc(taskId)}`, doc, opts),
    log: (taskId, events, opts) => request("POST", `/datatables/${enc(taskId)}/events`, { events }, opts),

    // Admin accounts only
    adminList: ({ taskId, username } = {}) => {
      const params = new URLSearchParams();
      if (taskId) params.set("taskId", taskId);
      if (username) params.set("username", username);
      const query = params.toString();
      return request("GET", `/admin/datatables${query ? `?${query}` : ""}`);
    },
    adminGet: (username, taskId) => request("GET", `/admin/datatables/${enc(username)}/${enc(taskId)}`),
  };
}
