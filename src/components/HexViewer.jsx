import { useState, useMemo, useRef, useEffect } from 'react';

const ROW_HEIGHT = 24;
const BYTES_PER_ROW = 16;
const VISIBLE_ROWS = 20;

export default function HexViewer({ buffer, selectedRange, onByteClick }) {
  const containerRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);
  
  const bytes = useMemo(() => new Uint8Array(buffer), [buffer]);
  const totalRows = Math.ceil(bytes.length / BYTES_PER_ROW);
  const totalHeight = totalRows * ROW_HEIGHT;

  useEffect(() => {
    if (selectedRange && containerRef.current) {
      const targetRow = Math.floor(selectedRange.offset / BYTES_PER_ROW);
      containerRef.current.scrollTop = targetRow * ROW_HEIGHT;
    }
  }, [selectedRange]);

  const handleScroll = (e) => {
    setScrollTop(e.target.scrollTop);
  };

  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - 5);
  const endIndex = Math.min(totalRows, startIndex + VISIBLE_ROWS + 10);

  const renderRow = (rowIndex) => {
    const offset = rowIndex * BYTES_PER_ROW;
    const rowBytes = bytes.subarray(offset, Math.min(offset + BYTES_PER_ROW, bytes.length));
    
    const hexElements = [];
    const asciiElements = [];
    
    for (let i = 0; i < BYTES_PER_ROW; i++) {
      if (i < rowBytes.length) {
        const b = rowBytes[i];
        const isSelected = selectedRange && (offset + i >= selectedRange.offset) && (offset + i < selectedRange.offset + selectedRange.size);
        const hex = b.toString(16).padStart(2, '0').toUpperCase();
        
        hexElements.push(
          <span key={`hex-${i}`} className={`inline-block w-6 text-center ${isSelected ? 'bg-develop-500/30 text-develop-300' : ''}`} data-offset={offset + i}>
            {hex}
          </span>
        );
        hexElements.push(<span key={`hex-sp-${i}`}> </span>);
        
        asciiElements.push(
          <span key={`ascii-${i}`} className={isSelected ? 'bg-develop-500/30 text-develop-300' : ''} data-offset={offset + i}>
            {(b >= 32 && b <= 126) ? String.fromCharCode(b) : '.'}
          </span>
        );
      } else {
        hexElements.push(
          <span key={`hex-em-${i}`} className="inline-block w-6 text-center text-surface-700"></span>
        );
        hexElements.push(<span key={`hex-em-sp-${i}`}> </span>);
        asciiElements.push(
          <span key={`ascii-em-${i}`} className="text-surface-700"></span>
        );
      }
    }

    return (
      <div 
        key={rowIndex} 
        className="absolute w-full flex font-mono text-sm leading-[24px] hover:bg-surface-800/30 transition-colors"
        style={{ top: rowIndex * ROW_HEIGHT, height: ROW_HEIGHT }}
      >
        <div className="w-24 text-surface-500 select-none text-right pr-4">
          {offset.toString(16).padStart(8, '0').toUpperCase()}
        </div>
        <div className="w-[420px] text-surface-300 select-text cursor-text">
          {hexElements}
        </div>
        <div className="flex-1 text-surface-400 whitespace-pre select-text cursor-text">
          {asciiElements}
        </div>
      </div>
    );
  };

  const rows = [];
  for (let i = startIndex; i < endIndex; i++) {
    rows.push(renderRow(i));
  }

  const handleContainerClick = (e) => {
    if (e.target.tagName === 'SPAN' && e.target.dataset.offset) {
      if (onByteClick) {
        onByteClick(parseInt(e.target.dataset.offset, 10));
      }
    }
  };

  return (
    <div className="border border-surface-700 rounded-xl overflow-hidden bg-surface-900/50">
      <div className="flex bg-surface-800 text-xs font-mono text-surface-400 px-4 py-2 border-b border-surface-700 select-none">
        <div className="w-20 text-right pr-4">Offset</div>
        <div className="w-[420px]">
          {Array.from({length: 16}).map((_, i) => (
            <span key={i} className="inline-block w-6 text-center mr-1">{i.toString(16).toUpperCase()}</span>
          ))}
        </div>
        <div className="flex-1">Decoded ASCII</div>
      </div>
      <div 
        ref={containerRef}
        className="relative overflow-y-auto h-[480px] custom-scrollbar"
        onScroll={handleScroll}
        onClick={handleContainerClick}
      >
        <div style={{ height: totalHeight, minHeight: '100%' }}>
          {rows}
        </div>
      </div>
    </div>
  );
}
