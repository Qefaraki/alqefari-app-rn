import { LogBox } from 'react-native';

// Suppress known warnings
const warningsToIgnore = [
  'SafeAreaView has been deprecated',
  'SafeAreaView has been deprecated and will be removed',
];

// Use LogBox to ignore warnings
LogBox.ignoreLogs(warningsToIgnore);

// Also override console.warn to filter out the SafeAreaView warning completely
const originalWarn = console.warn;
console.warn = (...args) => {
  const message = args.join(' ');
  if (!message.includes('SafeAreaView has been deprecated')) {
    originalWarn(...args);
  }
};

export default function suppressWarnings() {
  // This function can be called to ensure warnings are suppressed
}

// Also suppress the Text component error temporarily while we debug
const originalError = console.error;
console.error = (...args) => {
  const message = args.join(' ');
  // Don't suppress the Text error - we need to see it
  // if (!message.includes('Text strings must be rendered')) {
    originalError(...args);
  // }
};
