import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { saveCase, getCase, listCases, deleteCase, clearAll } from '../workspaceRepository';

// Mock IndexedDB
const mockStore = new Map();
let mockErrorNext = false;

const mockIDBRequest = {
  onsuccess: null,
  onerror: null,
  result: null,
};

const mockObjectStore = {
  put: vi.fn((record) => {
    const req = { ...mockIDBRequest };
    setTimeout(() => {
      if (mockErrorNext) {
        mockErrorNext = false;
        req.error = new Error('QuotaExceededError');
        req.error.name = 'QuotaExceededError';
        req.onerror({ target: req });
      } else {
        mockStore.set(record.caseId, record);
        req.result = record.caseId;
        req.onsuccess({ target: req });
      }
    }, 0);
    return req;
  }),
  get: vi.fn((key) => {
    const req = { ...mockIDBRequest };
    setTimeout(() => {
      req.result = mockStore.get(key);
      req.onsuccess({ target: req });
    }, 0);
    return req;
  }),
  delete: vi.fn((key) => {
    const req = { ...mockIDBRequest };
    setTimeout(() => {
      mockStore.delete(key);
      req.onsuccess({ target: req });
    }, 0);
    return req;
  }),
  clear: vi.fn(() => {
    const req = { ...mockIDBRequest };
    setTimeout(() => {
      mockStore.clear();
      req.onsuccess({ target: req });
    }, 0);
    return req;
  }),
  index: vi.fn(() => ({
    openCursor: vi.fn(() => {
      const req = { ...mockIDBRequest };
      const values = Array.from(mockStore.values()).sort((a, b) => b.timestamp - a.timestamp); // descending
      let idx = 0;
      setTimeout(() => {
        const next = () => {
          if (idx < values.length) {
            req.result = {
              value: values[idx++],
              continue: next
            };
          } else {
            req.result = null;
          }
          req.onsuccess({ target: req });
        };
        next();
      }, 0);
      return req;
    })
  }))
};

const mockTransaction = {
  objectStore: vi.fn(() => mockObjectStore)
};

const mockDB = {
  transaction: vi.fn(() => mockTransaction),
  objectStoreNames: {
    contains: vi.fn(() => true)
  }
};

const originalIndexedDB = global.indexedDB;

beforeEach(() => {
  mockStore.clear();
  global.indexedDB = {
    open: vi.fn(() => {
      const req = { ...mockIDBRequest };
      setTimeout(() => {
        req.result = mockDB;
        req.onsuccess({ target: req });
      }, 0);
      return req;
    })
  };
});

afterEach(() => {
  global.indexedDB = originalIndexedDB;
  vi.clearAllMocks();
});

describe('workspaceRepository', () => {

  const sampleReport = {
    caseInformation: { caseId: 'PT-1234', generatedTimestamp: '2026-09-22T00:00:00Z' },
    imageIdentity: { filename: 'test.png' }
  };

  it('saves a case', async () => {
    const caseId = await saveCase(sampleReport, 'data:image/png;base64,123');
    expect(caseId).toBe('PT-1234');
    expect(mockStore.has('PT-1234')).toBe(true);
    expect(mockStore.get('PT-1234').thumbnail).toBe('data:image/png;base64,123');
  });

  it('throws QuotaExceededError when full', async () => {
    mockErrorNext = true;
    await expect(saveCase(sampleReport)).rejects.toThrow('Browser storage quota exceeded.');
  });

  it('retrieves a case', async () => {
    await saveCase(sampleReport);
    const result = await getCase('PT-1234');
    expect(result.filename).toBe('test.png');
  });

  it('lists cases in descending order', async () => {
    await saveCase(sampleReport);
    
    const secondReport = JSON.parse(JSON.stringify(sampleReport));
    secondReport.caseInformation.caseId = 'PT-5678';
    
    // Simulate slight delay to ensure different timestamps
    await new Promise(r => setTimeout(r, 10)); 
    await saveCase(secondReport);

    const list = await listCases();
    expect(list.length).toBe(2);
    expect(list[0].caseId).toBe('PT-5678'); // Newest first
    expect(list[1].caseId).toBe('PT-1234');
  });

  it('deletes a case', async () => {
    await saveCase(sampleReport);
    await deleteCase('PT-1234');
    const result = await getCase('PT-1234');
    expect(result).toBeNull();
  });

  it('clears all cases', async () => {
    await saveCase(sampleReport);
    await clearAll();
    expect(mockStore.size).toBe(0);
  });
});
