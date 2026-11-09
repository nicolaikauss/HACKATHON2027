import { NextButton } from '../components/parts';
import { SOURCES } from '../data/sources';

export function Sources() {
  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">Sources</p>
        <h1>Where the figures come from.</h1>
        <p className="lead">Customers, shops, prices, live feeds and market data in the demo are made up. The figures below are real.</p>
      </header>
      <table className="grid-table">
        <thead><tr><th>Figure</th><th>Claim</th><th>Publisher</th></tr></thead>
        <tbody>{SOURCES.map((s) => <tr key={s.figure}><td><b>{s.figure}</b></td><td>{s.claim}</td><td>{s.publisher}</td></tr>)}</tbody>
      </table>
      <footer className="page-foot"><span /><NextButton href="#/">Back to the start</NextButton></footer>
    </div>
  );
}
