import { useState, useEffect, useRef } from 'react';
import { forensicsPool } from '../workers/instances';

export default function VisualForensics({ file, onResult }) {
  const [elaResult, setElaResult] = useState(null);
  const [fftResult, setFftResult] = useState(null);
  const [loadingEla, setLoadingEla] = useState(true);
  const [loadingFft, setLoadingFft] = useState(true);
  
  const elaCanvasRef = useRef(null);
  const fftCanvasRef = useRef(null);
  const abortControllerRef = useRef(null);

  const drawToCanvas = (canvas, result) => {
    if (!canvas || !result || !result.buffer) return;
    const ctx = canvas.getContext('2d');
    const imgData = new ImageData(
      new Uint8ClampedArray(result.buffer), 
      result.width, 
      result.height
    );
    canvas.width = result.width;
    canvas.height = result.height;
    ctx.putImageData(imgData, 0, 0);
  };

  useEffect(() => {
    if (!file) return;

    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    let isSubscribed = true;
    
    // eslint-disable-next-line react/set-state-in-effect
    setLoadingEla(true);
    // eslint-disable-next-line react/set-state-in-effect
    setLoadingFft(true);

    async function runAnalysis() {
      try {
        // Run ELA
        forensicsPool.dispatch('RUN_ELA', { fileBlob: file }, { signal })
          .then(res => {
            if (isSubscribed) {
              setElaResult(res);
              setLoadingEla(false);
              drawToCanvas(elaCanvasRef.current, res);
            }
          })
          .catch(err => {
            if (err.message !== 'CANCELLED') {
              console.error('ELA failed:', err);
              if (isSubscribed) setLoadingEla(false);
            }
          });

        // Run FFT
        forensicsPool.dispatch('RUN_FFT', { fileBlob: file }, { signal })
          .then(res => {
            if (isSubscribed) {
              setFftResult(res);
              setLoadingFft(false);
              drawToCanvas(fftCanvasRef.current, res);
            }
          })
          .catch(err => {
            if (err.message !== 'CANCELLED') {
              console.error('FFT failed:', err);
              if (isSubscribed) setLoadingFft(false);
            }
          });
      } catch (err) {
        console.error('Forensics dispatch failed:', err);
      }
    }

    runAnalysis();

    return () => {
      isSubscribed = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [file]);

  useEffect(() => {
    if (onResult && (elaResult || fftResult)) {
      onResult({ ela: elaResult, fft: fftResult });
    }
  }, [elaResult, fftResult, onResult]);

  return (
    <div className="space-y-6">
      <div className="bg-warn-900/20 border border-warn-500/30 rounded-xl p-4">
        <h3 className="text-sm font-bold text-warn-400 mb-2 flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          Diagnostic Signals Only
        </h3>
        <p className="text-sm text-surface-300 leading-relaxed">
          These visual tools highlight physical compression properties and frequency domain patterns. 
          They <strong className="text-surface-100">do not</strong> prove an image is AI-generated, nor do they definitively prove manipulation on their own. 
          Natural edges produce high ELA differences, and standard upscaling produces grid artifacts in FFT.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ELA Block */}
        <div className="border border-surface-700 rounded-xl overflow-hidden bg-surface-900/50 flex flex-col">
          <div className="bg-surface-800 px-4 py-3 border-b border-surface-700">
            <h3 className="text-sm font-bold text-surface-200">Compression Difference Map (ELA)</h3>
          </div>
          <div className="p-4 flex-1 flex flex-col items-center">
            <div className="w-full aspect-square bg-surface-950 rounded border border-surface-800 flex items-center justify-center overflow-hidden mb-4 relative">
              {loadingEla && (
                <div className="absolute inset-0 flex items-center justify-center bg-surface-900/80 backdrop-blur-sm z-10">
                  <span className="w-8 h-8 rounded-full border-2 border-surface-700 border-t-develop-500 animate-spin" />
                </div>
              )}
              <canvas ref={elaCanvasRef} className="w-full h-full object-contain" />
            </div>
            <div className="w-full text-sm text-surface-400">
              {elaResult ? (
                <>
                  <p className="font-medium text-surface-200 mb-1">{elaResult.summary}</p>
                  <ul className="list-disc list-inside text-xs space-y-1">
                    {elaResult.warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </>
              ) : (
                <p>Waiting for analysis...</p>
              )}
            </div>
          </div>
        </div>

        {/* FFT Block */}
        <div className="border border-surface-700 rounded-xl overflow-hidden bg-surface-900/50 flex flex-col">
          <div className="bg-surface-800 px-4 py-3 border-b border-surface-700">
            <h3 className="text-sm font-bold text-surface-200">2D FFT Magnitude Spectrum</h3>
          </div>
          <div className="p-4 flex-1 flex flex-col items-center">
            <div className="w-full aspect-square bg-surface-950 rounded border border-surface-800 flex items-center justify-center overflow-hidden mb-4 relative">
              {loadingFft && (
                <div className="absolute inset-0 flex items-center justify-center bg-surface-900/80 backdrop-blur-sm z-10">
                  <span className="w-8 h-8 rounded-full border-2 border-surface-700 border-t-develop-500 animate-spin" />
                </div>
              )}
              <canvas ref={fftCanvasRef} className="w-full h-full object-contain" />
            </div>
            <div className="w-full text-sm text-surface-400">
              {fftResult ? (
                <>
                  <p className="font-medium text-surface-200 mb-1">{fftResult.summary}</p>
                  <ul className="list-disc list-inside text-xs space-y-1">
                    {fftResult.warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </>
              ) : (
                <p>Waiting for analysis...</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
