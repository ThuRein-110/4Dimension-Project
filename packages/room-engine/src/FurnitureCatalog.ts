import type { FurnitureInstance } from '../../shared/src/project.js';
export interface FurnitureDefinition {
  id: FurnitureInstance['furnitureId']; name: string; category: string; description: string; thumbnail: string; modelUrl?: string;
  width: number; height: number; depth: number; minimumScale: number; maximumScale: number; floorOffset: number; color: number;
}
const entries: Omit<FurnitureDefinition, 'description' | 'thumbnail' | 'minimumScale' | 'maximumScale' | 'floorOffset'>[] = [
  { id: 'bed', name: 'Platform bed', category: 'Bed', width: 1.6, height: .55, depth: 2, color: 0xe3e7df },
  { id: 'desk', name: 'Writing desk', category: 'Desk', width: 1.3, height: .75, depth: .65, color: 0xc9ad85 },
  { id: 'chair', name: 'Task chair', category: 'Chair', width: .55, height: .95, depth: .55, color: 0x879a9d },
  { id: 'sofa', name: 'Two-seat sofa', category: 'Sofa', width: 1.8, height: .85, depth: .85, color: 0x8ca28b },
  { id: 'shelf', name: 'Open shelf', category: 'Shelf', width: .85, height: 1.6, depth: .35, color: 0xd3c5ae },
  { id: 'table', name: 'Coffee table', category: 'Table', width: 1, height: .45, depth: .6, color: 0xd5b58a },
  { id: 'lamp', name: 'Floor lamp', category: 'Lamp', width: .35, height: 1.5, depth: .35, color: 0xf0dbc0 },
  { id: 'wardrobe', name: 'Wardrobe', category: 'Wardrobe', width: 1.2, height: 2, depth: .6, color: 0xd1d4ce },
  { id: 'plant', name: 'Potted plant', category: 'Decoration', width: .4, height: .8, depth: .4, color: 0x8fb777 },
];
export const catalog: FurnitureDefinition[] = entries.map(item => ({ ...item, description: `Local ${item.category.toLowerCase()} model`, thumbnail: `/assets/models/${item.id}.png`, minimumScale: .1, maximumScale: 5, floorOffset: 0 }));
export const definition = (id: string) => catalog.find(item => item.id === id);
