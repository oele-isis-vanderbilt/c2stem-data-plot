import { LitElement, html, css, nothing } from "lit";
import { styleMap } from "lit/directives/style-map.js";
import {
  checkConfig,
  columnLabel,
  emptyRow,
  fromDoc,
  isRowEmpty,
  plotSeries,
  rowsFromObjects,
  toDoc,
  cellError,
} from "./tableModel.js";
import { createAutosave } from "./autosave.js";
import { createEventQueue } from "./eventQueue.js";
import { DragController } from "./FloatingWindow.js";
import { define } from "./define.js";
import "./DataTable.js";
import "./PlotView.js";

const POSITION_KEY = "c2stem-data-plot:position";

function readPosition() {
  try {
    const pos = JSON.parse(localStorage.getItem(POSITION_KEY));
    return pos && Number.isFinite(pos.x) && Number.isFinite(pos.y) ? pos : null;
  } catch (e) {
    return null;
  }
}

function writePosition(pos) {
  try {
    localStorage.setItem(POSITION_KEY, JSON.stringify(pos));
  } catch (e) {
    // Position is only a convenience
  }
}

/**
 * <data-plot-tool>: a floating window with a fixed-column table and a plot of what is entered.
 *
 * Properties
 *   config    { title, columns: [{ key, label, unit }], plot: { x, y: [keys], yLabel?, line? } }
 *   taskId    which saved table to load (attribute: task-id)
 *   adapter   { load(taskId), save(taskId, doc, opts), log(taskId, events, opts) }; without one, nothing is saved
 *   data      a saved doc to show instead of loading (e.g. an admin viewing a student's table)
 *   readonly  no editing, saving or logging
 *
 * Methods: open(), close(), collapse(), expand(), toggle(), appendRows(objects, { source }), getRows(), flush()
 * Events:  datachange { taskId, rows }, viewchange { view }, savestate { state, error }, loaded { taskId },
 *          loaderror { taskId, error }
 */
export class DataPlotTool extends LitElement {
  static get properties() {
    return {
      config: { attribute: false },
      taskId: { attribute: "task-id" },
      adapter: { attribute: false },
      data: { attribute: false },
      readonly: { type: Boolean, reflect: true },
      _rows: { state: true },
      _status: { state: true },
      _error: { state: true },
      _saveState: { state: true },
      _view: { state: true },
      _pos: { state: true },
    };
  }

  constructor() {
    super();
    this.readonly = false;
    this._rows = [];
    this._status = "idle"; // idle | loading | ready | error
    this._error = "";
    this._saveState = "saved";
    this._saveError = null;
    this._view = "closed"; // closed | open | collapsed
    this._pos = null;
    this._session = null;
    this._savedHeight = "";
    this._drag = new DragController(this, {
      getFrame: () => this.renderRoot && this.renderRoot.querySelector(".frame"),
      getPosition: () => this._pos,
      onMove: (pos) => (this._pos = pos),
      onEnd: (pos) => {
        writePosition(pos);
        this._log("moved", pos);
      },
    });
    this._onPageHide = () => this._flushOnUnload();
    this._onVisibility = () => {
      if (document.visibilityState === "hidden") this.flush();
    };
  }

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener("pagehide", this._onPageHide);
    document.addEventListener("visibilitychange", this._onVisibility);
    if (this._detached) {
      this._detached = false;
      this._reload();
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener("pagehide", this._onPageHide);
    document.removeEventListener("visibilitychange", this._onVisibility);
    this._endSession();
    this._detached = true;
  }

  // ---- Public API ----

  get view() {
    return this._view;
  }

  open() {
    if (this._view === "open") return;
    if (!this._pos) this._pos = readPosition() || this._defaultPosition();
    this._setView("open");
  }

  close() {
    if (this._view === "closed") return;
    this._setView("closed");
    this.flush();
  }

  collapse() {
    if (this._view !== "open") return;
    const frame = this.renderRoot.querySelector(".frame");
    // A height the student set by resizing would keep the collapsed bar tall
    if (frame) {
      this._savedHeight = frame.style.height;
      frame.style.height = "";
    }
    this._setView("collapsed");
  }

  async expand() {
    if (this._view !== "collapsed") return;
    this._setView("open");
    await this.updateComplete;
    const frame = this.renderRoot.querySelector(".frame");
    if (frame && this._savedHeight) frame.style.height = this._savedHeight;
  }

  toggle() {
    if (this._view === "closed") this.open();
    else this.close();
  }

  /** Adds rows from plain objects, e.g. data from a simulation. Blank rows already there are replaced. */
  appendRows(objects, { source = "host" } = {}) {
    if (!this.config || this.readonly || !Array.isArray(objects) || objects.length === 0) return;
    const added = rowsFromObjects(this.config, objects);
    const kept = this._rows.filter((r) => !isRowEmpty(r));
    this._changeRows(kept.concat(added));
    this._log("rows_appended", { source, count: added.length, rowIds: added.map((r) => r.id) });
  }

  getRows() {
    return this.config ? toDoc(this.config, this._rows).rows : [];
  }

  /** Sends any waiting save and log events now. */
  async flush() {
    const session = this._session;
    if (!session) return;
    await Promise.all([session.autosave.flush(), session.queue.flush()]);
  }

  // ---- Loading and saving ----

  willUpdate(changed) {
    if (changed.has("config") || changed.has("taskId") || changed.has("adapter") || changed.has("data")) {
      this._reload(changed.has("config") && !changed.has("taskId") && !changed.has("adapter"));
    }
  }

  _reload(configOnly = false) {
    const config = this.config;
    if (!config) return;
    try {
      checkConfig(config);
    } catch (e) {
      this._endSession();
      this._status = "error";
      this._error = `This tool is set up wrongly: ${e.message}`;
      return;
    }
    if (this.data) {
      this._endSession();
      this._rows = fromDoc(config, this.data);
      this._status = "ready";
      return;
    }
    if (!this.adapter || !this.taskId) {
      // No saving: the table still works, and keeps what was typed
      this._endSession();
      this._rows = fromDoc(config, { rows: this._rows });
      this._status = "ready";
      return;
    }
    if (configOnly && this._session) {
      this._rows = fromDoc(config, { rows: this._rows });
      return;
    }
    this._endSession();
    this._startSession();
  }

  _startSession() {
    const taskId = this.taskId;
    const adapter = this.adapter;
    const session = { taskId, ready: false };
    session.autosave = createAutosave({
      save: (doc, opts) => adapter.save(taskId, doc, opts),
      onState: (state, error) => {
        if (this._session !== session) return;
        this._saveState = state;
        this._saveError = error || null;
        this._fire("savestate", { state, error });
      },
    });
    session.queue = createEventQueue({ send: (events, opts) => adapter.log(taskId, events, opts) });
    session.queue.start();
    this._session = session;
    this._status = "loading";
    this._saveState = "saved";

    Promise.resolve()
      .then(() => adapter.load(taskId))
      .then(
        (doc) => {
          if (this._session !== session) return;
          this._rows = fromDoc(this.config, doc);
          this._status = "ready";
          session.ready = true;
          this._fire("loaded", { taskId });
        },
        (error) => {
          if (this._session !== session) return;
          // Saving stays off, so a failed load can never overwrite the saved table
          this._status = "error";
          this._error =
            error && error.status === 401
              ? "Your login has expired. Log out and log in again to see your data."
              : "Your saved data could not be loaded.";
          this._fire("loaderror", { taskId, error });
        }
      );
  }

  _endSession() {
    const session = this._session;
    if (!session) return;
    this._session = null;
    session.queue.stop();
    session.autosave.flush();
    session.queue.flush();
  }

  _retry() {
    this._endSession();
    this._startSession();
  }

  _flushOnUnload() {
    if (!this._session) return;
    this._session.autosave.flushOnUnload();
    this._session.queue.flushOnUnload();
  }

  _canPersist() {
    return !this.readonly && this._session && this._session.ready;
  }

  _log(type, data) {
    if (this._canPersist()) this._session.queue.push(type, data);
  }

  _fire(name, detail) {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true }));
  }

  _changeRows(rows) {
    this._rows = rows;
    const doc = toDoc(this.config, rows);
    this._fire("datachange", { taskId: this.taskId, rows: doc.rows });
    if (this._canPersist()) this._session.autosave.schedule(doc);
  }

  // ---- Window ----

  _defaultPosition() {
    const width = Math.min(760, window.innerWidth - 32);
    return { x: Math.max(16, window.innerWidth - width - 16), y: 72 };
  }

  _setView(view) {
    this._view = view;
    this._fire("viewchange", { view });
    const names = { open: "opened", closed: "closed", collapsed: "collapsed" };
    this._log(this._wasCollapsed && view === "open" ? "expanded" : names[view]);
    this._wasCollapsed = view === "collapsed";
  }

  // ---- Table events ----

  _onCellInput(e) {
    const { rowId, key, value } = e.detail;
    this._changeRows(this._rows.map((r) => (r.id === rowId ? { ...r, values: { ...r.values, [key]: value } } : r)));
  }

  _onCellCommit(e) {
    const { rowId, key, old, value } = e.detail;
    this._log("cell_edited", { rowId, key, old, value, valid: cellError(value) === null });
  }

  async _onRowAdd(e) {
    const row = emptyRow(this.config);
    this._changeRows(this._rows.concat(row));
    this._log("row_added", { rowId: row.id });
    await this.updateComplete;
    const table = this.renderRoot.querySelector("dpt-table");
    if (table) table.focusCell(row.id, e.detail.focusKey);
  }

  _onRowDelete(e) {
    const { rowId } = e.detail;
    const row = this._rows.find((r) => r.id === rowId);
    if (!row) return;
    const rest = this._rows.filter((r) => r.id !== rowId);
    this._changeRows(rest.length ? rest : [emptyRow(this.config)]);
    this._log("row_deleted", { rowId, values: row.values });
  }

  // ---- Rendering ----

  _saveText() {
    if (!this._canPersist()) return "";
    if (this._saveState === "error") {
      return this._saveError && this._saveError.status === 401 ? "Not saved: log in again" : "Not saved, retrying…";
    }
    if (this._saveState === "saved") return "Saved";
    return "Saving…";
  }

  _renderBody() {
    if (this._status === "loading") return html`<p class="note">Loading your data…</p>`;
    if (this._status === "error") {
      return html`<div class="note error" role="alert">
        <p>${this._error}</p>
        ${this._session || (this.adapter && this.taskId && this.config)
          ? html`<button class="retry" @click=${this._retry}>Try again</button>`
          : nothing}
      </div>`;
    }
    if (this._status !== "ready") return nothing;
    const config = this.config;
    const byKey = {};
    config.columns.forEach((c) => (byKey[c.key] = c));
    const series = plotSeries(config, this._rows);
    const yLabel = config.plot.yLabel || (series.length === 1 ? series[0].label : "");
    return html`
      <div class="panes">
        <dpt-table
          .columns=${config.columns}
          .rows=${this._rows}
          ?readonly=${this.readonly}
          @cell-input=${this._onCellInput}
          @cell-commit=${this._onCellCommit}
          @row-add=${this._onRowAdd}
          @row-delete=${this._onRowDelete}
        ></dpt-table>
        <dpt-plot
          .series=${series}
          .xLabel=${columnLabel(byKey[config.plot.x])}
          .yLabel=${yLabel}
          ?line=${Boolean(config.plot.line)}
        ></dpt-plot>
      </div>
    `;
  }

  render() {
    if (this._view === "closed") return nothing;
    const collapsed = this._view === "collapsed";
    const title = (this.config && this.config.title) || "Data table";
    const pos = this._pos || { x: 16, y: 72 };
    return html`
      <section
        class="frame ${collapsed ? "collapsed" : ""}"
        role="dialog"
        aria-label=${title}
        style=${styleMap({ left: `${pos.x}px`, top: `${pos.y}px` })}
      >
        <header class="bar" @pointerdown=${this._drag.start}>
          <span class="grip" aria-hidden="true">
            <svg width="10" height="16" viewBox="0 0 10 16"><g fill="currentColor">
              <circle cx="2" cy="3" r="1.5"/><circle cx="8" cy="3" r="1.5"/>
              <circle cx="2" cy="8" r="1.5"/><circle cx="8" cy="8" r="1.5"/>
              <circle cx="2" cy="13" r="1.5"/><circle cx="8" cy="13" r="1.5"/>
            </g></svg>
          </span>
          <h2>${title}</h2>
          ${this.readonly ? html`<span class="badge">Read only</span>` : nothing}
          <span class="save" aria-live="polite">${this._saveText()}</span>
          <button
            class="icon"
            title=${collapsed ? "Expand" : "Collapse"}
            aria-label=${collapsed ? "Expand" : "Collapse"}
            aria-expanded=${collapsed ? "false" : "true"}
            @click=${() => (collapsed ? this.expand() : this.collapse())}
          >
            ${collapsed
              ? html`<svg width="14" height="14" viewBox="0 0 14 14"><rect x="2" y="2" width="10" height="10" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>`
              : html`<svg width="14" height="14" viewBox="0 0 14 14"><path d="M2 7h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`}
          </button>
          <button class="icon" title="Close" aria-label="Close" @click=${() => this.close()}>
            <svg width="14" height="14" viewBox="0 0 14 14"><path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
          </button>
        </header>
        ${collapsed ? nothing : html`<div class="body">${this._renderBody()}</div>`}
      </section>
    `;
  }

  static get styles() {
    return css`
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
        width: min(760px, calc(100vw - 32px));
        height: min(440px, calc(100vh - 96px));
        min-width: 320px;
        min-height: 220px;
        max-width: 100vw;
        max-height: 100vh;
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
      .panes {
        flex: 1;
        min-height: 0;
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr);
        gap: 12px;
      }
      @container (max-width: 560px) {
        .panes {
          grid-template-columns: minmax(0, 1fr);
          grid-template-rows: minmax(120px, 1fr) minmax(200px, 1fr);
        }
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

define("data-plot-tool", DataPlotTool);
