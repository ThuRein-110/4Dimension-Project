import React, { lazy, Suspense, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AppErrorBoundary } from './AppErrorBoundary.js';
import './styles.css';

const DesktopApp = lazy(() => import('./DesktopApp.js').then(module => ({ default: module.DesktopApp })));
const CameraApp = lazy(() => import('../../phone-camera/src/CameraApp.js').then(module => ({ default: module.CameraApp })));
const RawWebcamApp = lazy(() => import('./webcam/RawWebcamApp.js').then(module => ({ default: module.RawWebcamApp })));
const MotionLab = lazy(() => import('./motion/MotionLab.js').then(module => ({ default: module.MotionLab })));
const ResearchView = lazy(() => import('./research/ResearchView.js').then(module => ({ default: module.ResearchView })));

function WorkspaceRouter() {
  const [route,setRoute] = useState(location.pathname+location.search);
  useEffect(() => {
    const changed = () => setRoute(location.pathname+location.search);
    const navigate = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as HTMLElement).closest<HTMLAnchorElement>('.mode-bar a,.brand');
      if (!anchor || anchor.target || anchor.origin !== location.origin || !['/','/motion','/research'].includes(anchor.pathname)) return;
      event.preventDefault(); history.pushState(null,'',anchor.href); changed();
    };
    document.addEventListener('click',navigate); addEventListener('popstate',changed);
    return () => { document.removeEventListener('click',navigate); removeEventListener('popstate',changed); };
  }, []);
  const pathname = route.split('?')[0];
  return <Suspense fallback={<main className="app-loading" role="status">Opening 4D LiveSpace...</main>}>{pathname === '/camera' ? <CameraApp /> : pathname === '/webcam-test' ? <RawWebcamApp /> : pathname === '/research' ? <ResearchView /> : pathname === '/motion' ? <MotionLab /> : <DesktopApp />}</Suspense>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><AppErrorBoundary><WorkspaceRouter /></AppErrorBoundary></React.StrictMode>);
