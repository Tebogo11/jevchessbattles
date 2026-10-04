"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { Chess } from "chess.js";

type BoardInstance = { position: (fen: string, animate?: boolean) => void; orientation: (side: string) => void; resize: () => void; destroy: () => void };
declare global { interface Window { Chessboard?: (element: HTMLElement, options: Record<string, unknown>) => BoardInstance } }

function highlightSquares(root: HTMLDivElement | null, fen: string, from?: string, to?: string) {
  if (!root) return;
  root.querySelectorAll(".last-from,.last-to,.in-check").forEach(el => el.classList.remove("last-from", "last-to", "in-check"));
  if (from) root.querySelector(`[data-square="${from}"]`)?.classList.add("last-from");
  if (to) root.querySelector(`[data-square="${to}"]`)?.classList.add("last-to");
  const game = new Chess(fen);
  if (game.isCheck()) {
    const king = game.board().flat().find(piece => piece?.type === "k" && piece.color === game.turn());
    if (king) root.querySelector(`[data-square="${king.square}"]`)?.classList.add("in-check");
  }
}

export function ChessBoard({ fen, from, to, flipped = false, preview = false }: { fen: string; from?: string; to?: string; flipped?: boolean; preview?: boolean }) {
  const container = useRef<HTMLDivElement>(null);
  const instance = useRef<BoardInstance | null>(null);
  const latest = useRef({ fen, flipped, from, to });
  latest.current = { fen, flipped, from, to };
  const [jqueryReady, setJqueryReady] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!ready || !container.current || !window.Chessboard) return;
    instance.current = window.Chessboard(container.current, {
      position: latest.current.fen, orientation: latest.current.flipped ? "black" : "white",
      draggable: false, showNotation: true, pieceTheme: "/pieces/{piece}.svg",
      moveSpeed: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 220,
      onMoveEnd: () => highlightSquares(container.current, latest.current.fen, latest.current.from, latest.current.to),
    });
    const observer = new ResizeObserver(() => {
      instance.current?.resize();
      highlightSquares(container.current, latest.current.fen, latest.current.from, latest.current.to);
    });
    observer.observe(container.current);
    return () => { observer.disconnect(); instance.current?.destroy(); instance.current = null; };
  }, [ready]);

  useEffect(() => {
    const board = instance.current;
    if (!board) return;
    board.orientation(flipped ? "black" : "white");
    board.position(fen, !preview);
    const highlight = () => highlightSquares(container.current, fen, from, to);
    highlight();
    const timer = setTimeout(highlight, 260);
    return () => clearTimeout(timer);
  }, [fen, from, to, flipped, preview, ready]);

  return <>
    <Script src="/vendor/jquery.min.js" strategy="afterInteractive" onReady={() => setJqueryReady(true)} onError={() => setFailed(true)} />
    {jqueryReady && <Script src="/vendor/chessboard.min.js" strategy="afterInteractive" onReady={() => setReady(true)} onError={() => setFailed(true)} />}
    <div className={`chess-board ${preview ? "preview-board" : ""}`} role="img" aria-label={`Chess position${from && to ? `, last move ${from} to ${to}` : ""}. ${flipped ? "Black" : "White"} at the bottom.`}>
      <div ref={container} className="board-mount" />
      {!ready && <div className="board-loading">{failed ? "Board could not load. Refresh to retry." : "Loading board…"}</div>}
    </div>
  </>;
}
