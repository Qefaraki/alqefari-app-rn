import { useEffect, useRef, useCallback, useState } from 'react';

/**
 * Debounce hook for delaying function execution
 * @param {Function} callback - Function to debounce
 * @param {number} delay - Delay in milliseconds (default: 300ms)
 * @returns {Function} Debounced function
 */
export const useDebounce = (callback, delay = 300) => {
  const timeoutRef = useRef(null);

  const debouncedCallback = useCallback(
    (...args) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    },
    [callback, delay]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedCallback;
};

/**
 * Debounced input hook with local state
 * @param {any} value - External value
 * @param {Function} onChange - External onChange handler
 * @param {number} delay - Delay in milliseconds (default: 300ms)
 * @returns {Object} { localValue, setLocalValue, handleChange }
 */
export const useDebouncedInput = (value, onChange, delay = 300) => {
  const [localValue, setLocalValue] = useState(value);
  const timeoutRef = useRef(null);

  // Sync local value when external value changes
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = useCallback(
    (newValue) => {
      setLocalValue(newValue);

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        onChange(newValue);
      }, delay);
    },
    [onChange, delay]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return { localValue, setLocalValue, handleChange };
};
