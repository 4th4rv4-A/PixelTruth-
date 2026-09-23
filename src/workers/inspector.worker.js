import { parseStructure } from '../services/binary/parser.js';

self.onmessage = async (e) => {
  const { id, type, action, payload } = e.data;
  
  if (type === 'CANCEL') return;
  if (type !== 'START') return;

  try {
    if (action === 'INSPECT') {
      const { file } = payload;
      const mime = file.type;
      const buffer = await file.arrayBuffer();
      
      // Hash calculation (SHA-256)
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const sha256 = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      // Structural parsing
      let structure = [];
      try {
        structure = parseStructure(buffer, mime);
      } catch (err) {
        console.warn('Structural parsing failed:', err);
      }

      self.postMessage({
        id,
        type: 'COMPLETE',
        result: {
          sha256,
          structure
        }
      });
    } else {
      throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    self.postMessage({ id, type: 'ERROR', error: error.message || 'Worker error' });
  }
};
