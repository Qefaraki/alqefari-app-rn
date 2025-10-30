import "./src/utils/suppressWarnings"; // Suppress known warnings - must be first
import "./global.css"; // Import NativeWind styles
import { I18nManager, NativeModules, Platform } from "react-native";
import ErrorUtils from "react-native/Libraries/Core/ErrorUtils";
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

const defaultHandler = ErrorUtils.getGlobalHandler && ErrorUtils.getGlobalHandler();
ErrorUtils.setGlobalHandler((error, isFatal) => {
  try {
    console.error("[GLOBAL_ERROR]", error?.message, error?.stack);
  } catch (loggingError) {
    // ignore logging failure
  }
  if (typeof defaultHandler === "function") {
    defaultHandler(error, isFatal);
  }
});

// Import expo-router entry point
import "expo-router/entry";
