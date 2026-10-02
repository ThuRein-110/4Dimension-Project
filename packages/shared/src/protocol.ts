import { z } from 'zod';

export const signalSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('offer'), sdp: z.string().max(65000) }),
  z.object({ type: z.literal('answer'), sdp: z.string().max(65000) }),
  z.object({ type: z.literal('ice'), candidate: z.object({
    candidate: z.string().max(4000), sdpMid: z.string().nullable().optional(),
    sdpMLineIndex: z.number().int().nullable().optional(), usernameFragment: z.string().nullable().optional(),
  }) }),
  z.object({ type: z.literal('ready') }),
  z.object({ type: z.literal('telemetry'), width: z.number().nonnegative(), height: z.number().nonnegative(),
    fps: z.number().nonnegative().max(240), orientation: z.enum(['portrait', 'landscape']) }),
]);
export type Signal = z.infer<typeof signalSchema>;
export type ServerSignal = Signal | { type: 'peer-ready' | 'peer-left' | 'joined' } | { type: 'error'; message: string };
export type Role = 'desktop' | 'camera';
export interface SessionInfo {
  id: string;
  cameraToken: string;
  desktopToken: string;
  expiresAt: number;
  cameraUrls: string[];
  tlsReady: boolean;
  certificatePort: number;
}
