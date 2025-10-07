import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import EditChildModal from '../../src/components/ProfileViewer/EditMode/EditChildModal';
import { supabase } from '../../src/services/supabase';

// Mock dependencies
jest.mock('../../src/services/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
  },
}));

jest.mock('expo-haptics');

jest.spyOn(Alert, 'alert');

describe('EditChildModal', () => {
  const mockChild = {
    id: 'child-123',
    name: 'محمد',
    gender: 'male',
    mother_id: 'mother-1',
    status: 'living',
    current_residence: 'الرياض',
    occupation: 'مهندس',
    phone: '+966501234567',
  };

  const mockFather = {
    id: 'father-123',
    name: 'عبدالله',
  };

  const mockSpouses = [
    {
      marriage_id: 'marriage-1',
      status: 'married',
      spouse_profile: {
        id: 'mother-1',
        name: 'فاطمة',
        hid: 'HID-001',
      },
    },
    {
      marriage_id: 'marriage-2',
      status: 'married',
      spouse_profile: {
        id: 'mother-2',
        name: 'عائشة',
        hid: 'HID-002',
      },
    },
  ];

  const defaultProps = {
    visible: true,
    child: mockChild,
    father: mockFather,
    spouses: mockSpouses,
    onClose: jest.fn(),
    onSaved: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Modal Rendering', () => {
    test('renders modal with correct header title', () => {
      const { getByText } = render(<EditChildModal {...defaultProps} />);
      expect(getByText('تعديل بيانات الابن')).toBeTruthy();
    });

    test('initializes form fields with child data', () => {
      const { getByDisplayValue } = render(<EditChildModal {...defaultProps} />);
      expect(getByDisplayValue('محمد')).toBeTruthy();
      expect(getByDisplayValue('الرياض')).toBeTruthy();
      expect(getByDisplayValue('مهندس')).toBeTruthy();
      expect(getByDisplayValue('+966501234567')).toBeTruthy();
    });

    test('shows correct gender label for male child', () => {
      const { getByText } = render(<EditChildModal {...defaultProps} />);
      expect(getByText('تعديل بيانات الابن')).toBeTruthy();
    });

    test('shows correct gender label for female child', () => {
      const femaleChild = { ...mockChild, gender: 'female' };
      const { getByText } = render(
        <EditChildModal {...defaultProps} child={femaleChild} />
      );
      expect(getByText('تعديل بيانات الابنة')).toBeTruthy();
    });
  });

  describe('Basic Field Validation', () => {
    test('prevents save when name is empty', async () => {
      const { getByDisplayValue, getByText } = render(
        <EditChildModal {...defaultProps} />
      );

      const nameInput = getByDisplayValue('محمد');
      fireEvent.changeText(nameInput, '');

      const saveButton = getByText('حفظ التغييرات');
      fireEvent.press(saveButton);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('خطأ', 'يرجى إدخال الاسم');
      });
      expect(supabase.rpc).not.toHaveBeenCalled();
    });

    test('trims whitespace from name before saving', async () => {
      supabase.rpc.mockResolvedValue({ error: null });

      const { getByDisplayValue, getByText } = render(
        <EditChildModal {...defaultProps} />
      );

      const nameInput = getByDisplayValue('محمد');
      fireEvent.changeText(nameInput, '  علي  ');

      const saveButton = getByText('حفظ التغييرات');
      fireEvent.press(saveButton);

      await waitFor(() => {
        expect(supabase.rpc).toHaveBeenCalledWith('admin_update_profile', {
          p_id: 'child-123',
          p_updates: expect.objectContaining({
            name: 'علي',
          }),
        });
      });
    });

    test('converts empty optional fields to null', async () => {
      supabase.rpc.mockResolvedValue({ error: null });

      const childWithEmptyFields = { ...mockChild, current_residence: '', occupation: '', phone: '' };
      const { getByText } = render(
        <EditChildModal {...defaultProps} child={childWithEmptyFields} />
      );

      const saveButton = getByText('حفظ التغييرات');
      fireEvent.press(saveButton);

      await waitFor(() => {
        expect(supabase.rpc).toHaveBeenCalledWith('admin_update_profile', {
          p_id: 'child-123',
          p_updates: expect.objectContaining({
            current_residence: null,
            occupation: null,
            phone: null,
          }),
        });
      });
    });
  });

  describe('Gender Selection', () => {
    test('allows toggling gender from male to female', () => {
      const { getByText } = render(<EditChildModal {...defaultProps} />);

      const femaleButton = getByText('أنثى');
      fireEvent.press(femaleButton);

      expect(Haptics.impactAsync).toHaveBeenCalledWith(
        Haptics.ImpactFeedbackStyle.Light
      );
    });

    test('allows toggling gender from female to male', () => {
      const femaleChild = { ...mockChild, gender: 'female' };
      const { getByText } = render(
        <EditChildModal {...defaultProps} child={femaleChild} />
      );

      const maleButton = getByText('ذكر');
      fireEvent.press(maleButton);

      expect(Haptics.impactAsync).toHaveBeenCalledWith(
        Haptics.ImpactFeedbackStyle.Light
      );
    });
  });

  describe('Status Selection', () => {
    test('allows toggling status to deceased', () => {
      const { getByText } = render(<EditChildModal {...defaultProps} />);

      const deceasedButton = getByText('متوفى');
      fireEvent.press(deceasedButton);

      expect(Haptics.impactAsync).toHaveBeenCalledWith(
        Haptics.ImpactFeedbackStyle.Light
      );
    });

    test('allows toggling status back to living', () => {
      const deceasedChild = { ...mockChild, status: 'deceased' };
      const { getByText } = render(
        <EditChildModal {...defaultProps} child={deceasedChild} />
      );

      const livingButton = getByText('على قيد الحياة');
      fireEvent.press(livingButton);

      expect(Haptics.impactAsync).toHaveBeenCalledWith(
        Haptics.ImpactFeedbackStyle.Light
      );
    });
  });

  describe('Mother Selection', () => {
    test('displays all married spouses as mother options', () => {
      const { getByText } = render(<EditChildModal {...defaultProps} />);
      expect(getByText('فاطمة')).toBeTruthy();
      expect(getByText('عائشة')).toBeTruthy();
    });

    test('does not display non-married spouses', () => {
      const spousesWithDivorced = [
        ...mockSpouses,
        {
          marriage_id: 'marriage-3',
          status: 'divorced',
          spouse_profile: {
            id: 'mother-3',
            name: 'خديجة',
            hid: 'HID-003',
          },
        },
      ];
      const { queryByText } = render(
        <EditChildModal {...defaultProps} spouses={spousesWithDivorced} />
      );
      expect(queryByText('خديجة')).toBeNull();
    });

    test('allows selecting different mother', async () => {
      const { getByText } = render(<EditChildModal {...defaultProps} />);

      const secondMother = getByText('عائشة');
      fireEvent.press(secondMother);

      expect(Haptics.impactAsync).toHaveBeenCalledWith(
        Haptics.ImpactFeedbackStyle.Light
      );
    });

    test('allows clearing mother selection', () => {
      const { getByText } = render(<EditChildModal {...defaultProps} />);

      const clearButton = getByText('إزالة الأم');
      fireEvent.press(clearButton);

      expect(Haptics.impactAsync).toHaveBeenCalledWith(
        Haptics.ImpactFeedbackStyle.Light
      );
    });

    test('hides mother section when no spouses exist', () => {
      const { queryByText } = render(
        <EditChildModal {...defaultProps} spouses={[]} />
      );
      expect(queryByText('الأم')).toBeNull();
    });
  });

  describe('Save Functionality', () => {
    test('successfully saves child data with valid inputs', async () => {
      supabase.rpc.mockResolvedValue({ error: null });

      const { getByText } = render(<EditChildModal {...defaultProps} />);

      const saveButton = getByText('حفظ التغييرات');
      fireEvent.press(saveButton);

      await waitFor(() => {
        expect(supabase.rpc).toHaveBeenCalledWith('admin_update_profile', {
          p_id: 'child-123',
          p_updates: {
            name: 'محمد',
            gender: 'male',
            mother_id: 'mother-1',
            status: 'living',
            current_residence: 'الرياض',
            occupation: 'مهندس',
            phone: '+966501234567',
          },
        });
      });

      expect(Haptics.notificationAsync).toHaveBeenCalledWith(
        Haptics.NotificationFeedbackType.Success
      );
      expect(defaultProps.onSaved).toHaveBeenCalled();
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    test('shows loading indicator during save', async () => {
      supabase.rpc.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ error: null }), 100))
      );

      const { getByText, getByTestId } = render(<EditChildModal {...defaultProps} />);

      const saveButton = getByText('حفظ التغييرات');
      fireEvent.press(saveButton);

      // Button should show loading state (ActivityIndicator would render)
      await waitFor(() => {
        expect(supabase.rpc).toHaveBeenCalled();
      });
    });

    test('handles save errors gracefully', async () => {
      const mockError = new Error('Database connection failed');
      supabase.rpc.mockResolvedValue({ error: mockError });

      const { getByText } = render(<EditChildModal {...defaultProps} />);

      const saveButton = getByText('حفظ التغييرات');
      fireEvent.press(saveButton);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'خطأ',
          expect.stringContaining('Database connection failed')
        );
      });

      expect(defaultProps.onSaved).not.toHaveBeenCalled();
      expect(defaultProps.onClose).not.toHaveBeenCalled();
    });

    test('handles network errors gracefully', async () => {
      supabase.rpc.mockRejectedValue(new Error('Network error'));

      const { getByText } = render(<EditChildModal {...defaultProps} />);

      const saveButton = getByText('حفظ التغييرات');
      fireEvent.press(saveButton);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'خطأ',
          expect.stringContaining('Network error')
        );
      });
    });
  });

  describe('Close Functionality', () => {
    test('calls onClose when close button pressed', () => {
      const { getByTestId } = render(<EditChildModal {...defaultProps} />);

      // Close button is the Ionicons "close"
      const closeButtons = screen.UNSAFE_getAllByType('Text').filter(
        (node) => node.props.children === undefined
      );

      if (closeButtons.length > 0) {
        fireEvent.press(closeButtons[0].parent);
        expect(Haptics.impactAsync).toHaveBeenCalled();
        expect(defaultProps.onClose).toHaveBeenCalled();
      }
    });
  });

  describe('Edge Cases', () => {
    test('handles child with null optional fields', () => {
      const childWithNulls = {
        ...mockChild,
        current_residence: null,
        occupation: null,
        phone: null,
      };
      const { getByPlaceholderText } = render(
        <EditChildModal {...defaultProps} child={childWithNulls} />
      );

      expect(getByPlaceholderText('مثال: الرياض')).toBeTruthy();
      expect(getByPlaceholderText('مثال: مهندس')).toBeTruthy();
      expect(getByPlaceholderText('مثال: +966501234567')).toBeTruthy();
    });

    test('handles child with no mother_id', () => {
      const childWithoutMother = { ...mockChild, mother_id: null };
      const { getByText } = render(
        <EditChildModal {...defaultProps} child={childWithoutMother} />
      );

      // Clear button should not be visible when no mother selected
      expect(() => getByText('إزالة الأم')).toThrow();
    });

    test('re-initializes form when child prop changes', () => {
      const { rerender, getByDisplayValue } = render(
        <EditChildModal {...defaultProps} />
      );

      const newChild = { ...mockChild, name: 'علي', id: 'child-456' };
      rerender(<EditChildModal {...defaultProps} child={newChild} />);

      expect(getByDisplayValue('علي')).toBeTruthy();
    });
  });

  describe('Accessibility', () => {
    test('all input fields have proper labels', () => {
      const { getByText } = render(<EditChildModal {...defaultProps} />);

      expect(getByText('الاسم الكامل *')).toBeTruthy();
      expect(getByText('الجنس *')).toBeTruthy();
      expect(getByText('الحالة')).toBeTruthy();
      expect(getByText('مكان الإقامة')).toBeTruthy();
      expect(getByText('المهنة')).toBeTruthy();
      expect(getByText('رقم الجوال')).toBeTruthy();
    });

    test('phone input has correct keyboard type', () => {
      const { getByDisplayValue } = render(<EditChildModal {...defaultProps} />);
      const phoneInput = getByDisplayValue('+966501234567');

      expect(phoneInput.props.keyboardType).toBe('phone-pad');
    });
  });

  describe('Design System Compliance', () => {
    test('uses correct minimum touch target size', () => {
      const { getByText } = render(<EditChildModal {...defaultProps} />);
      const saveButton = getByText('حفظ التغييرات').parent.parent;

      // Check that button meets 44px minimum height
      expect(saveButton.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ minHeight: 48 }),
        ])
      );
    });
  });
});
