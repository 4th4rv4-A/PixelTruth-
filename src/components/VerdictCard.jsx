import { useState } from 'react';
import CredentialDetails from './CredentialDetails';

export default function VerdictCard({ item }) {
  const { file, thumbnailUrl, result } = item;

  if (!result) {
    // Loading state
    return (
      <div className="glass-card p-5 animate-fade-in-up">
        <div className="flex items-center gap-4">
          <div className="flex-shrink-0 w-14 h-14 rounded-xl overflow-hidden bg-surface-100 dark:bg-surface-700 ring-1 ring-surface-200 dark:ring-surface-600">
            <img src={thumbnailUrl} alt={file.name} className="w-full h-full object-cover" loading="lazy" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-surface-800 dark:text-surface-200 truncate">{file.name}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="w-4 h-4 rounded-full border-2 border-surface-300 border-t-violet-500 animate-spin" />
              <span className="text-sm text-surface-500 dark:text-surface-400">Analyzing credentials…</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const configs = {
    'verified-ai': {
      borderColor: 'border-l-emerald-500',
      bgAccent: 'bg-emerald-50 dark:bg-emerald-900/20',
      iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      badgeBg: 'bg-emerald-100 dark:bg-emerald-900/30',
      badgeText: 'text-emerald-700 dark:text-emerald-400',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      ),
      title: 'Verified AI-Generated',
      getDescription: (r) =>
        `This image has a verified Content Credential from ${r.issuer}, indicating it was generated or modified by ${r.generator}.`,
    },
    'verified-provenance': {
      borderColor: 'border-l-blue-500',
      bgAccent: 'bg-blue-50 dark:bg-blue-900/20',
      iconBg: 'bg-blue-100 dark:bg-blue-900/30',
      iconColor: 'text-blue-600 dark:text-blue-400',
      badgeBg: 'bg-blue-100 dark:bg-blue-900/30',
      badgeText: 'text-blue-700 dark:text-blue-400',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <polyline points="9 11 12 14 22 4" />
        </svg>
      ),
      title: 'Verified Provenance (Non-synthetic)',
      getDescription: (r) =>
        `Valid Content Credential found from ${r.issuer} (${r.generator}), but no AI generation markers are present. This typically indicates a standard digital camera or software credential.`,
    },
    possible: {
      borderColor: 'border-l-amber-500',
      bgAccent: 'bg-amber-50 dark:bg-amber-900/20',
      iconBg: 'bg-amber-100 dark:bg-amber-900/30',
      iconColor: 'text-amber-600 dark:text-amber-400',
      badgeBg: 'bg-amber-100 dark:bg-amber-900/30',
      badgeText: 'text-amber-700 dark:text-amber-400',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
      borderColor: 'border-l-surface-400',
      bgAccent: 'bg-surface-50 dark:bg-surface-800/50',
      iconBg: 'bg-surface-100 dark:bg-surface-800',
      iconColor: 'text-surface-500 dark:text-surface-400',
      badgeBg: 'bg-surface-100 dark:bg-surface-800',
      badgeText: 'text-surface-600 dark:text-surface-400',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
    <div className={`glass-card overflow-hidden border-l-4 ${config.borderColor} animate-fade-in-up`}>
      <div className="p-5">
        <div className="flex items-start gap-4">
          {/* Thumbnail */}
          <div className="flex-shrink-0 w-14 h-14 rounded-xl overflow-hidden bg-surface-100 dark:bg-surface-700 ring-1 ring-surface-200 dark:ring-surface-600">
            <img src={thumbnailUrl} alt={file.name} className="w-full h-full object-cover" loading="lazy" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* File name */}
            <p className="text-sm font-medium text-surface-600 dark:text-surface-400 truncate mb-2">
              {file.name}
            </p>

            {/* Verdict badge */}
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-xl ${config.iconBg} flex items-center justify-center flex-shrink-0`}>
                <span className={config.iconColor}>{config.icon}</span>
              </div>
              <div>
                <h3 className={`text-base font-bold ${config.badgeText}`}>
                  {config.title}
                </h3>
              </div>
            </div>

            {/* Description */}
            <p className="text-sm text-surface-600 dark:text-surface-400 leading-relaxed">
              {config.getDescription(result)}
            </p>

            {/* Extra details for possible verdict */}
            {result.verdict === 'possible' && result.raw && (
              <div className="mt-3 px-3 py-2 rounded-lg bg-surface-50 dark:bg-surface-800/50 text-xs font-mono text-surface-500 dark:text-surface-400">
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
