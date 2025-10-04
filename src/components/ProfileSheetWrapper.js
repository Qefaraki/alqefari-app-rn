import React, { useEffect } from "react";
import ProfileSheet from "./ProfileSheet";
import ModernProfileEditorV4 from "../screens/ModernProfileEditorV4";
import ProfileViewer from "./ProfileViewer";
import { useAdminMode } from "../contexts/AdminModeContext";
import { useTreeStore } from "../stores/useTreeStore";
import { familyData } from "../data/family-data";
import { featureFlags } from "../config/featureFlags";

const ProfileSheetWrapper = ({ editMode }) => {
  const { isAdminMode } = useAdminMode();
  const selectedPersonId = useTreeStore((s) => s.selectedPersonId);
  const setSelectedPersonId = useTreeStore((s) => s.setSelectedPersonId);
  const treeData = useTreeStore((state) => state.treeData);
  const profileSheetProgress = useTreeStore((s) => s.profileSheetProgress);

  // Get person data
  const person = React.useMemo(() => {
    if (!selectedPersonId) return null;
    if (treeData && treeData.length > 0) {
      return treeData.find((p) => p.id === selectedPersonId);
    }
    return familyData.find((p) => p.id === selectedPersonId);
  }, [selectedPersonId, treeData]);

  // Critical: Reset profileSheetProgress when switching between modals
  useEffect(() => {
    // When admin mode changes or person selection changes, ensure clean state
    if (!selectedPersonId && profileSheetProgress) {
      profileSheetProgress.value = 0;
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
      profileSheetProgress.value = 0;
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

  // When in admin mode, show the modern editor
  // When not in admin mode, show the regular ProfileSheet
  if (selectedPersonId && isAdminMode && person) {
    return (
      <ModernProfileEditorV4
        visible={true}
        profile={person}
        onClose={() => {
          // CRITICAL: Force reset before closing to ensure SearchBar reappears
          if (profileSheetProgress) {
            profileSheetProgress.value = 0;
          }
          // Small delay to ensure the reset is processed
          setTimeout(() => {
            setSelectedPersonId(null);
          }, 50);
        }}
        onSave={(updatedData) => {
          // Update the node in the tree
          if (updatedData) {
            useTreeStore.getState().updateNode(person.id, updatedData);
          }
          // CRITICAL: Force reset before closing
          if (profileSheetProgress) {
            profileSheetProgress.value = 0;
          }
          setSelectedPersonId(null);
          // Optionally reopen to see changes
          setTimeout(() => setSelectedPersonId(person.id), 100);
        }}
      />
    );
  }

  // Show regular ProfileSheet when not in admin mode
  return <ProfileSheet editMode={editMode} />;
};

export default ProfileSheetWrapper;
