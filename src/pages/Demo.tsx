import qrcode from 'qrcode-generator';
import { useMemo, useState } from 'react';
import { Icon, Seg } from '../components/parts';
import { act, useSync, useWorld } from '../lib/store';
import { MARKETS, today, type Market, type MarketState } from '../lib/world';
import { CustomerView } from '../views/Customer';
import { MerchantView } from '../views/Merchant';
import { NexiView, SupplierView } from '../views/Supplier';

export type Role = 'customer' | 'merchant' | 'supplier';
type Tab = Role | 'nexi';

const TITLE: Record<Role, { eyebrow: string; title: string }> = {
  customer: { eyebrow: 'Customer', title: 'Set your rules. Your agent stays inside them.' },
  merchant: { eyebrow: 'Merchant', title: 'See what to prepare. Make one offer.' },
  supplier: { eyebrow: 'Supplier', title: 'See one total. Set one price.' },
};
const TABS: { id: Tab; label: string }[] = [{ id: 'customer', label: 'Customer' }, { id: 'nexi', label: 'Nexi' }, { id: 'merchant', label: 'Merchant' }, { id: 'supplier', label: 'Supplier' }];

/** One sentence that tells the presenter what to try next. */
function nextStep(ms: MarketState, m: Market) {
  if (!ms.offer) {
    if (ms.supply?.outcome === 'stopped') return `The merchant’s agent did not buy ${m.input}. Lower the supplier’s price, or raise the merchant’s limit.`;
    return ms.round === 1 ? 'Start in the Merchant column: publish the offer.' : `Day ${ms.round}. Publish the next offer, and watch the weekly budgets.`;
  }
  const waiting = Object.values(ms.attempts).find((e) => e.outcome === 'ask');
  if (waiting) return `${waiting.name}’s agent asks first. Choose ${waiting.name} in the Customer column, then approve.`;
  const stopped = Object.values(ms.attempts).find((e) => e.outcome === 'stopped' && e.rule === 'limit');
  if (stopped && today(ms, m).units < ms.offer.capacity) return `${stopped.name}’s agent did not buy. Raise ${stopped.name}’s price limit, and it pays at once.`;
  return 'Try to break a rule in the Nexi column, revoke a mandate, or close the day.';
}

function Qr({ url }: { url: string }) {
  const svg = useMemo(() => {
    const code = qrcode(0, 'M');
    code.addData(url);
    code.make();
    return code.createSvgTag({ scalable: true, margin: 1 });
  }, [url]);
  return <div className="qr" dangerouslySetInnerHTML={{ __html: svg }} />;
}

export function Demo({ role, join }: { role?: Role; join?: boolean }) {
  const { market: m, ms } = useWorld();
  const sync = useSync();
  const [tab, setTab] = useState<Tab>('merchant');
  const [showQr, setShowQr] = useState(false);

  return (
    <div className="demo">
      <header className="demo-head">
        <div>
          <p className="eyebrow">{role ? TITLE[role].eyebrow : 'Live demo'}</p>
          <h1>{role ? TITLE[role].title : 'Three sides. One set of rules.'}</h1>
        </div>
        <div className="demo-tools">
          <span className={`sync ${sync.mode}`}><i />{sync.mode === 'network' ? 'Shared on this network' : 'Shared in this browser'}</span>
          {!role && sync.joinUrl && <button className="btn ghost small" aria-expanded={showQr} onClick={() => setShowQr((v) => !v)}><Icon name="phone" size={18} />Join by phone</button>}
          {!role && <button className="btn ghost small" onClick={() => act({ type: 'reset' })}><Icon name="reset" size={18} />Start again</button>}
        </div>
      </header>

      {showQr && !role && (
        <aside className="qr-card">
          <Qr url={sync.joinUrl} />
          <p><b>Scan to join as a customer.</b>Use the same Wi-Fi as this computer. Your rules and your agent appear on this screen.<code>{sync.joinUrl}</code></p>
        </aside>
      )}

      {!role && (
        <div className="demo-bar">
          <Seg id="market" label="Choose a shop" options={MARKETS.map((x) => ({ id: x.id, label: x.label }))} value={m.id} onChange={(id) => act({ type: 'market', id })} />
          <p className="hint" role="status"><b>Next</b>{nextStep(ms, m)}</p>
        </div>
      )}

      {role ? (
        <div className={`solo ${role}`}>
          <div className="col">{role === 'customer' ? <CustomerView join={join} /> : role === 'merchant' ? <MerchantView /> : <SupplierView />}</div>
        </div>
      ) : (
        <>
          <div className="tabs"><Seg id="tab" label="Choose a side" options={TABS} value={tab} onChange={setTab} /></div>
          <div className="board" data-tab={tab}>
            <div className="col c-customer"><CustomerView checks={false} /></div>
            <div className="col c-nexi"><NexiView /></div>
            <div className="col c-merchant"><MerchantView /></div>
            <div className="col c-supplier"><SupplierView /></div>
          </div>
        </>
      )}
    </div>
  );
}
