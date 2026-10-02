import { parseRecording, type CubeRecording } from '../../../../packages/cube-lab/src/recording.js';

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('livespace-cube-lab', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('recordings', { keyPath: 'recordingId' });
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
}
export async function savedRecordings(): Promise<CubeRecording[]> {
  const db = await database();
  try { return await new Promise((resolve, reject) => {
    const request = db.transaction('recordings', 'readonly').objectStore('recordings').getAll();
    request.onsuccess = () => { const valid: CubeRecording[] = []; for (const value of request.result) { const parsed = (() => { try { return parseRecording(value); } catch { return null; } })(); if (parsed) valid.push(parsed); } resolve(valid.sort((a, b) => b.createdAt.localeCompare(a.createdAt))); };
    request.onerror = () => reject(request.error);
  }); } finally { db.close(); }
}
export async function saveRecording(value: CubeRecording) {
  const recording = parseRecording(value); const db = await database();
  try { await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('recordings', 'readwrite'); tx.objectStore('recordings').put(recording);
    tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error ?? new Error('Save cancelled'));
  }); } finally { db.close(); }
}
export async function deleteRecording(id: string) {
  const db = await database();
  try { await new Promise<void>((resolve, reject) => { const tx = db.transaction('recordings', 'readwrite'); tx.objectStore('recordings').delete(id); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); }); } finally { db.close(); }
}
