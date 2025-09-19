import React, { createContext, useContext, useState, useMemo } from "react";
import { Dimensions } from "react-native";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const StarDataContext = createContext();

// Generate deterministic star field for masking (grid pattern like original OnboardingScreen)
const generateLogoStarField = () => {
  const stars = [];
  const centerX = SCREEN_WIDTH / 2;
  const centerY = SCREEN_HEIGHT * 0.35;

  // Create dense grid matching original createMaskedStarfield pattern
  const logoWidth = 400;
  const logoHeight = 400;
  const density = 6; // Closer star spacing for better definition

  // Generate grid of stars that will be masked by logo shape
  for (let x = -logoWidth / 2; x <= logoWidth / 2; x += density) {
    for (let y = -logoHeight / 2; y <= logoHeight / 2; y += density) {
      // Keep 70% of stars for proper density
      if (Math.random() > 0.7) continue;

      // Small jitter to avoid grid appearance
      const jitterX = (Math.random() - 0.5) * density * 0.7;
      const jitterY = (Math.random() - 0.5) * density * 0.7;

      // Varied star sizes for depth
      let size;
      const rand = Math.random();
      if (rand < 0.1) {
        size = 1.5; // Few bright stars
      } else if (rand < 0.3) {
        size = 1.0; // Some medium stars
      } else {
        size = 0.6; // Mostly tiny stars (points)
      }

      const starX = centerX + x + jitterX;
      const starY = centerY + y + jitterY;

      // Calculate emblem destination (circular/emblem pattern)
      const angle = Math.atan2(y, x);
      const distance = Math.sqrt(x * x + y * y);
      const emblemRadius = Math.min(distance * 0.6, 90);
      const emblemAngle = angle + Math.PI / 8; // Slight rotation for emblem

      stars.push({
        id: `star-${x}-${y}`,
        originX: starX,
        originY: starY,
        emblemX: centerX + Math.cos(emblemAngle) * emblemRadius,
        emblemY: centerY + Math.sin(emblemAngle) * emblemRadius,
        size: size,
        brightness: 0.6 + Math.random() * 0.4,
        delay: Math.random() * 100,
        type: "logo",
      });
    }
  }

  return stars;
};

export const StarDataProvider = ({ children }) => {
  const [logoStars] = useState(() => generateLogoStarField());
  const [renderLocation, setRenderLocation] = useState("onboarding"); // 'onboarding' | 'transition' | 'none'
  const [starPhase, setStarPhase] = useState("logo"); // 'logo', 'breaking', 'swirling', 'forming', 'emblem'

  const value = useMemo(
    () => ({
      logoStars,
      renderLocation,
      setRenderLocation,
      starPhase,
      setStarPhase,
      centerX: SCREEN_WIDTH / 2,
      centerY: SCREEN_HEIGHT * 0.35,
    }),
    [logoStars, renderLocation, starPhase],
  );

  return (
    <StarDataContext.Provider value={value}>
      {children}
    </StarDataContext.Provider>
  );
};

export const useStarData = () => {
  const context = useContext(StarDataContext);
  if (!context) {
    throw new Error("useStarData must be used within StarDataProvider");
  }
  return context;
};
