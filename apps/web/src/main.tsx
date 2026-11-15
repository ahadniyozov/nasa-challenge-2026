import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { installClickSound } from './game3d/audio';
import { Game2D } from './game2d/Game2D';
import './styles.css';
import './game2d/theme.css';
import './game2d/game2d.css';
import './content/content.css';

installClickSound();

/** 3D flight by default; ?2d (or no WebGL, e.g. a weak phone) keeps the 2D flight. */
function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') ?? c.getContext('webgl'));
  } catch { return false; }
}
const FLIGHT_3D = !new URLSearchParams(location.search).has('2d') && hasWebGL();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Game2D flight3d={FLIGHT_3D} links={null} />
  </StrictMode>,
);
