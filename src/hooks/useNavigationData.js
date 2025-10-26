import { useMemo } from 'react';

/**
 * Hook to extract navigation data for pill navigation system
 * 
 * Extracts and processes:
 * - Root node (generation 1, no father_id)
 * - Main G2 branches (generation 2 with children, sorted by sibling order)
 * - Descendant counts for each branch
 * 
 * Performance optimized with memoization to prevent unnecessary recalculations
 * when tree data hasn't changed.
 * 
 * @param {Array} nodes - Array of tree nodes from useTreeStore
 * @returns {Object} Navigation data object containing root node and G2 branches
 * 
 * @example
 * const { rootNode, g2Branches, hasData } = useNavigationData(nodes);
 * 
 * // Root node structure:
 * // { id, name, generation: 1 }
 * 
 * // G2 branches structure:
 * // [{ id, name, fullName, descendantCount, siblingOrder }]
 */
export const useNavigationData = (nodes = []) => {
  return useMemo(() => {
    if (!nodes || nodes.length === 0) {
      return { 
        rootNode: null, 
        g2Branches: [], 
        hasData: false 
      };
    }

    console.log('🧭 Processing navigation data for', nodes.length, 'nodes');

    // Find root node (generation 1, no father_id)
    const rootNode = nodes.find(n => 
      n.generation === 1 && !n.father_id
    );

    if (rootNode) {
      console.log('🌳 Found root node:', rootNode.name);
    }

    // Find main G2 branches (generation 2 with children, sorted by sibling order)
    const g2Branches = nodes
      .filter(n => {
        const isG2 = n.generation === 2;
        const hasChildren = n._hasChildren || hasDescendants(n.id, nodes);
        return isG2 && hasChildren;
      })
      .sort((a, b) => (a.sibling_order || 0) - (b.sibling_order || 0))
      .map(node => {
        const descendantCount = calculateDescendantCount(node.id, nodes);
        const firstName = extractFirstName(node.name);
        
        console.log(`👥 G2 Branch: ${firstName} (${descendantCount} descendants)`);
        
        return {
          id: node.id,
          name: firstName,
          fullName: node.name,
          descendantCount,
          siblingOrder: node.sibling_order || 0
        };
      });

    const hasData = rootNode || g2Branches.length > 0;

    console.log('🧭 Navigation data processed:', {
      hasRoot: !!rootNode,
      g2Count: g2Branches.length,
      hasData
    });

    return { 
      rootNode, 
      g2Branches, 
      hasData 
    };
  }, [nodes]);
};

// Helper function to extract first name from full Arabic name
const extractFirstName = (fullName) => {
  if (!fullName) return '';
  // Split by space and take the first part
  // For Arabic names, this typically gives us the given name
  return fullName.trim().split(' ')[0];
};

// Helper function to check if a node has descendants
const hasDescendants = (nodeId, nodes) => {
  return nodes.some(node => 
    node.father_id === nodeId || 
    node.mother_id === nodeId
  );
};

// Helper function to calculate total descendant count recursively
const calculateDescendantCount = (nodeId, nodes) => {
  const directChildren = nodes.filter(node => 
    node.father_id === nodeId || node.mother_id === nodeId
  );
  
  let totalCount = directChildren.length;
  
  // Recursively count all descendants (children, grandchildren, etc.)
  directChildren.forEach(child => {
    totalCount += calculateDescendantCount(child.id, nodes);
  });
  
  return totalCount;
};

// Helper function to get branch statistics for debugging
export const getBranchStatistics = (nodes = []) => {
  const stats = {
    totalNodes: nodes.length,
    generations: {},
    rootNodes: 0,
    g2WithChildren: 0,
    g2WithoutChildren: 0
  };

  nodes.forEach(node => {
    // Count by generation
    const gen = node.generation || 0;
    stats.generations[gen] = (stats.generations[gen] || 0) + 1;

    // Count root nodes
    if (gen === 1 && !node.father_id) {
      stats.rootNodes++;
    }

    // Count G2 nodes
    if (gen === 2) {
      if (node._hasChildren || hasDescendants(node.id, nodes)) {
        stats.g2WithChildren++;
      } else {
        stats.g2WithoutChildren++;
      }
    }
  });

  return stats;
};