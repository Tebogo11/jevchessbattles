"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="app-error"><p className="eyebrow yellow">CONNECTION INTERRUPTED</p><h1>The arena hit a problem.</h1><p>Reload the view to try again. An active match may need to be restarted.</p><button className="primary-button" onClick={reset}>Try again</button></main>;
}
