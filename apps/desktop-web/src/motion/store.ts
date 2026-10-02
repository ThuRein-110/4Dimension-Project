import { useSyncExternalStore } from 'react';
import { defaultDisplay, type MotionAnalysis, type MotionDisplay } from '../../../../packages/shared/src/motion.js';
import type { VideoMetadata } from './types.js';
import type { AnalysisProgress } from './MotionAnalysisController.js';

interface MotionState { metadata: VideoMetadata | null; analysis: MotionAnalysis | null; display: MotionDisplay; progress: AnalysisProgress | null; status: 'idle' | 'analyzing' | 'complete' | 'cancelled'; model: 'loading' | 'ready' | 'error'; error: string; cacheHit: boolean; fps: 10 | 15 | 30 }
class MotionStore {
  private state: MotionState = { metadata: null, analysis: null, display: { ...defaultDisplay }, progress: null, status: 'idle', model: 'loading', error: '', cacheHit: false, fps: 15 };
  private listeners = new Set<() => void>();
  get = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  set(patch: Partial<MotionState>) { this.state = { ...this.state, ...patch }; this.listeners.forEach(listener => listener()); }
  settings(patch: Partial<MotionDisplay>) { const display = { ...this.state.display, ...patch }; this.set({ display, analysis: this.state.analysis && { ...this.state.analysis, display } }); }
  load(analysis: MotionAnalysis) { this.set({ analysis, display: analysis.display, status: 'complete' }); }
}
export const motion = new MotionStore();
export const useMotion = () => useSyncExternalStore(motion.subscribe, motion.get);
