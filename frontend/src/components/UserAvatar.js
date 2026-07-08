// Renders a user's uploaded profile picture, or their initials as a fallback.
export function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  const letters = parts.map((w) => (w[0] ? w[0].toUpperCase() : '')).join('');
  return letters || '?';
}

export function UserAvatar({ user, className = '', gradient = 'from-orange-400 to-amber-400', textClass = 'text-sm' }) {
  if (user?.picture) {
    return (
      <img
        src={user.picture}
        alt={user?.name ? `${user.name}'s profile` : 'Profile picture'}
        className={`object-cover ${className}`}
      />
    );
  }
  return (
    <div
      className={`bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-semibold ${textClass} ${className}`}
      aria-hidden="true"
    >
      {getInitials(user?.name)}
    </div>
  );
}
