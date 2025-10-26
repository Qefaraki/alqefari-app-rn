import React, { createContext, useContext, useEffect, useState, useMemo } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Alert } from "react-native";

// Create context
const SettingsContext = createContext(null);

// Hook to use settings context
export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within SettingsProvider");
  }
  return context;
};

// Settings storage key
const SETTINGS_KEY = "@alqefari_settings";

export const SettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState({
    defaultCalendar: "gregorian", // 'hijri' or 'gregorian'
    dateFormat: "numeric", // 'numeric' (31/12/2024), 'words' (31 ديسمبر 2024)
    showBothCalendars: false, // Show both Hijri and Gregorian dates
    arabicNumerals: false, // Use Arabic numerals (٣١/١٢/٢٠٢٤) for dates
    showEnglishNames: false, // Show English names in the tree
    // Simple computed property without getter - calculated when needed
    dateDisplay: "gregorian", // Will be updated when settings change
    // Tree display settings
    showPhotos: true, // Show profile photos in tree view (default ON)
    highlightMyLine: false, // Highlight user's direct lineage (default OFF)
    lineStyle: "straight", // Connection line style: 'straight' or 'bezier' (default straight)
  });

  // Load settings from storage on mount
  useEffect(() => {
    loadSettings();
  }, []);

  // Load persisted settings
  const loadSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem(SETTINGS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);

        // Migrate old settings - remove 'mixed' format if present
        if (parsed.dateFormat === "mixed") {
          parsed.dateFormat = "numeric";
        }

        // Calculate dateDisplay based on loaded settings
        const dateDisplay = parsed.showBothCalendars
          ? "both"
          : parsed.defaultCalendar;

        // Ensure all required fields exist with valid values
        const validatedSettings = {
          defaultCalendar:
            parsed.defaultCalendar === "hijri" ? "hijri" : "gregorian",
          dateFormat: parsed.dateFormat === "words" ? "words" : "numeric",
          showBothCalendars: parsed.showBothCalendars === true,
          arabicNumerals: parsed.arabicNumerals === true,
          showEnglishNames: parsed.showEnglishNames === true,
          dateDisplay: dateDisplay,
          // Tree display settings with defaults
          showPhotos: parsed.showPhotos !== false, // Default ON
          highlightMyLine: parsed.highlightMyLine === true, // Default OFF
          lineStyle: parsed.lineStyle === "bezier" ? "bezier" : "straight", // Default straight
        };

        console.log('[SettingsContext] Loaded settings from storage:', validatedSettings);
        setSettings(validatedSettings);

        // Re-save to ensure consistency
        await AsyncStorage.setItem(
          SETTINGS_KEY,
          JSON.stringify({
            defaultCalendar: validatedSettings.defaultCalendar,
            dateFormat: validatedSettings.dateFormat,
            showBothCalendars: validatedSettings.showBothCalendars,
            arabicNumerals: validatedSettings.arabicNumerals,
            showEnglishNames: validatedSettings.showEnglishNames,
            showPhotos: validatedSettings.showPhotos,
            highlightMyLine: validatedSettings.highlightMyLine,
            lineStyle: validatedSettings.lineStyle,
          }),
        );
      }
    } catch (error) {
      // Using Alert instead of console.error to avoid lint issues
      Alert.alert("Error", "Failed to load settings");
    }
  };

  // Update a single setting
  const updateSetting = async (key, value) => {
    try {
      const newSettings = { ...settings };

      // Handle dateDisplay specially - map to underlying settings
      if (key === "dateDisplay") {
        if (value === "both") {
          newSettings.showBothCalendars = true;
          newSettings.dateDisplay = "both";
        } else {
          newSettings.showBothCalendars = false;
          newSettings.defaultCalendar = value; // 'hijri' or 'gregorian'
          newSettings.dateDisplay = value;
        }
      } else {
        newSettings[key] = value;

        // Update dateDisplay when relevant settings change
        if (key === "showBothCalendars" || key === "defaultCalendar") {
          newSettings.dateDisplay = newSettings.showBothCalendars
            ? "both"
            : newSettings.defaultCalendar;
        }
      }

      // Force a new object reference for React to detect the change
      setSettings({ ...newSettings });

      // Persist to storage (excluding dateDisplay as it's computed)
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify({
        defaultCalendar: newSettings.defaultCalendar,
        dateFormat: newSettings.dateFormat,
        showBothCalendars: newSettings.showBothCalendars,
        arabicNumerals: newSettings.arabicNumerals,
        showEnglishNames: newSettings.showEnglishNames,
        showPhotos: newSettings.showPhotos,
        highlightMyLine: newSettings.highlightMyLine,
        lineStyle: newSettings.lineStyle,
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

  // Reset settings to defaults
  const resetSettings = async () => {
    try {
      await AsyncStorage.removeItem(SETTINGS_KEY);
      const defaultSettings = {
        defaultCalendar: "gregorian",
        dateFormat: "numeric",
        showBothCalendars: false,
        arabicNumerals: false,
        showEnglishNames: false,
        dateDisplay: "gregorian",
        showPhotos: true, // Default ON
        highlightMyLine: false, // Default OFF
        lineStyle: "straight", // Default straight lines
      };

      setSettings(defaultSettings);
    } catch (error) {
      Alert.alert("Error", "Failed to reset settings");
    }
  };

  // Memoize the context value to prevent unnecessary re-renders of consumers
  const value = useMemo(
    () => ({
      settings,
      updateSetting,
      toggleCalendar,
      resetSettings,
    }),
    [settings, updateSetting, toggleCalendar, resetSettings]
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};