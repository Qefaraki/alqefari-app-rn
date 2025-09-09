import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function testActualStats() {
  console.log('Testing admin_get_enhanced_statistics...\n');
  
  const { data, error } = await supabase.rpc('admin_get_enhanced_statistics');
  
  if (error) {
    console.log('❌ Error:', error);
  } else {
    console.log('✅ Success! Statistics received:\n');
    
    if (data.basic) {
      console.log('Basic Stats:');
      console.log(`  Total profiles: ${data.basic.total_profiles}`);
      console.log(`  Male: ${data.basic.male_count}`);
      console.log(`  Female: ${data.basic.female_count}`);
    }
    
    if (data.munasib) {
      console.log('\nMunasib Stats:');
      console.log(`  Total Munasib: ${data.munasib.total_munasib}`);
      console.log(`  Male Munasib: ${data.munasib.male_munasib}`);
      console.log(`  Female Munasib: ${data.munasib.female_munasib}`);
      
      if (data.munasib.top_families && data.munasib.top_families.length > 0) {
        console.log('\n  Top Families:');
        data.munasib.top_families.forEach(f => {
          console.log(`    - ${f.family_name}: ${f.count}`);
        });
      }
    } else {
      console.log('\n⚠️  No Munasib data in response');
    }
    
    if (data.family) {
      console.log('\nFamily Stats:');
      console.log(`  Total marriages: ${data.family.total_marriages}`);
    }
  }
}

testActualStats();
