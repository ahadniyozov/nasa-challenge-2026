import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App, { LangToggle } from './App';
import { KidApp } from './kid/KidApp';
import './styles.css';
import './kid/kid.css';

/** Simple mode is the default; engineer mode keeps the full detailed interface. */
function Root() {
  const [mode, setMode] = useState<'simple' | 'expert'>(() => (location.hash.startsWith('#d=') || location.search.includes('expert') ? 'expert' : 'simple'));
  return mode === 'simple'
    ? <KidApp onExpert={() => setMode('expert')} langToggle={<LangToggle />} />
    : <App onSimple={() => setMode('simple')} />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
