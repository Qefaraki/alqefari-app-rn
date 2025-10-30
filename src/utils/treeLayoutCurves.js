/**
 * D3 Tidy Tree Layout (EXACT COPY from Observable)
 * Source: https://observablehq.com/@d3/tree/2
 *
 * NO custom logic. Pure D3 Reingold-Tilford algorithm.
 * Only adaptations: Convert flat family array to hierarchy + sibling sort for RTL
 */

import { hierarchy, tree } from "d3-hierarchy";

/**
 * Calculate D3 tidy tree layout with EXACT D3 code
 *
 * @param {Array} familyData - Flat array of family profiles
 * @param {Number} viewportWidth - Canvas width for dynamic spacing (optional, default 800)
 * @returns {Object} { nodes: Array, connections: Array }
 */
export function calculateCurvesLayout(familyData, viewportWidth = 800) {
  // Safety check
  if (!familyData || !Array.isArray(familyData)) {
    console.warn("[CurvesLayout] Invalid data:", familyData);
    return { nodes: [], connections: [] };
  }

  // === ADAPTATION 1: Convert flat array to hierarchical structure ===
  const dataMap = new Map();
  familyData.forEach((person) =>
    dataMap.set(person.id, { ...person, children: [] }),
  );

  let rootNode = null;

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
      rootNode = personNode;
    }
  });

  if (!rootNode) {
    console.error("[CurvesLayout] No root node found");
    return { nodes: [], connections: [] };
  }

  // === ADAPTATION 2: Sort children by sibling_order for RTL display ===
  function sortChildrenByOrder(node) {
    if (node.children && node.children.length > 0) {
      node.children.sort((a, b) => {
        const orderA = a.sibling_order ?? 999;
        const orderB = b.sibling_order ?? 999;
        return orderB - orderA; // Descending for RTL
      });
      node.children.forEach((child) => sortChildrenByOrder(child));
    }
  }
  sortChildrenByOrder(rootNode);

  // === D3 TIDY TREE CODE (EXACT COPY-PASTE) ===
  const root = hierarchy(rootNode);

  // Observable Plot style: Moderate spacing for clean, compact layout
  // dx controls vertical spacing between siblings/cousins (breadth axis)
  // dy controls horizontal spacing between generations (depth axis)
  const dx = 60;  // Moderate sibling/cousin spacing (reduced from 80px for tighter packing)
  const dy = (viewportWidth / (root.height + 1)) * 1.5;  // 1.5x wider generation spacing

  // Create tree layout
  const treeLayout = tree().nodeSize([dx, dy]);

  // Sort by name (optional, D3 example does this)
  // We skip this since we already sorted by sibling_order above

  // Apply tree layout
  treeLayout(root);

  // Calculate bounding box (D3's way)
  let x0 = Infinity;
  let x1 = -x0;
  root.each(d => {
    if (d.x > x1) x1 = d.x;
    if (d.x < x0) x0 = d.x;
  });

  if (__DEV__) {
    console.log(`[CurvesLayout] D3 tidy tree: dx=${dx}, dy=${dy.toFixed(1)}, height=${root.height}, bounds=[${x0.toFixed(1)}, ${x1.toFixed(1)}]`);
  }

  // === ADAPTATION 3: Convert to app format (nodes + connections) ===
  // Use D3's original coordinates (no swap needed - D3 tree() handles orientation)
  // With nodeSize([small_dx, large_dy]), D3 naturally creates horizontal layout:
  // - d.x (breadth) = vertical axis (siblings spread up/down)
  // - d.y (depth) = horizontal axis (tree grows left-to-right)
  const nodes = [];
  const connections = [];

  root.each((d) => {
    nodes.push({
      ...d.data,
      x: d.y,  // Swap: D3 depth becomes horizontal position
      y: d.x,  // Swap: D3 breadth becomes vertical position
      depth: d.depth,
    });
  });

  // Group nodes by parent to create connections
  const parentGroups = new Map();

  root.each((d) => {
    if (d.parent) {
      const parentId = d.parent.data.id;
      if (!parentGroups.has(parentId)) {
        parentGroups.set(parentId, {
          parent: {
            x: d.parent.y,  // Swap: D3 depth becomes horizontal position
            y: d.parent.x,  // Swap: D3 breadth becomes vertical position
            id: parentId,
            photo_url: d.parent.data.photo_url,
            father_id: d.parent.data.father_id,
          },
          children: [],
        });
      }
      parentGroups.get(parentId).children.push({
        x: d.y,  // Swap: D3 depth becomes horizontal position
        y: d.x,  // Swap: D3 breadth becomes vertical position
        id: d.data.id,
        photo_url: d.data.photo_url,
        father_id: d.data.father_id,
      });
    }
  });

  parentGroups.forEach((group) => {
    connections.push(group);
  });

  return { nodes, connections };
}
