/** A full-screen layer over the canvas, hidden until it gets the `visible` class. */
export function createLayer(container: HTMLElement, className: string): HTMLElement {
  const layer = document.createElement('div');
  layer.className = `layer ${className}`;
  // The joystick listens on the container; touches on a layer belong to its buttons.
  layer.addEventListener('pointerdown', (event) => event.stopPropagation());
  container.append(layer);
  return layer;
}

export function setLayerVisible(layer: HTMLElement, visible: boolean): void {
  layer.classList.toggle('visible', visible);
}

export function layerTitle(text: string): HTMLElement {
  const title = document.createElement('h1');
  title.className = 'layer-title';
  title.textContent = text;
  return title;
}

/** `kind` picks the look: the main action, a secondary one or a small round icon button. */
export function layerButton(label: string, kind: 'primary' | 'secondary' | 'icon', onClick: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `layer-button layer-button-${kind}`;
  button.textContent = label;
  button.addEventListener('click', onClick);
  return button;
}
