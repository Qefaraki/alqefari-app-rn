import React, { useEffect, useState } from "react";
import { Alert } from "react-native";
import { runOnUI } from "react-native-reanimated";
import ProfileSheet from "./ProfileSheet";
import ProfileViewer from "./ProfileViewer";
import { useAdminMode } from "../contexts/AdminModeContext";
import { useTreeStore } from "../stores/useTreeStore";
import { featureFlags } from "../config/featureFlags";
import { supabase } from "../services/supabase";

const ProfileSheetWrapper = ({ editMode }) => {
  const { isAdminMode } = useAdminMode();
  const selectedPersonId = useTreeStore((s) => s.selectedPersonId);
  const setSelectedPersonId = useTreeStore((s) => s.setSelectedPersonId);
  const nodesMap = useTreeStore((s) => s.nodesMap);
  const profileSheetProgress = useTreeStore((s) => s.profileSheetProgress);

  // Local state for non-tree profiles (Munasib/spouses from outside family)
  const [munasibProfile, setMunasibProfile] = useState(null);
  const [loadingMunasib, setLoadingMunasib] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Track transitioning state to keep loading skeleton visible
  useEffect(() => {
    if (selectedPersonId) {
      setIsTransitioning(true);
    } else {
      setIsTransitioning(false);
    }
  }, [selectedPersonId]);

  // Lazy-load Munasib profiles when not found in nodesMap
  useEffect(() => {
    if (!selectedPersonId) {
      setMunasibProfile(null);
      setLoadingMunasib(false);
      return;
    }

    // If in nodesMap (Al-Qefari tree member), clear Munasib state
    if (nodesMap.has(selectedPersonId)) {
      setMunasibProfile(null);
      setLoadingMunasib(false);
      setIsTransitioning(false); // Person loaded from tree
      return;
    }

    // Not in nodesMap - might be Munasib, fetch it
    let cancelled = false;
    setLoadingMunasib(true);

    const fetchMunasibProfile = async () => {
      try {
        console.log('[ProfileSheetWrapper] Lazy-loading Munasib profile:', selectedPersonId);

        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', selectedPersonId)
          .is('deleted_at', null) // Filter soft-deleted profiles
          .single();

        if (cancelled) return;

        if (error) {
          console.error('[ProfileSheetWrapper] Failed to load Munasib:', error);
          Alert.alert('خطأ', 'فشل تحميل الملف الشخصي');
          setSelectedPersonId(null); // Close sheet
          setLoadingMunasib(false);
          return;
        }

        if (data) {
          console.log('[ProfileSheetWrapper] Loaded Munasib profile:', data.name);
          setMunasibProfile(data);
          setIsTransitioning(false); // Person loaded
        } else {
          Alert.alert('خطأ', 'الملف الشخصي غير موجود');
          setSelectedPersonId(null);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[ProfileSheetWrapper] Fetch error:', err);
          Alert.alert('خطأ', 'حدث خطأ أثناء التحميل');
          setSelectedPersonId(null);
        }
      } finally {
        if (!cancelled) {
          setLoadingMunasib(false);
        }
      }
    };

    fetchMunasibProfile();

    return () => {
      cancelled = true; // Cleanup: prevent race conditions on rapid navigation
    };
  }, [selectedPersonId, nodesMap, setSelectedPersonId]);

  // Get person data - try nodesMap first (tree members), fallback to Munasib state
  const person = React.useMemo(() => {
    if (!selectedPersonId) return null;

    // 1. Try tree store (Al-Qefari family members with HID)
    const treeNode = nodesMap.get(selectedPersonId);
    if (treeNode) {
      console.log('[ProfileSheetWrapper] Person loaded from tree:', {
        name: treeNode.name,
        version: treeNode.version,
        source: 'nodesMap'
      });
      return treeNode;
    }

    // 2. Try Munasib state (spouses from outside family, hid=NULL)
    if (munasibProfile?.id === selectedPersonId) {
      console.log('[ProfileSheetWrapper] Person loaded from Munasib state:', {
        name: munasibProfile.name,
        isMunasib: true,
        source: 'munasibProfile'
      });
      return munasibProfile;
    }

    // 3. Still loading or not found
    console.log('[ProfileSheetWrapper] Person not loaded yet');
    return null;
  }, [selectedPersonId, nodesMap, munasibProfile]);

  // Critical: Reset profileSheetProgress when switching between modals
  useEffect(() => {
    // When admin mode changes or person selection changes, ensure clean state
    if (!selectedPersonId && profileSheetProgress) {
      runOnUI(() => {
        profileSheetProgress.value = 0;
      })();
    }
  }, [selectedPersonId]);

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
        profileSheetProgress.value = 0;
      })();
    }
    setSelectedPersonId(null);
  };

  // Don't render anything when no profile is selected and not loading
  // This prevents the "no profile selected" empty state from showing on app open
  if (!selectedPersonId && !loadingMunasib) {
    return null;
  }

  // Always render ProfileViewer (with loading state if needed)
  // This provides consistent skeleton loading instead of ActivityIndicator
  if (featureFlags.profileViewer) {
    return (
      <ProfileViewer
        person={person}
        loading={(loadingMunasib && !person) || isTransitioning}
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
