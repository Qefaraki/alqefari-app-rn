import React, { createContext, useContext, useState, useMemo } from "react";
import { Dimensions } from "react-native";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const StarDataContext = createContext();

// Generate deterministic star field that forms the logo shape
const generateLogoStarField = () => {
  const stars = [];
  const centerX = SCREEN_WIDTH / 2;
  const centerY = SCREEN_HEIGHT * 0.35;
  const logoSize = 200; // Match logo dimensions

  // Parameters for star logo shape (8-pointed star)
  const outerRadius = logoSize * 0.45;
  const innerRadius = logoSize * 0.25;
  const points = 8;

  // Generate outline stars that form the star shape
  for (let i = 0; i < points * 2; i++) {
    const angle = (i * Math.PI) / points;
    const radius = i % 2 === 0 ? outerRadius : innerRadius;

    // Add multiple stars along each ray
    for (let j = 0.3; j <= 1; j += 0.15) {
      const r = radius * j;
      const x = centerX + Math.cos(angle) * r;
      const y = centerY + Math.sin(angle) * r;

      stars.push({
        id: `ray-${i}-${j}`,
        originX: x,
        originY: y,
        // For emblem formation
        emblemX: centerX + Math.cos(angle + Math.PI / 8) * r * 0.8,
        emblemY: centerY + Math.sin(angle + Math.PI / 8) * r * 0.8,
        size: j === 1 ? 2 : 1 + Math.random() * 0.5,
        type: "outline",
        delay: i * 20,
        brightness: 0.7 + Math.random() * 0.3,
      });
    }
  }

  // Generate fill stars inside the shape
  const rings = 5;
  for (let ring = 1; ring <= rings; ring++) {
    const ringRadius = innerRadius * 0.7 * (ring / rings);
    const starsInRing = ring * 6;

    for (let i = 0; i < starsInRing; i++) {
      const angle = (i / starsInRing) * Math.PI * 2;
      const jitter = (Math.random() - 0.5) * 10;
      const x = centerX + Math.cos(angle) * ringRadius + jitter;
      const y = centerY + Math.sin(angle) * ringRadius + jitter;

      // Calculate emblem position (more circular)
      const emblemAngle = angle + Math.PI / 4;
      const emblemRadius = ringRadius * 0.9;

      stars.push({
        id: `fill-${ring}-${i}`,
        originX: x,
        originY: y,
        emblemX: centerX + Math.cos(emblemAngle) * emblemRadius,
        emblemY: centerY + Math.sin(emblemAngle) * emblemRadius,
        size: 0.5 + Math.random() * 0.8,
        type: "fill",
        delay: ring * 50,
        brightness: 0.5 + Math.random() * 0.5,
      });
    }
  }

  // Add bright center stars
  stars.push({
    id: "center",
    originX: centerX,
    originY: centerY,
    emblemX: centerX,
    emblemY: centerY,
    size: 3,
    type: "center",
    delay: 0,
    brightness: 1,
  });

  // Add key anchor stars at points
  for (let i = 0; i < points; i++) {
    const angle = (i * Math.PI * 2) / points;
    const x = centerX + Math.cos(angle) * outerRadius;
    const y = centerY + Math.sin(angle) * outerRadius;

    stars.push({
      id: `anchor-${i}`,
      originX: x,
      originY: y,
      emblemX: centerX + Math.cos(angle) * outerRadius * 0.7,
      emblemY: centerY + Math.sin(angle) * outerRadius * 0.7,
      size: 2.5,
      type: "anchor",
      delay: i * 30,
      brightness: 1,
    });
  }

  return stars;
};

export const StarDataProvider = ({ children }) => {
  const [logoStars] = useState(() => generateLogoStarField());
  const [starsVisible, setStarsVisible] = useState(true);
  const [starPhase, setStarPhase] = useState("logo"); // 'logo', 'transition', 'emblem'

  const value = useMemo(
    () => ({
      logoStars,
      starsVisible,
      setStarsVisible,
      starPhase,
      setStarPhase,
      centerX: SCREEN_WIDTH / 2,
      centerY: SCREEN_HEIGHT * 0.35,
    }),
    [logoStars, starsVisible, starPhase],
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
