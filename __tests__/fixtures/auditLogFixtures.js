/**
 * Audit Log Test Fixtures
 *
 * Factory functions for creating audit log entries for testing undo functionality.
 */

/**
 * AuditLogFixture - Factory for creating test audit log entries
 */
class AuditLogFixture {
  constructor(supabaseAdmin) {
    this.supabaseAdmin = supabaseAdmin;
    this.createdAuditLogs = [];
  }

  /**
   * Create basic audit log entry
   * @param {Object} params - Audit log parameters
   * @returns {Promise<Object>} Created audit log entry
   */
  async createAuditLog({
    action_type,
    profile_id,
    actor_id = null,
    old_data = null,
    new_data = null,
    batch_id = null,
    operation_group_id = null,
  }) {
    // Use global test auth user if no actor_id provided
    const effectiveActorId = actor_id || global.testAuthUserId;

    if (!effectiveActorId) {
      throw new Error('No actor_id provided and global.testAuthUserId not set');
    }

    const { data, error } = await this.supabaseAdmin
      .from('audit_log_enhanced')
      .insert({
        action_type,
        table_name: 'profiles',
        record_id: profile_id, // audit_log_enhanced uses record_id
        actor_id: effectiveActorId,
        actor_type: 'user',
        old_data,
        new_data,
        operation_group_id,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create audit log: ${error.message}`);
    }

    this.createdAuditLogs.push(data.id);
    return data;
  }

  /**
   * Create audit log for profile update
   * Actor ID automatically uses global.testAuthUserId
   */
  async createProfileUpdateLog(profileId, oldData, newData) {
    return this.createAuditLog({
      action_type: 'profile_update',
      profile_id: profileId,
      actor_id: null, // Will default to global.testAuthUserId in createAuditLog
      old_data: oldData,
      new_data: newData,
    });
  }

  /**
   * Create audit log for profile soft delete
   * Actor ID automatically uses global.testAuthUserId
   */
  async createProfileDeleteLog(profileId, oldData) {
    return this.createAuditLog({
      action_type: 'profile_soft_delete',
      profile_id: profileId,
      actor_id: null, // Will default to global.testAuthUserId in createAuditLog
      old_data: oldData,
      new_data: { deleted_at: new Date().toISOString() },
    });
  }

  /**
   * Create audit log for cascade delete (with batch_id)
   * Actor ID automatically uses global.testAuthUserId
   */
  async createCascadeDeleteLog(profileId, batchId, oldData) {
    return this.createAuditLog({
      action_type: 'profile_cascade_delete',
      profile_id: profileId,
      actor_id: null, // Will default to global.testAuthUserId in createAuditLog
      old_data: oldData,
      new_data: { deleted_at: new Date().toISOString() },
      batch_id: batchId,
    });
  }

  /**
   * Create audit log for marriage creation
   * Actor ID automatically uses global.testAuthUserId
   */
  async createMarriageCreateLog(husbandId, marriageData) {
    return this.createAuditLog({
      action_type: 'add_marriage',
      profile_id: husbandId,
      actor_id: null, // Will default to global.testAuthUserId in createAuditLog
      old_data: null,
      new_data: marriageData,
    });
  }

  /**
   * Create audit log for admin update
   * Actor ID automatically uses global.testAuthUserId
   */
  async createAdminUpdateLog(profileId, oldData, newData) {
    return this.createAuditLog({
      action_type: 'admin_update',
      profile_id: profileId,
      actor_id: null, // Will default to global.testAuthUserId in createAuditLog
      old_data: oldData,
      new_data: newData,
    });
  }

  /**
   * Create already-undone audit log
   * Actor ID automatically uses global.testAuthUserId
   */
  async createUndoneAuditLog(actionType, profileId, oldData) {
    const effectiveActorId = global.testAuthUserId;

    const auditLog = await this.createAuditLog({
      action_type: actionType,
      profile_id: profileId,
      actor_id: null, // Will default to global.testAuthUserId in createAuditLog
      old_data: oldData,
      new_data: {},
    });

    // Mark as undone
    await this.supabaseAdmin
      .from('audit_log_enhanced')
      .update({
        undone_at: new Date().toISOString(),
        undone_by: effectiveActorId,
        undo_reason: 'تم التراجع للتجربة',
      })
      .eq('id', auditLog.id);

    return { ...auditLog, undone_at: new Date().toISOString() };
  }

  /**
   * Create old audit log (beyond time limit)
   * @param {number} daysOld - How many days old
   * Actor ID automatically uses global.testAuthUserId
   */
  async createOldAuditLog(actionType, profileId, daysOld = 31) {
    const auditLog = await this.createAuditLog({
      action_type: actionType,
      profile_id: profileId,
      actor_id: null, // Will default to global.testAuthUserId in createAuditLog
      old_data: { name: 'قديم' },
      new_data: { name: 'جديد' },
    });

    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - daysOld);

    // Update created_at to simulate old entry
    await this.supabaseAdmin
      .from('audit_log_enhanced')
      .update({ created_at: oldDate.toISOString() })
      .eq('id', auditLog.id);

    return { ...auditLog, created_at: oldDate.toISOString() };
  }

  /**
   * Create operation group for batch operations
   * Created by automatically uses global.testAuthUserId
   */
  async createOperationGroup(description = 'مجموعة عمليات تجريبية') {
    const effectiveCreatedBy = global.testAuthUserId;

    if (!effectiveCreatedBy) {
      throw new Error('global.testAuthUserId not set');
    }

    const { data, error } = await this.supabaseAdmin
      .from('operation_groups')
      .insert({
        description,
        created_by: effectiveCreatedBy,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create operation group: ${error.message}`);
    }

    return data;
  }

  /**
   * Create batch of audit logs for cascade delete
   * Actor ID automatically uses global.testAuthUserId
   */
  async createCascadeDeleteBatch(profiles) {
    const batchId = `CASCADE-${Date.now()}`;
    const operationGroup = await this.createOperationGroup('حذف متسلسل تجريبي');

    const auditLogs = [];
    for (const profile of profiles) {
      const log = await this.createAuditLog({
        action_type: 'profile_cascade_delete',
        profile_id: profile.id,
        actor_id: null, // Will default to global.testAuthUserId in createAuditLog
        old_data: profile,
        new_data: { deleted_at: new Date().toISOString() },
        batch_id: batchId,
        operation_group_id: operationGroup.id,
      });
      auditLogs.push(log);
    }

    return { batchId, operationGroup, auditLogs };
  }

  /**
   * Create audit log with specific old_data for restoration testing
   * Actor ID automatically uses global.testAuthUserId
   */
  async createAuditWithOldData(profileId, oldData) {
    return this.createAuditLog({
      action_type: 'profile_update',
      profile_id: profileId,
      actor_id: null, // Will default to global.testAuthUserId in createAuditLog
      old_data: oldData,
      new_data: { ...oldData, name: 'تم التعديل' },
    });
  }

  /**
   * Mark audit log as undone
   * Actor ID automatically uses global.testAuthUserId
   */
  async markAsUndone(auditLogId, undoReason = 'تراجع تجريبي') {
    const effectiveUndoneBy = global.testAuthUserId;

    const { error } = await this.supabaseAdmin
      .from('audit_log_enhanced')
      .update({
        undone_at: new Date().toISOString(),
        undone_by: effectiveUndoneBy,
        undo_reason: undoReason,
      })
      .eq('id', auditLogId);

    if (error) {
      throw new Error(`Failed to mark audit log as undone: ${error.message}`);
    }
  }

  /**
   * Cleanup all created audit logs
   */
  async cleanup() {
    if (this.createdAuditLogs.length === 0) return;

    const { error } = await this.supabaseAdmin
      .from('audit_log_enhanced')
      .delete()
      .in('id', this.createdAuditLogs);

    if (error && error.code !== 'PGRST116') {
      console.error('⚠️  Audit log cleanup failed:', error.message);
    }

    this.createdAuditLogs = [];
  }

  /**
   * Get all created audit log IDs
   */
  getCreatedIds() {
    return [...this.createdAuditLogs];
  }
}

module.exports = { AuditLogFixture };
