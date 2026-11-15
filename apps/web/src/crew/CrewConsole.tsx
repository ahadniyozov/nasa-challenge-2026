// A crew member's console in flight: the flight director flies, everyone else works from here.
// A top-down radar of what is coming (from the director's snapshots), the panels of the player's roles,
// and callout keys that pop up on the director's screen.
import { useT } from '../i18n';
import type { Analysis } from '../game2d/config';
import type { Mission } from '../game2d/missions';
import { ZONE_COLOR } from './zoneColors';
import { CALLS, CALL_TEXT, ROLE_TITLE, type CrewState, type Role, type Snapshot } from './roles';
import type { CrewApi } from './useCrew';

const LANE_X = [70, 150, 230];
const SAT_Y = 340, PX_PER_S = 120;

export function CrewConsole({ c, crew, m, a, mine }: { c: CrewApi; crew: CrewState; m: Mission; a: Analysis; mine: Role[] }) {
  const { t } = useT();
  const s = c.snap;
  const p = a.flight;
  const director = crew.players.find((x) => x.roles.includes('director'));
  const roles = mine.filter((r) => r !== 'director');

  if (!s) {
    return (
      <div className="crew-console waiting">
        <p>{t("Waiting for the flight director's data...")}</p>
      </div>
    );
  }
  const nextStation = s.objs.filter((o) => o[0] === 's' && o[2] > 0).sort((x, y) => x[2] - y[2])[0];
  const memCells = Array.from({ length: p.memory }, (_, i) => i < Math.round(s.memory));
  const color = ZONE_COLOR[m.targets.kind];

  return (
    <div className={`crew-console ${s.shadow ? 'night' : ''} ${s.storm === 2 ? 'storm' : ''}`}>
      <header className="cc-head">
        <div><span>{t('Your console')}</span><b>{roles.map((r) => t(ROLE_TITLE[r])).join(' / ')}</b></div>
        <div><span>{t('Flying')}</span><b>{director?.name ?? '-'}</b></div>
        <div><span>{t('Delivered to Earth')}</span><b>{Math.floor(s.delivered)} / {p.goal}</b></div>
      </header>

      <div className="cc-body">
        {/* radar: the three lanes seen from above, the satellite at the bottom, what is coming above it */}
        <figure className="cc-radar">
          <svg viewBox="0 0 300 380" role="img" aria-label={t('Radar: what is ahead of the satellite')}>
            <rect width="300" height="380" rx="10" className="bg" />
            {[0, 1, 2, 3].map((k) => <line key={k} x1="10" x2="290" y1={SAT_Y - k * PX_PER_S * 0.75} y2={SAT_Y - k * PX_PER_S * 0.75} className="grid" />)}
            {LANE_X.map((x) => <line key={x} x1={x} x2={x} y1="10" y2="370" className="lane" />)}
            {s.objs.map(([k, lane, ahead], i) => {
              const y = SAT_Y - ahead * PX_PER_S;
              if (y < 12 || y > 372) return null;
              if (k === 's') return <rect key={i} x={276} y={y - 6} width="12" height="12" className="station" />;
              const x = lane < 0 ? 20 : LANE_X[lane];
              if (k === 'd') return <path key={i} d={`M${x} ${y - 9}L${x + 9} ${y}L${x} ${y + 9}L${x - 9} ${y}Z`} className="debris" />;
              return <circle key={i} cx={x} cy={y} r="9" fill={color} className={`target ${lane < 0 ? 'ghost' : ''}`} />;
            })}
            <g transform={`translate(${70 + s.laneY * 80} ${SAT_Y})`}>
              <rect x="-7" y="-7" width="14" height="14" className="sat" />
              <rect x="-20" y="-3" width="11" height="6" className="wing" /><rect x="9" y="-3" width="11" height="6" className="wing" />
            </g>
          </svg>
          <figcaption>
            <span><i className="k target" style={{ background: color }} />{t('Target')}</span>
            <span><i className="k debris" />{t('Debris')}</span>
            <span><i className="k station" />{t('Ground station')}</span>
          </figcaption>
        </figure>

        <div className="cc-panels">
          {roles.includes('engineer') && (
            <section>
              <h3>{t(ROLE_TITLE.engineer)}</h3>
              <div className="cc-row"><span>{t('Battery')}</span><span className={`cc-bar ${s.battery < 25 ? 'low' : ''}`}><i style={{ width: `${s.battery}%` }} /></span><b>{Math.round(s.battery)}%</b></div>
              <div className="cc-row"><span>{t('Hull')}</span><span className="cc-cells hull">{Array.from({ length: p.hearts }, (_, i) => <i key={i} className={i < s.hearts ? 'on' : ''} />)}</span></div>
              {p.storms > 0 && (
                <>
                  <div className="cc-row"><span>{t('Sun')}</span><b className={`cc-lamp ${s.storm === 2 ? 'storm now' : s.storm === 1 ? 'storm' : ''}`}>{s.storm === 2 ? t('Solar storm') : s.storm === 1 ? t('Solar storm ahead') : t('Quiet')}</b></div>
                  <button className={`r-btn cc-safe ${s.safe ? 'on' : ''}`} aria-pressed={s.safe} onClick={() => c.emit('crew:safe', { on: !s.safe })}>{s.safe ? t('Safe mode on') : t('Safe mode')}</button>
                </>
              )}
            </section>
          )}
          {roles.includes('scientist') && (
            <section>
              <h3>{t(ROLE_TITLE.scientist)}</h3>
              <div className="cc-row"><span>{t('Memory')}</span><span className="cc-cells mem">{memCells.map((on, i) => <i key={i} className={on ? 'on' : ''} />)}</span></div>
              <div className="cc-row"><span>{t('Delivered to Earth')}</span><b>{Math.floor(s.delivered)} / {p.goal}</b></div>
              <div className="cc-row"><span>{t('Satellite')}</span><b className={`cc-lamp ${s.asleep ? 'storm' : 'ok'}`}>{s.asleep ? t('Asleep') : t('Working')}</b></div>
            </section>
          )}
          {roles.includes('comms') && (
            <section>
              <h3>{t(ROLE_TITLE.comms)}</h3>
              <div className="cc-row"><span>{t('Downlink')}</span><b className={`cc-lamp ${s.contact ? 'ok' : ''}`}>{s.contact ? t('Sending data home') : t('No contact')}</b></div>
              <div className="cc-row"><span>{t('Next ground station')}</span><b>{p.alwaysInContact ? t('Always in view') : nextStation ? t('in {n} s', { n: Math.max(1, Math.round(nextStation[2])) }) : t('Not in range yet')}</b></div>
              <div className="cc-row"><span>{t('Waiting to be sent')}</span><b>{Math.round(s.memory)}</b></div>
            </section>
          )}

          <section>
            <h3>{t('Call to the flight director')}</h3>
            <div className="cc-calls">
              {CALLS.filter((k) => !k.startsWith('safe')).map((k) => (
                <button key={k} className="r-btn cc-call" onClick={() => c.emit('crew:call', { key: k })}>{t(CALL_TEXT[k])}</button>
              ))}
            </div>
          </section>

          <ol className="cc-log">
            {s.log.map((e) => <li key={e.id} className={e.tone}>{e.text}</li>)}
          </ol>
        </div>
      </div>
    </div>
  );
}
