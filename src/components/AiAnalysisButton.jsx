import { useState, useRef, useEffect } from 'react';
import { aiPool } from '../workers/instances';

export default function AiAnalysisButton({ file, onResult }) {
  const [state, setState] = useState('IDLE'); // IDLE, DOWNLOADING_MODEL, INITIALIZING, PREPROCESSING, INFERENCE, POSTPROCESSING, COMPLETE, ERROR
  const [errorMsg, setErrorMsg] = useState('');
  const [result, setResult] = useState(null);
  const abortControllerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleStart = async () => {
    if (state !== 'IDLE' && state !== 'ERROR') return;
    
    setState('DOWNLOADING_MODEL');
    setErrorMsg('');
    
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      const response = await aiPool.dispatch('ANALYZE_IMAGE', { fileBlob: file }, { 
        signal,
        onMessage: (msg) => {
          if (msg.type === 'PROGRESS') {
            setState(msg.state);
          }
        }
      });
      
      setState('COMPLETE');
      setResult(response);
      if (onResult) onResult(response);
    } catch (err) {
      if (err.message !== 'CANCELLED') {
        console.error('AI Inference failed:', err);
        setState('ERROR');
        setErrorMsg(err.message || 'Unknown error');
      } else {
        setState('IDLE');
      }
    }
  };

  const getProgressWidth = () => {
    switch (state) {
      case 'DOWNLOADING_MODEL': return '20%';
      case 'INITIALIZING': return '40%';
      case 'PREPROCESSING': return '60%';
      case 'INFERENCE': return '80%';
      case 'POSTPROCESSING': return '90%';
      case 'COMPLETE': return '100%';
      default: return '0%';
    }
  };

  const getProgressLabel = () => {
    switch (state) {
      case 'DOWNLOADING_MODEL': return 'Downloading Model...';
      case 'INITIALIZING': return 'Initializing ONNX...';
      case 'PREPROCESSING': return 'Preprocessing Image...';
      case 'INFERENCE': return 'Running Inference...';
      case 'POSTPROCESSING': return 'Postprocessing...';
      default: return '';
    }
  };

  if (state === 'COMPLETE' && result) {
    return (
      <div className="w-full mt-4 p-4 bg-surface-900/50 border border-surface-700 rounded-xl space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-violet-500">
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
          <h4 className="text-sm font-bold text-surface-200">Local AI Analysis</h4>
          <span className="ml-auto text-xs px-2 py-0.5 bg-surface-800 text-surface-400 rounded-full font-mono">
            {result.runtime} ({result.executionProvider})
          </span>
        </div>
        
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs text-surface-500">Synthetic Likelihood Score</p>
            <p className="text-2xl font-black text-surface-100">
              {(result.syntheticLikelihood * 100).toFixed(1)}%
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-surface-500">Signal Strength</p>
            <p className={`text-sm font-bold ${
              result.signalStrength === 'HIGH' ? 'text-warn-500' :
              result.signalStrength === 'MODERATE' ? 'text-amber-500' :
              'text-develop-500'
            }`}>
              {result.signalStrength}
            </p>
          </div>
        </div>

        <div className="pt-2 border-t border-surface-800">
          <p className="text-[10px] text-surface-500 uppercase font-bold mb-1">Limitations</p>
          <ul className="text-[10px] text-surface-400 list-disc list-inside space-y-0.5 leading-tight">
            {result.limitations.map((limit, idx) => (
              <li key={idx}>{limit}</li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  if (state === 'ERROR') {
    return (
      <div className="w-full mt-4 p-4 bg-warn-900/20 border border-warn-500/30 rounded-xl">
        <p className="text-sm font-bold text-warn-400 mb-1">AI Analysis Unavailable</p>
        <p className="text-xs text-surface-400 mb-3">{errorMsg}</p>
        <button 
          onClick={handleStart}
          className="text-xs font-bold text-warn-300 hover:text-warn-200 uppercase tracking-wide transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (state !== 'IDLE') {
    return (
      <div className="w-full mt-4 p-4 bg-surface-900/50 border border-surface-700 rounded-xl flex flex-col gap-2">
        <div className="flex justify-between items-center text-xs font-medium text-surface-400">
          <span>{getProgressLabel()}</span>
          <span>{getProgressWidth()}</span>
        </div>
        <div className="w-full h-1.5 bg-surface-800 rounded-full overflow-hidden">
          <div 
            className="h-full bg-violet-500 transition-all duration-300 ease-out" 
            style={{ width: getProgressWidth() }}
          />
        </div>
        <button
          onClick={() => {
            if (abortControllerRef.current) abortControllerRef.current.abort();
            setState('IDLE');
          }}
          className="text-xs text-surface-500 hover:text-surface-300 transition-colors self-start mt-1"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="w-full mt-4 border-t border-surface-800 pt-4 flex justify-between items-center">
      <div className="flex-1">
        <h4 className="text-sm font-medium text-surface-300">Advanced AI Analysis</h4>
        <p className="text-xs text-surface-500">Run local inference. Model (~45MB) will be downloaded on first run.</p>
      </div>
      <button 
        onClick={handleStart}
        className="ml-4 px-4 py-2 bg-violet-600/20 hover:bg-violet-600/30 text-violet-400 border border-violet-500/30 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
      >
        Run Analysis
      </button>
    </div>
  );
}
