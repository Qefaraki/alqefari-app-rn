import type { ImageSource } from "react-native";

type GlyphLoader = () => ImageSource;

function safeRequire(loader: GlyphLoader, label: string): ImageSource | null {
  try {
    return loader();
  } catch (error) {
    if (__DEV__) {
      console.warn(`[saduGlyphs] Missing glyph asset: ${label}`);
    }
    return null;
  }
}

const candidateGlyphs: Array<[string, GlyphLoader]> = [
  ["71.png", () => require("../../../../assets/sadu_patterns/icons_barez/71.png")],
  ["75.png", () => require("../../../../assets/sadu_patterns/icons_barez/75.png")],
  ["77.png", () => require("../../../../assets/sadu_patterns/icons_barez/77.png")],
  ["81.png", () => require("../../../../assets/sadu_patterns/icons_barez/81.png")],
  ["85.png", () => require("../../../../assets/sadu_patterns/icons_barez/85.png")],
  ["91.png", () => require("../../../../assets/sadu_patterns/icons_barez/91.png")],
  ["93.png", () => require("../../../../assets/sadu_patterns/icons_barez/93.png")],
  ["95.png", () => require("../../../../assets/sadu_patterns/icons_barez/95.png")],
  ["97.png", () => require("../../../../assets/sadu_patterns/icons_barez/97.png")],
  ["100.png", () => require("../../../../assets/sadu_patterns/icons_barez/100.png")],
];

const glyphSources = candidateGlyphs
  .map(([name, loader]) => safeRequire(loader, name))
  .filter((source): source is ImageSource => source != null);

const resolvedFallback: ImageSource = glyphSources[0] || candidateGlyphs[0][1]();

const orderedGlyphs = glyphSources.length > 0 ? glyphSources : [resolvedFallback];

export const SADU_GLYPH_COUNT = orderedGlyphs.length;

export function getSaduGlyphSource(
  primaryKey: string | null | undefined,
  offset: number = 0,
  fallbackKey: string | null | undefined = null,
): ImageSource {
  const key = primaryKey || fallbackKey || "fallback";
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }

  const baseIndex = hash % orderedGlyphs.length;
  const index = (baseIndex + offset) % orderedGlyphs.length;
  return orderedGlyphs[index >= 0 ? index : index + orderedGlyphs.length];
}
