const DB_NAME = 'PixelTruthWorkspace';
const DB_VERSION = 1;
const STORE_NAME = 'cases';

/**
 * Initializes the IndexedDB database.
 * @returns {Promise<IDBDatabase>}
 */
function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(new Error('Failed to open IndexedDB.'));

    request.onsuccess = (event) => resolve(event.target.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'caseId' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
}

/**
 * Saves a forensic report to the local workspace.
 * @param {Object} report The structured JSON report
 * @param {string} [thumbnailStr] Optional tiny base64 data URL string
 * @returns {Promise<string>} The case ID
 */
export async function saveCase(report, thumbnailStr = null) {
  if (!report || !report.caseInformation || !report.caseInformation.caseId) {
    throw new Error('Invalid report object. Cannot save.');
  }

  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const record = {
      caseId: report.caseInformation.caseId,
      timestamp: Date.now(), // Store as numeric for sorting
      generatedTimestamp: report.caseInformation.generatedTimestamp,
      filename: report.imageIdentity.filename,
      thumbnail: thumbnailStr,
      report
    };

    const request = store.put(record);

    request.onsuccess = () => resolve(record.caseId);
    request.onerror = (e) => {
      if (e.target.error.name === 'QuotaExceededError') {
        reject(new Error('Browser storage quota exceeded. Please clear old cases.'));
      } else {
        reject(e.target.error);
      }
    };
  });
}

/**
 * Retrieves a specific case from the workspace.
 * @param {string} caseId
 * @returns {Promise<Object|null>}
 */
export async function getCase(caseId) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(caseId);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(new Error('Failed to retrieve case.'));
  });
}

/**
 * Lists all cases in the workspace, sorted by timestamp descending.
 * @returns {Promise<Array<Object>>}
 */
export async function listCases() {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('timestamp');
    const request = index.openCursor(null, 'prev'); // Descending order

    const results = [];
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        results.push(cursor.value);
        cursor.continue();
      } else {
        resolve(results);
      }
    };

    request.onerror = () => reject(new Error('Failed to list cases.'));
  });
}

/**
 * Deletes a specific case from the workspace.
 * @param {string} caseId
 * @returns {Promise<void>}
 */
export async function deleteCase(caseId) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(caseId);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('Failed to delete case.'));
  });
}

/**
 * Clears all data from the workspace entirely.
 * @returns {Promise<void>}
 */
export async function clearAll() {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('Failed to clear workspace.'));
  });
}
