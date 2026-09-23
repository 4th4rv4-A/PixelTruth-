import { useState, useEffect, useCallback, useRef } from 'react';
import { inspectorPool } from '../workers/instances';
import { readMetadata } from '../utils/readMetadata';
import { detectAI } from '../utils/detectAI';

import HexViewer from './HexViewer';
import BinaryStructure from './BinaryStructure';
import MetadataLedger from './MetadataLedger';
import CredentialDetails from './CredentialDetails';
import VisualForensics from './VisualForensics';
import { generateForensicReport } from '../services/report/ReportGenerator';
import { generateHtmlReport } from '../services/report/ReportFormatter';
import { saveCase } from '../services/storage/workspaceRepository';
import { createSafeThumbnail } from '../utils/normalizeInput';
import toast from 'react-hot-toast';

export default function InspectorView({ file }) {
  const [arrayBuffer, setArrayBuffer] = useState(null);
  const [fileIdentity, setFileIdentity] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [c2paResult, setC2paResult] = useState(null);
  const [forensics, setForensics] = useState(null);
  
  const [selectedRange, setSelectedRange] = useState(null);
  const [thumbnailDataUrl, setThumbnailDataUrl] = useState(null);
  
  const abortControllerRef = useRef(null);

  useEffect(() => {
    if (!file) return;

    // Pre-generate a tiny base64 thumbnail for workspace storage
    createSafeThumbnail(file).then(async (url) => {
      try {
        const response = await fetch(url);
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onloadend = () => setThumbnailDataUrl(reader.result);
        reader.readAsDataURL(blob);
      } catch (err) {
        console.warn('Failed to create base64 thumbnail for workspace:', err);
      } finally {
        URL.revokeObjectURL(url);
      }
    });

    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    let isSubscribed = true;

    async function loadData() {
      try {
        const buffer = await file.arrayBuffer();
        if (!isSubscribed) return;
        setArrayBuffer(buffer);

        // 1. Hash and Structure
        inspectorPool.dispatch('INSPECT', {
          file
        }, {
          signal
        }).then(res => {
          if (isSubscribed) {
            setFileIdentity({
              sha256: res.sha256,
              structure: res.structure
            });
          }
        }).catch(err => {
          if (err.message !== 'CANCELLED') console.error('Inspector worker failed:', err);
        });

        // 2. Metadata (exifr)
        readMetadata(file, signal).then(meta => {
          if (isSubscribed) setMetadata(meta);
        }).catch(err => {
          if (err.message !== 'CANCELLED') setMetadata({}); 
        });

        // 3. C2PA
        detectAI(file, signal).then(c2pa => {
          if (isSubscribed) setC2paResult(c2pa);
        }).catch(err => {
          if (err.message !== 'CANCELLED') setC2paResult(null);
        });

      } catch (err) {
        console.error('Failed to load file for inspection:', err);
      }
    }

    loadData();

    return () => {
      isSubscribed = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [file]);

  const handleSegmentClick = useCallback((segment) => {
    setSelectedRange({ offset: segment.offset, size: segment.size });
  }, []);

  const handleByteClick = useCallback((offset) => {
    if (fileIdentity?.structure) {
      // Find the deepest/smallest segment containing this offset
      let bestMatch = null;
      for (const seg of fileIdentity.structure) {
        if (offset >= seg.offset && offset < seg.offset + seg.size) {
          if (!bestMatch || seg.size < bestMatch.size) {
            bestMatch = seg;
          }
        }
      }
      if (bestMatch) {
        setSelectedRange({ offset: bestMatch.offset, size: bestMatch.size });
      } else {
        setSelectedRange(null);
      }
    }
  }, [fileIdentity]);

  const handleExportJson = async () => {
    const report = await generateForensicReport({
      file,
      arrayBuffer,
      dimensions: metadata?.dimensions, // Assuming metadata has dimensions, or we skip
      binaryStructure: fileIdentity?.structure ? { format: fileIdentity.structure[0]?.name || 'Unknown', segments: fileIdentity.structure } : null,
      metadata,
      c2pa: c2paResult,
      forensics,
      cleaningRecord: null // Cleaning is done elsewhere, we pass null here
    });
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pixeltruth-report-${report.caseInformation.caseId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportHtml = async () => {
    const report = await generateForensicReport({
      file,
      arrayBuffer,
      dimensions: metadata?.dimensions,
      binaryStructure: fileIdentity?.structure ? { format: fileIdentity.structure[0]?.name || 'Unknown', segments: fileIdentity.structure } : null,
      metadata,
      c2pa: c2paResult,
      forensics,
      cleaningRecord: null
    });
    const html = generateHtmlReport(report);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };
  
  const handleSaveWorkspace = async () => {
    try {
      const report = await generateForensicReport({
        file,
        arrayBuffer,
        dimensions: metadata?.dimensions,
        binaryStructure: fileIdentity?.structure ? { format: fileIdentity.structure[0]?.name || 'Unknown', segments: fileIdentity.structure } : null,
        metadata,
        c2pa: c2paResult,
        forensics,
        cleaningRecord: null
      });
      const caseId = await saveCase(report, thumbnailDataUrl);
      toast.success(`Case ${caseId} saved to Local Workspace`);
    } catch (err) {
      toast.error(err.message || 'Failed to save case.');
    }
  };

  if (!file) return null;

  return (
    <div className="space-y-6">
      {/* File Identity Section */}
      <section>
        <div className="flex justify-between items-end mb-3">
          <h2 className="text-sm font-bold text-surface-400 uppercase tracking-wider">
            File Identity
          </h2>
          <div className="flex gap-2">
            <button onClick={handleSaveWorkspace} className="px-3 py-1.5 bg-teal-600/20 hover:bg-teal-600/30 text-teal-400 border border-teal-500/30 text-xs font-medium rounded-lg transition-colors shadow-lg shadow-teal-500/10">
              Save to Workspace
            </button>
            <button onClick={handleExportJson} className="hidden sm:block px-3 py-1.5 bg-surface-800 hover:bg-surface-700 text-surface-200 text-xs font-medium rounded-lg transition-colors border border-surface-700">
              Export JSON
            </button>
            <button onClick={handleExportHtml} className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium rounded-lg transition-colors shadow-lg shadow-violet-500/20">
              Print / Save PDF
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-surface-900/50 border border-surface-700 rounded-xl p-4">
            <p className="text-xs text-surface-500 mb-1">File Name</p>
            <p className="text-sm font-medium text-surface-200 break-all">{file.name}</p>
          </div>
          <div className="bg-surface-900/50 border border-surface-700 rounded-xl p-4">
            <p className="text-xs text-surface-500 mb-1">MIME Type</p>
            <p className="text-sm font-medium text-surface-200">{file.type || 'Unknown'}</p>
          </div>
          <div className="bg-surface-900/50 border border-surface-700 rounded-xl p-4">
            <p className="text-xs text-surface-500 mb-1">File Size</p>
            <p className="text-sm font-medium text-surface-200">
              {file.size.toLocaleString()} bytes
            </p>
          </div>
          <div className="bg-surface-900/50 border border-surface-700 rounded-xl p-4">
            <p className="text-xs text-surface-500 mb-1">SHA-256 Hash</p>
            {fileIdentity ? (
              <p className="text-sm font-mono text-surface-200 break-all">{fileIdentity.sha256}</p>
            ) : (
              <div className="h-5 w-3/4 bg-surface-800 animate-pulse rounded" />
            )}
          </div>
        </div>
      </section>

      {/* Provenance Section */}
      {c2paResult && c2paResult.provenance !== 'NO_PROVENANCE' && (
        <section>
          <h2 className="text-sm font-bold text-surface-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-violet-500">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            Cryptographic Provenance
          </h2>
          <div className="border border-violet-500/30 rounded-xl overflow-hidden bg-surface-900/50">
             <CredentialDetails result={c2paResult} />
          </div>
        </section>
      )}

      {/* Metadata Ledger Section */}
      <section>
        <h2 className="text-sm font-bold text-surface-400 uppercase tracking-wider mb-3 flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-warn-500">
             <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8l-6 6v12a2 2 0 0 0 2 2z" />
             <path d="M14 2v4a2 2 0 0 0 2 2h4" />
          </svg>
          Metadata Ledger
        </h2>
        <MetadataLedger metadata={metadata} />
      </section>

      {/* Binary Explorer Section */}
      <section>
        <h2 className="text-sm font-bold text-surface-400 uppercase tracking-wider mb-3 flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-develop-500">
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
          Binary Structure & Hex Viewer
        </h2>
        
        {fileIdentity && arrayBuffer ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <BinaryStructure 
                structure={fileIdentity.structure} 
                selectedRange={selectedRange}
                onSelectSegment={handleSegmentClick}
              />
            </div>
            <div className="lg:col-span-2">
              <HexViewer 
                buffer={arrayBuffer} 
                selectedRange={selectedRange}
                onByteClick={handleByteClick}
              />
            </div>
          </div>
        ) : (
          <div className="border border-surface-700 rounded-xl bg-surface-900/50 p-6 flex flex-col items-center justify-center h-[480px]">
            <span className="w-8 h-8 rounded-full border-2 border-surface-700 border-t-develop-500 animate-spin mb-3" />
            <p className="text-surface-400 text-sm">Parsing binary container...</p>
          </div>
        )}
      </section>

      {/* Visual Forensics Section */}
      <section>
        <h2 className="text-sm font-bold text-surface-400 uppercase tracking-wider mb-3 flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-develop-500">
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
          Visual Forensic Diagnostics
        </h2>
        <VisualForensics file={file} onResult={(res) => setForensics(prev => ({ ...prev, ...res }))} />
      </section>
    </div>
  );
}
