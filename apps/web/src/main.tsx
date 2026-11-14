import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App, { LangToggle } from './App';
import { KidApp } from './kid/KidApp';
import { RunnerGame } from './runner/RunnerGame';
import { Game2D } from './game2d/Game2D';
import { useT } from './i18n';
import { installClickSound } from './game3d/audio';
import './styles.css';
import './kid/kid.css';
import './runner/runner.css';
import './game2d/game2d.css';
import './content/content.css';

installClickSound();

type Mode = 'game2d' | 'runner' | 'simple' | 'expert';

function initialMode(): Mode {
  if (location.hash.startsWith('#d=') || location.search.includes('expert')) return 'expert';
  if (location.search.includes('simple')) return 'simple';
  if (location.search.includes('runner3d')) return 'runner';
  return 'game2d';
}

/** Orbital Runner is the main game; the step-by-step builder and the engineer console stay available. */
function Root() {
  const [mode, setMode] = useState<Mode>(initialMode);
  const { t } = useT();
  if (mode === 'expert') return <App onSimple={() => setMode('game2d')} />;
  if (mode === 'simple') return <KidApp onExpert={() => setMode('expert')} langToggle={<><LangToggle /><button className="link" onClick={() => setMode('game2d')}>{t('🎮 2D game')}</button></>} />;
  if (mode === 'game2d') return <Game2D links={<><LangToggle /><button className="link" onClick={() => setMode('runner')}>{t('🛰️ 3D runner')}</button><button className="link" onClick={() => setMode('expert')}>{t('🔧 Engineer mode')}</button></>} />;
  return (
    <RunnerGame
      links={<><LangToggle /><button className="link" onClick={() => setMode('game2d')}>{t('🎮 2D game')}</button><button className="link" onClick={() => setMode('simple')}>{t('🧩 Builder')}</button><button className="link" onClick={() => setMode('expert')}>{t('🔧 Engineer mode')}</button></>}
    />
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
