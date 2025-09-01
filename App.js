import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, Text, TouchableOpacity, Alert, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import TreeView from './src/components/TreeView';
import ProfileSheet from './src/components/ProfileSheet';
import { AdminModeProvider } from './src/contexts/AdminModeContext';
import AdminModeToggle from './src/components/admin/AdminModeToggle';
import AdminDashboard from './src/screens/AdminDashboard';
import { supabase } from './src/services/supabase';
import { checkAndCreateAdminProfile } from './src/utils/checkAdminProfile';
import './global.css';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showAdminDashboard, setShowAdminDashboard] = useState(false);
  const [profileEditMode, setProfileEditMode] = useState(false);

  useEffect(() => {
    // Check if user is already logged in
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });

    // Listen for auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const handleTestLogin = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: 'admin@test.com',
        password: 'testadmin123'
      });

      if (error) {
        Alert.alert('Login Error', error.message);
      } else {
        Alert.alert('Success', 'Logged in as test admin!');
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckAdminProfile = async () => {
    const result = await checkAndCreateAdminProfile();
    if (result.success) {
      Alert.alert('Success', 'Admin profile is ready!');
    } else {
      Alert.alert('Error', result.error?.message || 'Failed to check/create admin profile');
    }
  };

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      Alert.alert('Error', error.message);
    }
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AdminModeProvider>
        <BottomSheetModalProvider>
          <View className="flex-1">
            <StatusBar style="dark" />
            
            {/* Header */}
            <View className="bg-white pt-12 pb-4 px-4 shadow-sm">
              <Text className="text-2xl font-bold text-center text-gray-900">
                شجرة عائلة القفاري
              </Text>
              
              {/* Test Auth Buttons */}
              <View className="flex-row justify-center mt-2">
                {!user ? (
                  <TouchableOpacity
                    onPress={handleTestLogin}
                    disabled={loading}
                    className="bg-blue-500 px-4 py-2 rounded-md"
                  >
                    <Text className="text-white text-sm font-medium">
                      {loading ? 'Loading...' : 'Test Admin Login'}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <View className="flex-row items-center">
                    <Text className="text-sm text-gray-600 mr-2">
                      {user.email}
                    </Text>
                    <TouchableOpacity
                      onPress={handleCheckAdminProfile}
                      className="bg-green-500 px-3 py-1 rounded-md mr-2"
                    >
                      <Text className="text-white text-sm">Check Admin</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleSignOut}
                      className="bg-red-500 px-3 py-1 rounded-md"
                    >
                      <Text className="text-white text-sm">Sign Out</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
            
            {/* Admin Mode Toggle */}
            <AdminModeToggle />
            
            {/* Admin Dashboard Button */}
            {user && (
              <View className="px-4 pb-2">
                <TouchableOpacity
                  onPress={() => setShowAdminDashboard(true)}
                  className="bg-blue-500 px-4 py-3 rounded-lg flex-row items-center justify-center"
                >
                  <Ionicons name="shield-checkmark" size={20} color="white" className="mr-2" />
                  <Text className="text-white font-semibold ml-2">لوحة التحكم</Text>
                </TouchableOpacity>
              </View>
            )}
            
            {/* Tree View */}
            <View className="flex-1">
              <TreeView setProfileEditMode={setProfileEditMode} />
            </View>

            {/* Profile Sheet */}
            <ProfileSheet editMode={profileEditMode} />
            {console.log('App.js: Passing profileEditMode to ProfileSheet:', profileEditMode)}
            
            {/* Admin Dashboard Modal */}
            <Modal
              visible={showAdminDashboard}
              animationType="slide"
              presentationStyle="fullScreen"
              onRequestClose={() => setShowAdminDashboard(false)}
            >
              <AdminDashboard
                navigation={{
                  goBack: () => setShowAdminDashboard(false),
                  navigate: (screen, params) => {
                    console.log('Navigate to:', screen, params);
                    // Handle navigation here
                  }
                }}
              />
            </Modal>
          </View>
        </BottomSheetModalProvider>
      </AdminModeProvider>
    </GestureHandlerRootView>
  );
}