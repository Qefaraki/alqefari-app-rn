import React from 'react';
import { BranchTreeProvider } from '../contexts/BranchTreeProvider';
import IsolatedTreeView from './IsolatedTreeView';

/**
 * BranchTreeViewer - Thin wrapper component that combines the isolated tree architecture
 * 
 * This component serves as the clean public API for using isolated tree views in modals.
 * It automatically provides the BranchTreeProvider context and passes through all props
 * to the IsolatedTreeView.
 * 
 * Usage:
 * <BranchTreeViewer focusPersonId={profile.id} user={user} />
 * 
 * Key features:
 * - Automatic provider setup (no manual context wrapping needed)
 * - Clean API that matches SimplifiedTreeView interface
 * - Modal-optimized settings (modalView=true, proper user context)
 * - Isolated state management (no conflicts with main tree)
 */
const BranchTreeViewer = ({ focusPersonId, user, ...restProps }) => {
  return (
    <BranchTreeProvider focusPersonId={focusPersonId}>
      <IsolatedTreeView 
        user={user}
        highlightProfileId={focusPersonId}
        modalView={true}
        {...restProps}
      />
    </BranchTreeProvider>
  );
};

export default BranchTreeViewer;