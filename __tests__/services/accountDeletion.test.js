import { accountDeletionService } from '../../src/services/accountDeletion';

jest.mock('../../src/services/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
  },
}));

const { supabase } = require('../../src/services/supabase');

describe('accountDeletionService.deleteAccount', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns success when the RPC succeeds', async () => {
    supabase.rpc.mockResolvedValue({
      data: {
        success: true,
        message: 'done',
        admin_deleted: true,
        profile_unlinked: true,
        user_deleted: true,
      },
      error: null,
    });

    const result = await accountDeletionService.deleteAccount();

    expect(supabase.rpc).toHaveBeenCalledWith('delete_user_account_complete');
    expect(result).toEqual({
      success: true,
      message: 'done',
      adminDeleted: true,
      profileUnlinked: true,
      userDeleted: true,
    });
  });

  it('returns failure when the RPC response indicates an error', async () => {
    supabase.rpc.mockResolvedValue({
      data: {
        success: false,
        error: 'fatal',
      },
      error: null,
    });

    const result = await accountDeletionService.deleteAccount();

    expect(result.success).toBe(false);
    expect(result.error).toBe('fatal');
  });

  it('returns failure when the RPC call rejects with an error', async () => {
    supabase.rpc.mockResolvedValue({
      data: null,
      error: { message: 'network down' },
    });

    const result = await accountDeletionService.deleteAccount();

    expect(result.success).toBe(false);
    expect(result.error).toBe('network down');
  });
});
