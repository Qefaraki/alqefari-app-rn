#!/usr/bin/env node

/**
 * Mock Data Generator for Alqefari Family Tree
 * Generates ~1000 realistic nodes with proper relationships
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL || 'https://ezkioroyhzpavmbfavyn.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY // Use service role for admin functions
);

// Arabic name pools
const maleNames = [
  'محمد', 'أحمد', 'علي', 'عبدالله', 'عبدالعزيز', 'سعود', 'فهد', 'خالد', 'سلطان', 'ناصر',
  'سليمان', 'صالح', 'عبدالرحمن', 'إبراهيم', 'يوسف', 'عمر', 'حسن', 'حسين', 'طلال', 'فيصل',
  'تركي', 'بندر', 'مشعل', 'منصور', 'ماجد', 'نايف', 'سعد', 'جاسم', 'حمد', 'راشد',
  'عادل', 'طارق', 'زياد', 'وليد', 'ياسر', 'عامر', 'باسل', 'رائد', 'مازن', 'هيثم',
  'جربوع', 'مطلق', 'متعب', 'نواف', 'مساعد', 'ثامر', 'بدر', 'غازي', 'عايض', 'ممدوح'
];

const femaleNames = [
  'نورة', 'فاطمة', 'عائشة', 'مريم', 'سارة', 'هند', 'لطيفة', 'موضي', 'منيرة', 'هيا',
  'دلال', 'أمل', 'سلمى', 'رنا', 'لينا', 'دانا', 'ريم', 'غادة', 'سميرة', 'عبير',
  'وفاء', 'نجلاء', 'شذى', 'روان', 'جواهر', 'بدرية', 'عفاف', 'سحر', 'لولوة', 'حصة',
  'شهد', 'مها', 'أسماء', 'خلود', 'هيلة', 'مزنة', 'العنود', 'الجوهرة', 'البندري', 'نوف'
];

const cities = [
  'الرياض', 'جدة', 'الدمام', 'مكة المكرمة', 'المدينة المنورة', 'الخبر', 'الطائف', 'بريدة', 
  'تبوك', 'القطيف', 'خميس مشيط', 'الهفوف', 'حفر الباطن', 'الجبيل', 'الخرج', 'أبها',
  'نجران', 'ينبع', 'القصيم', 'حائل'
];

const occupations = [
  'طبيب', 'مهندس', 'معلم', 'موظف حكومي', 'رجل أعمال', 'محامي', 'طيار', 'ضابط',
  'أستاذ جامعي', 'مدير', 'محاسب', 'صيدلي', 'مبرمج', 'مصمم', 'كاتب', 'صحفي',
  'مزارع', 'تاجر', 'مقاول', 'مستشار', 'باحث', 'دبلوماسي', 'قاضي', 'مترجم'
];

const femaleOccupations = [
  'طبيبة', 'مهندسة', 'معلمة', 'موظفة', 'سيدة أعمال', 'محامية', 'أستاذة جامعية',
  'مديرة', 'محاسبة', 'صيدلانية', 'مصممة', 'كاتبة', 'صحفية', 'باحثة', 'ربة منزل',
  'طبيبة أسنان', 'ممرضة', 'مشرفة تربوية', 'أخصائية اجتماعية', 'مستشارة'
];

const educationLevels = [
  'الكتاتيب', 'الابتدائية', 'المتوسطة', 'الثانوية', 'دبلوم', 
  'بكالوريوس', 'ماجستير', 'دكتوراه', 'البورد السعودي', 'الزمالة'
];

const universities = [
  'جامعة الملك سعود', 'جامعة الملك عبدالعزيز', 'جامعة الملك فهد للبترول والمعادن',
  'جامعة الإمام محمد بن سعود', 'جامعة أم القرى', 'جامعة الملك فيصل', 'جامعة طيبة',
  'جامعة القصيم', 'جامعة الأميرة نورة', 'جامعة الملك خالد'
];

// Helper functions
function randomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateHijriDate(generation) {
  // Calculate appropriate year range based on generation
  const currentHijriYear = 1446;
  const yearsPerGeneration = 25;
  const baseYear = currentHijriYear - (generation * yearsPerGeneration);
  
  const year = baseYear - randomInt(0, 20);
  const month = randomInt(1, 12);
  const day = randomInt(1, 29); // Safe for all months
  
  return {
    hijri: { year, month, day },
    display: `${year}/${month}/${day}هـ`
  };
}

function generateSocialMedia(probability = 0.3) {
  if (Math.random() > probability) return {};
  
  const platforms = {};
  
  if (Math.random() < 0.5) {
    platforms.twitter = `https://twitter.com/user${randomInt(1000, 9999)}`;
  }
  if (Math.random() < 0.3) {
    platforms.linkedin = `https://linkedin.com/in/user${randomInt(1000, 9999)}`;
  }
  if (Math.random() < 0.2) {
    platforms.instagram = `https://instagram.com/user${randomInt(1000, 9999)}`;
  }
  
  return platforms;
}

function generateAchievements(probability = 0.2) {
  if (Math.random() > probability) return null;
  
  const achievements = [];
  const count = randomInt(1, 4);
  
  const achievementTemplates = [
    'حصل على وسام الملك عبدالعزيز',
    'تخرج بمرتبة الشرف الأولى',
    'أسس شركة ناجحة',
    'ساهم في بناء مسجد',
    'عضو مؤسس في جمعية خيرية',
    'حصل على جائزة التميز',
    'شارك في خدمة الحجاج',
    'نشر أبحاث علمية',
    'براءة اختراع مسجلة'
  ];
  
  for (let i = 0; i < count; i++) {
    achievements.push(randomItem(achievementTemplates));
  }
  
  return achievements;
}

function generateTimeline(generation, probability = 0.1) {
  if (Math.random() > probability) return null;
  
  const timeline = [];
  const currentYear = 1446 - (generation * 25);
  
  const events = [
    { offset: -60, event: 'الولادة' },
    { offset: -40, event: 'بداية التعليم' },
    { offset: -35, event: 'الزواج' },
    { offset: -30, event: 'ولادة أول الأبناء' },
    { offset: -20, event: 'الانتقال إلى منزل جديد' },
    { offset: -10, event: 'التقاعد' }
  ];
  
  events.forEach(({ offset, event }) => {
    if (Math.random() < 0.5) {
      timeline.push({
        year: String(currentYear + offset),
        event
      });
    }
  });
  
  return timeline.length > 0 ? timeline : null;
}

class FamilyTreeGenerator {
  constructor() {
    this.nodes = [];
    this.marriages = [];
    this.nodeCount = 0;
    this.currentId = 1;
    this.wifeCounter = 1; // Separate counter for wives
  }

  generateProfile(parentNode = null, generation = 1, siblingOrder = 1, forceGender = null) {
    const isRoot = !parentNode;
    const gender = forceGender || (Math.random() < 0.5 ? 'male' : 'female');
    const name = gender === 'male' ? randomItem(maleNames) : randomItem(femaleNames);
    
    // Determine profile completeness
    const completeness = Math.random();
    const isComplete = completeness < 0.2;
    const isMedium = completeness < 0.6;
    
    // Calculate HID - proper structure from the start
    let hid;
    if (isRoot) {
      hid = '1'; // Single root with HID "1"
    } else {
      hid = `${parentNode.hid}.${siblingOrder}`;
    }
    
    const profile = {
      id: `node-${this.currentId++}`,
      tempId: `node-${this.currentId - 1}`,
      hid,
      name,
      gender,
      generation,
      sibling_order: siblingOrder,
      father_id: parentNode?.tempId || null,
      status: Math.random() < 0.85 ? 'alive' : 'deceased',
      dob_is_public: Math.random() < 0.7,
      profile_visibility: 'public',
      social_media_links: generateSocialMedia(generation <= 4 ? 0.5 : 0.1)
    };

    // Add dates
    profile.dob_data = generateHijriDate(generation);
    if (profile.status === 'deceased') {
      const deathYear = profile.dob_data.hijri.year + randomInt(40, 90);
      profile.dod_data = {
        hijri: { year: deathYear },
        display: `${deathYear}هـ`
      };
    }

    // Add location data
    if (isComplete || isMedium) {
      profile.birth_place = randomItem(cities);
      profile.current_residence = profile.status === 'alive' ? randomItem(cities) : null;
    }

    // Add occupation and education
    if ((isComplete || isMedium) && generation <= 5) {
      if (gender === 'male') {
        profile.occupation = randomItem(occupations);
      } else {
        profile.occupation = Math.random() < 0.6 ? randomItem(femaleOccupations) : null;
      }
      
      if (profile.occupation && profile.occupation !== 'ربة منزل') {
        const eduLevel = randomItem(educationLevels);
        if (['بكالوريوس', 'ماجستير', 'دكتوراه'].includes(eduLevel)) {
          profile.education = `${eduLevel} - ${randomItem(universities)}`;
        } else {
          profile.education = eduLevel;
        }
      }
    }

    // Add complete profile fields
    if (isComplete) {
      profile.bio = `من أبناء عائلة القفاري الكرام. ${profile.occupation ? `يعمل في مجال ${profile.occupation}.` : ''} له إسهامات متعددة في خدمة المجتمع.`;
      profile.achievements = generateAchievements(0.6);
      profile.timeline = generateTimeline(generation, 0.4);
      
      if (Math.random() < 0.3) {
        profile.phone = `+9665${randomInt(10000000, 99999999)}`;
      }
      if (Math.random() < 0.2) {
        profile.email = `${name.replace(' ', '.')}@example.com`;
      }
      if (Math.random() < 0.1) {
        profile.photo_url = 'https://via.placeholder.com/200';
      }
    }

    this.nodes.push(profile);
    this.nodeCount++;
    
    return profile;
  }

  generateBranch(parentNode, generation, maxDepth, branchWidth) {
    if (generation > maxDepth || this.nodeCount >= 1200) return;
    
    // Determine number of children - ensure we generate enough nodes
    let childCount;
    if (generation <= 2) {
      childCount = randomInt(4, 10); // Many children at top generations
    } else if (generation <= 4) {
      childCount = randomInt(2, 6);
    } else if (generation <= 6) {
      childCount = randomInt(1, 4);
    } else {
      childCount = randomInt(0, 2);
    }
    
    // Some nodes have many children (10+)
    if (Math.random() < 0.1 && generation <= 4) {
      childCount = randomInt(8, 12);
    }
    
    const children = [];
    for (let i = 0; i < childCount && this.nodeCount < 1000; i++) {
      const child = this.generateProfile(parentNode, generation, i + 1);
      children.push(child);
      
      // Create marriages for some adults
      if (child.gender === 'male' && generation <= 6 && Math.random() < 0.7) {
        this.createMarriage(child);
      }
    }
    
    // Recursively generate next generation
    children.forEach(child => {
      if (child.gender === 'male' || Math.random() < 0.1) { // Some females have children too
        this.generateBranch(child, generation + 1, maxDepth, branchWidth);
      }
    });
  }

  createMarriage(husband) {
    // Create a wife profile with valid HID format
    // Use a separate branch (2000.x) for wives from outside the main family
    const wife = {
      id: `wife-${this.wifeCounter}`,
      tempId: `wife-${this.wifeCounter}`,
      hid: `2000.${this.wifeCounter}`, // Valid HID format for external wives
      name: randomItem(femaleNames),
      gender: 'female',
      generation: husband.generation,
      sibling_order: this.wifeCounter,
      father_id: null, // External to main family
      status: husband.status, // Same status as husband
      dob_is_public: false,
      profile_visibility: 'family',
      social_media_links: {},
      dob_data: generateHijriDate(husband.generation)
    };
    
    this.wifeCounter++;
    
    this.nodes.push(wife);
    
    const marriage = {
      id: `marriage-${this.marriages.length + 1}`,
      husband_id: husband.tempId,
      wife_id: wife.tempId,
      status: husband.status === 'deceased' ? 'widowed' : 'married',
      start_date: null, // Pass null instead of text
      end_date: null
    };
    
    this.marriages.push(marriage);
  }

  generateFamilyTree() {
    console.log('🌳 Generating family tree with ~1000 nodes...');
    
    // Generate single root - سليمان القفاري
    const root = this.generateProfile(null, 1, 1, 'male');
    root.name = 'سليمان القفاري';
    root.bio = 'جد عائلة القفاري - مؤسس العائلة الكريمة';
    root.birth_place = 'نجد';
    root.dob_data = {
      hijri: { year: 1250 },
      display: '1250هـ'
    };
    root.dod_data = {
      hijri: { year: 1320 },
      display: '1320هـ'
    };
    root.status = 'deceased';
    root.achievements = ['مؤسس عائلة القفاري', 'من وجهاء نجد'];
    
    // Generate a large family tree from this single root
    // Target ~1000 nodes by creating multiple wide branches
    this.generateBranch(root, 2, 8, 'wide');
    
    console.log(`✅ Generated ${this.nodes.length} nodes and ${this.marriages.length} marriages`);
    
    return {
      profiles: this.nodes,
      marriages: this.marriages
    };
  }
}

// Insert data into Supabase
async function insertData(data) {
  console.log('📤 Inserting data into Supabase...');
  
  let successCount = 0;
  let errorCount = 0;
  const errors = [];
  
  // Insert profiles in batches
  console.log('Inserting profiles...');
  for (let i = 0; i < data.profiles.length; i += 50) {
    const batch = data.profiles.slice(i, i + 50);
    
    for (const profile of batch) {
      try {
        // Convert father_id from tempId to actual UUID
        let actualFatherId = null;
        if (profile.father_id) {
          const father = data.profiles.find(p => p.tempId === profile.father_id);
          actualFatherId = father?.newId || null;
        }
        
        // Use admin function to create profile
        const { data: result, error } = await supabase.rpc('admin_create_profile', {
          p_name: profile.name,
          p_gender: profile.gender,
          p_father_id: actualFatherId,
          p_generation: profile.generation,
          p_sibling_order: profile.sibling_order,
          p_status: profile.status,
          p_dob_data: profile.dob_data,
          p_dod_data: profile.dod_data || null,
          p_bio: profile.bio || null,
          p_birth_place: profile.birth_place || null,
          p_current_residence: profile.current_residence || null,
          p_occupation: profile.occupation || null,
          p_education: profile.education || null,
          p_phone: profile.phone || null,
          p_email: profile.email || null,
          p_photo_url: profile.photo_url || null,
          p_social_media_links: profile.social_media_links,
          p_achievements: profile.achievements || null,
          p_timeline: profile.timeline || null,
          p_dob_is_public: profile.dob_is_public,
          p_profile_visibility: profile.profile_visibility,
          p_hid: profile.hid  // Pass HID explicitly
        });
        
        if (error) {
          errorCount++;
          errors.push({ profile: profile.id, error: error.message });
        } else {
          successCount++;
          // Map old ID to new ID for marriages
          profile.newId = result.id;
        }
      } catch (err) {
        errorCount++;
        errors.push({ profile: profile.id, error: err.message });
      }
    }
    
    console.log(`Progress: ${i + batch.length}/${data.profiles.length} profiles`);
  }
  
  console.log(`✅ Inserted ${successCount} profiles, ${errorCount} errors`);
  
  // Insert marriages
  console.log('\nInserting marriages...');
  let marriageSuccess = 0;
  let marriageError = 0;
  
  for (const marriage of data.marriages) {
    // Find new IDs using tempId
    const husband = data.profiles.find(p => p.tempId === marriage.husband_id);
    const wife = data.profiles.find(p => p.tempId === marriage.wife_id);
    
    if (husband?.newId && wife?.newId) {
      try {
        const { error } = await supabase.rpc('admin_create_marriage', {
          p_husband_id: husband.newId,
          p_wife_id: wife.newId,
          p_status: marriage.status,
          p_start_date: null, // Always null for mock data
          p_end_date: null
        });
        
        if (error) {
          marriageError++;
          errors.push({ marriage: marriage.id, error: error.message });
        } else {
          marriageSuccess++;
        }
      } catch (err) {
        marriageError++;
        errors.push({ marriage: marriage.id, error: err.message });
      }
    }
  }
  
  console.log(`✅ Inserted ${marriageSuccess} marriages, ${marriageError} errors`);
  
  // Print errors if any
  if (errors.length > 0) {
    console.log('\n❌ Errors encountered:');
    errors.slice(0, 10).forEach(err => {
      console.log(`- ${err.profile || err.marriage}: ${err.error}`);
    });
    if (errors.length > 10) {
      console.log(`... and ${errors.length - 10} more errors`);
    }
  }
  
  return { successCount, errorCount, marriageSuccess, marriageError };
}

// Main execution
async function main() {
  console.log('🚀 Alqefari Family Tree Mock Data Generator');
  console.log('==========================================\n');
  
  // Check for service role key
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY not found in .env');
    console.error('Please add your service role key to use admin functions.');
    process.exit(1);
  }
  
  // Generate data
  const generator = new FamilyTreeGenerator();
  const data = generator.generateFamilyTree();
  
  // Insert into Supabase
  const results = await insertData(data);
  
  // Final summary
  console.log('\n📊 Final Summary:');
  console.log('=================');
  console.log(`Total nodes generated: ${data.profiles.length}`);
  console.log(`Total marriages generated: ${data.marriages.length}`);
  console.log(`Profiles inserted: ${results.successCount}`);
  console.log(`Profile errors: ${results.errorCount}`);
  console.log(`Marriages inserted: ${results.marriageSuccess}`);
  console.log(`Marriage errors: ${results.marriageError}`);
  
  // Run validation dashboard
  console.log('\n🔍 Running validation dashboard...');
  try {
    const { data: validation, error } = await supabase.rpc('admin_validation_dashboard');
    if (error) {
      console.log('Could not run validation dashboard:', error.message);
    } else if (validation) {
      console.log('\nValidation Results:');
      validation.forEach(check => {
        const status = check.status === 'PASS' ? '✅' : '❌';
        console.log(`${status} ${check.check_name}: ${check.details || 'OK'}`);
      });
    }
  } catch (err) {
    console.log('Validation dashboard error:', err.message);
  }
  
  console.log('\n✨ Mock data generation complete!');
}

// Run the script
main().catch(console.error);