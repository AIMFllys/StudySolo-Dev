export interface NodeConfigAnchorRect {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

interface ViewportSize {
  width: number;
  height: number;
}

interface PanelSize {
  width: number;
  height: number;
}

export interface PopoverPosition {
  top: number;
  left: number;
}

const VIEWPORT_PADDING = 12;
const ANCHOR_GAP = 12;

export function resolveNodeConfigPopoverPosition(
  anchorRect: NodeConfigAnchorRect,
  viewport: ViewportSize,
  panel: PanelSize,
): PopoverPosition {
  let left = anchorRect.right + ANCHOR_GAP;
  if (left + panel.width > viewport.width - VIEWPORT_PADDING) {
    left = anchorRect.left - panel.width - ANCHOR_GAP;
  }
  left = Math.max(VIEWPORT_PADDING, Math.min(left, viewport.width - panel.width - VIEWPORT_PADDING));

  let top = anchorRect.top;
  if (top + panel.height > viewport.height - VIEWPORT_PADDING) {
    top = viewport.height - panel.height - VIEWPORT_PADDING;
  }
  top = Math.max(VIEWPORT_PADDING, top);

  return { top, left };
}
