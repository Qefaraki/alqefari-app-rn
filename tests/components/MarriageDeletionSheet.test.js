/**
 * MarriageDeletionSheet.test.js
 *
 * Comprehensive test suite for marriage deletion system.
 * Tests all 8 critical scenarios with edge cases.
 *
 * Test Scenarios:
 * 1. Delete cousin marriage (0 children)
 * 2. Delete cousin marriage (3+ children)
 * 3. Delete Munasib marriage (single, 0 children)
 * 4. Delete Munasib marriage (single, 5+ children)
 * 5. Delete Munasib with multiple marriages
 * 6. Network timeout on slow network
 * 7. Permission change while sheet open
 * 8. Marriage deleted by another admin
 */

import React from 'react';
import { render, waitFor, fireEvent, act } from '@testing-library/react-native';
import MarriageDeletionSheet from '../../src/components/ProfileViewer/EditMode/MarriageDeletionSheet';

// Mock Supabase
jest.mock('../../src/services/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

// Mock modules
jest.mock('expo-blur', () => ({
  BlurView: ({ children }) => children,
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  selectionAsync: jest.fn(),
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

jest.mock('../../src/components/ui/tokens', () => ({
  colors: {
    najdi: {
      primary: '#8B4513',
      crimson: '#A13333',
      text: '#242121',
      textMuted: '#6B6B6B',
      background: '#E8E2D9',
      camelHair: '#D1BBA3',
    },
    surface: '#F9F7F3',
    divider: '#D1BBA3',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
  },
  radii: {
    lg: 8,
  },
}));

const { supabase } = require('../../src/services/supabase');

// Mock marriage data
const createMockMarriage = (overrides = {}) => ({
  marriage_id: 'marriage-123',
  husband_id: 'spouse-456',
  wife_id: 'main-profile',
  status: 'current',
  spouse_profile: {
    id: 'spouse-456',
    name: 'أم الأطفال',
    gender: 'female',
    hid: null, // Munasib by default
  },
  ...overrides,
});

const createMockCousinMarriage = (overrides = {}) => ({
  ...createMockMarriage(overrides),
  spouse_profile: {
    ...createMockMarriage(overrides).spouse_profile,
    hid: '5.6.7', // Cousin - has HID
  },
});

describe('MarriageDeletionSheet', () => {
  let mockOnConfirm;
  let mockOnCancel;

  beforeEach(() => {
    jest.clearAllMocks();
    mockOnConfirm = jest.fn();
    mockOnCancel = jest.fn();

    // Default mock implementation
    supabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          is: jest.fn().mockResolvedValue({
            count: 0,
            error: null,
          }),
        }),
        or: jest.fn().mockReturnValue({
          neq: jest.fn().mockReturnValue({
            is: jest.fn().mockResolvedValue({
              count: 0,
              error: null,
            }),
          }),
        }),
      }),
    });
  });

  // ============================================================================
  // SCENARIO 1: Delete cousin marriage (0 children)
  // ============================================================================
  describe('Scenario 1: Delete cousin marriage (0 children)', () => {
    test('should fetch and display cousin marriage data', async () => {
      const marriage = createMockCousinMarriage();

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            is: jest.fn().mockResolvedValue({
              count: 0,
              error: null,
            }),
          }),
        }),
      });

      const { getByText, getByTestId } = render(
        <MarriageDeletionSheet
          visible={true}
          marriage={marriage}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      await waitFor(() => {
        // Should show cousin marriage warning
        expect(getByText(/زواج قريب/i)).toBeTruthy();
      });
    });

    test('should show warning about spouse remaining in tree', async () => {
      const marriage = createMockCousinMarriage();

      const { getByText } = render(
        <MarriageDeletionSheet
          visible={true}
          marriage={marriage}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      await waitFor(() => {
        expect(getByText(/سيبقى في الشجرة/i)).toBeTruthy();
      });
    });

    test('should not show children warning when count is 0', async () => {
      const marriage = createMockCousinMarriage();

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            is: jest.fn().mockResolvedValue({
              count: 0,
              error: null,
            }),
          }),
        }),
      });

      const { queryByText } = render(
        <MarriageDeletionSheet
          visible={true}
          marriage={marriage}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      await waitFor(() => {
        expect(queryByText(/أطفال/i)).toBeFalsy();
      });
    });
  });

  // ============================================================================
  // SCENARIO 2: Delete cousin marriage (3+ children)
  // ============================================================================
  describe('Scenario 2: Delete cousin marriage (3+ children)', () => {
    test('should show warning about affected children', async () => {
      const marriage = createMockCousinMarriage();

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            is: jest.fn().mockResolvedValue({
              count: 3,
              error: null,
            }),
          }),
        }),
      });

      const { getByText } = render(
        <MarriageDeletionSheet
          visible={true}
          marriage={marriage}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      await waitFor(() => {
        expect(getByText(/3 أطفال/i)).toBeTruthy();
      });
    });

    test('should correctly pluralize children count', async () => {
      const marriage = createMockCousinMarriage();

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            is: jest.fn().mockResolvedValue({
              count: 5,
              error: null,
            }),
          }),
        }),
      });

      const { getByText } = render(
        <MarriageDeletionSheet
          visible={true}
          marriage={marriage}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      await waitFor(() => {
        expect(getByText(/5 أطفال/i)).toBeTruthy();
      });
    });
  });

  // ============================================================================
  // SCENARIO 3: Delete Munasib marriage (single, 0 children)
  // ============================================================================
  describe('Scenario 3: Delete Munasib marriage (single, 0 children)', () => {
    test('should detect Munasib marriage (no HID)', async () => {
      const marriage = createMockMarriage();

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            is: jest.fn().mockResolvedValue({
              count: 0,
              error: null,
            }),
          }),
          or: jest.fn().mockReturnValue({
            neq: jest.fn().mockReturnValue({
              is: jest.fn().mockResolvedValue({
                count: 0, // No other marriages
                error: null,
              }),
            }),
          }),
        }),
      });

      const { getByText } = render(
        <MarriageDeletionSheet
          visible={true}
          marriage={marriage}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      await waitFor(() => {
        // Should warn that both marriage AND spouse profile will be deleted
        expect(getByText(/سيتم حذفهما معاً من الشجرة/i)).toBeTruthy();
      });
    });

    test('should show warning about spouse profile deletion', async () => {
      const marriage = createMockMarriage();

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            is: jest.fn().mockResolvedValue({
              count: 0,
              error: null,
            }),
          }),
          or: jest.fn().mockReturnValue({
            neq: jest.fn().mockReturnValue({
              is: jest.fn().mockResolvedValue({
                count: 0,
                error: null,
              }),
            }),
          }),
        }),
      });

      const { getByText } = render(
        <MarriageDeletionSheet
          visible={true}
          marriage={marriage}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      await waitFor(() => {
        expect(getByText(/ملف/i)).toBeTruthy();
        expect(getByText(/سيتم حذفهما/i)).toBeTruthy();
      });
    });
  });

  // ============================================================================
  // SCENARIO 4: Delete Munasib marriage (single, 5+ children)
  // ============================================================================
  describe('Scenario 4: Delete Munasib marriage (single, 5+ children)', () => {
    test('should show warning about children losing mother reference', async () => {
      const marriage = createMockMarriage();

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            is: jest.fn().mockResolvedValue({
              count: 5,
              error: null,
            }),
          }),
          or: jest.fn().mockReturnValue({
            neq: jest.fn().mockReturnValue({
              is: jest.fn().mockResolvedValue({
                count: 0,
                error: null,
              }),
            }),
          }),
        }),
      });

      const { getByText } = render(
        <MarriageDeletionSheet
          visible={true}
          marriage={marriage}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      await waitFor(() => {
        expect(getByText(/5 أطفال/i)).toBeTruthy();
        expect(getByText(/إزالة رابط/i)).toBeTruthy();
      });
    });
  });

  // ============================================================================
  // SCENARIO 5: Delete Munasib with multiple marriages
  // ============================================================================
  describe('Scenario 5: Delete Munasib with multiple marriages', () => {
    test('should keep spouse profile when has other marriages', async () => {
      const marriage = createMockMarriage();

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            is: jest.fn().mockResolvedValue({
              count: 0,
              error: null,
            }),
          }),
          or: jest.fn().mockReturnValue({
            neq: jest.fn().mockReturnValue({
              is: jest.fn().mockResolvedValue({
                count: 2, // Has other marriages
                error: null,
              }),
            }),
          }),
        }),
      });

      const { getByText, queryByText } = render(
        <MarriageDeletionSheet
          visible={true}
          marriage={marriage}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      await waitFor(() => {
        // Should say marriage deleted but profile remains
        expect(getByText(/سيبقى.*لديه زيجات أخرى/i)).toBeTruthy();
        // Should NOT say both will be deleted
        expect(queryByText(/سيتم حذفهما معاً/i)).toBeFalsy();
      });
    });
  });

  // ============================================================================
  // SCENARIO 6: Network timeout on slow network
  // ============================================================================
  describe('Scenario 6: Network timeout on slow network', () => {
    test('should show error after 10 second timeout', async () => {
      const marriage = createMockMarriage();

      // Simulate slow network - promise never resolves
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            is: jest.fn(() => new Promise(() => {})), // Never resolves
          }),
        }),
      });

      const { getByText, queryByText } = render(
        <MarriageDeletionSheet
          visible={true}
          marriage={marriage}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      // Initially should show loading
      expect(queryByText(/جارٍ تحميل/i)).toBeTruthy();

      // After 10 seconds, should show timeout error
      await waitFor(
        () => {
          expect(getByText(/انتهى وقت الاتصال/i)).toBeTruthy();
        },
        { timeout: 11000 }
      );
    });

    test('should show retry button in error state', async () => {
      const marriage = createMockMarriage();

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            is: jest.fn().mockRejectedValue(new Error('انتهى وقت الاتصال')),
          }),
        }),
      });

      const { getByText } = render(
        <MarriageDeletionSheet
          visible={true}
          marriage={marriage}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      await waitFor(() => {
        expect(getByText(/حاول مرة أخرى/i)).toBeTruthy();
      });
    });

    test('should retry fetch when retry button clicked', async () => {
      const marriage = createMockMarriage();
      let callCount = 0;

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            is: jest.fn(() => {
              callCount++;
              if (callCount === 1) {
                return Promise.reject(new Error('انتهى وقت الاتصال'));
              }
              return Promise.resolve({ count: 0, error: null });
            }),
          }),
        }),
      });

      const { getByText } = render(
        <MarriageDeletionSheet
          visible={true}
          marriage={marriage}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      // Wait for error state
      await waitFor(() => {
        expect(getByText(/حاول مرة أخرى/i)).toBeTruthy();
      });

      // Click retry button
      const retryButton = getByText(/حاول مرة أخرى/i);
      fireEvent.press(retryButton);

      // Should fetch again
      await waitFor(() => {
        expect(callCount).toBe(2);
      });
    });
  });

  // ============================================================================
  // SCENARIO 7: Permission change while sheet open
  // ============================================================================
  describe('Scenario 7: Permission change while sheet open', () => {
    test('should disable delete button when loading data', async () => {
      const marriage = createMockMarriage();

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            is: jest.fn(
              () =>
                new Promise((resolve) => {
                  setTimeout(() => resolve({ count: 0, error: null }), 500);
                })
            ),
          }),
        }),
      });

      const { getAllByText } = render(
        <MarriageDeletionSheet
          visible={true}
          marriage={marriage}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      // Delete button should be disabled during loading
      const buttons = getAllByText(/حذف/i);
      const deleteButton = buttons.find((btn) => btn.type !== 'string');

      await waitFor(() => {
        expect(deleteButton?.props?.disabled).toBeTruthy();
      });
    });

    test('should disable delete button when error occurs', async () => {
      const marriage = createMockMarriage();

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            is: jest.fn().mockRejectedValue(new Error('Network error')),
          }),
        }),
      });

      const { getAllByText, getByText } = render(
        <MarriageDeletionSheet
          visible={true}
          marriage={marriage}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      await waitFor(() => {
        expect(getByText(/فشل تحميل/i)).toBeTruthy();
      });

      // Delete button should be disabled in error state
      const buttons = getAllByText(/حذف/i);
      const deleteButton = buttons.find((btn) => btn.type !== 'string');
      expect(deleteButton?.props?.disabled).toBeTruthy();
    });
  });

  // ============================================================================
  // SCENARIO 8: Marriage deleted by another admin
  // ============================================================================
  describe('Scenario 8: Marriage deleted by another admin', () => {
    test('should handle missing spouse profile gracefully', async () => {
      const marriage = {
        ...createMockMarriage(),
        spouse_profile: null, // Spouse deleted
      };

      const { getByText } = render(
        <MarriageDeletionSheet
          visible={true}
          marriage={marriage}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      // Should not attempt to load (no spouse data)
      expect(getByText(/بيانات الزواج غير متوفرة/i)).toBeTruthy();
    });

    test('should handle missing spouse ID', async () => {
      const marriage = {
        ...createMockMarriage(),
        spouse_profile: {
          id: undefined, // Missing ID
          name: 'Test',
          gender: 'female',
        },
      };

      const { getByText } = render(
        <MarriageDeletionSheet
          visible={true}
          marriage={marriage}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      await waitFor(() => {
        expect(getByText(/بيانات الزوج.*غير متوفرة/i)).toBeTruthy();
      });
    });
  });

  // ============================================================================
  // EDGE CASES & INTEGRATION TESTS
  // ============================================================================
  describe('Edge Cases & Integration', () => {
    test('should not fetch data when sheet not visible', () => {
      const marriage = createMockMarriage();
      const selectMock = jest.fn();

      supabase.from.mockReturnValue({
        select: selectMock,
      });

      render(
        <MarriageDeletionSheet
          visible={false}
          marriage={marriage}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      // Should not have called select when sheet is not visible
      expect(selectMock).not.toHaveBeenCalled();
    });

    test('should close sheet when cancel button pressed', () => {
      const marriage = createMockMarriage();

      const { getByText } = render(
        <MarriageDeletionSheet
          visible={true}
          marriage={marriage}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      const cancelButton = getByText(/إلغاء/i);
      fireEvent.press(cancelButton);

      expect(mockOnCancel).toHaveBeenCalled();
    });

    test('should handle gender-specific parent column', async () => {
      const maleSpouseMarriage = {
        ...createMockMarriage(),
        spouse_profile: {
          id: 'spouse-456',
          name: 'الأب',
          gender: 'male', // Male spouse
          hid: null,
        },
      };

      const fromMock = jest.fn();
      supabase.from.mockImplementation((table) => {
        if (table === 'profiles') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn((column) => {
                // Should query father_id for male spouse
                expect(column).toBe('father_id');
                return {
                  is: jest.fn().mockResolvedValue({
                    count: 2,
                    error: null,
                  }),
                };
              }),
            }),
          };
        }
        return { select: jest.fn() };
      });

      render(
        <MarriageDeletionSheet
          visible={true}
          marriage={maleSpouseMarriage}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      await waitFor(() => {
        expect(fromMock).toHaveBeenCalledWith('profiles');
      });
    });

    test('should handle one child singular form', async () => {
      const marriage = createMockMarriage();

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            is: jest.fn().mockResolvedValue({
              count: 1,
              error: null,
            }),
          }),
          or: jest.fn().mockReturnValue({
            neq: jest.fn().mockReturnValue({
              is: jest.fn().mockResolvedValue({
                count: 0,
                error: null,
              }),
            }),
          }),
        }),
      });

      const { getByText } = render(
        <MarriageDeletionSheet
          visible={true}
          marriage={marriage}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      await waitFor(() => {
        expect(getByText(/طفل واحد/i)).toBeTruthy();
      });
    });

    test('should handle two children dual form', async () => {
      const marriage = createMockMarriage();

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            is: jest.fn().mockResolvedValue({
              count: 2,
              error: null,
            }),
          }),
          or: jest.fn().mockReturnValue({
            neq: jest.fn().mockReturnValue({
              is: jest.fn().mockResolvedValue({
                count: 0,
                error: null,
              }),
            }),
          }),
        }),
      });

      const { getByText } = render(
        <MarriageDeletionSheet
          visible={true}
          marriage={marriage}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      await waitFor(() => {
        expect(getByText(/طفلين/i)).toBeTruthy();
      });
    });
  });
});
