/**
 * Generate 2,392-profile test fixture matching production tree structure
 *
 * Purpose: Phase 2 Day 0 baseline performance measurement
 *
 * Structure:
 * - Root node (Generation 1)
 * - Realistic family patterns (siblings, children, marriages)
 * - Matches production distribution
 * - No orphans, valid relationships
 */

const fs = require('fs');
const path = require('path');

// Configuration matching production distribution
const CONFIG = {
  TARGET_PROFILES: 2392,
  AVG_CHILDREN_PER_MARRIAGE: 6.5, // Increased to reach target profile count
  AVG_SIBLINGS: 5.8,
  MARRIAGE_RATE: 0.75, // 75% of adults married (higher to build depth)
  GENERATIONS: 7, // Typical family tree depth
  PHOTO_RATE: 0.45, // 45% have photos
};

// Arabic names for realistic data
const MALE_NAMES = [
  'محمد', 'أحمد', 'عبدالله', 'عبدالرحمن', 'سعود', 'فهد', 'خالد', 'سلطان',
  'عبدالعزيز', 'تركي', 'فيصل', 'بندر', 'ناصر', 'سلمان', 'متعب', 'مشعل',
  'عبدالمحسن', 'فواز', 'ماجد', 'نايف', 'طلال', 'مساعد', 'منصور', 'عبيد'
];

const FEMALE_NAMES = [
  'فاطمة', 'عائشة', 'خديجة', 'مريم', 'زينب', 'سارة', 'نورة', 'هيا',
  'جواهر', 'لطيفة', 'منيرة', 'العنود', 'الجوهرة', 'ريم', 'غادة', 'لولوة',
  'عبير', 'أميرة', 'شهد', 'دانة', 'لمى', 'أسماء', 'رهف', 'بشاير'
];

const SURNAMES = [
  'القفاري', 'العتيبي', 'الدوسري', 'الشمري', 'القحطاني', 'العنزي',
  'الحربي', 'المطيري', 'الغامدي', 'الزهراني'
];

// Sample photo URLs (Unsplash portraits)
const PHOTO_URLS = [
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150',
];

// Utility functions
function randomChoice(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function generateHID(generation, index) {
  // Format: H001, H002, etc. (matching production pattern)
  const generationPrefix = String(generation).padStart(2, '0');
  const indexSuffix = String(index).padStart(3, '0');
  return `H${generationPrefix}${indexSuffix}`;
}

function generateName(gender) {
  const firstName = gender === 'male'
    ? randomChoice(MALE_NAMES)
    : randomChoice(FEMALE_NAMES);
  const fatherName = randomChoice(MALE_NAMES);
  const surname = randomChoice(SURNAMES);
  return `${firstName} بن ${fatherName} ${surname}`;
}

function generateProfile(generation, index, gender, fatherId = null, motherId = null) {
  const id = uuid();
  const hasPhoto = Math.random() < CONFIG.PHOTO_RATE;

  return {
    id,
    hid: generateHID(generation, index),
    name: generateName(gender),
    gender,
    father_id: fatherId,
    mother_id: motherId,
    status: generation <= 3 ? 'deceased' : (Math.random() < 0.15 ? 'deceased' : 'alive'),
    photo_url: hasPhoto ? randomChoice(PHOTO_URLS) : null,
    birth_year: 2024 - (generation * 25) - randomInt(0, 20), // Approximate birth year
    generation,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
    version: 1,

    // Additional fields (matching production schema)
    birth_location: null,
    death_year: generation <= 3 ? (2024 - randomInt(0, 30)) : null,
    death_location: null,
    occupation: null,
    education: null,
    notes: null,
    is_private: false,
    professional_title: null,
    title_abbreviation: null,
  };
}

function generateMarriage(husbandId, wifeId) {
  return {
    id: uuid(),
    husband_id: husbandId,
    wife_id: wifeId,
    start_date: `${randomInt(1950, 2020)}-01-01`,
    end_date: null,
    status: 'married',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
  };
}

function generateTree() {
  console.log('🌳 Generating 2,392-profile family tree...\n');

  const profiles = [];
  const marriages = [];
  let profileIndex = 0;

  // Generation 1: Root node (patriarch)
  console.log('📍 Generation 1: Creating root node');
  const root = generateProfile(1, profileIndex++, 'male');
  profiles.push(root);

  // Root spouse
  const rootSpouse = generateProfile(1, profileIndex++, 'female');
  profiles.push(rootSpouse);
  marriages.push(generateMarriage(root.id, rootSpouse.id));

  // Track parent couples for each generation
  let currentParents = [{ father: root, mother: rootSpouse }];

  // Generate subsequent generations
  for (let gen = 2; gen <= CONFIG.GENERATIONS; gen++) {
    console.log(`📍 Generation ${gen}: Creating children for ${currentParents.length} couples`);

    const nextGenParents = [];

    for (const couple of currentParents) {
      // Stop if we've reached target
      if (profiles.length >= CONFIG.TARGET_PROFILES) break;

      // Generate children for this couple
      const numChildren = Math.max(2, Math.min(10,
        Math.round(CONFIG.AVG_CHILDREN_PER_MARRIAGE + (Math.random() - 0.5) * 4)
      ));

      for (let i = 0; i < numChildren; i++) {
        if (profiles.length >= CONFIG.TARGET_PROFILES) break;

        // Alternate genders, with slight male preference (realistic)
        const gender = Math.random() < 0.52 ? 'male' : 'female';

        const child = generateProfile(
          gen,
          profileIndex++,
          gender,
          couple.father.id,
          couple.mother.id
        );
        profiles.push(child);

        // Create marriages for reproductive-age profiles
        // Start creating marriages from Gen 2 onwards to build tree depth
        if (gen >= 2 && gen <= 6 && Math.random() < CONFIG.MARRIAGE_RATE) {
          if (profiles.length >= CONFIG.TARGET_PROFILES - 1) break;

          // Create spouse (Munasib - external to tree, no HID)
          const spouseGender = gender === 'male' ? 'female' : 'male';
          const spouse = generateProfile(gen, profileIndex++, spouseGender);
          spouse.hid = null; // Munasib marker
          profiles.push(spouse);

          const marriage = gender === 'male'
            ? generateMarriage(child.id, spouse.id)
            : generateMarriage(spouse.id, child.id);
          marriages.push(marriage);

          // Add couple to next generation parents (always add to build depth)
          nextGenParents.push({
            father: gender === 'male' ? child : spouse,
            mother: gender === 'male' ? spouse : child,
          });
        }
      }
    }

    currentParents = nextGenParents;
    console.log(`  ✅ Generated ${profiles.length} profiles so far`);

    // Stop if we've reached target
    if (profiles.length >= CONFIG.TARGET_PROFILES) {
      console.log(`  🎯 Reached target profile count`);
      break;
    }
  }

  // Trim to exact target
  if (profiles.length > CONFIG.TARGET_PROFILES) {
    profiles.length = CONFIG.TARGET_PROFILES;
    console.log(`  ✂️  Trimmed to exactly ${CONFIG.TARGET_PROFILES} profiles`);
  }

  console.log('\n📊 Tree Statistics:');
  console.log(`  Total Profiles: ${profiles.length}`);
  console.log(`  Marriages: ${marriages.length}`);
  console.log(`  Males: ${profiles.filter(p => p.gender === 'male').length}`);
  console.log(`  Females: ${profiles.filter(p => p.gender === 'female').length}`);
  console.log(`  With Photos: ${profiles.filter(p => p.photo_url).length}`);
  console.log(`  Munasib (no HID): ${profiles.filter(p => p.hid === null).length}`);
  console.log(`  Deceased: ${profiles.filter(p => p.status === 'deceased').length}`);

  // Validation
  console.log('\n🔍 Validating tree structure...');

  const profileIds = new Set(profiles.map(p => p.id));
  const orphans = profiles.filter(p =>
    p.generation > 1 &&
    (p.father_id && !profileIds.has(p.father_id) ||
     p.mother_id && !profileIds.has(p.mother_id))
  );

  if (orphans.length > 0) {
    console.warn(`  ⚠️  Found ${orphans.length} orphans (invalid parent references)`);
  } else {
    console.log('  ✅ No orphans found');
  }

  const invalidMarriages = marriages.filter(m =>
    !profileIds.has(m.husband_id) || !profileIds.has(m.wife_id)
  );

  if (invalidMarriages.length > 0) {
    console.warn(`  ⚠️  Found ${invalidMarriages.length} invalid marriages`);
  } else {
    console.log('  ✅ All marriages valid');
  }

  return { profiles, marriages };
}

// Generate and save
function main() {
  const startTime = Date.now();

  const tree = generateTree();

  const outputPath = path.join(__dirname, 'tree2392.json');
  const output = {
    metadata: {
      generated_at: new Date().toISOString(),
      profile_count: tree.profiles.length,
      marriage_count: tree.marriages.length,
      purpose: 'Phase 2 Day 0 baseline performance measurement',
      version: '1.0.0',
    },
    profiles: tree.profiles,
    marriages: tree.marriages,
  };

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  const fileSize = (fs.statSync(outputPath).size / (1024 * 1024)).toFixed(2);

  console.log('\n✨ Generation complete!');
  console.log(`  File: ${outputPath}`);
  console.log(`  Size: ${fileSize}MB`);
  console.log(`  Duration: ${duration}s`);
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { generateTree, generateProfile, generateMarriage };
