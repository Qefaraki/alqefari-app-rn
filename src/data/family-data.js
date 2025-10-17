// This is our temporary, local stand-in for the Supabase database.
// Note: The `parent_id` here is the HIERARCHICAL ID of the parent.
// We will process this in the app to link by the true UUID `id`.

export const rawFamilyData = [
  { id: "uuid-1", hid: "1", first_name: "سليمان", parent_id: null, gender: "Male" },
  { id: "uuid-1.1", hid: "1.1", first_name: "عبدالعزيز", parent_id: "1", gender: "Male" },
  { id: "uuid-1.2", hid: "1.2", first_name: "سعداء", parent_id: "1", gender: "Female" },
  { id: "uuid-1.3", hid: "1.3", first_name: "لطيفة", parent_id: "1", gender: "Female" },
  { id: "uuid-1.4", hid: "1.4", first_name: "جربوع", parent_id: "1", gender: "Male" },
  { id: "uuid-1.4.1", hid: "1.4.1", first_name: "صالح", parent_id: "1.4", gender: "Male" },
  { id: "uuid-1.4.1.1", hid: "1.4.1.1", first_name: "عبدالله", parent_id: "1.4.1", gender: "Male" },
  { id: "uuid-1.4.1.1.1", hid: "1.4.1.1.1", first_name: "سليمان", parent_id: "1.4.1.1", gender: "Male" },
  { id: "uuid-1.4.1.1.1.1", hid: "1.4.1.1.1.1", first_name: "شهد", parent_id: "1.4.1.1.1", gender: "Female" },
  { id: "uuid-1.4.1.2", hid: "1.4.1.2", first_name: "لولوة", parent_id: "1.4.1", gender: "Female" },
  { id: "uuid-1.4.1.2.1", hid: "1.4.1.2.1", first_name: "منيرة", parent_id: "1.4.1.2", gender: "Female" },
  { id: "uuid-1.4.1.2.2", hid: "1.4.1.2.2", first_name: "عبدالله", parent_id: "1.4.1.2", gender: "Male" },
  { id: "uuid-1.4.1.2.3", hid: "1.4.1.2.3", first_name: "صالح", parent_id: "1.4.1.2", gender: "Male" },
  { id: "uuid-1.4.1.3", hid: "1.4.1.3", first_name: "هيلة", parent_id: "1.4.1", gender: "Female" },
  { id: "uuid-1.4.1.4", hid: "1.4.1.4", first_name: "علي", parent_id: "1.4.1", gender: "Male" },
  { id: "uuid-1.4.1.5", hid: "1.4.1.5", first_name: "نورة", parent_id: "1.4.1", gender: "Female" },
  { id: "uuid-1.4.1.5.1", hid: "1.4.1.5.1", first_name: "منيرة", parent_id: "1.4.1.5", gender: "Female" },
  { id: "uuid-1.4.1.5.2", hid: "1.4.1.5.2", first_name: "عبدالله", parent_id: "1.4.1.5", gender: "Male" },
  { id: "uuid-1.4.1.5.2.1", hid: "1.4.1.5.2.1", first_name: "مزنة", parent_id: "1.4.1.5.2", gender: "Female" },
  { id: "uuid-1.4.1.5.2.2", hid: "1.4.1.5.2.2", first_name: "مها", parent_id: "1.4.1.5.2", gender: "Female" },
  { id: "uuid-1.4.1.5.2.3", hid: "1.4.1.5.2.3", first_name: "أسماء", parent_id: "1.4.1.5.2", gender: "Female" },
  { id: "uuid-1.4.1.5.2.4", hid: "1.4.1.5.2.4", first_name: "حسن", parent_id: "1.4.1.5.2", gender: "Male" },
  { id: "uuid-1.4.1.5.3", hid: "1.4.1.5.3", first_name: "صالح", parent_id: "1.4.1.5", gender: "Male" },
  { id: "uuid-1.4.1.5.3.1", hid: "1.4.1.5.3.1", first_name: "رنا", parent_id: "1.4.1.5.3", gender: "Female" },
  { id: "uuid-1.4.1.5.3.2", hid: "1.4.1.5.3.2", first_name: "علي", parent_id: "1.4.1.5.3", gender: "Male" },
  { id: "uuid-1.4.1.5.3.3", hid: "1.4.1.5.3.3", first_name: "عبدالله", parent_id: "1.4.1.5.3", gender: "Male" },
  { id: "uuid-1.4.1.5.3.4", hid: "1.4.1.5.3.4", first_name: "عمر", parent_id: "1.4.1.5.3", gender: "Male" },
  { id: "uuid-1.4.1.5.3.5", hid: "1.4.1.5.3.5", first_name: "ريم", parent_id: "1.4.1.5.3", gender: "Female" },
  { id: "uuid-1.4.1.5.3.6", hid: "1.4.1.5.3.6", first_name: "عادل", parent_id: "1.4.1.5.3", gender: "Male" },
  { id: "uuid-1.4.1.5.4", hid: "1.4.1.5.4", first_name: "فهد", parent_id: "1.4.1.5", gender: "Male" },
  { id: "uuid-1.4.1.5.5", hid: "1.4.1.5.5", first_name: "محمد", parent_id: "1.4.1.5", gender: "Male" },
  { id: "uuid-1.4.1.5.5.1", hid: "1.4.1.5.5.1", first_name: "سحر", parent_id: "1.4.1.5.5", gender: "Female" },
  { id: "uuid-1.4.1.5.5.2", hid: "1.4.1.5.5.2", first_name: "طارق", parent_id: "1.4.1.5.5", gender: "Male" },
  { id: "uuid-1.4.1.5.5.3", hid: "1.4.1.5.5.3", first_name: "علي", parent_id: "1.4.1.5.5", gender: "Male" },
  { id: "uuid-1.4.1.5.5.4", hid: "1.4.1.5.5.4", first_name: "أحمد", parent_id: "1.4.1.5.5", gender: "Male" },
  { id: "uuid-1.4.1.5.5.5", hid: "1.4.1.5.5.5", first_name: "فراس", parent_id: "1.4.1.5.5", gender: "Male" },
  { id: "uuid-1.4.1.5.6", hid: "1.4.1.5.6", first_name: "حصة", parent_id: "1.4.1.5", gender: "Female" },
  { id: "uuid-1.4.1.5.7", hid: "1.4.1.5.7", first_name: "نورة", parent_id: "1.4.1.5", gender: "Female" },
  { id: "uuid-1.4.1.5.8", hid: "1.4.1.5.8", first_name: "خلود", parent_id: "1.4.1.5", gender: "Female" },
  { id: "uuid-1.4.1.6", hid: "1.4.1.6", first_name: "لطيفة", parent_id: "1.4.1", gender: "Female" },
  { id: "uuid-1.4.1.7", hid: "1.4.1.7", first_name: "سليمان", parent_id: "1.4.1", gender: "Male" },
  { id: "uuid-1.4.1.7.1", hid: "1.4.1.7.1", first_name: "صالح", parent_id: "1.4.1.7", gender: "Male" },
  { id: "uuid-1.4.1.7.2", hid: "1.4.1.7.2", first_name: "نورة", parent_id: "1.4.1.7", gender: "Female" },
  { id: "uuid-1.4.1.8", hid: "1.4.1.8", first_name: "موضي", parent_id: "1.4.1", gender: "Female" },
  { id: "uuid-1.4.1.8.1", hid: "1.4.1.8.1", first_name: "صالح", parent_id: "1.4.1.8", gender: "Male" },
  { id: "uuid-1.4.1.8.2", hid: "1.4.1.8.2", first_name: "نورة", parent_id: "1.4.1.8", gender: "Female" },
  { id: "uuid-1.4.1.8.3", hid: "1.4.1.8.3", first_name: "عبدالله", parent_id: "1.4.1.8", gender: "Male" },
  { id: "uuid-1.4.1.8.4", hid: "1.4.1.8.4", first_name: "فهد", parent_id: "1.4.1.8", gender: "Male" },
  { id: "uuid-1.4.2", hid: "1.4.2", first_name: "علي", parent_id: "1.4", gender: "Male" },
  { id: "uuid-1.4.3", hid: "1.4.3", first_name: "محمد", parent_id: "1.4", gender: "Male" },
  { id: "uuid-1.4.3.1", hid: "1.4.3.1", first_name: "هيلة", parent_id: "1.4.3", gender: "Female" },
  { id: "uuid-1.4.3.2", hid: "1.4.3.2", first_name: "عبدالعزيز", parent_id: "1.4.3", gender: "Male" },
  { id: "uuid-1.4.3.3", hid: "1.4.3.3", first_name: "لولوة", parent_id: "1.4.3", gender: "Female" },
  { id: "uuid-1.4.3.4", hid: "1.4.3.4", first_name: "نورة", parent_id: "1.4.3", gender: "Female" },
  { id: "uuid-1.4.3.5", hid: "1.4.3.5", first_name: "منيرة", parent_id: "1.4.3", gender: "Female" },
  { id: "uuid-1.4.3.6", hid: "1.4.3.6", first_name: "سليمان", parent_id: "1.4.3", gender: "Male" },
  { id: "uuid-1.4.3.7", hid: "1.4.3.7", first_name: "صالح", parent_id: "1.4.3", gender: "Male" },
  { id: "uuid-1.4.3.8", hid: "1.4.3.8", first_name: "جربوع", parent_id: "1.4.3", gender: "Male" },
  { id: "uuid-1.4.3.9", hid: "1.4.3.9", first_name: "لطيفة", parent_id: "1.4.3", gender: "Female" },
];

// Global family name constant
export const FAMILY_NAME = "القفاري";

// Text measurement utility - measures text width for dynamic node sizing
function measureTextWidth(text, fontSize = 11) {
  // Fixed width per character for consistent results
  const normalized = String(text || "");
  let totalWidth = 0;
  
  for (const ch of normalized) {
    if (ch === ' ') {
      totalWidth += 2; // spaces
    } else if (/[A-Za-z0-9]/.test(ch)) {
      totalWidth += 4; // latin characters and numbers
    } else {
      totalWidth += 5.5; // arabic and other characters
    }
  }
  
  return Math.ceil(totalWidth);
}

// Mock data generator for realistic profiles
function generateMockData(personId, generation) {
  // Define profile completeness levels
  const fullProfiles = ["uuid-1", "uuid-1.4.1", "uuid-1.4.1.5"];
  const mediumProfiles = [
    "uuid-1.4", "uuid-1.4.1.1", "uuid-1.4.1.5.2", "uuid-1.4.1.5.3",
    "uuid-1.4.3", "uuid-1.4.1.7", "uuid-1.4.1.8"
  ];
  const minimalProfiles = [
    "uuid-1.1", "uuid-1.2", "uuid-1.3", "uuid-1.4.1.2", "uuid-1.4.1.3",
    "uuid-1.4.1.4", "uuid-1.4.1.5.1", "uuid-1.4.1.5.4", "uuid-1.4.1.5.5",
    "uuid-1.4.1.5.6", "uuid-1.4.1.5.7", "uuid-1.4.2", "uuid-1.4.3.1"
  ];
  
  // Full profile
  if (fullProfiles.includes(personId)) {
    const profiles = {
      "uuid-1": {
        dob_data: {
          hijri: { year: 1320, month: 5, day: 12 },
          display: "1320/5/12هـ"
        },
        dod_data: {
          hijri: { year: 1395, month: 8, day: 23 },
          display: "1395/8/23هـ"
        },
        birth_place: "الرياض",
        death_place: "الرياض",
        occupation: "تاجر",
        education: "التعليم التقليدي - الكتاتيب",
        bio: "مؤسس عائلة القفاري في منطقة الرياض. بدأ حياته في التجارة وأسس عدة أعمال ناجحة. عُرف بكرمه وحسن معاملته. ساهم في بناء عدة مساجد ومدارس في المنطقة.",
        achievements: [
          "تأسيس أول متجر للعائلة عام 1345هـ",
          "المساهمة في بناء مسجد الحي عام 1360هـ",
          "رئيس لجنة إصلاح ذات البين في الحي"
        ],
        timeline: [
          { year: "1320", event: "الولادة في الرياض" },
          { year: "1340", event: "بداية العمل في التجارة" },
          { year: "1345", event: "الزواج الأول" },
          { year: "1348", event: "ولادة أول أبنائه عبدالعزيز" },
          { year: "1360", event: "افتتاح المتجر الثاني" },
          { year: "1395", event: "الوفاة رحمه الله" }
        ],
        social_media_links: {}
      },
      "uuid-1.4.1": {
        dob_data: {
          hijri: { year: 1355, month: 11, day: 3 },
          display: "1355/11/3هـ"
        },
        birth_place: "الرياض",
        current_residence: "الرياض",
        occupation: "موظف متقاعد",
        education: "بكالوريوس محاسبة - جامعة الملك سعود",
        bio: "عمل في وزارة المالية لأكثر من 35 عامًا. شارك في تطوير العديد من الأنظمة المالية. بعد التقاعد، تفرغ للأعمال الخيرية والاجتماعية.",
        achievements: [
          "وسام الملك عبدالعزيز من الدرجة الثالثة",
          "رئيس جمعية البر الخيرية بالحي",
          "عضو مؤسس في صندوق العائلة"
        ],
        timeline: [
          { year: "1355", event: "الولادة" },
          { year: "1378", event: "التخرج من الجامعة" },
          { year: "1379", event: "بداية العمل في وزارة المالية" },
          { year: "1380", event: "الزواج" },
          { year: "1415", event: "التقاعد من العمل الحكومي" }
        ],
        social_media_links: {}
      },
      "uuid-1.4.1.5": {
        dob_data: {
          hijri: { year: 1382, month: 7, day: 21 },
          display: "1382/7/21هـ"
        },
        birth_place: "الرياض",
        current_residence: "جدة",
        occupation: "طبيبة أطفال",
        education: "بكالوريوس طب - جامعة الملك عبدالعزيز، البورد السعودي في طب الأطفال",
        bio: "من أوائل الطبيبات في العائلة. تخرجت بامتياز وتخصصت في طب الأطفال. تعمل حاليًا كاستشارية في مستشفى الملك فيصل التخصصي. لها أبحاث منشورة في مجال طب الأطفال حديثي الولادة.",
        achievements: [
          "جائزة التميز في البحث العلمي 1425هـ",
          "عضو الجمعية السعودية لطب الأطفال",
          "محاضرة في عدة مؤتمرات طبية دولية"
        ],
        social_media_links: {
          twitter: "https://twitter.com/dr_norah_alqefari",
          linkedin: "https://linkedin.com/in/dr-norah-alqefari"
        }
      }
    };
    return profiles[personId] || {};
  }
  
  // Medium profile
  if (mediumProfiles.includes(personId)) {
    const profiles = {
      "uuid-1.4": {
        dob_data: {
          hijri: { year: 1350, month: 2, day: 14 },
          display: "1350/2/14هـ"
        },
        dod_data: {
          hijri: { year: 1420, month: 6, day: 10 },
          display: "1420/6/10هـ"
        },
        occupation: "مزارع",
        birth_place: "الرياض",
        bio: "عمل في الزراعة وتربية المواشي. كان له مزرعة كبيرة في شمال الرياض.",
        social_media_links: {}
      },
      "uuid-1.4.1.1": {
        dob_data: {
          hijri: { year: 1380, month: 9, day: 5 },
          display: "1380/9/5هـ"
        },
        occupation: "مهندس مدني",
        education: "بكالوريوس هندسة مدنية",
        current_residence: "الدمام",
        social_media_links: {}
      },
      "uuid-1.4.1.5.2": {
        dob_data: {
          hijri: { year: 1405, month: 3, day: 18 },
          display: "1405/3/18هـ"
        },
        occupation: "معلم",
        current_residence: "الرياض",
        education: "بكالوريوس تربية",
        timeline: [
          { year: "1405", event: "الولادة" },
          { year: "1428", event: "التخرج من الجامعة" },
          { year: "1430", event: "الزواج" }
        ],
        social_media_links: {}
      },
      "uuid-1.4.3": {
        dob_data: {
          hijri: { year: 1358, month: 12, day: 1 },
          display: "1358/12/1هـ"
        },
        dod_data: {
          hijri: { year: 1430, month: 11, day: 15 },
          display: "1430/11/15هـ"
        },
        occupation: "رجل أعمال",
        achievements: ["تأسيس شركة للمقاولات"],
        social_media_links: {}
      }
    };
    return profiles[personId] || {
      dob_data: {
        hijri: { year: 1380 + Math.floor(Math.random() * 30) },
        display: `${1380 + Math.floor(Math.random() * 30)}هـ`
      },
      occupation: ["موظف", "معلم", "تاجر", "مهندس"][Math.floor(Math.random() * 4)],
      current_residence: ["الرياض", "جدة", "الدمام"][Math.floor(Math.random() * 3)],
      social_media_links: {}
    };
  }
  
  // Minimal profile
  if (minimalProfiles.includes(personId)) {
    const profiles = {
      "uuid-1.1": {
        dob_data: {
          hijri: { year: 1348 },
          display: "1348هـ"
        },
        dod_data: {
          hijri: { year: 1425 },
          display: "1425هـ"
        },
        social_media_links: {}
      },
      "uuid-1.2": {
        dob_data: {
          hijri: { year: 1351 },
          display: "1351هـ"
        },
        social_media_links: {}
      },
      "uuid-1.4.1.2": {
        dob_data: {
          hijri: { year: 1383, month: 5 },
          display: "1383/5هـ"
        },
        occupation: "ربة منزل",
        social_media_links: {}
      },
      "uuid-1.4.1.5.1": {
        dob_data: {
          hijri: { year: 1409 },
          display: "1409هـ"
        },
        social_media_links: {}
      }
    };
    return profiles[personId] || {
      dob_data: {
        hijri: { year: generation <= 3 ? 1350 + Math.floor(Math.random() * 30) : 1400 + Math.floor(Math.random() * 20) },
        display: `${generation <= 3 ? 1350 + Math.floor(Math.random() * 30) : 1400 + Math.floor(Math.random() * 20)}هـ`
      },
      social_media_links: {}
    };
  }
  
  // Empty profile - return empty object with required fields
  return {
    social_media_links: {}
  };
}

// Process raw data to convert parent_id (HID) to father_id (UUID)
function processRawData(rawData) {
  // Step 1: Create HID to UUID mapping
  const hidToId = {};
  rawData.forEach(person => {
    hidToId[person.hid] = person.id;
  });
  
  // Step 2: Process each person
  const processedData = rawData.map(person => {
    // Calculate generation from HID (count dots + 1)
    const generation = person.hid.split('.').length;
    
    // Determine if has photo
    const hasPhoto = [
      "uuid-1", "uuid-1.4.1", "uuid-1.4.1.1", "uuid-1.4.1.5", "uuid-1.4.1.5.2"
    ].includes(person.id);
    
    // Calculate dynamic node width based on text
    let nodeWidth;
    if (hasPhoto) {
      nodeWidth = 85; // Fixed width for photo nodes
    } else {
      // Measure text width and add uniform padding
      const textWidth = measureTextWidth(person.first_name);
      const padding = 12; // uniform padding on each side
      const totalPadding = padding * 2;
      const minWidth = 48; // Minimum width for very short names
      nodeWidth = Math.max(minWidth, textWidth + totalPadding);
    }
    
    // Get mock biographical data
    const mockData = generateMockData(person.id, generation);
    
    return {
      id: person.id,
      hid: person.hid,
      name: person.first_name, // Rename first_name to name
      father_id: person.parent_id ? hidToId[person.parent_id] : null,
      mother_id: null, // Keep for compatibility
      gender: person.gender.toLowerCase(),
      generation: generation,
      nodeWidth: nodeWidth, // Dynamic width for layout
      photo_url: hasPhoto ? 
        "https://media.licdn.com/dms/image/v2/D4D03AQGk0fY69MOaIQ/profile-displayphoto-shrink_200_200/profile-displayphoto-shrink_200_200/0/1726000268952?e=2147483647&v=beta&t=z8yclDtIu6X3cWMmK5NySGFj77DOGPP4gHuVGH9Ezwk" : 
        null,
      status: 'alive', // Default status
      dob_is_public: true, // Default privacy
      social_media_links: {}, // Default empty
      // Add all mock data fields, ensure proper field names
      ...mockData
    };
  });
  
  return processedData;
}

// Export processed family data
export const familyData = processRawData(rawFamilyData);

// Utility function to build full name by traversing up the tree
export function buildFullName(personId, familyDataArray, includeFamily = false) {
  // Create a map for efficient lookups
  const familyMap = new Map();
  familyDataArray.forEach(person => familyMap.set(person.id, person));
  
  const names = [];
  let currentId = personId;
  
  while (currentId) {
    const person = familyMap.get(currentId);
    if (!person) break;
    names.unshift(person.name);
    currentId = person.father_id;
  }
  
  if (includeFamily && names.length > 0) {
    names.push(FAMILY_NAME);
  }
  
  return names.join(' ');
}

// Utility to get a person's father
export function getFather(personId, familyDataArray) {
  const person = familyDataArray.find(p => p.id === personId);
  if (!person || !person.father_id) return null;
  return familyDataArray.find(p => p.id === person.father_id);
}

// Utility to get a person's children (deduplicated for cousin marriages)
/**
 * @deprecated Prefer gender-based filtering for better performance
 * @param {string} personId - The person's ID
 * @param {Array} familyDataArray - Array of family profiles
 * @returns {Array} Deduplicated array of children
 */
export function getChildren(personId, familyDataArray) {
  const seen = new Set();
  return familyDataArray.filter(p => {
    if ((p.father_id === personId || p.mother_id === personId) && !seen.has(p.id)) {
      seen.add(p.id);
      return true;
    }
    return false;
  });
}