// The crew's connection to the server (socket.io, same origin: /socket.io). Loaded only in crew mode.
import { useEffect, useMemo, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { CrewState, Role, Snapshot } from './roles';

const store = {
  get(k: string) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* private mode: no memory between visits */ } },
};

/** a player id that survives a reload, so a dropped connection gets the same seat back */
function playerId() {
  let id = store.get('crew-pid');
  if (!id) { id = Math.random().toString(36).slice(2) + Date.now().toString(36); store.set('crew-pid', id); }
  return id;
}

export interface Call { key: string; from: string; roles: Role[]; at: number }

export function useCrew() {
  const pid = useMemo(playerId, []);
  const sock = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [failed, setFailed] = useState(false);
  const [crew, setCrew] = useState<CrewState | null>(null);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [calls, setCalls] = useState<Call[]>([]);
  const safeHandler = useRef<(on: boolean) => void>(() => undefined);

  useEffect(() => {
    const s = io({ path: '/socket.io', auth: { pid }, transports: ['websocket', 'polling'], reconnectionDelayMax: 3000 });
    sock.current = s;
    let tries = 0;
    s.on('connect', () => { setConnected(true); setFailed(false); tries = 0; });
    s.on('disconnect', () => setConnected(false));
    s.on('connect_error', () => { if (++tries >= 3) setFailed(true); });
    s.on('crew:state', (c: CrewState) => setCrew(c));
    s.on('crew:tick', (x: Snapshot) => setSnap(x));
    s.on('crew:safe', ({ on }: { on: boolean }) => safeHandler.current(on));
    s.on('crew:call', (c: Call) => setCalls((list) => [...list.slice(-3), c]));
    return () => { s.disconnect(); };
  }, [pid]);

  // a reconnect re-joins the same crew
  const lastCode = useRef<string | null>(null);
  useEffect(() => { if (crew) lastCode.current = crew.code; }, [crew]);
  useEffect(() => {
    if (connected && lastCode.current && !crew) sock.current?.emit('crew:join', { code: lastCode.current, name: store.get('crew-name') ?? '' });
  }, [connected, crew]);

  const emit = (ev: string, data?: unknown, ack?: (...a: never[]) => void) => sock.current?.emit(ev, data, ack);
  const me = crew?.players.find((p) => p.id === pid) ?? null;
  return {
    pid, connected, failed, crew, snap, calls, me,
    savedName: store.get('crew-name') ?? '',
    onSafe(fn: (on: boolean) => void) { safeHandler.current = fn; },
    create(name: string, missionId: string) {
      store.set('crew-name', name);
      return new Promise<string>((res) => emit('crew:create', { name, missionId }, ((code: string) => res(code)) as never));
    },
    join(code: string, name: string) {
      store.set('crew-name', name);
      return new Promise<string | null>((res) => emit('crew:join', { code, name }, ((err: string | null) => res(err)) as never));
    },
    leave() { lastCode.current = null; setCrew(null); sock.current?.disconnect(); sock.current?.connect(); },
    emit,
  };
}
export type CrewApi = ReturnType<typeof useCrew>;
