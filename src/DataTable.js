import { LitElement, html, css, nothing } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { live } from "lit/directives/live.js";
import { cellError } from "./tableModel.js";
import { define } from "./define.js";

/**
 * The editable table. It does not own the rows: it reports edits as events and the tool updates `rows`.
 *
 * Events (not composed; the tool listens on this element):
 *   cell-input   { rowId, key, value }        on every keystroke
 *   cell-commit  { rowId, key, old, value }   when a changed cell loses focus or Enter is pressed
 *   row-add      { focusKey }                 Add row, or Enter on the last row
 *   row-delete   { rowId }
 */
export class DataTable extends LitElement {
  static get properties() {
    return {
      columns: { attribute: false },
      rows: { attribute: false },
      readonly: { type: Boolean },
    };
  }

  constructor() {
    super();
    this.columns = [];
    this.rows = [];
    this.readonly = false;
    this._focusValue = "";
  }

  async focusCell(rowId, key) {
    await this.updateComplete;
    const input = this.renderRoot.querySelector(`input[data-row="${rowId}"][data-key="${key}"]`);
    if (input) input.focus();
  }

  _emit(name, detail) {
    this.dispatchEvent(new CustomEvent(name, { detail }));
  }

  _onFocus(e) {
    this._focusValue = e.target.value;
  }

  _onInput(e) {
    const { row, key } = e.target.dataset;
    this._emit("cell-input", { rowId: row, key, value: e.target.value });
  }

  _onChange(e) {
    const { row, key } = e.target.dataset;
    if (e.target.value !== this._focusValue) {
      this._emit("cell-commit", { rowId: row, key, old: this._focusValue, value: e.target.value });
      this._focusValue = e.target.value;
    }
  }

  _onKeydown(e) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const { row, key } = e.target.dataset;
    const index = this.rows.findIndex((r) => r.id === row);
    const next = index + (e.shiftKey ? -1 : 1);
    if (next >= 0 && next < this.rows.length) {
      this.focusCell(this.rows[next].id, key);
    } else if (next === this.rows.length && !this.readonly) {
      // Leaving the cell commits it first, then a new row opens below
      e.target.blur();
      this._emit("row-add", { focusKey: key });
    }
  }

  render() {
    const { columns, rows, readonly } = this;
    return html`
      <div class="scroll">
        <table>
          <thead>
            <tr>
              <th class="num" scope="col"><span class="sr">Row</span></th>
              ${columns.map(
                (c) => html`<th scope="col">${c.label}${c.unit ? html`<span class="unit">(${c.unit})</span>` : nothing}</th>`
              )}
              ${readonly ? nothing : html`<th class="act" scope="col"><span class="sr">Delete</span></th>`}
            </tr>
          </thead>
          <tbody>
            ${repeat(
              rows,
              (r) => r.id,
              (r, i) => html`
                <tr>
                  <th class="num" scope="row">${i + 1}</th>
                  ${columns.map((c) => {
                    const value = r.values[c.key] ?? "";
                    const error = cellError(value);
                    return html`<td>
                      <input
                        type="text"
                        inputmode="decimal"
                        autocomplete="off"
                        class=${error ? "invalid" : ""}
                        aria-invalid=${error ? "true" : "false"}
                        aria-label="${c.label}, row ${i + 1}"
                        title=${error || ""}
                        data-row=${r.id}
                        data-key=${c.key}
                        .value=${live(value)}
                        ?readonly=${readonly}
                        @focus=${this._onFocus}
                        @input=${this._onInput}
                        @change=${this._onChange}
                        @keydown=${this._onKeydown}
                      />
                    </td>`;
                  })}
                  ${readonly
                    ? nothing
                    : html`<td class="act">
                        <button
                          class="del"
                          title="Delete row"
                          aria-label="Delete row ${i + 1}"
                          @click=${() => this._emit("row-delete", { rowId: r.id })}
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
      ${readonly
        ? nothing
        : html`<button class="add" @click=${() => this._emit("row-add", { focusKey: columns[0].key })}>+ Add row</button>`}
    `;
  }

  static get styles() {
    return css`
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

define("dpt-table", DataTable);
