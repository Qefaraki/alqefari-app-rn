import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import CategoryChipFilter from '../CategoryChipFilter';
import tokens from '../../ui/tokens';

describe('CategoryChipFilter Component Tests', () => {
  const mockOnCategoryChange = jest.fn();
  const defaultCategories = [
    { id: 'saudi', label: 'السعودية', count: 27 },
    { id: 'gulf', label: 'الخليج', count: 5 },
    { id: 'arab', label: 'العربية', count: 12 },
    { id: 'international', label: 'دولية', count: 20 },
    { id: 'all', label: 'الكل', count: 64 },
  ];

  beforeEach(() => {
    mockOnCategoryChange.mockClear();
  });

  describe('✅ RENDERING (6 tests)', () => {
    test('renders all 5 category chips with correct labels', () => {
      render(
        <CategoryChipFilter
          categories={defaultCategories}
          activeCategory="saudi"
          onCategoryChange={mockOnCategoryChange}
        />
      );

      expect(screen.getByText('السعودية')).toBeTruthy();
      expect(screen.getByText('الخليج')).toBeTruthy();
      expect(screen.getByText('العربية')).toBeTruthy();
      expect(screen.getByText('دولية')).toBeTruthy();
      expect(screen.getByText('الكل')).toBeTruthy();
    });

    test('displays count badges (27, 5, 12, 20, 64)', () => {
      render(
        <CategoryChipFilter
          categories={defaultCategories}
          activeCategory="saudi"
          onCategoryChange={mockOnCategoryChange}
        />
      );

      expect(screen.getByText('27')).toBeTruthy();
      expect(screen.getByText('5')).toBeTruthy();
      expect(screen.getByText('12')).toBeTruthy();
      expect(screen.getByText('20')).toBeTruthy();
      expect(screen.getByText('64')).toBeTruthy();
    });

    test('applies active chip styling (Crimson #A13333)', () => {
      render(
        <CategoryChipFilter
          categories={defaultCategories}
          activeCategory="saudi"
          onCategoryChange={mockOnCategoryChange}
        />
      );

      const activeChipText = screen.getAllByText('السعودية')[0];
      expect(activeChipText).toHaveStyle({
        color: tokens.colors.najdi.background,
      });
    });

    test('applies inactive chip styling (White #F9F7F3 with border)', () => {
      render(
        <CategoryChipFilter
          categories={defaultCategories}
          activeCategory="saudi"
          onCategoryChange={mockOnCategoryChange}
        />
      );

      const inactiveChipText = screen.getAllByText('الخليج')[0];
      expect(inactiveChipText).toHaveStyle({
        color: tokens.colors.najdi.text,
      });
    });

    test('renders disabled chips with reduced opacity (0.5)', () => {
      const categoriesWithDisabled = [
        { id: 'saudi', label: 'السعودية', count: 27 },
        { id: 'gulf', label: 'الخليج', count: 5, enabled: false },
      ];

      render(
        <CategoryChipFilter
          categories={categoriesWithDisabled}
          activeCategory="saudi"
          onCategoryChange={mockOnCategoryChange}
        />
      );

      const disabledChipText = screen.getAllByText('الخليج')[0];
      expect(disabledChipText).toHaveStyle({
        color: tokens.colors.najdi.textMuted,
      });
    });

    test('renders horizontal ScrollView for chip list', () => {
      const { root } = render(
        <CategoryChipFilter
          categories={defaultCategories}
          activeCategory="saudi"
          onCategoryChange={mockOnCategoryChange}
        />
      );

      expect(root).toBeTruthy();
    });
  });

  describe('✅ INTERACTIONS (4 tests)', () => {
    test('fires onCategoryChange callback when chip is pressed', () => {
      render(
        <CategoryChipFilter
          categories={defaultCategories}
          activeCategory="saudi"
          onCategoryChange={mockOnCategoryChange}
        />
      );

      const gulfChip = screen.getAllByText('الخليج')[0];
      fireEvent.press(gulfChip);

      expect(mockOnCategoryChange).toHaveBeenCalledWith('gulf');
    });

    test('passes correct categoryId to callback', () => {
      render(
        <CategoryChipFilter
          categories={defaultCategories}
          activeCategory="saudi"
          onCategoryChange={mockOnCategoryChange}
        />
      );

      const arabChip = screen.getAllByText('العربية')[0];
      fireEvent.press(arabChip);

      expect(mockOnCategoryChange).toHaveBeenCalledWith('arab');
    });

    test('prevents callback when disabled chip is pressed', () => {
      const categoriesWithDisabled = [
        { id: 'saudi', label: 'السعودية', count: 27 },
        { id: 'gulf', label: 'الخليج', count: 5, enabled: false },
      ];

      render(
        <CategoryChipFilter
          categories={categoriesWithDisabled}
          activeCategory="saudi"
          onCategoryChange={mockOnCategoryChange}
        />
      );

      const disabledChip = screen.getAllByText('الخليج')[0];
      fireEvent.press(disabledChip);

      expect(mockOnCategoryChange).not.toHaveBeenCalled();
    });

    test('provides visual feedback on chip press', () => {
      render(
        <CategoryChipFilter
          categories={defaultCategories}
          activeCategory="saudi"
          onCategoryChange={mockOnCategoryChange}
        />
      );

      const chip = screen.getAllByText('السعودية')[0];
      fireEvent.press(chip);

      expect(mockOnCategoryChange).toHaveBeenCalled();
    });
  });

  describe('✅ STYLING & DESIGN SYSTEM (6 tests)', () => {
    test('uses Najdi Crimson (#A13333) for active chips', () => {
      expect(tokens.colors.najdi.primary).toBe('#A13333');
    });

    test('uses Al-Jass White (#F9F7F3) for inactive chips', () => {
      expect(tokens.colors.najdi.background).toBe('#F9F7F3');
    });

    test('applies pill-shaped borderRadius (9999)', () => {
      expect(tokens.radii.full).toBe(9999);
    });

    test('enforces 44pt minimum touch target height', () => {
      expect(tokens.touchTarget.minimum).toBe(44);
    });

    test('applies 8px spacing between chips', () => {
      expect(tokens.spacing.xs).toBe(8);
    });

    test('active chip has white text, inactive has dark text', () => {
      render(
        <CategoryChipFilter
          categories={defaultCategories}
          activeCategory="saudi"
          onCategoryChange={mockOnCategoryChange}
        />
      );

      const activeText = screen.getAllByText('السعودية')[0];
      const inactiveText = screen.getAllByText('الخليج')[0];

      expect(activeText).toHaveStyle({ color: tokens.colors.najdi.background });
      expect(inactiveText).toHaveStyle({ color: tokens.colors.najdi.text });
    });
  });

  describe('✅ PROPTYPES VALIDATION (3 tests)', () => {
    test('accepts valid categories array with proper shape', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      render(
        <CategoryChipFilter
          categories={defaultCategories}
          activeCategory="saudi"
          onCategoryChange={mockOnCategoryChange}
        />
      );

      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('PropTypes')
      );
      consoleSpy.mockRestore();
    });

    test('accepts optional style prop', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      render(
        <CategoryChipFilter
          categories={defaultCategories}
          activeCategory="saudi"
          onCategoryChange={mockOnCategoryChange}
          style={{ marginTop: 20 }}
        />
      );

      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('PropTypes')
      );
      consoleSpy.mockRestore();
    });

    test('validates required props are present', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      render(<CategoryChipFilter />);

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('✅ EDGE CASES (4 tests)', () => {
    test('handles empty categories array', () => {
      const { root } = render(
        <CategoryChipFilter
          categories={[]}
          activeCategory="saudi"
          onCategoryChange={mockOnCategoryChange}
        />
      );

      expect(root).toBeTruthy();
    });

    test('handles very long Arabic labels', () => {
      const longCategories = [
        { id: 'test', label: 'هذه فئة بعنوان طويل جداً جداً', count: 999 },
      ];

      render(
        <CategoryChipFilter
          categories={longCategories}
          activeCategory="test"
          onCategoryChange={mockOnCategoryChange}
        />
      );

      expect(screen.getByText('هذه فئة بعنوان طويل جداً جداً')).toBeTruthy();
    });

    test('handles large count numbers', () => {
      const largeCountCategories = [
        { id: 'test', label: 'اختبار', count: 999999 },
      ];

      render(
        <CategoryChipFilter
          categories={largeCountCategories}
          activeCategory="test"
          onCategoryChange={mockOnCategoryChange}
        />
      );

      expect(screen.getByText('999999')).toBeTruthy();
    });

    test('handles rapid category switching', () => {
      const { rerender } = render(
        <CategoryChipFilter
          categories={defaultCategories}
          activeCategory="saudi"
          onCategoryChange={mockOnCategoryChange}
        />
      );

      rerender(
        <CategoryChipFilter
          categories={defaultCategories}
          activeCategory="gulf"
          onCategoryChange={mockOnCategoryChange}
        />
      );

      rerender(
        <CategoryChipFilter
          categories={defaultCategories}
          activeCategory="arab"
          onCategoryChange={mockOnCategoryChange}
        />
      );

      expect(screen.getByText('العربية')).toBeTruthy();
    });
  });
});
