/**
 * D3 Tidy Tree Layout (EXACT COPY from Observable)
 * Source: https://observablehq.com/@d3/tree/2
 *
 * NO custom logic. Pure D3 Reingold-Tilford algorithm.
 * Only adaptations: Convert flat family array to hierarchy + sibling sort for RTL
 */

import { hierarchy, tree } from "d3-hierarchy";
import { TIDY_RECT } from "../components/TreeView/rendering/nodeConstants";

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

  // === ADAPTATION 1: Convert flat family array to hierarchical structure ===
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
  const dx = 41;  // Increased to account for larger tidy nodes (extra sibling separation)
  const dy = (viewportWidth / (root.height + 1)) * 1.56;  // Wider generation spacing for larger nodes

  // Create tree layout
  const treeLayout = tree()
    .nodeSize([dx, dy])
    .separation((a, b) => (a.parent === b.parent ? 0.8 : 1.2));

  // Sort by name (optional, D3 example does this)
  // We skip this since we already sorted by sibling_order above

  // Apply tree layout
  treeLayout(root);

  // Calculate breadth bounds (needed to normalize x coordinates)
  let minBreadth = Infinity;
  let maxBreadth = -Infinity;
  root.each((d) => {
    if (d.x < minBreadth) minBreadth = d.x;
    if (d.x > maxBreadth) maxBreadth = d.x;
  });

  if (__DEV__) {
    console.log(
      `[CurvesLayout] D3 tidy tree: dx=${dx}, dy=${dy.toFixed(1)}, height=${root.height}, breadth=[${minBreadth.toFixed(1)}, ${maxBreadth.toFixed(1)}]`
    );
  }

  // Normalize coordinates to match straight-layout conventions
  const breadthOffset = -minBreadth;
  const depthSpacing = dy;

  const layoutNodes = [];
  const idToLayout = new Map();
  const depthGroups = new Map();

  root.each((d) => {
    const layoutX = d.x + breadthOffset;
    let layoutY = d.depth * depthSpacing;

    if (d.depth === 0 && !d.data.father_id) {
      layoutY -= 60; // visual gap above root (scaled down for tidy mode)
    }

    const layoutNode = {
      id: d.data.id,
      data: d.data,
      depth: d.depth,
      layoutX,
      layoutY,
    };

    layoutNodes.push(layoutNode);
    idToLayout.set(d.data.id, layoutNode);

    if (!depthGroups.has(d.depth)) {
      depthGroups.set(d.depth, []);
    }
    depthGroups.get(d.depth).push(layoutNode);
  });

  // Top-align nodes within each generation (text-only heights for progressive layout)
  depthGroups.forEach((nodesAtDepth, depth) => {
    const minHeight = Math.min(
      ...nodesAtDepth.map((node) =>
        depth === 0 && !node.data.father_id
          ? TIDY_RECT.ROOT.HEIGHT
          : TIDY_RECT.STANDARD.HEIGHT_TEXT_ONLY,
      )
    );

    nodesAtDepth.forEach((node) => {
      const nodeHeight =
        depth === 0 && !node.data.father_id
          ? TIDY_RECT.ROOT.HEIGHT
          : TIDY_RECT.STANDARD.HEIGHT_TEXT_ONLY;
      node.layoutY += (nodeHeight - minHeight) / 2;
    });
  });

  const nodes = layoutNodes.map((node) => ({
    ...node.data,
    x: node.layoutX,
    y: node.layoutY,
    depth: node.depth,
  }));

  const parentGroups = new Map();

  root.each((d) => {
    if (!d.parent) return;

    const parentId = d.parent.data.id;
    const parentLayout = idToLayout.get(parentId);
    const childLayout = idToLayout.get(d.data.id);

    if (!parentGroups.has(parentId)) {
      parentGroups.set(parentId, {
        parent: {
          x: parentLayout.layoutX,
          y: parentLayout.layoutY,
          id: parentId,
          photo_url: d.parent.data.photo_url,
          father_id: d.parent.data.father_id,
        },
        children: [],
      });
    }

    parentGroups.get(parentId).children.push({
      x: childLayout.layoutX,
      y: childLayout.layoutY,
      id: d.data.id,
      photo_url: d.data.photo_url,
      father_id: d.data.father_id,
    });
  });

  const connections = Array.from(parentGroups.values());

  return { nodes, connections };
}
