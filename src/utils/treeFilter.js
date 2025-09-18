/**
 * Tree filtering utilities for showing focused branch views
 */

/**
 * Filter tree data to show only relevant nodes for a specific person
 * @param {Array} allNodes - All tree nodes
 * @param {string} focusPersonId - ID of person to focus on
 * @returns {Array} Filtered nodes including ancestors, descendants, siblings, uncles
 */
export function filterTreeForPerson(allNodes, focusPersonId) {
  if (!allNodes || !focusPersonId) return [];

  // Handle edge case: empty nodes array
  if (allNodes.length === 0) return [];

  const nodesById = new Map(allNodes.map((n) => [n.id, n]));
  const focusNode = nodesById.get(focusPersonId);

  // Handle edge case: focus person not found
  if (!focusNode) {
    console.warn(`Focus person ${focusPersonId} not found in tree data`);
    return [];
  }

  const filteredNodes = [];
  const nodesToInclude = new Set();
  const nodesWithHiddenChildren = new Map();
  let rootNodeId = null; // Track the highest ancestor

  // 1. Add focus person
  nodesToInclude.add(focusPersonId);

  // 2. Add ALL ancestors up to root and find the actual root
  let currentId = focusNode.father_id;
  let lastValidAncestor = focusPersonId; // Start with focus person
  const visitedAncestors = new Set(); // Prevent infinite loops

  while (
    currentId &&
    nodesById.has(currentId) &&
    !visitedAncestors.has(currentId)
  ) {
    visitedAncestors.add(currentId);
    nodesToInclude.add(currentId);
    lastValidAncestor = currentId; // This becomes the highest ancestor we found
    const ancestor = nodesById.get(currentId);
    currentId = ancestor.father_id;
  }

  // The last valid ancestor is our effective root for the filtered tree
  rootNodeId = lastValidAncestor;

  // 3. Add ALL descendants (recursive, no limit)
  const addAllDescendants = (nodeId, depth = 0) => {
    // Prevent infinite recursion with depth limit
    if (depth > 100) {
      console.warn("Max recursion depth reached while adding descendants");
      return;
    }

    const children = allNodes.filter((n) => n.father_id === nodeId);
    children.forEach((child) => {
      // Avoid circular references
      if (!nodesToInclude.has(child.id)) {
        nodesToInclude.add(child.id);
        addAllDescendants(child.id, depth + 1); // Recursive
      }
    });
  };
  addAllDescendants(focusPersonId);

  // 4. Add siblings (same father)
  if (focusNode.father_id) {
    const siblings = allNodes.filter(
      (n) => n.father_id === focusNode.father_id && n.id !== focusPersonId,
    );
    siblings.forEach((sibling) => {
      nodesToInclude.add(sibling.id);

      // Check if sibling has children (nieces/nephews) that we're hiding
      const siblingChildren = allNodes.filter(
        (n) => n.father_id === sibling.id,
      );
      if (siblingChildren.length > 0) {
        nodesWithHiddenChildren.set(sibling.id, siblingChildren.length);
      }
    });
  }

  // 5. Add uncles/aunts (parent's siblings)
  if (focusNode.father_id) {
    const father = nodesById.get(focusNode.father_id);
    if (father && father.father_id) {
      const uncles = allNodes.filter(
        (n) => n.father_id === father.father_id && n.id !== father.id,
      );
      uncles.forEach((uncle) => {
        nodesToInclude.add(uncle.id);

        // Check if uncle has children (cousins) that we're hiding
        const cousinCount = allNodes.filter(
          (n) => n.father_id === uncle.id,
        ).length;
        if (cousinCount > 0) {
          nodesWithHiddenChildren.set(uncle.id, cousinCount);
        }
      });
    }
  }

  // 6. Add spouse's parents (in-laws) if married
  if (
    focusNode.marriages &&
    Array.isArray(focusNode.marriages) &&
    focusNode.marriages.length > 0
  ) {
    focusNode.marriages.forEach((marriage) => {
      if (!marriage) return; // Skip null marriages

      const spouseId = marriage.spouse_id;
      if (spouseId && nodesById.has(spouseId)) {
        const spouse = nodesById.get(spouseId);
        if (spouse) {
          nodesToInclude.add(spouseId);

          // Add spouse's parents if they exist
          if (spouse.father_id && nodesById.has(spouse.father_id)) {
            nodesToInclude.add(spouse.father_id);
          }
          if (spouse.mother_id && nodesById.has(spouse.mother_id)) {
            nodesToInclude.add(spouse.mother_id);
          }
        }
      }
    });
  }

  // Build final filtered array with hidden children indicators
  allNodes.forEach((node) => {
    if (nodesToInclude.has(node.id)) {
      const filteredNode = { ...node };

      // Add indicator for hidden children
      if (nodesWithHiddenChildren.has(node.id)) {
        filteredNode.hiddenChildrenCount = nodesWithHiddenChildren.get(node.id);
        filteredNode.hasHiddenDescendants = true;
      }

      // Mark the highest ancestor as root for layout calculations
      if (node.id === rootNodeId) {
        filteredNode.isFilteredRoot = true;
        // Ensure this node has no father_id in the filtered context
        // to prevent layout issues
        filteredNode.father_id = null;
      }

      // Mark the focus person for highlighting
      if (node.id === focusPersonId) {
        filteredNode.isFocusPerson = true;
      }

      filteredNodes.push(filteredNode);
    }
  });

  // Edge case: If we have no nodes at all, return empty array
  if (filteredNodes.length === 0) {
    console.warn("No nodes found after filtering for person:", focusPersonId);
    return [];
  }

  // Edge case: Ensure we have at least one root node
  const hasRoot = filteredNodes.some((n) => n.isFilteredRoot || !n.father_id);
  if (!hasRoot && filteredNodes.length > 0) {
    // Make the first node a root if no root exists
    console.warn("No root found in filtered tree, marking first node as root");
    filteredNodes[0].isFilteredRoot = true;
    filteredNodes[0].father_id = null;
  }

  return filteredNodes;
}

/**
 * Find the bounds of filtered nodes to set initial viewport
 * @param {Array} nodes - Filtered nodes
 * @returns {Object} Bounds { minX, maxX, minY, maxY, centerX, centerY }
 */
export function calculateFilteredBounds(nodes) {
  if (!nodes || nodes.length === 0) {
    return { minX: 0, maxX: 100, minY: 0, maxY: 100, centerX: 50, centerY: 50 };
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  nodes.forEach((node) => {
    if (node.x !== undefined && node.y !== undefined) {
      minX = Math.min(minX, node.x);
      maxX = Math.max(maxX, node.x);
      minY = Math.min(minY, node.y);
      maxY = Math.max(maxY, node.y);
    }
  });

  return {
    minX,
    maxX,
    minY,
    maxY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Calculate initial zoom level to fit filtered tree in viewport
 * @param {Object} bounds - Tree bounds
 * @param {number} viewportWidth - Viewport width
 * @param {number} viewportHeight - Viewport height
 * @returns {number} Initial zoom level
 */
export function calculateInitialZoom(bounds, viewportWidth, viewportHeight) {
  if (!bounds || bounds.width === 0 || bounds.height === 0) {
    return 1;
  }

  const padding = 100; // Padding around tree
  const zoomX = (viewportWidth - padding * 2) / bounds.width;
  const zoomY = (viewportHeight - padding * 2) / bounds.height;

  // Use smaller zoom to fit both dimensions, clamped between 0.3 and 2
  const zoom = Math.max(0.3, Math.min(2, Math.min(zoomX, zoomY)));

  return zoom;
}
