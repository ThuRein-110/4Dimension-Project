import { analysisSchema, type MotionAnalysis } from '../../../../packages/shared/src/motion.js';

const database = () => new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open('4dlivespace-motion', 1);
  request.onupgradeneeded = () => request.result.createObjectStore('analyses', { keyPath: 'id' });
  request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
});
export async function loadAnalysis(id: string): Promise<MotionAnalysis | null> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction('analyses').objectStore('analyses').get(id);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => { if (!request.result) resolve(null); else { const result = analysisSchema.safeParse(request.result); if (result.success && result.data.id === id) resolve(result.data); else reject(new Error('Cached motion data is invalid. Analyze again to replace it.')); } };
    });
  } finally { db.close(); }
}
export async function saveAnalysis(analysis: MotionAnalysis) {
  if (analysis.analysis.scope !== 'video') return;
  const data = analysisSchema.parse(analysis); const db = await database();
  try {
    await new Promise<void>((resolve, reject) => { const tx = db.transaction('analyses','readwrite'); tx.objectStore('analyses').put(data); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error); });
  } finally { db.close(); }
}
