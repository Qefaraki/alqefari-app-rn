import { useEffect } from 'react';

/**
 * Custom hook to auto-clear feedback messages after a timeout
 *
 * @param {string|null} feedback - Current feedback message
 * @param {Function} setFeedback - State setter to clear feedback
 * @param {number} timeout - Milliseconds before auto-clear (default: 2000)
 *
 * @example
 * const [feedback, setFeedback] = useState(null);
 * useFeedbackTimeout(feedback, setFeedback);
 *
 * // Later:
 * setFeedback('Success!'); // Auto-clears after 2s
 */
export function useFeedbackTimeout(feedback, setFeedback, timeout = 2000) {
  useEffect(() => {
    if (!feedback) return;

    const timeoutId = setTimeout(() => {
      setFeedback(null);
    }, timeout);

    return () => clearTimeout(timeoutId);
  }, [feedback, setFeedback, timeout]);
}
