import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const SETTINGS_KEY = "@alqefari_settings";

const SettingsContext = createContext(null);

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within SettingsProvider");
  }
  return context;
};

export const SettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState({
    defaultCalendar: "gregorian", // 'hijri' or 'gregorian' - DEFAULT TO GREGORIAN
    dateFormat: "numeric", // 'numeric' (DD/MM/YYYY), 'words' (15 January 2024), 'mixed' (15 Jan 2024)
    dateOrder: "dmy", // 'dmy' (DD/MM/YYYY), 'mdy' (MM/DD/YYYY), 'ymd' (YYYY/MM/DD)
    yearFormat: "full", // 'full' (2024), 'short' (24)
    separator: "/", // '/', '-', '.'
    showBothCalendars: false, // Show both Hijri and Gregorian dates
    arabicNumerals: true, // Use Arabic numerals (١٢٣) for dates
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
        setSettings((prev) => ({ ...prev, ...parsed }));
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (key, value) => {
    try {
      const newSettings = { ...settings, [key]: value };
      setSettings(newSettings);
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
    } catch (error) {
      console.error("Error saving settings:", error);
    }
  };

  const toggleCalendar = () => {
    const newCalendar =
      settings.defaultCalendar === "hijri" ? "gregorian" : "hijri";
    updateSetting("defaultCalendar", newCalendar);
  };

  return (
    <SettingsContext.Provider
      value={{
        settings,
        loading,
        updateSetting,
        toggleCalendar,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};
