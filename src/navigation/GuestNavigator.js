import React from "react";
import { createStackNavigator } from "@react-navigation/stack";
import GuestExploreScreen from "../screens/guest/GuestExploreScreen";
import TreeView from "../components/TreeView";

const Stack = createStackNavigator();

export default function GuestNavigator({ onExitGuestMode }) {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="GuestExplore">
        {(props) => (
          <GuestExploreScreen {...props} onExitGuestMode={onExitGuestMode} />
        )}
      </Stack.Screen>

      <Stack.Screen name="TreeView">
        {(props) => (
          <TreeView
            {...props}
            isGuest={true}
            user={null}
            onSettingsOpen={() => {}}
            onNetworkStatusChange={() => {}}
            setProfileEditMode={() => {}}
            onAdminDashboard={() => {}}
          />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
