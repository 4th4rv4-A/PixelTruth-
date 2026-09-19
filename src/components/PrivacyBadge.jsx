export default function PrivacyBadge({ level }) {
  const config = {
    high: {
      icon: '🔴',
      label: 'Contains GPS location',
      classes:
        'bg-safelight-500/10 text-safelight-600 border-safelight-500/20 dark:text-safelight-400',
    },
    medium: {
      icon: '🟡',
      label: 'Contains device info',
      classes:
        'bg-warn-500/10 text-warn-600 border-warn-500/20 dark:text-warn-400',
    },
    low: {
      icon: '🟢',
      label: 'No sensitive metadata',
      classes:
        'bg-develop-500/10 text-develop-600 border-develop-500/20 dark:text-develop-400',
    },
  };

  const { icon, label, classes } = config[level] || config.low;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-xs font-medium border transition-colors ${classes}`}
    >
      <span className="text-[10px] leading-none">{icon}</span>
      {label}
    </span>
  );
}
