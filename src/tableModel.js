/**
 * Table data as plain values, with no DOM. A row is { id, values: { [columnKey]: text } }.
 * Cells keep exactly what the student typed (text), so a half-typed "1." survives a save;
 * numbers are parsed only for checking and plotting.
 */

let counter = 0;

export function newRowId() {
  counter += 1;
  return `r${Date.now().toString(36)}${counter.toString(36)}`;
}

export function emptyRow(config) {
  const values = {};
  config.columns.forEach((c) => (values[c.key] = ""));
  return { id: newRowId(), values };
}

/** Blank → null, a number → that number, anything else → NaN. */
export function parseNumber(text) {
  if (text === null || text === undefined) return null;
  const t = String(text).trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

export function cellError(text) {
  return Number.isNaN(parseNumber(text)) ? "Enter a number" : null;
}

export function isRowEmpty(row) {
  return Object.values(row.values).every((v) => String(v).trim() === "");
}

/** Throws if the task config is unusable: no columns, repeated keys, or a plot column that does not exist. */
export function checkConfig(config) {
  if (!config || !Array.isArray(config.columns) || config.columns.length === 0) {
    throw new Error("config.columns must list at least one column");
  }
  const keys = new Set();
  config.columns.forEach((c) => {
    if (!c.key) throw new Error("Every column needs a key");
    if (keys.has(c.key)) throw new Error(`Column key "${c.key}" is used twice`);
    keys.add(c.key);
  });
  const plot = config.plot;
  if (!plot || !plot.x || !Array.isArray(plot.y) || plot.y.length === 0) {
    throw new Error("config.plot needs an x column and at least one y column");
  }
  [plot.x, ...plot.y].forEach((k) => {
    if (!keys.has(k)) throw new Error(`Plot column "${k}" is not in config.columns`);
  });
  return config;
}

export function columnLabel(column) {
  return column.unit ? `${column.label} (${column.unit})` : column.label;
}

/** One series per y column: the rows where both x and y are numbers, sorted by x. */
export function plotSeries(config, rows) {
  const byKey = {};
  config.columns.forEach((c) => (byKey[c.key] = c));
  return config.plot.y.map((key) => {
    const points = [];
    rows.forEach((row) => {
      const x = parseNumber(row.values[config.plot.x]);
      const y = parseNumber(row.values[key]);
      if (Number.isFinite(x) && Number.isFinite(y)) points.push({ x, y });
    });
    points.sort((a, b) => a.x - b.x);
    return { key, label: columnLabel(byKey[key]), points };
  });
}

/**
 * The saved form. Columns go with the rows so old saves can still be matched after a config change;
 * settings are the student's display choices (connectPoints).
 */
export function toDoc(config, rows, settings = defaultSettings(config)) {
  return {
    columns: config.columns.map((c) => ({ key: c.key, label: c.label, unit: c.unit || "" })),
    rows: rows.map((r) => ({ id: r.id, values: { ...r.values } })),
    settings: { connectPoints: Boolean(settings.connectPoints) },
  };
}

export function defaultSettings(config) {
  return { connectPoints: Boolean(config.plot.line) };
}

/** Settings from a saved doc; a doc saved before settings existed gets the config's defaults. */
export function settingsFromDoc(config, doc) {
  const saved = doc && doc.settings;
  const defaults = defaultSettings(config);
  return {
    connectPoints:
      saved && typeof saved.connectPoints === "boolean" ? saved.connectPoints : defaults.connectPoints,
  };
}

/** Rows for the current config from a saved doc: matched by column key; missing cells are blank. */
export function fromDoc(config, doc) {
  const saved = doc && Array.isArray(doc.rows) ? doc.rows : [];
  const rows = saved.map((r) => {
    const values = {};
    config.columns.forEach((c) => {
      const v = r.values ? r.values[c.key] : undefined;
      values[c.key] = v === undefined || v === null ? "" : String(v);
    });
    return { id: r.id || newRowId(), values };
  });
  return rows.length ? rows : [emptyRow(config)];
}

/** Rows from plain objects such as { mass: 2, velocity: 3.1 }; keys not in the config are ignored. */
export function rowsFromObjects(config, objects) {
  return objects.map((obj) => {
    const row = emptyRow(config);
    config.columns.forEach((c) => {
      const v = obj[c.key];
      if (v !== undefined && v !== null) row.values[c.key] = String(v);
    });
    return row;
  });
}
