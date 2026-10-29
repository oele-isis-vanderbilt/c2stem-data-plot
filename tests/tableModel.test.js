import { describe, it, expect } from "vitest";
import {
  checkConfig,
  emptyRow,
  fromDoc,
  isRowEmpty,
  parseNumber,
  cellError,
  plotSeries,
  rowsFromObjects,
  toDoc,
} from "../src/tableModel.js";

const config = {
  columns: [
    { key: "mass", label: "Mass", unit: "kg" },
    { key: "v", label: "Velocity", unit: "m/s" },
    { key: "ke", label: "Kinetic energy", unit: "J" },
  ],
  plot: { x: "mass", y: ["v", "ke"] },
};

const row = (values, id = "r1") => ({ id, values });

describe("parseNumber", () => {
  it("reads numbers, blanks and junk", () => {
    expect(parseNumber("2.5")).toBe(2.5);
    expect(parseNumber(" -3 ")).toBe(-3);
    expect(parseNumber("1e3")).toBe(1000);
    expect(parseNumber("")).toBe(null);
    expect(parseNumber("   ")).toBe(null);
    expect(parseNumber(null)).toBe(null);
    expect(parseNumber("abc")).toBeNaN();
    expect(parseNumber("1,5")).toBeNaN();
  });

  it("flags only non-numbers as errors", () => {
    expect(cellError("")).toBe(null);
    expect(cellError("4")).toBe(null);
    expect(cellError("x")).toBe("Enter a number");
  });
});

describe("checkConfig", () => {
  it("accepts a good config", () => {
    expect(checkConfig(config)).toBe(config);
  });

  it("rejects missing columns, repeated keys and unknown plot columns", () => {
    expect(() => checkConfig({ columns: [], plot: { x: "a", y: ["a"] } })).toThrow(/at least one column/);
    expect(() =>
      checkConfig({ columns: [{ key: "a" }, { key: "a" }], plot: { x: "a", y: ["a"] } })
    ).toThrow(/used twice/);
    expect(() => checkConfig({ columns: [{ key: "a" }], plot: { x: "a", y: ["b"] } })).toThrow(/"b"/);
    expect(() => checkConfig({ columns: [{ key: "a" }], plot: { x: "a", y: [] } })).toThrow(/plot/);
  });
});

describe("plotSeries", () => {
  it("makes one series per y column, skipping blanks and junk, sorted by x", () => {
    const rows = [
      row({ mass: "3", v: "1", ke: "x" }, "a"),
      row({ mass: "1", v: "3", ke: "9" }, "b"),
      row({ mass: "", v: "5", ke: "5" }, "c"),
      row({ mass: "2", v: "", ke: "4" }, "d"),
    ];
    const series = plotSeries(config, rows);
    expect(series.map((s) => s.label)).toEqual(["Velocity (m/s)", "Kinetic energy (J)"]);
    expect(series[0].points).toEqual([
      { x: 1, y: 3 },
      { x: 3, y: 1 },
    ]);
    expect(series[1].points).toEqual([
      { x: 1, y: 9 },
      { x: 2, y: 4 },
    ]);
  });
});

describe("saving and loading", () => {
  it("round-trips rows with their ids and the column list", () => {
    const rows = [row({ mass: "1.", v: "2", ke: "" })];
    const doc = toDoc(config, rows);
    expect(doc.columns.map((c) => c.key)).toEqual(["mass", "v", "ke"]);
    expect(fromDoc(config, doc)).toEqual(rows);
  });

  it("matches saved cells by key when columns change", () => {
    const doc = { rows: [{ id: "a", values: { mass: 2, old: "7" } }] };
    expect(fromDoc(config, doc)).toEqual([{ id: "a", values: { mass: "2", v: "", ke: "" } }]);
  });

  it("gives one blank row when nothing is saved", () => {
    const rows = fromDoc(config, null);
    expect(rows).toHaveLength(1);
    expect(isRowEmpty(rows[0])).toBe(true);
  });
});

describe("rows", () => {
  it("builds rows from objects, ignoring unknown keys", () => {
    const [r] = rowsFromObjects(config, [{ mass: 2, v: 3.5, extra: 1 }]);
    expect(r.values).toEqual({ mass: "2", v: "3.5", ke: "" });
    expect(r.id).toBeTruthy();
  });

  it("gives every new row its own id", () => {
    expect(emptyRow(config).id).not.toBe(emptyRow(config).id);
  });
});
