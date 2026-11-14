// One-tap mute button for the top bar.
import { useT } from '../i18n';
import { useSound } from './audio';

export function SoundToggle() {
  const { t } = useT();
  const { muted, setMuted } = useSound();
  return (
    <button className="link" onClick={() => setMuted(!muted)} aria-pressed={!muted} title={muted ? t('Sound off') : t('Sound on')}>
      {muted ? '🔇' : '🔊'}
    </button>
  );
}
