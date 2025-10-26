const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Fix for expo-router
config.resolver.unstable_enableSymlinks = true;

// Add asset extensions
config.resolver.assetExts = [...(config.resolver.assetExts || []), 'png', 'jpg', 'jpeg', 'gif'];

// Add TypeScript extensions to support mixed JS/TS imports
config.resolver.sourceExts = [...(config.resolver.sourceExts || []), 'ts', 'tsx'];

// Fix for unstable-native-tabs module resolution and expo-router assets
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Fix expo-router asset paths
  if (moduleName.startsWith('expo-router/assets/')) {
    const assetName = moduleName.replace('expo-router/assets/', '');
    try {
      const assetPath = path.join(__dirname, 'node_modules/expo-router/assets', assetName);
      return {
        filePath: assetPath,
        type: 'sourceFile',
      };
    } catch (e) {
      console.warn(`Failed to resolve expo-router asset: ${moduleName}`, e);
    }
  }

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

// Clear Metro cache on start
config.resetCache = true;

module.exports = withNativeWind(config, { input: "./global.css" });
