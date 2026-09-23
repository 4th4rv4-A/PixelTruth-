export default function MetadataLedger({ metadata }) {
  if (!metadata) {
    return (
      <div className="border border-surface-700 rounded-xl overflow-hidden bg-surface-900/50 p-6 flex flex-col items-center justify-center text-center h-[200px]">
        <span className="w-8 h-8 rounded-full border-2 border-surface-700 border-t-develop-500 animate-spin mb-3" />
        <p className="text-surface-400 text-sm">Extracting metadata ledger...</p>
      </div>
    );
  }

  // Filter out empty categories
  const entries = Object.entries(metadata).filter((entry) => {
    const data = entry[1];
    return data && typeof data === 'object' && Object.keys(data).length > 0;
  });

  if (entries.length === 0) {
    return (
      <div className="border border-surface-700 rounded-xl overflow-hidden bg-surface-900/50 p-6 flex flex-col items-center justify-center text-center h-[200px]">
        <div className="w-12 h-12 rounded-full bg-safelight-900/30 text-safelight-500 flex items-center justify-center mb-3">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
            <path d="m9 12 2 2 4-4" />
          </svg>
        </div>
        <p className="text-surface-200 font-medium mb-1">Clean Image</p>
        <p className="text-surface-400 text-sm max-w-sm">
          No known sensitive metadata detected in supported structures.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {entries.map(([category, data]) => (
        <div key={category} className="border border-surface-700 rounded-xl overflow-hidden bg-surface-900/50">
          <div className="bg-surface-800 px-4 py-3 border-b border-surface-700 flex items-center justify-between">
            <h3 className="text-sm font-bold text-surface-200 uppercase tracking-wider">
              {category}
            </h3>
            <span className="px-2 py-0.5 rounded-full bg-surface-700 text-surface-300 text-xs font-medium">
              {Object.keys(data).length} entries
            </span>
          </div>
          <div className="p-4 overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <tbody>
                {Object.entries(data).map(([key, val]) => {
                  let displayVal = val;
                  if (val instanceof Uint8Array || val instanceof Uint8ClampedArray) {
                    displayVal = `<binary data: ${val.length} bytes>`;
                  } else if (typeof val === 'object') {
                    displayVal = JSON.stringify(val);
                  } else {
                    displayVal = String(val);
                  }

                  return (
                    <tr key={key} className="border-b border-surface-800/50 last:border-0 hover:bg-surface-800/30 transition-colors">
                      <td className="py-2 pr-4 text-sm font-medium text-surface-400 align-top w-1/3 break-all">
                        {key}
                      </td>
                      <td className="py-2 text-sm text-surface-200 font-mono break-all">
                        {displayVal}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
