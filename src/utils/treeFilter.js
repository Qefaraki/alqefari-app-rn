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

  const nodesById = new Map(allNodes.map((n) => [n.id, n]));
  const focusNode = nodesById.get(focusPersonId);
  if (!focusNode) return [];

  const filteredNodes = [];
  const nodesToInclude = new Set();
  const nodesWithHiddenChildren = new Map();

  // 1. Add focus person
  nodesToInclude.add(focusPersonId);

  // 2. Add ALL ancestors up to root
  let currentId = focusNode.father_id;
  while (currentId && nodesById.has(currentId)) {
    nodesToInclude.add(currentId);
    const ancestor = nodesById.get(currentId);
    currentId = ancestor.father_id;
  }

  // 3. Add ALL descendants (recursive, no limit)
  const addAllDescendants = (nodeId) => {
    const children = allNodes.filter((n) => n.father_id === nodeId);
    children.forEach((child) => {
      nodesToInclude.add(child.id);
      addAllDescendants(child.id); // Recursive
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
  if (focusNode.marriages && focusNode.marriages.length > 0) {
    focusNode.marriages.forEach((marriage) => {
      const spouseId = marriage.spouse_id;
      if (spouseId && nodesById.has(spouseId)) {
        const spouse = nodesById.get(spouseId);
        nodesToInclude.add(spouseId);

        // Add spouse's parents
        if (spouse.father_id) {
          nodesToInclude.add(spouse.father_id);
        }
        if (spouse.mother_id) {
          nodesToInclude.add(spouse.mother_id);
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

      filteredNodes.push(filteredNode);
    }
  });

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
