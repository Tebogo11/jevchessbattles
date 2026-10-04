"use client";

import { useState, type FormEvent } from "react";
import { ArrowUpRight, ChevronRight, Cpu, Crosshair, Shield, Swords, Zap, LoaderCircle, Check, Radio } from "lucide-react";
import { startBattle } from "@/app/actions";
import { ChessBoard } from "./chess-board";
import type { Battle, BattleConfig, Bot, Mode } from "@/lib/types";

const presets = [
  { name: "Play to win", icon: Swords, goal: "Win the game. Prioritize sound moves, king safety, and material advantage. Take decisive tactical opportunities." },
  { name: "Set a trap", icon: Crosshair, goal: "Create tactical traps and force difficult decisions. Look for forks, pins, and discovered attacks without making unsound sacrifices." },
  { name: "Play positionally", icon: Shield, goal: "Play like an elite positional player. Control the center, improve piece activity, protect your king, and convert small advantages." },
];
const defaults: BattleConfig = { white: { name: "NEON", goal: presets[0].goal }, black: { name: "GHOST", goal: presets[1].goal }, mode: "demo", interval: 1800 };
const previewFen = "r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 0 6";

function BotEditor({ bot, color, onChange }: { bot: Bot; color: "white" | "black"; onChange: (bot: Bot) => void }) {
  return <section className={`bot-editor ${color}`}>
    <div className="editor-heading"><div className="bot-emblem"><Cpu size={23} /></div><div><p className="eyebrow">{color === "white" ? "PLAYER 01" : "PLAYER 02"}</p><h3>{color === "white" ? "White side" : "Black side"}</h3></div><span className={`side-chip ${color}`}>{color === "white" ? "W" : "B"}</span></div>
    <label className="field-label" htmlFor={`${color}-name`}>Bot name <span>24 max</span></label>
    <input id={`${color}-name`} maxLength={24} required value={bot.name} onChange={e => onChange({ ...bot, name: e.target.value })} placeholder="Name your contender" autoComplete="off" />
    <label className="field-label" htmlFor={`${color}-goal`}>Primary objective</label>
    <textarea id={`${color}-goal`} minLength={5} maxLength={600} required value={bot.goal} onChange={e => onChange({ ...bot, goal: e.target.value })} rows={4} />
    <div className="preset-label">QUICK OBJECTIVES</div>
    <div className="goal-presets">{presets.map(preset => <button key={preset.name} type="button" className={bot.goal === preset.goal ? "selected" : ""} onClick={() => onChange({ ...bot, goal: preset.goal })}><preset.icon size={13} />{preset.name}</button>)}</div>
  </section>;
}

export function Setup({ configured, onStart, previous }: { configured: boolean; onStart: (battle: Battle) => void; previous?: BattleConfig }) {
  const [config, setConfig] = useState<BattleConfig>(() => previous ?? { ...defaults, mode: configured ? "jev" : "demo" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    try {
      const result = await startBattle(config);
      if (result.ok) onStart(result.data); else setError(result.error);
    } catch { setError("Could not start the match. Check your connection and try again."); }
    finally { setBusy(false); }
  }
  return <main className="setup-page">
    <div className="setup-intro"><div><p className="eyebrow yellow flex items-center gap-2"><span className="tiny-square" /> THE AUTONOMOUS CHESS ARENA</p><h1>TWO MINDS.<br /><span>ONE KING.</span></h1><p className="intro-copy">Same intelligence. Different intentions.<br />Set their objectives. Watch the decisions unfold.</p></div><div className="intro-side"><span className="protocol-label">JEV / SYSTEM ONE</span><div className="intro-mark">VS<span>↗</span></div><span className="protocol-label">EVERY MOVE IS A CHOICE</span></div></div>
    <form onSubmit={submit} className="setup-grid">
      <div className="configuration-panel"><div className="section-heading"><span className="eyebrow">MATCH CONFIGURATION</span><span className="small-muted">Your rules of engagement</span></div>
        <div className="bot-editors"><BotEditor bot={config.white} color="white" onChange={white => setConfig({ ...config, white })} /><div className="versus-tag">VS</div><BotEditor bot={config.black} color="black" onChange={black => setConfig({ ...config, black })} /></div>
        <div className="match-settings"><div><label className="field-label" id="mode-label">Decision source</label><div className="segmented" role="group" aria-labelledby="mode-label">{(["jev", "demo"] as Mode[]).map(mode => <button type="button" aria-pressed={config.mode === mode} className={config.mode === mode ? "active" : ""} key={mode} onClick={() => setConfig({ ...config, mode })}>{mode === "jev" ? <Zap size={14} /> : <Radio size={14} />}{mode === "jev" ? "Jev live" : "Demo"}{config.mode === mode && <Check size={12} />}</button>)}</div></div><div><label className="field-label" htmlFor="pace">Move interval</label><select id="pace" value={config.interval} onChange={e => setConfig({ ...config, interval: Number(e.target.value) })}><option value={800}>Fast · 0.8 seconds</option><option value={1800}>Normal · 1.8 seconds</option><option value={3500}>Thoughtful · 3.5 seconds</option></select></div></div>
        <div className="setup-note">{config.mode === "demo" ? "Demo uses a local chess policy. Custom objectives and Jev probabilities are available in live mode." : configured ? "Jev is configured through TypeSafe AI. Each player receives only its own objective and the public game state." : <>To play live, add your TypeSafe AI key to <code>TYPESAFE_API_KEY</code> in <code>.env</code> and restart the app.</>}</div>
        {error && <p className="error-message" role="alert">{error}</p>}
        <button className="primary-button start-button" type="submit" disabled={busy || (config.mode === "jev" && !configured)}>{busy ? <LoaderCircle className="spin" size={20} /> : <Swords size={20} />}{busy ? "Preparing battle…" : config.mode === "demo" ? "Launch demo battle" : "Launch battle"}<ChevronRight size={20} /></button>
      </div>
      <aside className="setup-preview"><div className="section-heading"><span className="eyebrow">THE BATTLEGROUND</span><ArrowUpRight size={16} /></div><div className="preview-board-wrap"><ChessBoard fen={previewFen} preview /></div><div className="preview-caption"><span className="yellow">64 SQUARES.</span><span>NO SECOND GUESSES.</span></div><div className="preview-rule"><Cpu size={18} /><div><strong>Independent by design</strong><p>Two players. Separate objectives.<br />One shared battlefield.</p></div></div><div className="preview-rule"><Crosshair size={18} /><div><strong>Every decision, visible</strong><p>Inspect choices, replay moves, and follow the probability distribution.</p></div></div></aside>
    </form>
    <div className="setup-bottom"><span>CHESS, AT THE SPEED OF INSTINCT.</span><span>POWERED BY TYPESAFE JEV <Zap size={12} /></span></div>
  </main>;
}
