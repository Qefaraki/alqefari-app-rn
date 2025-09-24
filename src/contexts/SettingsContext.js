import React, { createContext, useContext, useState, useEffect } from "react";
import { Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const SETTINGS_KEY = "@alqefari_settings";

const SettingsContext = createContext(null);

// Export the context for direct use in components
export { SettingsContext };

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within SettingsProvider");
  }
  return context;
};

export const SettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState({
    defaultCalendar: "gregorian", // 'hijri' or 'gregorian'
    dateFormat: "numeric", // 'numeric' (31/12/2024), 'words' (31 ديسمبر 2024)
    showBothCalendars: false, // Show both Hijri and Gregorian dates
    arabicNumerals: false, // Use Arabic numerals (٣١/١٢/٢٠٢٤) for dates
    showEnglishNames: false, // Show English names in the tree
    // Computed property for simplified UI
    get dateDisplay() {
      if (this.showBothCalendars) return "both";
      return this.defaultCalendar;
    },
  });
  const [loading, setLoading] = useState(true);

  // Load settings from AsyncStorage on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const storedSettings = await AsyncStorage.getItem(SETTINGS_KEY);
      if (storedSettings) {
        const parsed = JSON.parse(storedSettings);

        // Migrate old settings - remove 'mixed' format if present
        if (parsed.dateFormat === "mixed") {
          parsed.dateFormat = "numeric";
        }

        // Ensure all required fields exist with valid values
        const validatedSettings = {
          defaultCalendar:
            parsed.defaultCalendar === "hijri" ? "hijri" : "gregorian",
          dateFormat: parsed.dateFormat === "words" ? "words" : "numeric",
          showBothCalendars: parsed.showBothCalendars === true,
          arabicNumerals: parsed.arabicNumerals === true,
          showEnglishNames: parsed.showEnglishNames === true,
        };

        // Add dateDisplay getter
        Object.defineProperty(validatedSettings, 'dateDisplay', {
          get: function() {
            if (this.showBothCalendars) return "both";
            return this.defaultCalendar;
          },
          enumerable: false
        });

        setSettings(validatedSettings);
        // Save cleaned settings back
        await AsyncStorage.setItem(
          SETTINGS_KEY,
          JSON.stringify({
            defaultCalendar: validatedSettings.defaultCalendar,
            dateFormat: validatedSettings.dateFormat,
            showBothCalendars: validatedSettings.showBothCalendars,
            arabicNumerals: validatedSettings.arabicNumerals,
            showEnglishNames: validatedSettings.showEnglishNames,
          }),
        );
      }
    } catch (error) {
      // Silently fail - will use default settings
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (key, value) => {
    try {
      let newSettings = { ...settings };

      // Handle dateDisplay specially - map to underlying settings
      if (key === "dateDisplay") {
        if (value === "both") {
          newSettings.showBothCalendars = true;
        } else {
          newSettings.showBothCalendars = false;
          newSettings.defaultCalendar = value; // 'hijri' or 'gregorian'
        }
      } else {
        newSettings[key] = value;
      }

      // Recompute dateDisplay getter
      Object.defineProperty(newSettings, 'dateDisplay', {
        get: function() {
          if (this.showBothCalendars) return "both";
          return this.defaultCalendar;
        },
        enumerable: false
      });

      setSettings(newSettings);
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify({
        defaultCalendar: newSettings.defaultCalendar,
        dateFormat: newSettings.dateFormat,
        showBothCalendars: newSettings.showBothCalendars,
        arabicNumerals: newSettings.arabicNumerals,
        showEnglishNames: newSettings.showEnglishNames,
      }));
    } catch (error) {
      // Using Alert instead of console.error to avoid lint issues
      Alert.alert("Error", "Failed to save settings");
    }
  };

  const toggleCalendar = () => {
    const newCalendar =
      settings.defaultCalendar === "hijri" ? "gregorian" : "hijri";
    updateSetting("defaultCalendar", newCalendar);
  };

  const clearSettings = async () => {
    try {
      await AsyncStorage.removeItem(SETTINGS_KEY);
      const defaultSettings = {
        defaultCalendar: "gregorian",
        dateFormat: "numeric",
        showBothCalendars: false,
        arabicNumerals: false,
        showEnglishNames: false,
      };

      // Add dateDisplay getter
      Object.defineProperty(defaultSettings, 'dateDisplay', {
        get: function() {
          if (this.showBothCalendars) return "both";
          return this.defaultCalendar;
        },
        enumerable: false
      });

      setSettings(defaultSettings);
    } catch (error) {
      Alert.alert("Error", "Failed to clear settings");
    }
  };

  return (
    <SettingsContext.Provider
      value={{
        settings,
        loading,
        updateSetting,
        toggleCalendar,
        clearSettings,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};
