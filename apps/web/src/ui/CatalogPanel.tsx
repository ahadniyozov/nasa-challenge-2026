// Left panel: what each role controls. Roles split the decisions the way real mission teams do.
import { BUSES, COMPONENTS, GROUND_STATIONS, LAUNCHERS, ORBITS, componentById, physics, type Category, type Component } from '@mission/engine';
import { ROLES, useGame, type Role } from '../store';
import { useT, type T } from '../i18n';
import { GB, kg, M, W } from './format';

const ROLE_CATEGORIES: Record<Role, Category[]> = {
  director: [],
  engineer: ['solar', 'battery', 'computer', 'adcs', 'propulsion'],
  science: ['instrument'],
  ops: ['comms'],
};

const CAT_NAME: Record<Category, string> = {
  solar: 'Power generation', battery: 'Energy storage', computer: 'Flight computer', adcs: 'Attitude control',
  propulsion: 'Propulsion', instrument: 'Science instruments', comms: 'Radio / downlink',
};

function stat(c: Component, { t }: T): string {
  switch (c.category) {
    case 'solar': return t('{a} m² · ~{w} W in sun', { a: c.areaM2, w: W(c.areaM2 * physics.SOLAR_CONSTANT * c.efficiency * 0.75) });
    case 'battery': return `${c.capacityWh} ${t('Wh')}`;
    case 'comms': return `${c.band} · ${c.downlinkMbps >= 1 ? c.downlinkMbps + ' ' + t('Mbps') : c.downlinkMbps * 1000 + ' ' + t('kbps')}`;
    case 'adcs': return t('pointing {d}°', { d: c.pointingDeg });
    case 'computer': return t(c.radHard ? 'radiation-hardened' : 'commercial');
    case 'propulsion': return `Δv ${c.deltaVms} ${t('m/s')}`;
    case 'instrument':
      return (c.resolutionAt500m ? t('{r} m @500 km · ', { r: c.resolutionAt500m }) : '') +
        t('{d}/day · {s} sci/yr', { d: GB(physics.mbpsToGB(c.dataRateMbps * c.dutyCycle, 86400)), s: c.scienceValue });
  }
}

export function CatalogPanel() {
  const { role, setRole, design, addComponent, removeComponent, update, toggleStation, budgets } = useGame();
  const tr = useT();
  const { t, name, blurb } = tr;
  const cats = ROLE_CATEGORIES[role];
  const installed = design.components.map((id, i) => ({ i, c: componentById.get(id)! })).filter(({ c }) => cats.includes(c.category));
  const scenario = budgets?.scenario;
  const roleInfo = ROLES.find((r) => r.id === role)!;

  return (
    <div className="panel catalog">
      <div className="role-tabs">
        {ROLES.map((r) => (
          <button key={r.id} className={r.id === role ? 'active' : ''} style={{ ['--role' as string]: r.color }} onClick={() => setRole(r.id)} title={t(r.name)}>
            {t(r.short)}
          </button>
        ))}
      </div>
      <h3 style={{ color: roleInfo.color }}>{t(roleInfo.name)}</h3>

      {role === 'director' && scenario && (
        <>
          <Section title={t('Spacecraft bus')}>
            {BUSES.filter((b) => scenario.allowedBuses.includes(b.id)).map((b) => (
              <Card key={b.id} active={design.busId === b.id} onClick={() => update({ busId: b.id })} title={name(b.name)}
                meta={t('{w} kg · carries {p} kg · {s} slots · {c}', { w: kg(b.dryMassKg), p: kg(b.maxPayloadKg), s: b.slots, c: M(b.costM) })} blurb={blurb(b.id, b.blurb)} />
            ))}
          </Section>
          <Section title={t('Launch vehicle')}>
            {LAUNCHERS.map((l) => (
              <Card key={l.id} active={design.launcherId === l.id} onClick={() => update({ launcherId: l.id })} title={name(l.name)}
                meta={`${Object.entries(l.capacityKg).filter(([, v]) => v).map(([k, v]) => `${k} ${kg(v!)}`).join(' · ')} · ${l.costPerKgM ? `$${(l.costPerKgM * 1000).toFixed(1)}k/${t('kg')}` : M(l.costM)}`}
                blurb={blurb(l.id, l.blurb)} />
            ))}
          </Section>
          <Section title={t('Cash reserve: {p}% ({m})', { p: Math.round(design.reservePct * 100), m: M(scenario.budgetM * design.reservePct) })}>
            <input type="range" min={0} max={0.4} step={0.01} value={design.reservePct} onChange={(e) => update({ reservePct: +e.target.value })} />
            <p className="blurb">{t("Reserve pays for fixing problems in flight. Too little and anomalies hurt; too much and you can't afford hardware.")}</p>
          </Section>
        </>
      )}

      {role === 'ops' && scenario && (
        <>
          <Section title={t('Orbit')}>
            {ORBITS.filter((o) => scenario.allowedOrbits.includes(o.id)).map((o) => (
              <Card key={o.id} active={design.orbitId === o.id} onClick={() => update({ orbitId: o.id })} title={name(o.name)}
                meta={t('period {p} min · shadow {e} min · incl {i}°', { p: Math.round(physics.periodMin(o.altitudeKm)), e: Math.round(o.kind === 'GEO' ? 72 : physics.eclipseMinutes(o.altitudeKm)), i: o.inclinationDeg })}
                blurb={blurb(o.id, o.blurb)} />
            ))}
          </Section>
          <Section title={t('Ground stations')}>
            {GROUND_STATIONS.map((s) => (
              <label key={s.id} className="check">
                <input type="checkbox" checked={design.groundStationIds.includes(s.id)} onChange={() => toggleStation(s.id)} />
                <span>{name(s.name)}</span>
                <small>{s.lat.toFixed(0)}° · {t('{c}/yr', { c: M(s.costPerYearM) })}</small>
              </label>
            ))}
          </Section>
        </>
      )}

      {cats.length > 0 && (
        <>
          {installed.length > 0 && (
            <Section title={t('Installed')}>
              {installed.map(({ i, c }) => (
                <div key={i} className="installed">
                  <span>{name(c.name)}</span>
                  <button onClick={() => removeComponent(i)} aria-label="remove">×</button>
                </div>
              ))}
            </Section>
          )}
          {cats.map((cat) => (
            <Section key={cat} title={t(CAT_NAME[cat])}>
              {COMPONENTS.filter((c) => c.category === cat).map((c) => (
                <Card key={c.id} onClick={() => addComponent(c.id)} title={`+ ${name(c.name)}`}
                  meta={`${kg(c.massKg)} · ${W(c.powerW)} · ${M(c.costM)} · ${stat(c, tr)}`} blurb={blurb(c.id, c.blurb)} />
              ))}
            </Section>
          ))}
          <p className="blurb">{t('Tip: adding a second copy of a component makes it redundant - a backup if the first fails.')}</p>
        </>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="section">
      <h4>{title}</h4>
      {children}
    </section>
  );
}

function Card({ title, meta, blurb, active, onClick }: { title: string; meta: string; blurb: string; active?: boolean; onClick: () => void }) {
  return (
    <button className={`card ${active ? 'active' : ''}`} onClick={onClick}>
      <div className="card-title">{title}</div>
      <div className="card-meta">{meta}</div>
      <div className="card-blurb">{blurb}</div>
    </button>
  );
}
