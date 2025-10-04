import { useCallback, useEffect, useState } from "react";
import { Dimensions, PixelRatio } from "react-native";

import tokens from "../components/ui/tokens";

const MIN_FONT_SCALE = 0.85;
const MAX_FONT_SCALE = 1.4;

const clampScale = (scale) => {
  "worklet";
  if (scale < MIN_FONT_SCALE) return MIN_FONT_SCALE;
  if (scale > MAX_FONT_SCALE) return MAX_FONT_SCALE;
  return scale;
};

const getFallbackTypography = () => ({
  fontSize: 17,
  lineHeight: 22,
  fontWeight: "400",
});

const getDimensionsFontScale = (event) => {
  if (!event) return undefined;
  if (event.window && typeof event.window.fontScale === "number") {
    return event.window.fontScale;
  }
  if (event.screen && typeof event.screen.fontScale === "number") {
    return event.screen.fontScale;
  }
  return undefined;
};

const useDynamicTypography = () => {
  const [fontScale, setFontScale] = useState(() => PixelRatio.getFontScale());

  useEffect(() => {
    const handleChange = (event) => {
      const updatedScale = getDimensionsFontScale(event);
      if (typeof updatedScale === "number") {
        setFontScale(updatedScale);
      } else {
        setFontScale(PixelRatio.getFontScale());
      }
    };

    const subscription = Dimensions.addEventListener("change", handleChange);

    return () => {
      if (subscription && typeof subscription.remove === "function") {
        subscription.remove();
      } else {
        Dimensions.removeEventListener("change", handleChange);
      }
    };
  }, []);

  const getTypography = useCallback(
    (token, overrides = {}) => {
      const baseToken = tokens.typography?.[token] || getFallbackTypography();
      const scale = clampScale(fontScale);

      const baseFontSize = overrides.fontSize || baseToken.fontSize || 17;
      const baseLineHeight = overrides.lineHeight || baseToken.lineHeight || Math.round(baseFontSize * 1.3);

      const scaledFontSize = Math.round(baseFontSize * scale);
      const scaledLineHeight = Math.round(baseLineHeight * scale);

      return {
        ...baseToken,
        ...overrides,
        fontWeight: overrides.fontWeight || baseToken.fontWeight,
        fontSize: scaledFontSize,
        lineHeight: scaledLineHeight,
      };
    },
    [fontScale],
  );

  return getTypography;
};

export default useDynamicTypography;
