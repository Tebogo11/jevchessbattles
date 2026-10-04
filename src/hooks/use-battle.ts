"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { advanceBattle } from "@/app/actions";
import type { Battle } from "@/lib/types";

export function useBattle(initial: Battle) {
  const [battle, setBattle] = useState(initial);
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const generation = useRef(0);
  const mounted = useRef(true);
  const current = useRef({ battle, cursor, playing });
  current.current = { battle, cursor, playing };

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; generation.current++; }; }, []);

  const step = useCallback(async () => {
    const state = current.current;
    if (lock.current || state.cursor !== state.battle.turns.length || state.battle.snapshot.result) return;
    lock.current = true; setPending(true); setError("");
    const version = generation.current;
    try {
      const result = await advanceBattle(state.battle.token);
      // Pausing or seeking invalidates an in-flight response. The signed server state
      // is immutable, so discarding it leaves the displayed and active match unchanged.
      if (!mounted.current || generation.current !== version) return;
      if (!result.ok) { setPlaying(false); setError(result.error); return; }
      const nextBattle = { ...state.battle, token: result.data.token, snapshot: result.data.snapshot, turns: [...state.battle.turns, result.data.turn] };
      current.current = { ...current.current, battle: nextBattle, cursor: nextBattle.turns.length };
      setBattle(nextBattle); setCursor(nextBattle.turns.length);
      if (result.data.snapshot.result) setPlaying(false);
    } catch {
      if (mounted.current && generation.current === version) { setError("The connection was interrupted. Retry this turn to continue."); setPlaying(false); }
    } finally { lock.current = false; if (mounted.current) setPending(false); }
  }, []);

  const pause = useCallback(() => { generation.current++; current.current.playing = false; setPlaying(false); }, []);
  const seek = useCallback((ply: number) => {
    pause();
    const target = Math.max(0, Math.min(ply, current.current.battle.turns.length));
    current.current.cursor = target; setCursor(target);
  }, [pause]);
  const toggle = useCallback(() => {
    if (current.current.playing) { pause(); return; }
    if (current.current.cursor !== current.current.battle.turns.length || current.current.battle.snapshot.result || lock.current) return;
    setError(""); current.current.playing = true; setPlaying(true);
  }, [pause]);
  const next = useCallback(() => {
    if (current.current.cursor < current.current.battle.turns.length) seek(current.current.cursor + 1);
    else { pause(); void step(); }
  }, [pause, seek, step]);

  useEffect(() => {
    if (!playing || pending || cursor !== battle.turns.length || battle.snapshot.result || error) return;
    const timeout = setTimeout(() => { if (current.current.playing) void step(); }, battle.config.interval);
    return () => clearTimeout(timeout);
  }, [playing, pending, cursor, battle, error, step]);

  return { battle, cursor, playing, pending, error, step, pause, seek, toggle, next };
}
