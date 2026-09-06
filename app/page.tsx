'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowRight, AudioLines, Headphones, Volume2, RotateCcw } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';

import { randomFrequency, scoreRound, type Result } from '@/lib/game';
export default function Home() {
  const [phase, setPhase] = useState<'ready' | 'playing' | 'result' | 'done'>('ready');
  const [seconds, setSeconds] = useState(10);
  const [volume, setVolume] = useState(20);
  const [remaining, setRemaining] = useState(10);
  const [guess, setGuess] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);
  const context = useRef<AudioContext | null>(null);
  const voice = useRef<{ oscillator: OscillatorNode; gain: GainNode } | null>(null);
  const current = useRef<{ target: number; deadline: number } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const total = results.reduce((sum, r) => sum + r.points, 0);
  const last = results.at(-1);
  function stop() {
    if (voice.current && context.current) {
      const { oscillator, gain } = voice.current;
      const now = context.current.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setTargetAtTime(0, now, 0.01);
      try { oscillator.stop(now + 0.06); } catch { /* Already stopped at deadline. */ }
      voice.current = null;
    }
  }
  function finish(answer: number | null) {
    const round = current.current;
    if (!round) return;
    current.current = null;
    stop();
    const result = scoreRound(round.target, answer, round.deadline, performance.now());
    setResults(prev => [...prev, result]);
    setPhase('result');
    setRemaining(0);
  }
  async function start(reset = false) {
    if (starting || current.current) return;
    setStarting(true); setError('');
    try {
      const ctx = context.current ?? new AudioContext(); context.current = ctx;
      await ctx.resume();
      if (ctx.state !== 'running') throw new Error('Audio did not start. Try again.');
      stop();
      const target = randomFrequency();
      const oscillator = ctx.createOscillator(); const gain = ctx.createGain();
      oscillator.type = 'sine'; oscillator.frequency.value = target;
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(volume / 100 * 0.2, ctx.currentTime + 0.03);
      gain.gain.setTargetAtTime(0, ctx.currentTime + seconds, 0.01);
      oscillator.connect(gain); gain.connect(ctx.destination);
      oscillator.start(); oscillator.stop(ctx.currentTime + seconds + 0.07);
      voice.current = { oscillator, gain };
      current.current = { target, deadline: performance.now() + seconds * 1000 };
      if (reset) setResults([]);
      setGuess(''); setRemaining(seconds); setPhase('playing');
      requestAnimationFrame(() => input.current?.focus());
    } catch (e) { stop(); setError(e instanceof Error ? e.message : 'Audio unavailable. Try a different browser.'); }
    finally { setStarting(false); }
  }
  useEffect(() => {
    if (phase !== 'playing') return;
    const timer = window.setInterval(() => {
      if (!current.current) return;
      const left = Math.max(0, (current.current.deadline - performance.now()) / 1000);
      setRemaining(left);
      if (left === 0) finish(null);
    }, 40);
    return () => clearInterval(timer);
  }, [phase]);
  useEffect(() => () => { current.current = null; stop(); void context.current?.close(); }, []);
  useEffect(() => {
    if (voice.current && context.current) {
      voice.current.gain.gain.setTargetAtTime(volume / 100 * 0.2, context.current.currentTime, 0.02);
    }
  }, [volume]);
  const playing = phase === 'playing';
  return <main>
    <header><div className="brand"><AudioLines size={28} /><span>hertz<span className="brand-dot">.</span></span></div><span className="edition">THE FREQUENCY CHALLENGE <span>001</span></span></header>
    <div className="intro"><div><div className="eyebrow"><span className="status-dot"/> AN EAR FOR THE EXACT</div><h1>How precise is your pitch?</h1><p>Listen to the sine wave. Name its frequency before the clock runs out.</p></div><div className="headphone-note"><Headphones size={20}/><span>Headphones on.<br/>Trust your ears.</span></div></div>
    <div className="workspace"><section className="instrument" aria-label="Frequency game">
      <div className="instrument-top"><span className="eyebrow">PURE SINE / 100–1,000 HZ</span><span className={'signal ' + (playing ? 'live' : '')}><i/>{playing ? 'SIGNAL LIVE' : 'STANDBY'}</span></div>
      <div className={'scope ' + (playing ? 'active' : '')} aria-hidden="true"><div className="scope-cross"/><svg viewBox="0 0 800 180" preserveAspectRatio="none"><path d="M-200 90 Q-150 -50 -100 90 T0 90 T100 90 T200 90 T300 90 T400 90 T500 90 T600 90 T700 90 T800 90 T900 90 T1000 90"/></svg><span className="scope-label">{playing ? 'LISTENING IS EVERYTHING' : 'READY WHEN YOU ARE'}</span></div>
      <div className="play-content">
        <div className="round-line"><span>ROUND <b>{String(Math.min(results.length + (phase === 'result' || phase === 'done' ? 0 : 1), 10)).padStart(2, '0')}</b> / 10</span><span className={playing && remaining < 3 ? 'urgent' : ''}>{playing ? remaining.toFixed(1) : seconds.toFixed(1)} <span className="subtle">SEC</span></span></div>
        <Progress value={playing ? remaining / seconds * 100 : phase === 'ready' ? 100 : 0} aria-label="Time remaining" />
        {phase === 'ready' && <div className="ready"><h2>A frequency. A feeling.<br/>Your best guess.</h2><p>10 tones. Up to 1,000 points each.<br/>The closer your pitch, the higher your score.</p><button className="primary" onClick={() => start(true)} disabled={starting}>{starting ? 'Starting audio…' : 'Start listening'}<ArrowRight size={20}/></button></div>}
        {playing && <form onSubmit={e => { e.preventDefault(); const n = Number(guess); if (Number.isFinite(n) && n > 0 && n <= 20000) finish(n); }}><label htmlFor="frequency">What frequency do you hear?</label><div className="frequency-input"><input ref={input} id="frequency" type="number" inputMode="decimal" min="0.01" max="20000" step="any" required value={guess} onChange={e => setGuess(e.target.value)} placeholder="440" autoComplete="off"/><span>Hz</span></div><button className="primary" type="submit">Lock in guess<ArrowRight size={20}/></button><p className="hint">Press Enter to submit · Tone plays until you answer</p></form>}
        {phase === 'result' && last && <div className="result" aria-live="polite"><span className="eyebrow">{last.guess === null ? 'TIME’S UP' : last.points >= 900 ? 'EXCEPTIONAL EAR' : last.points >= 500 ? 'NICELY HEARD' : 'KEEP LISTENING'}</span><div className="answer">{last.target}<span> Hz</span></div><p>{last.guess === null ? 'No answer this round.' : `You guessed ${last.guess} Hz · ${Math.abs(last.cents!).toFixed(1)} cents ${last.cents! >= 0 ? 'sharp' : 'flat'}`}</p><div className="points">+{last.points} points</div><button className="primary" disabled={starting} onClick={() => results.length === 10 ? setPhase('done') : start()}>{results.length === 10 ? 'See final score' : 'Next tone'}<ArrowRight size={20}/></button></div>}
        {phase === 'done' && <div className="result" aria-live="polite"><span className="eyebrow">SESSION COMPLETE</span><div className="answer">{total.toLocaleString()}</div><p>out of 10,000 points · {Math.round(total / 10)} average per tone</p><button className="primary" onClick={() => start(true)} disabled={starting}>Play again<RotateCcw size={18}/></button></div>}
        {error && <p role="alert" className="error">{error}</p>}
      </div>
      <div className="instrument-bottom"><span><Volume2 size={17}/> VOLUME</span><Slider aria-label="Volume" min={0} max={100} value={[volume]} onValueChange={v => setVolume(Array.isArray(v) ? v[0] : v)} /><span>{volume}%</span></div>
    </section>
    <aside><section className="settings"><div className="eyebrow">YOUR SESSION</div><div className="score">{total.toLocaleString()}<span> / 10,000</span></div><p className="subtle">Total points</p><div className="divider"/><div className="setting-heading"><span id="time-label">Time per tone</span><span>{seconds}s</span></div><Slider aria-labelledby="time-label" min={5} max={30} step={5} value={[seconds]} disabled={phase !== 'ready' && phase !== 'done'} onValueChange={v => setSeconds(Array.isArray(v) ? v[0] : v)} /><div className="range-labels"><span>5s · Quick</span><span>30s · Unhurried</span></div><div className="setting-row"><span>Frequency range</span><b>100–1,000 Hz</b></div><div className="setting-row"><span>Waveform</span><b>Sine</b></div></section>
    <section className="history"><div className="eyebrow">ROUND LOG <span>{String(results.length).padStart(2, '0')} / 10</span></div>{!results.length ? <div className="empty"><AudioLines size={26}/><p>A clean slate.</p><span>Your guesses will land here.</span></div> : <ol>{results.map((r,i) => <li key={i}><span className="log-number">{String(i+1).padStart(2,'0')}</span><div><b>{r.target} Hz</b><span>{r.guess === null ? 'Timed out' : `Guessed ${r.guess} Hz`}</span></div><strong>+{r.points}</strong></li>)}</ol>}</section>
    <p className="scoring-note">Scored by pitch distance in cents. Exact is 1,000; one semitone off is 368. Frequencies are random, not limited to musical notes.</p></aside></div>
    <footer><span>NO NOTES. JUST HERTZ.</span><span>Listen closely. Guess precisely.</span></footer>
  </main>;
}
