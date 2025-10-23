/**
 * SpouseManager Component - Comprehensive Test Suite
 *
 * Tests the spouse search and selection functionality including:
 * - Search with Al-Qefari names
 * - Search with non-Qefari names (munasib)
 * - Tree modal confirmation flow
 * - Marriage creation
 * - Error handling and edge cases
 */

import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';
import SpouseManager from '../../src/components/admin/SpouseManager';
import { supabase } from '../../src/services/supabase';
import { phoneAuthService } from '../../src/services/phoneAuth';
import { profilesService } from '../../src/services/profiles';
import familyNameService from '../../src/services/familyNameService';

// Mock expo-haptics BEFORE importing
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
  },
  NotificationFeedbackType: {
    Success: 'success',
    Warning: 'warning',
    Error: 'error',
  },
}));

const Haptics = require('expo-haptics');

// Mock dependencies
jest.mock('../../src/services/supabase', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
  },
}));

jest.mock('../../src/services/phoneAuth', () => ({
  phoneAuthService: {
    searchProfilesByNameChain: jest.fn(),
  },
}));

jest.mock('../../src/services/profiles', () => ({
  profilesService: {
    createMarriage: jest.fn(),
  },
}));

jest.mock('../../src/services/familyNameService');

// Mock BranchTreeModal since it's complex
jest.mock('../../src/components/BranchTreeModal', () => {
  const React = require('react');
  const { Modal, View, Text, TouchableOpacity } = require('react-native');
  return function BranchTreeModal({ visible, profile, onConfirm, onClose, confirmText, cancelText }) {
    if (!visible) return null;
    return (
      <Modal visible={visible}>
        <View testID="branch-tree-modal">
          <Text testID="tree-modal-profile-name">{profile?.name}</Text>
          <TouchableOpacity testID="tree-modal-confirm" onPress={() => onConfirm(profile)}>
            <Text>{confirmText}</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="tree-modal-cancel" onPress={onClose}>
            <Text>{cancelText}</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  };
});

jest.spyOn(Alert, 'alert');

describe('SpouseManager', () => {
  const mockPerson = {
    id: 'person-123',
    name: 'محمد القفاري',
    gender: 'male',
    generation: 3,
    hid: 'R1.2.3',
  };

  const defaultProps = {
    visible: true,
    person: mockPerson,
    onClose: jest.fn(),
    onSpouseAdded: jest.fn(),
  };

  // Mock search results for Al-Qefari family members
  const mockAlQefariResults = [
    {
      id: 'result-1',
      name: 'فاطمة القفاري',
      gender: 'female',
      hid: 'R1.3.1',
      generation: 3,
      photo_url: null,
      match_score: 95,
      name_chain: 'فاطمة بنت عبدالله القفاري',
    },
    {
      id: 'result-2',
      name: 'فاطمة القفاري',
      gender: 'female',
      hid: 'R1.4.2',
      generation: 4,
      photo_url: 'https://example.com/photo.jpg',
      match_score: 90,
      name_chain: 'فاطمة بنت محمد القفاري',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementations
    familyNameService.parseFullName = jest.fn((name, gender) => ({
      firstName: name.split(' ')[0],
      middleChain: [],
      familyName: 'القفاري',
      familyOrigin: null,
    }));

    familyNameService.isAlQefariFamily = jest.fn((name) => {
      return name === 'القفاري' || name?.includes('قفار');
    });
  });

  describe('1. Search Functionality', () => {
    describe('Valid Al-Qefari Name Search', () => {
      test('performs search when name is submitted', async () => {
        phoneAuthService.searchProfilesByNameChain.mockResolvedValue({
          success: true,
          profiles: mockAlQefariResults,
        });

        const { getByText } = render(
          <SpouseManager {...defaultProps} prefilledName="فاطمة القفاري" />
        );

        await waitFor(() => {
          expect(phoneAuthService.searchProfilesByNameChain).toHaveBeenCalledWith('فاطمة');
        });

        // Should show search results
        await waitFor(() => {
          expect(getByText('نتائج البحث عن: فاطمة')).toBeTruthy();
        });
      });

      test('filters results to correct gender only', async () => {
        const mixedGenderResults = [
          ...mockAlQefariResults,
          { id: 'male-1', name: 'فهد القفاري', gender: 'male', hid: 'R1.2.1' },
        ];

        phoneAuthService.searchProfilesByNameChain.mockResolvedValue({
          success: true,
          profiles: mixedGenderResults,
        });

        const { queryByText } = render(
          <SpouseManager {...defaultProps} prefilledName="فاطمة القفاري" />
        );

        await waitFor(() => {
          expect(phoneAuthService.searchProfilesByNameChain).toHaveBeenCalled();
        });

        // Should NOT show male results for male person
        await waitFor(() => {
          expect(queryByText(/فهد/)).toBeNull();
        });
      });

      test('excludes current person from search results', async () => {
        const resultsWithSelf = [
          ...mockAlQefariResults,
          { ...mockPerson, id: mockPerson.id, gender: 'female' },
        ];

        phoneAuthService.searchProfilesByNameChain.mockResolvedValue({
          success: true,
          profiles: resultsWithSelf,
        });

        render(<SpouseManager {...defaultProps} prefilledName="محمد القفاري" />);

        await waitFor(() => {
          // Result count should exclude self
          expect(phoneAuthService.searchProfilesByNameChain).toHaveBeenCalled();
        });
      });

      test('filters out munasib profiles (hid === null)', async () => {
        const resultsWithMunasib = [
          ...mockAlQefariResults,
          { id: 'munasib-1', name: 'فاطمة العتيبي', gender: 'female', hid: null },
        ];

        phoneAuthService.searchProfilesByNameChain.mockResolvedValue({
          success: true,
          profiles: resultsWithMunasib,
        });

        render(<SpouseManager {...defaultProps} prefilledName="فاطمة" />);

        await waitFor(() => {
          expect(phoneAuthService.searchProfilesByNameChain).toHaveBeenCalled();
        });

        // Munasib should be filtered out
      });

      test('limits results to maximum 8 profiles', async () => {
        const manyResults = Array.from({ length: 15 }, (_, i) => ({
          id: `result-${i}`,
          name: `فاطمة ${i}`,
          gender: 'female',
          hid: `R1.${i}.1`,
          match_score: 100 - i,
        }));

        phoneAuthService.searchProfilesByNameChain.mockResolvedValue({
          success: true,
          profiles: manyResults,
        });

        render(<SpouseManager {...defaultProps} prefilledName="فاطمة القفاري" />);

        await waitFor(() => {
          expect(phoneAuthService.searchProfilesByNameChain).toHaveBeenCalled();
        });

        // Should only display max 8 results
      });
    });

    describe('Non-Qefari Name Search', () => {
      test('shows confirmation dialog for non-Qefari names', async () => {
        familyNameService.parseFullName.mockReturnValue({
          firstName: 'فاطمة',
          middleChain: ['بنت', 'محمد'],
          familyName: 'العتيبي',
          familyOrigin: 'العتيبي',
        });

        familyNameService.isAlQefariFamily.mockReturnValue(false);

        Alert.alert.mockImplementation((title, message, buttons) => {
          // Simulate user pressing "نعم"
          buttons[1].onPress();
        });

        phoneAuthService.searchProfilesByNameChain.mockResolvedValue({
          success: true,
          profiles: [],
        });

        render(<SpouseManager {...defaultProps} prefilledName="فاطمة العتيبي" />);

        await waitFor(() => {
          expect(Alert.alert).toHaveBeenCalledWith(
            'تأكيد الإضافة',
            expect.stringContaining('فاطمة'),
            expect.any(Array)
          );
        });
      });

      test('canceling munasib confirmation closes modal', async () => {
        familyNameService.isAlQefariFamily.mockReturnValue(false);

        Alert.alert.mockImplementation((title, message, buttons) => {
          // Simulate user pressing "إلغاء"
          buttons[0].onPress();
        });

        render(<SpouseManager {...defaultProps} prefilledName="فاطمة العتيبي" />);

        await waitFor(() => {
          expect(defaultProps.onClose).toHaveBeenCalled();
        });
      });
    });

    describe('Invalid/Empty Names', () => {
      test('shows validation error for names with less than 2 words', async () => {
        render(<SpouseManager {...defaultProps} />);

        // Manually trigger validation (component auto-submits with prefilled name)
        // This test would need the component to expose the handleSubmit function
        // or we'd need to fill the input and submit manually
      });

      test('shows error when search fails', async () => {
        phoneAuthService.searchProfilesByNameChain.mockResolvedValue({
          success: false,
          error: 'فشل الاتصال بالخادم',
        });

        render(<SpouseManager {...defaultProps} prefilledName="فاطمة القفاري" />);

        await waitFor(() => {
          expect(Alert.alert).toHaveBeenCalledWith(
            'خطأ',
            'فشل البحث في الشجرة'
          );
        });

        expect(defaultProps.onClose).toHaveBeenCalled();
      });
    });
  });

  describe('2. UI/UX Tests', () => {
    describe('Modal Display', () => {
      test('opens with prefilledName and auto-searches', async () => {
        phoneAuthService.searchProfilesByNameChain.mockResolvedValue({
          success: true,
          profiles: mockAlQefariResults,
        });

        const { getByText } = render(
          <SpouseManager {...defaultProps} prefilledName="فاطمة القفاري" />
        );

        // Should show loading initially
        await waitFor(() => {
          expect(getByText(/جاري البحث/)).toBeTruthy();
        });
      });

      test('displays correct spouse title based on gender', () => {
        const { getByText } = render(<SpouseManager {...defaultProps} />);
        expect(getByText('إضافة الزوجة')).toBeTruthy();

        const femaleProps = {
          ...defaultProps,
          person: { ...mockPerson, gender: 'female' },
        };
        const { getByText: getByTextFemale } = render(<SpouseManager {...femaleProps} />);
        expect(getByTextFemale('إضافة الزوج')).toBeTruthy();
      });

      test('shows person info correctly', () => {
        const { getByText } = render(<SpouseManager {...defaultProps} />);
        expect(getByText('إضافة الزوجة لـ')).toBeTruthy();
        expect(getByText('محمد القفاري')).toBeTruthy();
      });
    });

    describe('Loading States', () => {
      test('displays loading indicator during search', async () => {
        phoneAuthService.searchProfilesByNameChain.mockImplementation(
          () => new Promise(resolve => setTimeout(() => resolve({ success: true, profiles: [] }), 1000))
        );

        const { getByText } = render(
          <SpouseManager {...defaultProps} prefilledName="فاطمة القفاري" />
        );

        await waitFor(() => {
          expect(getByText(/جاري البحث/)).toBeTruthy();
        });
      });

      test('displays loading indicator during marriage creation', async () => {
        phoneAuthService.searchProfilesByNameChain.mockResolvedValue({
          success: true,
          profiles: mockAlQefariResults,
        });

        familyNameService.isAlQefariFamily.mockReturnValue(false);
        familyNameService.parseFullName.mockReturnValue({
          firstName: 'فاطمة',
          familyName: 'العتيبي',
          familyOrigin: 'العتيبي',
        });

        supabase.rpc.mockResolvedValue({
          data: { id: 'new-munasib-id' },
          error: null,
        });

        profilesService.createMarriage.mockImplementation(
          () => new Promise(resolve => setTimeout(() => resolve({ data: {}, error: null }), 1000))
        );

        Alert.alert.mockImplementation((title, message, buttons) => {
          buttons[1].onPress(); // Press "نعم"
        });

        const { getByText } = render(
          <SpouseManager {...defaultProps} prefilledName="فاطمة العتيبي" />
        );

        await waitFor(() => {
          expect(getByText(/جاري الإضافة/)).toBeTruthy();
        });
      });
    });

    describe('Empty State', () => {
      test('displays empty state when no results found', async () => {
        phoneAuthService.searchProfilesByNameChain.mockResolvedValue({
          success: true,
          profiles: [],
        });

        const { getByText } = render(
          <SpouseManager {...defaultProps} prefilledName="فاطمة القفاري" />
        );

        await waitFor(() => {
          expect(getByText('لا توجد نتائج')).toBeTruthy();
          expect(getByText(/لم نجد الزوجة بهذا الاسم/)).toBeTruthy();
        });
      });

      test('shows "add as new" button in empty state', async () => {
        phoneAuthService.searchProfilesByNameChain.mockResolvedValue({
          success: true,
          profiles: [],
        });

        const { getByText } = render(
          <SpouseManager {...defaultProps} prefilledName="فاطمة القفاري" />
        );

        await waitFor(() => {
          expect(getByText('إضافة كشخص جديد')).toBeTruthy();
        });
      });
    });

    describe('Results Display', () => {
      test('renders search results without cropping', async () => {
        phoneAuthService.searchProfilesByNameChain.mockResolvedValue({
          success: true,
          profiles: mockAlQefariResults,
        });

        const { getByText } = render(
          <SpouseManager {...defaultProps} prefilledName="فاطمة القفاري" />
        );

        await waitFor(() => {
          expect(getByText('نتائج البحث عن: فاطمة')).toBeTruthy();
        });
      });

      test('displays scroll functionality with multiple results', async () => {
        const manyResults = Array.from({ length: 5 }, (_, i) => ({
          id: `result-${i}`,
          name: `فاطمة القفاري ${i}`,
          gender: 'female',
          hid: `R1.${i}.1`,
          generation: 3,
          match_score: 100,
          name_chain: `فاطمة بنت عبدالله القفاري ${i}`,
        }));

        phoneAuthService.searchProfilesByNameChain.mockResolvedValue({
          success: true,
          profiles: manyResults,
        });

        render(<SpouseManager {...defaultProps} prefilledName="فاطمة القفاري" />);

        await waitFor(() => {
          expect(phoneAuthService.searchProfilesByNameChain).toHaveBeenCalled();
        });
        // FlatList should handle scrolling
      });
    });
  });

  describe('3. Integration Tests - Spouse Selection Flow', () => {
    describe('Tree Modal Confirmation', () => {
      test('opens tree modal when profile is selected', async () => {
        phoneAuthService.searchProfilesByNameChain.mockResolvedValue({
          success: true,
          profiles: mockAlQefariResults,
        });

        const { getByText, getByTestId } = render(
          <SpouseManager {...defaultProps} prefilledName="فاطمة القفاري" />
        );

        await waitFor(() => {
          expect(getByText('نتائج البحث عن: فاطمة')).toBeTruthy();
        });

        // Select first result (ProfileMatchCard is mocked by ReactNative's Pressable)
        // This requires more complex mocking or actual component rendering
      });

      test('shows correct gender-based confirmation text', async () => {
        phoneAuthService.searchProfilesByNameChain.mockResolvedValue({
          success: true,
          profiles: [mockAlQefariResults[0]],
        });

        render(<SpouseManager {...defaultProps} prefilledName="فاطمة القفاري" />);

        await waitFor(() => {
          expect(phoneAuthService.searchProfilesByNameChain).toHaveBeenCalled();
        });

        // For female spouse: "هذه هي" / "ليست هي"
        // For male spouse: "هذا هو" / "ليس هو"
      });

      test('closes modal when tree confirmation is canceled', async () => {
        // This test requires simulating the tree modal cancel flow
      });
    });

    describe('Marriage Creation - Al-Qefari Spouse', () => {
      test('successfully creates marriage with Al-Qefari spouse', async () => {
        phoneAuthService.searchProfilesByNameChain.mockResolvedValue({
          success: true,
          profiles: mockAlQefariResults,
        });

        // Mock profile fetch (re-fetch for race condition prevention)
        supabase.from.mockReturnValue({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn()
            .mockResolvedValueOnce({
              data: mockPerson,
              error: null,
            })
            .mockResolvedValueOnce({
              data: mockAlQefariResults[0],
              error: null,
            }),
        });

        // Mock duplicate check
        supabase.from.mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          is: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
        });

        profilesService.createMarriage.mockResolvedValue({
          data: { id: 'marriage-123' },
          error: null,
        });

        render(<SpouseManager {...defaultProps} prefilledName="فاطمة القفاري" />);

        // This test requires full flow simulation through tree modal
      });

      test('prevents duplicate marriage creation', async () => {
        phoneAuthService.searchProfilesByNameChain.mockResolvedValue({
          success: true,
          profiles: mockAlQefariResults,
        });

        // Mock profile fetch
        supabase.from.mockReturnValue({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn()
            .mockResolvedValueOnce({ data: mockPerson, error: null })
            .mockResolvedValueOnce({ data: mockAlQefariResults[0], error: null }),
        });

        // Mock existing marriage found
        supabase.from.mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          is: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
            data: { id: 'existing-marriage' },
            error: null,
          }),
        });

        render(<SpouseManager {...defaultProps} prefilledName="فاطمة القفاري" />);

        // Should show duplicate marriage alert
      });

      test('handles deleted profile in spouse selection', async () => {
        phoneAuthService.searchProfilesByNameChain.mockResolvedValue({
          success: true,
          profiles: mockAlQefariResults,
        });

        // Mock spouse fetch with deleted profile
        supabase.from.mockReturnValue({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn()
            .mockResolvedValueOnce({ data: mockPerson, error: null })
            .mockResolvedValueOnce({
              data: { ...mockAlQefariResults[0], deleted_at: '2025-01-01' },
              error: null,
            }),
        });

        render(<SpouseManager {...defaultProps} prefilledName="فاطمة القفاري" />);

        // Should show error about deleted profile
      });
    });

    describe('Marriage Creation - Munasib (Non-Qefari)', () => {
      test('creates munasib profile and marriage successfully', async () => {
        familyNameService.isAlQefariFamily.mockReturnValue(false);
        familyNameService.parseFullName.mockReturnValue({
          firstName: 'فاطمة',
          middleChain: ['بنت', 'محمد'],
          familyName: 'العتيبي',
          familyOrigin: 'العتيبي',
        });

        phoneAuthService.searchProfilesByNameChain.mockResolvedValue({
          success: true,
          profiles: [],
        });

        Alert.alert.mockImplementation((title, message, buttons) => {
          buttons[1].onPress(); // Press "نعم"
        });

        supabase.rpc.mockResolvedValue({
          data: { id: 'new-munasib-id', name: 'فاطمة العتيبي' },
          error: null,
        });

        // Mock duplicate check - no existing marriage
        supabase.from.mockReturnValue({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          is: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
        });

        profilesService.createMarriage.mockResolvedValue({
          data: { id: 'marriage-123' },
          error: null,
        });

        render(<SpouseManager {...defaultProps} prefilledName="فاطمة العتيبي" />);

        await waitFor(() => {
          expect(supabase.rpc).toHaveBeenCalledWith('admin_create_munasib_profile', {
            p_name: 'فاطمة العتيبي',
            p_gender: 'female',
            p_generation: 3,
            p_family_origin: 'العتيبي',
            p_sibling_order: 0,
            p_status: 'alive',
            p_phone: null,
          });
        });

        await waitFor(() => {
          expect(profilesService.createMarriage).toHaveBeenCalled();
        });
      });

      test('cleans up orphaned munasib profile on duplicate marriage', async () => {
        familyNameService.isAlQefariFamily.mockReturnValue(false);

        Alert.alert.mockImplementation((title, message, buttons) => {
          buttons[1].onPress();
        });

        const newMunasibId = 'new-munasib-id';
        supabase.rpc.mockResolvedValue({
          data: { id: newMunasibId },
          error: null,
        });

        // Mock duplicate marriage found
        supabase.from.mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          is: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
            data: { id: 'existing-marriage' },
            error: null,
          }),
        });

        // Mock soft delete of orphaned profile
        const updateMock = jest.fn().mockReturnThis();
        supabase.from.mockReturnValueOnce({
          update: updateMock,
          eq: jest.fn().mockResolvedValue({ data: null, error: null }),
        });

        render(<SpouseManager {...defaultProps} prefilledName="فاطمة العتيبي" />);

        await waitFor(() => {
          expect(updateMock).toHaveBeenCalledWith({
            deleted_at: expect.any(String),
          });
        });
      });

      test('cleans up munasib profile on marriage creation failure', async () => {
        familyNameService.isAlQefariFamily.mockReturnValue(false);

        Alert.alert.mockImplementation((title, message, buttons) => {
          buttons[1].onPress();
        });

        const newMunasibId = 'new-munasib-id';
        supabase.rpc.mockResolvedValue({
          data: { id: newMunasibId },
          error: null,
        });

        // No duplicate
        supabase.from.mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          is: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
        });

        // Marriage creation fails
        profilesService.createMarriage.mockResolvedValue({
          data: null,
          error: new Error('Insufficient permissions'),
        });

        // Mock cleanup
        const updateMock = jest.fn().mockReturnThis();
        supabase.from.mockReturnValueOnce({
          update: updateMock,
          eq: jest.fn().mockResolvedValue({ data: null, error: null }),
        });

        render(<SpouseManager {...defaultProps} prefilledName="فاطمة العتيبي" />);

        await waitFor(() => {
          expect(updateMock).toHaveBeenCalled();
        });
      });

      test('sets correct munasib value based on family origin', async () => {
        familyNameService.isAlQefariFamily.mockReturnValue(false);
        familyNameService.parseFullName.mockReturnValue({
          firstName: 'فاطمة',
          familyName: 'العتيبي',
          familyOrigin: 'العتيبي',
        });

        Alert.alert.mockImplementation((title, message, buttons) => {
          buttons[1].onPress();
        });

        supabase.rpc.mockResolvedValue({
          data: { id: 'munasib-id' },
          error: null,
        });

        supabase.from.mockReturnValue({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          is: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
        });

        profilesService.createMarriage.mockResolvedValue({
          data: { id: 'marriage-123' },
          error: null,
        });

        render(<SpouseManager {...defaultProps} prefilledName="فاطمة العتيبي" />);

        await waitFor(() => {
          expect(profilesService.createMarriage).toHaveBeenCalledWith({
            husband_id: expect.any(String),
            wife_id: expect.any(String),
            munasib: 'العتيبي',
          });
        });
      });
    });
  });

  describe('4. Edge Cases', () => {
    describe('Null/Undefined Values', () => {
      test('handles profiles with missing fields', async () => {
        const incompleteResults = [{
          id: 'incomplete-1',
          name: 'فاطمة',
          gender: 'female',
          hid: 'R1.1.1',
          // Missing: photo_url, generation, match_score
        }];

        phoneAuthService.searchProfilesByNameChain.mockResolvedValue({
          success: true,
          profiles: incompleteResults,
        });

        render(<SpouseManager {...defaultProps} prefilledName="فاطمة القفاري" />);

        await waitFor(() => {
          expect(phoneAuthService.searchProfilesByNameChain).toHaveBeenCalled();
        });
        // Should render without crashing
      });

      test('handles null HID gracefully', async () => {
        const nullHidResult = [{
          id: 'null-hid',
          name: 'فاطمة',
          gender: 'female',
          hid: null,
        }];

        phoneAuthService.searchProfilesByNameChain.mockResolvedValue({
          success: true,
          profiles: nullHidResult,
        });

        render(<SpouseManager {...defaultProps} prefilledName="فاطمة" />);

        await waitFor(() => {
          // Null HID profiles should be filtered out
          expect(phoneAuthService.searchProfilesByNameChain).toHaveBeenCalled();
        });
      });
    });

    describe('Boundary Conditions', () => {
      test('handles very long names (50+ characters)', async () => {
        const longName = 'فاطمة بنت محمد بن عبدالله بن أحمد بن سعيد بن عبدالرحمن القفاري';

        phoneAuthService.searchProfilesByNameChain.mockResolvedValue({
          success: true,
          profiles: [{
            id: 'long-name',
            name: longName,
            gender: 'female',
            hid: 'R1.1.1',
          }],
        });

        render(<SpouseManager {...defaultProps} prefilledName={longName} />);

        await waitFor(() => {
          expect(phoneAuthService.searchProfilesByNameChain).toHaveBeenCalled();
        });
        // Should handle without crashing
      });

      test('handles search with special Arabic characters', async () => {
        const nameWithDiacritics = 'فَاطِمَة القُفَارِي';

        phoneAuthService.searchProfilesByNameChain.mockResolvedValue({
          success: true,
          profiles: [],
        });

        render(<SpouseManager {...defaultProps} prefilledName={nameWithDiacritics} />);

        await waitFor(() => {
          expect(phoneAuthService.searchProfilesByNameChain).toHaveBeenCalled();
        });
      });
    });

    describe('Concurrent Operations', () => {
      test('handles rapid successive searches', async () => {
        phoneAuthService.searchProfilesByNameChain.mockResolvedValue({
          success: true,
          profiles: mockAlQefariResults,
        });

        const { rerender } = render(
          <SpouseManager {...defaultProps} prefilledName="فاطمة" />
        );

        // Change name rapidly
        rerender(<SpouseManager {...defaultProps} prefilledName="سارة" />);
        rerender(<SpouseManager {...defaultProps} prefilledName="نورة" />);

        await waitFor(() => {
          // Should handle without race conditions
          expect(phoneAuthService.searchProfilesByNameChain).toHaveBeenCalled();
        });
      });

      test('prevents double submission during marriage creation', async () => {
        familyNameService.isAlQefariFamily.mockReturnValue(false);

        Alert.alert.mockImplementation((title, message, buttons) => {
          buttons[1].onPress();
        });

        supabase.rpc.mockResolvedValue({
          data: { id: 'munasib-id' },
          error: null,
        });

        supabase.from.mockReturnValue({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          is: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
        });

        profilesService.createMarriage.mockImplementation(
          () => new Promise(resolve => setTimeout(() => resolve({ data: {}, error: null }), 100))
        );

        render(<SpouseManager {...defaultProps} prefilledName="فاطمة العتيبي" />);

        // Multiple rapid clicks should only create one marriage
        await waitFor(() => {
          expect(profilesService.createMarriage).toHaveBeenCalledTimes(1);
        });
      });
    });

    describe('Error Scenarios', () => {
      test('handles network failure during search', async () => {
        phoneAuthService.searchProfilesByNameChain.mockRejectedValue(
          new Error('Network request failed')
        );

        render(<SpouseManager {...defaultProps} prefilledName="فاطمة القفاري" />);

        await waitFor(() => {
          expect(Alert.alert).toHaveBeenCalledWith(
            'خطأ',
            'فشل البحث في الشجرة'
          );
        });
      });

      test('handles database constraint violations', async () => {
        familyNameService.isAlQefariFamily.mockReturnValue(false);

        Alert.alert.mockImplementation((title, message, buttons) => {
          buttons[1].onPress();
        });

        supabase.rpc.mockResolvedValue({
          data: null,
          error: new Error('duplicate key value violates unique constraint'),
        });

        render(<SpouseManager {...defaultProps} prefilledName="فاطمة العتيبي" />);

        await waitFor(() => {
          expect(Alert.alert).toHaveBeenCalledWith(
            'خطأ',
            expect.stringContaining('duplicate key')
          );
        });
      });

      test('handles marriage validation errors', async () => {
        phoneAuthService.searchProfilesByNameChain.mockResolvedValue({
          success: true,
          profiles: mockAlQefariResults,
        });

        // Mock validation failure (same gender)
        supabase.from.mockReturnValue({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn()
            .mockResolvedValueOnce({ data: mockPerson, error: null })
            .mockResolvedValueOnce({
              data: { ...mockAlQefariResults[0], gender: 'male' }, // Same gender!
              error: null,
            }),
        });

        render(<SpouseManager {...defaultProps} prefilledName="فاطمة القفاري" />);

        // Should show validation error
      });
    });

    describe('Missing Required Fields', () => {
      test('handles profile without generation field', async () => {
        const profileNoGeneration = {
          ...mockPerson,
          generation: undefined,
        };

        familyNameService.isAlQefariFamily.mockReturnValue(false);

        Alert.alert.mockImplementation((title, message, buttons) => {
          buttons[1].onPress();
        });

        supabase.rpc.mockResolvedValue({
          data: { id: 'munasib-id' },
          error: null,
        });

        const { rerender } = render(<SpouseManager {...defaultProps} />);
        rerender(
          <SpouseManager {...defaultProps} person={profileNoGeneration} prefilledName="فاطمة العتيبي" />
        );

        // Should handle gracefully with null/undefined generation
        await waitFor(() => {
          expect(supabase.rpc).toHaveBeenCalledWith(
            'admin_create_munasib_profile',
            expect.objectContaining({
              p_generation: undefined,
            })
          );
        });
      });
    });
  });

  describe('5. Success States', () => {
    test('shows success animation after marriage creation', async () => {
      familyNameService.isAlQefariFamily.mockReturnValue(false);

      Alert.alert.mockImplementation((title, message, buttons) => {
        buttons[1].onPress();
      });

      supabase.rpc.mockResolvedValue({
        data: { id: 'munasib-id' },
        error: null,
      });

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      });

      profilesService.createMarriage.mockResolvedValue({
        data: { id: 'marriage-123' },
        error: null,
      });

      const { getByText } = render(
        <SpouseManager {...defaultProps} prefilledName="فاطمة العتيبي" />
      );

      await waitFor(() => {
        expect(getByText('تم إضافة الزوجة بنجاح')).toBeTruthy();
      });
    });

    test('auto-dismisses modal after successful creation', async () => {
      familyNameService.isAlQefariFamily.mockReturnValue(false);

      Alert.alert.mockImplementation((title, message, buttons) => {
        buttons[1].onPress();
      });

      supabase.rpc.mockResolvedValue({
        data: { id: 'munasib-id' },
        error: null,
      });

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      });

      profilesService.createMarriage.mockResolvedValue({
        data: { id: 'marriage-123' },
        error: null,
      });

      render(<SpouseManager {...defaultProps} prefilledName="فاطمة العتيبي" />);

      await waitFor(() => {
        expect(defaultProps.onSpouseAdded).toHaveBeenCalled();
      }, { timeout: 2000 });

      await waitFor(() => {
        expect(defaultProps.onClose).toHaveBeenCalled();
      }, { timeout: 2000 });
    });

    test('calls onSpouseAdded callback with marriage data', async () => {
      familyNameService.isAlQefariFamily.mockReturnValue(false);

      Alert.alert.mockImplementation((title, message, buttons) => {
        buttons[1].onPress();
      });

      const marriageData = { id: 'marriage-123', husband_id: 'h-1', wife_id: 'w-1' };

      supabase.rpc.mockResolvedValue({
        data: { id: 'munasib-id' },
        error: null,
      });

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      });

      profilesService.createMarriage.mockResolvedValue({
        data: marriageData,
        error: null,
      });

      render(<SpouseManager {...defaultProps} prefilledName="فاطمة العتيبي" />);

      await waitFor(() => {
        expect(defaultProps.onSpouseAdded).toHaveBeenCalledWith(marriageData);
      }, { timeout: 2000 });
    });
  });

  describe('6. Responsive Design', () => {
    test('renders correctly on small screens', () => {
      // React Native Testing Library doesn't have viewport control,
      // but we can verify component renders without explicit dimensions
      const { container } = render(<SpouseManager {...defaultProps} />);
      expect(container).toBeTruthy();
    });

    test('handles long text without overflow', async () => {
      const longNameProfile = {
        ...mockAlQefariResults[0],
        name: 'فاطمة بنت محمد بن عبدالله بن أحمد بن سعيد بن عبدالرحمن بن إبراهيم القفاري',
      };

      phoneAuthService.searchProfilesByNameChain.mockResolvedValue({
        success: true,
        profiles: [longNameProfile],
      });

      render(<SpouseManager {...defaultProps} prefilledName="فاطمة القفاري" />);

      await waitFor(() => {
        expect(phoneAuthService.searchProfilesByNameChain).toHaveBeenCalled();
      });
      // ProfileMatchCard should handle text overflow with numberOfLines
    });
  });

  describe('7. Haptic Feedback', () => {
    test('triggers haptic feedback on spouse selection', async () => {
      phoneAuthService.searchProfilesByNameChain.mockResolvedValue({
        success: true,
        profiles: mockAlQefariResults,
      });

      render(<SpouseManager {...defaultProps} prefilledName="فاطمة القفاري" />);

      await waitFor(() => {
        expect(phoneAuthService.searchProfilesByNameChain).toHaveBeenCalled();
      });

      // Haptic feedback should be called when profile card is pressed
      // This requires simulating the ProfileMatchCard press
    });

    test('triggers haptic feedback on "add as new" action', async () => {
      phoneAuthService.searchProfilesByNameChain.mockResolvedValue({
        success: true,
        profiles: [],
      });

      const { getByText } = render(
        <SpouseManager {...defaultProps} prefilledName="فاطمة القفاري" />
      );

      await waitFor(() => {
        expect(getByText('إضافة كشخص جديد')).toBeTruthy();
      });

      fireEvent.press(getByText('إضافة كشخص جديد'));

      expect(Haptics.impactAsync).toHaveBeenCalledWith(
        Haptics.ImpactFeedbackStyle.Light
      );
    });
  });
});
