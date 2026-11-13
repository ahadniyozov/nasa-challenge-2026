import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App, { LangToggle } from './App';
import { KidApp } from './kid/KidApp';
import { RunnerGame } from './runner/RunnerGame';
import { useT } from './i18n';
import './styles.css';
import './kid/kid.css';
import './runner/runner.css';

type Mode = 'runner' | 'simple' | 'expert';

function initialMode(): Mode {
  if (location.hash.startsWith('#d=') || location.search.includes('expert')) return 'expert';
  if (location.search.includes('simple')) return 'simple';
  return 'runner';
}

/** Orbital Runner is the main game; the step-by-step builder and the engineer console stay available. */
function Root() {
  const [mode, setMode] = useState<Mode>(initialMode);
  const { t } = useT();
  if (mode === 'expert') return <App onSimple={() => setMode('runner')} />;
  if (mode === 'simple') return <KidApp onExpert={() => setMode('expert')} langToggle={<><LangToggle /><button className="link" onClick={() => setMode('runner')}>{t('🛰️ Runner')}</button></>} />;
  return (
    <RunnerGame
      links={<><LangToggle /><button className="link" onClick={() => setMode('simple')}>{t('🧩 Builder')}</button><button className="link" onClick={() => setMode('expert')}>{t('🔧 Engineer mode')}</button></>}
    />
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
