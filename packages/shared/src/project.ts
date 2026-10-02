import { z } from 'zod';
import { displaySchema, keyframeSchema } from './motion.js';

const number = z.number().finite();
const coordinate = number.min(-10000).max(10000);
export const vectorSchema = z.object({ x: coordinate, y: coordinate, z: coordinate });
export type Vec3 = z.infer<typeof vectorSchema>;
export const quaternionSchema = vectorSchema.extend({ w: number }).refine(q => Math.abs(Math.hypot(q.x, q.y, q.z, q.w) - 1) < 0.02, 'Camera quaternion must be normalized');
const id = z.string().uuid();
const name = z.string().trim().min(1).max(100);
export const calibrationSchema = z.object({
  method: z.enum(['none', 'manual', 'marker']),
  position: vectorSchema,
  quaternion: quaternionSchema,
  origin: vectorSchema,
  correction: vectorSchema,
  scale: number.min(0.01).max(100),
  fov: number.min(15).max(120),
  markerSize: number.min(0.02).max(2),
  knownDistance: number.min(0.01).max(100),
});
export type Calibration = z.infer<typeof calibrationSchema>;
export const furnitureSchema = z.object({
  instanceId: id, furnitureId: z.enum(['bed', 'desk', 'chair', 'sofa', 'shelf', 'table', 'lamp', 'wardrobe', 'plant']),
  position: vectorSchema, rotation: vectorSchema,
  scale: z.object({ x: number.min(0.1).max(5), y: number.min(0.1).max(5), z: number.min(0.1).max(5) }),
  visible: z.boolean(), locked: z.boolean().default(false),
});
export type FurnitureInstance = z.infer<typeof furnitureSchema>;
export const layoutSchema = z.object({ id, name, furniture: z.array(furnitureSchema).max(500) })
  .refine(layout => new Set(layout.furniture.map(item => item.instanceId)).size === layout.furniture.length, 'Duplicate instance IDs in layout');
export type Layout = z.infer<typeof layoutSchema>;
export const measurementSchema = z.object({ id, name, a: vectorSchema, b: vectorSchema, visible: z.boolean() });
export type Measurement = z.infer<typeof measurementSchema>;
export const projectSchema = z.object({
  schemaVersion: z.literal(1), id, name, createdAt: z.string().datetime(), updatedAt: z.string().datetime(),
  room: z.object({ name, width: number.min(0.5).max(100), length: number.min(0.5).max(100), height: number.min(0.5).max(30) }),
  calibration: calibrationSchema, layouts: z.array(layoutSchema).min(1).max(50), activeLayoutId: id,
  measurements: z.array(measurementSchema).max(500),
  motion: z.object({ videoId: z.string().min(1).max(512), preparedVideoReference: z.string().max(600), analysisId: z.string().regex(/^[a-f0-9]{64}$/), analysisFps: z.union([z.literal(10),z.literal(15),z.literal(30)]), keyframes: z.array(keyframeSchema).max(100), display: displaySchema }).optional(),
  settings: z.object({ autosave: z.boolean(), confirmDelete: z.boolean(), duration: number.min(0.5).max(5), easing: z.enum(['linear', 'smooth']) }),
}).superRefine((project, context) => {
  if (!project.layouts.some(layout => layout.id === project.activeLayoutId)) context.addIssue({ code: 'custom', message: 'Active layout does not exist' });
  if (new Set(project.layouts.map(layout => layout.id)).size !== project.layouts.length) context.addIssue({ code: 'custom', message: 'Duplicate layout IDs' });
  if (new Set(project.measurements.map(item => item.id)).size !== project.measurements.length) context.addIssue({ code: 'custom', message: 'Duplicate measurement IDs' });
  const models = new Map<string, string>();
  for (const layout of project.layouts) for (const item of layout.furniture) {
    if (models.has(item.instanceId) && models.get(item.instanceId) !== item.furnitureId) context.addIssue({ code: 'custom', message: 'A temporal instance must retain the same furniture definition' });
    models.set(item.instanceId, item.furnitureId);
  }
});
export type Project = z.infer<typeof projectSchema>;
export type WorkspaceMode = 'camera' | 'cube' | 'calibration' | 'place' | 'edit' | 'measure' | 'layouts' | 'timeline' | 'compare';
export type CalibrationState = 'NotCalibrated' | 'Searching' | 'ReferenceFound' | 'Calibrating' | 'Calibrated' | 'TrackingLost' | 'ManualCalibration';

export function defaultCalibration(): Calibration {
  return { method: 'none', position: { x: 3.5, y: 3.2, z: 5 },
    quaternion: { x: -0.245668, y: 0.28717, z: 0.076383, w: 0.922683 },
    origin: { x: 0, y: 0, z: 0 }, correction: { x: 0, y: 0, z: 0 },
    scale: 1, fov: 50, markerSize: 0.2, knownDistance: 1 };
}
export function createProject(name = 'Untitled Room'): Project {
  const layoutId = crypto.randomUUID(); const now = new Date().toISOString();
  return { schemaVersion: 1, id: crypto.randomUUID(), name, createdAt: now, updatedAt: now,
    room: { name: 'Room', width: 4, length: 5, height: 2.7 }, calibration: defaultCalibration(),
    layouts: [{ id: layoutId, name: 'Current', furniture: [] }], activeLayoutId: layoutId, measurements: [],
    settings: { autosave: true, confirmDelete: true, duration: 2, easing: 'smooth' } };
}
export function parseProject(value: unknown): Project {
  return projectSchema.parse(value);
}
