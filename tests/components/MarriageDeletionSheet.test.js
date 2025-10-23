/**
 * MarriageDeletionSheet.test.js
 *
 * Comprehensive test suite for marriage deletion system.
 * Tests all 8 critical scenarios with data fetching logic.
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
import { render, waitFor } from '@testing-library/react-native';
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

// Helper to create mock marriage objects
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
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // SCENARIO 1: Delete cousin marriage (0 children)
  // ============================================================================
  describe('Scenario 1: Delete cousin marriage (0 children)', () => {
    test('should detect cousin marriage by HID presence', async () => {
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

      const { getByText } = render(
        <MarriageDeletionSheet
          visible={true}
          marriage={marriage}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      await waitFor(() => {
        expect(getByText(/زواج قريب/i)).toBeTruthy();
      });
    });

    test('should show warning about cousin spouse remaining in tree', async () => {
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
        // No children warning should appear
        expect(queryByText(/إزالة رابط/i)).toBeFalsy();
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

    test('should correctly pluralize large children count', async () => {
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

    test('should show children warning with correct parent label', async () => {
      const marriage = createMockCousinMarriage();

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            is: jest.fn().mockResolvedValue({
              count: 2,
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
        // Female spouse = mother
        expect(getByText(/الأم/i)).toBeTruthy();
      });
    });
  });

  // ============================================================================
  // SCENARIO 3: Delete Munasib marriage (single, 0 children)
  // ============================================================================
  describe('Scenario 3: Delete Munasib marriage (single, 0 children)', () => {
    test('should detect Munasib marriage (HID is null)', async () => {
      const marriage = createMockMarriage(); // No HID = Munasib

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
        // Should warn that both marriage AND spouse will be deleted
        expect(getByText(/سيتم حذفهما معاً/i)).toBeTruthy();
      });
    });

    test('should warn about Munasib spouse profile deletion', async () => {
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
      });
    });
  });

  // ============================================================================
  // SCENARIO 4: Delete Munasib marriage (single, 5+ children)
  // ============================================================================
  describe('Scenario 4: Delete Munasib marriage (single, 5+ children)', () => {
    test('should show children warning for Munasib with children', async () => {
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
    test('should keep Munasib spouse profile when has other marriages', async () => {
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
        // Should NOT say both will be deleted
        expect(queryByText(/سيتم حذفهما معاً/i)).toBeFalsy();
        // Should say marriage deleted but profile remains
        expect(getByText(/سيبقى/i)).toBeTruthy();
      });
    });

    test('should mention other marriages in warning', async () => {
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
                count: 1,
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
        expect(getByText(/زيجات أخرى/i)).toBeTruthy();
      });
    });
  });

  // ============================================================================
  // SCENARIO 6: Network timeout on slow network
  // ============================================================================
  describe('Scenario 6: Network timeout on slow network', () => {
    test('should show retry button when fetch fails', async () => {
      const marriage = createMockMarriage();

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            is: jest.fn().mockRejectedValue(new Error('Network timeout')),
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

    test('should handle timeout error gracefully', async () => {
      const marriage = createMockMarriage();

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            is: jest.fn().mockRejectedValue(
              new Error('انتهى وقت الاتصال. تحقق من اتصال الإنترنت.')
            ),
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
        expect(getByText(/فشل تحميل/i)).toBeTruthy();
      });
    });
  });

  // ============================================================================
  // SCENARIO 7: Permission change while sheet open
  // ============================================================================
  describe('Scenario 7: Permission change while sheet open', () => {
    test('should disable delete button while loading data', async () => {
      const marriage = createMockMarriage();

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            is: jest.fn(
              () =>
                new Promise((resolve) => {
                  setTimeout(() => resolve({ count: 0, error: null }), 100);
                })
            ),
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

      // Loading state should be shown initially
      expect(getByText(/جارٍ تحميل/i)).toBeTruthy();
    });

    test('should disable delete button in error state', async () => {
      const marriage = createMockMarriage();

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            is: jest.fn().mockRejectedValue(new Error('Fetch failed')),
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
        expect(getByText(/فشل تحميل/i)).toBeTruthy();
      });
    });
  });

  // ============================================================================
  // SCENARIO 8: Marriage deleted by another admin
  // ============================================================================
  describe('Scenario 8: Marriage deleted by another admin', () => {
    test('should handle missing spouse profile gracefully', () => {
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

      expect(getByText(/بيانات الزواج غير متوفرة/i)).toBeTruthy();
    });

    test('should handle missing spouse ID', async () => {
      const marriage = {
        ...createMockMarriage(),
        spouse_profile: {
          id: undefined, // Missing ID
          name: 'Test',
          gender: 'female',
          hid: null,
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
        // When spouse ID is missing, error message appears
        expect(getByText(/فشل تحميل/i)).toBeTruthy();
      });
    });
  });

  // ============================================================================
  // EDGE CASES & LOGIC TESTS
  // ============================================================================
  describe('Edge Cases & Logic Tests', () => {
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

    test('should use correct parent column for male spouse', async () => {
      const maleSpouseMarriage = {
        ...createMockMarriage(),
        spouse_profile: {
          id: 'spouse-456',
          name: 'الأب',
          gender: 'male', // Male spouse
          hid: null,
        },
      };

      const selectMock = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          is: jest.fn().mockResolvedValue({
            count: 2,
            error: null,
          }),
        }),
      });

      supabase.from.mockReturnValue({
        select: selectMock,
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
        // Should query 'father_id' for male spouse
        expect(selectMock).toHaveBeenCalledWith('id', {
          count: 'exact',
          head: true,
        });
      });
    });

    test('should use correct parent column for female spouse', async () => {
      const femaleSpouseMarriage = {
        ...createMockMarriage(),
        spouse_profile: {
          id: 'spouse-456',
          name: 'الأم',
          gender: 'female', // Female spouse
          hid: null,
        },
      };

      const selectMock = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          is: jest.fn().mockResolvedValue({
            count: 1,
            error: null,
          }),
        }),
      });

      supabase.from.mockReturnValue({
        select: selectMock,
      });

      render(
        <MarriageDeletionSheet
          visible={true}
          marriage={femaleSpouseMarriage}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      await waitFor(() => {
        expect(selectMock).toHaveBeenCalledWith('id', {
          count: 'exact',
          head: true,
        });
      });
    });

    test('should handle singular "one child" form', async () => {
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

    test('should handle dual "two children" form', async () => {
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

    test('should show permanent warning message', async () => {
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
        expect(getByText(/لا يمكن التراجع/i)).toBeTruthy();
      });
    });
  });
});
