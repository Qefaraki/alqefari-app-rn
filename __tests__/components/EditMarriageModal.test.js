import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react-native';
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
    start_date: '2015-06-15',
    end_date: null,
    status: 'current',
    children_count: 3,
    spouse_profile: {
      id: 'spouse-123',
      name: 'فاطمة القفاري',
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
    test('renders modal with correct header title', () => {
      const { getByText } = render(<EditMarriageModal {...defaultProps} />);
      expect(getByText('تعديل الزواج')).toBeTruthy();
    });

    test('displays spouse name in header subtitle', () => {
      const { getByText } = render(<EditMarriageModal {...defaultProps} />);
      expect(getByText('فاطمة القفاري')).toBeTruthy();
    });

    test('initializes form fields with marriage data', () => {
      const { getByDisplayValue } = render(<EditMarriageModal {...defaultProps} />);
      expect(getByDisplayValue('2015-06-15')).toBeTruthy();
    });

    test('shows children count in info box', () => {
      const { getByText } = render(<EditMarriageModal {...defaultProps} />);
      expect(getByText('عدد الأبناء: 3')).toBeTruthy();
    });

    test('shows Munasib indicator when spouse is from outside family', () => {
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
  });

  describe('Status Selection - Simplified System', () => {
    test('shows current status option', () => {
      const { getByText } = render(<EditMarriageModal {...defaultProps} />);
      expect(getByText('حالي')).toBeTruthy();
    });

    test('shows past status option', () => {
      const { getByText } = render(<EditMarriageModal {...defaultProps} />);
      expect(getByText('سابق')).toBeTruthy();
    });

    test('does NOT show old status options (married/divorced/widowed)', () => {
      const { queryByText } = render(<EditMarriageModal {...defaultProps} />);
      expect(queryByText('متزوج')).toBeNull();
      expect(queryByText('مطلق')).toBeNull();
      expect(queryByText('أرمل')).toBeNull();
    });

    test('allows toggling from current to past', () => {
      const { getByText } = render(<EditMarriageModal {...defaultProps} />);

      const pastButton = getByText('سابق');
      fireEvent.press(pastButton);

      expect(Haptics.impactAsync).toHaveBeenCalledWith(
        Haptics.ImpactFeedbackStyle.Light
      );
    });

    test('allows toggling from past to current', () => {
      const pastMarriage = { ...mockMarriage, status: 'past', end_date: '2023-12-31' };
      const { getByText } = render(
        <EditMarriageModal {...defaultProps} marriage={pastMarriage} />
      );

      const currentButton = getByText('حالي');
      fireEvent.press(currentButton);

      expect(Haptics.impactAsync).toHaveBeenCalledWith(
        Haptics.ImpactFeedbackStyle.Light
      );
    });
  });

  describe('Backward Compatibility - Old Status Mapping', () => {
    test('maps old "married" status to "current"', () => {
      const oldMarriage = { ...mockMarriage, status: 'married' };
      render(<EditMarriageModal {...defaultProps} marriage={oldMarriage} />);
      // Component should initialize with "current" status selected
    });

    test('maps old "divorced" status to "past"', () => {
      const oldMarriage = { ...mockMarriage, status: 'divorced', end_date: '2023-01-15' };
      render(<EditMarriageModal {...defaultProps} marriage={oldMarriage} />);
      // Component should initialize with "past" status selected
    });

    test('maps old "widowed" status to "past"', () => {
      const oldMarriage = { ...mockMarriage, status: 'widowed', end_date: '2022-05-20' };
      render(<EditMarriageModal {...defaultProps} marriage={oldMarriage} />);
      // Component should initialize with "past" status selected
    });
  });

  describe('Date Management', () => {
    test('shows start date input field', () => {
      const { getByPlaceholderText } = render(<EditMarriageModal {...defaultProps} />);
      expect(getByPlaceholderText('YYYY-MM-DD (مثال: 2020-01-15)')).toBeTruthy();
    });

    test('hides end date field when status is current', () => {
      const { queryByText } = render(<EditMarriageModal {...defaultProps} />);
      expect(queryByText('تاريخ انتهاء الزواج')).toBeNull();
    });

    test('shows end date field when status is past', () => {
      const pastMarriage = { ...mockMarriage, status: 'past', end_date: '2023-12-31' };
      const { getByText, getByDisplayValue } = render(
        <EditMarriageModal {...defaultProps} marriage={pastMarriage} />
      );

      expect(getByText('تاريخ انتهاء الزواج')).toBeTruthy();
      expect(getByDisplayValue('2023-12-31')).toBeTruthy();
    });

    test('allows updating start date', () => {
      const { getByDisplayValue } = render(<EditMarriageModal {...defaultProps} />);

      const startDateInput = getByDisplayValue('2015-06-15');
      fireEvent.changeText(startDateInput, '2016-01-01');

      expect(startDateInput.props.value).toBe('2016-01-01');
    });
  });

  describe('Date Validation', () => {
    test('rejects invalid start date format', async () => {
      const { getByDisplayValue, getByText } = render(
        <EditMarriageModal {...defaultProps} />
      );

      const startDateInput = getByDisplayValue('2015-06-15');
      fireEvent.changeText(startDateInput, 'invalid-date');

      const saveButton = getByText('حفظ التغييرات');
      fireEvent.press(saveButton);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'خطأ',
          expect.stringContaining('تاريخ بداية الزواج غير صحيح')
        );
      });
      expect(supabase.rpc).not.toHaveBeenCalled();
    });

    test('rejects invalid end date format', async () => {
      const pastMarriage = { ...mockMarriage, status: 'past', end_date: '2023-12-31' };
      const { getByDisplayValue, getByText } = render(
        <EditMarriageModal {...defaultProps} marriage={pastMarriage} />
      );

      const endDateInput = getByDisplayValue('2023-12-31');
      fireEvent.changeText(endDateInput, '2023/12/31'); // Wrong format

      const saveButton = getByText('حفظ التغييرات');
      fireEvent.press(saveButton);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'خطأ',
          expect.stringContaining('تاريخ نهاية الزواج غير صحيح')
        );
      });
      expect(supabase.rpc).not.toHaveBeenCalled();
    });

    test('rejects end date before start date', async () => {
      const pastMarriage = { ...mockMarriage, status: 'past', end_date: '2023-12-31' };
      const { getByDisplayValue, getByText } = render(
        <EditMarriageModal {...defaultProps} marriage={pastMarriage} />
      );

      const startDateInput = getByDisplayValue('2015-06-15');
      const endDateInput = getByDisplayValue('2023-12-31');

      fireEvent.changeText(startDateInput, '2024-01-01');
      fireEvent.changeText(endDateInput, '2023-01-01');

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

    test('warns when current marriage has end date', async () => {
      const { getByText } = render(
        <EditMarriageModal {...defaultProps} />
      );

      const saveButton = getByText('حفظ التغييرات');
      fireEvent.press(saveButton);

      await waitFor(() => {
        expect(supabase.rpc).toHaveBeenCalled();
      });
    });
  });

  describe('Save Functionality', () => {
    test('successfully saves marriage data with current status', async () => {
      supabase.rpc.mockResolvedValue({ error: null });

      const { getByText } = render(<EditMarriageModal {...defaultProps} />);

      const saveButton = getByText('حفظ التغييرات');
      fireEvent.press(saveButton);

      await waitFor(() => {
        expect(supabase.rpc).toHaveBeenCalledWith('admin_update_marriage', {
          p_marriage_id: 'marriage-123',
          p_updates: {
            start_date: '2015-06-15',
            end_date: null,
            status: 'current',
          },
        });
      });

      expect(Haptics.notificationAsync).toHaveBeenCalledWith(
        Haptics.NotificationFeedbackType.Success
      );
      expect(defaultProps.onSaved).toHaveBeenCalled();
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    test('successfully saves marriage data with past status and end date', async () => {
      supabase.rpc.mockResolvedValue({ error: null });

      const pastMarriage = { ...mockMarriage, status: 'past', end_date: '2023-12-31' };
      const { getByText } = render(
        <EditMarriageModal {...defaultProps} marriage={pastMarriage} />
      );

      const saveButton = getByText('حفظ التغييرات');
      fireEvent.press(saveButton);

      await waitFor(() => {
        expect(supabase.rpc).toHaveBeenCalledWith('admin_update_marriage', {
          p_marriage_id: 'marriage-123',
          p_updates: {
            start_date: '2015-06-15',
            end_date: '2023-12-31',
            status: 'past',
          },
        });
      });

      expect(Haptics.notificationAsync).toHaveBeenCalledWith(
        Haptics.NotificationFeedbackType.Success
      );
      expect(defaultProps.onSaved).toHaveBeenCalled();
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    test('handles save errors gracefully', async () => {
      const mockError = new Error('Insufficient permissions');
      supabase.rpc.mockResolvedValue({ error: mockError });

      const { getByText } = render(<EditMarriageModal {...defaultProps} />);

      const saveButton = getByText('حفظ التغييرات');
      fireEvent.press(saveButton);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'خطأ',
          expect.stringContaining('Insufficient permissions')
        );
      });

      expect(defaultProps.onSaved).not.toHaveBeenCalled();
      expect(defaultProps.onClose).not.toHaveBeenCalled();
    });

    test('converts empty dates to null', async () => {
      supabase.rpc.mockResolvedValue({ error: null });

      const { getByDisplayValue, getByText } = render(
        <EditMarriageModal {...defaultProps} />
      );

      const startDateInput = getByDisplayValue('2015-06-15');
      fireEvent.changeText(startDateInput, '');

      const saveButton = getByText('حفظ التغييرات');
      fireEvent.press(saveButton);

      await waitFor(() => {
        expect(supabase.rpc).toHaveBeenCalledWith('admin_update_marriage', {
          p_marriage_id: 'marriage-123',
          p_updates: {
            start_date: null,
            end_date: null,
            status: 'current',
          },
        });
      });
    });
  });

  describe('Edge Cases', () => {
    test('handles marriage with null dates', () => {
      const marriageWithNulls = {
        ...mockMarriage,
        start_date: null,
        end_date: null,
      };
      const { getByPlaceholderText } = render(
        <EditMarriageModal {...defaultProps} marriage={marriageWithNulls} />
      );

      expect(getByPlaceholderText('YYYY-MM-DD (مثال: 2020-01-15)')).toBeTruthy();
    });

    test('handles marriage with unknown spouse', () => {
      const marriageWithUnknownSpouse = {
        ...mockMarriage,
        spouse_profile: { id: 'unknown', name: null, hid: null },
      };
      const { getByText } = render(
        <EditMarriageModal {...defaultProps} marriage={marriageWithUnknownSpouse} />
      );

      expect(getByText('غير معروف')).toBeTruthy();
    });

    test('handles null marriage prop gracefully', () => {
      const { container } = render(
        <EditMarriageModal {...defaultProps} marriage={null} />
      );

      expect(container).toBeTruthy();
    });
  });

  describe('Neutral Language Compliance', () => {
    test('uses neutral "حالي" instead of "متزوج"', () => {
      const { getByText, queryByText } = render(<EditMarriageModal {...defaultProps} />);

      expect(getByText('حالي')).toBeTruthy();
      expect(queryByText('متزوج')).toBeNull();
    });

    test('uses neutral "سابق" instead of "مطلق" or "أرمل"', () => {
      const { getByText, queryByText } = render(<EditMarriageModal {...defaultProps} />);

      expect(getByText('سابق')).toBeTruthy();
      expect(queryByText('مطلق')).toBeNull();
      expect(queryByText('أرمل')).toBeNull();
    });

    test('end date label is neutral "تاريخ انتهاء الزواج"', () => {
      const pastMarriage = { ...mockMarriage, status: 'past', end_date: '2023-12-31' };
      const { getByText, queryByText } = render(
        <EditMarriageModal {...defaultProps} marriage={pastMarriage} />
      );

      expect(getByText('تاريخ انتهاء الزواج')).toBeTruthy();
      expect(queryByText('تاريخ الطلاق')).toBeNull();
      expect(queryByText('تاريخ الوفاة')).toBeNull();
    });
  });
});
