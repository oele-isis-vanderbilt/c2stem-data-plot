import { LitElement as $, nothing as f, html as c, css as E } from "lit";
import { styleMap as q } from "lit/directives/style-map.js";
import { repeat as A } from "lit/directives/repeat.js";
import { live as B } from "lit/directives/live.js";
import { Chart as L, ScatterController as F, LineElement as H, PointElement as O, LinearScale as V, Tooltip as U, Legend as K } from "chart.js";
let P = 0;
function T() {
  return P += 1, `r${Date.now().toString(36)}${P.toString(36)}`;
}
function w(o) {
  const t = {};
  return o.columns.forEach((e) => t[e.key] = ""), { id: T(), values: t };
}
function k(o) {
  if (o == null) return null;
  const t = String(o).trim();
  if (t === "") return null;
  const e = Number(t);
  return Number.isFinite(e) ? e : NaN;
}
function z(o) {
  return Number.isNaN(k(o)) ? "Enter a number" : null;
}
function G(o) {
  return Object.values(o.values).every((t) => String(t).trim() === "");
}
function Y(o) {
  if (!o || !Array.isArray(o.columns) || o.columns.length === 0)
    throw new Error("config.columns must list at least one column");
  const t = /* @__PURE__ */ new Set();
  o.columns.forEach((s) => {
    if (!s.key) throw new Error("Every column needs a key");
    if (t.has(s.key)) throw new Error(`Column key "${s.key}" is used twice`);
    t.add(s.key);
  });
  const e = o.plot;
  if (!e || !e.x || !Array.isArray(e.y) || e.y.length === 0)
    throw new Error("config.plot needs an x column and at least one y column");
  return [e.x, ...e.y].forEach((s) => {
    if (!t.has(s)) throw new Error(`Plot column "${s}" is not in config.columns`);
  }), o;
}
function M(o) {
  return o.unit ? `${o.label} (${o.unit})` : o.label;
}
function j(o, t) {
  const e = {};
  return o.columns.forEach((s) => e[s.key] = s), o.plot.y.map((s) => {
    const n = [];
    return t.forEach((i) => {
      const r = k(i.values[o.plot.x]), l = k(i.values[s]);
      Number.isFinite(r) && Number.isFinite(l) && n.push({ x: r, y: l });
    }), n.sort((i, r) => i.x - r.x), { key: s, label: M(e[s]), points: n };
  });
}
function b(o, t, e = N(o)) {
  return {
    columns: o.columns.map((s) => ({ key: s.key, label: s.label, unit: s.unit || "" })),
    rows: t.map((s) => ({ id: s.id, values: { ...s.values } })),
    settings: { connectPoints: !!e.connectPoints }
  };
}
function N(o) {
  return { connectPoints: !!o.plot.line };
}
function y(o, t) {
  const e = t && t.settings, s = N(o);
  return {
    connectPoints: e && typeof e.connectPoints == "boolean" ? e.connectPoints : s.connectPoints
  };
}
function v(o, t) {
  const s = (t && Array.isArray(t.rows) ? t.rows : []).map((n) => {
    const i = {};
    return o.columns.forEach((r) => {
      const l = n.values ? n.values[r.key] : void 0;
      i[r.key] = l == null ? "" : String(l);
    }), { id: n.id || T(), values: i };
  });
  return s.length ? s : [w(o)];
}
function X(o, t) {
  return t.map((e) => {
    const s = w(o);
    return o.columns.forEach((n) => {
      const i = e[n.key];
      i != null && (s.values[n.key] = String(i));
    }), s;
  });
}
function W({ save: o, delay: t = 1e3, retryDelay: e = 5e3, onState: s = () => {
} }) {
  let n = null, i = null, r = null;
  function l(u) {
    n = u, s("unsaved"), clearTimeout(i), i = setTimeout(a, t);
  }
  async function a() {
    for (clearTimeout(i), i = null; r; ) await r;
    if (!n) return;
    const u = n;
    n = null, s("saving"), r = Promise.resolve().then(() => o(u, { keepalive: !1 })).then(
      () => {
        n || s("saved");
      },
      (m) => {
        n || (n = u), s("error", m), clearTimeout(i), i = setTimeout(a, e);
      }
    ).finally(() => {
      r = null;
    }), await r;
  }
  function d() {
    if (clearTimeout(i), i = null, !n) return;
    const u = n;
    n = null;
    try {
      o(u, { keepalive: !0 });
    } catch {
    }
  }
  function h() {
    clearTimeout(i), i = null, n = null;
  }
  return { schedule: l, flush: a, flushOnUnload: d, cancel: h, hasPending: () => n !== null };
}
function J({ send: o, interval: t = 5e3, maxBatch: e = 50, maxQueued: s = 500, now: n = Date.now }) {
  let i = [], r = null, l = !1;
  function a(g, p = {}) {
    i.push({ type: g, time: n(), data: p }), i.length > s && (i = i.slice(i.length - s)), i.length >= e && d();
  }
  async function d() {
    if (l || i.length === 0) return;
    const g = i;
    i = [], l = !0;
    try {
      await o(g, { keepalive: !1 });
    } catch {
      i = g.concat(i).slice(-s);
    } finally {
      l = !1;
    }
  }
  function h() {
    if (i.length === 0) return;
    const g = i;
    i = [];
    try {
      o(g, { keepalive: !0 });
    } catch {
    }
  }
  function u() {
    r || (r = setInterval(d, t));
  }
  function m() {
    clearInterval(r), r = null;
  }
  return { push: a, flush: d, flushOnUnload: h, start: u, stop: m, size: () => i.length };
}
const Z = 44;
function Q(o, t, e) {
  const s = Math.max(0, e.width - t.width), n = Math.max(0, e.height - Z);
  return {
    x: Math.round(Math.min(Math.max(0, o.x), s)),
    y: Math.round(Math.min(Math.max(0, o.y), n))
  };
}
class tt {
  constructor(t, { getFrame: e, getPosition: s, onMove: n, onEnd: i }) {
    this.getFrame = e, this.getPosition = s, this.onMove = n, this.onEnd = i, this.start = this.start.bind(this), this._onResize = () => {
      const r = this.getPosition();
      r && this.getFrame() && this.onMove(this.clamp(r));
    }, t.addController(this);
  }
  hostConnected() {
    window.addEventListener("resize", this._onResize);
  }
  hostDisconnected() {
    window.removeEventListener("resize", this._onResize);
  }
  clamp(t) {
    const e = this.getFrame(), s = e ? e.getBoundingClientRect() : { width: 0 };
    return Q(t, s, { width: window.innerWidth, height: window.innerHeight });
  }
  /** pointerdown handler for the title bar. Presses on its buttons are left alone. */
  start(t) {
    if (t.button !== 0 || t.target.closest("button")) return;
    const e = this.getFrame();
    if (!e) return;
    const s = e.getBoundingClientRect(), n = t.clientX - s.left, i = t.clientY - s.top, r = t.currentTarget;
    r.setPointerCapture(t.pointerId), t.preventDefault();
    let l = null;
    const a = (h) => {
      l = this.clamp({ x: h.clientX - n, y: h.clientY - i }), this.onMove(l);
    }, d = () => {
      r.removeEventListener("pointermove", a), r.removeEventListener("pointerup", d), r.removeEventListener("pointercancel", d), l && this.onEnd(l);
    };
    r.addEventListener("pointermove", a), r.addEventListener("pointerup", d), r.addEventListener("pointercancel", d);
  }
}
function S(o, t) {
  customElements.get(o) || customElements.define(o, t);
}
class et extends $ {
  static get properties() {
    return {
      columns: { attribute: !1 },
      rows: { attribute: !1 },
      readonly: { type: Boolean }
    };
  }
  constructor() {
    super(), this.columns = [], this.rows = [], this.readonly = !1, this._focusValue = "";
  }
  async focusCell(t, e) {
    await this.updateComplete;
    const s = this.renderRoot.querySelector(`input[data-row="${t}"][data-key="${e}"]`);
    s && s.focus();
  }
  _emit(t, e) {
    this.dispatchEvent(new CustomEvent(t, { detail: e }));
  }
  _onFocus(t) {
    this._focusValue = t.target.value;
  }
  _onInput(t) {
    const { row: e, key: s } = t.target.dataset;
    this._emit("cell-input", { rowId: e, key: s, value: t.target.value });
  }
  _onChange(t) {
    const { row: e, key: s } = t.target.dataset;
    t.target.value !== this._focusValue && (this._emit("cell-commit", { rowId: e, key: s, old: this._focusValue, value: t.target.value }), this._focusValue = t.target.value);
  }
  _onKeydown(t) {
    if (t.key !== "Enter") return;
    t.preventDefault();
    const { row: e, key: s } = t.target.dataset, i = this.rows.findIndex((r) => r.id === e) + (t.shiftKey ? -1 : 1);
    i >= 0 && i < this.rows.length ? this.focusCell(this.rows[i].id, s) : i === this.rows.length && !this.readonly && (t.target.blur(), this._emit("row-add", { focusKey: s }));
  }
  render() {
    const { columns: t, rows: e, readonly: s } = this;
    return c`
      <div class="scroll">
        <table>
          <thead>
            <tr>
              <th class="num" scope="col"><span class="sr">Row</span></th>
              ${t.map(
      (n) => c`<th scope="col">${n.label}${n.unit ? c`<span class="unit">(${n.unit})</span>` : f}</th>`
    )}
              ${s ? f : c`<th class="act" scope="col"><span class="sr">Delete</span></th>`}
            </tr>
          </thead>
          <tbody>
            ${A(
      e,
      (n) => n.id,
      (n, i) => c`
                <tr>
                  <th class="num" scope="row">${i + 1}</th>
                  ${t.map((r) => {
        var d;
        const l = (d = n.values[r.key]) != null ? d : "", a = z(l);
        return c`<td>
                      <input
                        type="text"
                        inputmode="decimal"
                        autocomplete="off"
                        class=${a ? "invalid" : ""}
                        aria-invalid=${a ? "true" : "false"}
                        aria-label="${r.label}, row ${i + 1}"
                        title=${a || ""}
                        data-row=${n.id}
                        data-key=${r.key}
                        .value=${B(l)}
                        ?readonly=${s}
                        @focus=${this._onFocus}
                        @input=${this._onInput}
                        @change=${this._onChange}
                        @keydown=${this._onKeydown}
                      />
                    </td>`;
      })}
                  ${s ? f : c`<td class="act">
                        <button
                          class="del"
                          title="Delete row"
                          aria-label="Delete row ${i + 1}"
                          @click=${() => this._emit("row-delete", { rowId: n.id })}
                        >
                          ×
                        </button>
                      </td>`}
                </tr>
              `
    )}
          </tbody>
        </table>
      </div>
      ${s ? f : c`<button class="add" @click=${() => this._emit("row-add", { focusKey: t[0].key })}>+ Add row</button>`}
    `;
  }
  static get styles() {
    return E`
      :host {
        display: flex;
        flex-direction: column;
        min-height: 0;
        gap: 8px;
      }
      .scroll {
        overflow: auto;
        min-height: 0;
        border: 1px solid var(--dpt-border);
        border-radius: 6px;
      }
      table {
        border-collapse: collapse;
        min-width: 100%;
        font-size: 14px;
      }
      thead th {
        position: sticky;
        top: 0;
        z-index: 1;
        background: var(--dpt-header-bg);
        text-align: left;
        font-weight: 600;
        padding: 6px 8px;
        border-bottom: 1px solid var(--dpt-border);
        vertical-align: bottom;
        line-height: 1.25;
      }
      /* Units on their own line keep the columns narrow */
      .unit {
        display: block;
        font-weight: 400;
        color: var(--dpt-muted);
        white-space: nowrap;
      }
      td,
      tbody th {
        border-bottom: 1px solid var(--dpt-grid);
        padding: 0;
      }
      .num {
        width: 2.5em;
        text-align: right;
        padding: 0 8px 0 4px;
        color: var(--dpt-muted);
        font-weight: 400;
        font-variant-numeric: tabular-nums;
      }
      input {
        box-sizing: border-box;
        width: 100%;
        min-width: 4.5em;
        border: 1px solid transparent;
        background: transparent;
        padding: 6px 8px;
        font: inherit;
        color: inherit;
        font-variant-numeric: tabular-nums;
      }
      input:focus {
        outline: none;
        border-color: var(--dpt-accent);
        background: var(--dpt-surface);
      }
      input.invalid {
        border-color: var(--dpt-danger);
        background: var(--dpt-danger-bg);
      }
      input[readonly] {
        cursor: default;
      }
      .act {
        width: 2em;
        text-align: center;
      }
      .del {
        border: 0;
        background: none;
        color: var(--dpt-muted);
        font-size: 18px;
        line-height: 1;
        padding: 4px 8px;
        cursor: pointer;
        border-radius: 4px;
      }
      .del:hover,
      .del:focus-visible {
        color: var(--dpt-danger);
        background: var(--dpt-danger-bg);
      }
      .add {
        align-self: flex-start;
        font: inherit;
        font-size: 14px;
        padding: 6px 12px;
        border: 1px solid var(--dpt-border);
        border-radius: 6px;
        background: var(--dpt-surface);
        color: var(--dpt-text);
        cursor: pointer;
      }
      .add:hover {
        border-color: var(--dpt-accent);
      }
      .sr {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip: rect(0 0 0 0);
        white-space: nowrap;
      }
    `;
  }
}
S("dpt-table", et);
L.register(F, H, O, V, U, K);
const _ = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"], R = ["circle", "triangle", "rect", "rectRot", "crossRot", "star", "rectRounded", "cross"], x = "#55544f", I = "#ebeae6";
class st extends $ {
  static get properties() {
    return {
      series: { attribute: !1 },
      xLabel: { attribute: !1 },
      yLabel: { attribute: !1 },
      line: { type: Boolean }
    };
  }
  constructor() {
    super(), this.series = [], this.xLabel = "", this.yLabel = "", this.line = !1, this._chart = null;
  }
  connectedCallback() {
    super.connectedCallback(), this.requestUpdate();
  }
  disconnectedCallback() {
    super.disconnectedCallback(), this._chart && this._chart.destroy(), this._chart = null;
  }
  _datasets() {
    return this.series.map((t, e) => ({
      label: t.label,
      data: t.points,
      showLine: this.line,
      borderColor: _[e % _.length],
      backgroundColor: _[e % _.length],
      pointStyle: R[e % R.length],
      pointRadius: 5,
      pointHoverRadius: 7,
      pointHitRadius: 10,
      borderWidth: 2
    }));
  }
  _options() {
    const t = (e) => ({
      type: "linear",
      title: { display: !!e, text: e, color: x },
      ticks: { color: x },
      grid: { color: I },
      border: { color: I }
    });
    return {
      responsive: !0,
      maintainAspectRatio: !1,
      animation: !1,
      scales: { x: t(this.xLabel), y: t(this.yLabel) },
      plugins: {
        legend: {
          display: this.series.length > 1,
          labels: { usePointStyle: !0, color: x }
        },
        tooltip: {
          callbacks: {
            label: (e) => `${e.dataset.label}: ${e.parsed.y}  (${this.xLabel}: ${e.parsed.x})`
          }
        }
      }
    };
  }
  updated() {
    const t = this.renderRoot.querySelector("canvas");
    if (t) {
      if (!this._chart) {
        this._chart = new L(t, {
          type: "scatter",
          data: { datasets: this._datasets() },
          options: this._options()
        });
        return;
      }
      this._chart.data.datasets = this._datasets(), this._chart.options = this._options(), this._chart.update("none");
    }
  }
  render() {
    const t = this.series.every((s) => s.points.length === 0), e = this.series.map((s) => s.label).join(", ");
    return c`
      <div class="wrap">
        <canvas role="img" aria-label="Plot of ${e} against ${this.xLabel}"></canvas>
        ${t ? c`<p class="empty">Enter numbers in the table to see them plotted.</p>` : f}
      </div>
    `;
  }
  static get styles() {
    return E`
      :host {
        display: flex;
        flex-direction: column;
        min-height: 240px;
        min-width: 0;
      }
      /* The canvas is taken out of the layout so the chart follows its box and never pushes it taller */
      .wrap {
        position: relative;
        flex: 1;
        min-height: 0;
      }
      canvas {
        position: absolute;
        inset: 0;
      }
      .empty {
        position: absolute;
        inset: 0;
        margin: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        padding: 0 24px;
        color: var(--dpt-muted);
        font-size: 14px;
        pointer-events: none;
      }
    `;
  }
}
S("dpt-plot", st);
const D = "c2stem-data-plot:position";
function it() {
  try {
    const o = JSON.parse(localStorage.getItem(D));
    return o && Number.isFinite(o.x) && Number.isFinite(o.y) ? o : null;
  } catch {
    return null;
  }
}
function nt(o) {
  try {
    localStorage.setItem(D, JSON.stringify(o));
  } catch {
  }
}
class ot extends $ {
  static get properties() {
    return {
      config: { attribute: !1 },
      taskId: { attribute: "task-id" },
      adapter: { attribute: !1 },
      data: { attribute: !1 },
      readonly: { type: Boolean, reflect: !0 },
      _rows: { state: !0 },
      _settings: { state: !0 },
      _status: { state: !0 },
      _error: { state: !0 },
      _saveState: { state: !0 },
      _view: { state: !0 },
      _pos: { state: !0 }
    };
  }
  constructor() {
    super(), this.readonly = !1, this._rows = [], this._settings = { connectPoints: !1 }, this._status = "idle", this._error = "", this._saveState = "saved", this._saveError = null, this._view = "closed", this._pos = null, this._session = null, this._savedHeight = "", this._drag = new tt(this, {
      getFrame: () => this.renderRoot && this.renderRoot.querySelector(".frame"),
      getPosition: () => this._pos,
      onMove: (t) => this._pos = t,
      onEnd: (t) => {
        nt(t), this._log("moved", t);
      }
    }), this._onPageHide = () => this._flushOnUnload(), this._onVisibility = () => {
      document.visibilityState === "hidden" && this.flush();
    };
  }
  connectedCallback() {
    super.connectedCallback(), window.addEventListener("pagehide", this._onPageHide), document.addEventListener("visibilitychange", this._onVisibility), this._detached && (this._detached = !1, this._reload());
  }
  disconnectedCallback() {
    super.disconnectedCallback(), window.removeEventListener("pagehide", this._onPageHide), document.removeEventListener("visibilitychange", this._onVisibility), this._endSession(), this._detached = !0;
  }
  // ---- Public API ----
  get view() {
    return this._view;
  }
  open() {
    this._view !== "open" && (this._pos || (this._pos = it() || this._defaultPosition()), this._setView("open"));
  }
  close() {
    this._view !== "closed" && (this._setView("closed"), this.flush());
  }
  collapse() {
    if (this._view !== "open") return;
    const t = this.renderRoot.querySelector(".frame");
    t && (this._savedHeight = t.style.height, t.style.height = ""), this._setView("collapsed");
  }
  async expand() {
    if (this._view !== "collapsed") return;
    this._setView("open"), await this.updateComplete;
    const t = this.renderRoot.querySelector(".frame");
    t && this._savedHeight && (t.style.height = this._savedHeight);
  }
  toggle() {
    this._view === "closed" ? this.open() : this.close();
  }
  /** Adds rows from plain objects, e.g. data from a simulation. Blank rows already there are replaced. */
  appendRows(t, { source: e = "host" } = {}) {
    if (!this.config || this.readonly || !Array.isArray(t) || t.length === 0) return;
    const s = X(this.config, t), n = this._rows.filter((i) => !G(i));
    this._changeRows(n.concat(s)), this._log("rows_appended", { source: e, count: s.length, rowIds: s.map((i) => i.id) });
  }
  getRows() {
    return this.config ? b(this.config, this._rows).rows : [];
  }
  getSettings() {
    return { ...this._settings };
  }
  /** Sends any waiting save and log events now. */
  async flush() {
    const t = this._session;
    t && await Promise.all([t.autosave.flush(), t.queue.flush()]);
  }
  // ---- Loading and saving ----
  willUpdate(t) {
    (t.has("config") || t.has("taskId") || t.has("adapter") || t.has("data")) && this._reload(t.has("config") && !t.has("taskId") && !t.has("adapter"));
  }
  _reload(t = !1) {
    const e = this.config;
    if (e) {
      try {
        Y(e);
      } catch (s) {
        this._endSession(), this._status = "error", this._error = `This tool is set up wrongly: ${s.message}`;
        return;
      }
      if (this.data) {
        this._endSession(), this._rows = v(e, this.data), this._settings = y(e, this.data), this._status = "ready";
        return;
      }
      if (!this.adapter || !this.taskId) {
        this._endSession(), this._rows = v(e, { rows: this._rows }), t || (this._settings = y(e, null)), this._status = "ready";
        return;
      }
      if (t && this._session) {
        this._rows = v(e, { rows: this._rows });
        return;
      }
      this._endSession(), this._startSession();
    }
  }
  _startSession() {
    const t = this.taskId, e = this.adapter, s = { taskId: t, ready: !1 };
    s.autosave = W({
      save: (n, i) => e.save(t, n, i),
      onState: (n, i) => {
        this._session === s && (this._saveState = n, this._saveError = i || null, this._fire("savestate", { state: n, error: i }));
      }
    }), s.queue = J({ send: (n, i) => e.log(t, n, i) }), s.queue.start(), this._session = s, this._status = "loading", this._saveState = "saved", Promise.resolve().then(() => e.load(t)).then(
      (n) => {
        this._session === s && (this._rows = v(this.config, n), this._settings = y(this.config, n), this._status = "ready", s.ready = !0, this._fire("loaded", { taskId: t }));
      },
      (n) => {
        this._session === s && (this._status = "error", this._error = n && n.status === 401 ? "Your login has expired. Log out and log in again to see your data." : "Your saved data could not be loaded.", this._fire("loaderror", { taskId: t, error: n }));
      }
    );
  }
  _endSession() {
    const t = this._session;
    t && (this._session = null, t.queue.stop(), t.autosave.flush(), t.queue.flush());
  }
  _retry() {
    this._endSession(), this._startSession();
  }
  _flushOnUnload() {
    this._session && (this._session.autosave.flushOnUnload(), this._session.queue.flushOnUnload());
  }
  _canPersist() {
    return !this.readonly && this._session && this._session.ready;
  }
  _log(t, e) {
    this._canPersist() && this._session.queue.push(t, e);
  }
  _fire(t, e) {
    this.dispatchEvent(new CustomEvent(t, { detail: e, bubbles: !0 }));
  }
  _changeRows(t) {
    this._rows = t, this._fire("datachange", { taskId: this.taskId, rows: b(this.config, t).rows }), this._scheduleSave();
  }
  _scheduleSave() {
    this._canPersist() && this._session.autosave.schedule(b(this.config, this._rows, this._settings));
  }
  // In read-only mode the choice only changes the view; it is not saved or logged
  _onConnectPoints(t) {
    const e = t.target.checked;
    this._settings = { ...this._settings, connectPoints: e }, this._fire("settingschange", { taskId: this.taskId, settings: this.getSettings() }), this._log("connect_points_changed", { value: e }), this._scheduleSave();
  }
  // ---- Window ----
  _defaultPosition() {
    const t = Math.min(900, window.innerWidth - 32);
    return { x: Math.max(16, window.innerWidth - t - 16), y: 72 };
  }
  _setView(t) {
    this._view = t, this._fire("viewchange", { view: t });
    const e = { open: "opened", closed: "closed", collapsed: "collapsed" };
    this._log(this._wasCollapsed && t === "open" ? "expanded" : e[t]), this._wasCollapsed = t === "collapsed";
  }
  // ---- Table events ----
  _onCellInput(t) {
    const { rowId: e, key: s, value: n } = t.detail;
    this._changeRows(this._rows.map((i) => i.id === e ? { ...i, values: { ...i.values, [s]: n } } : i));
  }
  _onCellCommit(t) {
    const { rowId: e, key: s, old: n, value: i } = t.detail;
    this._log("cell_edited", { rowId: e, key: s, old: n, value: i, valid: z(i) === null });
  }
  async _onRowAdd(t) {
    const e = w(this.config);
    this._changeRows(this._rows.concat(e)), this._log("row_added", { rowId: e.id }), await this.updateComplete;
    const s = this.renderRoot.querySelector("dpt-table");
    s && s.focusCell(e.id, t.detail.focusKey);
  }
  _onRowDelete(t) {
    const { rowId: e } = t.detail, s = this._rows.find((i) => i.id === e);
    if (!s) return;
    const n = this._rows.filter((i) => i.id !== e);
    this._changeRows(n.length ? n : [w(this.config)]), this._log("row_deleted", { rowId: e, values: s.values });
  }
  // ---- Rendering ----
  _saveText() {
    return this._canPersist() ? this._saveState === "error" ? this._saveError && this._saveError.status === 401 ? "Not saved: log in again" : "Not saved, retrying…" : this._saveState === "saved" ? "Saved" : "Saving…" : "";
  }
  _renderBody() {
    if (this._status === "loading") return c`<p class="note">Loading your data…</p>`;
    if (this._status === "error")
      return c`<div class="note error" role="alert">
        <p>${this._error}</p>
        ${this._session || this.adapter && this.taskId && this.config ? c`<button class="retry" @click=${this._retry}>Try again</button>` : f}
      </div>`;
    if (this._status !== "ready") return f;
    const t = this.config, e = {};
    t.columns.forEach((i) => e[i.key] = i);
    const s = j(t, this._rows), n = t.plot.yLabel || (s.length === 1 ? s[0].label : "");
    return c`
      <div class="panes">
        <dpt-table
          .columns=${t.columns}
          .rows=${this._rows}
          ?readonly=${this.readonly}
          @cell-input=${this._onCellInput}
          @cell-commit=${this._onCellCommit}
          @row-add=${this._onRowAdd}
          @row-delete=${this._onRowDelete}
        ></dpt-table>
        <div class="plot-pane">
          <label class="connect">
            <input type="checkbox" .checked=${this._settings.connectPoints} @change=${this._onConnectPoints} />
            Connect points
          </label>
          <dpt-plot
            .series=${s}
            .xLabel=${M(e[t.plot.x])}
            .yLabel=${n}
            ?line=${this._settings.connectPoints}
          ></dpt-plot>
        </div>
      </div>
    `;
  }
  render() {
    if (this._view === "closed") return f;
    const t = this._view === "collapsed", e = this.config && this.config.title || "Data table", s = this._pos || { x: 16, y: 72 };
    return c`
      <section
        class="frame ${t ? "collapsed" : ""}"
        role="dialog"
        aria-label=${e}
        style=${q({ left: `${s.x}px`, top: `${s.y}px`, maxHeight: `calc(100vh - ${s.y + 16}px)` })}
      >
        <header class="bar" @pointerdown=${this._drag.start}>
          <span class="grip" aria-hidden="true">
            <svg width="10" height="16" viewBox="0 0 10 16"><g fill="currentColor">
              <circle cx="2" cy="3" r="1.5"/><circle cx="8" cy="3" r="1.5"/>
              <circle cx="2" cy="8" r="1.5"/><circle cx="8" cy="8" r="1.5"/>
              <circle cx="2" cy="13" r="1.5"/><circle cx="8" cy="13" r="1.5"/>
            </g></svg>
          </span>
          <h2>${e}</h2>
          ${this.readonly ? c`<span class="badge">Read only</span>` : f}
          <span class="save" aria-live="polite">${this._saveText()}</span>
          <button
            class="icon"
            title=${t ? "Expand" : "Collapse"}
            aria-label=${t ? "Expand" : "Collapse"}
            aria-expanded=${t ? "false" : "true"}
            @click=${() => t ? this.expand() : this.collapse()}
          >
            ${t ? c`<svg width="14" height="14" viewBox="0 0 14 14"><rect x="2" y="2" width="10" height="10" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>` : c`<svg width="14" height="14" viewBox="0 0 14 14"><path d="M2 7h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`}
          </button>
          <button class="icon" title="Close" aria-label="Close" @click=${() => this.close()}>
            <svg width="14" height="14" viewBox="0 0 14 14"><path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
          </button>
        </header>
        ${t ? f : c`<div class="body">${this._renderBody()}</div>`}
      </section>
    `;
  }
  static get styles() {
    return E`
      :host {
        --dpt-surface: #ffffff;
        --dpt-header-bg: #f4f4f1;
        --dpt-border: #d9d8d2;
        --dpt-grid: #ebeae6;
        --dpt-text: #1f1f1d;
        --dpt-muted: #6b6a64;
        --dpt-accent: #2a78d6;
        --dpt-danger: #c43c3b;
        --dpt-danger-bg: #fdf0f0;
      }
      .frame {
        position: fixed;
        z-index: var(--dpt-z-index, 1000);
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        /* Grows with the table, up to the bottom of the screen (max-height is set from the position) */
        width: min(900px, calc(100vw - 32px));
        height: auto;
        min-width: 320px;
        min-height: 220px;
        max-width: 100vw;
        resize: both;
        overflow: hidden;
        background: var(--dpt-surface);
        color: var(--dpt-text);
        border: 1px solid var(--dpt-border);
        border-radius: 10px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.18), 0 2px 6px rgba(0, 0, 0, 0.08);
      }
      .frame.collapsed {
        width: 320px;
        height: auto;
        min-height: 0;
        resize: none;
      }
      .bar {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 6px 6px 10px;
        background: var(--dpt-header-bg);
        border-bottom: 1px solid var(--dpt-border);
        cursor: grab;
        user-select: none;
        touch-action: none;
      }
      .frame.collapsed .bar {
        border-bottom: 0;
      }
      .bar:active {
        cursor: grabbing;
      }
      .grip {
        color: var(--dpt-muted);
        display: flex;
      }
      h2 {
        margin: 0;
        font-size: 15px;
        font-weight: 600;
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .badge {
        font-size: 12px;
        padding: 2px 8px;
        border-radius: 999px;
        background: var(--dpt-grid);
        color: var(--dpt-muted);
      }
      .save {
        font-size: 12px;
        color: var(--dpt-muted);
        white-space: nowrap;
      }
      .icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 30px;
        height: 30px;
        border: 0;
        border-radius: 6px;
        background: none;
        color: var(--dpt-muted);
        cursor: pointer;
      }
      .icon:hover,
      .icon:focus-visible {
        background: var(--dpt-grid);
        color: var(--dpt-text);
      }
      .body {
        flex: 1;
        min-height: 0;
        padding: 12px;
        container-type: inline-size;
        display: flex;
        flex-direction: column;
      }
      /* The table takes the width its columns need (up to 65%); the plot gets the rest */
      .panes {
        flex: 1;
        min-height: 0;
        display: grid;
        grid-template-columns: fit-content(65%) minmax(280px, 1fr);
        grid-template-rows: minmax(0, 1fr);
        gap: 12px;
      }
      @container (max-width: 640px) {
        .panes {
          grid-template-columns: minmax(0, 1fr);
          grid-template-rows: minmax(0, auto) minmax(260px, 1fr);
        }
      }
      .plot-pane {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 0;
        min-height: 0;
      }
      .connect {
        align-self: flex-end;
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 13px;
        color: var(--dpt-text);
        cursor: pointer;
        user-select: none;
      }
      .connect input {
        width: 16px;
        height: 16px;
        margin: 0;
        accent-color: var(--dpt-accent);
        cursor: pointer;
      }
      dpt-plot {
        flex: 1;
      }
      .note {
        margin: auto;
        color: var(--dpt-muted);
        font-size: 14px;
        text-align: center;
      }
      .note.error {
        color: var(--dpt-danger);
      }
      .note p {
        margin: 0 0 8px;
      }
      .retry {
        font: inherit;
        font-size: 14px;
        padding: 6px 12px;
        border: 1px solid var(--dpt-border);
        border-radius: 6px;
        background: var(--dpt-surface);
        color: var(--dpt-text);
        cursor: pointer;
      }
    `;
  }
}
S("data-plot-tool", ot);
function ht({ baseURL: o, getToken: t, prefix: e = "/app/api", fetch: s }) {
  const n = String(o).replace(/\/+$/, "") + e, i = s || ((...a) => globalThis.fetch(...a)), r = encodeURIComponent;
  async function l(a, d, h, { keepalive: u = !1 } = {}) {
    const m = { Accept: "application/json" }, g = t && t();
    g && (m.Authorization = `Bearer ${g}`), h !== void 0 && (m["Content-Type"] = "application/json");
    const p = await i(n + d, {
      method: a,
      headers: m,
      keepalive: u,
      body: h === void 0 ? void 0 : JSON.stringify(h)
    });
    if (p.status === 404 && a === "GET") return null;
    if (!p.ok) {
      const C = new Error(`${a} ${d} failed with ${p.status}`);
      throw C.status = p.status, C;
    }
    return p.status === 204 ? null : p.json();
  }
  return {
    load: (a) => l("GET", `/datatables/${r(a)}`),
    save: (a, d, h) => l("PUT", `/datatables/${r(a)}`, d, h),
    log: (a, d, h) => l("POST", `/datatables/${r(a)}/events`, { events: d }, h),
    // Admin accounts only
    adminList: ({ taskId: a, username: d } = {}) => {
      const h = new URLSearchParams();
      a && h.set("taskId", a), d && h.set("username", d);
      const u = h.toString();
      return l("GET", `/admin/datatables${u ? `?${u}` : ""}`);
    },
    adminGet: (a, d) => l("GET", `/admin/datatables/${r(a)}/${r(d)}`)
  };
}
export {
  ot as DataPlotTool,
  Y as checkConfig,
  ht as createHttpAdapter,
  k as parseNumber,
  j as plotSeries
};
