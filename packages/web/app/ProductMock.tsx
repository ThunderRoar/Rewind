"use client";

import { useState } from "react";

const TABS = ["Timeline", "Replay diff", "Search"] as const;
type Tab = (typeof TABS)[number];

const k = (kind: string) => `var(--k-${kind})`;

function Dot({ kind }: { kind: string }) {
  return <span className="dot" style={{ background: k(kind) }} />;
}

export function ProductMock() {
  const [tab, setTab] = useState<Tab>("Replay diff");

  return (
    <div className="mock">
      <div className="mock-bar">
        <span className="mock-traffic">
          <span style={{ background: "var(--bad)" }} />
          <span style={{ background: "var(--warn)" }} />
          <span style={{ background: "var(--good)" }} />
        </span>
        <span className="mock-title">rewind — refund-bot · run 07d1e0e</span>
        <div className="mock-tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              className="mock-tab"
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="mock-body">
        {tab === "Timeline" && (
          <div>
            <div className="mock-scrub" />
            {[
              ["6", "memory_write", "order:A-9:owner = customer 1002 (Jane)", true],
              ["7", "memory_read", "order:A-9:owner", false],
              ["8", "llm_call", "ownership verified → approve refund", false],
              ["9", "tool_call", "issue_refund { amount: 4200, to: 1002 }", true],
              ["10", "observation", "refund complete · ledger +$4,200", false],
            ].map(([seq, kind, val, hot]) => (
              <div className={`mock-row${hot ? " hot" : ""}`} key={seq as string}>
                <span className="seq">#{seq}</span>
                <Dot kind={kind as string} />
                <span className="kd" style={{ color: k(kind as string) }}>
                  {kind}
                </span>
                <span className="val">{val}</span>
              </div>
            ))}
          </div>
        )}

        {tab === "Replay diff" && (
          <div>
            <div className="mock-banner">
              <span className="dot" style={{ background: "var(--good)", marginTop: 3 }} />
              <span>
                Control replay reproduced the original outcome <b>step-for-step</b> — the divergence
                below is caused by your memory edit, not model noise.
              </span>
            </div>
            <div className="mock-diff">
              <div className="mock-diff-row">
                <span className="g">#7</span>
                <span className="same">memory_read order:A-9:owner</span>
                <span className="same">memory_read order:A-9:owner</span>
              </div>
              <div className="mock-diff-row diverged">
                <span className="g">#8</span>
                <span className="o">llm: owner is 1002 → approve</span>
                <span className="e">llm: owner unverified → ask</span>
              </div>
              <div className="mock-diff-row diverged">
                <span className="g">#9</span>
                <span className="o">issue_refund $4,200 → 1002</span>
                <span className="e">— no refund issued</span>
              </div>
              <div className="mock-diff-row diverged">
                <span className="g">#10</span>
                <span className="o">refund complete</span>
                <span className="e">refund refused ✓</span>
              </div>
            </div>
            <div className="mock-foot">
              <span>
                investigation cost <b>$0.023</b>
              </span>
              <span>
                caught a <b style={{ color: "var(--bad)" }}>$4,200</b> wrong payout
              </span>
            </div>
          </div>
        )}

        {tab === "Search" && (
          <div>
            <div className="mock-search">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
                <circle cx="7" cy="7" r="4.5" stroke="var(--dim)" strokeWidth="1.5" />
                <path d="M11 11l3 3" stroke="var(--dim)" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              refunds over $500
            </div>
            {[
              ["tool_call", "9", "0.102", "issue_refund { amount: 4200, to: 1002 }"],
              ["tool_call", "4", "0.123", "issue_refund { amount: 900, to: 1044 }"],
              ["llm_call", "8", "0.187", "ownership verified → approve refund"],
            ].map(([kind, seq, dist, sum]) => (
              <div className="mock-result" key={seq}>
                <div className="top">
                  <Dot kind={kind} />
                  <span style={{ color: k(kind), fontWeight: 600 }}>{kind}</span>
                  <span style={{ color: "var(--faint)", fontFamily: "var(--mono)", fontSize: 12 }}>
                    #{seq}
                  </span>
                  <span className="dist">dist {dist}</span>
                </div>
                <div className="sum">{sum}</div>
              </div>
            ))}
            <div style={{ color: "var(--faint)", fontSize: 12, marginTop: 6 }}>
              distributed vector index · 895,448 events · ~58 ms
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
