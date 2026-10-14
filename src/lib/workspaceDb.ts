/**
 * Minimal IndexedDB wrapper for My Workspace:
 * Stores recent local processing history & custom presets without ever sending data over the network.
 */
const DB_NAME = 'prism_toolkit_workspace_v1';
const STORE_HISTORY = 'history';

export interface WorkspaceHistoryItem {
  id: string;
  toolId: string;
  toolName: string;
  inputName: string;
  inputBytes: number;
  outputName: string;
  outputBytes: number;
  outputFormat: string;
  timestamp: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_HISTORY)) {
        db.createObjectStore(STORE_HISTORY, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function recordHistoryItem(item: WorkspaceHistoryItem): Promise<void> {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE_HISTORY, 'readwrite');
    tx.objectStore(STORE_HISTORY).put(item);
  } catch {
    // IndexedDB unavailable in private/sandboxed frame; fail gracefully
  }
}

export async function listHistoryItems(): Promise<WorkspaceHistoryItem[]> {
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE_HISTORY, 'readonly');
      const req = tx.objectStore(STORE_HISTORY).getAll();
      req.onsuccess = () => {
        const list = (req.result || []) as WorkspaceHistoryItem[];
        resolve(list.sort((a, b) => b.timestamp - a.timestamp).slice(0, 30));
      };
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}
