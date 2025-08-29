// Database types for Supabase tables
// This file should be updated when the schema changes

// Date structure for flexible date storage
export interface DateData {
  hijri?: {
    year: number;
    month?: number;
    day?: number;
  };
  gregorian?: {
    year: number;
    month?: number;
    day?: number;
    approximate?: boolean;
    circa?: string;
  };
  display?: string;
}

// Social media links structure
export interface SocialMediaLinks {
  twitter?: string;
  x?: string;
  instagram?: string;
  linkedin?: string;
  facebook?: string;
  youtube?: string;
  tiktok?: string;
  snapchat?: string;
  website?: string;
  blog?: string;
  github?: string;
  [key: string]: string | undefined; // Allow additional platforms
}

// Timeline event structure
export interface TimelineEvent {
  year: string;
  event: string;
  details?: string;
}

// Tree metadata structure
export interface TreeMeta {
  subtree_width?: number;
  subtree_height?: number;
  max_depth?: number;
  last_calculated?: string;
}

export interface Profile {
  // Core Identifiers
  id: string;
  hid: string; // Now required in v2
  
  // Family Structure & Ordering
  father_id?: string | null;
  mother_id?: string | null;
  generation: number;
  sibling_order: number;
  
  // Personal Identity
  name: string;
  kunya?: string | null;
  nickname?: string | null;
  
  // Biographical Data
  gender: 'male' | 'female';
  status: 'alive' | 'deceased';
  dob_data?: DateData | null;
  dod_data?: DateData | null;
  bio?: string | null;
  
  // Location & Career
  birth_place?: string | null;
  current_residence?: string | null;
  occupation?: string | null;
  education?: string | null;
  
  // Contact Information
  phone?: string | null;
  email?: string | null;
  photo_url?: string | null;
  
  // Social Media (consolidated in v2)
  social_media_links: SocialMediaLinks;
  
  // Complex Data
  achievements?: string[] | null;
  timeline?: TimelineEvent[] | null;
  
  // Privacy & Permissions
  dob_is_public: boolean;
  profile_visibility: 'public' | 'family' | 'private';
  
  // Data Integrity
  version: number;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
  
  // Search & Performance
  search_vector?: any;
  layout_position?: {
    x: number;
    y: number;
    depth: number;
  } | null;
  
  // Computed values
  descendants_count: number;
  tree_meta: TreeMeta;
}

export interface Marriage {
  id: string;
  husband_id: string;
  wife_id: string;
  munasib?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  status: 'married' | 'divorced' | 'widowed';
  created_at: string;
  updated_at: string;
}

export interface MediaUpload {
  id: string;
  uploader_user_id: string;
  target_profile_id: string;
  storage_path: string;
  media_type: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_notes?: string | null;
  created_at: string;
  reviewed_at?: string | null;
  reviewed_by_admin_id?: string | null;
}

export interface Suggestion {
  id: string;
  proposer_user_id: string;
  target_profile_id: string;
  suggested_data: any;
  status: 'pending' | 'approved' | 'rejected';
  admin_notes?: string | null;
  created_at: string;
  reviewed_at?: string | null;
  reviewed_by_admin_id?: string | null;
}

export interface AuditLog {
  id: number;
  admin_user_id?: string | null;
  action: string;
  target_profile_id?: string | null;
  details?: any;
  created_at: string;
}

export interface Role {
  id: number;
  name: string;
  description?: string | null;
  permissions?: any;
  created_at: string;
}

export interface UserRole {
  user_id: string;
  role_id: number;
  granted_at: string;
  granted_by?: string | null;
}

// Tree data structure for visualization
export interface TreeNode extends Profile {
  x?: number;
  y?: number;
  children?: TreeNode[];
}

// API Response types
export interface ApiResponse<T> {
  data: T | null;
  error: Error | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  count: number;
  page: number;
  pageSize: number;
}