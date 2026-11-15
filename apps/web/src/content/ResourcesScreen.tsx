// "NASA Resources" screen (from the top menu): which NASA resources and data the game uses, and where.
import { useT } from '../i18n';
import { RESOURCES, SPACE_APPS_URL } from './resources';
import { PART_PHOTOS, sourceUrl } from './partPhotos';

export function ResourcesScreen({ onBack }: { onBack(): void }) {
  const { t } = useT();
  return (
    <div className="g2d-page">
      <div className="g2d-doc narrow c-res">
        <button className="g2d-back" onClick={onBack}>{t('Back to missions')}</button>
        <h1>{t('NASA Resources')}</h1>
        <p className="g2d-lead">{t('Everything in this game is based on real NASA data, guides and missions. Here is what we used and where.')}</p>
        {RESOURCES.map((g) => (
          <section key={g.title}>
            <h2>{t(g.title)}</h2>
            <ul className="c-res-list">
              {g.items.map((r) => (
                <li key={r.title}>
                  {r.url
                    ? <a className="c-link" href={r.url} target="_blank" rel="noopener noreferrer">{t(r.title)}</a>
                    : <b>{t(r.title)}</b>}
                  <small>{t(r.where)}</small>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <section>
          <h2>{t('Photos of real hardware')}</h2>
          <ul className="c-res-list">
            {[...new Map(Object.values(PART_PHOTOS).map((p) => [p.nasaId, p])).values()].map((p) => (
              <li key={p.nasaId}>
                <a className="c-link" href={sourceUrl(p)} target="_blank" rel="noopener noreferrer">{p.nasaId}</a>
                <small>{t(p.caption)}. {t('Photo: {credit}', { credit: p.credit })}</small>
              </li>
            ))}
          </ul>
        </section>
        <p className="g2d-note">
          {t('Made for the NASA Space Apps Challenge 2026.')}{' '}
          <a className="c-link" href={SPACE_APPS_URL} target="_blank" rel="noopener noreferrer">spaceappschallenge.org</a>
        </p>
      </div>
    </div>
  );
}
