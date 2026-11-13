// Left panel: what each role controls. Roles split the decisions the way real mission teams do.
import { BUSES, COMPONENTS, GROUND_STATIONS, LAUNCHERS, ORBITS, componentById, physics, type Category, type Component } from '@mission/engine';
import { ROLES, useGame, type Role } from '../store';
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

function stat(c: Component): string {
  switch (c.category) {
    case 'solar': return `${c.areaM2} m² · ~${Math.round(c.areaM2 * physics.SOLAR_CONSTANT * c.efficiency * 0.75)} W in sun`;
    case 'battery': return `${c.capacityWh} Wh`;
    case 'comms': return `${c.band}-band · ${c.downlinkMbps >= 1 ? c.downlinkMbps + ' Mbps' : c.downlinkMbps * 1000 + ' kbps'}`;
    case 'adcs': return `pointing ${c.pointingDeg}°`;
    case 'computer': return c.radHard ? 'radiation-hardened' : 'commercial';
    case 'propulsion': return `Δv ${c.deltaVms} m/s`;
    case 'instrument': return `${c.resolutionAt500m ? c.resolutionAt500m + ' m @500 km · ' : ''}${GB(physics.mbpsToGB(c.dataRateMbps * c.dutyCycle, 86400))}/day · ${c.scienceValue} sci/yr`;
  }
}

export function CatalogPanel() {
  const { role, setRole, design, addComponent, removeComponent, update, toggleStation, budgets } = useGame();
  const cats = ROLE_CATEGORIES[role];
  const installed = design.components.map((id, i) => ({ i, c: componentById.get(id)! })).filter(({ c }) => cats.includes(c.category));
  const scenario = budgets?.scenario;
  const roleInfo = ROLES.find((r) => r.id === role)!;

  return (
    <div className="panel catalog">
      <div className="role-tabs">
        {ROLES.map((r) => (
          <button key={r.id} className={r.id === role ? 'active' : ''} style={{ ['--role' as string]: r.color }} onClick={() => setRole(r.id)} title={r.name}>
            {r.short}
          </button>
        ))}
      </div>
      <h3 style={{ color: roleInfo.color }}>{roleInfo.name}</h3>

      {role === 'director' && scenario && (
        <>
          <Section title="Spacecraft bus">
            {BUSES.filter((b) => scenario.allowedBuses.includes(b.id)).map((b) => (
              <Card key={b.id} active={design.busId === b.id} onClick={() => update({ busId: b.id })} title={b.name}
                meta={`${kg(b.dryMassKg)} · carries ${kg(b.maxPayloadKg)} · ${b.slots} slots · ${M(b.costM)}`} blurb={b.blurb} />
            ))}
          </Section>
          <Section title="Launch vehicle">
            {LAUNCHERS.map((l) => (
              <Card key={l.id} active={design.launcherId === l.id} onClick={() => update({ launcherId: l.id })} title={l.name}
                meta={`${Object.entries(l.capacityKg).filter(([, v]) => v).map(([k, v]) => `${k} ${v} kg`).join(' · ')} · ${l.costPerKgM ? `$${(l.costPerKgM * 1000).toFixed(1)}k/kg` : M(l.costM)}`} blurb={l.blurb} />
            ))}
          </Section>
          <Section title={`Cash reserve: ${Math.round(design.reservePct * 100)}% (${M(scenario.budgetM * design.reservePct)})`}>
            <input type="range" min={0} max={0.4} step={0.01} value={design.reservePct} onChange={(e) => update({ reservePct: +e.target.value })} />
            <p className="blurb">Reserve pays for fixing problems in flight. Too little and anomalies hurt; too much and you can't afford hardware.</p>
          </Section>
        </>
      )}

      {role === 'ops' && scenario && (
        <>
          <Section title="Orbit">
            {ORBITS.filter((o) => scenario.allowedOrbits.includes(o.id)).map((o) => (
              <Card key={o.id} active={design.orbitId === o.id} onClick={() => update({ orbitId: o.id })} title={o.name}
                meta={`period ${Math.round(physics.periodMin(o.altitudeKm))} min · shadow ${Math.round(o.kind === 'GEO' ? 72 : physics.eclipseMinutes(o.altitudeKm))} min · incl ${o.inclinationDeg}°`} blurb={o.blurb} />
            ))}
          </Section>
          <Section title="Ground stations">
            {GROUND_STATIONS.map((s) => (
              <label key={s.id} className="check">
                <input type="checkbox" checked={design.groundStationIds.includes(s.id)} onChange={() => toggleStation(s.id)} />
                <span>{s.name}</span>
                <small>{s.lat.toFixed(0)}° · {M(s.costPerYearM)}/yr</small>
              </label>
            ))}
          </Section>
        </>
      )}

      {cats.length > 0 && (
        <>
          {installed.length > 0 && (
            <Section title="Installed">
              {installed.map(({ i, c }) => (
                <div key={i} className="installed">
                  <span>{c.name}</span>
                  <button onClick={() => removeComponent(i)} aria-label="remove">×</button>
                </div>
              ))}
            </Section>
          )}
          {cats.map((cat) => (
            <Section key={cat} title={CAT_NAME[cat]}>
              {COMPONENTS.filter((c) => c.category === cat).map((c) => (
                <Card key={c.id} onClick={() => addComponent(c.id)} title={`+ ${c.name}`}
                  meta={`${kg(c.massKg)} · ${W(c.powerW)} · ${M(c.costM)} · ${stat(c)}`} blurb={c.blurb} />
              ))}
            </Section>
          ))}
          <p className="blurb">Tip: adding a second copy of a component makes it redundant - a backup if the first fails.</p>
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
