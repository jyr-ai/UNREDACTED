const PAD = 8;
const CALLOUT_WIDTH = 280;

export function getSpotlightStyles(targetSelector, placement, vpW, vpH) {
  const el = document.querySelector(targetSelector);

  if (!el) {
    return {
      found: false,
      clipPath: null,
      callout: { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' },
    };
  }

  const rect = el.getBoundingClientRect();
  const top = rect.top - PAD;
  const left = rect.left - PAD;
  const w = rect.width + PAD * 2;
  const h = rect.height + PAD * 2;
  const bottom = top + h;
  const right = left + w;

  // Polygon with a rectangular hole cut out of the overlay
  const clipPath = [
    `0px 0px`,
    `0px ${vpH}px`,
    `${left}px ${vpH}px`,
    `${left}px ${top}px`,
    `${right}px ${top}px`,
    `${right}px ${bottom}px`,
    `${left}px ${bottom}px`,
    `${left}px ${vpH}px`,
    `${vpW}px ${vpH}px`,
    `${vpW}px 0px`,
  ].join(', ');

  const callout = computeCalloutPosition(rect, placement, vpW, vpH);

  return { found: true, rect, clipPath: `polygon(${clipPath})`, callout };
}

function computeCalloutPosition(rect, placement, vpW, vpH) {
  const GAP = 16;
  const base = { position: 'fixed', width: CALLOUT_WIDTH };

  switch (placement) {
    case 'right':
      return { ...base, top: clamp(rect.top + rect.height / 2, 60, vpH - 60), left: rect.right + GAP, transform: 'translateY(-50%)' };
    case 'left':
      return { ...base, top: clamp(rect.top + rect.height / 2, 60, vpH - 60), left: rect.left - CALLOUT_WIDTH - GAP, transform: 'translateY(-50%)' };
    case 'bottom':
      return { ...base, top: rect.bottom + GAP, left: clamp(rect.left + rect.width / 2 - CALLOUT_WIDTH / 2, 12, vpW - CALLOUT_WIDTH - 12) };
    case 'top':
      return { ...base, top: rect.top - GAP, left: clamp(rect.left + rect.width / 2 - CALLOUT_WIDTH / 2, 12, vpW - CALLOUT_WIDTH - 12), transform: 'translateY(-100%)' };
    default: // center
      return { ...base, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
  }
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}
