import { hierarchy, tree } from "d3-hierarchy";

// Helper function to get node dimensions - uses dynamic widths from data
function getNodeDimensions(node) {
  const hasPhoto = !!node.data.photo_url;
  return {
    width: node.data.nodeWidth || (hasPhoto ? 85 : 60),
    height: hasPhoto ? 105 : 35,
  };
}

// Post-layout collision resolution function
function resolveCollisions(hierarchyData) {
  const minPadding = 10; // Minimal padding for dynamic widths

  // Helper function to calculate subtree bounding box
  function getSubtreeBounds(node) {
    const dims = getNodeDimensions(node);
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

export function calculateTreeLayout(familyData) {
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
      // List display: Oldest at top, youngest at bottom
      node.children.sort((a, b) => {
        const orderA = a.sibling_order ?? 999;
        const orderB = b.sibling_order ?? 999;
        return orderA - orderB; // Ascending order: 0, 1, 2, 3...
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
    .nodeSize([80, 110]) // Base spacing for dynamic widths
    .separation((a, b) => {
      // Calculate separation based on actual node widths
      const aWidth = a.data.nodeWidth || 60;
      const bWidth = b.data.nodeWidth || 60;
      const avgWidth = (aWidth + bWidth) / 2;

      if (a.parent === b.parent) {
        // Siblings: scale separation based on node sizes
        return (avgWidth + 10) / 80;
      } else {
        // Cousins: slightly more space
        return (avgWidth + 20) / 80;
      }
    });

  // Calculate positions
  const treeData = treeLayout(hierarchyData);

  // Stage 2: Resolve collisions
  const collisionResolvedData = resolveCollisions(treeData);

  // Convert to flat array with positions
  const nodes = [];
  const connections = [];

  collisionResolvedData.each((d) => {
    nodes.push({
      ...d.data,
      x: d.x,
      y: d.y,
      depth: d.depth,
    });
  });

  // Group nodes by their parent to create connections
  const parentGroups = new Map();

  collisionResolvedData.each((d) => {
    if (d.parent) {
      const parentId = d.parent.data.id;
      if (!parentGroups.has(parentId)) {
        parentGroups.set(parentId, {
          parent: { x: d.parent.x, y: d.parent.y, id: parentId },
          children: [],
        });
      }
      parentGroups.get(parentId).children.push({
        x: d.x,
        y: d.y,
        id: d.data.id,
      });
    }
  });

  // Convert parent groups to connections
  parentGroups.forEach((group) => {
    connections.push(group);
  });

  return { nodes, connections };
}
