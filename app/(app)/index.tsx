import React, { useState, useEffect } from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useLocalSearchParams } from "expo-router";
import TreeView from "../../src/components/TreeView";
import ProfileSheetWrapper from "../../src/components/ProfileSheetWrapper";
import PendingApprovalBanner from "../../src/components/PendingApprovalBanner";
import { phoneAuthService } from "../../src/services/phoneAuth";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { useAuth } from "../../src/contexts/AuthContext";

export default function TreeScreen() {
  const { user, profile, isAdmin, isLoading } = useAuth();
  const params = useLocalSearchParams();
  const [isGuest, setIsGuest] = useState(false);
  const [linkStatus, setLinkStatus] = useState(null);
  const [linkedProfileId, setLinkedProfileId] = useState(null);

  // Debug logging
  useEffect(() => {
    console.log('[TreeScreen] Debug - User:', user);
    console.log('[TreeScreen] Debug - Profile:', profile);
    console.log('[TreeScreen] Debug - Profile.id:', profile?.id);
    console.log('[TreeScreen] Debug - linkedProfileId state:', linkedProfileId);
    console.log('[TreeScreen] Debug - isAdmin:', isAdmin);
    console.log('[TreeScreen] Debug - isLoading:', isLoading);
  }, [user, profile, linkedProfileId, isAdmin, isLoading]);

  useEffect(() => {
    console.log('[TreeScreen] User/Profile changed, checking if should fetch profile. User:', user?.id, 'Profile:', profile?.id);
    // If we have profile from auth context, use it directly
    if (profile?.id) {
      console.log('[TreeScreen] Profile from auth context found, setting linkedProfileId:', profile.id);
      setLinkedProfileId(profile.id);
      setLinkStatus("approved");
    } else if (user && !isLoading) {
      // Otherwise fetch it
      console.log('[TreeScreen] No profile from auth, but user exists, calling checkLinkStatus');
      checkLinkStatus();
    } else {
      console.log('[TreeScreen] No user or still loading, skipping checkLinkStatus. isLoading:', isLoading);
    }
  }, [user, profile, isLoading]);

  const checkLinkStatus = async () => {
    console.log('[TreeScreen] checkLinkStatus called with user:', user?.id);
    try {
      if (user) {
        setIsGuest(user?.user_metadata?.isGuest || false);
        console.log('[TreeScreen] About to call phoneAuthService.checkProfileLink');

        // Check profile linking status
        const fetchedProfile = await phoneAuthService.checkProfileLink(user);
        console.log('[TreeScreen] Fetched profile from checkProfileLink:', fetchedProfile);
        console.log('[TreeScreen] Fetched profile keys:', fetchedProfile ? Object.keys(fetchedProfile) : 'null');

        if (fetchedProfile) {
          setLinkStatus("approved");
          // Store the profile ID for navigation
          // The profile itself IS the family member record, so use its ID
          const profileId = fetchedProfile.id;
          if (profileId) {
            setLinkedProfileId(profileId);
            console.log('[TreeScreen] Set linkedProfileId:', profileId);
            console.log('[TreeScreen] Profile has id:', fetchedProfile.id);
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
