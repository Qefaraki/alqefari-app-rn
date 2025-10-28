/**
 * Deep Link Catch-All Route
 *
 * Purpose: Bridge Expo Router file-based routing with custom deep link handling
 *
 * Flow:
 * 1. User scans QR code: alqefari://profile/04489
 * 2. Expo Router matches URL to this route
 * 3. Extract shareCode from URL params
 * 4. Delegate to existing handleDeepLink() function
 * 5. Redirect back to main app
 *
 * Why needed:
 * - Expo Router tries to match all URLs to files
 * - Without this route, shows "Unmatched Route" error
 * - Deep link event listeners in _layout.tsx fire correctly
 * - But Expo Router's error screen appears first
 *
 * Solution:
 * - Create explicit route that Expo Router can match
 * - Reuse existing deep link logic (no duplication)
 * - Clean user experience with loading indicator
 */

import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { View, ActivityIndicator, Text } from 'react-native';
import { handleDeepLink } from '../../src/utils/deepLinking';
import tokens from '../../src/components/ui/tokens';

export default function ProfileDeepLinkScreen() {
  const { shareCode } = useLocalSearchParams();
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    // Validate that we have a share code
    if (!shareCode) {
      console.warn('[ProfileRoute] No share code provided, redirecting to main app');
      router.replace('/(app)/');
      return;
    }

    // Extract share code from route params (handle array case)
    const code = Array.isArray(shareCode) ? shareCode[0] : shareCode;

    console.log('[ProfileRoute] Processing deep link for share code:', code);

    // Delegate to existing deep link handler
    // This function handles:
    // - Profile lookup in tree or database
    // - Permission checks
    // - Profile enrichment (Progressive Loading)
    // - Navigation to ProfileViewer
    // - Analytics logging
    handleDeepLink({ type: 'share_code', value: code }, null)
      .then(() => {
        console.log('[ProfileRoute] Deep link handled successfully');
        setIsProcessing(false);

        // Redirect back to main app after a short delay
        // This allows ProfileViewer to open before route changes
        setTimeout(() => {
          router.replace('/(app)/');
        }, 500);
      })
      .catch((error) => {
        console.error('[ProfileRoute] Deep link handling failed:', error);
        setIsProcessing(false);

        // On error, still redirect back to main app
        router.replace('/(app)/');
      });
  }, [shareCode, router]);

  // Show loading indicator while processing deep link
  return (
    <View style={styles.container}>
      <ActivityIndicator
        size="large"
        color={tokens.colors.najdi.primary}
      />
      <Text style={styles.text}>
        جاري فتح الملف الشخصي...
      </Text>
    </View>
  );
}

const styles = {
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: tokens.colors.najdi.background,
  },
  text: {
    marginTop: 16,
    fontSize: 17,
    color: tokens.colors.najdi.text,
    fontFamily: 'SFArabic-Regular',
  },
};
