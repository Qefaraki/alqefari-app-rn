import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Modal,
  FlatList,
} from "react-native";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

// Najdi Sadu Color Palette
const colors = {
  alJassWhite: "#F9F7F3",
  camelHairBeige: "#D1BBA3",
  saduNight: "#242121",
  najdiCrimson: "#A13333",
  desertOchre: "#D58C4A",
  focus: "#957EB5",
};

// Country codes list - English numbers only
const countryCodes = [
  { code: "+966", country: "السعودية", flag: "🇸🇦", key: "SA" },
  { code: "+971", country: "الإمارات", flag: "🇦🇪", key: "AE" },
  { code: "+965", country: "الكويت", flag: "🇰🇼", key: "KW" },
  { code: "+973", country: "البحرين", flag: "🇧🇭", key: "BH" },
  { code: "+974", country: "قطر", flag: "🇶🇦", key: "QA" },
  { code: "+968", country: "عُمان", flag: "🇴🇲", key: "OM" },
  { code: "+20", country: "مصر", flag: "🇪🇬", key: "EG" },
  { code: "+962", country: "الأردن", flag: "🇯🇴", key: "JO" },
  { code: "+1", country: "أمريكا", flag: "🇺🇸", key: "US" },
  { code: "+44", country: "بريطانيا", flag: "🇬🇧", key: "GB" },
];

/**
 * PhoneInputField - Reusable phone input component
 *
 * Handles:
 * - Phone number input with Arabic to Western numeral conversion
 * - Country code selection
 * - Formatting and validation
 * - RTL support
 *
 * Usage:
 * <PhoneInputField
 *   value={phoneNumber}
 *   onChangeText={setPhoneNumber}
 *   selectedCountry={selectedCountry}
 *   onCountryChange={setSelectedCountry}
 *   disabled={false}
 *   error={errorMessage}
 * />
 */
export function PhoneInputField({
  value = "",
  onChangeText = () => {},
  selectedCountry = countryCodes[0],
  onCountryChange = () => {},
  disabled = false,
  error = "",
  maxDigits = 9, // Max 9 digits for Saudi numbers by default
  placeholder = "50 123 4567",
  containerStyle = {},
}) {
  const [showCountryPicker, setShowCountryPicker] = useState(false);

  // Convert Arabic numerals to Western numerals
  const convertArabicToWestern = (text) => {
    const arabicNumerals = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    const westernNumerals = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

    let converted = text;
    for (let i = 0; i < arabicNumerals.length; i++) {
      converted = converted.replace(new RegExp(arabicNumerals[i], 'g'), westernNumerals[i]);
    }
    return converted;
  };

  const formatPhoneDisplay = (text) => {
    // Simply return the digits without spacing for display
    // This prevents confusing cursor jumps while typing
    return text;
  };

  const handlePhoneChange = (text) => {
    // Convert Arabic numerals to Western first
    const convertedText = convertArabicToWestern(text);
    // Only allow digits
    const digitsOnly = convertedText.replace(/\D/g, "");
    onChangeText(digitsOnly.slice(0, maxDigits));
  };

  const CountryPickerModal = () => (
    <Modal
      visible={showCountryPicker}
      animationType="fade"
      transparent={true}
      onRequestClose={() => setShowCountryPicker(false)}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => setShowCountryPicker(false)}
      >
        <BlurView intensity={80} style={styles.modalBlur}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>اختر رمز الدولة</Text>
              <TouchableOpacity onPress={() => setShowCountryPicker(false)}>
                <Ionicons name="close" size={24} color={colors.alJassWhite} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={countryCodes}
              keyExtractor={(item) => item.key}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.countryItem,
                    selectedCountry.key === item.key && styles.countryItemSelected,
                  ]}
                  onPress={() => {
                    onCountryChange(item);
                    setShowCountryPicker(false);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                >
                  <View style={styles.countryInfo}>
                    <Text style={styles.countryFlag}>{item.flag}</Text>
                    <Text style={styles.countryName}>{item.country}</Text>
                  </View>
                  <Text style={styles.countryCode}>{item.code}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </BlurView>
      </TouchableOpacity>
    </Modal>
  );

  return (
    <View style={[{ width: '100%', alignSelf: 'stretch' }, containerStyle]}>
      <View style={styles.phoneInputWrapper}>
        {/* Phone Number Input */}
        <TextInput
          testID="phone-input"
          style={[
            styles.phoneInput,
            {
              textAlign: "left",
              writingDirection: "ltr",
              opacity: disabled ? 0.5 : 1,
            },
          ]}
          placeholder={placeholder}
          placeholderTextColor={`${colors.alJassWhite}40`}
          value={formatPhoneDisplay(value)}
          onChangeText={handlePhoneChange}
          keyboardType="number-pad"
          maxLength={11} // 9 digits + 2 spaces
          returnKeyType="done"
          editable={!disabled}
          selectTextOnFocus={!disabled}
        />

        {/* Country Code Selector */}
        <TouchableOpacity
          style={[
            styles.countrySelector,
            { opacity: disabled ? 0.5 : 1 },
          ]}
          onPress={() => {
            if (!disabled) {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowCountryPicker(true);
            }
          }}
          activeOpacity={0.7}
          disabled={disabled}
        >
          <Text style={styles.countryFlag}>{selectedCountry.flag}</Text>
          <Text style={styles.countryCodeText}>{selectedCountry.code}</Text>
          <Ionicons
            name="chevron-down"
            size={16}
            color={`${colors.alJassWhite}99`}
          />
        </TouchableOpacity>
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <CountryPickerModal />
    </View>
  );
}

const styles = StyleSheet.create({
  phoneInputWrapper: {
    flexDirection: "row",
    marginBottom: 24,
    gap: 12,
    width: "100%",
  },
  countrySelector: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    gap: 6,
  },
  countryFlag: {
    fontSize: 20,
  },
  countryCodeText: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "SF Arabic",
    color: colors.alJassWhite,
  },
  phoneInput: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontWeight: "500",
    fontFamily: "SF Arabic",
    color: colors.alJassWhite,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  errorText: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "SF Arabic",
    color: "#FF6B6B",
    textAlign: "center",
    marginBottom: 16,
    marginTop: -12,
    backgroundColor: "rgba(255, 107, 107, 0.1)",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    overflow: "hidden",
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
  },
  modalBlur: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "rgba(36, 33, 33, 0.95)",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 24,
    maxHeight: SCREEN_HEIGHT * 0.6,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.1)",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    fontFamily: "SF Arabic",
    color: colors.alJassWhite,
  },
  countryItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.05)",
  },
  countryItemSelected: {
    backgroundColor: `${colors.najdiCrimson}15`,
  },
  countryInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  countryName: {
    fontSize: 16,
    fontWeight: "500",
    fontFamily: "SF Arabic",
    color: colors.alJassWhite,
  },
  countryCode: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "SF Arabic",
    color: `${colors.alJassWhite}99`,
  },
});
