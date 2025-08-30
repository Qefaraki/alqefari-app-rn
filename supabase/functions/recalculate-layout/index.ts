import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { hierarchy, tree } from 'https://esm.sh/d3-hierarchy@3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Profile {
  id: string
  hid: string
  name: string
  father_id: string | null
  generation: number
  sibling_order: number
  layout_position?: {
    x: number
    y: number
    depth: number
  }
}

interface RequestData {
  affected_node_id: string
  job_id?: string
}

interface LayoutUpdate {
  id: string
  layout_position: {
    x: number
    y: number
    depth: number
  }
  tree_meta?: {
    subtree_width?: number
    subtree_height?: number
    max_depth?: number
  }
}

// Helper to validate input
function validateInput(data: any): { valid: boolean; error?: string } {
  if (!data.affected_node_id) {
    return { valid: false, error: 'affected_node_id is required' }
  }
  
  if (typeof data.affected_node_id !== 'string') {
    return { valid: false, error: 'affected_node_id must be a UUID string' }
  }
  
  // Basic UUID validation
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(data.affected_node_id)) {
    return { valid: false, error: 'affected_node_id must be a valid UUID' }
  }
  
  // Validate job_id if provided
  if (data.job_id && !uuidRegex.test(data.job_id)) {
    return { valid: false, error: 'job_id must be a valid UUID' }
  }
  
  return { valid: true }
}

// Helper to find the root of affected subtree
async function findAffectedRoot(
  supabase: any,
  affectedNodeId: string
): Promise<{ rootId: string; depth: number } | null> {
  try {
    // Get the affected node
    const { data: node, error } = await supabase
      .from('profiles')
      .select('id, father_id, generation')
      .eq('id', affectedNodeId)
      .single()
    
    if (error || !node) return null
    
    // For now, go up 2 levels to find a good recalculation root
    // This balances between recalculating too much and too little
    let currentId = node.id
    let currentFatherId = node.father_id
    let depth = 0
    const maxDepth = 2
    
    while (currentFatherId && depth < maxDepth) {
      const { data: parent } = await supabase
        .from('profiles')
        .select('id, father_id')
        .eq('id', currentFatherId)
        .single()
      
      if (!parent) break
      
      currentId = parent.id
      currentFatherId = parent.father_id
      depth++
    }
    
    return { rootId: currentId, depth }
  } catch (error) {
    console.error('Error finding affected root:', error)
    return null
  }
}

// Optimized layout calculation for subtree only
async function calculateSubtreeLayout(
  supabase: any,
  rootId: string
): Promise<LayoutUpdate[]> {
  const startTime = Date.now()
  
  // Fetch only the subtree data
  const { data: profiles, error } = await supabase
    .rpc('get_branch_data', { 
      p_hid: null,  // We'll use recursive CTE instead
      p_max_depth: 10,  // Reasonable depth limit
      p_limit: 1000  // Reasonable node limit
    })
  
  // Alternative: Use recursive CTE directly
  const { data: subtreeData, error: subtreeError } = await supabase.rpc('get_subtree_data', {
    p_root_id: rootId
  })
  
  if (subtreeError || !subtreeData || subtreeData.length === 0) {
    console.error('Error fetching subtree:', subtreeError)
    return []
  }
  
  console.log(`Fetched ${subtreeData.length} nodes in ${Date.now() - startTime}ms`)
  
  // Build hierarchy
  const profileMap = new Map<string, Profile>()
  const childrenMap = new Map<string, Profile[]>()
  let root: Profile | null = null
  
  // First pass: create profile map and identify root
  subtreeData.forEach((profile: Profile) => {
    profileMap.set(profile.id, profile)
    if (profile.id === rootId) {
      root = profile
    }
  })
  
  // Second pass: build children map
  subtreeData.forEach((profile: Profile) => {
    if (profile.father_id && profileMap.has(profile.father_id)) {
      if (!childrenMap.has(profile.father_id)) {
        childrenMap.set(profile.father_id, [])
      }
      childrenMap.get(profile.father_id)!.push(profile)
    }
  })
  
  // Sort children by sibling order
  childrenMap.forEach((children) => {
    children.sort((a, b) => a.sibling_order - b.sibling_order)
  })
  
  if (!root) {
    console.error('Root node not found in subtree')
    return []
  }
  
  // Create d3 hierarchy
  const hierarchyRoot = hierarchy(root, (d) => childrenMap.get(d.id) || [])
  
  // Configure tree layout with dynamic spacing
  const treeLayout = tree<Profile>()
    .nodeSize([120, 200])  // [width, height] between nodes
    .separation((a, b) => {
      // Wider separation for nodes with many children
      const aChildren = childrenMap.get(a.data.id)?.length || 0
      const bChildren = childrenMap.get(b.data.id)?.length || 0
      const maxChildren = Math.max(aChildren, bChildren)
      
      if (a.parent === b.parent) {
        return 1 + (maxChildren > 5 ? 0.5 : 0)
      }
      return 2
    })
  
  // Apply layout
  treeLayout(hierarchyRoot)
  
  // Collect position updates
  const updates: LayoutUpdate[] = []
  let minX = Infinity, maxX = -Infinity
  let minY = Infinity, maxY = -Infinity
  
  hierarchyRoot.each((node) => {
    const x = node.x
    const y = node.y * 100  // Scale Y for generations
    
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x)
    minY = Math.min(minY, y)
    maxY = Math.max(maxY, y)
    
    updates.push({
      id: node.data.id,
      layout_position: {
        x: x,
        y: y,
        depth: node.depth
      },
      tree_meta: {
        subtree_width: node.leaves().length * 120,  // Approximate
        max_depth: node.height
      }
    })
  })
  
  // Add subtree bounds to root
  const rootUpdate = updates.find(u => u.id === rootId)
  if (rootUpdate && rootUpdate.tree_meta) {
    rootUpdate.tree_meta.subtree_width = maxX - minX
    rootUpdate.tree_meta.subtree_height = maxY - minY
  }
  
  console.log(`Layout calculated for ${updates.length} nodes in ${Date.now() - startTime}ms`)
  
  return updates
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  
  const startTime = Date.now()
  
  try {
    // Parse request
    const requestData = await req.json()
    
    // Validate input
    const validation = validateInput(requestData)
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: validation.error }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }
    
    const { affected_node_id, job_id } = requestData as RequestData
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    console.log(`Processing layout recalculation for node: ${affected_node_id}${job_id ? ` (job: ${job_id})` : ''}`)
    
    // Update background job status to processing if job_id provided
    if (job_id) {
      const { error: jobUpdateError } = await supabase
        .from('background_jobs')
        .update({
          status: 'processing',
          started_at: new Date().toISOString()
        })
        .eq('id', job_id)
      
      if (jobUpdateError) {
        console.error('Failed to update job status to processing:', jobUpdateError)
      }
    }
    
    // Find the appropriate root for recalculation
    const affectedRoot = await findAffectedRoot(supabase, affected_node_id)
    if (!affectedRoot) {
      throw new Error('Could not determine affected subtree root')
    }
    
    console.log(`Recalculating subtree from root: ${affectedRoot.rootId} (depth: ${affectedRoot.depth})`)
    
    // Calculate layout for affected subtree only
    const updates = await calculateSubtreeLayout(supabase, affectedRoot.rootId)
    
    if (updates.length === 0) {
      throw new Error('No layout updates calculated')
    }
    
    // Bulk update positions using our optimized function
    const { data: updateResult, error: updateError } = await supabase
      .rpc('admin_bulk_update_layouts', {
        p_updates: updates.map(u => ({
          id: u.id,
          layout_position: u.layout_position,
          tree_meta: u.tree_meta
        }))
      })
    
    if (updateError) {
      throw updateError
    }
    
    // Update queue status
    await supabase
      .from('layout_recalc_queue')
      .update({
        completed_at: new Date().toISOString(),
        status: 'completed'
      })
      .eq('node_id', affected_node_id)
    
    // Update background job status to complete if job_id provided
    if (job_id) {
      // Get existing details
      const { data: jobData } = await supabase
        .from('background_jobs')
        .select('details')
        .eq('id', job_id)
        .single()
      
      const updatedDetails = {
        ...(jobData?.details || {}),
        updated_count: updates.length,
        execution_time_ms: Date.now() - startTime,
        recalc_root_id: affectedRoot.rootId
      }
      
      const { error: jobCompleteError } = await supabase
        .from('background_jobs')
        .update({
          status: 'complete',
          completed_at: new Date().toISOString(),
          details: updatedDetails
        })
        .eq('id', job_id)
      
      if (jobCompleteError) {
        console.error('Failed to update job status to complete:', jobCompleteError)
      }
    }
    
    const executionTime = Date.now() - startTime
    
    // Log performance metrics
    await supabase.rpc('log_performance_metric', {
      p_function_name: 'recalculate_layout',
      p_start_time: new Date(startTime).toISOString(),
      p_input_size: 1,
      p_output_size: updates.length
    })
    
    return new Response(
      JSON.stringify({ 
        success: true,
        affected_node_id,
        job_id,
        recalc_root_id: affectedRoot.rootId,
        updated_count: updates.length,
        execution_time_ms: executionTime,
        update_result: updateResult
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
    
  } catch (error) {
    console.error('Error in recalculate-layout:', error)
    
    // Update queue status on error
    try {
      const { affected_node_id, job_id } = await req.json() as RequestData
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      const supabase = createClient(supabaseUrl, supabaseKey)
      
      await supabase
        .from('layout_recalc_queue')
        .update({
          status: 'failed',
          error_message: error.message
        })
        .eq('node_id', affected_node_id)
      
      // Update background job status to failed if job_id provided
      if (job_id) {
        const { data: jobData } = await supabase
          .from('background_jobs')
          .select('details')
          .eq('id', job_id)
          .single()
        
        const updatedDetails = {
          ...(jobData?.details || {}),
          error: error.message,
          failed_at: new Date().toISOString()
        }
        
        await supabase
          .from('background_jobs')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            details: updatedDetails
          })
          .eq('id', job_id)
      }
    } catch (e) {
      console.error('Failed to update queue status:', e)
    }
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})