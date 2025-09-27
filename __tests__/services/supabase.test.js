import { createClient } from '@supabase/supabase-js';
import { supabase } from '../../src/services/supabase';

// Mock is already set up in setup.js
jest.mock('@supabase/supabase-js');

describe('Supabase Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Client Initialization', () => {
    it('should create Supabase client with correct configuration', () => {
      expect(createClient).toHaveBeenCalledWith(
        expect.stringContaining('supabase.co'),
        expect.stringContaining('eyJ'),
        expect.objectContaining({
          auth: expect.objectContaining({
            storage: expect.any(Object),
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: false,
          }),
        })
      );
    });

    it('should have auth methods available', () => {
      expect(supabase.auth).toBeDefined();
      expect(supabase.auth.signInWithOtp).toBeDefined();
      expect(supabase.auth.verifyOtp).toBeDefined();
      expect(supabase.auth.signOut).toBeDefined();
    });

    it('should have database methods available', () => {
      expect(supabase.from).toBeDefined();
      expect(supabase.rpc).toBeDefined();
    });
  });

  describe('Database Operations', () => {
    it('should handle successful profile fetch', async () => {
      const mockProfiles = [
        { id: '1', name: 'أحمد القفاري', generation: 1 },
        { id: '2', name: 'محمد القفاري', generation: 2 },
      ];

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockProfiles[0],
          error: null,
        }),
      });

      const query = supabase.from('profiles').select('*').eq('id', '1').single();
      const result = await query;

      expect(result.data).toEqual(mockProfiles[0]);
      expect(result.error).toBeNull();
    });

    it('should handle database errors gracefully', async () => {
      const mockError = {
        message: 'Database connection failed',
        code: 'PGRST301',
      };

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: mockError,
        }),
      });

      const query = supabase.from('profiles').select('*').eq('id', 'invalid').single();
      const result = await query;

      expect(result.data).toBeNull();
      expect(result.error).toEqual(mockError);
    });

    it('should handle RPC calls', async () => {
      const mockStats = {
        total_profiles: 150,
        male_count: 80,
        female_count: 70,
      };

      supabase.rpc.mockResolvedValue({
        data: mockStats,
        error: null,
      });

      const result = await supabase.rpc('get_statistics');

      expect(result.data).toEqual(mockStats);
      expect(result.error).toBeNull();
      expect(supabase.rpc).toHaveBeenCalledWith('get_statistics');
    });

    it('should handle RPC errors', async () => {
      const mockError = {
        message: 'Function does not exist',
        code: 'P0001',
      };

      supabase.rpc.mockResolvedValue({
        data: null,
        error: mockError,
      });

      const result = await supabase.rpc('invalid_function');

      expect(result.data).toBeNull();
      expect(result.error).toEqual(mockError);
    });
  });

  describe('Profiles Table Operations', () => {
    it('should fetch profiles with pagination', async () => {
      const mockProfiles = Array(10).fill(null).map((_, i) => ({
        id: `${i + 1}`,
        name: `Person ${i + 1}`,
        generation: Math.floor(i / 3) + 1,
      }));

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({
          data: mockProfiles.slice(0, 5),
          error: null,
        }),
      });

      const query = supabase
        .from('profiles')
        .select('*')
        .order('generation', { ascending: true })
        .limit(5)
        .range(0, 4);

      const result = await query;

      expect(result.data).toHaveLength(5);
      expect(result.error).toBeNull();
    });

    it('should insert new profile', async () => {
      const newProfile = {
        name: 'عبدالله القفاري',
        generation: 3,
        gender: 'male',
      };

      const insertedProfile = {
        id: 'new-id',
        ...newProfile,
        created_at: new Date().toISOString(),
      };

      supabase.from.mockReturnValue({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: insertedProfile,
          error: null,
        }),
      });

      const query = supabase
        .from('profiles')
        .insert(newProfile)
        .select()
        .single();

      const result = await query;

      expect(result.data).toMatchObject(newProfile);
      expect(result.data.id).toBeDefined();
      expect(result.error).toBeNull();
    });

    it('should update existing profile', async () => {
      const updates = {
        current_residence: 'الرياض',
        occupation: 'مهندس',
      };

      supabase.from.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: '1', ...updates },
          error: null,
        }),
      });

      const query = supabase
        .from('profiles')
        .update(updates)
        .eq('id', '1')
        .select()
        .single();

      const result = await query;

      expect(result.data).toMatchObject(updates);
      expect(result.error).toBeNull();
    });
  });

  describe('Marriage Table Operations', () => {
    it('should fetch marriages for a profile', async () => {
      const mockMarriages = [
        {
          id: 'm1',
          husband_id: 'p1',
          wife_id: 'p2',
          status: 'married',
        },
      ];

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: mockMarriages,
          error: null,
        }),
      });

      const query = supabase
        .from('marriages')
        .select('*')
        .or('husband_id.eq.p1,wife_id.eq.p1')
        .order('start_date', { ascending: false });

      const result = await query;

      expect(result.data).toEqual(mockMarriages);
      expect(result.error).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      const networkError = {
        message: 'Network request failed',
        code: 'NETWORK_ERROR',
      };

      supabase.from.mockReturnValue({
        select: jest.fn().mockRejectedValue(networkError),
      });

      await expect(
        supabase.from('profiles').select('*')
      ).rejects.toEqual(networkError);
    });

    it('should handle RLS policy violations', async () => {
      const rlsError = {
        message: 'new row violates row-level security policy',
        code: '42501',
      };

      supabase.from.mockReturnValue({
        insert: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: rlsError,
        }),
      });

      const result = await supabase
        .from('profiles')
        .insert({ name: 'Test' })
        .single();

      expect(result.error).toEqual(rlsError);
      expect(result.data).toBeNull();
    });
  });
});