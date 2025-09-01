import { supabase } from '../services/supabase';

export async function checkAndCreateAdminProfile() {
  try {
    // First, get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError) {
      console.error('Error getting user:', userError);
      return { success: false, error: userError };
    }
    
    if (!user) {
      console.log('No user logged in');
      return { success: false, error: 'No user logged in' };
    }
    
    console.log('Current user:', user.email, user.id);
    
    // Check if profile exists
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();
      
    if (profileError) {
      console.error('Error checking profile:', profileError);
      return { success: false, error: profileError };
    }
    
    if (profile) {
      console.log('Profile exists:', profile);
      return { success: true, profile };
    }
    
    // Create admin profile if it doesn't exist
    console.log('Creating admin profile for user:', user.id);
    const { data: newProfile, error: createError } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        email: user.email,
        role: 'admin',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();
      
    if (createError) {
      console.error('Error creating profile:', createError);
      return { success: false, error: createError };
    }
    
    console.log('Admin profile created:', newProfile);
    return { success: true, profile: newProfile };
    
  } catch (error) {
    console.error('Unexpected error:', error);
    return { success: false, error };
  }
}