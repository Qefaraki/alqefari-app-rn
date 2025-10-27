import { hierarchy, tree } from "d3-hierarchy";
import { STANDARD_NODE, ROOT_NODE } from "../components/TreeView/rendering/nodeConstants";

// Helper function to get node dimensions - uses dynamic widths from data
function getNodeDimensions(node, showPhotos = true) {
  const hasPhoto = showPhotos && !!node.data.photo_url;
  const isRoot = node.depth === 0 && !node.data.father_id;

  return {
    width: node.data.nodeWidth || (
      isRoot ? ROOT_NODE.WIDTH : (hasPhoto ? STANDARD_NODE.WIDTH : STANDARD_NODE.WIDTH_TEXT_ONLY)
    ),
    height: isRoot ? ROOT_NODE.HEIGHT : (hasPhoto ? STANDARD_NODE.HEIGHT : STANDARD_NODE.HEIGHT_TEXT_ONLY),
  };
}

// Post-layout collision resolution function
function resolveCollisions(hierarchyData, showPhotos = true) {
  const minPadding = 1; // TEMP: Ultra-tight 1px gap (reduced from 10)

  // Helper function to calculate subtree bounding box
  function getSubtreeBounds(node) {
    const dims = getNodeDimensions(node, showPhotos);
    let minX = node.x - dims.width / 2;
    let maxX = node.x + dims.width / 2;

    // Recursively check all descendants
    if (node.children) {
      node.children.forEach((child) => {
        const childBounds = getSubtreeBounds(child);
        minX = Math.min(minX, childBounds.minX);
        maxX = Math.max(maxX, childBounds.maxX);
      });
    }

    return { minX, maxX };
  }

  // Helper function to shift entire subtree horizontally
  function shiftSubtree(node, deltaX) {
    node.x += deltaX;
    if (node.children) {
      node.children.forEach((child) => shiftSubtree(child, deltaX));
    }
  }

  // Post-order traversal for collision resolution
  function resolveNodeCollisions(node) {
    // First, resolve collisions for all children
    if (node.children) {
      node.children.forEach((child) => resolveNodeCollisions(child));

      // Then resolve collisions between sibling subtrees
      for (let i = 1; i < node.children.length; i++) {
        const currentChild = node.children[i];
        const previousChild = node.children[i - 1];

        // Get bounding boxes of both subtrees
        const currentBounds = getSubtreeBounds(currentChild);
        const previousBounds = getSubtreeBounds(previousChild);

        // Calculate required separation
        const previousRightEdge = previousBounds.maxX;
        const currentLeftEdge = currentBounds.minX;

        // Check for overlap
        const overlap = previousRightEdge - currentLeftEdge;

        if (overlap > -minPadding) {
          // Calculate shift needed (overlap + minimum padding)
          const shiftAmount = overlap + minPadding;

          // Shift the current subtree and all subsequent siblings
          for (let j = i; j < node.children.length; j++) {
            shiftSubtree(node.children[j], shiftAmount);
          }
        }
      }
    }
  }

  // Start collision resolution from root
  resolveNodeCollisions(hierarchyData);

  return hierarchyData;
}

export function calculateTreeLayout(familyData, showPhotos = true) {
  // Safety check for undefined or null input
  if (!familyData || !Array.isArray(familyData)) {
    console.warn("calculateTreeLayout received invalid data:", familyData);
    return { nodes: [], connections: [] };
  }

  // Convert flat array to hierarchical structure
  const dataMap = new Map();
  familyData.forEach((person) =>
    dataMap.set(person.id, { ...person, children: [] }),
  );

  let root = null;

  // Build the tree structure
  familyData.forEach((person) => {
    const personNode = dataMap.get(person.id);

    if (person.father_id) {
      const father = dataMap.get(person.father_id);
      if (father) {
        father.children.push(personNode);
      }
    } else if (person.mother_id) {
      const mother = dataMap.get(person.mother_id);
      if (mother) {
        mother.children.push(personNode);
      }
    } else {
      // This is a root node
      root = personNode;
    }
  });

  // Sort children by sibling_order for each parent
  // IMPORTANT: sibling_order is the single source of truth for birth order
  function sortChildrenByOrder(node) {
    if (node.children && node.children.length > 0) {
      // Sort by sibling_order: 0 = oldest (firstborn), 1 = second oldest, etc.
      // Tree display (RTL): Oldest appears rightmost, youngest leftmost
      // To achieve this, we reverse the order so d3 positions them right-to-left
      node.children.sort((a, b) => {
        const orderA = a.sibling_order ?? 999;
        const orderB = b.sibling_order ?? 999;
        return orderB - orderA; // Descending: 2, 1, 0 → d3 positions LEFT to RIGHT → Visual: Oldest on RIGHT
      });

      // Recursively sort grandchildren
      node.children.forEach((child) => sortChildrenByOrder(child));
    }
  }

  // Sort all children starting from root
  if (root) {
    sortChildrenByOrder(root);
  }

  if (!root) {
    console.error("No root node found in family data");
    return [];
  }

  // Create d3 hierarchy
  const hierarchyData = hierarchy(root);

  // Configure tree layout - optimized for variable width nodes
  const treeLayout = tree()
    .nodeSize([1, 110]) // TEMP: Minimal base spacing - actual spacing controlled by separation function
    .separation((a, b) => {
      // Calculate separation based on actual node widths with minimal gap
      const aHasPhoto = showPhotos && !!a.data.photo_url;
      const bHasPhoto = showPhotos && !!b.data.photo_url;
      const aIsRoot = a.depth === 0 && !a.data.father_id;
      const bIsRoot = b.depth === 0 && !b.data.father_id;

      const aWidth = a.data.nodeWidth || (
        aIsRoot ? ROOT_NODE.WIDTH : (aHasPhoto ? STANDARD_NODE.WIDTH : STANDARD_NODE.WIDTH_TEXT_ONLY)
      );
      const bWidth = b.data.nodeWidth || (
        bIsRoot ? ROOT_NODE.WIDTH : (bHasPhoto ? STANDARD_NODE.WIDTH : STANDARD_NODE.WIDTH_TEXT_ONLY)
      );

      // PHASE 3: Width-ratio based gaps (detects circular vs rectangular automatically)
      const avgWidth = (aWidth + bWidth) / 2;

      // Circular nodes (40/60/100) get MUCH tighter spacing - siblings nearly touch
      const siblingGapRatio = avgWidth < 50 ? 0.01 : 0.15;  // 1% for circular (nearly touching), 15% for rectangular
      const cousinGapRatio = avgWidth < 50 ? 0.05 : 0.70;   // 5% for circular (much tighter), 70% for rectangular

      if (a.parent === b.parent) {
        // Siblings: Node widths + ratio-based gap
        return (aWidth / 2) + (bWidth / 2) + (avgWidth * siblingGapRatio);
      } else {
        // Cousins: Node widths + ratio-based gap
        return (aWidth / 2) + (bWidth / 2) + (avgWidth * cousinGapRatio);
      }
    });

  // Calculate positions
  const treeData = treeLayout(hierarchyData);

  // Skip collision resolution - D3 separation function already creates exact gaps
  // The collision resolver was adding 15-20px of extra spacing by detecting false overlaps
  // when comparing entire subtree bounds instead of just direct sibling nodes.

  // Unified PTS Architecture: Bake all offsets into node.y (D3 coordinate system)
  // Step 1: Apply root node visual spacing (-80px) FIRST
  treeData.each((d) => {
    const isRoot = d.depth === 0 && !d.data.father_id;
    if (isRoot) {
      d.y -= 80;  // Root nodes get visual spacing at top of tree
    }
  });

  // Step 2: Apply top-alignment offsets (mutate node.y to include top-alignment)
  // Group nodes by depth (generation) and adjust Y to align top edges
  const depthGroups = new Map();
  treeData.each((d) => {
    if (!depthGroups.has(d.depth)) {
      depthGroups.set(d.depth, []);
    }
    depthGroups.get(d.depth).push(d);
  });

  // Calculate and apply top-alignment offsets (MUTATE node.y to include offset)
  // Use showPhotos (passed as effectiveShowPhotos from TreeView) to determine heights (accounts for zoom LOD)
  depthGroups.forEach((nodesAtDepth) => {
    // Find shortest node in this generation (will be the top-aligned reference)
    const minHeight = Math.min(
      ...nodesAtDepth.map(node => {
        const hasPhotoUrl = !!node.data.photo_url;
        const isRoot = node.depth === 0 && !node.data.father_id;

        // Root node uses ROOT_NODE.HEIGHT
        if (isRoot) return ROOT_NODE.HEIGHT;

        // Use showPhotos to determine if photos are shown in layout
        return (showPhotos && hasPhotoUrl) ? STANDARD_NODE.HEIGHT : STANDARD_NODE.HEIGHT_TEXT_ONLY;
      })
    );

    // MUTATE node.y to include top-alignment offset (bake into final position)
    nodesAtDepth.forEach(node => {
      const hasPhotoUrl = !!node.data.photo_url;
      const isRoot = node.depth === 0 && !node.data.father_id;

      let nodeHeight;
      if (isRoot) {
        nodeHeight = ROOT_NODE.HEIGHT;
      } else {
        // Use showPhotos to determine actual rendered height
        nodeHeight = (showPhotos && hasPhotoUrl) ? STANDARD_NODE.HEIGHT : STANDARD_NODE.HEIGHT_TEXT_ONLY;
      }

      // Calculate offset to align top edges
      const offset = (nodeHeight - minHeight) / 2;

      // BAKE offset into node.y (now it's final render position!)
      node.y += offset;

      // NOTE: DO NOT store node.topAlignOffset anymore - y includes it now
    });
  });

  // Convert to flat array with positions
  const nodes = [];
  const connections = [];

  treeData.each((d) => {
    nodes.push({
      ...d.data,
      x: d.x,
      y: d.y,  // FINAL render position (includes root offset + top-alignment)
      // NOTE: NO topAlignOffset anymore - y is the final position!
      depth: d.depth,
    });
  });

  // Group nodes by their parent to create connections
  const parentGroups = new Map();

  treeData.each((d) => {
    if (d.parent) {
      const parentId = d.parent.data.id;
      if (!parentGroups.has(parentId)) {
        parentGroups.set(parentId, {
          parent: {
            x: d.parent.x,
            y: d.parent.y,  // FINAL position (includes root offset + top-alignment)
            // NOTE: NO topAlignOffset - y is the final position!
            id: parentId,
            photo_url: d.parent.data.photo_url,  // For height calculation (75px vs 35px)
            father_id: d.parent.data.father_id,  // For root detection (100px)
          },
          children: [],
        });
      }
      parentGroups.get(parentId).children.push({
        x: d.x,
        y: d.y,  // FINAL position (includes root offset + top-alignment)
        // NOTE: NO topAlignOffset - y is the final position!
        id: d.data.id,
        photo_url: d.data.photo_url,  // For height calculation (75px vs 35px)
        father_id: d.data.father_id,  // For root detection (100px)
      });
    }
  });

  // Convert parent groups to connections
  parentGroups.forEach((group) => {
    connections.push(group);
  });

  return { nodes, connections };
}
