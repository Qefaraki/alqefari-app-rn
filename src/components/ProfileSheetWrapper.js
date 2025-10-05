import React, { useEffect } from "react";
import { runOnUI } from "react-native-reanimated";
import ProfileSheet from "./ProfileSheet";
import ProfileViewer from "./ProfileViewer";
import { useAdminMode } from "../contexts/AdminModeContext";
import { useTreeStore } from "../stores/useTreeStore";
import { featureFlags } from "../config/featureFlags";

const ProfileSheetWrapper = ({ editMode }) => {
  const { isAdminMode } = useAdminMode();
  const selectedPersonId = useTreeStore((s) => s.selectedPersonId);
  const setSelectedPersonId = useTreeStore((s) => s.setSelectedPersonId);
  const nodesMap = useTreeStore((s) => s.nodesMap);
  const profileSheetProgress = useTreeStore((s) => s.profileSheetProgress);

  // Get person data - O(1) lookup, reactive to version updates
  const person = React.useMemo(() => {
    if (!selectedPersonId) return null;

    // CRITICAL: Only use nodesMap (zustand store), never fallback to static familyData
    // The static familyData is from September and doesn't have version column
    // If person not in store yet, wait for TreeView to load it
    const foundPerson = nodesMap.get(selectedPersonId);

    // DEBUG: Log person version for troubleshooting
    if (foundPerson) {
      console.log('[ProfileSheetWrapper] Person loaded:', {
        name: foundPerson.name,
        version: foundPerson.version,
        source: 'nodesMap'
      });
    } else if (selectedPersonId) {
      console.log('[ProfileSheetWrapper] Person not in store yet, waiting for TreeView to load');
    }

    return foundPerson || null;
  }, [selectedPersonId, nodesMap]);

  // Critical: Reset profileSheetProgress when switching between modals
  useEffect(() => {
    // When admin mode changes or person selection changes, ensure clean state
    if (!selectedPersonId && profileSheetProgress) {
      runOnUI(() => {
        'worklet';
        profileSheetProgress.value = 0;
      })();
    }
  }, [selectedPersonId, profileSheetProgress]);

  const navigateToProfile = (targetId) => {
    if (!targetId) return;
    setSelectedPersonId(targetId);
  };

  const handleUpdate = (updatedData) => {
    if (!person?.id || !updatedData) return;
    useTreeStore.getState().updateNode(person.id, updatedData);
  };

  const handleClose = () => {
    if (profileSheetProgress) {
      runOnUI(() => {
        'worklet';
        profileSheetProgress.value = 0;
      })();
    }
    setSelectedPersonId(null);
  };

  if (featureFlags.profileViewer && person) {
    return (
      <ProfileViewer
        person={person}
        onClose={handleClose}
        onNavigateToProfile={navigateToProfile}
        onUpdate={handleUpdate}
      />
    );
  }

  // Show ProfileSheet with edit mode enabled when in admin mode
  return <ProfileSheet editMode={editMode || isAdminMode} />;
};

export default ProfileSheetWrapper;
