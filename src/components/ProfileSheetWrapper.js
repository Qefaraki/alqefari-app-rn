import React from "react";
import ProfileSheet from "./ProfileSheet";
import ModernProfileEditorV4 from "../screens/ModernProfileEditorV4";
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

  // ALWAYS use ProfileSheet for consistent behavior
  // Just pass editMode to control if it's editable or not
  return <ProfileSheet editMode={editMode || isAdminMode} />;
};

export default ProfileSheetWrapper;
