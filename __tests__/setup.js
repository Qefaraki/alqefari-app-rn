// Test setup and global mocks
// Note: @testing-library/jest-native is deprecated, matchers are now built into @testing-library/react-native

// Mock expo modules
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    manifest: null,
    expoConfig: {
      extra: {},
    },
  },
}));

jest.mock('expo-font', () => ({
  loadAsync: jest.fn(),
  isLoaded: jest.fn(() => true),
}));

jest.mock('expo-asset', () => ({
  Asset: {
    loadAsync: jest.fn(),
    fromModule: jest.fn(() => ({ uri: 'mock-uri' })),
  },
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock Supabase
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      signInWithOtp: jest.fn(),
      verifyOtp: jest.fn(),
      signOut: jest.fn(),
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      })),
    },
    from: jest.fn((table) => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
    })),
    rpc: jest.fn(),
  })),
}));

// Mock navigation
jest.mock('@react-navigation/native', () => {
  const actualNav = jest.requireActual('@react-navigation/native');
  return {
    ...actualNav,
    useNavigation: () => ({
      navigate: jest.fn(),
      goBack: jest.fn(),
      dispatch: jest.fn(),
    }),
    useRoute: () => ({
      params: {},
    }),
    useFocusEffect: jest.fn(),
  };
});

// Mock safe area
jest.mock('react-native-safe-area-context', () => {
  const inset = { top: 0, right: 0, bottom: 0, left: 0 };
  return {
    SafeAreaProvider: ({ children }) => children,
    SafeAreaView: ({ children }) => children,
    useSafeAreaInsets: () => inset,
  };
});

// Mock vector icons
jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
  MaterialIcons: 'MaterialIcons',
  MaterialCommunityIcons: 'MaterialCommunityIcons',
  Feather: 'Feather',
}));

// Mock Reanimated
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});

// Mock Gesture Handler
jest.mock('react-native-gesture-handler', () => {
  const View = require('react-native').View;
  return {
    GestureDetector: View,
    Gesture: {
      Pan: () => ({}),
      Pinch: () => ({}),
      Tap: () => ({}),
      Simultaneous: (...args) => ({}),
    },
    GestureHandlerRootView: View,
  };
});

// Mock Skia (Phase 2 - TreeView component tests)
jest.mock('@shopify/react-native-skia', () => ({
  Canvas: 'Canvas',
  Group: 'Group',
  Rect: 'Rect',
  RoundedRect: 'RoundedRect',
  Circle: 'Circle',
  Line: 'Line',
  Path: 'Path',
  Image: 'SkiaImage',
  Text: 'SkiaText',
  Paragraph: 'Paragraph',
  Paint: 'Paint',
  ColorMatrix: 'ColorMatrix',
  Blur: 'Blur',
  Shadow: 'Shadow',
  Mask: 'Mask',
  Box: 'Box',
  BoxShadow: 'BoxShadow',
  Skia: {
    Color: jest.fn((color) => color),
    Font: jest.fn(() => ({})),
    Paint: jest.fn(() => ({})),
    Path: {
      Make: jest.fn(() => ({
        moveTo: jest.fn(),
        lineTo: jest.fn(),
        close: jest.fn(),
      })),
    },
    ParagraphBuilder: {
      Make: jest.fn(() => ({
        pushStyle: jest.fn(),
        addText: jest.fn(),
        build: jest.fn(() => ({
          layout: jest.fn(),
          getMaxWidth: jest.fn(() => 100),
          getHeight: jest.fn(() => 20),
        })),
      })),
    },
  },
  useImage: jest.fn(() => null),
  useFont: jest.fn(() => null),
  vec: jest.fn((x, y) => ({ x, y })),
  rect: jest.fn((x, y, width, height) => ({ x, y, width, height })),
  rrect: jest.fn(() => ({})),
  listFontFamilies: jest.fn(() => []),
  PaintStyle: { Fill: 0, Stroke: 1 },
  CornerPathEffect: 'CornerPathEffect',
}));

// Suppress console warnings in tests
const originalWarn = console.warn;
const originalError = console.error;

beforeAll(() => {
  console.warn = jest.fn((message) => {
    if (
      message.includes('ViewPropTypes') ||
      message.includes('deprecate') ||
      message.includes('componentWillReceiveProps')
    ) {
      return;
    }
    originalWarn(message);
  });

  console.error = jest.fn((message) => {
    if (
      message.includes('Warning:') ||
      message.includes('ReactNativeFiberHostComponent')
    ) {
      return;
    }
    originalError(message);
  });
});

afterAll(() => {
  console.warn = originalWarn;
  console.error = originalError;
});

// Global test utilities
global.mockSupabaseResponse = (data, error = null) => ({
  data,
  error,
  count: data ? data.length : 0,
  status: error ? 400 : 200,
  statusText: error ? 'Bad Request' : 'OK',
});

global.waitForAsync = (fn) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      try {
        resolve(fn());
      } catch (error) {
        reject(error);
      }
    }, 0);
  });
};