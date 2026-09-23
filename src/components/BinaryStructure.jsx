

export default function BinaryStructure({ structure, selectedRange, onSelectSegment }) {
  const getBadgeColor = (category) => {
    switch (category) {
      case 'image': return 'bg-develop-900/30 text-develop-400 border-develop-500/30';
      case 'metadata': return 'bg-warn-900/30 text-warn-400 border-warn-500/30';
      case 'c2pa': return 'bg-violet-900/30 text-violet-400 border-violet-500/30';
      default: return 'bg-surface-800 text-surface-400 border-surface-700';
    }
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="border border-surface-700 rounded-xl overflow-hidden bg-surface-900/50 flex flex-col h-[480px]">
      <div className="flex bg-surface-800 text-xs font-semibold text-surface-400 px-4 py-3 border-b border-surface-700 select-none">
        <div className="flex-1">Segment Name</div>
        <div className="w-24 text-right">Offset</div>
        <div className="w-24 text-right">Size</div>
      </div>
      
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
        {structure.map((seg) => {
          const isSelected = selectedRange?.offset === seg.offset && selectedRange?.size === seg.size;
          return (
            <button
              key={seg.id}
              onClick={() => onSelectSegment(seg)}
              className={`w-full flex items-center px-3 py-2.5 rounded-lg text-sm transition-all duration-200 border ${
                isSelected 
                  ? 'bg-develop-900/40 border-develop-500/50' 
                  : 'bg-transparent border-transparent hover:bg-surface-800/50 hover:border-surface-700'
              }`}
            >
              <div className="flex-1 flex items-center gap-3 min-w-0">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${getBadgeColor(seg.category)}`}>
                  {seg.category}
                </span>
                <span className={`font-medium truncate ${isSelected ? 'text-develop-100' : 'text-surface-200'}`}>
                  {seg.name}
                </span>
              </div>
              <div className="w-24 text-right text-xs font-mono text-surface-500">
                0x{seg.offset.toString(16).toUpperCase()}
              </div>
              <div className="w-24 text-right text-xs font-mono text-surface-400">
                {formatSize(seg.size)}
              </div>
            </button>
          );
        })}
        {structure.length === 0 && (
          <div className="flex items-center justify-center h-full text-surface-500 text-sm">
            No structural data available
          </div>
        )}
      </div>
    </div>
  );
}
