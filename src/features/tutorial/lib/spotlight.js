const PAD = 8;
const CALLOUT_WIDTH = 280;

/**
 * Compute spotlight geometry + callout placement for a tour step.
 *
 * Returns:
 *   {
 *     found: boolean,
 *     hole:  { top, left, width, height } | null  // viewport coords of spotlight rect
 *     callout: { position, top, left, transform, width }
 *   }
 *
 * The dim overlay is rendered as 4 rectangles around the hole (top/right/bottom/left)
 * — NOT as a polygon clip-path. Clip-path with a notch polygon is unreliable across
 * browsers (depends on winding rule + self-intersection handling). 4 rects is bulletproof.
 */
export function getSpotlightStyles(targetSelector, placement, vpW, vpH) {
  const el = targetSelector ? document.querySelector(targetSelector) : null;

  if (!el) {
    return {
      found: false,
      hole: null,
      callout: { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: CALLOUT_WIDTH },
    };
  }

  const rect = el.getBoundingClientRect();
  const top = Math.max(0, rect.top - PAD);
  const left = Math.max(0, rect.left - PAD);
  const right = Math.min(vpW, rect.right + PAD);
  const bottom = Math.min(vpH, rect.bottom + PAD);

  // Skip drawing the hole if the target is fully off-screen — fall back to dim full screen.
  const visible = right > left && bottom > top && rect.bottom > 0 && rect.top < vpH;
  if (!visible) {
    return {
      found: true,
      hole: null,
      callout: computeCalloutPosition(rect, placement, vpW, vpH),
    };
  }

  return {
    found: true,
    hole: { top, left, width: right - left, height: bottom - top },
    callout: computeCalloutPosition(rect, placement, vpW, vpH),
  };
}

function computeCalloutPosition(rect, placement, vpW, vpH) {
  const GAP = 16;
  const base = { position: 'fixed', width: CALLOUT_WIDTH };
  const CALLOUT_HEIGHT_EST = 200; // rough — used only for clamping

  switch (placement) {
    case 'right': {
      const left = rect.right + GAP;
      // If callout would go off-screen to the right, fall back to center.
      if (left + CALLOUT_WIDTH > vpW - 12) {
        return { ...base, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
      }
      return { ...base, top: clamp(rect.top + rect.height / 2, 60, vpH - 60), left, transform: 'translateY(-50%)' };
    }
    case 'left': {
      const left = rect.left - CALLOUT_WIDTH - GAP;
      if (left < 12) {
        return { ...base, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
      }
      return { ...base, top: clamp(rect.top + rect.height / 2, 60, vpH - 60), left, transform: 'translateY(-50%)' };
    }
    case 'bottom': {
      const top = rect.bottom + GAP;
      // If callout would render below the viewport, fall back to center.
      if (top + CALLOUT_HEIGHT_EST > vpH - 12) {
        return { ...base, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
      }
      return { ...base, top, left: clamp(rect.left + rect.width / 2 - CALLOUT_WIDTH / 2, 12, vpW - CALLOUT_WIDTH - 12) };
    }
    case 'top': {
      const top = rect.top - GAP - CALLOUT_HEIGHT_EST;
      if (top < 12) {
        return { ...base, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
      }
      return { ...base, top: rect.top - GAP, left: clamp(rect.left + rect.width / 2 - CALLOUT_WIDTH / 2, 12, vpW - CALLOUT_WIDTH - 12), transform: 'translateY(-100%)' };
    }
    default: // center
      return { ...base, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
  }
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}
