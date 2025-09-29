import React, { useState, useEffect } from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useLocalSearchParams } from "expo-router";
import TreeView from "../../src/components/TreeView";
import ProfileSheetWrapper from "../../src/components/ProfileSheetWrapper";
import PendingApprovalBanner from "../../src/components/PendingApprovalBanner";
import { phoneAuthService } from "../../src/services/phoneAuth";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { useAuth } from "../../src/contexts/AuthContextSimple";

export default function TreeScreen() {
  const { user, profile, isAdmin, isLoading } = useAuth();
  const params = useLocalSearchParams();
  const [isGuest, setIsGuest] = useState(false);
  const [linkStatus, setLinkStatus] = useState(null);
  const [linkedProfileId, setLinkedProfileId] = useState(null);

  useEffect(() => {
    // If we have profile from auth context, use it directly
    if (profile?.id) {
      setLinkedProfileId(profile.id);
      setLinkStatus("approved");
    } else if (user && !isLoading) {
      // Otherwise fetch it
      checkLinkStatus();
    }
  }, [user, profile, isLoading]);

  const checkLinkStatus = async () => {
    try {
      if (user) {
        setIsGuest(user?.user_metadata?.isGuest || false);

        // Check profile linking status
        const fetchedProfile = await phoneAuthService.checkProfileLink(user);

        if (fetchedProfile) {
          setLinkStatus("approved");
          // Store the profile ID for navigation
          // The profile itself IS the family member record, so use its ID
          const profileId = fetchedProfile.id;
          if (profileId) {
            setLinkedProfileId(profileId);
          }
        } else {
          // Check for pending requests
          const result = await phoneAuthService.getUserLinkRequests();
          if (result.success && result.requests?.length > 0) {
            const latestRequest = result.requests.sort(
              (a: any, b: any) =>
                new Date(b.created_at).getTime() -
                new Date(a.created_at).getTime(),
            )[0];
            setLinkStatus(latestRequest.status);
          }
        }
      }
    } catch (error) {
      console.error("Error checking link status:", error);
    }
  };

  // Show loading state while auth is initializing
  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#F9F7F3", justifyContent: "center", alignItems: "center" }}>
        {/* You can add a loading indicator here if needed */}
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <BottomSheetModalProvider>
        <View style={{ flex: 1 }}>
          {user && (linkStatus === "pending" || linkStatus === "rejected") && (
            <PendingApprovalBanner
              user={user}
              onStatusChange={setLinkStatus}
              onRefresh={checkLinkStatus}
            />
          )}
          <TreeView
            key={linkedProfileId || 'no-profile'} // Force re-render when profile loads
            user={user}
            profile={profile}
            linkedProfileId={linkedProfileId}
            isAdmin={isAdmin}
            highlightProfileId={params.highlightProfileId as string}
            focusOnProfile={params.focusOnProfile === 'true'}
            onAdminDashboard={() => {}}
            onSettingsOpen={() => {}}
            setProfileEditMode={() => {}}
            onNetworkStatusChange={() => {}}
          />
          <ProfileSheetWrapper editMode={false} />
        </View>
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}
