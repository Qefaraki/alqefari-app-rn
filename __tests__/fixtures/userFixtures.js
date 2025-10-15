/**
 * User Test Fixtures
 *
 * Factory functions for creating test users with different roles and permissions.
 */

const { ProfileFixture } = require('./profileFixtures.js');

/**
 * UserFixture - Factory for creating test users with auth + profile
 */
class UserFixture {
  constructor(supabaseAdmin) {
    this.supabaseAdmin = supabaseAdmin;
    this.profileFixture = new ProfileFixture(supabaseAdmin);
    this.createdUsers = [];
  }

  /**
   * Create user profile with specific role
   * @param {'super_admin'|'admin'|'moderator'|'user'} role
   * @param {Object} profileOverrides
   * @returns {Promise<Object>} User profile
   */
  async createUserWithRole(role = 'user', profileOverrides = {}) {
    const profile = await this.profileFixture.createProfileWithRole(role, profileOverrides);
    this.createdUsers.push(profile.id);
    return profile;
  }

  /**
   * Create super admin user
   */
  async createSuperAdmin(overrides = {}) {
    return this.createUserWithRole('super_admin', {
      name: 'مسؤول رئيسي',
      ...overrides,
    });
  }

  /**
   * Create admin user
   */
  async createAdmin(overrides = {}) {
    return this.createUserWithRole('admin', {
      name: 'مسؤول',
      ...overrides,
    });
  }

  /**
   * Create moderator user with assigned branch
   */
  async createModerator(branchRootId, overrides = {}) {
    const moderator = await this.createUserWithRole('moderator', {
      name: 'مشرف فرع',
      ...overrides,
    });

    await this.supabaseAdmin
      .from('profiles')
      .update({ moderator_branch_id: branchRootId })
      .eq('id', moderator.id);

    return { ...moderator, moderator_branch_id: branchRootId };
  }

  /**
   * Create regular user
   */
  async createRegularUser(overrides = {}) {
    return this.createUserWithRole('user', {
      name: 'مستخدم عادي',
      ...overrides,
    });
  }

  /**
   * Create blocked user
   */
  async createBlockedUser(overrides = {}) {
    const user = await this.createRegularUser(overrides);

    await this.supabaseAdmin
      .from('profiles')
      .update({ is_blocked: true })
      .eq('id', user.id);

    return { ...user, is_blocked: true };
  }

  /**
   * Create family members with relationships
   * Returns: { father, mother, child, sibling, cousin }
   */
  async createFamilyWithRelationships() {
    // Grandfather (for creating cousins)
    const grandfather = await this.profileFixture.createProfile({
      name: 'الجد',
    });

    // Father
    const father = await this.profileFixture.createChild(grandfather.id, {
      name: 'الأب',
    });

    // Uncle (father's brother, for cousin relationship)
    const uncle = await this.profileFixture.createChild(grandfather.id, {
      name: 'العم',
    });

    // Create married couple (father + mother)
    const { wife: mother } = await this.profileFixture.createMarriedCouple(
      { id: father.id },
      { name: 'الأم' }
    );

    // Update father with wife_id
    await this.supabaseAdmin
      .from('profiles')
      .update({ wife_id: mother.id })
      .eq('id', father.id);

    // Child (son/daughter of father + mother)
    const child = await this.profileFixture.createChild(father.id, {
      name: 'الابن',
      mother_id: mother.id,
    });

    // Sibling (another child of same father)
    const sibling = await this.profileFixture.createChild(father.id, {
      name: 'الشقيق',
      mother_id: mother.id,
    });

    // Cousin (uncle's child)
    const cousin = await this.profileFixture.createChild(uncle.id, {
      name: 'ابن العم',
    });

    return {
      grandfather,
      father,
      mother,
      uncle,
      child,
      sibling,
      cousin,
    };
  }

  /**
   * Create extended family for permission testing
   * Returns users with different permission levels relative to a target user
   */
  async createPermissionTestFamily() {
    const family = await this.createFamilyWithRelationships();

    // Create admin
    const admin = await this.createAdmin();

    // Create moderator assigned to grandfather's branch
    const moderator = await this.createModerator(family.grandfather.id);

    // Create blocked user
    const blockedUser = await this.createBlockedUser();

    return {
      ...family,
      admin,
      moderator,
      blockedUser,
    };
  }

  /**
   * Create users with different versions (for optimistic locking tests)
   */
  async createUsersWithVersions() {
    const v1User = await this.profileFixture.createProfileWithVersion(1, {
      name: 'مستخدم إصدار 1',
    });

    const v5User = await this.profileFixture.createProfileWithVersion(5, {
      name: 'مستخدم إصدار 5',
    });

    const v10User = await this.profileFixture.createProfileWithVersion(10, {
      name: 'مستخدم إصدار 10',
    });

    return { v1User, v5User, v10User };
  }

  /**
   * Get user's permission level for a target profile
   */
  async getPermissionLevel(userId, targetId) {
    const { data, error } = await this.supabaseAdmin.rpc('check_family_permission_v4', {
      p_user_id: userId,
      p_target_id: targetId,
    });

    if (error) {
      throw new Error(`Permission check failed: ${error.message}`);
    }

    return data;
  }

  /**
   * Cleanup all created users
   */
  async cleanup() {
    await this.profileFixture.cleanup();
    this.createdUsers = [];
  }

  /**
   * Get all created user IDs
   */
  getCreatedIds() {
    return [...this.createdUsers];
  }
}

module.exports = { UserFixture };
