import { describe, it, expect } from "vitest";
import { clampPosition } from "../src/FloatingWindow.js";

const viewport = { width: 1000, height: 800 };
const size = { width: 400, height: 300 };

describe("clampPosition", () => {
  it("leaves a position on screen alone", () => {
    expect(clampPosition({ x: 100, y: 200 }, size, viewport)).toEqual({ x: 100, y: 200 });
  });

  it("keeps the window inside the sides and below the top", () => {
    expect(clampPosition({ x: -50, y: -10 }, size, viewport)).toEqual({ x: 0, y: 0 });
    expect(clampPosition({ x: 900, y: 100 }, size, viewport)).toEqual({ x: 600, y: 100 });
  });

  it("lets the window hang off the bottom but keeps the title bar visible", () => {
    expect(clampPosition({ x: 0, y: 790 }, size, viewport)).toEqual({ x: 0, y: 756 });
  });

  it("pins a window wider than the screen to the left edge", () => {
    expect(clampPosition({ x: 50, y: 0 }, { width: 1200, height: 300 }, viewport)).toEqual({ x: 0, y: 0 });
  });
});
