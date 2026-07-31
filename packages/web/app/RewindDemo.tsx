"use client";

import { useState } from "react";

type Step = { kind: string; label: string; text: string; poison?: boolean; bad?: boolean };
const STEPS: Step[] = [
  { kind: "llm_call", label: "read request", text: "Reads the refund request — $4,200 for order #A-9 to customer 1002." },
  { kind: "tool_call", label: "customer_lookup", text: "customer_lookup(1002) → Jane Doe." },
  { kind: "memory_read", label: "read owner", text: "Reads the “verified” ownership record for order #A-9." },
  { kind: "memory_write", label: "poisoned", text: "order:A-9:owner = customer 1002 (Jane) — the poisoned fact.", poison: true },
  { kind: "llm_call", label: "approve", text: "Ownership check passes → approves the refund." },
  { kind: "tool_call", label: "issue_refund", text: "issue_refund { amount: 4200, to: 1002 } — money out the door.", bad: true },
];

const k = (kind: string) => `var(--k-${kind})`;
const X = (i: number) => 70 + i * 104;
const Y = 100;
const FORK = 3;

export function RewindDemo() {
  const [head, setHead] = useState(0);
  const [forked, setForked] = useState(false);
  const step = STEPS[head];
  const canFork = head >= FORK;
  const owner = head >= FORK ? "customer 1002 (Jane)" : null;

  return (
    <section className="demo">
      <div className="eyebrow">Try it</div>
      <h2 style={{ fontSize: 26, letterSpacing: "-0.02em", margin: "6px 0 4px" }}>
        Scrub the run. Fork the poisoned decision.
      </h2>
      <p style={{ color: "var(--dim)", margin: "0 0 20px", maxWidth: "58ch" }}>
        Drag the playhead through a real refund run. At the poisoned memory write, fork it — Rewind
        replays a control and an edited branch so you can see, and prove, what changes.
      </p>

      <div className="demo-stage">
        <svg viewBox="0 0 760 200" width="100%" style={{ maxHeight: 320, display: "block" }} role="img" aria-label="Interactive run timeline">
          {/* main line = the original / control path */}
          {!forked ? (
            <>
              <line x1={X(0)} y1={Y} x2={X(head)} y2={Y} stroke="var(--lane-0)" strokeWidth={3} />
              <line x1={X(head)} y1={Y} x2={X(5)} y2={Y} stroke="var(--border-hi)" strokeWidth={3} />
            </>
          ) : (
            <line x1={X(0)} y1={Y} x2={X(5)} y2={Y} stroke="var(--lane-0)" strokeWidth={3} />
          )}

          {/* three real branches from the poisoned write */}
          {forked && (
            <>
              {/* control label on the original path */}
              <text className="demo-blabel" x={X(5) + 22} y={Y + 5} fontSize={13} fill="var(--bad)" fontWeight={600}>
                control · issued
              </text>

              {/* edited: memory fixed */}
              <path className="demo-branch" pathLength={1} d={`M${X(FORK)} ${Y} C ${X(FORK) + 60} ${Y}, ${X(4) + 20} 44, ${X(5) + 20} 44`} stroke="var(--good)" strokeWidth={3} fill="none" />
              <circle className="demo-blabel" cx={X(5) + 20} cy={44} r={7} fill="var(--good)" />
              <text className="demo-blabel" x={X(5) + 20} y={28} fontSize={13} fill="var(--good)" fontWeight={600} textAnchor="middle">
                edited · refused ✓
              </text>

              {/* self-corrected: agent recalls its own past failures */}
              <path className="demo-branch" pathLength={1} d={`M${X(FORK)} ${Y} C ${X(FORK) + 60} ${Y}, ${X(4) + 20} 156, ${X(5) + 20} 156`} stroke="var(--lane-5)" strokeWidth={3} fill="none" />
              <circle className="demo-blabel" cx={X(5) + 20} cy={156} r={7} fill="var(--lane-5)" />
              <text className="demo-blabel" x={X(5) + 20} y={178} fontSize={13} fill="var(--lane-5)" fontWeight={600} textAnchor="middle">
                self-corrected · refused ✓
              </text>
            </>
          )}

          {/* playhead */}
          {!forked && (
          <g className="demo-playhead" style={{ transform: `translateX(${X(head) - X(0)}px)` }}>
            <rect x={X(0) - 20} y={Y - 62} width={40} height={17} rx={4} fill="var(--accent)" />
            <text x={X(0)} y={Y - 50} fontSize={10} fontWeight={700} fill="var(--accent-ink)" textAnchor="middle">HEAD</text>
            <line x1={X(0)} y1={Y - 42} x2={X(0)} y2={Y - 14} stroke="var(--accent)" strokeWidth={2} opacity={0.55} />
          </g>
          )}

          {/* commit nodes + labels */}
          {STEPS.map((s, i) => {
            const future = i > head;
            const color = s.bad ? "var(--bad)" : k(s.kind);
            return (
              <g key={i} onClick={() => setHead(i)} className="demo-node" opacity={future ? 0.34 : 1}>
                {s.poison && <circle cx={X(i)} cy={Y} r={13} fill="var(--k-memory_write)" opacity={0.18} />}
                <circle cx={X(i)} cy={Y} r={i === head ? 9 : 7} fill={color} stroke="var(--surface)" strokeWidth={i === head ? 3 : 0} />
                <text x={X(i)} y={Y + 30} fontSize={11.5} fill={s.poison || s.bad ? color : "var(--dim)"} fontWeight={s.poison || s.bad ? 700 : 500} textAnchor="middle">
                  {s.label}
                </text>
                <text x={X(i)} y={Y + 44} fontSize={10} fill="var(--faint)" textAnchor="middle" fontFamily="ui-monospace, monospace">
                  #{i}
                </text>
              </g>
            );
          })}
        </svg>

        <div className="demo-caption">
          <span className="dot" style={{ background: step.bad ? "var(--bad)" : k(step.kind), marginTop: 5 }} />
          <div>
            <span className="kd mono" style={{ color: step.bad ? "var(--bad)" : k(step.kind) }}>
              #{head} {step.kind}
            </span>
            {owner && (
              <span className="chip" style={{ marginLeft: 10, fontSize: 11.5 }}>
                <b className="k">order:A-9:owner</b> = {owner}
              </span>
            )}
            <div className="tx">{step.text}</div>
          </div>
        </div>

        <div className="demo-controls">
          <input
            type="range"
            className="scrubber"
            min={0}
            max={STEPS.length - 1}
            value={head}
            onChange={(e) => setHead(Number(e.target.value))}
            style={{ maxWidth: 360 }}
          />
          <button
            className="btn btn-primary"
            disabled={!canFork || forked}
            onClick={() => {
              setForked(true);
              setHead(5);
            }}
            title={canFork ? "" : "Scrub to the poisoned memory write first"}
          >
            {forked ? "Replayed ✓" : canFork ? "Fork & replay from here" : "Scrub to the poisoned write →"}
          </button>
          {forked && (
            <button className="btn" onClick={() => setForked(false)}>
              Reset
            </button>
          )}
        </div>

        {forked && (
          <div className="demo-attr">
            <div style={{ display: "grid", gap: 6 }}>
              <span>
                <b style={{ color: "var(--bad)" }}>control</b> — replays the same poisoned memory and
                still issues the $4,200 refund, proving the run is deterministic.
              </span>
              <span>
                <b style={{ color: "var(--good)" }}>edited</b> — owner fixed to 1001; the agent
                refuses. Because the control reproduced the original, this change is{" "}
                <em>provably</em> caused by your edit.
              </span>
              <span>
                <b style={{ color: "var(--lane-5)" }}>self-corrected</b> — same poison, but the agent
                calls <code>find_similar_failures</code>, recalls its own past incidents, and refuses
                with no edit at all.
              </span>
            </div>
            <div style={{ marginTop: 10, color: "var(--dim)" }}>
              All three are real runs · investigation cost <b>$0.023</b>.
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
