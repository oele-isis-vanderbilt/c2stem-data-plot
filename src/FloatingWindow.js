/**
 * Moves a fixed-position window by dragging its title bar, and keeps it on screen.
 * The title bar stays reachable: the window can go partly off the bottom, never above the top or off the sides.
 */

const MIN_VISIBLE_HEIGHT = 44;

export function clampPosition(pos, size, viewport) {
  const maxX = Math.max(0, viewport.width - size.width);
  const maxY = Math.max(0, viewport.height - MIN_VISIBLE_HEIGHT);
  return {
    x: Math.round(Math.min(Math.max(0, pos.x), maxX)),
    y: Math.round(Math.min(Math.max(0, pos.y), maxY)),
  };
}

/**
 * A Lit reactive controller. getFrame() returns the window element; onMove(pos) is called while dragging
 * and when the browser window is resized; onEnd(pos) once a drag finishes.
 */
export class DragController {
  constructor(host, { getFrame, getPosition, onMove, onEnd }) {
    this.getFrame = getFrame;
    this.getPosition = getPosition;
    this.onMove = onMove;
    this.onEnd = onEnd;
    this.start = this.start.bind(this);
    this._onResize = () => {
      const pos = this.getPosition();
      if (pos && this.getFrame()) this.onMove(this.clamp(pos));
    };
    host.addController(this);
  }

  hostConnected() {
    window.addEventListener("resize", this._onResize);
  }

  hostDisconnected() {
    window.removeEventListener("resize", this._onResize);
  }

  clamp(pos) {
    const frame = this.getFrame();
    const rect = frame ? frame.getBoundingClientRect() : { width: 0, height: 0 };
    return clampPosition(pos, rect, { width: window.innerWidth, height: window.innerHeight });
  }

  /** pointerdown handler for the title bar. Presses on its buttons are left alone. */
  start(event) {
    if (event.button !== 0 || event.target.closest("button")) return;
    const frame = this.getFrame();
    if (!frame) return;
    const rect = frame.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    event.preventDefault();

    let last = null;
    const move = (e) => {
      last = this.clamp({ x: e.clientX - offsetX, y: e.clientY - offsetY });
      this.onMove(last);
    };
    const end = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", end);
      handle.removeEventListener("pointercancel", end);
      if (last) this.onEnd(last);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
  }
}
