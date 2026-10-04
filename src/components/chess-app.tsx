"use client";

import { useState } from "react";
import { Cpu, ExternalLink, ShieldCheck } from "lucide-react";
import { Arena } from "./arena";
import { Setup } from "./setup";
import type { Battle, BattleConfig } from "@/lib/types";

export function ChessApp({ configured }: { configured: boolean }) {
  const [battle, setBattle] = useState<Battle | null>(null);
  const [previous, setPrevious] = useState<BattleConfig>();
  return <div className="app-shell"><header className="app-header"><div className="brand"><span className="brand-icon"><Cpu size={24} strokeWidth={2.5} /></span><span className="brand-name">JEV<span className="brand-slash">/</span><span className="brand-arena">ARENA</span></span></div><nav aria-label="Main navigation"><span className="nav-active">{battle ? "Live arena" : "Battle setup"}</span><a href="https://docs.typesafe.ai" target="_blank" rel="noreferrer">About Jev <ExternalLink size={12} /></a></nav><div className="header-status"><ShieldCheck size={14} /><span>{configured ? "JEV CONFIGURED" : "DEMO READY"}</span></div></header>{battle ? <Arena key={battle.id} initial={battle} onNew={() => { setPrevious(battle.config); setBattle(null); }} /> : <Setup configured={configured} previous={previous} onStart={setBattle} />}<footer className="app-footer"><span>JEV ARENA <span className="footer-divider">/</span> HUMAN CURIOSITY. MACHINE INSTINCT.</span><span>BUILT FOR THE NEXT MOVE <span className="tiny-square yellow" /></span></footer></div>;
}
