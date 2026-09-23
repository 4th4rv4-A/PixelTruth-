import CredentialDetails from './CredentialDetails';
import AiAnalysisButton from './AiAnalysisButton';
import { OVERALL_ASSESSMENTS } from '../utils/aggregator';

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
    [OVERALL_ASSESSMENTS.VERIFIED_SIGNED_AI_PROVENANCE]: {
      borderColor: 'border-l-develop-500',
      badgeText: 'text-develop-600 dark:text-develop-400',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-develop-500">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      ),
      title: 'Signed AI Provenance Detected'
    },
    [OVERALL_ASSESSMENTS.TRUSTED_PROVENANCE_NO_AI_ASSERTION]: {
      borderColor: 'border-l-develop-400',
      badgeText: 'text-develop-600 dark:text-develop-400',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-develop-500">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <polyline points="9 11 12 14 22 4" />
        </svg>
      ),
      title: 'Trusted Provenance (No AI Assertion)'
    },
    [OVERALL_ASSESSMENTS.AI_TOOL_INDICATOR]: {
      borderColor: 'border-l-warn-500',
      badgeText: 'text-warn-600 dark:text-warn-400',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-warn-500">
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      ),
      title: 'Unverified AI Indicators Detected'
    },
    [OVERALL_ASSESSMENTS.MULTIPLE_SYNTHETIC_SIGNALS]: {
      borderColor: 'border-l-warn-600',
      badgeText: 'text-warn-600 dark:text-warn-400',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-warn-500">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      ),
      title: 'Multiple Synthetic Signals'
    },
    [OVERALL_ASSESSMENTS.NO_SIGNIFICANT_SIGNAL]: {
      borderColor: 'border-l-safelight-500',
      badgeText: 'text-safelight-600 dark:text-safelight-400',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-safelight-500">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      ),
      title: 'No Synthetic Signals Detected'
    },
    [OVERALL_ASSESSMENTS.INCONCLUSIVE]: {
      borderColor: 'border-l-ink-400',
      badgeText: 'text-ink-600 dark:text-ink-400',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-ink-500">
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      ),
      title: 'Inconclusive or Unverified'
    }
  };

  const config = configs[result.overallAssessment] || configs[OVERALL_ASSESSMENTS.INCONCLUSIVE];

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
                {typeof config.title === 'function' ? config.title(result) : config.title}
              </h3>
            </div>

            {/* Description / Human Reasoning */}
            <p className="text-sm text-ink-600 dark:text-ink-400 leading-relaxed">
              {result.humanReasoning}
            </p>

            {result.metadataSignals?.map((sig, i) => (
              <div key={i} className="mt-3 px-3 py-2 rounded-sm bg-ink-100 dark:bg-ink-800 text-xs font-mono text-ink-500 dark:text-ink-400">
                {sig.type}: {sig.description}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Credential details for verified results */}
      {result.rawResult && (result.overallAssessment === OVERALL_ASSESSMENTS.VERIFIED_SIGNED_AI_PROVENANCE || result.overallAssessment === OVERALL_ASSESSMENTS.TRUSTED_PROVENANCE_NO_AI_ASSERTION) && (
        <CredentialDetails result={result.rawResult} />
      )}

      {/* Optional AI Analysis */}
      <div className="px-5 pb-5">
        <AiAnalysisButton file={file} />
      </div>
    </div>
  );
}
