// One-tap mute button for the top bar (a drawn speaker, so it looks the same everywhere).
import { useT } from '../i18n';
import { useSound } from './audio';

export function SoundToggle() {
  const { t } = useT();
  const { muted, setMuted } = useSound();
  return (
    <button className="link" onClick={() => setMuted(!muted)} aria-pressed={!muted} title={muted ? t('Sound off') : t('Sound on')}>
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="M3 7.5h3l4-3.5v12l-4-3.5H3z" fill="currentColor" />
        {muted
          ? <path d="M13 7.5l5 5m0-5l-5 5" stroke="currentColor" strokeWidth="1.6" fill="none" />
          : <path d="M13 7a4 4 0 0 1 0 6m2.2-8.2a7 7 0 0 1 0 10.4" stroke="currentColor" strokeWidth="1.6" fill="none" />}
      </svg>
      <span className="label"> {muted ? t('Sound off') : t('Sound on')}</span>
    </button>
  );
}
