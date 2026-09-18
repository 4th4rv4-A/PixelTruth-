export default function PrivacyBadge({ level }) {
  const config = {
    high: {
      icon: '🔴',
      label: 'Contains GPS location',
      classes:
        'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/40',
    },
    medium: {
      icon: '🟡',
      label: 'Contains device info',
      classes:
        'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800/40',
    },
    low: {
      icon: '🟢',
      label: 'No sensitive metadata',
      classes:
        'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/40',
    },
  };

  const { icon, label, classes } = config[level] || config.low;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${classes}`}
    >
      <span className="text-[10px] leading-none">{icon}</span>
      {label}
    </span>
  );
}
