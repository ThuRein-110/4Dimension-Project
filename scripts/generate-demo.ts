import { mkdir, writeFile, copyFile } from 'node:fs/promises';
import { demoProject } from '../packages/layouts/src/demo.js';
import { parseProject } from '../packages/shared/src/project.js';

await mkdir('assets/demo', { recursive: true });
await mkdir('public/assets/demo', { recursive: true });
await writeFile('assets/demo/bedroom-project.json', JSON.stringify(parseProject(demoProject()), null, 2));
await copyFile('assets/demo/bedroom-project.json', 'public/assets/demo/bedroom-project.json');
console.log('Generated schemaVersion 1 Bedroom / Study / Gaming demo project.');
