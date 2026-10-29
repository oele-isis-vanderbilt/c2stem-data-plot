import { LitElement, html, css, nothing } from "lit";
import { Chart, ScatterController, LineElement, PointElement, LinearScale, Tooltip, Legend } from "chart.js";
import { define } from "./define.js";

Chart.register(ScatterController, LineElement, PointElement, LinearScale, Tooltip, Legend);

// Fixed order, never cycled; checked for colour-blind separation. Each series also gets its own marker shape.
const COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"];
const SHAPES = ["circle", "triangle", "rect", "rectRot", "crossRot", "star", "rectRounded", "cross"];
const TEXT = "#55544f";
const GRID = "#ebeae6";

/** The plot: one scatter series per y column, all on one shared y axis. */
export class PlotView extends LitElement {
  static get properties() {
    return {
      series: { attribute: false },
      xLabel: { attribute: false },
      yLabel: { attribute: false },
      line: { type: Boolean },
    };
  }

  constructor() {
    super();
    this.series = [];
    this.xLabel = "";
    this.yLabel = "";
    this.line = false;
    this._chart = null;
  }

  connectedCallback() {
    super.connectedCallback();
    // A chart destroyed on disconnect is rebuilt on the next update
    this.requestUpdate();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._chart) this._chart.destroy();
    this._chart = null;
  }

  _datasets() {
    return this.series.map((s, i) => ({
      label: s.label,
      data: s.points,
      showLine: this.line,
      borderColor: COLORS[i % COLORS.length],
      backgroundColor: COLORS[i % COLORS.length],
      pointStyle: SHAPES[i % SHAPES.length],
      pointRadius: 5,
      pointHoverRadius: 7,
      pointHitRadius: 10,
      borderWidth: 2,
    }));
  }

  _options() {
    const axis = (text) => ({
      type: "linear",
      title: { display: Boolean(text), text, color: TEXT },
      ticks: { color: TEXT },
      grid: { color: GRID },
      border: { color: GRID },
    });
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      scales: { x: axis(this.xLabel), y: axis(this.yLabel) },
      plugins: {
        legend: {
          display: this.series.length > 1,
          labels: { usePointStyle: true, color: TEXT },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y}  (${this.xLabel}: ${ctx.parsed.x})`,
          },
        },
      },
    };
  }

  updated() {
    const canvas = this.renderRoot.querySelector("canvas");
    if (!canvas) return;
    if (!this._chart) {
      this._chart = new Chart(canvas, {
        type: "scatter",
        data: { datasets: this._datasets() },
        options: this._options(),
      });
      return;
    }
    this._chart.data.datasets = this._datasets();
    this._chart.options = this._options();
    this._chart.update("none");
  }

  render() {
    const empty = this.series.every((s) => s.points.length === 0);
    const names = this.series.map((s) => s.label).join(", ");
    return html`
      <div class="wrap">
        <canvas role="img" aria-label="Plot of ${names} against ${this.xLabel}"></canvas>
        ${empty ? html`<p class="empty">Enter numbers in the table to see them plotted.</p>` : nothing}
      </div>
    `;
  }

  static get styles() {
    return css`
      :host {
        display: block;
        min-height: 0;
        min-width: 0;
      }
      .wrap {
        position: relative;
        height: 100%;
        min-height: 200px;
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

define("dpt-plot", PlotView);
