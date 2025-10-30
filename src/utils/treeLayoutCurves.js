/**
 * D3 Tidy Tree Layout (EXACT COPY from Observable)
 * Source: https://observablehq.com/@d3/tree/2
 *
 * NO custom logic. Pure D3 Reingold-Tilford algorithm.
 * Only adaptations: Convert flat family array to hierarchy + sibling sort for RTL
 */

import { hierarchy, tree } from "d3-hierarchy";
import { STANDARD_NODE, ROOT_NODE } from "../components/TreeView/rendering/nodeConstants";

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
  const dx = 40;  // Tight sibling spacing (reduced from 60px to match normal mode density)
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
  // Keep D3's coordinate system: x = horizontal breadth, y = vertical depth.
  // Apply same visual spacing adjustments used by the straight layout so both
  // modes share identical node anchoring.
  // Step 1: Root spacing (visual gap at top)
  root.each((d) => {
    const isRoot = d.depth === 0 && !d.data.father_id;
    if (isRoot) {
      d.y -= 80;
    }
  });

  // Step 2: Top alignment per generation (align node tops instead of centers)
  const depthGroups = new Map();
  root.each((d) => {
    if (!depthGroups.has(d.depth)) {
      depthGroups.set(d.depth, []);
    }
    depthGroups.get(d.depth).push(d);
  });

  depthGroups.forEach((nodesAtDepth, depth) => {
    const minHeight = Math.min(
      ...nodesAtDepth.map((node) => {
        const isRoot = depth === 0 && !node.data.father_id;
        return isRoot ? ROOT_NODE.HEIGHT : STANDARD_NODE.HEIGHT_TEXT_ONLY;
      })
    );

    nodesAtDepth.forEach((node) => {
      const isRoot = depth === 0 && !node.data.father_id;
      const nodeHeight = isRoot ? ROOT_NODE.HEIGHT : STANDARD_NODE.HEIGHT_TEXT_ONLY;
      const offset = (nodeHeight - minHeight) / 2;
      node.y += offset;
    });
  });

  const nodes = [];
  const connections = [];

  root.each((d) => {
    nodes.push({
      ...d.data,
      x: d.x,
      y: d.y,
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
            x: d.parent.x,
            y: d.parent.y,
            id: parentId,
            photo_url: d.parent.data.photo_url,
            father_id: d.parent.data.father_id,
          },
          children: [],
        });
      }
      parentGroups.get(parentId).children.push({
        x: d.x,
        y: d.y,
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
