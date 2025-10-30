import React, { useMemo } from 'react';
import { Circle, Group, Image, Skia, useImage, Canvas } from '@shopify/react-native-skia';

import { TIDY_CIRCLE } from './nodeConstants';
import { getSaduGlyphSource } from './saduGlyphs';

type PlaceholderVariant = 'standard' | 'g2' | 'root';

const VARIANT_CONFIG: Record<PlaceholderVariant, typeof TIDY_CIRCLE.STANDARD> = {
  standard: TIDY_CIRCLE.STANDARD,
  g2: TIDY_CIRCLE.G2,
  root: TIDY_CIRCLE.ROOT,
};

const DEFAULT_VARIANT: PlaceholderVariant = 'standard';

export interface SaduPlaceholderProps {
  /** Optional top-left x position. */
  x?: number;
  /** Optional top-left y position. */
  y?: number;
  /** Optional center x position. */
  cx?: number;
  /** Optional center y position. */
  cy?: number;
  /** Override diameter; defaults to variant size. */
  diameter?: number;
  /** Variant used to look up ring/gap configuration. */
  variant?: PlaceholderVariant;
  /** Key used to keep siblings unique (usually father_id). */
  parentKey?: string | null;
  /** Unique identifier for fallback hashing. */
  fallbackKey?: string | null;
  /** Offset applied to glyph selection to avoid repeats amongst siblings. */
  siblingOffset?: number;
  /** Opacity to apply to the Sadu glyph overlay. */
  glyphOpacity?: number;
}

export const DEFAULT_GLYPH_OPACITY = 0.18;

export function SaduPlaceholderSkia({
  x,
  y,
  cx,
  cy,
  diameter,
  variant = DEFAULT_VARIANT,
  parentKey,
  fallbackKey,
  siblingOffset = 0,
  glyphOpacity = DEFAULT_GLYPH_OPACITY,
}: SaduPlaceholderProps): JSX.Element {
  const variantConfig = VARIANT_CONFIG[variant] ?? VARIANT_CONFIG[DEFAULT_VARIANT];
  const palette = TIDY_CIRCLE.COLORS;

  const resolvedDiameter = diameter ?? variantConfig.DIAMETER;
  const radius = resolvedDiameter / 2;

  const translateX = cx != null ? cx - radius : x ?? 0;
  const translateY = cy != null ? cy - radius : y ?? 0;

  const glyphSource = useMemo(
    () =>
      getSaduGlyphSource(
        parentKey ?? null,
        siblingOffset,
        fallbackKey ?? null,
      ),
    [parentKey, siblingOffset, fallbackKey],
  );
  const glyphImage = useImage(glyphSource);

  const { RING_WIDTH = 2, PLACEHOLDER_GAP = 2, PLACEHOLDER_INSET = 0 } = variantConfig;
  const visualRadius = Math.max(radius - PLACEHOLDER_INSET, 0);
  const ringWidth = Math.min(visualRadius, RING_WIDTH);
  const gapWidth = Math.min(visualRadius, PLACEHOLDER_GAP);
  const ringRadius = Math.max(visualRadius - ringWidth / 2, 0);
  const gapRadius = Math.max(visualRadius - ringWidth, 0);
  const innerRadius = Math.max(gapRadius - gapWidth, 0);

  const innerClipPath = useMemo(() => {
    if (innerRadius <= 0) {
      return null;
    }
    const path = Skia.Path.Make();
    path.addCircle(radius, radius, innerRadius);
    return path;
  }, [innerRadius, radius]);

  return (
    <Group transform={[{ translateX }, { translateY }]}> 
      {ringWidth > 0 && (
        <Circle
          cx={radius}
          cy={radius}
          r={ringRadius}
          style="stroke"
          strokeWidth={ringWidth}
          color={palette.OUTER_RING}
        />
      )}

      {gapRadius > 0 && gapWidth > 0 && (
        <Circle
          cx={radius}
          cy={radius}
          r={gapRadius}
          color={palette.GAP_FILL}
        />
      )}

      {innerRadius > 0 && (
        <>
          <Circle
            cx={radius}
            cy={radius}
            r={innerRadius}
            color={palette.CENTER_FILL}
          />
          {glyphImage && innerClipPath && (
            <Group clip={innerClipPath}>
              <Image
                image={glyphImage}
                x={radius - innerRadius}
                y={radius - innerRadius}
                width={innerRadius * 2}
                height={innerRadius * 2}
                fit="cover"
                opacity={glyphOpacity}
              />
            </Group>
          )}
        </>
      )}
    </Group>
  );
}


export function SaduPlaceholderCanvas({
  variant = DEFAULT_VARIANT,
  diameter,
  ...rest
}: SaduPlaceholderProps): JSX.Element {
  const config = VARIANT_CONFIG[variant];
  const resolvedDiameter = diameter ?? config.DIAMETER;
  return (
    <Canvas style={{ width: resolvedDiameter, height: resolvedDiameter }}>
      <SaduPlaceholderSkia
        {...rest}
        variant={variant}
        diameter={resolvedDiameter}
        cx={resolvedDiameter / 2}
        cy={resolvedDiameter / 2}
      />
    </Canvas>
  );
}

export { SaduPlaceholderSkia as SaduPlaceholder };
