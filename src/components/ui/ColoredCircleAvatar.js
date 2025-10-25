import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Image } from "expo-image";

const desertPalette = [
  "#A13333", // Najdi Crimson
  "#D58C4A", // Desert Ochre
  "#D1BBA3", // Camel Hair Beige
  "#A13333CC", // Najdi Crimson 80%
  "#D58C4ACC", // Desert Ochre 80%
  "#D1BBA3CC", // Camel Hair Beige 80%
  "#A1333399", // Najdi Crimson 60%
  "#D58C4A99", // Desert Ochre 60%
  "#D1BBA399", // Camel Hair Beige 60%
  "#A13333", // Repeat
];

const getPaletteIndex = (index) => {
  if (typeof index === "number" && Number.isFinite(index)) {
    return Math.abs(index);
  }

  if (typeof index === "string") {
    const hash = index
      .split("")
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return hash;
  }

  return 0;
};

const ColoredCircleAvatar = ({
  name,
  photoUrl,
  size = 100,
  index = 0,
  style,
}) => {
  const initial = useMemo(() => {
    if (!name) return "؟";
    const trimmed = name.trim();
    return trimmed.length > 0 ? trimmed.charAt(0) : "؟";
  }, [name]);

  const paletteIndex = useMemo(
    () => getPaletteIndex(index) % desertPalette.length,
    [index],
  );

  const backgroundColor = desertPalette[paletteIndex];

  const borderRadius = size / 2;
  const fontSize = size < 50 ? 18 : size < 80 ? 28 : 40;

  if (photoUrl) {
    return (
      <Image
        source={{ uri: photoUrl }}
        style={[
          styles.photo,
          {
            width: size,
            height: size,
            borderRadius,
          },
          style,
        ]}
        contentFit="cover"
        cachePolicy="disk"
        transition={200}
      />
    );
  }

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius,
          backgroundColor,
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.initial,
          {
            fontSize,
          },
        ]}
        allowFontScaling
      >
        {initial}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  initial: {
    color: "#F9F7F3",
    fontWeight: "700",
  },
  photo: {
    backgroundColor: "#D1BBA3",
    shadowColor: "#000",
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
});

export default ColoredCircleAvatar;
