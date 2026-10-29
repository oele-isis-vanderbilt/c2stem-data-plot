# @c2stem/data-plot

A floating window with a fixed-column table and a plot of whatever students type into it. It's a web component (`<data-plot-tool>`), so it works in Vue, React or plain HTML.

- The window can be dragged by its title bar, collapsed to the bar, closed and opened again.
- The window grows with the table up to the bottom of the screen, so the rows don't scroll until the screen is full.
- A **Connect points** checkbox joins each series' points in order of x.
- Each task sets its own columns and its x/y plot columns.
- Saving and logging go through an **adapter** that the host app supplies. The component never calls a server itself.

## Use

```bash
npm install ../c2stem-data-plot   # or a git URL
```

```js
import { createHttpAdapter } from "@c2stem/data-plot";

const tool = document.createElement("data-plot-tool");
tool.config = {
  title: "Mass vs stopping position",
  columns: [
    { key: "mass", label: "Mass", unit: "kg" },
    { key: "stopPos", label: "Stopping position", unit: "m" },
  ],
  plot: { x: "mass", y: ["stopPos"] },
};
tool.taskId = "lesson1";
tool.adapter = createHttpAdapter({ baseURL: "https://agent.c2-stem.org", getToken: () => myToken });
document.body.appendChild(tool);

tool.open();
```

## Config

| Field | Meaning |
|---|---|
| `title` | Text in the title bar |
| `columns` | `[{ key, label, unit }]`, in display order. `key` must be unique |
| `plot.x` | Key of the x column |
| `plot.y` | Keys of the y columns, all plotted on one shared y axis |
| `plot.yLabel` | y axis title. Defaults to the column label when there is one y column, otherwise none |
| `plot.line` | Whether **Connect points** starts ticked. Students can change it; their choice is saved with the table |

Cells hold exactly what was typed. Cells that aren't numbers are marked and left out of the plot.

## Properties, methods and events

| | |
|---|---|
| `config`, `taskId` (attribute `task-id`), `adapter` | Setting these loads the saved table for the task |
| `data` | A saved doc to show without loading, e.g. for an admin view |
| `readonly` | No editing, saving or logging |
| `open()`, `close()`, `collapse()`, `expand()`, `toggle()`, `view` | Window state; `view` is `closed`, `open` or `collapsed` |
| `appendRows(objects, { source })` | Adds rows such as `{ mass: 2, stopPos: 6 }` (for linking to a simulation). Blank rows already there are replaced |
| `getRows()`, `getSettings()`, `flush()` | Read the rows or settings; send any waiting save or log events now |
| events | `datachange`, `settingschange`, `viewchange`, `savestate`, `loaded`, `loaderror` |

**Stacking:** the window uses `position: fixed` with `z-index: var(--dpt-z-index, 1000)`. A host overlay with a higher z-index covers and freezes it like the rest of the page.

## Adapter

```js
{
  load(taskId)                      // → saved doc or null
  save(taskId, doc, { keepalive })  // doc = { columns, rows: [{ id, values }], settings: { connectPoints } }
  log(taskId, events, { keepalive }) // events = [{ type, time, data }]
}
```

**Saving:**
- It saves about 1 s after the last edit, one save at a time, and retries a failed save.
- Saving stays off until a load succeeds, so a failed load can never overwrite the saved table.
- When the page closes, waiting saves and events are sent with `keepalive`.

**Logged events:**
- `opened`, `closed`, `collapsed`, `expanded`, `moved`
- `row_added`, `row_deleted`, `rows_appended`, `connect_points_changed` (`value`)
- `cell_edited` (`rowId`, `key`, `old`, `value`, `valid`)

`createHttpAdapter({ baseURL, getToken, prefix = "/app/api" })` calls the agent server:

| Method | Path |
|---|---|
| `GET` / `PUT` | `{prefix}/datatables/{taskId}` (404 = nothing saved) |
| `POST` | `{prefix}/datatables/{taskId}/events` with `{ events }` |
| `GET` | `{prefix}/admin/datatables?taskId=&username=` (`adminList`) |
| `GET` | `{prefix}/admin/datatables/{username}/{taskId}` (`adminGet`) |

## Develop

```bash
npm install
npm run dev     # demo at http://localhost:5173/demo/ with an in-memory server
npm test
npm run build   # dist/data-plot.js; lit and chart.js are left for the host to install
```

## Release

`dist/` is committed, so hosts install the library without building it. This matters for servers that can only run Node 16, where Vite won't run. Before each tag:

```bash
npm test
npm run build
git add dist && git commit -m "..."
git tag v0.1.x && git push && git push origin v0.1.x
```

Hosts then install it with `npm install github:oele-isis-vanderbilt/c2stem-data-plot#v0.1.x`.
