import { supabase } from '../../src/services/supabase';
import phoneAuthService from '../../src/services/phoneAuth';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('../../src/services/supabase');
jest.mock('@react-native-async-storage/async-storage');

describe('Phone Authentication Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('formatPhoneNumber', () => {
    it('should format Saudi phone numbers correctly', () => {
      expect(phoneAuthService.formatPhoneNumber('0501234567')).toBe('+966501234567');
      expect(phoneAuthService.formatPhoneNumber('501234567')).toBe('+966501234567');
      expect(phoneAuthService.formatPhoneNumber('966501234567')).toBe('+966501234567');
      expect(phoneAuthService.formatPhoneNumber('+966501234567')).toBe('+966501234567');
    });

    it('should handle invalid phone numbers', () => {
      expect(phoneAuthService.formatPhoneNumber('123')).toBe('+966123');
      expect(phoneAuthService.formatPhoneNumber('')).toBe('+966');
      expect(phoneAuthService.formatPhoneNumber(null)).toBe('+966');
    });
  });

  describe('sendOTP', () => {
    it('should send OTP successfully', async () => {
      const mockResponse = {
        data: { messageId: 'msg123' },
        error: null,
      };

      supabase.auth.signInWithOtp = jest.fn().mockResolvedValue(mockResponse);

      const result = await phoneAuthService.sendOTP('0501234567');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResponse.data);
      expect(supabase.auth.signInWithOtp).toHaveBeenCalledWith({
        phone: '+966501234567',
      });
    });

    it('should handle OTP send errors', async () => {
      const mockError = {
        data: null,
        error: { message: 'Rate limit exceeded' },
      };

      supabase.auth.signInWithOtp = jest.fn().mockResolvedValue(mockError);

      const result = await phoneAuthService.sendOTP('0501234567');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Rate limit exceeded');
    });

    it('should handle network errors', async () => {
      supabase.auth.signInWithOtp = jest.fn().mockRejectedValue(new Error('Network error'));

      const result = await phoneAuthService.sendOTP('0501234567');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });
  });

  describe('verifyOTP', () => {
    it('should verify OTP and link profile successfully', async () => {
      const mockAuthResponse = {
        data: {
          user: { id: 'user123', phone: '+966501234567' },
          session: { access_token: 'token123' },
        },
        error: null,
      };

      const mockProfile = {
        data: { id: 'profile123', name: 'أحمد القفاري' },
        error: null,
      };

      supabase.auth.verifyOtp = jest.fn().mockResolvedValue(mockAuthResponse);
      supabase.rpc = jest.fn()
        .mockResolvedValueOnce({ data: mockProfile.data, error: null }) // find_profile_by_phone
        .mockResolvedValueOnce({ data: { success: true }, error: null }); // link_profile_to_user

      const result = await phoneAuthService.verifyOTP('0501234567', '123456');

      expect(result.success).toBe(true);
      expect(result.user).toEqual(mockAuthResponse.data.user);
      expect(result.profile).toEqual(mockProfile.data);
      expect(supabase.auth.verifyOtp).toHaveBeenCalledWith({
        phone: '+966501234567',
        token: '123456',
        type: 'sms',
      });
    });

    it('should handle OTP verification failure', async () => {
      const mockError = {
        data: null,
        error: { message: 'Invalid OTP' },
      };

      supabase.auth.verifyOtp = jest.fn().mockResolvedValue(mockError);

      const result = await phoneAuthService.verifyOTP('0501234567', '000000');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid OTP');
      expect(result.user).toBeNull();
    });

    it('should handle profile not found scenario', async () => {
      const mockAuthResponse = {
        data: {
          user: { id: 'user123', phone: '+966501234567' },
          session: { access_token: 'token123' },
        },
        error: null,
      };

      supabase.auth.verifyOtp = jest.fn().mockResolvedValue(mockAuthResponse);
      supabase.rpc = jest.fn().mockResolvedValue({ data: null, error: null });

      const result = await phoneAuthService.verifyOTP('0501234567', '123456');

      expect(result.success).toBe(true);
      expect(result.user).toEqual(mockAuthResponse.data.user);
      expect(result.profile).toBeNull();
      expect(result.needsProfileCreation).toBe(true);
    });
  });

  describe('signOut', () => {
    it('should sign out successfully', async () => {
      supabase.auth.signOut = jest.fn().mockResolvedValue({ error: null });
      AsyncStorage.removeItem = jest.fn().mockResolvedValue();

      const result = await phoneAuthService.signOut();

      expect(result.success).toBe(true);
      expect(supabase.auth.signOut).toHaveBeenCalled();
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('userProfile');
    });

    it('should handle sign out errors', async () => {
      supabase.auth.signOut = jest.fn().mockResolvedValue({
        error: { message: 'Sign out failed' },
      });

      const result = await phoneAuthService.signOut();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Sign out failed');
    });
  });

  describe('getSession', () => {
    it('should get current session', async () => {
      const mockSession = {
        data: {
          session: {
            user: { id: 'user123' },
            access_token: 'token123',
          },
        },
        error: null,
      };

      supabase.auth.getSession = jest.fn().mockResolvedValue(mockSession);

      const result = await phoneAuthService.getSession();

      expect(result).toEqual(mockSession.data.session);
      expect(supabase.auth.getSession).toHaveBeenCalled();
    });

    it('should handle no session', async () => {
      supabase.auth.getSession = jest.fn().mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const result = await phoneAuthService.getSession();

      expect(result).toBeNull();
    });
  });

  describe('Profile Operations', () => {
    it('should find profile by phone', async () => {
      const mockProfile = {
        id: 'profile123',
        name: 'محمد القفاري',
        phone: '+966501234567',
      };

      supabase.rpc = jest.fn().mockResolvedValue({
        data: mockProfile,
        error: null,
      });

      const result = await phoneAuthService.findProfileByPhone('0501234567');

      expect(result.success).toBe(true);
      expect(result.profile).toEqual(mockProfile);
      expect(supabase.rpc).toHaveBeenCalledWith('find_profile_by_phone', {
        p_phone: '+966501234567',
      });
    });

    it('should handle profile not found', async () => {
      supabase.rpc = jest.fn().mockResolvedValue({
        data: null,
        error: null,
      });

      const result = await phoneAuthService.findProfileByPhone('0501234567');

      expect(result.success).toBe(true);
      expect(result.profile).toBeNull();
    });

    it('should link profile to user', async () => {
      supabase.rpc = jest.fn().mockResolvedValue({
        data: { success: true },
        error: null,
      });

      const result = await phoneAuthService.linkProfileToUser('user123', 'profile123');

      expect(result.success).toBe(true);
      expect(supabase.rpc).toHaveBeenCalledWith('link_profile_to_user', {
        p_user_id: 'user123',
        p_profile_id: 'profile123',
      });
    });

    it('should handle link profile errors', async () => {
      supabase.rpc = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'Profile already linked' },
      });

      const result = await phoneAuthService.linkProfileToUser('user123', 'profile123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Profile already linked');
    });
  });

  describe('Auth State Management', () => {
    it('should subscribe to auth state changes', () => {
      const mockCallback = jest.fn();
      const mockUnsubscribe = jest.fn();

      supabase.auth.onAuthStateChange = jest.fn().mockReturnValue({
        data: { subscription: { unsubscribe: mockUnsubscribe } },
      });

      const subscription = phoneAuthService.onAuthStateChange(mockCallback);

      expect(supabase.auth.onAuthStateChange).toHaveBeenCalledWith(mockCallback);
      expect(subscription).toHaveProperty('unsubscribe');
    });

    it('should save profile to storage', async () => {
      const profile = { id: 'p1', name: 'أحمد' };

      AsyncStorage.setItem = jest.fn().mockResolvedValue();

      await phoneAuthService.saveProfileToStorage(profile);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'userProfile',
        JSON.stringify(profile)
      );
    });

    it('should get profile from storage', async () => {
      const profile = { id: 'p1', name: 'أحمد' };

      AsyncStorage.getItem = jest.fn().mockResolvedValue(JSON.stringify(profile));

      const result = await phoneAuthService.getProfileFromStorage();

      expect(result).toEqual(profile);
      expect(AsyncStorage.getItem).toHaveBeenCalledWith('userProfile');
    });
  });
});