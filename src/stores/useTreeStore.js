import { create } from "zustand";
import {
  DEFAULT_BOUNDS,
  clampStageToBounds,
} from "../utils/cameraConstraints";

// Schema version - increment when adding new fields to profiles table
// This forces cache invalidation after migrations
export const TREE_DATA_SCHEMA_VERSION = 2; // v2: Added kunya field (Migration 015)

export const useTreeStore = create((set, get) => ({
  // Camera State
  stage: {
    x: 0,
    y: 0,
    scale: 1,
  },

  // Cached tree bounds for camera constraints
  treeBounds: DEFAULT_BOUNDS,

  // Zoom limits
  minZoom: 0.15, // Doubled zoom-out range for LOD
  maxZoom: 3.0,

  // Animation state
  isAnimating: false,

  // Selection state
  selectedPersonId: null,

  // Profile sheet state for coordinating animations
  profileSheetIndex: -1,
  profileSheetProgress: null, // This will hold a Reanimated shared value
  initializeProfileSheetProgress: (sharedValue) =>
    set({ profileSheetProgress: sharedValue }),

  // Tree data from backend
  treeData: [],

  // High-performance Map for instant node lookups
  nodesMap: new Map(),

  // Cache schema version tracking
  cachedSchemaVersion: null,

  // Actions to update the state
  setStage: (newStage) => set({ stage: newStage }),

  setTreeBounds: (bounds) =>
    set({
      treeBounds: bounds || DEFAULT_BOUNDS,
    }),

  setIsAnimating: (animating) => set({ isAnimating: animating }),

  setSelectedPersonId: (personId) => set({ selectedPersonId: personId }),

  setTreeData: (data) =>
    set({
      treeData: data || [],
      nodesMap: new Map((data || []).map((node) => [node.id, node])),
      cachedSchemaVersion: TREE_DATA_SCHEMA_VERSION,
    }),

  // Clear tree data and force refetch (useful after migrations)
  clearTreeData: () =>
    set({
      treeData: [],
      nodesMap: new Map(),
      cachedSchemaVersion: null,
    }),

  // Update a single node without reloading the entire tree
  updateNode: (nodeId, updatedData) =>
    set((state) => {
      const existingNode = state.nodesMap.get(nodeId);

      // DEBUG: Log version changes
      console.log("🔄 [useTreeStore] Updating node:", {
        name: updatedData.name || existingNode?.name,
        oldVersion: existingNode?.version,
        newVersion: updatedData.version,
        versionIncremented: updatedData.version > (existingNode?.version || 0)
      });

      // Create new array with the updated node
      const newTreeData = state.treeData.map((node) =>
        node.id === nodeId ? { ...node, ...updatedData } : node,
      );

      // Update the nodesMap as well
      const newNodesMap = new Map(state.nodesMap);
      if (existingNode) {
        const mergedNode = { ...existingNode, ...updatedData };
        newNodesMap.set(nodeId, mergedNode);

        // DEBUG: Confirm version in Map
        console.log("✅ [useTreeStore] Node updated in Map with version:", mergedNode.version);
      }

      return {
        treeData: newTreeData,
        nodesMap: newNodesMap,
      };
    }),

  // Add a new node to the tree
  addNode: (newNode) =>
    set((state) => {
      const newTreeData = [...state.treeData, newNode];
      const newNodesMap = new Map(state.nodesMap);
      newNodesMap.set(newNode.id, newNode);

      return {
        treeData: newTreeData,
        nodesMap: newNodesMap,
      };
    }),

  // Remove a node from the tree
  removeNode: (nodeId) =>
    set((state) => {
      const newTreeData = state.treeData.filter((node) => node.id !== nodeId);
      const newNodesMap = new Map(state.nodesMap);
      newNodesMap.delete(nodeId);

      return {
        treeData: newTreeData,
        nodesMap: newNodesMap,
      };
    }),

  // Zoom function with pointer anchoring
  zoom: (direction, pointerPosition, viewport) => {
    const { stage, minZoom, maxZoom, treeBounds } = get();
    const scaleBy = 1.2;
    const newScale =
      direction > 0
        ? Math.min(stage.scale * scaleBy, maxZoom)
        : Math.max(stage.scale / scaleBy, minZoom);

    if (newScale === stage.scale) return; // No change needed

    // Calculate pointer position relative to stage
    const pointer = pointerPosition || {
      x: viewport.width / 2,
      y: viewport.height / 2,
    };

    // Calculate new position to keep zoom anchored to pointer
    const mousePointTo = {
      x: (pointer.x - stage.x) / stage.scale,
      y: (pointer.y - stage.y) / stage.scale,
    };

    const proposedStage = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
      scale: newScale,
    };

    const clamped = clampStageToBounds(
      proposedStage,
      viewport,
      treeBounds,
      minZoom,
      maxZoom,
    );

    set({
      stage: clamped.stage,
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
      stage: newStage,
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
    if (
      Math.abs(currentVelX) < minVelocity &&
      Math.abs(currentVelY) < minVelocity
    ) {
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
      if (
        Math.abs(currentVelX) > minVelocity ||
        Math.abs(currentVelY) > minVelocity
      ) {
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
  resetView: (viewport, treeBoundsOverride, limits) => {
    const { stage, cancelMomentum, treeBounds, minZoom, maxZoom } = get();

    const safeViewport = viewport || { width: 1, height: 1 };
    const bounds = treeBoundsOverride || treeBounds || DEFAULT_BOUNDS;
    const min = limits?.minZoom ?? minZoom;
    const max = limits?.maxZoom ?? maxZoom;

    // Cancel any ongoing momentum
    cancelMomentum();

    // Calculate target position to center the tree
    const targetX =
      safeViewport.width / 2 - (bounds.minX + bounds.maxX) / 2;
    const targetY = 80; // Top padding
    const targetScale = 1;

    const clampedTarget = clampStageToBounds(
      { x: targetX, y: targetY, scale: targetScale },
      safeViewport,
      bounds,
      min,
      max,
    );

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
        x: startX + (clampedTarget.stage.x - startX) * e,
        y: startY + (clampedTarget.stage.y - startY) * e,
        scale: startScale + (clampedTarget.stage.scale - startScale) * e,
      };

      set({ stage: next });

      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        set({
          isAnimating: false,
          stage: clampedTarget.stage,
        });
      }
    };

    requestAnimationFrame(tick);
  },

  // Smooth zoom animation for UI controls
  animatedZoom: (direction, viewport) => {
    const { stage, minZoom, maxZoom } = get();
    const scaleBy = 1.2;
    const targetScale =
      direction > 0
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

    const clampedTarget = clampStageToBounds(
      {
        x: centerX - mousePointTo.x * targetScale,
        y: centerY - mousePointTo.y * targetScale,
        scale: targetScale,
      },
      viewport,
      get().treeBounds,
      minZoom,
      maxZoom,
    );

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
        x: startX + (clampedTarget.stage.x - startX) * e,
        y: startY + (clampedTarget.stage.y - startY) * e,
        scale: startScale + (clampedTarget.stage.scale - startScale) * e,
      };

      set({ stage: next });

      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        set({
          isAnimating: false,
          stage: clampedTarget.stage,
        });
      }
    };

    requestAnimationFrame(tick);
  },
}));
