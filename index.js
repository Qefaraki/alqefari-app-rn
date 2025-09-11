import { I18nManager, NativeModules, Platform } from "react-native";
import "react-native-gesture-handler";
import "react-native-reanimated";
import { registerRootComponent } from "expo";

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

import App from "./App";

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
