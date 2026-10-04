import { ChessApp } from "@/components/chess-app";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default function Home() {
  return <ChessApp configured={Boolean(process.env.TYPESAFE_API_KEY?.trim())} />;
}
