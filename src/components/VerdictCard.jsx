import CredentialDetails from './CredentialDetails';

export default function VerdictCard({ item }) {
  const { file, thumbnailUrl, result } = item;

  if (!result) {
    // Loading state
    return (
      <div className="frame p-5 animate-fade-in-up relative overflow-hidden">
        <div className="flex items-center gap-4 redaction-bar">
          <div className="flex-shrink-0 w-14 h-14 bg-ink-200 dark:bg-ink-800">
            <img src={thumbnailUrl} alt={file.name} className="w-full h-full object-cover" loading="lazy" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-ink-800 dark:text-ink-200 truncate">{file.name}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="w-4 h-4 rounded-sm border-2 border-ink-300 border-t-safelight-500 animate-spin" />
              <span className="text-sm text-ink-500 dark:text-ink-400">Analyzing credentials…</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const configs = {
    'verified-ai': {
      borderColor: 'border-l-develop-500',
      badgeText: 'text-develop-600 dark:text-develop-400',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-develop-500">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      ),
      title: 'Verified AI-Generated',
      getDescription: (r) =>
        `This image has a verified Content Credential from ${r.issuer}, indicating it was generated or modified by ${r.generator}.`,
    },
    'verified-provenance': {
      borderColor: 'border-l-develop-400',
      badgeText: 'text-develop-600 dark:text-develop-400',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-develop-500">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <polyline points="9 11 12 14 22 4" />
        </svg>
      ),
      title: 'Content Credential Found — No AI Marker',
      getDescription: (r) =>
        `A Content Credential was found from ${r.issuer} (${r.generator}), but no AI-generation markers were identified. This does not prove the image is non-synthetic — it only means no AI marker was present in the credential.`,
    },
    possible: {
      borderColor: 'border-l-warn-500',
      badgeText: 'text-warn-600 dark:text-warn-400',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-warn-500">
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      ),
      title: 'Possible AI markers found',
      getDescription: (r) =>
        `Software metadata mentions "${r.tag}", but this isn't a verified credential and could be edited or spoofed.`,
    },
    inconclusive: {
      borderColor: 'border-l-ink-400',
      badgeText: 'text-ink-600 dark:text-ink-400',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-ink-500">
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      ),
      title: 'No AI markers detected',
      getDescription: () =>
        'No C2PA credential or generator tag found. This does not confirm the image is real — metadata may have been stripped or was never present.',
    },
  };

  const config = configs[result.verdict] || configs.inconclusive;

  return (
    <div className={`frame relative overflow-hidden border-l-4 ${config.borderColor} animate-fade-in-up`}>
      <div className="p-5 redaction-bar">
        <div className="flex items-start gap-4">
          {/* Thumbnail */}
          <div className="flex-shrink-0 w-14 h-14 bg-ink-200 dark:bg-ink-800">
            <img src={thumbnailUrl} alt={file.name} className="w-full h-full object-cover" loading="lazy" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* File name */}
            <p className="text-sm font-medium text-ink-600 dark:text-ink-400 truncate mb-2">
              {file.name}
            </p>

            {/* Verdict badge (inline icon) */}
            <div className="flex items-center gap-2 mb-2">
              {config.icon}
              <h3 className={`text-base font-bold ${config.badgeText}`}>
                {config.title}
              </h3>
            </div>

            {/* Description */}
            <p className="text-sm text-ink-600 dark:text-ink-400 leading-relaxed">
              {config.getDescription(result)}
            </p>

            {/* Extra details for possible verdict */}
            {result.verdict === 'possible' && result.raw && (
              <div className="mt-3 px-3 py-2 rounded-sm bg-ink-100 dark:bg-ink-800 text-xs font-mono text-ink-500 dark:text-ink-400">
                Raw metadata: {result.raw}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Credential details for verified results */}
      {result.verdict?.startsWith('verified') && (
        <CredentialDetails result={result} />
      )}
    </div>
  );
}
