import { Suspense, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { stationById } from '@mission/engine';
import { useGame, type Phase } from './store';
import { HangarScene } from './scenes/HangarScene';
import { OrbitScene } from './scenes/OrbitScene';
import { LaunchScene } from './scenes/LaunchScene';
import { CatalogPanel } from './ui/CatalogPanel';
import { ResourcePanel } from './ui/ResourcePanel';
import { OpsPanel, useOpsClock } from './ui/OpsPanel';
import { BriefModal, ReportModal } from './ui/Modals';

const STEPS: { id: Phase; label: string }[] = [
  { id: 'brief', label: 'Brief' },
  { id: 'design', label: 'Design' },
  { id: 'launch', label: 'Launch' },
  { id: 'ops', label: 'Operations' },
  { id: 'report', label: 'Report' },
];

export default function App() {
  const { phase, setPhase, budgets, design, sim } = useGame();
  const [view, setView] = useState<'hangar' | 'orbit'>('hangar');
  const [tele, setTele] = useState<{ inShadow: boolean; linkTo: string | null }>({ inShadow: false, linkTo: null });
  const month = useOpsClock();

  const stations = design.groundStationIds.map((id) => stationById.get(id)!).filter(Boolean);
  const stormNow = phase === 'ops' && sim?.timeline.some((e) => e.kind === 'solar-storm' && e.month === month);
  const showOrbit = phase === 'ops' || phase === 'report' || (phase === 'design' && view === 'orbit');

  return (
    <div className="app">
      <header className="topbar">
        <div className="logo">GO<span>/</span>NO-GO <small>Mission Control</small></div>
        <nav className="steps">
          {STEPS.map((s, i) => (
            <span key={s.id} className={s.id === phase ? 'on' : STEPS.findIndex((x) => x.id === phase) > i ? 'done' : ''}>{s.label}</span>
          ))}
        </nav>
        <div className="scenario-name">
          {budgets?.scenario.title}
          {phase === 'design' && <button className="link" onClick={() => setPhase('brief')}>change</button>}
        </div>
      </header>

      <main className={`layout phase-${phase}`}>
        {phase === 'design' && <CatalogPanel />}

        <section className="stage">
          <Canvas camera={{ position: [3, 2, 4], fov: 45 }} dpr={[1, 2]} shadows>
            <Suspense fallback={null}>
              {budgets && phase === 'launch' && sim ? (
                <LaunchScene launcherId={design.launcherId} failed={sim.monthsSurvived === 0} onDone={() => setPhase(sim.monthsSurvived === 0 ? 'report' : 'ops')} />
              ) : budgets && showOrbit ? (
                <OrbitScene orbit={budgets.orbit} stations={stations} timeScale={phase === 'ops' ? 2400 : 300} alert={stormNow ? 'storm' : null} onTelemetry={setTele} />
              ) : budgets ? (
                <HangarScene bus={budgets.bus} parts={budgets.parts} />
              ) : null}
            </Suspense>
          </Canvas>

          {phase === 'design' && (
            <div className="view-toggle">
              <button className={view === 'hangar' ? 'on' : ''} onClick={() => setView('hangar')}>🛰 Spacecraft</button>
              <button className={view === 'orbit' ? 'on' : ''} onClick={() => setView('orbit')}>🌍 Orbit</button>
            </div>
          )}

          {showOrbit && budgets && (
            <div className="telemetry">
              <div>{budgets.orbit.name}</div>
              <div>Period {Math.round(budgets.orbitInfo.periodMin)} min · {budgets.orbitInfo.speedKms.toFixed(1)} km/s</div>
              <div className={tele.inShadow ? 'bad' : 'ok'}>{tele.inShadow ? '● In Earth shadow — running on battery' : '● In sunlight — charging'}</div>
              <div className={tele.linkTo ? 'ok' : 'dim'}>{tele.linkTo ? `● Downlink: ${tele.linkTo}` : '○ No ground contact — storing data'}</div>
            </div>
          )}
          {stormNow && <div className="alert">☀ SOLAR STORM</div>}
        </section>

        {phase === 'design' && <ResourcePanel />}
        {phase === 'ops' && <OpsPanel month={month} />}
      </main>

      {phase === 'brief' && <BriefModal />}
      {phase === 'report' && <ReportModal />}
    </div>
  );
}
