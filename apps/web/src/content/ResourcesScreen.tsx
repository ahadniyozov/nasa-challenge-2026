// "NASA Resources" screen (from the top menu): which NASA resources and data the game uses, and where.
import { useT } from '../i18n';
import { RESOURCES, SPACE_APPS_URL } from './resources';

export function ResourcesScreen({ onBack }: { onBack(): void }) {
  const { t } = useT();
  return (
    <div className="g2d-page">
      <div className="g2d-card c-res">
        <h1>📚 {t('NASA Resources')}</h1>
        <p className="g2d-note center">{t('Everything in this game is based on real NASA data, guides and missions. Here is what we used and where.')}</p>
        {RESOURCES.map((g) => (
          <section key={g.title}>
            <h2>{t(g.title)}</h2>
            <ul className="c-res-list">
              {g.items.map((r) => (
                <li key={r.title}>
                  <span className="e">{r.emoji}</span>
                  <div>
                    {r.url
                      ? <a className="c-link" href={r.url} target="_blank" rel="noopener noreferrer"><b>{t(r.title)}</b> ↗</a>
                      : <b>{t(r.title)}</b>}
                    <small>{t(r.where)}</small>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <p className="g2d-note center">
          {t('Made for the NASA Space Apps Challenge 2026.')}{' '}
          <a className="c-link" href={SPACE_APPS_URL} target="_blank" rel="noopener noreferrer">spaceappschallenge.org ↗</a>
        </p>
        <div className="g2d-actions"><button className="r-btn" onClick={onBack}>← {t('Back to missions')}</button></div>
      </div>
    </div>
  );
}
