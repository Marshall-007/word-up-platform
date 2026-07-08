import { useEffect, useLayoutEffect, useState, useCallback } from 'react';
import { X } from 'lucide-react';

// A lightweight spotlight walkthrough. `steps` is [{ selector, title, body }].
// It dims the page, highlights the target element, and shows an explanation.
export function Tour({ steps, run, onClose, accent = '#ea580c' }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState(null);

  const measure = useCallback(() => {
    const step = steps[i];
    const el = step && document.querySelector(step.selector);
    if (el) {
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    } else {
      setRect(null);
    }
  }, [i, steps]);

  useEffect(() => {
    if (run) setI(0);
  }, [run]);

  useLayoutEffect(() => {
    if (!run) return;
    const el = steps[i] && document.querySelector(steps[i].selector);
    if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    measure();
    const t = setTimeout(measure, 350);
    const on = () => measure();
    window.addEventListener('resize', on);
    window.addEventListener('scroll', on, true);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', on);
      window.removeEventListener('scroll', on, true);
    };
  }, [run, i, measure, steps]);

  if (!run) return null;
  const step = steps[i];
  if (!step) return null;
  const last = i === steps.length - 1;
  const pad = 8;
  const spot = rect
    ? { top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }
    : null;

  let tip;
  const TIP_W = 320;
  if (spot) {
    const below = spot.top + spot.height + 12;
    const left = Math.min(Math.max(12, spot.left), window.innerWidth - TIP_W - 12);
    if (window.innerHeight - below > 180) tip = { top: below, left };
    else tip = { top: Math.max(12, spot.top - 190), left };
  } else {
    tip = { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000 }} role="dialog" aria-label="Guided tour">
      {spot ? (
        <div
          style={{
            position: 'fixed',
            top: spot.top,
            left: spot.left,
            width: spot.width,
            height: spot.height,
            borderRadius: 12,
            boxShadow: '0 0 0 9999px rgba(15,23,42,0.66)',
            border: `2px solid ${accent}`,
            pointerEvents: 'none',
            transition: 'all 0.2s ease',
          }}
        />
      ) : (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.66)' }} />
      )}

      <div
        style={{
          position: 'fixed',
          width: TIP_W,
          maxWidth: 'calc(100vw - 24px)',
          background: '#fff',
          borderRadius: 14,
          boxShadow: '0 12px 44px rgba(0,0,0,0.3)',
          padding: 18,
          ...tip,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: accent, letterSpacing: '0.03em' }}>
            STEP {i + 1} OF {steps.length}
          </span>
          <button type="button" onClick={onClose} aria-label="Close tour" style={{ color: '#94a3b8', lineHeight: 0 }}>
            <X size={16} />
          </button>
        </div>
        <h4 style={{ fontWeight: 700, fontSize: 17, marginBottom: 6, color: '#0f172a' }}>{step.title}</h4>
        <p style={{ fontSize: 14, lineHeight: 1.5, color: '#475569', marginBottom: 14 }}>{step.body}</p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button type="button" onClick={onClose} style={{ fontSize: 13, color: '#64748b' }}>
            Skip
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            {i > 0 && (
              <button
                type="button"
                onClick={() => setI(i - 1)}
                style={{ fontSize: 13, padding: '6px 12px', borderRadius: 8, border: '1px solid #e2e8f0', color: '#334155' }}
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={() => (last ? onClose() : setI(i + 1))}
              style={{
                fontSize: 13,
                padding: '6px 16px',
                borderRadius: 8,
                background: accent,
                color: '#fff',
                fontWeight: 600,
              }}
            >
              {last ? 'Done' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
