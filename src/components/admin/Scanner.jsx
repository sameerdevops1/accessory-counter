'use client';
import { useEffect, useRef, useState } from 'react';

let audioCtx = null;
function beep(ok) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'square';
    o.frequency.value = ok ? 1180 : 220;
    g.gain.value = 0.06;
    o.connect(g);
    g.connect(audioCtx.destination);
    o.start();
    o.stop(audioCtx.currentTime + (ok ? 0.09 : 0.22));
  } catch {}
}

/**
 * Live camera barcode scanner. It stays open and calls onScan(code) for every barcode it reads,
 * so a whole delivery or a whole basket can be scanned without reopening it.
 *
 * onScan returns { ok, msg } (or a string). The message shows on screen with a beep.
 * Hold a barcode in view and it counts once. Move it away for a second to count it again.
 * Set once to close after the first read (used for filling a single barcode field).
 * Needs https. Vercel and localhost both qualify.
 */
export default function Scanner({ onScan, onClose, title = 'Scan barcodes', once = false, children, doneLabel = 'Done' }) {
  const video = useRef(null);
  const [err, setErr] = useState('');
  const [flash, setFlash] = useState(null);
  const cb = useRef(onScan);
  cb.current = onScan;

  useEffect(() => {
    let stopped = false;
    let controls = null;
    const last = { code: '', seen: 0 };
    (async () => {
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser');
        const reader = new BrowserMultiFormatReader();
        controls = await reader.decodeFromConstraints(
          { video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } },
          video.current,
          (result) => {
            if (!result || stopped) return;
            const code = result.getText();
            const now = Date.now();
            const sameHold = code === last.code && now - last.seen < 1000;
            last.code = code;
            last.seen = now;
            if (sameHold) return;
            const r = cb.current(code);
            const res = typeof r === 'string' ? { ok: true, msg: r } : r || { ok: true, msg: code };
            setFlash({ ok: res.ok !== false, msg: res.msg || code, n: now });
            beep(res.ok !== false);
            try { navigator.vibrate?.(res.ok === false ? [80, 60, 80] : 50); } catch {}
            if (once) { stopped = true; controls?.stop(); }
          },
        );
        if (stopped) controls.stop();
      } catch {
        setErr('The camera is not available. Allow camera access in your browser settings, or type the code instead.');
      }
    })();
    return () => {
      stopped = true;
      controls?.stop();
    };
  }, [once]);

  return (
    <div className="scanner" role="dialog" aria-modal="true" aria-label={title}>
      <div className="sc-top">
        <h2>{title}</h2>
        <button type="button" className="btn sm" onClick={onClose}>{doneLabel}</button>
      </div>
      <div className="frame"><video ref={video} muted playsInline /></div>
      {err
        ? <div className="flash bad">{err}</div>
        : <div className={`flash ${flash && !flash.ok ? 'bad' : ''}`} aria-live="polite">{flash ? flash.msg : 'Point the camera at a barcode.'}</div>}
      {children && <div className="sc-body">{children}</div>}
    </div>
  );
}
