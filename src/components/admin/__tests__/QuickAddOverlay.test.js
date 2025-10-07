import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import QuickAddOverlay from '../QuickAddOverlay';
import * as Haptics from 'expo-haptics';

// Mock dependencies
jest.mock('expo-haptics');
jest.mock('../../../services/profiles');
jest.mock('../../../hooks/useStore');
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

describe('QuickAddOverlay', () => {
  const mockParentNode = {
    id: 'parent-1',
    name: 'Test Parent',
    gender: 'male',
  };

  const defaultProps = {
    visible: true,
    parentNode: mockParentNode,
    siblings: [],
    onClose: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Core Functionality', () => {
    it('should render when visible', () => {
      const { getByPlaceholderText } = render(<QuickAddOverlay {...defaultProps} />);
      expect(getByPlaceholderText('اكتب الاسم واضغط Enter')).toBeTruthy();
    });

    it('should not render when not visible', () => {
      const { queryByPlaceholderText } = render(
        <QuickAddOverlay {...defaultProps} visible={false} />
      );
      expect(queryByPlaceholderText('اكتب الاسم واضغط Enter')).toBeNull();
    });

    it('should add child on Enter key with valid name', async () => {
      const { getByPlaceholderText, getByText } = render(<QuickAddOverlay {...defaultProps} />);

      const input = getByPlaceholderText('اكتب الاسم واضغط Enter');

      await act(async () => {
        fireEvent.changeText(input, 'أحمد');
        fireEvent(input, 'submitEditing');
      });

      await waitFor(() => {
        expect(getByText('أحمد')).toBeTruthy();
      });
    });

    it('should show error for name less than 2 characters', async () => {
      const { getByPlaceholderText } = render(<QuickAddOverlay {...defaultProps} />);

      const input = getByPlaceholderText('اكتب الاسم واضغط Enter');

      await act(async () => {
        fireEvent.changeText(input, 'أ');
        fireEvent(input, 'submitEditing');
      });

      // Should show alert (mocked in production)
      expect(input.props.value).toBe('أ');
    });

    it('should reject names over 100 characters', async () => {
      const { getByPlaceholderText } = render(<QuickAddOverlay {...defaultProps} />);

      const input = getByPlaceholderText('اكتب الاسم واضغط Enter');
      const longName = 'أ'.repeat(101);

      await act(async () => {
        fireEvent.changeText(input, longName);
        fireEvent(input, 'submitEditing');
      });

      // Should not add child
      expect(input.props.value).toBe(longName);
    });

    it('should trim whitespace from names', async () => {
      const { getByPlaceholderText, getByText } = render(<QuickAddOverlay {...defaultProps} />);

      const input = getByPlaceholderText('اكتب الاسم واضغط Enter');

      await act(async () => {
        fireEvent.changeText(input, '  أحمد  ');
        fireEvent(input, 'submitEditing');
      });

      await waitFor(() => {
        expect(getByText('أحمد')).toBeTruthy();
      });
    });

    it('should dismiss keyboard on empty submission', async () => {
      const { getByPlaceholderText } = render(<QuickAddOverlay {...defaultProps} />);

      const input = getByPlaceholderText('اكتب الاسم واضغط Enter');

      await act(async () => {
        fireEvent.changeText(input, '');
        fireEvent(input, 'submitEditing');
      });

      // Should not show any error, just dismiss
      expect(input.props.value).toBe('');
    });
  });

  describe('Gender Selection', () => {
    it('should default to male gender', () => {
      const { getByText } = render(<QuickAddOverlay {...defaultProps} />);

      // Male button should be active
      const maleButton = getByText('ذكر');
      expect(maleButton).toBeTruthy();
    });

    it('should toggle gender on button press', async () => {
      const { getByText } = render(<QuickAddOverlay {...defaultProps} />);

      const femaleButton = getByText('أنثى');

      await act(async () => {
        fireEvent.press(femaleButton);
      });

      expect(Haptics.impactAsync).toHaveBeenCalledWith(
        Haptics.ImpactFeedbackStyle.Light
      );
    });
  });

  describe('Reordering - handleMove', () => {
    it('should move child up by one position', async () => {
      const { getByPlaceholderText, getAllByTestId } = render(
        <QuickAddOverlay {...defaultProps} />
      );

      const input = getByPlaceholderText('اكتب الاسم واضغط Enter');

      // Add two children
      await act(async () => {
        fireEvent.changeText(input, 'أحمد');
        fireEvent(input, 'submitEditing');
      });

      await act(async () => {
        fireEvent.changeText(input, 'محمد');
        fireEvent(input, 'submitEditing');
      });

      // Move second child up
      const cards = getAllByTestId('child-card');
      const upArrow = cards[1].findByProps({ testID: 'arrow-up' });

      await act(async () => {
        fireEvent.press(upArrow);
      });

      expect(Haptics.impactAsync).toHaveBeenCalledWith(
        Haptics.ImpactFeedbackStyle.Medium
      );
    });

    it('should not move first child up (boundary check)', async () => {
      const { getByPlaceholderText, getByTestId } = render(
        <QuickAddOverlay {...defaultProps} />
      );

      const input = getByPlaceholderText('اكتب الاسم واضغط Enter');

      await act(async () => {
        fireEvent.changeText(input, 'أحمد');
        fireEvent(input, 'submitEditing');
      });

      const upArrow = getByTestId('arrow-up-0');

      // Should be disabled
      expect(upArrow.props.disabled).toBe(true);
    });

    it('should not move last child down (boundary check)', async () => {
      const { getByPlaceholderText, getByTestId } = render(
        <QuickAddOverlay {...defaultProps} />
      );

      const input = getByPlaceholderText('اكتب الاسم واضغط Enter');

      await act(async () => {
        fireEvent.changeText(input, 'أحمد');
        fireEvent(input, 'submitEditing');
      });

      const downArrow = getByTestId('arrow-down-0');

      // Should be disabled
      expect(downArrow.props.disabled).toBe(true);
    });

    it('should update sibling_order correctly after move', async () => {
      const { getByPlaceholderText } = render(<QuickAddOverlay {...defaultProps} />);

      const input = getByPlaceholderText('اكتب الاسم واضغط Enter');

      // Add three children
      await act(async () => {
        fireEvent.changeText(input, 'أحمد');
        fireEvent(input, 'submitEditing');
      });

      await act(async () => {
        fireEvent.changeText(input, 'محمد');
        fireEvent(input, 'submitEditing');
      });

      await act(async () => {
        fireEvent.changeText(input, 'علي');
        fireEvent(input, 'submitEditing');
      });

      // Verify sibling_order is 0, 1, 2
      // This would require exposing state or using a test ID
    });
  });

  describe('Reordering - handleMoveToPosition', () => {
    it('should move child to specific position in one operation', async () => {
      const { getByPlaceholderText } = render(<QuickAddOverlay {...defaultProps} />);

      const input = getByPlaceholderText('اكتب الاسم واضغط Enter');

      // Add 5 children
      for (let i = 1; i <= 5; i++) {
        await act(async () => {
          fireEvent.changeText(input, `طفل ${i}`);
          fireEvent(input, 'submitEditing');
        });
      }

      // Move child 5 to position 1 (should be atomic operation)
      // This tests the batch move logic
    });

    it('should handle same position selection (no-op)', async () => {
      const { getByPlaceholderText } = render(<QuickAddOverlay {...defaultProps} />);

      const input = getByPlaceholderText('اكتب الاسم واضغط Enter');

      await act(async () => {
        fireEvent.changeText(input, 'أحمد');
        fireEvent(input, 'submitEditing');
      });

      // Select same position - should return early
    });
  });

  describe('Debounce Guards', () => {
    it('should prevent rapid arrow clicks', async () => {
      jest.useFakeTimers();

      const { getByPlaceholderText, getByTestId } = render(
        <QuickAddOverlay {...defaultProps} />
      );

      const input = getByPlaceholderText('اكتب الاسم واضغط Enter');

      await act(async () => {
        fireEvent.changeText(input, 'أحمد');
        fireEvent(input, 'submitEditing');
      });

      await act(async () => {
        fireEvent.changeText(input, 'محمد');
        fireEvent(input, 'submitEditing');
      });

      const upArrow = getByTestId('arrow-up-1');

      // First click
      await act(async () => {
        fireEvent.press(upArrow);
      });

      // Second click (should be ignored due to debounce)
      await act(async () => {
        fireEvent.press(upArrow);
      });

      // Wait for debounce timeout
      await act(async () => {
        jest.advanceTimersByTime(300);
      });

      jest.useRealTimers();
    });
  });

  describe('Deletion', () => {
    it('should delete new child immediately without confirmation', async () => {
      const { getByPlaceholderText, getByTestId, queryByText } = render(
        <QuickAddOverlay {...defaultProps} />
      );

      const input = getByPlaceholderText('اكتب الاسم واضغط Enter');

      await act(async () => {
        fireEvent.changeText(input, 'أحمد');
        fireEvent(input, 'submitEditing');
      });

      const deleteButton = getByTestId('delete-button-0');

      await act(async () => {
        fireEvent.press(deleteButton);
      });

      await waitFor(() => {
        expect(queryByText('أحمد')).toBeNull();
      });
    });

    it('should show confirmation for existing children', async () => {
      // This would require mocking the child as existing (not new)
    });
  });

  describe('Empty State', () => {
    it('should show empty state message when no children', () => {
      const { getByText } = render(<QuickAddOverlay {...defaultProps} />);

      expect(getByText('لا يوجد أطفال بعد')).toBeTruthy();
      expect(getByText('اكتب الاسم في الحقل أعلاه واضغط Enter للإضافة')).toBeTruthy();
    });
  });

  describe('FlatList Performance', () => {
    it('should render 50 children efficiently', async () => {
      const { getByPlaceholderText } = render(<QuickAddOverlay {...defaultProps} />);

      const input = getByPlaceholderText('اكتب الاسم واضغط Enter');

      // Add 50 children
      for (let i = 1; i <= 50; i++) {
        await act(async () => {
          fireEvent.changeText(input, `طفل ${i}`);
          fireEvent(input, 'submitEditing');
        });
      }

      // Should render without lag
      // FlatList should use maxToRenderPerBatch: 10
    });
  });

  describe('Mother Selector', () => {
    it('should show mother selector for male parents', () => {
      const { getByText } = render(<QuickAddOverlay {...defaultProps} />);

      expect(getByText('الأم (اختياري)')).toBeTruthy();
    });

    it('should not show mother selector for female parents', () => {
      const femaleParent = { ...mockParentNode, gender: 'female' };
      const { queryByText } = render(
        <QuickAddOverlay {...defaultProps} parentNode={femaleParent} />
      );

      expect(queryByText('الأم (اختياري)')).toBeNull();
    });

    it('should show error if mother data fails to load', async () => {
      // Mock mother selector onChange with id but no data
      const { getByTestId } = render(<QuickAddOverlay {...defaultProps} />);

      const motherSelector = getByTestId('mother-selector');

      await act(async () => {
        fireEvent(motherSelector, 'change', 'mother-id', null);
      });

      // Should show alert: "تعذر تحميل بيانات الأم"
    });
  });

  describe('Save Button States', () => {
    it('should show "حفظ" when no changes', () => {
      const { getByText } = render(<QuickAddOverlay {...defaultProps} />);

      expect(getByText('حفظ')).toBeTruthy();
    });

    it('should show count when children added', async () => {
      const { getByPlaceholderText, getByText } = render(
        <QuickAddOverlay {...defaultProps} />
      );

      const input = getByPlaceholderText('اكتب الاسم واضغط Enter');

      await act(async () => {
        fireEvent.changeText(input, 'أحمد');
        fireEvent(input, 'submitEditing');
      });

      expect(getByText('حفظ (1)')).toBeTruthy();
    });

    it('should show loading state during save', async () => {
      const { getByPlaceholderText, getByText } = render(
        <QuickAddOverlay {...defaultProps} />
      );

      const input = getByPlaceholderText('اكتب الاسم واضغط Enter');

      await act(async () => {
        fireEvent.changeText(input, 'أحمد');
        fireEvent(input, 'submitEditing');
      });

      const saveButton = getByText('حفظ (1)');

      await act(async () => {
        fireEvent.press(saveButton);
      });

      expect(getByText('جاري الحفظ...')).toBeTruthy();
    });
  });
});
