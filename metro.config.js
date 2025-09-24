const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Fix for expo-router
config.resolver.unstable_enableSymlinks = true;

// Fix for unstable-native-tabs module resolution
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Help Metro resolve expo-router submodules
  if (moduleName === 'expo-router/unstable-native-tabs') {
    try {
      return {
        filePath: require.resolve('expo-router/unstable-native-tabs'),
        type: 'sourceFile',
      };
    } catch (e) {
      // Fallback to original resolver if our resolution fails
    }
  }

  // Use the original resolver for everything else
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: "./global.css" });
