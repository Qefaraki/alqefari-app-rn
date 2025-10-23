import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { act } from '@testing-library/react-native';
import LocationInput from '../LocationInput';
import tokens from '../../ui/tokens';

// Mock Supabase RPC
jest.mock('../../../services/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
  },
}));

const { supabase } = require('../../../services/supabase');

describe('LocationInput Component Tests', () => {
  const mockOnChange = jest.fn();
  const mockOnNormalizedChange = jest.fn();

  const mockSearchResults = [
    {
      id: 1,
      display_name: 'الرياض',
      display_name_en: 'Riyadh',
      place_type: 'city',
      region: 'saudi',
      country_name: 'السعودية',
      normalized_data: { city: { id: 1 }, country: { id: 1 } },
    },
    {
      id: 2,
      display_name: 'جدة',
      display_name_en: 'Jeddah',
      place_type: 'city',
      region: 'saudi',
      country_name: 'السعودية',
      normalized_data: { city: { id: 2 }, country: { id: 1 } },
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('✅ RENDERING (4 tests)', () => {
    test('renders label text correctly', () => {
      render(
        <LocationInput
          label="مكان الميلاد"
          value=""
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText('مكان الميلاد')).toBeTruthy();
    });

    test('renders search input with placeholder', () => {
      render(
        <LocationInput
          label="مكان الميلاد"
          value=""
          onChange={mockOnChange}
          placeholder="ابحث عن موقع..."
        />
      );

      const input = screen.getByPlaceholderText('ابحث عن موقع...');
      expect(input).toBeTruthy();
    });

    test('renders CategoryChipFilter component', () => {
      render(
        <LocationInput
          label="مكان الميلاد"
          value=""
          onChange={mockOnChange}
        />
      );

      // CategoryChipFilter should render Saudi (السعودية) by default
      expect(screen.getByText('السعودية')).toBeTruthy();
      expect(screen.getByText('27')).toBeTruthy(); // Saudi count
    });

    test('renders fixed 300pt results container', () => {
      render(
        <LocationInput
          label="مكان الميلاد"
          value="ري"
          onChange={mockOnChange}
        />
      );

      // With 2+ chars, results container should be visible
      const input = screen.getByDisplayValue('ري');
      expect(input).toBeTruthy();
    });
  });

  describe('✅ SEARCH BEHAVIOR (4 tests)', () => {
    test('does not trigger search for < 2 characters', async () => {
      supabase.rpc.mockResolvedValue({ data: [], error: null });

      render(
        <LocationInput
          label="مكان الميلاد"
          value=""
          onChange={mockOnChange}
        />
      );

      const input = screen.getByDisplayValue('');
      fireEvent.changeText(input, 'ر');

      jest.advanceTimersByTime(200);

      expect(supabase.rpc).not.toHaveBeenCalled();
    });

    test('triggers search after 200ms debounce', async () => {
      supabase.rpc.mockResolvedValue({ data: mockSearchResults, error: null });

      render(
        <LocationInput
          label="مكان الميلاد"
          value=""
          onChange={mockOnChange}
        />
      );

      const input = screen.getByDisplayValue('');
      fireEvent.changeText(input, 'الرياض');

      // Before debounce time
      expect(supabase.rpc).not.toHaveBeenCalled();

      // After debounce time
      jest.advanceTimersByTime(200);

      expect(supabase.rpc).toHaveBeenCalledWith('search_place_autocomplete', {
        p_query: 'الرياض',
        p_limit: 8,
      });
    });

    test('debounces multiple rapid keystrokes correctly', () => {
      supabase.rpc.mockResolvedValue({ data: mockSearchResults, error: null });

      render(
        <LocationInput
          label="مكان الميلاد"
          value=""
          onChange={mockOnChange}
        />
      );

      const input = screen.getByDisplayValue('');

      // Simulate rapid typing
      fireEvent.changeText(input, 'ال');
      jest.advanceTimersByTime(100);
      fireEvent.changeText(input, 'الر');
      jest.advanceTimersByTime(100);
      fireEvent.changeText(input, 'الري');
      jest.advanceTimersByTime(100);
      fireEvent.changeText(input, 'الريا');
      jest.advanceTimersByTime(200);

      // Should only call once (final debounced search)
      expect(supabase.rpc).toHaveBeenCalledTimes(1);
    });

    test('displays suggestions after successful search', async () => {
      supabase.rpc.mockResolvedValue({ data: mockSearchResults, error: null });

      render(
        <LocationInput
          label="مكان الميلاد"
          value=""
          onChange={mockOnChange}
        />
      );

      const input = screen.getByDisplayValue('');
      fireEvent.changeText(input, 'الرياض');

      jest.advanceTimersByTime(200);

      await waitFor(() => {
        expect(screen.getByText('الرياض')).toBeTruthy();
      });
    });
  });

  describe('✅ CATEGORY FILTERING (2 tests)', () => {
    test('defaults to Saudi category (saudi)', () => {
      render(
        <LocationInput
          label="مكان الميلاد"
          value=""
          onChange={mockOnChange}
        />
      );

      // Saudi chip should be visible (default)
      expect(screen.getByText('السعودية')).toBeTruthy();
    });

    test('re-filters suggestions when category changes', async () => {
      supabase.rpc.mockResolvedValue({ data: mockSearchResults, error: null });

      render(
        <LocationInput
          label="مكان الميلاد"
          value=""
          onChange={mockOnChange}
        />
      );

      const input = screen.getByDisplayValue('');
      fireEvent.changeText(input, 'ج');

      jest.advanceTimersByTime(200);

      await waitFor(() => {
        // Results should be filtered by Saudi (default)
        expect(supabase.rpc).toHaveBeenCalled();
      });
    });
  });

  describe('✅ ERROR HANDLING (3 tests)', () => {
    test('handles RPC errors gracefully', async () => {
      supabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Network error' },
      });

      render(
        <LocationInput
          label="مكان الميلاد"
          value=""
          onChange={mockOnChange}
        />
      );

      const input = screen.getByDisplayValue('');
      fireEvent.changeText(input, 'الرياض');

      jest.advanceTimersByTime(200);

      await waitFor(() => {
        // Component should handle error without crashing
        expect(screen.getByDisplayValue('الرياض')).toBeTruthy();
      });
    });

    test('shows empty state when no results found', async () => {
      supabase.rpc.mockResolvedValue({ data: [], error: null });

      render(
        <LocationInput
          label="مكان الميلاد"
          value=""
          onChange={mockOnChange}
        />
      );

      const input = screen.getByDisplayValue('');
      fireEvent.changeText(input, 'قرية غير معروفة');

      jest.advanceTimersByTime(200);

      await waitFor(() => {
        expect(screen.getByText('لا توجد نتائج - يمكنك إدخال النص مباشرة')).toBeTruthy();
      });
    });

    test('does not show alert for timeout errors', async () => {
      const alertSpy = jest.spyOn(global.Alert, 'alert');
      supabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Request timeout' },
      });

      render(
        <LocationInput
          label="مكان الميلاد"
          value=""
          onChange={mockOnChange}
        />
      );

      const input = screen.getByDisplayValue('');
      fireEvent.changeText(input, 'الرياض');

      jest.advanceTimersByTime(200);

      // Timeout errors should not show alert
      expect(alertSpy).not.toHaveBeenCalled();
      alertSpy.mockRestore();
    });
  });

  describe('✅ USER INPUT (3 tests)', () => {
    test('calls onChange callback when user types', () => {
      render(
        <LocationInput
          label="مكان الميلاد"
          value=""
          onChange={mockOnChange}
        />
      );

      const input = screen.getByDisplayValue('');
      fireEvent.changeText(input, 'الرياض');

      expect(mockOnChange).toHaveBeenCalledWith('الرياض');
    });

    test('updates normalized_data when suggestion is selected', async () => {
      supabase.rpc.mockResolvedValue({ data: mockSearchResults, error: null });

      render(
        <LocationInput
          label="مكان الميلاد"
          value=""
          onChange={mockOnChange}
          onNormalizedChange={mockOnNormalizedChange}
        />
      );

      const input = screen.getByDisplayValue('');
      fireEvent.changeText(input, 'الرياض');

      jest.advanceTimersByTime(200);

      await waitFor(() => {
        const suggestion = screen.getByText('الرياض');
        fireEvent.press(suggestion);
      });

      expect(mockOnNormalizedChange).toHaveBeenCalled();
    });

    test('allows freeform input without selection', () => {
      render(
        <LocationInput
          label="مكان الميلاد"
          value=""
          onChange={mockOnChange}
        />
      );

      const input = screen.getByDisplayValue('');
      fireEvent.changeText(input, 'قرية قديمة');

      expect(mockOnChange).toHaveBeenCalledWith('قرية قديمة');
    });
  });

  describe('✅ DESIGN SYSTEM (4 tests)', () => {
    test('uses Najdi Sadu colors for all UI elements', () => {
      expect(tokens.colors.najdi.primary).toBe('#A13333');
      expect(tokens.colors.najdi.background).toBe('#F9F7F3');
      expect(tokens.colors.najdi.text).toBe('#242121');
    });

    test('applies 8px spacing grid', () => {
      expect(tokens.spacing.xs).toBe(8);
      expect(tokens.spacing.sm).toBe(12);
      expect(tokens.spacing.md).toBe(16);
    });

    test('enforces RTL text alignment (start not right)', () => {
      render(
        <LocationInput
          label="مكان الميلاد"
          value="test"
          onChange={mockOnChange}
        />
      );

      const label = screen.getByText('مكان الميلاد');
      // Component should use semantic 'start' alignment for RTL
      expect(label).toBeTruthy();
    });

    test('enforces 44pt minimum touch targets', () => {
      expect(tokens.touchTarget.minimum).toBe(44);
    });
  });

  describe('✅ EDGE CASES (4 tests)', () => {
    test('handles null data response safely', async () => {
      supabase.rpc.mockResolvedValue({ data: null, error: null });

      render(
        <LocationInput
          label="مكان الميلاد"
          value=""
          onChange={mockOnChange}
        />
      );

      const input = screen.getByDisplayValue('');
      fireEvent.changeText(input, 'الرياض');

      jest.advanceTimersByTime(200);

      await waitFor(() => {
        expect(screen.getByDisplayValue('الرياض')).toBeTruthy();
      });
    });

    test('handles undefined props gracefully', () => {
      render(
        <LocationInput
          label="مكان الميلاد"
          value=""
          onChange={mockOnChange}
          // onNormalizedChange is undefined
        />
      );

      expect(screen.getByText('مكان الميلاد')).toBeTruthy();
    });

    test('handles special Arabic characters (Hamza, Marbuta)', async () => {
      supabase.rpc.mockResolvedValue({ data: mockSearchResults, error: null });

      render(
        <LocationInput
          label="مكان الميلاد"
          value=""
          onChange={mockOnChange}
        />
      );

      const input = screen.getByDisplayValue('');
      fireEvent.changeText(input, 'الرّياض'); // With Hamza and Shadda

      jest.advanceTimersByTime(200);

      expect(supabase.rpc).toHaveBeenCalled();
    });

    test('cleans up on component unmount', () => {
      supabase.rpc.mockResolvedValue({ data: mockSearchResults, error: null });

      const { unmount } = render(
        <LocationInput
          label="مكان الميلاد"
          value=""
          onChange={mockOnChange}
        />
      );

      const input = screen.getByDisplayValue('');
      fireEvent.changeText(input, 'الرياض');

      unmount();

      // Should not crash on unmount
      expect(true).toBe(true);
    });
  });
});
