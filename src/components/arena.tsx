"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, ArrowLeft, ArrowUpRight, Check, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Clock3, Cpu, Download, FlipVertical2, Hash, List, LoaderCircle, Pause, Play, Radio, RotateCcw, ShieldCheck, Swords, Target, Zap } from "lucide-react";
import { replay, snapshot as getSnapshot, PIECE_NAMES } from "@/lib/chess";
import { useBattle } from "@/hooks/use-battle";
import { ChessBoard } from "./chess-board";
import type { Battle, Bot, Side, Snapshot, Turn } from "@/lib/types";

function BotCard({ bot, side, active, turns }: { bot: Bot; side: Side; active: boolean; turns: Turn[] }) {
  const captured = turns.filter(turn => turn.color === side && turn.captured);
  const latest = turns.findLast(turn => turn.color === side);
  return <section className={`player-card ${side === "w" ? "white" : "black"} ${active ? "is-active" : ""}`}>
    <div className="player-top"><div className="bot-emblem"><Cpu size={23} /></div><span className="eyebrow">{side === "w" ? "WHITE" : "BLACK"} SIDE</span><span className={`turn-indicator ${active ? "on" : ""}`} /></div>
    <h2>{bot.name}</h2><p className="player-goal" title={bot.goal}>{bot.goal}</p>
    <div className="player-stats"><span>{active ? "TO MOVE" : "STANDING BY"}</span><span>{latest?.confidence != null ? `${Math.round(latest.confidence * 100)}% CONF.` : "JEV / " + (side === "w" ? "01" : "02")}</span></div>
    <div className="captures" aria-label={`${bot.name} captured pieces`}>{captured.length ? captured.map((turn, index) => <img key={index} src={`/pieces/${side === "w" ? "b" : "w"}${turn.captured!.toUpperCase()}.svg`} alt={`Captured ${PIECE_NAMES[turn.captured!]}`} width={25} height={29} />) : <span>No captures yet</span>}</div>
  </section>;
}

function MoveLog({ turns, cursor, seek, disabled }: { turns: Turn[]; cursor: number; seek: (ply: number) => void; disabled?: boolean }) {
  const scrollArea = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const area = scrollArea.current;
    const selected = area?.querySelector<HTMLButtonElement>("button.current");
    if (!area) return;
    if (!cursor) { area.scrollTop = 0; return; }
    if (selected) {
      const top = selected.offsetTop;
      if (top < area.scrollTop) area.scrollTop = top;
      else if (top + selected.offsetHeight > area.scrollTop + area.clientHeight) area.scrollTop = top + selected.offsetHeight - area.clientHeight;
    }
  }, [cursor, turns.length]);
  const rows = Array.from({ length: Math.ceil(turns.length / 2) }, (_, i) => [turns[i * 2], turns[i * 2 + 1]]);
  return <section className="move-log panel"><div className="section-heading"><span className="eyebrow"><List size={14} /> MOVE LOG</span><span className="count-badge">{turns.length}</span></div><div className="log-table-head"><span>#</span><span>WHITE</span><span>BLACK</span></div><div className="move-rows" ref={scrollArea}>{rows.length ? rows.map((row, index) => <div className="move-row" key={index}><span>{String(index + 1).padStart(2, "0")}</span>{row.map((turn, side) => turn ? <button disabled={disabled} key={side} className={cursor === turn.ply ? "current" : ""} onClick={() => seek(turn.ply)} aria-label={`View move ${index + 1}, ${side === 0 ? "White" : "Black"} ${turn.san}`} aria-current={cursor === turn.ply ? "step" : undefined}>{turn.san}{cursor === turn.ply && <span className="tiny-square" />}</button> : <span key={side} className="empty-move">—</span>)}</div>) : <div className="empty-state"><Swords size={26} /><p>The opening is unwritten.</p><span>Moves appear here as the battle begins.</span></div>}</div><div className="log-footer"><span className="tiny-square" /> Click a move to replay</div></section>;
}

function Metrics({ turns, position, decision, demo }: { turns: Turn[]; position: Snapshot; decision?: Turn; demo: boolean }) {
  const avgLatency = turns.length ? Math.round(turns.reduce((sum, turn) => sum + turn.latencyMs, 0) / turns.length) : null;
  const totalTokens = turns.reduce((sum, turn) => sum + turn.inputTokens, 0);
  const balance = position.material.w - position.material.b;
  const whitePercent = (position.material.w + position.material.b) ? position.material.w / (position.material.w + position.material.b) * 100 : 50;
  return <div className="metrics-content"><section className="panel telemetry"><div className="section-heading"><span className="eyebrow"><Activity size={14} /> GAME METRICS</span><span className="tiny-square yellow" /></div><div className="metrics-grid"><div><span>HALF-MOVES</span><strong>{String(position.ply).padStart(2, "0")}</strong></div><div><span>LEGAL MOVES</span><strong>{position.legalMoves}</strong></div><div><span>AVG. DECISION</span><strong>{avgLatency ?? "—"}<small>{avgLatency !== null ? "ms" : ""}</small></strong></div><div><span>INPUT TOKENS</span><strong>{totalTokens ? totalTokens.toLocaleString() : "—"}</strong></div></div><div className="material-metric"><div><span>MATERIAL BALANCE</span><strong>{balance > 0 ? `W +${balance}` : balance < 0 ? `B +${Math.abs(balance)}` : "EVEN"}</strong></div><div className="material-bar"><span style={{ width: `${whitePercent}%` }} /></div><div className="material-labels"><span>WHITE {position.material.w}</span><span>{position.material.b} BLACK</span></div></div><p className="metric-note">Piece values only. Not a win prediction.</p></section>
    <section className="panel probability-panel"><div className="section-heading"><span className="eyebrow"><Target size={14} /> {demo ? "DEMO WEIGHTS" : "MOVE PROBABILITIES"}</span></div><div className="decision-title"><span>{decision ? `AFTER ${Math.ceil(decision.ply / 2)}${decision.color === "w" ? "." : "…"} ${decision.san}` : "AWAITING FIRST MOVE"}</span>{decision && <span>{decision.latencyMs} ms</span>}</div>{decision ? <><div className="candidate-list">{decision.candidates.slice(0, 5).map((candidate, i) => <div className={`candidate ${candidate.san === decision.san ? "chosen" : ""}`} key={candidate.uci}><div><span>{candidate.san}{candidate.san === decision.san && <Check size={11} />}</span><span>{(candidate.probability * 100).toFixed(1)}%</span></div><div className="candidate-track"><span style={{ width: `${Math.max(0.3, candidate.probability * 100)}%`, opacity: 1 - i * 0.13 }} /></div></div>)}</div><div className="confidence-line"><span>{demo ? "LOCAL POLICY" : "DECISION CONFIDENCE"}</span><strong>{demo ? "DEMO" : decision.confidence === null ? "—" : `${Math.round(decision.confidence * 100)}%`}</strong></div></> : <div className="empty-state compact"><Target size={26} /><span>Each decision leaves a trace.</span></div>}<p className="metric-note">{demo ? "Illustrative local weights. Jev is not making these decisions." : "Choice probabilities reflect Jev’s preference among legal moves, not the chance of winning."}</p></section>
    <section className="isolation-note"><ShieldCheck size={17} /><div><strong>Independent players</strong><p>Private objectives. Shared board.<br />No opponent decision history sent.</p></div></section>
  </div>;
}

export function Arena({ initial, onNew }: { initial: Battle; onNew: () => void }) {
  const { battle, cursor, playing, pending, error, step, pause, seek, toggle, next } = useBattle(initial);
  const [flipped, setFlipped] = useState(false);
  const [tab, setTab] = useState<"log" | "metrics">("log");
  const [confirmNew, setConfirmNew] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const live = cursor === battle.turns.length;
  const turns = useMemo(() => battle.turns.slice(0, cursor), [battle.turns, cursor]);
  const decision = turns.at(-1);
  const position = useMemo(() => live ? battle.snapshot : getSnapshot(replay(turns.map(turn => turn.san))), [live, battle.snapshot, turns]);
  const activeBot = position.turn === "w" ? battle.config.white : battle.config.black;
  const finished = battle.snapshot.result;
  const status = !live ? "REPLAY" : finished ? "COMPLETE" : playing ? "LIVE MATCH" : "PAUSED";

  useEffect(() => {
    if (confirmNew) dialog.current?.showModal();
    else dialog.current?.close();
  }, [confirmNew]);

  function download() {
    const game = replay(battle.turns.map(turn => turn.san));
    const result = game.isCheckmate() ? (game.turn() === "w" ? "0-1" : "1-0") : game.isDraw() ? "1/2-1/2" : "*";
    game.header("Event", battle.config.mode === "demo" ? "JEV Arena — local demo" : "JEV Arena", "White", battle.config.white.name, "Black", battle.config.black.name, "Result", result);
    const url = URL.createObjectURL(new Blob([game.pgn()], { type: "application/x-chess-pgn" }));
    const link = document.createElement("a"); link.href = url; link.download = `jev-${battle.id.slice(0, 8)}.pgn`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <main className="arena-page">
    <div className="arena-heading"><div><p className="eyebrow yellow">BATTLE IN PROGRESS / {battle.id.slice(0, 8).toUpperCase()}</p><h1>{battle.config.white.name}<span> vs </span>{battle.config.black.name}</h1></div><div className="arena-top-actions"><span className={`status-badge ${playing && live ? "live" : ""}`}><Radio size={12} />{status}</span><button className="subtle-button" onClick={download} title="Export game as PGN"><Download size={15} /><span>Export PGN</span></button><button className="subtle-button" onClick={() => { pause(); setConfirmNew(true); }}><ArrowLeft size={15} /><span>New battle</span></button></div></div>
    {battle.config.mode === "demo" && <div className="demo-banner"><Zap size={13} /><span>DEMO MODE</span> Local chess policy · no Jev API calls · objectives apply in live mode</div>}
    <div className="arena-grid">
      <aside className="players-column"><div className="player-stack"><BotCard bot={battle.config.white} side="w" active={position.turn === "w" && !position.result} turns={turns} /><BotCard bot={battle.config.black} side="b" active={position.turn === "b" && !position.result} turns={turns} /></div><div className="desktop-log"><MoveLog turns={battle.turns} cursor={cursor} seek={seek} /></div></aside>
      <section className="board-column"><div className="board-topline"><div className="eyebrow"><span className="tiny-square" /> {position.result ? "MATCH FINISHED" : !live ? "REPLAYING POSITION" : pending && playing ? `${activeBot.name} IS DECIDING` : `${activeBot.name} TO MOVE`}</div><button className="icon-button" aria-label="Flip board" title="Flip board" onClick={() => setFlipped(!flipped)}><FlipVertical2 size={15} /></button></div>
        <div className="board-frame"><div className="board-corner top-left" /><div className="board-corner bottom-right" /><ChessBoard fen={decision?.fen ?? battle.initialFen} from={decision?.from} to={decision?.to} flipped={flipped} /></div>
        <div className="board-bottomline"><span><Hash size={12} />{String(cursor).padStart(3, "0")} / {String(battle.turns.length).padStart(3, "0")} HALF-MOVES</span><span className={position.check ? "coral" : ""}>{position.check ? "KING IN CHECK" : position.result ? "GAME OVER" : "STANDARD CHESS"}</span></div>
        <div className="playback"><button className="icon-button" aria-label="First position" disabled={cursor === 0} onClick={() => seek(0)}><ChevronsLeft size={20} /></button><button className="icon-button step-button" aria-label="Previous move" disabled={cursor === 0} onClick={() => seek(cursor - 1)}><ChevronLeft size={23} /></button><button className="primary-button play-button" disabled={!live || !!finished || (pending && !playing)} onClick={toggle} aria-label={playing ? "Pause battle" : "Play battle"}>{playing ? <Pause size={18} fill="currentColor" /> : pending ? <LoaderCircle size={18} className="spin" /> : <Play size={18} fill="currentColor" />}{playing ? "Pause battle" : !live ? "Replaying" : finished ? "Finished" : "Play battle"}</button><button className="icon-button step-button" aria-label={live ? "Generate next move" : "Next recorded move"} disabled={pending || (live && !!finished)} onClick={next}><ChevronRight size={23} /></button><button className="icon-button" aria-label="Latest position" disabled={live} onClick={() => seek(battle.turns.length)}><ChevronsRight size={20} /></button></div>
        <div className="playback-caption" aria-live="polite">{!live ? <button onClick={() => seek(battle.turns.length)}>Viewing history <ArrowUpRight size={12} /> Return to latest move</button> : pending ? playing ? "Reading the board. Choosing a move." : "Pausing. Waiting for the current request to settle." : finished ? finished : playing ? <><Clock3 size={12} /> {battle.config.interval / 1000}s between decisions</> : "Paused. Step forward to request one new move."}</div>
        {error && <div className="error-message" role="alert"><p>{error}</p><button className="subtle-button" disabled={pending || !live} onClick={() => void step()}><RotateCcw size={14} />Retry turn</button></div>}
        {finished && live && <div className="result-banner"><Swords size={22} /><div><span className="eyebrow">BATTLE CONCLUDED</span><h3>{finished}</h3></div><button className="subtle-button" onClick={download}><Download size={16} />Save PGN</button></div>}
      </section>
      <aside className="metrics-column"><Metrics turns={turns} position={position} decision={decision} demo={battle.config.mode === "demo"} /></aside>
    </div>
    <section className="mobile-details"><div className="mobile-tabs" role="tablist" aria-label="Match details"><button role="tab" aria-selected={tab === "log"} aria-controls="mobile-log" id="tab-log" onClick={() => setTab("log")}><List size={15} />Move log <span>{battle.turns.length}</span></button><button role="tab" aria-selected={tab === "metrics"} aria-controls="mobile-metrics" id="tab-metrics" onClick={() => setTab("metrics")}><Activity size={15} />Metrics</button></div>{tab === "log" ? <div role="tabpanel" id="mobile-log" aria-labelledby="tab-log"><MoveLog turns={battle.turns} cursor={cursor} seek={seek} /></div> : <div role="tabpanel" id="mobile-metrics" aria-labelledby="tab-metrics"><Metrics turns={turns} position={position} decision={decision} demo={battle.config.mode === "demo"} /></div>}</section>
    <dialog ref={dialog} className="new-match-dialog" aria-labelledby="new-match-title" onCancel={() => setConfirmNew(false)}><Swords size={28} className="yellow" /><h2 id="new-match-title">Start a new battle?</h2><p>This match is held in this browser tab. Export its PGN before leaving if you want to keep it.</p><div className="flex flex-wrap gap-3"><button className="subtle-button" onClick={download}><Download size={14} />Export PGN</button><button className="subtle-button" onClick={() => setConfirmNew(false)} autoFocus>Keep match</button><button className="primary-button" onClick={onNew}>New battle</button></div></dialog>
  </main>;
}
