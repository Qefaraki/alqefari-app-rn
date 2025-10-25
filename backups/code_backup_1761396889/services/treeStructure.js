import { supabase } from "./supabase";
import { filterTreeForPerson } from "../utils/treeFilter";
import { calculateTreeLayout } from "../utils/treeLayout";

/**
 * Quick fetch of tree structure for skeleton loading
 * Returns minimal data: just IDs, relationships, and calculated positions
 */
export async function fetchTreeStructure(focusPersonId) {
  if (!focusPersonId) return null;

  try {
    // Quick query - just essential fields for structure
    // Start with focus person
    const { data: focusData, error: focusError } = await supabase
      .from("profiles")
      .select("id, father_id, mother_id, sibling_order, generation, photo_url")
      .eq("id", focusPersonId)
      .single();

    if (focusError || !focusData) {
      console.warn("Could not fetch focus person:", focusError);
      return null;
    }

    // Get immediate family (using Set to avoid duplicates)
    const nodeIds = new Set([focusData.id]);
    const structureData = [focusData];

    // Fetch children and siblings
    if (focusData.father_id) {
      const { data: siblings } = await supabase
        .from("profiles")
        .select(
          "id, father_id, mother_id, sibling_order, generation, photo_url",
        )
        .eq("father_id", focusData.father_id)
        .neq("id", focusPersonId) // Exclude focus person to avoid duplicate
        .limit(20);

      if (siblings) {
        siblings.forEach((sibling) => {
          if (!nodeIds.has(sibling.id)) {
            nodeIds.add(sibling.id);
            structureData.push(sibling);
          }
        });
      }
    }

    // Also fetch ancestors
    let currentId = structureData.find(
      (n) => n.id === focusPersonId,
    )?.father_id;
    const ancestorIds = [];

    while (currentId && ancestorIds.length < 5) {
      ancestorIds.push(currentId);
      const parent = structureData.find((n) => n.id === currentId);
      if (!parent) break;
      currentId = parent.father_id;
    }

    // Fetch ancestors if we found any
    if (ancestorIds.length > 0) {
      const { data: ancestors } = await supabase
        .from("profiles")
        .select(
          "id, father_id, mother_id, sibling_order, generation, photo_url",
        )
        .in("id", ancestorIds);

      if (ancestors) {
        structureData.push(...ancestors);
      }
    }

    // Apply same filtering logic as main tree
    const filtered = filterTreeForPerson(structureData, focusPersonId);

    // Calculate layout positions
    const layoutResult = calculateTreeLayout(filtered);

    // Return structure with positions
    if (layoutResult && layoutResult.nodes) {
      return {
        nodes: layoutResult.nodes.map((n) => ({
          id: n.id,
          x: n.x,
          y: n.y,
          hasPhoto: !!n.photo_url,
          isFocus: n.id === focusPersonId,
          level: n.generation,
        })),
        focusId: focusPersonId,
      };
    }

    return null;
  } catch (error) {
    console.error("Error fetching tree structure:", error);
    return null;
  }
}

/**
 * Cache structure for future loads
 */
const structureCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function getCachedStructure(focusPersonId) {
  const cached = structureCache.get(focusPersonId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.structure;
  }
  return null;
}

export function setCachedStructure(focusPersonId, structure) {
  structureCache.set(focusPersonId, {
    structure,
    timestamp: Date.now(),
  });
}
