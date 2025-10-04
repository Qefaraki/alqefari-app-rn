export const DEFAULT_BOUNDS = {
  minX: 0,
  maxX: 0,
  minY: 0,
  maxY: 0,
  width: 0,
  height: 0,
};

const DEFAULT_VIEWPORT = { width: 1, height: 1 };
const MIN_MARGIN_PX = 120;        // Comfortable margin beyond tree edge
const MIN_MARGIN_RATIO = 0.08;    // 8% of tree size for proportional padding
const EXTRA_VIEWPORT_RATIO = 0.25; // 25% extra viewport for natural exploration
const MIN_VIEWPORT_RATIO = 0.0;
const INFINITE_RANGE = [-Number.MAX_VALUE, Number.MAX_VALUE];

function isFinitePositive(value) {
  "worklet";
  return Number.isFinite(value) && value > 0;
}

function sanitizeViewport(viewport) {
  "worklet";
  const vp = viewport ?? DEFAULT_VIEWPORT;
  const width = isFinitePositive(vp.width) ? vp.width : 1;
  const height = isFinitePositive(vp.height) ? vp.height : 1;
  return { width, height };
}

function sanitizeBounds(bounds) {
  "worklet";
  const b = bounds ?? DEFAULT_BOUNDS;
  const minX = Number.isFinite(b.minX) ? b.minX : 0;
  const maxX = Number.isFinite(b.maxX) ? b.maxX : minX;
  const minY = Number.isFinite(b.minY) ? b.minY : 0;
  const maxY = Number.isFinite(b.maxY) ? b.maxY : minY;
  const width = Math.max(Number.isFinite(b.width) ? b.width : maxX - minX, 0);
  const height = Math.max(Number.isFinite(b.height) ? b.height : maxY - minY, 0);
  return { minX, maxX, minY, maxY, width, height };
}

export function computeEffectiveMinScale(viewport, bounds, explicitMinZoom, explicitMaxZoom) {
  'worklet';
  const { width: vpWidth, height: vpHeight } = sanitizeViewport(viewport);
  const { width: treeWidth, height: treeHeight } = sanitizeBounds(bounds);

  const minZoom = Number.isFinite(explicitMinZoom) && explicitMinZoom > 0 ? explicitMinZoom : 0.01;
  const maxZoom = Number.isFinite(explicitMaxZoom) && explicitMaxZoom > minZoom ? explicitMaxZoom : minZoom + 0.01;

  const widthBased = treeWidth > 0 ? (MIN_VIEWPORT_RATIO * vpWidth) / treeWidth : minZoom;
  const heightBased = treeHeight > 0 ? (MIN_VIEWPORT_RATIO * vpHeight) / treeHeight : minZoom;

  const effectiveMin = Math.max(minZoom, widthBased, heightBased);
  return Math.min(effectiveMin, maxZoom);
}

export function clampStageToBounds(stage, viewport, bounds, explicitMinZoom, explicitMaxZoom) {
  'worklet';
  const { width: vpWidth, height: vpHeight } = sanitizeViewport(viewport);
  const tree = sanitizeBounds(bounds);

  const minZoom = Number.isFinite(explicitMinZoom) && explicitMinZoom > 0 ? explicitMinZoom : 0.01;
  const maxZoom = Number.isFinite(explicitMaxZoom) && explicitMaxZoom > minZoom ? explicitMaxZoom : minZoom + 0.01;

  const proposed = {
    x: Number.isFinite(stage?.x) ? stage.x : 0,
    y: Number.isFinite(stage?.y) ? stage.y : 0,
    scale: Number.isFinite(stage?.scale) && stage.scale > 0 ? stage.scale : minZoom,
  };

  if (!isFinitePositive(vpWidth) || !isFinitePositive(vpHeight)) {
    const fallbackScale = Math.min(Math.max(proposed.scale, minZoom), maxZoom);
    return {
      stage: {
        x: Number.isFinite(proposed.x) ? proposed.x : 0,
        y: Number.isFinite(proposed.y) ? proposed.y : 0,
        scale: fallbackScale,
      },
      ranges: { x: INFINITE_RANGE, y: INFINITE_RANGE },
      effectiveMinScale: fallbackScale,
    };
  }

  const width = Math.max(tree.width, 1);
  const height = Math.max(tree.height, 1);

  const clampedScale = Math.min(Math.max(proposed.scale, minZoom), maxZoom);

  const worldPadX = width * MIN_MARGIN_RATIO;
  const worldPadY = height * MIN_MARGIN_RATIO;
  const screenPadX = MIN_MARGIN_PX / clampedScale;
  const screenPadY = MIN_MARGIN_PX / clampedScale;

  const halfViewportWorldX = vpWidth / (2 * clampedScale);
  const halfViewportWorldY = vpHeight / (2 * clampedScale);

  const extraTravelWorldX = halfViewportWorldX * EXTRA_VIEWPORT_RATIO;
  const extraTravelWorldY = halfViewportWorldY * EXTRA_VIEWPORT_RATIO;

  const marginX = Math.max(worldPadX, screenPadX, extraTravelWorldX);
  const marginY = Math.max(worldPadY, screenPadY, extraTravelWorldY);

  const minTranslateX = vpWidth / 2 - (tree.maxX + marginX) * clampedScale;
  const maxTranslateX = vpWidth / 2 - (tree.minX - marginX) * clampedScale;
  const minTranslateY = vpHeight / 2 - (tree.maxY + marginY) * clampedScale;
  const maxTranslateY = vpHeight / 2 - (tree.minY - marginY) * clampedScale;

  const clampedX = Math.min(Math.max(proposed.x, minTranslateX), maxTranslateX);
  const clampedY = Math.min(Math.max(proposed.y, minTranslateY), maxTranslateY);

  return {
    stage: {
      x: clampedX,
      y: clampedY,
      scale: clampedScale,
    },
    ranges: {
      x: [minTranslateX, maxTranslateX],
      y: [minTranslateY, maxTranslateY],
    },
    effectiveMinScale: minZoom,
  };
}

export function applyRubberBand(value, min, max, tension = 0.55, softZone = 200) {
  'worklet';
  if (value < min) {
    const overshoot = value - min;
    return min + (overshoot * tension) / (1 + Math.abs(overshoot) / softZone);
  }
  if (value > max) {
    const overshoot = value - max;
    return max + (overshoot * tension) / (1 + Math.abs(overshoot) / softZone);
  }
  return value;
}

export function createDecayModifier(viewport, bounds, currentScale, minZoom, maxZoom) {
  'worklet';

  return (value, axis) => {
    'worklet';

    const vp = sanitizeViewport(viewport);
    const tree = sanitizeBounds(bounds);
    const scale = Number.isFinite(currentScale) && currentScale > 0 ? currentScale : 1;

    // Calculate allowed translation range for current scale
    const width = Math.max(tree.width, 1);
    const height = Math.max(tree.height, 1);

    const worldPadX = width * MIN_MARGIN_RATIO;
    const worldPadY = height * MIN_MARGIN_RATIO;
    const screenPadX = MIN_MARGIN_PX / scale;
    const screenPadY = MIN_MARGIN_PX / scale;

    const halfViewportWorldX = vp.width / (2 * scale);
    const halfViewportWorldY = vp.height / (2 * scale);

    const extraTravelWorldX = halfViewportWorldX * EXTRA_VIEWPORT_RATIO;
    const extraTravelWorldY = halfViewportWorldY * EXTRA_VIEWPORT_RATIO;

    const marginX = Math.max(worldPadX, screenPadX, extraTravelWorldX);
    const marginY = Math.max(worldPadY, screenPadY, extraTravelWorldY);

    let min, max, softZone;

    if (axis === 'x') {
      min = vp.width / 2 - (tree.maxX + marginX) * scale;
      max = vp.width / 2 - (tree.minX - marginX) * scale;
      softZone = Math.max(140, (vp.width / Math.max(scale, 0.1)) * 0.25);
    } else {
      min = vp.height / 2 - (tree.maxY + marginY) * scale;
      max = vp.height / 2 - (tree.minY - marginY) * scale;
      softZone = Math.max(140, (vp.height / Math.max(scale, 0.1)) * 0.25);
    }

    // Apply rubber band with generous soft zone
    return applyRubberBand(value, min, max, 0.55, softZone);
  };
}
