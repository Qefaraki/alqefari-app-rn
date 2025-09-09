import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function analyzeMarriagesStructure() {
  console.log('🔍 Analyzing Marriages Table Structure...\n');
  
  try {
    // Get table structure
    const { data: columns, error: columnsError } = await supabase
      .from('marriages')
      .select('*')
      .limit(1);
    
    if (columns && columns.length > 0) {
      console.log('📊 Marriages Table Columns:');
      console.log(Object.keys(columns[0]));
      console.log('\n📋 Sample Marriage Record:');
      console.log(JSON.stringify(columns[0], null, 2));
    }
    
    // Check for munasib field usage
    const { data: withMunasib, error: munasibError } = await supabase
      .from('marriages')
      .select('id, munasib')
      .not('munasib', 'is', null)
      .limit(10);
    
    console.log('\n📌 Marriages with munasib field filled:');
    console.log(`Count: ${withMunasib?.length || 0}`);
    if (withMunasib && withMunasib.length > 0) {
      console.log('Samples:', withMunasib.slice(0, 3));
    }
    
    // Analyze spouse references
    const { data: marriages, error: marriagesError } = await supabase
      .from('marriages')
      .select('husband_id, wife_id')
      .limit(100);
    
    if (marriages) {
      const allSpouseIds = new Set();
      marriages.forEach(m => {
        if (m.husband_id) allSpouseIds.add(m.husband_id);
        if (m.wife_id) allSpouseIds.add(m.wife_id);
      });
      
      console.log('\n👥 Spouse Analysis:');
      console.log(`Total unique spouse IDs referenced: ${allSpouseIds.size}`);
      
      // Check how many of these actually exist in profiles
      const { data: existingProfiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, hid, name')
        .in('id', Array.from(allSpouseIds));
      
      console.log(`Spouse profiles that exist: ${existingProfiles?.length || 0}`);
      
      // Check for profiles without HID (potential munasib)
      const profilesWithoutHID = existingProfiles?.filter(p => !p.hid) || [];
      console.log(`Profiles without HID (potential munasib): ${profilesWithoutHID.length}`);
      if (profilesWithoutHID.length > 0) {
        console.log('Sample profiles without HID:', profilesWithoutHID.slice(0, 3));
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

analyzeMarriagesStructure();
