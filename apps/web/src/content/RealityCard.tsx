// "In real life" card in the mission report: the real NASA mission that does the same job.
import { useT } from '../i18n';
import { REAL_MISSIONS, type OrbitSketch } from './realMissions';

export function RealityCard({ missionId }: { missionId: string }) {
  const { t } = useT();
  const r = REAL_MISSIONS[missionId];
  if (!r) return null;
  return (
    <section className="c-real" aria-label={t('In real life')}>
      <div className="c-real-head">
        <Sketch kind={r.sketch} />
        <div>
          <div className="c-real-tag">🛰️ {t('In real life')}</div>
          <h3>{t(r.name)}</h3>
          <p>{t(r.same)}</p>
        </div>
      </div>
      <ul>{r.facts.map((f) => <li key={f}>{t(f)}</li>)}</ul>
      <a className="c-link" href={r.url} target="_blank" rel="noopener noreferrer">{t('Read more on {site}', { site: r.site })} ↗</a>
    </section>
  );
}

/** A small schematic: Earth and the orbit type. Shapes only, no photos. */
function Sketch({ kind }: { kind: OrbitSketch }) {
  const earth = <><circle cx="50" cy="50" r="18" fill="#2b6fd6" /><path d="M38 44c6-4 10 2 16-2s8 4 6 8-10 2-12 8-8 2-10-4z" fill="#3ddc84" opacity=".8" /></>;
  return (
    <svg className="c-sketch" viewBox="0 0 100 100" role="img" aria-hidden="true">
      {kind === 'belts' && <>
        <ellipse cx="50" cy="50" rx="44" ry="26" fill="none" stroke="#c084fc" strokeWidth="7" opacity=".35" />
        <ellipse cx="50" cy="50" rx="30" ry="17" fill="none" stroke="#c084fc" strokeWidth="5" opacity=".45" />
      </>}
      {kind === 'geo' && <circle cx="50" cy="50" r="44" fill="none" stroke="#4dd2ff" strokeWidth="2" strokeDasharray="4 4" />}
      {earth}
      {kind === 'low' && <ellipse cx="50" cy="50" rx="27" ry="10" fill="none" stroke="#4dd2ff" strokeWidth="2" transform="rotate(-25 50 50)" />}
      {kind === 'polar' && <ellipse cx="50" cy="50" rx="9" ry="28" fill="none" stroke="#4dd2ff" strokeWidth="2" transform="rotate(8 50 50)" />}
      {kind === 'belts' && <ellipse cx="50" cy="50" rx="40" ry="14" fill="none" stroke="#4dd2ff" strokeWidth="2" transform="rotate(-10 50 50)" />}
      <rect x={kind === 'geo' ? 89 : kind === 'polar' ? 51 : kind === 'belts' ? 85 : 72} y={kind === 'geo' ? 47 : kind === 'polar' ? 18 : kind === 'belts' ? 40 : 36} width="7" height="7" fill="#f1b93a" />
    </svg>
  );
}
