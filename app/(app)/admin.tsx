import React, { useEffect } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import AdminDashboard from "../../src/screens/AdminDashboardUltraOptimized";
import { useAuth } from "../../src/contexts/AuthContextSimple";
import { useRouter, useLocalSearchParams } from "expo-router";

export default function AdminScreen() {
  const { user, profile, isAdmin, isLoading } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();


  useEffect(() => {
    // Redirect non-admins
    if (!isLoading && !isAdmin) {
      router.replace("/");
    }
  }, [isAdmin, isLoading]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F9F7F3" }}>
        <ActivityIndicator size="large" color="#A13333" />
      </View>
    );
  }

  if (!isAdmin) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F9F7F3" }}>
        <Text style={{ fontSize: 18, color: "#242121" }}>غير مصرح بالوصول</Text>
      </View>
    );
  }

  const isSuperAdmin = profile?.role === 'super_admin';
  return <AdminDashboard
    user={user}
    profile={profile}
    isSuperAdmin={isSuperAdmin}
    openLinkRequests={params.openLinkRequests === 'true'}
  />;
}