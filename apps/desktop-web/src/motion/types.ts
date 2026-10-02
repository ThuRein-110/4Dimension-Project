export interface VideoMetadata {
  id: string; name: string; size: number; mtimeMs: number; codec: string;
  width: number; height: number; fps: number; duration: number; rotation: number;
  pixelFormat: string; status: 'preparing' | 'ready' | 'error'; error?: string;
  prepared: boolean; url: string;
}
