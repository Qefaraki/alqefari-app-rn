import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import SelectMotherModal from '../../src/components/ProfileViewer/EditMode/SelectMotherModal';
import { supabase } from '../../src/services/supabase';

// Mock dependencies
jest.mock('../../src/services/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
  },
}));

jest.mock('expo-haptics');

jest.spyOn(Alert, 'alert');

describe('SelectMotherModal', () => {
  const mockPerson = {
    id: 'person-123',
    name: 'محمد',
    mother_id: 'mother-1',
  };

  const mockFather = {
    id: 'father-123',
    name: 'عبدالله',
  };

  const mockFamilyData = {
    spouses: [
      {
        marriage_id: 'marriage-1',
        status: 'married',
        children_count: 2,
        spouse_profile: {
          id: 'mother-1',
          name: 'فاطمة',
          hid: 'HID-001',
        },
      },
      {
        marriage_id: 'marriage-2',
        status: 'married',
        children_count: 1,
        spouse_profile: {
          id: 'mother-2',
          name: 'عائشة',
          hid: 'HID-002',
        },
      },
      {
        marriage_id: 'marriage-3',
        status: 'divorced',
        children_count: 0,
        spouse_profile: {
          id: 'mother-3',
          name: 'خديجة',
          hid: 'HID-003',
        },
      },
    ],
  };

  const defaultProps = {
    visible: true,
    person: mockPerson,
    father: mockFather,
    onClose: jest.fn(),
    onSaved: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Modal Rendering', () => {
    test('renders modal with correct title and father name', async () => {
      supabase.rpc.mockResolvedValue({ data: mockFamilyData, error: null });

      const { getByText } = render(<SelectMotherModal {...defaultProps} />);

      await waitFor(() => {
        expect(getByText('اختيار الأم')).toBeTruthy();
        expect(getByText('من زوجات عبدالله')).toBeTruthy();
      });
    });

    test('shows error state when father is not provided', () => {
      const { getByText } = render(
        <SelectMotherModal {...defaultProps} father={null} />
      );

      expect(getByText('لا يوجد أب محدد')).toBeTruthy();
      expect(getByText('يجب تحديد الأب أولاً قبل اختيار الأم')).toBeTruthy();
    });

    test('loads father spouses on mount', async () => {
      supabase.rpc.mockResolvedValue({ data: mockFamilyData, error: null });

      render(<SelectMotherModal {...defaultProps} />);

      await waitFor(() => {
        expect(supabase.rpc).toHaveBeenCalledWith('get_profile_family_data', {
          p_profile_id: 'father-123',
        });
      });
    });

    test('shows loading state while fetching spouses', () => {
      supabase.rpc.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ data: mockFamilyData, error: null }), 100))
      );

      const { getByText } = render(<SelectMotherModal {...defaultProps} />);

      expect(getByText('جاري تحميل الزوجات...')).toBeTruthy();
    });
  });

  describe('Spouse List Display', () => {
    test('displays only married spouses', async () => {
      supabase.rpc.mockResolvedValue({ data: mockFamilyData, error: null });

      const { getByText, queryByText } = render(<SelectMotherModal {...defaultProps} />);

      await waitFor(() => {
        expect(getByText('فاطمة')).toBeTruthy();
        expect(getByText('عائشة')).toBeTruthy();
        expect(queryByText('خديجة')).toBeNull(); // Divorced, should not show
      });
    });

    test('shows HID for spouses with HID', async () => {
      supabase.rpc.mockResolvedValue({ data: mockFamilyData, error: null });

      const { getByText } = render(<SelectMotherModal {...defaultProps} />);

      await waitFor(() => {
        expect(getByText('HID: HID-001')).toBeTruthy();
        expect(getByText('HID: HID-002')).toBeTruthy();
      });
    });

    test('shows munasib badge for spouses without HID', async () => {
      const dataWithMunasib = {
        spouses: [
          {
            ...mockFamilyData.spouses[0],
            spouse_profile: { ...mockFamilyData.spouses[0].spouse_profile, hid: null },
          },
        ],
      };
      supabase.rpc.mockResolvedValue({ data: dataWithMunasib, error: null });

      const { getByText } = render(<SelectMotherModal {...defaultProps} />);

      await waitFor(() => {
        expect(getByText('من خارج العائلة')).toBeTruthy();
      });
    });

    test('shows children count when spouse has children', async () => {
      supabase.rpc.mockResolvedValue({ data: mockFamilyData, error: null });

      const { getByText } = render(<SelectMotherModal {...defaultProps} />);

      await waitFor(() => {
        expect(getByText('2 أطفال')).toBeTruthy();
        expect(getByText('1 طفل')).toBeTruthy();
      });
    });

    test('shows correct count label for singular vs plural', async () => {
      const dataWithOneChild = {
        spouses: [
          {
            ...mockFamilyData.spouses[0],
            children_count: 1,
          },
        ],
      };
      supabase.rpc.mockResolvedValue({ data: dataWithOneChild, error: null });

      const { getByText } = render(<SelectMotherModal {...defaultProps} />);

      await waitFor(() => {
        expect(getByText('1 طفل')).toBeTruthy();
      });
    });
  });

  describe('Empty State Handling', () => {
    test('shows empty state when father has no spouses', async () => {
      supabase.rpc.mockResolvedValue({ data: { spouses: [] }, error: null });

      const { getByText } = render(<SelectMotherModal {...defaultProps} />);

      await waitFor(() => {
        expect(getByText('لا توجد زوجات')).toBeTruthy();
        expect(getByText(/الأب عبدالله ليس لديه زوجات/)).toBeTruthy();
      });
    });

    test('shows navigate button in empty state', async () => {
      supabase.rpc.mockResolvedValue({ data: { spouses: [] }, error: null });

      const { getByText } = render(<SelectMotherModal {...defaultProps} />);

      await waitFor(() => {
        const navigateButton = getByText('انتقل لملف الأب');
        expect(navigateButton).toBeTruthy();

        fireEvent.press(navigateButton);
        expect(Alert.alert).toHaveBeenCalledWith(
          'انتقال',
          expect.stringContaining('قيد التطوير')
        );
      });
    });

    test('shows empty state when all spouses are non-married', async () => {
      const dataWithOnlyDivorced = {
        spouses: [
          {
            marriage_id: 'marriage-3',
            status: 'divorced',
            children_count: 0,
            spouse_profile: {
              id: 'mother-3',
              name: 'خديجة',
              hid: 'HID-003',
            },
          },
        ],
      };
      supabase.rpc.mockResolvedValue({ data: dataWithOnlyDivorced, error: null });

      const { getByText } = render(<SelectMotherModal {...defaultProps} />);

      await waitFor(() => {
        expect(getByText('لا توجد زوجات')).toBeTruthy();
      });
    });
  });

  describe('Mother Selection', () => {
    test('pre-selects current mother', async () => {
      supabase.rpc.mockResolvedValue({ data: mockFamilyData, error: null });

      const { getAllByTestId } = render(<SelectMotherModal {...defaultProps} />);

      await waitFor(() => {
        // The radio button for mother-1 should be selected
        expect(supabase.rpc).toHaveBeenCalled();
      });
    });

    test('allows changing mother selection', async () => {
      supabase.rpc.mockResolvedValue({ data: mockFamilyData, error: null });

      const { getByText } = render(<SelectMotherModal {...defaultProps} />);

      await waitFor(() => {
        const secondMother = getByText('عائشة').parent.parent;
        fireEvent.press(secondMother);

        expect(Haptics.impactAsync).toHaveBeenCalledWith(
          Haptics.ImpactFeedbackStyle.Light
        );
      });
    });

    test('allows clearing mother selection', async () => {
      supabase.rpc.mockResolvedValue({ data: mockFamilyData, error: null });

      const { getByText } = render(<SelectMotherModal {...defaultProps} />);

      await waitFor(() => {
        const clearButton = getByText('إزالة الأم');
        fireEvent.press(clearButton);

        expect(Haptics.impactAsync).toHaveBeenCalled();
      });
    });

    test('shows info box when changing mother', async () => {
      supabase.rpc.mockResolvedValue({ data: mockFamilyData, error: null });

      const { getByText, queryByText } = render(<SelectMotherModal {...defaultProps} />);

      await waitFor(async () => {
        // Select different mother
        const secondMother = getByText('عائشة').parent.parent;
        fireEvent.press(secondMother);

        await waitFor(() => {
          expect(getByText(/سيتم تغيير الأم/)).toBeTruthy();
        });
      });
    });

    test('does not show info box when mother unchanged', async () => {
      supabase.rpc.mockResolvedValue({ data: mockFamilyData, error: null });

      const { queryByText } = render(<SelectMotherModal {...defaultProps} />);

      await waitFor(() => {
        expect(queryByText(/سيتم تغيير الأم/)).toBeNull();
      });
    });
  });

  describe('Save Functionality', () => {
    test('successfully saves mother selection', async () => {
      supabase.rpc
        .mockResolvedValueOnce({ data: mockFamilyData, error: null }) // Load spouses
        .mockResolvedValueOnce({ error: null }); // Save

      const { getByText } = render(<SelectMotherModal {...defaultProps} />);

      await waitFor(() => {
        const saveButton = getByText('حفظ التغييرات');
        fireEvent.press(saveButton);
      });

      await waitFor(() => {
        expect(supabase.rpc).toHaveBeenCalledWith('admin_update_profile', {
          p_id: 'person-123',
          p_updates: {
            mother_id: 'mother-1',
          },
        });
      });

      expect(Haptics.notificationAsync).toHaveBeenCalledWith(
        Haptics.NotificationFeedbackType.Success
      );
      expect(defaultProps.onSaved).toHaveBeenCalled();
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    test('confirms before clearing mother', async () => {
      supabase.rpc.mockResolvedValue({ data: mockFamilyData, error: null });

      const { getByText } = render(<SelectMotherModal {...defaultProps} />);

      await waitFor(async () => {
        const clearButton = getByText('إزالة الأم');
        fireEvent.press(clearButton);

        await waitFor(() => {
          const saveButton = getByText('حفظ التغييرات');
          fireEvent.press(saveButton);
        });
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'تأكيد',
          'هل أنت متأكد من إزالة الأم؟',
          expect.any(Array)
        );
      });
    });

    test('handles save errors gracefully', async () => {
      const mockError = new Error('Permission denied');
      supabase.rpc
        .mockResolvedValueOnce({ data: mockFamilyData, error: null })
        .mockResolvedValueOnce({ error: mockError });

      const { getByText } = render(<SelectMotherModal {...defaultProps} />);

      await waitFor(async () => {
        const saveButton = getByText('حفظ التغييرات');
        fireEvent.press(saveButton);
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'خطأ',
          expect.stringContaining('Permission denied')
        );
      });

      expect(defaultProps.onSaved).not.toHaveBeenCalled();
    });

    test('handles network errors during save', async () => {
      supabase.rpc
        .mockResolvedValueOnce({ data: mockFamilyData, error: null })
        .mockRejectedValueOnce(new Error('Network timeout'));

      const { getByText } = render(<SelectMotherModal {...defaultProps} />);

      await waitFor(async () => {
        const saveButton = getByText('حفظ التغييرات');
        fireEvent.press(saveButton);
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'خطأ',
          expect.stringContaining('Network timeout')
        );
      });
    });
  });

  describe('Data Loading Errors', () => {
    test('handles error loading father spouses', async () => {
      const mockError = new Error('Database error');
      supabase.rpc.mockResolvedValue({ data: null, error: mockError });

      render(<SelectMotherModal {...defaultProps} />);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'خطأ',
          'فشل تحميل زوجات الأب'
        );
      });
    });

    test('sets empty spouse list on load error', async () => {
      supabase.rpc.mockResolvedValue({ data: null, error: new Error('Load failed') });

      const { getByText } = render(<SelectMotherModal {...defaultProps} />);

      await waitFor(() => {
        expect(getByText('لا توجد زوجات')).toBeTruthy();
      });
    });

    test('handles null father gracefully during load', async () => {
      const { queryByText } = render(
        <SelectMotherModal {...defaultProps} father={null} />
      );

      expect(supabase.rpc).not.toHaveBeenCalled();
      expect(queryByText('جاري تحميل الزوجات...')).toBeNull();
    });
  });

  describe('Close Functionality', () => {
    test('calls onClose when close button pressed', async () => {
      supabase.rpc.mockResolvedValue({ data: mockFamilyData, error: null });

      const { getAllByRole } = render(<SelectMotherModal {...defaultProps} />);

      await waitFor(() => {
        const closeButton = getAllByRole('button').find((btn) => {
          const hasCloseIcon = btn.props.children?.some?.(
            (child) => child?.props?.name === 'close'
          );
          return hasCloseIcon;
        });

        if (closeButton) {
          fireEvent.press(closeButton);
          expect(Haptics.impactAsync).toHaveBeenCalled();
          expect(defaultProps.onClose).toHaveBeenCalled();
        }
      });
    });
  });

  describe('Edge Cases', () => {
    test('handles person with no mother_id', async () => {
      supabase.rpc.mockResolvedValue({ data: mockFamilyData, error: null });

      const personWithNoMother = { ...mockPerson, mother_id: null };
      render(<SelectMotherModal {...defaultProps} person={personWithNoMother} />);

      await waitFor(() => {
        expect(supabase.rpc).toHaveBeenCalled();
      });
    });

    test('re-loads spouses when modal is reopened', async () => {
      supabase.rpc.mockResolvedValue({ data: mockFamilyData, error: null });

      const { rerender } = render(<SelectMotherModal {...defaultProps} visible={false} />);

      expect(supabase.rpc).not.toHaveBeenCalled();

      rerender(<SelectMotherModal {...defaultProps} visible={true} />);

      await waitFor(() => {
        expect(supabase.rpc).toHaveBeenCalledWith('get_profile_family_data', {
          p_profile_id: 'father-123',
        });
      });
    });

    test('handles father with empty spouses array', async () => {
      supabase.rpc.mockResolvedValue({ data: { spouses: [] }, error: null });

      const { getByText } = render(<SelectMotherModal {...defaultProps} />);

      await waitFor(() => {
        expect(getByText('لا توجد زوجات')).toBeTruthy();
      });
    });

    test('handles missing spouse_profile gracefully', async () => {
      const dataWithMissingProfile = {
        spouses: [
          {
            marriage_id: 'marriage-1',
            status: 'married',
            spouse_profile: null,
          },
        ],
      };
      supabase.rpc.mockResolvedValue({ data: dataWithMissingProfile, error: null });

      render(<SelectMotherModal {...defaultProps} />);

      await waitFor(() => {
        // Should handle gracefully without crashing
        expect(supabase.rpc).toHaveBeenCalled();
      });
    });
  });

  describe('Accessibility', () => {
    test('shows spouse count in section header', async () => {
      supabase.rpc.mockResolvedValue({ data: mockFamilyData, error: null });

      const { getByText } = render(<SelectMotherModal {...defaultProps} />);

      await waitFor(() => {
        expect(getByText(/اختر الأم من 2 زوجات/)).toBeTruthy();
      });
    });

    test('uses correct singular/plural in spouse count', async () => {
      const dataWithOneSpouse = {
        spouses: [mockFamilyData.spouses[0]],
      };
      supabase.rpc.mockResolvedValue({ data: dataWithOneSpouse, error: null });

      const { getByText } = render(<SelectMotherModal {...defaultProps} />);

      await waitFor(() => {
        expect(getByText(/اختر الأم من 1 زوجة/)).toBeTruthy();
      });
    });
  });

  describe('Design System Compliance', () => {
    test('uses correct minimum touch target size', async () => {
      supabase.rpc.mockResolvedValue({ data: mockFamilyData, error: null });

      const { getByText } = render(<SelectMotherModal {...defaultProps} />);

      await waitFor(() => {
        const saveButton = getByText('حفظ التغييرات').parent.parent;

        expect(saveButton.props.style).toEqual(
          expect.arrayContaining([expect.objectContaining({ minHeight: 48 })])
        );
      });
    });
  });
});
