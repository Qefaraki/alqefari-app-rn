// This file automatically selects the correct platform implementation
import { Platform } from "react-native";

const NativeTabBar = Platform.select({
  ios: () => require("./NativeTabBar.ios").default,
  android: () => require("./NativeTabBar.android").default,
})();

export default NativeTabBar;
