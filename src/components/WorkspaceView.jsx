import { useState, useEffect } from 'react';
import { listCases, deleteCase, clearAll } from '../services/storage/workspaceRepository';
import { generateHtmlReport } from '../services/report/ReportFormatter';

export default function WorkspaceView() {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadCases = async () => {
    try {
      setLoading(true);
      const results = await listCases();
      setCases(results);
    } catch (err) {
      console.error('Failed to load workspace cases:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCases();
  }, []);

  const handleExportJson = (report) => {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pixeltruth-report-${report.caseInformation.caseId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportHtml = (report) => {
    const html = generateHtmlReport(report);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  const handleDeleteCase = async (caseId) => {
    if (window.confirm('Delete this case?')) {
      await deleteCase(caseId);
      await loadCases();
    }
  };

  const handleClearAll = async () => {
    if (window.confirm('Are you sure you want to delete all saved cases? This action is destructive and cannot be undone.')) {
      await clearAll();
      await loadCases();
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <span className="w-8 h-8 rounded-full border-2 border-surface-700 border-t-develop-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-surface-900/50 border border-surface-800 p-6 rounded-2xl">
        <div>
          <h2 className="text-xl font-bold text-surface-200">Local Workspace</h2>
          <p className="text-sm text-surface-500 mt-1 max-w-xl">
            Recent forensic reports and analysis summaries. 
            <strong> Stored entirely in your browser's local database. No original image files are retained.</strong>
          </p>
        </div>
        {cases.length > 0 && (
          <button 
            onClick={handleClearAll}
            className="px-4 py-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-500/30 rounded-lg text-sm font-bold transition-colors shadow-lg shadow-red-900/20 whitespace-nowrap"
          >
            Clear Local Data
          </button>
        )}
      </div>

      {cases.length === 0 ? (
        <div className="text-center py-24 bg-surface-900/30 border border-surface-800 border-dashed rounded-2xl">
          <p className="text-surface-500">Your workspace is empty.</p>
          <p className="text-xs text-surface-600 mt-2">Save a report from the Inspector tab to view it here.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {cases.map((c) => (
            <div key={c.caseId} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-surface-900/50 border border-surface-800 rounded-xl hover:border-surface-700 transition-colors gap-4">
              <div className="flex items-center gap-4 overflow-hidden">
                {c.thumbnail ? (
                  <img src={c.thumbnail} alt="Thumbnail" className="w-12 h-12 object-cover rounded-md bg-surface-950 border border-surface-700" />
                ) : (
                  <div className="w-12 h-12 rounded-md bg-surface-950 border border-surface-700 flex items-center justify-center text-surface-600 text-xs">No IMG</div>
                )}
                <div className="min-w-0">
                  <h3 className="text-surface-200 font-bold text-sm truncate">{c.filename}</h3>
                  <div className="flex items-center gap-3 mt-1 text-xs text-surface-500 font-mono">
                    <span>{c.caseId}</span>
                    <span>•</span>
                    <span>{new Date(c.generatedTimestamp).toLocaleString()}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button 
                  onClick={() => handleExportJson(c.report)}
                  className="flex-1 sm:flex-none px-3 py-1.5 bg-surface-800 hover:bg-surface-700 text-surface-300 text-xs font-medium rounded-lg transition-colors border border-surface-700"
                >
                  JSON
                </button>
                <button 
                  onClick={() => handleExportHtml(c.report)}
                  className="flex-1 sm:flex-none px-3 py-1.5 bg-violet-600/20 hover:bg-violet-600/40 text-violet-400 text-xs font-medium rounded-lg transition-colors border border-violet-500/30"
                >
                  View HTML
                </button>
                <button 
                  onClick={() => handleDeleteCase(c.caseId)}
                  className="p-1.5 text-surface-500 hover:text-red-400 hover:bg-surface-800 rounded-md transition-colors"
                  aria-label="Delete Case"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
