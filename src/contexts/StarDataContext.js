import React, { createContext, useContext, useState, useMemo } from "react";
import { Dimensions } from "react-native";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const StarDataContext = createContext();

// Generate star field for masking inside logo shape
const generateLogoStarField = () => {
  const stars = [];
  const centerX = SCREEN_WIDTH / 2;
  const centerY = SCREEN_HEIGHT * 0.35;

  // Dense grid for logo masking
  const logoWidth = 400;
  const logoHeight = 400;
  const density = 6;

  for (let x = -logoWidth / 2; x <= logoWidth / 2; x += density) {
    for (let y = -logoHeight / 2; y <= logoHeight / 2; y += density) {
      if (Math.random() > 0.7) continue;

      const jitterX = (Math.random() - 0.5) * density * 0.7;
      const jitterY = (Math.random() - 0.5) * density * 0.7;

      let size;
      const rand = Math.random();
      if (rand < 0.1) {
        size = 1.5;
      } else if (rand < 0.3) {
        size = 1.0;
      } else {
        size = 0.6;
      }

      stars.push({
        id: `star-${x}-${y}`,
        x: centerX + x + jitterX,
        y: centerY + y + jitterY,
        size: size,
        brightness: 0.6 + Math.random() * 0.4,
        delay: Math.random() * 100,
      });
    }
  }

  return stars;
};

// Generate emission stars that will fly outward
const generateEmissionStars = () => {
  const stars = [];
  const centerX = SCREEN_WIDTH / 2;
  const centerY = SCREEN_HEIGHT * 0.35;
  const numStars = 60;

  // Create ring of stars around logo area
  for (let i = 0; i < numStars; i++) {
    const angle = (i / numStars) * Math.PI * 2;
    const radiusVariation = 80 + Math.random() * 40; // 80-120px from center

    stars.push({
      id: `emission-${i}`,
      startX: centerX + Math.cos(angle) * radiusVariation,
      startY: centerY + Math.sin(angle) * radiusVariation,
      angle: angle,
      speed: 1 + Math.random() * 0.5,
      size: 0.5 + Math.random() * 2,
      brightness: 0.7 + Math.random() * 0.3,
    });
  }

  return stars;
};

export const StarDataProvider = ({ children }) => {
  const [logoStars] = useState(() => generateLogoStarField());
  const [emissionStars] = useState(() => generateEmissionStars());

  const value = useMemo(
    () => ({
      logoStars,
      emissionStars,
      centerX: SCREEN_WIDTH / 2,
      centerY: SCREEN_HEIGHT * 0.35,
    }),
    [logoStars, emissionStars],
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
