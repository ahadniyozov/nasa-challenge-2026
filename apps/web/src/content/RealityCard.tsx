// "In real life" card in the mission report: the real NASA mission that does the same job.
import { useT } from '../i18n';
import { REAL_MISSIONS, type OrbitSketch } from './realMissions';

export function RealityCard({ missionId }: { missionId: string }) {
  const { t } = useT();
  const r = REAL_MISSIONS[missionId];
  if (!r) return null;
  return (
    <section className="c-real" aria-label={t('In real life')}>
      <Sketch kind={r.sketch} />
      <div>
        <div className="c-real-tag">{t('In real life')}</div>
        <h3>{t(r.name)}</h3>
        <p>{t(r.same)}</p>
        <ul>{r.facts.map((f) => <li key={f}>{t(f)}</li>)}</ul>
        <a className="c-link" href={r.url} target="_blank" rel="noopener noreferrer">{t('Read more on {site}', { site: r.site })}</a>
      </div>
    </section>
  );
}

/** A small schematic: Earth and the orbit type, drawn like a figure in a mission document. Shapes only, no photos. */
export function Sketch({ kind, className = 'c-sketch' }: { kind: OrbitSketch; className?: string }) {
  const sat = { geo: [93, 50], polar: [54, 21], belts: [89, 43], low: [75, 39] }[kind];
  return (
    <svg className={className} viewBox="0 0 100 100" role="img" aria-hidden="true">
      {kind === 'belts' && <>
        <ellipse cx="50" cy="50" rx="44" ry="25" fill="none" stroke="#b9a5d6" strokeWidth="8" opacity=".35" />
        <ellipse cx="50" cy="50" rx="31" ry="17" fill="none" stroke="#b9a5d6" strokeWidth="5" opacity=".45" />
      </>}
      {kind === 'geo' && <circle cx="50" cy="50" r="43" fill="none" stroke="#5f6b77" strokeWidth="1.2" strokeDasharray="3 3" />}
      <circle cx="50" cy="50" r="18" fill="#2f5d8a" />
      <path d="M37 45c6-5 11 1 16-3s9 3 7 8-10 2-12 8-8 3-11-3z" fill="#7f9b6b" />
      <path d="M50 32a18 18 0 0 1 0 36" fill="#0f2338" opacity=".45" />
      {kind === 'low' && <ellipse cx="50" cy="50" rx="27" ry="9" fill="none" stroke="#1d2329" strokeWidth="1.4" transform="rotate(-25 50 50)" />}
      {kind === 'polar' && <ellipse cx="50" cy="50" rx="8" ry="29" fill="none" stroke="#1d2329" strokeWidth="1.4" transform="rotate(8 50 50)" />}
      {kind === 'belts' && <ellipse cx="50" cy="50" rx="40" ry="13" fill="none" stroke="#1d2329" strokeWidth="1.4" transform="rotate(-10 50 50)" />}
      <rect x={sat[0] - 3} y={sat[1] - 3} width="6" height="6" fill="#c8922a" />
      <rect x={sat[0] - 9} y={sat[1] - 1.2} width="18" height="2.4" fill="#3a4a63" />
    </svg>
  );
}
