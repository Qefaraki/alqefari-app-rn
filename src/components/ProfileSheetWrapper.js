import React from "react";
import ProfileSheet from "./ProfileSheet";
import ModernProfileEditorV3 from "../screens/ModernProfileEditorV3";
import { useAdminMode } from "../contexts/AdminModeContext";
import { useTreeStore } from "../stores/useTreeStore";
import { familyData } from "../data/family-data";

const ProfileSheetWrapper = ({ editMode }) => {
  const { isAdminMode } = useAdminMode();
  const selectedPersonId = useTreeStore((s) => s.selectedPersonId);
  const setSelectedPersonId = useTreeStore((s) => s.setSelectedPersonId);
  const treeData = useTreeStore((state) => state.treeData);
  
  // Get person data
  const person = React.useMemo(() => {
    if (!selectedPersonId) return null;
    if (treeData && treeData.length > 0) {
      return treeData.find((p) => p.id === selectedPersonId);
    }
    return familyData.find((p) => p.id === selectedPersonId);
  }, [selectedPersonId, treeData]);

  // When in admin mode, show the modern editor
  // When not in admin mode, show the regular ProfileSheet
  if (selectedPersonId && isAdminMode && person) {
    return (
      <ModernProfileEditorV3
        visible={true}
        profile={person}
        onClose={() => setSelectedPersonId(null)}
        onSave={(updatedData) => {
          // Update the node in the tree
          if (updatedData) {
            useTreeStore.getState().updateNode(person.id, updatedData);
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