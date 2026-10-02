import React, { lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { AppErrorBoundary } from './AppErrorBoundary.js';
import './styles.css';

const DesktopApp = lazy(() => import('./DesktopApp.js').then(module => ({ default: module.DesktopApp })));
const CameraApp = lazy(() => import('../../phone-camera/src/CameraApp.js').then(module => ({ default: module.CameraApp })));
const RawWebcamApp = lazy(() => import('./webcam/RawWebcamApp.js').then(module => ({ default: module.RawWebcamApp })));

createRoot(document.getElementById('root')!).render(
  <React.StrictMode><AppErrorBoundary><Suspense fallback={<main className="app-loading" role="status">Opening 4D LiveSpace...</main>}>{location.pathname === '/camera' ? <CameraApp /> : location.pathname === '/webcam-test' ? <RawWebcamApp /> : <DesktopApp />}</Suspense></AppErrorBoundary></React.StrictMode>,
);
