import "./src/utils/suppressWarnings"; // Suppress known warnings - must be first
import "./global.css"; // Import NativeWind styles
import { I18nManager, NativeModules, Platform } from "react-native";
import "react-native-gesture-handler";
import "react-native-reanimated";

// Force RTL at the earliest possible point
I18nManager.allowRTL(true);
I18nManager.forceRTL(true);

// iOS specific RTL forcing
if (Platform.OS === "ios") {
  if (NativeModules.RCTI18nUtil) {
    NativeModules.RCTI18nUtil.allowRTL(true);
    NativeModules.RCTI18nUtil.forceRTL(true);
  }
}

// Import expo-router entry point
import "expo-router/entry";
