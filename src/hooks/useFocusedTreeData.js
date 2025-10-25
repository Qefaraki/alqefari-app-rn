import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../services/supabase';
import profilesService from '../services/profiles';

/**
 * Hook for loading tree data focused on a specific person
 * Implements lazy loading strategy with progressive branch expansion
 */
export const useFocusedTreeData = (focusPersonId, initialDepth = 3) => {
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [centerNode, setCenterNode] = useState(null);

  // Keep track of loaded branches to avoid duplicate loads
  const loadedBranches = useRef(new Set());
  const nodesMap = useRef(new Map());
  const abortControllerRef = useRef(null);

  // Load initial focused data
  useEffect(() => {
    if (!focusPersonId) return;

    // Cancel any existing requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();

    loadInitialData();

    // Cleanup function to cancel pending requests
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      // Clear cached data when component unmounts or focusPersonId changes
      loadedBranches.current.clear();
      nodesMap.current.clear();
      setNodes([]);
      setCenterNode(null);
    };
  }, [focusPersonId]);

  const loadInitialData = async () => {
    setLoading(true);
    setError(null);
    loadedBranches.current.clear();
    nodesMap.current.clear();

    try {
      // Load the focused branch with specified depth
      const { data: branchData, error: branchError } = await profilesService.getBranchData(
        focusPersonId,
        initialDepth,
        300 // max nodes for initial load
      );

      if (branchError) {
        console.error('Error fetching branch data:', branchError);
        setError(branchError);
        setLoading(false);
        return;
      }

      if (!branchData || branchData.length === 0) {
        // Fallback to manual loading
        await loadManualBranch(focusPersonId);
        return;
      }

      // Find the center node
      const center = branchData.find(n => n.id === focusPersonId);
      if (center) {
        setCenterNode(center);
      }

      // Build nodes map for quick lookups
      branchData.forEach(node => {
        nodesMap.current.set(node.id, node);
      });

      // Mark this branch as loaded
      loadedBranches.current.add(focusPersonId);

      // Renderer handles dimensions via nodeConstants (STANDARD_NODE.WIDTH = 38px)
      setNodes(branchData);
    } catch (err) {
      console.error('Error loading focused tree data:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  const loadManualBranch = async (personId) => {
    try {
      const allNodes = [];

      // Load the person
      const { data: person } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', personId)
        .single();

      if (!person) {
        console.error('Person not found');
        setError(new Error('Person not found'));
        setLoading(false);
        return;
      }

      setCenterNode(person);
      allNodes.push(person);
      nodesMap.current.set(person.id, person);

      // Load ancestors up to root
      let currentId = person.father_id;
      let depth = 0;
      while (currentId && depth < 10) {
        const { data: ancestor } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', currentId)
          .single();

        if (ancestor) {
          allNodes.push(ancestor);
          nodesMap.current.set(ancestor.id, ancestor);
          currentId = ancestor.father_id;
        } else {
          break;
        }
        depth++;
      }

      // Load immediate family (children and siblings)
      if (person.father_id) {
        const { data: siblings } = await supabase
          .from('profiles')
          .select('*')
          .eq('father_id', person.father_id)
          .order('sibling_order');

        if (siblings) {
          siblings.forEach(sibling => {
            if (sibling.id !== personId) {
              allNodes.push(sibling);
              nodesMap.current.set(sibling.id, sibling);
            }
          });
        }
      }

      // Load children
      const { data: children } = await supabase
        .from('profiles')
        .select('*')
        .eq('father_id', personId)
        .order('sibling_order');

      if (children) {
        children.forEach(child => {
          allNodes.push(child);
          nodesMap.current.set(child.id, child);
        });

        // Load grandchildren for each child
        for (const child of children) {
          const { data: grandchildren } = await supabase
            .from('profiles')
            .select('*')
            .eq('father_id', child.id)
            .order('sibling_order');

          if (grandchildren) {
            grandchildren.forEach(gc => {
              allNodes.push(gc);
              nodesMap.current.set(gc.id, gc);
            });
          }
        }
      }

      // Remove duplicates
      const uniqueNodes = Array.from(
        new Map(allNodes.map(node => [node.id, node])).values()
      );

      // Add layout properties
      // Renderer handles dimensions via nodeConstants (STANDARD_NODE.WIDTH = 38px)
      setNodes(uniqueNodes);
      loadedBranches.current.add(personId);
    } catch (err) {
      console.error('Error in manual branch loading:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  // Load additional branch on demand
  const loadAdditionalBranch = useCallback(async (nodeId, depth = 2) => {
    // Check if already loaded
    if (loadedBranches.current.has(nodeId)) return;

    try {
      const { data: branchData, error } = await profilesService.getBranchData(
        nodeId,
        depth,
        100 // smaller limit for additional branches
      );

      if (error) throw error;

      if (branchData && branchData.length > 0) {
        const newNodes = [];

        branchData.forEach(node => {
          if (!nodesMap.current.has(node.id)) {
            nodesMap.current.set(node.id, node);
            newNodes.push(node);  // Renderer handles dimensions via nodeConstants
          }
        });

        if (newNodes.length > 0) {
          setNodes(prev => [...prev, ...newNodes]);
        }

        loadedBranches.current.add(nodeId);
      }
    } catch (err) {
      console.error('Error loading additional branch:', err);
    }
  }, []);

  // Check if we need to load more data based on viewport
  const checkViewportAndLoad = useCallback(async (visibleNodeIds) => {
    // Find nodes near the edge of loaded data
    for (const nodeId of visibleNodeIds) {
      const node = nodesMap.current.get(nodeId);
      if (node && !loadedBranches.current.has(nodeId)) {
        // This node is visible but its branch isn't fully loaded
        await loadAdditionalBranch(nodeId, 2);
      }
    }
  }, [loadAdditionalBranch]);

  return {
    nodes,
    loading,
    error,
    centerNode,
    loadAdditionalBranch,
    checkViewportAndLoad,
    nodesMap: nodesMap.current,
  };
};