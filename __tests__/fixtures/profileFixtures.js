/**
 * Profile Test Fixtures
 *
 * Factory functions for creating test profiles with realistic data.
 * Uses REAL database - these profiles will be created in the test database.
 */

/**
 * ProfileFixture - Factory for creating test profiles
 */
class ProfileFixture {
  constructor(supabaseAdmin) {
    this.supabaseAdmin = supabaseAdmin;
    this.createdProfiles = [];
  }

  /**
   * Generate unique HID for testing
   * Format: R[timestamp][random] - matches CHECK constraint ^[R]?\d+(\.\d+)*$
   */
  generateHID() {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    return `R${timestamp}${random}`;
  }

  /**
   * Create a basic profile
   * @param {Object} overrides - Override default profile data
   * @returns {Promise<Object>} Created profile
   */
  async createProfile(overrides = {}) {
    const defaultProfile = {
      hid: this.generateHID(),
      name: 'اسم تجريبي',
      gender: 'male',
      status: 'alive',
      generation: 1,
      version: 1,
      user_id: global.testAuthUserId || null, // Link to test auth user
      ...overrides,
    };

    const { data, error } = await this.supabaseAdmin
      .from('profiles')
      .insert(defaultProfile)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create profile: ${error.message}`);
    }

    this.createdProfiles.push(data.id);
    return data;
  }

  /**
   * Create profile with father relationship
   * @param {string} fatherId - Father's profile ID
   * @param {Object} overrides - Override default profile data
   * @returns {Promise<Object>} Created child profile
   */
  async createChild(fatherId, overrides = {}) {
    // Get father's generation to set child's generation properly
    const { data: father } = await this.supabaseAdmin
      .from('profiles')
      .select('generation')
      .eq('id', fatherId)
      .single();

    const childGeneration = father ? father.generation + 1 : 2;

    return this.createProfile({
      father_id: fatherId,
      generation: childGeneration,
      ...overrides,
    });
  }

  /**
   * Create a married couple (husband + wife)
   * @param {Object} husbandOverrides - Override husband data
   * @param {Object} wifeOverrides - Override wife data
   * @returns {Promise<{husband: Object, wife: Object}>}
   */
  async createMarriedCouple(husbandOverrides = {}, wifeOverrides = {}) {
    const husband = await this.createProfile({
      gender: 'male',
      ...husbandOverrides,
    });

    const wife = await this.createProfile({
      hid: null, // Munasib (spouse) has null HID
      gender: 'female',
      ...wifeOverrides,
    });

    // Create marriage relationship
    const { error: marriageError } = await this.supabaseAdmin
      .from('marriages')
      .insert({
        husband_id: husband.id,
        wife_id: wife.id,
        status: 'current',
      });

    if (marriageError) {
      throw new Error(`Failed to create marriage: ${marriageError.message}`);
    }

    // Update husband's wife_id
    await this.supabaseAdmin
      .from('profiles')
      .update({ wife_id: wife.id })
      .eq('id', husband.id);

    return { husband, wife };
  }

  /**
   * Create a family tree structure
   * @param {number} depth - Tree depth (generations)
   * @param {number} childrenPerGeneration - Children per parent
   * @returns {Promise<Object>} Root profile with nested children
   */
  async createFamilyTree(depth = 3, childrenPerGeneration = 2) {
    const createGeneration = async (parent, currentDepth) => {
      if (currentDepth >= depth) return parent;

      const children = [];
      for (let i = 0; i < childrenPerGeneration; i++) {
        const child = await this.createChild(parent.id, {
          name: `${parent.name} - طفل ${i + 1}`,
        });

        // Recursively create next generation
        children.push(await createGeneration(child, currentDepth + 1));
      }

      return { ...parent, children };
    };

    const root = await this.createProfile({
      name: 'جد الشجرة التجريبية',
    });

    return createGeneration(root, 0);
  }

  /**
   * Create profile with specific role
   * @param {'super_admin'|'admin'|'moderator'|'user'} role - User role
   * @param {Object} overrides - Override default profile data
   * @returns {Promise<Object>} Created profile with role
   */
  async createProfileWithRole(role = 'user', overrides = {}) {
    const profile = await this.createProfile(overrides);

    // Update role
    await this.supabaseAdmin
      .from('profiles')
      .update({ role })
      .eq('id', profile.id);

    return { ...profile, role };
  }

  /**
   * Create admin profile
   */
  async createAdminProfile(overrides = {}) {
    return this.createProfileWithRole('admin', {
      name: 'مسؤول تجريبي',
      ...overrides,
    });
  }

  /**
   * Create super admin profile
   */
  async createSuperAdminProfile(overrides = {}) {
    return this.createProfileWithRole('super_admin', {
      name: 'مسؤول رئيسي تجريبي',
      ...overrides,
    });
  }

  /**
   * Create moderator profile with assigned branch
   */
  async createModeratorProfile(branchRootId, overrides = {}) {
    const moderator = await this.createProfileWithRole('moderator', {
      name: 'مشرف فرع تجريبي',
      ...overrides,
    });

    // Assign moderator to branch
    await this.supabaseAdmin
      .from('profiles')
      .update({ moderator_branch_id: branchRootId })
      .eq('id', moderator.id);

    return { ...moderator, moderator_branch_id: branchRootId };
  }

  /**
   * Create siblings (same father)
   * @param {string} fatherId - Father's profile ID
   * @param {number} count - Number of siblings
   * @returns {Promise<Array>} Array of sibling profiles
   */
  async createSiblings(fatherId, count = 3) {
    const siblings = [];
    for (let i = 0; i < count; i++) {
      const sibling = await this.createChild(fatherId, {
        name: `شقيق ${i + 1}`,
      });
      siblings.push(sibling);
    }
    return siblings;
  }

  /**
   * Create profile with specific version (for optimistic locking tests)
   */
  async createProfileWithVersion(version, overrides = {}) {
    const profile = await this.createProfile(overrides);

    await this.supabaseAdmin
      .from('profiles')
      .update({ version })
      .eq('id', profile.id);

    return { ...profile, version };
  }

  /**
   * Cleanup all created profiles
   */
  async cleanup() {
    if (this.createdProfiles.length === 0) return;

    // Delete in reverse order (children before parents)
    const { error } = await this.supabaseAdmin
      .from('profiles')
      .delete()
      .in('id', this.createdProfiles);

    if (error && error.code !== 'PGRST116') {
      console.error('⚠️  Profile cleanup failed:', error.message);
    }

    this.createdProfiles = [];
  }

  /**
   * Get all created profile IDs
   */
  getCreatedIds() {
    return [...this.createdProfiles];
  }
}

module.exports = { ProfileFixture };
