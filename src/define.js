/** Registers a custom element once, so loading the library twice does not throw. */
export function define(name, elementClass) {
  if (!customElements.get(name)) customElements.define(name, elementClass);
}
