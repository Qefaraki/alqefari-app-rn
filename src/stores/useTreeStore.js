import { create } from 'zustand';

export const useTreeStore = create((set, get) => ({
  // Camera State
  stage: {
    x: 0,
    y: 0,
    scale: 1,
  },

  // Zoom limits
  minZoom: 0.3,
  maxZoom: 3.0,

  // Animation state
  isAnimating: false,
  
  // Selection state
  selectedPersonId: null,
  
  // Tree data from backend
  treeData: [],
  
  // High-performance Map for instant node lookups
  nodesMap: new Map(),

  // Actions to update the state
  setStage: (newStage) => set({ stage: newStage }),
  
  setIsAnimating: (animating) => set({ isAnimating: animating }),
  
  setSelectedPersonId: (personId) => set({ selectedPersonId: personId }),
  
  setTreeData: (data) => set({ 
    treeData: data,
    nodesMap: new Map(data.map(node => [node.id, node]))
  }),
  
  // Update a single node without reloading the entire tree
  updateNode: (nodeId, updatedData) => set((state) => {
    // Create new array with the updated node
    const newTreeData = state.treeData.map(node => 
      node.id === nodeId ? { ...node, ...updatedData } : node
    );
    
    // Update the nodesMap as well
    const newNodesMap = new Map(state.nodesMap);
    const existingNode = newNodesMap.get(nodeId);
    if (existingNode) {
      newNodesMap.set(nodeId, { ...existingNode, ...updatedData });
    }
    
    return {
      treeData: newTreeData,
      nodesMap: newNodesMap
    };
  }),
  
  // Add a new node to the tree
  addNode: (newNode) => set((state) => {
    const newTreeData = [...state.treeData, newNode];
    const newNodesMap = new Map(state.nodesMap);
    newNodesMap.set(newNode.id, newNode);
    
    return {
      treeData: newTreeData,
      nodesMap: newNodesMap
    };
  }),
  
  // Remove a node from the tree
  removeNode: (nodeId) => set((state) => {
    const newTreeData = state.treeData.filter(node => node.id !== nodeId);
    const newNodesMap = new Map(state.nodesMap);
    newNodesMap.delete(nodeId);
    
    return {
      treeData: newTreeData,
      nodesMap: newNodesMap
    };
  }),

  // Zoom function with pointer anchoring
  zoom: (direction, pointerPosition, viewport) => {
    const { stage, minZoom, maxZoom } = get();
    const scaleBy = 1.2;
    const newScale = direction > 0 
      ? Math.min(stage.scale * scaleBy, maxZoom)
      : Math.max(stage.scale / scaleBy, minZoom);

    if (newScale === stage.scale) return; // No change needed

    // Calculate pointer position relative to stage
    const pointer = pointerPosition || { x: viewport.width / 2, y: viewport.height / 2 };
    
    // Calculate new position to keep zoom anchored to pointer
    const mousePointTo = {
      x: (pointer.x - stage.x) / stage.scale,
      y: (pointer.y - stage.y) / stage.scale,
    };

    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    };

    set({
      stage: {
        x: newPos.x,
        y: newPos.y,
        scale: newScale,
      }
    });
  },

  // Pan function with momentum support
  pan: (deltaX, deltaY, withMomentum = false) => {
    const { stage } = get();
    const newStage = {
      ...stage,
      x: stage.x + deltaX,
      y: stage.y + deltaY,
    };
    
    set({
      stage: newStage
    });

    // If momentum is requested, apply inertia effect
    if (withMomentum) {
      get().applyMomentum(deltaX, deltaY);
    }
  },

  // Store momentum animation ID for cancellation
  momentumAnimationId: null,
  
  // Apply momentum/inertia effect
  applyMomentum: (velocityX, velocityY) => {
    const { stage, momentumAnimationId } = get();
    
    // Cancel any existing momentum animation
    if (momentumAnimationId) {
      cancelAnimationFrame(momentumAnimationId);
      set({ momentumAnimationId: null });
    }
    
    // Calculate initial velocity (scale it down for natural feel)
    const friction = 0.92; // Slightly more friction for smoother deceleration
    const minVelocity = 0.5;
    
    let currentVelX = velocityX * 0.25; // Reduced initial velocity for smoother motion
    let currentVelY = velocityY * 0.25;
    
    // Only apply momentum if velocity is significant
    if (Math.abs(currentVelX) < minVelocity && Math.abs(currentVelY) < minVelocity) {
      return;
    }
    
    const animate = () => {
      const { stage: currentStage } = get();
      
      // Apply friction
      currentVelX *= friction;
      currentVelY *= friction;
      
      // Update position
      const newStage = {
        ...currentStage,
        x: currentStage.x + currentVelX,
        y: currentStage.y + currentVelY,
      };
      
      set({ stage: newStage });
      
      // Continue animation if velocity is still significant
      if (Math.abs(currentVelX) > minVelocity || Math.abs(currentVelY) > minVelocity) {
        const animId = requestAnimationFrame(animate);
        set({ momentumAnimationId: animId });
      } else {
        set({ momentumAnimationId: null });
      }
    };
    
    const animId = requestAnimationFrame(animate);
    set({ momentumAnimationId: animId });
  },
  
  // Cancel momentum animation
  cancelMomentum: () => {
    const { momentumAnimationId } = get();
    if (momentumAnimationId) {
      cancelAnimationFrame(momentumAnimationId);
      set({ momentumAnimationId: null });
    }
  },

  // Smooth animated reset to initial view
  resetView: (viewport, treeBounds) => {
    const { stage, cancelMomentum } = get();
    
    // Cancel any ongoing momentum
    cancelMomentum();
    
    // Calculate target position to center the tree
    const targetX = viewport.width / 2 - (treeBounds.minX + treeBounds.maxX) / 2;
    const targetY = 80; // Top padding
    const targetScale = 1;
    
    // Set animating state
    set({ isAnimating: true });
    
    // Smooth animate with requestAnimationFrame
    const startX = stage.x;
    const startY = stage.y;
    const startScale = stage.scale;
    const durationMs = 400;
    const startTs = Date.now();

    const easeOut = (t) => 1 - Math.pow(1 - t, 2);

    const tick = () => {
      const elapsed = Date.now() - startTs;
      const t = Math.min(1, elapsed / durationMs);
      const e = easeOut(t);

      const next = {
        x: startX + (targetX - startX) * e,
        y: startY + (targetY - startY) * e,
        scale: startScale + (targetScale - startScale) * e,
      };

      set({ stage: next });

      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        set({ isAnimating: false, stage: { x: targetX, y: targetY, scale: targetScale } });
      }
    };

    requestAnimationFrame(tick);
  },

  // Smooth zoom animation for UI controls
  animatedZoom: (direction, viewport) => {
    const { stage, minZoom, maxZoom } = get();
    const scaleBy = 1.2;
    const targetScale = direction > 0 
      ? Math.min(stage.scale * scaleBy, maxZoom)
      : Math.max(stage.scale / scaleBy, minZoom);

    if (targetScale === stage.scale) return;

    // Center the zoom on viewport center
    const centerX = viewport.width / 2;
    const centerY = viewport.height / 2;
    
    const mousePointTo = {
      x: (centerX - stage.x) / stage.scale,
      y: (centerY - stage.y) / stage.scale,
    };

    const targetX = centerX - mousePointTo.x * targetScale;
    const targetY = centerY - mousePointTo.y * targetScale;
    
    set({ isAnimating: true });

    const startX = stage.x;
    const startY = stage.y;
    const startScale = stage.scale;
    const durationMs = 300;
    const startTs = Date.now();
    const easeOut = (t) => 1 - Math.pow(1 - t, 2);

    const tick = () => {
      const elapsed = Date.now() - startTs;
      const t = Math.min(1, elapsed / durationMs);
      const e = easeOut(t);

      const next = {
        x: startX + (targetX - startX) * e,
        y: startY + (targetY - startY) * e,
        scale: startScale + (targetScale - startScale) * e,
      };

      set({ stage: next });

      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        set({ isAnimating: false, stage: { x: targetX, y: targetY, scale: targetScale } });
      }
    };

    requestAnimationFrame(tick);
  },
}));