// Safely turn an axios error into a human-readable string.
//
// FastAPI returns validation errors as `detail: [{loc, msg, type}, ...]`, and
// passing that array straight into a React child (e.g. toast.error) crashes the
// app with a blank page. This normalizes every shape into a plain string and
// distinguishes network/connectivity failures from server responses.
export function getErrorMessage(error, fallback = 'Something went wrong') {
  // Request was made but no response received -> connectivity/config problem.
  if (error && error.request && !error.response) {
    return 'Cannot reach the server. Please check your connection and try again.';
  }

  const detail = error?.response?.data?.detail;

  if (typeof detail === 'string' && detail.trim()) {
    return detail;
  }

  if (Array.isArray(detail)) {
    const messages = detail
      .map((d) => (typeof d === 'string' ? d : d?.msg))
      .filter(Boolean);
    if (messages.length) return messages.join(', ');
  }

  if (detail && typeof detail === 'object' && typeof detail.msg === 'string') {
    return detail.msg;
  }

  return fallback;
}
