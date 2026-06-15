// Westie dark theme: all component CSS, extracted from page.jsx to keep it under the size budget.
export default function StyleBlock() {
  return (
    <style>{`
      .page { max-width: 1100px; margin: 0 auto; padding: 32px 24px 80px; }
      .head { display: flex; justify-content: space-between; align-items: flex-end; gap: 24px; flex-wrap: wrap; margin-bottom: 24px; border-bottom: 1px solid var(--line); padding-bottom: 20px; }
      h1 { font-size: clamp(1.5rem, 3vw, 2.1rem); color: var(--ink); }
      .sub { color: var(--ink-soft); max-width: 68ch; margin: 6px 0 0; }
      .dim { color: var(--ink-faint); }

      /* Tabs */
      .tabs { display: flex; gap: 4px; background: oklch(0.12 0.008 265); padding: 4px; border-radius: var(--radius); border: 1px solid var(--line); }
      .tab { background: transparent; border: 0; padding: 8px 16px; border-radius: var(--radius-sm); color: var(--ink-soft); cursor: pointer; transition: background 120ms var(--ease-out), color 120ms var(--ease-out); }
      .tab:hover { color: var(--ink); background: oklch(0.20 0.008 265); }
      .tab:focus-visible { outline: 2px solid var(--heather); outline-offset: -2px; }
      .tab.on { background: var(--coat); color: var(--ground); box-shadow: var(--shadow); }

      /* Layout */
      .grid { display: grid; grid-template-columns: minmax(300px, 380px) 1fr; gap: 20px; align-items: start; }
      .grid.twin { grid-template-columns: minmax(280px, 340px) 1fr; }
      @media (max-width: 820px) { .grid, .grid.twin { grid-template-columns: 1fr; } }

      /* Panels (cards = Westie coat on dark ground) */
      .panel { background: var(--coat); border: 1px solid var(--line-strong); border-radius: var(--radius); padding: 20px; box-shadow: var(--shadow); color: var(--ground); }
      .panel h2 { font-size: 15px; color: var(--nose); margin-bottom: 4px; }
      .panel .sub, .panel .dim { color: oklch(0.40 0.008 265); }
      .panel code { color: oklch(0.35 0.008 265); background: oklch(0.82 0.015 90); padding: 1px 5px; border-radius: 3px; font-family: var(--font-mono); font-size: 12.5px; }
      .panel .error, .panel .error-sm { color: var(--bad); background: var(--bad-wash); border: 1px solid var(--bad); border-radius: var(--radius-sm); padding: 10px 14px; font-size: 13px; }
      .panel .error-sm { padding: 6px 10px; font-size: 12px; }

      /* Form elements on coat surfaces */
      .form { display: flex; flex-direction: column; gap: 14px; }
      .row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      .field { display: flex; flex-direction: column; gap: 5px; }
      .field > span { font-size: 12.5px; color: oklch(0.42 0.008 265); font-weight: 600; }
      input, select, textarea { width: 100%; padding: 9px 11px; background: oklch(0.98 0.01 90); border: 1px solid oklch(0.72 0.015 90); border-radius: var(--radius-sm); color: var(--nose); transition: border-color 120ms var(--ease-out), box-shadow 120ms var(--ease-out); }
      input:hover, select:hover, textarea:hover { border-color: oklch(0.55 0.015 90); }
      input:focus-visible, select:focus-visible, textarea:focus-visible { border-color: var(--heather); box-shadow: 0 0 0 3px var(--heather-wash); outline: none; }
      textarea { resize: vertical; font-family: var(--font-ui); }
      input::placeholder, textarea::placeholder { color: oklch(0.55 0.008 265); }
      .input-sm { padding: 6px 9px; font-size: 13px; }
      .input-tall { min-height: 140px; }

      /* Buttons */
      .btn { padding: 10px 18px; border-radius: var(--radius-sm); border: 1px solid oklch(0.70 0.015 90); background: oklch(0.94 0.015 90); cursor: pointer; font-weight: 600; color: var(--nose); transition: transform 80ms var(--ease-out), background 120ms var(--ease-out), border-color 120ms var(--ease-out); }
      .btn:hover { background: oklch(0.88 0.015 90); border-color: oklch(0.60 0.015 90); }
      .btn:active { transform: translateY(1px); }
      .btn:disabled { opacity: 0.45; cursor: not-allowed; }
      .btn.primary { background: var(--heather); color: var(--on-heather); border-color: var(--heather); }
      .btn.primary:hover { background: var(--heather-press); border-color: var(--heather-press); }
      .btn-primary:disabled { opacity: 0.45; }
      .btn-sm { padding: 5px 12px; font-size: 13px; }
      .icon-btn { display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; background: transparent; border: 1px solid transparent; border-radius: var(--radius-sm); cursor: pointer; color: oklch(0.45 0.008 265); transition: background 100ms var(--ease-out), color 100ms var(--ease-out), border-color 100ms var(--ease-out); }
      .icon-btn:hover { background: oklch(0.84 0.015 90); color: var(--nose); }
      .icon-btn:focus-visible { outline: 2px solid var(--heather); outline-offset: 1px; }
      .icon-btn:disabled { opacity: 0.3; cursor: not-allowed; }
      .icon-del:hover { color: var(--bad); background: var(--bad-wash); }
      .icon-sm { width: 24px; height: 24px; }
      .icon-svg { width: 14px; height: 14px; }
      .ic-del { color: oklch(0.50 0.008 265); }

      /* Spinner */
      .empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; min-height: 280px; color: oklch(0.42 0.008 265); text-align: center; }
      .empty p { max-width: 42ch; }
      .spinner { width: 26px; height: 26px; border-radius: 50%; border: 3px solid oklch(0.78 0.015 90); border-top-color: var(--heather); animation: spin 0.7s linear infinite; }
      @keyframes spin { to { transform: rotate(360deg); } }
      @media (prefers-reduced-motion: reduce) { .spinner { animation: none; border-top-color: var(--heather); } }

      /* Playground result */
      .result { min-height: 320px; }
      .pick { border: 1px solid oklch(0.72 0.015 90); border-radius: var(--radius); padding: 16px; background: var(--coat-2); }
      .pick-head { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
      .grade { font-size: 12px; color: oklch(0.45 0.008 265); font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }
      .pick-id { display: block; font-family: var(--font-mono); font-size: 14px; color: var(--nose); word-break: break-all; }
      .meta { display: flex; gap: 10px; flex-wrap: wrap; margin: 12px 0; }
      .metabit { display: flex; flex-direction: column; background: var(--coat); border: 1px solid oklch(0.72 0.015 90); border-radius: var(--radius-sm); padding: 6px 10px; }
      .metak { font-size: 11px; color: oklch(0.45 0.008 265); }
      .metav { font-family: var(--font-mono); font-size: 13px; color: var(--nose); }
      .why { color: oklch(0.42 0.008 265); font-size: 13px; margin: 4px 0 0; }
      .fallbacks { margin-top: 20px; } .fallbacks h3, .cands h3 { font-size: 13px; color: oklch(0.45 0.008 265); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 10px; }
      .fallbacks ol { margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 6px; }
      .fallbacks code, .cand-id { font-family: var(--font-mono); font-size: 12px; color: oklch(0.42 0.008 265); }
      .cands { margin-top: 20px; }
      .candlist { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
      .cand { border: 1px solid oklch(0.72 0.015 90); border-radius: var(--radius-sm); padding: 10px 12px; }
      .cand.out { opacity: 0.6; }
      .cand-top { display: flex; align-items: center; gap: 8px; }
      .cand-id { flex: 1; }
      .score { font-family: var(--font-mono); font-weight: 700; color: var(--nose); }
      .bar { height: 6px; background: var(--coat-2); border-radius: 99px; overflow: hidden; margin: 8px 0 6px; }
      .bar > span { display: block; height: 100%; border-radius: 99px; transition: width 300ms var(--ease-out); }
      .cand-reason { font-size: 12px; color: oklch(0.45 0.008 265); margin: 0; font-family: var(--font-mono); }

      /* Chip */
      .chip { display: inline-flex; align-items: center; font-size: 11.5px; font-weight: 700; padding: 2px 9px; border-radius: 99px; color: var(--c); background: color-mix(in oklch, var(--c) 14%, var(--coat)); border: 1px solid color-mix(in oklch, var(--c) 35%, transparent); }

      /* Tags */
      .tag { font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 99px; color: var(--nose); }
      .tag.good { color: var(--good); background: color-mix(in oklch, var(--good) 14%, var(--coat)); }
      .tag.warn { color: var(--warn); background: color-mix(in oklch, var(--warn) 16%, var(--coat)); }
      .tag.bad { color: var(--bad); background: var(--bad-wash); }

      /* Provider priority list */
      .pplist { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
      .pplist li { display: grid; grid-template-columns: 150px 1fr 90px; align-items: center; gap: 12px; }
      .pp-name { display: flex; align-items: center; gap: 8px; font-size: 13px; }
      .pp-bar { margin: 0; }
      .saverow { display: flex; align-items: center; gap: 12px; margin-top: 18px; }

      /* Presets tab */
      .preset-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
      .preset-row { display: flex; align-items: center; border-radius: var(--radius-sm); transition: background 100ms var(--ease-out); }
      .preset-row:hover { background: oklch(0.84 0.015 90); }
      .preset-row--sel { background: oklch(0.84 0.015 90); }
      .preset-row__name { flex: 1; padding: 8px 10px; background: transparent; border: 0; text-align: left; cursor: pointer; color: var(--nose); font-family: var(--font-mono); font-size: 13px; border-radius: var(--radius-sm); transition: color 100ms var(--ease-out); }
      .preset-row__name:hover { color: var(--heather); }
      .preset-row__actions { display: flex; gap: 2px; padding-right: 4px; }
      .create-row { display: flex; gap: 8px; }

      /* Mini rename dialog */
      .mini-dialog { border: 1px solid var(--line-strong); border-radius: var(--radius); padding: 0; background: var(--coat); color: var(--nose); box-shadow: 0 4px 24px oklch(0 0 0 / 0.35); min-width: 280px; }
      .mini-dialog::backdrop { background: oklch(0 0 0 / 0.5); }
      .mini-inner { padding: 16px; display: flex; flex-direction: column; gap: 12px; }
      .mini-actions { display: flex; gap: 8px; justify-content: flex-end; }

      /* Role editor */
      .role-block { border: 1px solid oklch(0.72 0.015 90); border-radius: var(--radius-sm); padding: 12px; }
      .role-block__head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
      .role-name { font-weight: 700; font-family: var(--font-mono); font-size: 14px; color: var(--nose); }
      .cand-edlist { list-style: none; margin: 0 0 10px; padding: 0; display: flex; flex-direction: column; gap: 4px; }
      .cand-edrow { display: flex; align-items: center; gap: 8px; padding: 4px 0; }
      .cand-edrow__idx { font-size: 11px; color: oklch(0.50 0.008 265); font-family: var(--font-mono); min-width: 18px; }
      .cand-edrow__code { flex: 1; font-family: var(--font-mono); font-size: 12px; word-break: break-all; }
      .cand-edrow__btns { display: flex; gap: 2px; }
      .cand-addrow { display: flex; gap: 8px; align-items: center; }
      .add-role-row { margin-bottom: 12px; }

      /* Agents list */
      .agent-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
      .agent-row { display: flex; align-items: center; gap: 10px; padding: 6px 0; border-bottom: 1px solid oklch(0.80 0.012 90); }
      .agent-key { font-size: 13px; font-weight: 600; color: var(--nose); min-width: 120px; }
      .agent-val { flex: 1; font-family: var(--font-mono); font-size: 12px; }

      /* Editor sections (role pools, agents) inside the preset editor */
      .editor-section { margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--line-strong); }
      .editor-section__head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
      .editor-section h3 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--ink-faint); margin: 0; }
      .editor-section .sub.dim { color: var(--ink-faint); }

      @media (max-width: 560px) { .row { grid-template-columns: 1fr; } .pplist li { grid-template-columns: 1fr; gap: 4px; } .cand-addrow { flex-wrap: wrap; } .agent-row { flex-wrap: wrap; } }
    `}</style>
  );
}
