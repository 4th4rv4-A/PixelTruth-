import { useState } from 'react';

export default function CredentialDetails({ result }) {
  const [expanded, setExpanded] = useState(false);

  if (!result || !result.verdict?.startsWith('verified')) return null;

  return (
    <div className="border-t border-surface-200/60 dark:border-surface-700/40">
      {/* Toggle button */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-3 flex items-center justify-between text-sm font-medium text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-800/30 transition-colors"
      >
        <span className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          {expanded ? 'Hide credential details' : 'View credential details'}
        </span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-5 pb-5 space-y-4 animate-fade-in-up">
          {/* Core info grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <DetailItem label="Issuer" value={result.issuer} />
            <DetailItem label="Generator" value={result.generator} />
            {result.signingAlg && (
              <DetailItem label="Signing Algorithm" value={result.signingAlg} />
            )}
            {result.signedAt && (
              <DetailItem label="Signed At" value={formatDate(result.signedAt)} />
            )}
            {result.title && (
              <DetailItem label="Title" value={result.title} />
            )}
            {result.claimVersion && (
              <DetailItem label="Claim Version" value={`v${result.claimVersion}`} />
            )}
          </div>

          {/* Generator info */}
          {result.generatorInfo?.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider mb-2">
                Generator Details
              </h4>
              <div className="space-y-2">
                {result.generatorInfo.map((gen, i) => (
                  <div
                    key={i}
                    className="px-3 py-2 rounded-lg bg-surface-50 dark:bg-surface-800/50 text-sm"
                  >
                    <span className="font-medium text-surface-700 dark:text-surface-300">
                      {gen.name}
                    </span>
                    {gen.version && (
                      <span className="text-surface-500 dark:text-surface-400 ml-2">
                        v{gen.version}
                      </span>
                    )}
                    {gen.operating_system && (
                      <span className="text-surface-400 dark:text-surface-500 ml-2 text-xs">
                        ({gen.operating_system})
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Assertions */}
          {result.assertions?.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider mb-2">
                Assertions ({result.assertions.length})
              </h4>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {result.assertions.map((assertion, i) => (
                  <div
                    key={i}
                    className="px-3 py-2 rounded-lg bg-surface-50 dark:bg-surface-800/50 flex items-center justify-between"
                  >
                    <span className="text-sm font-mono text-surface-700 dark:text-surface-300 truncate">
                      {assertion.label}
                    </span>
                    {assertion.kind && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-surface-200 dark:bg-surface-700 text-surface-500 dark:text-surface-400 flex-shrink-0 ml-2">
                        {assertion.kind}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ingredients */}
          {result.ingredients?.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider mb-2">
                Ingredients ({result.ingredients.length})
              </h4>
              <div className="space-y-1.5">
                {result.ingredients.map((ing, i) => (
                  <div
                    key={i}
                    className="px-3 py-2 rounded-lg bg-surface-50 dark:bg-surface-800/50 flex items-center justify-between"
                  >
                    <span className="text-sm text-surface-700 dark:text-surface-300 truncate">
                      {ing.title || 'Untitled'}
                    </span>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      {ing.format && (
                        <span className="text-xs text-surface-400 dark:text-surface-500">
                          {ing.format}
                        </span>
                      )}
                      {ing.relationship && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-accent-100 dark:bg-accent-900/30 text-accent-700 dark:text-accent-400">
                          {ing.relationship}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DetailItem({ label, value }) {
  return (
    <div className="px-3 py-2.5 rounded-lg bg-surface-50 dark:bg-surface-800/50">
      <p className="text-xs font-medium text-surface-400 dark:text-surface-500 mb-0.5">
        {label}
      </p>
      <p className="text-sm font-medium text-surface-800 dark:text-surface-200 break-all">
        {value}
      </p>
    </div>
  );
}

function formatDate(dateStr) {
  try {
    return new Date(dateStr).toLocaleString();
  } catch {
    return dateStr;
  }
}
