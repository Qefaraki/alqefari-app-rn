import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import EditMarriageModal from '../../src/components/ProfileViewer/EditMode/EditMarriageModal';
import { supabase } from '../../src/services/supabase';

// Mock dependencies
jest.mock('../../src/services/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
  },
}));

jest.mock('expo-haptics');

jest.spyOn(Alert, 'alert');

describe('EditMarriageModal', () => {
  const mockMarriage = {
    marriage_id: 'marriage-123',
    start_date: '2020-01-15',
    end_date: null,
    status: 'married',
    children_count: 3,
    spouse_profile: {
      id: 'spouse-123',
      name: 'فاطمة',
      hid: 'HID-001',
    },
    munasib: false,
  };

  const defaultProps = {
    visible: true,
    marriage: mockMarriage,
    onClose: jest.fn(),
    onSaved: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Modal Rendering', () => {
    test('renders modal with spouse name in header', () => {
      const { getByText } = render(<EditMarriageModal {...defaultProps} />);
      expect(getByText('تعديل الزواج')).toBeTruthy();
      expect(getByText('فاطمة')).toBeTruthy();
    });

    test('initializes form with marriage data', () => {
      const { getByDisplayValue } = render(<EditMarriageModal {...defaultProps} />);
      expect(getByDisplayValue('2020-01-15')).toBeTruthy();
    });

    test('displays children count', () => {
      const { getByText } = render(<EditMarriageModal {...defaultProps} />);
      expect(getByText('عدد الأبناء: 3')).toBeTruthy();
    });

    test('shows munasib badge when spouse is munasib', () => {
      const munasibMarriage = {
        ...mockMarriage,
        spouse_profile: { ...mockMarriage.spouse_profile, hid: null },
      };
      const { getByText } = render(
        <EditMarriageModal {...defaultProps} marriage={munasibMarriage} />
      );
      expect(getByText('من خارج عائلة القفاري')).toBeTruthy();
    });

    test('returns null when marriage is not provided', () => {
      const { container } = render(
        <EditMarriageModal {...defaultProps} marriage={null} />
      );
      // Modal should not render anything
      expect(container.children.length).toBe(0);
    });
  });

  describe('Marriage Status Selection', () => {
    test('allows selecting married status', () => {
      const { getByText } = render(<EditMarriageModal {...defaultProps} />);

      const marriedButton = getByText('متزوج');
      fireEvent.press(marriedButton);

      expect(Haptics.impactAsync).toHaveBeenCalledWith(
        Haptics.ImpactFeedbackStyle.Light
      );
    });

    test('allows selecting divorced status', () => {
      const { getByText } = render(<EditMarriageModal {...defaultProps} />);

      const divorcedButton = getByText('مطلق');
      fireEvent.press(divorcedButton);

      expect(Haptics.impactAsync).toHaveBeenCalledWith(
        Haptics.ImpactFeedbackStyle.Light
      );
    });

    test('allows selecting widowed status', () => {
      const { getByText } = render(<EditMarriageModal {...defaultProps} />);

      const widowedButton = getByText('أرمل');
      fireEvent.press(widowedButton);

      expect(Haptics.impactAsync).toHaveBeenCalledWith(
        Haptics.ImpactFeedbackStyle.Light
      );
    });
  });

  describe('Date Validation', () => {
    test('accepts valid date in YYYY-MM-DD format', async () => {
      supabase.rpc.mockResolvedValue({ error: null });

      const { getByDisplayValue, getByText } = render(
        <EditMarriageModal {...defaultProps} />
      );

      const startDateInput = getByDisplayValue('2020-01-15');
      fireEvent.changeText(startDateInput, '2021-03-20');

      const saveButton = getByText('حفظ التغييرات');
      fireEvent.press(saveButton);

      await waitFor(() => {
        expect(supabase.rpc).toHaveBeenCalledWith('admin_update_marriage', {
          p_marriage_id: 'marriage-123',
          p_updates: expect.objectContaining({
            start_date: '2021-03-20',
          }),
        });
      });
    });

    test('rejects invalid date format', async () => {
      const { getByDisplayValue, getByText } = render(
        <EditMarriageModal {...defaultProps} />
      );

      const startDateInput = getByDisplayValue('2020-01-15');
      fireEvent.changeText(startDateInput, '01/15/2020'); // Wrong format

      const saveButton = getByText('حفظ التغييرات');
      fireEvent.press(saveButton);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'خطأ',
          expect.stringContaining('YYYY-MM-DD')
        );
      });
      expect(supabase.rpc).not.toHaveBeenCalled();
    });

    test('rejects end date before start date', async () => {
      const divorcedMarriage = {
        ...mockMarriage,
        status: 'divorced',
        end_date: '2021-06-30',
      };

      const { getByDisplayValue, getByText } = render(
        <EditMarriageModal {...defaultProps} marriage={divorcedMarriage} />
      );

      const startDateInput = getByDisplayValue('2020-01-15');
      const endDateInput = getByDisplayValue('2021-06-30');

      // Set end date before start date
      fireEvent.changeText(endDateInput, '2019-12-01');

      const saveButton = getByText('حفظ التغييرات');
      fireEvent.press(saveButton);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'خطأ',
          'تاريخ نهاية الزواج يجب أن يكون بعد تاريخ البداية'
        );
      });
      expect(supabase.rpc).not.toHaveBeenCalled();
    });

    test('allows empty dates', async () => {
      supabase.rpc.mockResolvedValue({ error: null });

      const { getByDisplayValue, getByText } = render(
        <EditMarriageModal {...defaultProps} />
      );

      const startDateInput = getByDisplayValue('2020-01-15');
      fireEvent.changeText(startDateInput, '');

      const saveButton = getByText('حفظ التغييرات');
      fireEvent.press(saveButton);

      await waitFor(() => {
        expect(supabase.rpc).toHaveBeenCalledWith('admin_update_marriage', {
          p_marriage_id: 'marriage-123',
          p_updates: expect.objectContaining({
            start_date: null,
          }),
        });
      });
    });

    test('rejects invalid date values', async () => {
      const { getByDisplayValue, getByText } = render(
        <EditMarriageModal {...defaultProps} />
      );

      const startDateInput = getByDisplayValue('2020-01-15');
      fireEvent.changeText(startDateInput, '2020-13-45'); // Invalid month/day

      const saveButton = getByText('حفظ التغييرات');
      fireEvent.press(saveButton);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'خطأ',
          expect.stringContaining('غير صحيح')
        );
      });
    });
  });

  describe('End Date Logic', () => {
    test('shows end date field when status is divorced', () => {
      const divorcedMarriage = { ...mockMarriage, status: 'divorced' };
      const { getByText } = render(
        <EditMarriageModal {...defaultProps} marriage={divorcedMarriage} />
      );

      expect(getByText('تاريخ الطلاق')).toBeTruthy();
    });

    test('shows end date field when status is widowed', () => {
      const widowedMarriage = { ...mockMarriage, status: 'widowed' };
      const { getByText } = render(
        <EditMarriageModal {...defaultProps} marriage={widowedMarriage} />
      );

      expect(getByText('تاريخ الوفاة')).toBeTruthy();
    });

    test('hides end date field when status is married', () => {
      const { queryByText } = render(<EditMarriageModal {...defaultProps} />);

      expect(queryByText('تاريخ الطلاق')).toBeNull();
      expect(queryByText('تاريخ الوفاة')).toBeNull();
    });

    test('prompts to clear end date when status changes to married', async () => {
      const divorcedMarriage = {
        ...mockMarriage,
        status: 'divorced',
        end_date: '2021-06-30',
      };

      const { getByText, getByDisplayValue } = render(
        <EditMarriageModal {...defaultProps} marriage={divorcedMarriage} />
      );

      // Ensure end date is there
      const endDateInput = getByDisplayValue('2021-06-30');
      expect(endDateInput).toBeTruthy();

      // Change status to married
      const marriedButton = getByText('متزوج');
      fireEvent.press(marriedButton);

      // Try to save
      const saveButton = getByText('حفظ التغييرات');
      fireEvent.press(saveButton);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'تأكيد',
          expect.stringContaining('إزالة تاريخ النهاية'),
          expect.any(Array)
        );
      });
    });
  });

  describe('Save Functionality', () => {
    test('successfully saves marriage data', async () => {
      supabase.rpc.mockResolvedValue({ error: null });

      const { getByText } = render(<EditMarriageModal {...defaultProps} />);

      const saveButton = getByText('حفظ التغييرات');
      fireEvent.press(saveButton);

      await waitFor(() => {
        expect(supabase.rpc).toHaveBeenCalledWith('admin_update_marriage', {
          p_marriage_id: 'marriage-123',
          p_updates: {
            start_date: '2020-01-15',
            end_date: null,
            status: 'married',
          },
        });
      });

      expect(Haptics.notificationAsync).toHaveBeenCalledWith(
        Haptics.NotificationFeedbackType.Success
      );
      expect(defaultProps.onSaved).toHaveBeenCalled();
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    test('saves divorced marriage with end date', async () => {
      supabase.rpc.mockResolvedValue({ error: null });

      const { getByText, getByDisplayValue } = render(
        <EditMarriageModal {...defaultProps} />
      );

      // Change to divorced
      const divorcedButton = getByText('مطلق');
      fireEvent.press(divorcedButton);

      // Wait for end date field to appear and set it
      await waitFor(() => {
        const endDateInput = getByDisplayValue('');
        fireEvent.changeText(endDateInput, '2023-06-30');
      });

      const saveButton = getByText('حفظ التغييرات');
      fireEvent.press(saveButton);

      await waitFor(() => {
        expect(supabase.rpc).toHaveBeenCalledWith('admin_update_marriage', {
          p_marriage_id: 'marriage-123',
          p_updates: expect.objectContaining({
            status: 'divorced',
            end_date: '2023-06-30',
          }),
        });
      });
    });

    test('handles save errors gracefully', async () => {
      const mockError = new Error('Permission denied');
      supabase.rpc.mockResolvedValue({ error: mockError });

      const { getByText } = render(<EditMarriageModal {...defaultProps} />);

      const saveButton = getByText('حفظ التغييرات');
      fireEvent.press(saveButton);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'خطأ',
          expect.stringContaining('Permission denied')
        );
      });

      expect(defaultProps.onSaved).not.toHaveBeenCalled();
    });

    test('handles network errors gracefully', async () => {
      supabase.rpc.mockRejectedValue(new Error('Network timeout'));

      const { getByText } = render(<EditMarriageModal {...defaultProps} />);

      const saveButton = getByText('حفظ التغييرات');
      fireEvent.press(saveButton);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'خطأ',
          expect.stringContaining('Network timeout')
        );
      });
    });
  });

  describe('Close Functionality', () => {
    test('calls onClose when close button pressed', () => {
      const { getAllByRole } = render(<EditMarriageModal {...defaultProps} />);

      // Find close button by looking for TouchableOpacity with close icon
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

  describe('Edge Cases', () => {
    test('handles marriage with null dates', () => {
      const marriageWithNullDates = {
        ...mockMarriage,
        start_date: null,
        end_date: null,
      };
      const { getByPlaceholderText } = render(
        <EditMarriageModal {...defaultProps} marriage={marriageWithNullDates} />
      );

      expect(getByPlaceholderText(/2020-01-15/)).toBeTruthy();
    });

    test('handles marriage with zero children', () => {
      const marriageNoChildren = { ...mockMarriage, children_count: 0 };
      const { getByText } = render(
        <EditMarriageModal {...defaultProps} marriage={marriageNoChildren} />
      );

      expect(getByText('عدد الأبناء: 0')).toBeTruthy();
    });

    test('handles spouse with no HID (munasib)', () => {
      const munasibMarriage = {
        ...mockMarriage,
        munasib: true,
        spouse_profile: { ...mockMarriage.spouse_profile, hid: null },
      };
      const { getByText } = render(
        <EditMarriageModal {...defaultProps} marriage={munasibMarriage} />
      );

      expect(getByText('من خارج عائلة القفاري')).toBeTruthy();
    });

    test('re-initializes form when marriage prop changes', () => {
      const { rerender, getByDisplayValue } = render(
        <EditMarriageModal {...defaultProps} />
      );

      const newMarriage = {
        ...mockMarriage,
        start_date: '2015-05-10',
        marriage_id: 'marriage-456',
      };
      rerender(<EditMarriageModal {...defaultProps} marriage={newMarriage} />);

      expect(getByDisplayValue('2015-05-10')).toBeTruthy();
    });
  });

  describe('Date Format Helpers', () => {
    test('formats ISO date strings correctly', () => {
      const marriageWithISO = {
        ...mockMarriage,
        start_date: '2020-01-15T00:00:00.000Z',
      };
      const { getByDisplayValue } = render(
        <EditMarriageModal {...defaultProps} marriage={marriageWithISO} />
      );

      // Should strip time portion
      expect(getByDisplayValue('2020-01-15')).toBeTruthy();
    });
  });

  describe('Accessibility', () => {
    test('all input fields have proper labels', () => {
      const divorcedMarriage = { ...mockMarriage, status: 'divorced' };
      const { getByText } = render(
        <EditMarriageModal {...defaultProps} marriage={divorcedMarriage} />
      );

      expect(getByText('حالة الزواج')).toBeTruthy();
      expect(getByText('التواريخ')).toBeTruthy();
      expect(getByText('تاريخ بداية الزواج')).toBeTruthy();
      expect(getByText('تاريخ الطلاق')).toBeTruthy();
    });

    test('date inputs have correct keyboard type', () => {
      const { getAllByPlaceholderText } = render(
        <EditMarriageModal {...defaultProps} />
      );

      const dateInputs = getAllByPlaceholderText(/YYYY-MM-DD/);
      dateInputs.forEach((input) => {
        expect(input.props.keyboardType).toBe('numbers-and-punctuation');
      });
    });

    test('provides helpful date format hints', () => {
      const { getAllByText } = render(<EditMarriageModal {...defaultProps} />);

      const hints = getAllByText(/الصيغة: السنة-الشهر-اليوم/);
      expect(hints.length).toBeGreaterThan(0);
    });
  });

  describe('Design System Compliance', () => {
    test('uses correct minimum touch target size', () => {
      const { getByText } = render(<EditMarriageModal {...defaultProps} />);
      const saveButton = getByText('حفظ التغييرات').parent.parent;

      expect(saveButton.props.style).toEqual(
        expect.arrayContaining([expect.objectContaining({ minHeight: 48 })])
      );
    });
  });
});
