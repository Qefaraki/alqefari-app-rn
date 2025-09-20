# React Native Authentication Flow Best Practices

## Production Patterns Used by Major Apps

Based on industry best practices from Instagram, WhatsApp, Facebook, and other major apps, here's a comprehensive guide to implementing authentication flows in React Native.

## 1. Authentication Flow Pattern

### The Standard Flow: Splash → Check Auth → Route Decision

```
App Launch
    ↓
Splash Screen (shows immediately)
    ↓
Check Auth State (from secure storage)
    ↓
Validate Token (if exists)
    ↓
┌─────────────┴─────────────┐
↓                           ↓
Onboarding                  Main App
(First-time users)          (Returning users)
```

## 2. Implementation Structure

### App.js - Root Authentication Handler

```javascript
import React, { useEffect, useReducer } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import * as SecureStore from "expo-secure-store";
import SplashScreen from "./screens/SplashScreen";
import OnboardingNavigator from "./navigation/OnboardingNavigator";
import MainNavigator from "./navigation/MainNavigator";

const Stack = createNativeStackNavigator();

// Authentication context
export const AuthContext = React.createContext();

// Auth reducer for state management
const authReducer = (prevState, action) => {
  switch (action.type) {
    case "RESTORE_TOKEN":
      return {
        ...prevState,
        userToken: action.token,
        isLoading: false,
      };
    case "SIGN_IN":
      return {
        ...prevState,
        isSignOut: false,
        userToken: action.token,
      };
    case "SIGN_OUT":
      return {
        ...prevState,
        isSignOut: true,
        userToken: null,
      };
    default:
      return prevState;
  }
};

export default function App() {
  const [state, dispatch] = useReducer(authReducer, {
    isLoading: true,
    isSignOut: false,
    userToken: null,
  });

  useEffect(() => {
    // Check for existing auth token
    const bootstrapAsync = async () => {
      let userToken;

      try {
        // Retrieve token from secure storage
        userToken = await SecureStore.getItemAsync("userToken");

        // Validate token with backend (optional but recommended)
        if (userToken) {
          const isValid = await validateToken(userToken);
          if (!isValid) {
            userToken = null;
            await SecureStore.deleteItemAsync("userToken");
          }
        }
      } catch (e) {
        console.log("Restoring token failed");
      }

      // After restoring token, update state
      dispatch({ type: "RESTORE_TOKEN", token: userToken });
    };

    bootstrapAsync();
  }, []);

  const authContext = React.useMemo(
    () => ({
      signIn: async (data) => {
        // Call your authentication API
        const token = await authenticateUser(data);

        // Persist token
        await SecureStore.setItemAsync("userToken", token);

        // Update state
        dispatch({ type: "SIGN_IN", token });
      },
      signOut: async () => {
        // Clear token from secure storage
        await SecureStore.deleteItemAsync("userToken");

        // Update state
        dispatch({ type: "SIGN_OUT" });
      },
      signUp: async (data) => {
        // Call your registration API
        const token = await registerUser(data);

        // Persist token
        await SecureStore.setItemAsync("userToken", token);

        // Update state
        dispatch({ type: "SIGN_IN", token });
      },
    }),
    [],
  );

  if (state.isLoading) {
    // Show splash screen while checking auth state
    return <SplashScreen />;
  }

  return (
    <AuthContext.Provider value={authContext}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {state.userToken == null ? (
            // No token found, user isn't signed in
            <Stack.Screen
              name="Onboarding"
              component={OnboardingNavigator}
              options={{
                animationTypeForReplace: state.isSignOut ? "pop" : "push",
              }}
            />
          ) : (
            // User is signed in
            <Stack.Screen name="Main" component={MainNavigator} />
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </AuthContext.Provider>
  );
}
```

### OnboardingNavigator.js - First-time User Flow

```javascript
import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import WelcomeScreen from "../screens/Onboarding/WelcomeScreen";
import SignInScreen from "../screens/Onboarding/SignInScreen";
import SignUpScreen from "../screens/Onboarding/SignUpScreen";
import ForgotPasswordScreen from "../screens/Onboarding/ForgotPasswordScreen";
import VerificationScreen from "../screens/Onboarding/VerificationScreen";

const Stack = createNativeStackNavigator();

export default function OnboardingNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="SignIn" component={SignInScreen} />
      <Stack.Screen name="SignUp" component={SignUpScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="Verification" component={VerificationScreen} />
    </Stack.Navigator>
  );
}
```

### MainNavigator.js - Authenticated User Navigation

```javascript
import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import HomeScreen from "../screens/Main/HomeScreen";
import ProfileScreen from "../screens/Main/ProfileScreen";
import SettingsScreen from "../screens/Main/SettingsScreen";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function HomeStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Home" component={HomeScreen} />
      {/* Add more home-related screens */}
    </Stack.Navigator>
  );
}

function ProfileStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
    </Stack.Navigator>
  );
}

export default function MainNavigator() {
  return (
    <Tab.Navigator>
      <Tab.Screen name="HomeTab" component={HomeStack} />
      <Tab.Screen name="ProfileTab" component={ProfileStack} />
    </Tab.Navigator>
  );
}
```

## 3. Best Practices from Production Apps

### WhatsApp/Instagram Pattern: Phone Number Verification

```javascript
// VerificationScreen.js
import React, { useState, useEffect } from "react";
import { View, Text, TextInput } from "react-native";
import { AuthContext } from "../App";

export default function VerificationScreen({ route }) {
  const { phoneNumber } = route.params;
  const [code, setCode] = useState("");
  const { signIn } = React.useContext(AuthContext);

  useEffect(() => {
    // Auto-submit when 6 digits are entered
    if (code.length === 6) {
      verifyCode();
    }
  }, [code]);

  const verifyCode = async () => {
    try {
      // Verify the code with your backend
      const response = await verifyPhoneCode(phoneNumber, code);
      if (response.success) {
        await signIn({ token: response.token });
      }
    } catch (error) {
      // Handle error
    }
  };

  return (
    <View>
      <Text>Enter the code sent to {phoneNumber}</Text>
      <TextInput
        value={code}
        onChangeText={setCode}
        keyboardType="number-pad"
        maxLength={6}
        autoFocus
      />
    </View>
  );
}
```

### Facebook Pattern: Social Login with Fallback

```javascript
// SignInScreen.js
import React from "react";
import { View, Button } from "react-native";
import * as Facebook from "expo-auth-session/providers/facebook";
import * as Google from "expo-auth-session/providers/google";

export default function SignInScreen() {
  const [requestFB, responseFB, promptAsyncFB] = Facebook.useAuthRequest({
    clientId: "YOUR_FACEBOOK_CLIENT_ID",
  });

  const [requestGoogle, responseGoogle, promptAsyncGoogle] =
    Google.useAuthRequest({
      clientId: "YOUR_GOOGLE_CLIENT_ID",
    });

  React.useEffect(() => {
    if (responseFB?.type === "success") {
      // Handle Facebook login success
      const { authentication } = responseFB;
      signInWithFacebook(authentication.accessToken);
    }
  }, [responseFB]);

  React.useEffect(() => {
    if (responseGoogle?.type === "success") {
      // Handle Google login success
      const { authentication } = responseGoogle;
      signInWithGoogle(authentication.accessToken);
    }
  }, [responseGoogle]);

  return (
    <View>
      <Button title="Continue with Facebook" onPress={() => promptAsyncFB()} />
      <Button
        title="Continue with Google"
        onPress={() => promptAsyncGoogle()}
      />
      <Button
        title="Sign in with Phone"
        onPress={() => navigation.navigate("PhoneSignIn")}
      />
    </View>
  );
}
```

## 4. Splash Screen Implementation

### Native Splash Screen with Auth Check

```javascript
// SplashScreen.js
import React, { useEffect } from "react";
import { View, Image, ActivityIndicator, StyleSheet } from "react-native";
import * as SplashScreen from "expo-splash-screen";

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function CustomSplashScreen() {
  useEffect(() => {
    // Hide the native splash screen after component mounts
    SplashScreen.hideAsync();
  }, []);

  return (
    <View style={styles.container}>
      <Image source={require("../assets/logo.png")} style={styles.logo} />
      <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  logo: {
    width: 200,
    height: 200,
    marginBottom: 50,
  },
  loader: {
    position: "absolute",
    bottom: 100,
  },
});
```

## 5. Security Best Practices

### Token Management

```javascript
// utils/tokenManager.js
import * as SecureStore from "expo-secure-store";
import jwt_decode from "jwt-decode";

class TokenManager {
  async saveToken(token) {
    await SecureStore.setItemAsync("userToken", token);
  }

  async getToken() {
    return await SecureStore.getItemAsync("userToken");
  }

  async removeToken() {
    await SecureStore.deleteItemAsync("userToken");
  }

  async isTokenValid() {
    try {
      const token = await this.getToken();
      if (!token) return false;

      // Decode JWT to check expiration
      const decoded = jwt_decode(token);
      const currentTime = Date.now() / 1000;

      // Check if token is expired
      if (decoded.exp < currentTime) {
        await this.removeToken();
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  async refreshToken() {
    try {
      const refreshToken = await SecureStore.getItemAsync("refreshToken");
      if (!refreshToken) return null;

      // Call your API to refresh the token
      const response = await fetch("YOUR_API/refresh", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refreshToken }),
      });

      const data = await response.json();
      if (data.accessToken) {
        await this.saveToken(data.accessToken);
        return data.accessToken;
      }

      return null;
    } catch (error) {
      return null;
    }
  }
}

export default new TokenManager();
```

## 6. Biometric Authentication (Touch ID/Face ID)

```javascript
// utils/biometricAuth.js
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";

export const BiometricAuth = {
  async isAvailable() {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    if (!compatible) return false;

    const enrolled = await LocalAuthentication.isEnrolledAsync();
    return enrolled;
  },

  async authenticate() {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Authenticate to continue",
      cancelLabel: "Cancel",
      fallbackLabel: "Use Passcode",
      disableDeviceFallback: false,
    });

    return result.success;
  },

  async enableBiometric(token) {
    const isAvailable = await this.isAvailable();
    if (!isAvailable) return false;

    const authenticated = await this.authenticate();
    if (authenticated) {
      await SecureStore.setItemAsync("biometricEnabled", "true");
      await SecureStore.setItemAsync("userToken", token);
      return true;
    }

    return false;
  },

  async checkBiometricLogin() {
    const biometricEnabled = await SecureStore.getItemAsync("biometricEnabled");
    if (biometricEnabled !== "true") return null;

    const authenticated = await this.authenticate();
    if (authenticated) {
      return await SecureStore.getItemAsync("userToken");
    }

    return null;
  },
};
```

## 7. Deep Linking for Authentication

### Universal Links / App Links Setup

```javascript
// App.js - Deep linking configuration
import * as Linking from "expo-linking";

const linking = {
  prefixes: [Linking.createURL("/"), "yourapp://"],
  config: {
    screens: {
      Onboarding: {
        screens: {
          SignIn: "signin",
          SignUp: "signup",
          Verification: "verify/:code",
          ResetPassword: "reset-password/:token",
        },
      },
      Main: {
        screens: {
          Home: "home",
          Profile: "profile/:id",
        },
      },
    },
  },
  // Handle authentication deep links
  async getStateFromPath(path, config) {
    // Check if this is an auth callback
    if (path.includes("auth-callback")) {
      // Extract token from URL
      const token = extractTokenFromPath(path);
      if (token) {
        // Save token and navigate to main app
        await SecureStore.setItemAsync("userToken", token);
        return {
          routes: [{ name: "Main" }],
        };
      }
    }

    // Default behavior
    return getStateFromPath(path, config);
  },
};

// In your NavigationContainer
<NavigationContainer linking={linking}>
  {/* Your navigators */}
</NavigationContainer>;
```

## 8. Error Handling and User Feedback

```javascript
// hooks/useAuth.js
import React, { useState } from "react";
import { Alert } from "react-native";

export function useAuth() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { signIn, signOut, signUp } = React.useContext(AuthContext);

  const handleSignIn = async (credentials) => {
    setLoading(true);
    setError(null);

    try {
      await signIn(credentials);
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      setError(errorMessage);

      // Show user-friendly error
      Alert.alert("Sign In Failed", errorMessage, [
        { text: "OK", style: "default" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const getErrorMessage = (error) => {
    // Map error codes to user-friendly messages
    const errorMessages = {
      "auth/invalid-email": "Please enter a valid email address.",
      "auth/user-not-found": "No account found with this email.",
      "auth/wrong-password": "Incorrect password. Please try again.",
      "auth/too-many-requests":
        "Too many failed attempts. Please try again later.",
      "auth/network-request-failed":
        "Network error. Please check your connection.",
    };

    return (
      errorMessages[error.code] ||
      "An unexpected error occurred. Please try again."
    );
  };

  return {
    loading,
    error,
    handleSignIn,
    handleSignOut: signOut,
    handleSignUp: signUp,
  };
}
```

## 9. Session Management

```javascript
// utils/sessionManager.js
import NetInfo from "@react-native-community/netinfo";
import tokenManager from "./tokenManager";

class SessionManager {
  constructor() {
    this.refreshTimer = null;
    this.networkUnsubscribe = null;
  }

  startSession() {
    // Refresh token every 15 minutes
    this.refreshTimer = setInterval(
      async () => {
        await this.refreshSession();
      },
      15 * 60 * 1000,
    );

    // Monitor network connectivity
    this.networkUnsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected) {
        this.refreshSession();
      }
    });
  }

  async refreshSession() {
    const isValid = await tokenManager.isTokenValid();
    if (!isValid) {
      const newToken = await tokenManager.refreshToken();
      if (!newToken) {
        // Session expired, force logout
        this.endSession();
        // Navigate to login screen
        navigationRef.current?.reset({
          index: 0,
          routes: [{ name: "Onboarding" }],
        });
      }
    }
  }

  endSession() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }

    if (this.networkUnsubscribe) {
      this.networkUnsubscribe();
      this.networkUnsubscribe = null;
    }

    tokenManager.removeToken();
  }
}

export default new SessionManager();
```

## 10. Testing Authentication Flows

```javascript
// __tests__/auth.test.js
import React from "react";
import { render, waitFor, fireEvent } from "@testing-library/react-native";
import App from "../App";
import * as SecureStore from "expo-secure-store";

jest.mock("expo-secure-store");

describe("Authentication Flow", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("shows onboarding for new users", async () => {
    SecureStore.getItemAsync.mockResolvedValue(null);

    const { getByText } = render(<App />);

    await waitFor(() => {
      expect(getByText("Welcome")).toBeTruthy();
    });
  });

  test("shows main app for authenticated users", async () => {
    SecureStore.getItemAsync.mockResolvedValue("valid-token");

    const { getByText } = render(<App />);

    await waitFor(() => {
      expect(getByText("Home")).toBeTruthy();
    });
  });

  test("handles sign out correctly", async () => {
    SecureStore.getItemAsync.mockResolvedValue("valid-token");

    const { getByText } = render(<App />);

    await waitFor(() => {
      expect(getByText("Home")).toBeTruthy();
    });

    // Trigger sign out
    const signOutButton = getByText("Sign Out");
    fireEvent.press(signOutButton);

    await waitFor(() => {
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("userToken");
      expect(getByText("Welcome")).toBeTruthy();
    });
  });
});
```

## Key Takeaways

1. **Never navigate manually** when using conditional rendering - React Navigation handles this automatically
2. **Always validate tokens** on app launch, not just check for existence
3. **Use secure storage** for sensitive data (tokens, user credentials)
4. **Implement proper error handling** with user-friendly messages
5. **Consider biometric authentication** for improved UX
6. **Handle deep links securely** - never pass sensitive data in URLs
7. **Implement session management** with automatic token refresh
8. **Test all auth scenarios** including edge cases

## Common Pitfalls to Avoid

- ❌ Storing tokens in AsyncStorage (not secure)
- ❌ Not validating tokens on app launch
- ❌ Manual navigation after auth state changes
- ❌ Not handling token expiration
- ❌ Exposing sensitive data in deep links
- ❌ Not implementing proper loading states
- ❌ Forgetting to clear all user data on logout
- ❌ Not handling network errors gracefully

## Production Checklist

- [ ] Secure token storage implementation
- [ ] Token validation on app launch
- [ ] Automatic token refresh mechanism
- [ ] Biometric authentication option
- [ ] Proper error handling and user feedback
- [ ] Deep linking security measures
- [ ] Session timeout handling
- [ ] Network connectivity handling
- [ ] Comprehensive testing coverage
- [ ] Analytics tracking for auth events
