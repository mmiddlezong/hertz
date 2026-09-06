'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  AudioLines,
  Headphones,
  RotateCcw,
  Settings2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { randomFrequency, scoreRound, type Result } from '@/lib/game';

const ROUNDS = 5;
type Phase = 'ready' | 'countdown' | 'playing' | 'result' | 'done';

function Signal({ active }: { active: boolean }) {
  return (
    <div className={`signal-art ${active ? 'moving' : ''}`} aria-hidden="true">
      <svg viewBox="0 0 400 600" preserveAspectRatio="none">
        <defs>
          <linearGradient id="signal-color" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#35e1c5" />
            <stop offset=".5" stopColor="#8176ec" />
            <stop offset="1" stopColor="#45bfdf" />
          </linearGradient>
        </defs>
        {Array.from({ length: 18 }, (_, line) => (
          <path
            key={line}
            d={Array.from({ length: 151 }, (_, i) => {
              const y = i * 4;
              const x =
                218 +
                Math.sin(y / 49 + line * 0.085) *
                  (22 + 42 * Math.sin(y / 113) ** 2) +
                (line - 9) * 2;
              return `${i ? 'L' : 'M'}${x.toFixed(2)},${y}`;
            }).join(' ')}
          />
        ))}
      </svg>
    </div>
  );
}

export default function Home() {
  const [phase, setPhase] = useState<Phase>('ready');
  const [seconds, setSeconds] = useState(10);
  const [volume, setVolume] = useState(20);
  const [muted, setMuted] = useState(false);
  const [remaining, setRemaining] = useState(10);
  const [guess, setGuess] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);
  const context = useRef<AudioContext | null>(null);
  const voice = useRef<{ oscillator: OscillatorNode; gain: GainNode } | null>(
    null,
  );
  const current = useRef<{ target: number; deadline: number } | null>(null);
  const countdown = useRef<ReturnType<typeof setTimeout> | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const nextButton = useRef<HTMLButtonElement>(null);
  const busy = useRef(false);
  const audioLevel = useRef(0.04);
  const mounted = useRef(true);
  const total = results.reduce((sum, r) => sum + r.points, 0);
  const last = results.at(-1);
  const playing = phase === 'playing';
  const inRound = playing || phase === 'countdown';
  const roundNumber = Math.min(
    results.length + (phase === 'result' || phase === 'done' ? 0 : 1),
    ROUNDS,
  );

  function stop() {
    if (voice.current && context.current) {
      const { oscillator, gain } = voice.current;
      const now = context.current.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setTargetAtTime(0, now, 0.01);
      try {
        oscillator.stop(now + 0.06);
      } catch {
        /* The scheduled stop may have run. */
      }
      voice.current = null;
    }
  }
  function finish(answer: number | null) {
    const round = current.current;
    if (!round) return;
    const result = scoreRound(
      round.target,
      answer,
      round.deadline,
      performance.now(),
    );
    current.current = null;
    stop();
    setResults((prev) => [...prev, result]);
    setPhase('result');
    setRemaining(0);
  }
  async function start(reset = false) {
    if (busy.current || current.current || countdown.current) return;
    busy.current = true;
    setStarting(true);
    setError('');
    try {
      const ctx =
        context.current?.state === 'closed' || !context.current
          ? new AudioContext()
          : context.current;
      context.current = ctx;
      await ctx.resume();
      if (!mounted.current) {
        void ctx.close();
        return;
      }
      if (ctx.state !== 'running')
        throw new Error('Audio did not start. Please try again.');
      stop();
      if (reset) setResults([]);
      setGuess('');
      setRemaining(seconds);
      setPhase('countdown');
      countdown.current = setTimeout(() => {
        countdown.current = null;
        if (!mounted.current) return;
        try {
          const target = randomFrequency();
          const oscillator = ctx.createOscillator();
          const gain = ctx.createGain();
          oscillator.type = 'sine';
          oscillator.frequency.value = target;
          gain.gain.setValueAtTime(0, ctx.currentTime);
          gain.gain.linearRampToValueAtTime(
            audioLevel.current,
            ctx.currentTime + 0.03,
          );
          gain.gain.setTargetAtTime(0, ctx.currentTime + seconds, 0.01);
          oscillator.connect(gain);
          gain.connect(ctx.destination);
          oscillator.start();
          oscillator.stop(ctx.currentTime + seconds + 0.07);
          voice.current = { oscillator, gain };
          oscillator.onended = () => {
            oscillator.disconnect();
            gain.disconnect();
          };
          current.current = {
            target,
            deadline: performance.now() + seconds * 1000,
          };
          setPhase('playing');
        } catch {
          stop();
          setError('Could not play the tone. Please try again.');
          setPhase('ready');
        }
      }, 1200);
    } catch (e) {
      stop();
      setError(
        e instanceof Error
          ? e.message
          : 'Audio is unavailable in this browser.',
      );
    } finally {
      busy.current = false;
      if (mounted.current) setStarting(false);
    }
  }
  useEffect(() => {
    if (phase !== 'playing') return;
    input.current?.focus();
    const timer = window.setInterval(() => {
      if (!current.current) return;
      const left = Math.max(
        0,
        (current.current.deadline - performance.now()) / 1000,
      );
      setRemaining(left);
      if (left === 0) finish(null);
    }, 40);
    return () => clearInterval(timer);
  }, [phase]);
  useEffect(() => {
    if (phase === 'result' || phase === 'done') nextButton.current?.focus();
  }, [phase]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      current.current = null;
      if (countdown.current) clearTimeout(countdown.current);
      stop();
      void context.current?.close();
    };
  }, []);
  useEffect(() => {
    audioLevel.current = muted ? 0 : (volume / 100) * 0.2;
    if (voice.current && context.current)
      voice.current.gain.gain.setTargetAtTime(
        audioLevel.current,
        context.current.currentTime,
        0.02,
      );
  }, [volume, muted]);

  return (
    <main className="site-shell">
      <header className="site-header">
        <div className="wordmark">
          <AudioLines size={20} />
          <span>hertz.</span>
        </div>
        <span className="nav-current">frequency</span>
        <div className="header-actions">
          <button
            className="icon-button"
            onClick={() => setMuted(!muted)}
            aria-label={muted ? 'Unmute sound' : 'Mute sound'}
          >
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          <Dialog>
            <DialogTrigger
              className="icon-button"
              disabled={inRound || starting}
              aria-label="Game settings"
            >
              <Settings2 size={18} />
            </DialogTrigger>
            <DialogContent className="settings-dialog">
              <DialogTitle>Make it your tempo.</DialogTitle>
              <DialogDescription>
                Five tones, from 100 to 1,000 Hz. Choose how long you get to
                name each one.
              </DialogDescription>
              <div className="setting-label">
                <span id="time-label">Time per tone</span>
                <b>{seconds}s</b>
              </div>
              <Slider
                aria-labelledby="time-label"
                min={5}
                max={30}
                step={5}
                value={[seconds]}
                onValueChange={(v) => setSeconds(Array.isArray(v) ? v[0] : v)}
              />
              <div className="slider-endpoints">
                <span>5s · quick</span>
                <span>30s · take your time</span>
              </div>
              <div className="setting-label">
                <span id="volume-label">Volume</span>
                <b>{volume}%</b>
              </div>
              <Slider
                aria-labelledby="volume-label"
                min={0}
                max={100}
                value={[volume]}
                onValueChange={(v) => setVolume(Array.isArray(v) ? v[0] : v)}
              />
              <p className="settings-footnote">
                An exact guess earns 1,000 points. One semitone off earns 368.
                Late answers earn zero.
              </p>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <div className="game-stage">
        <section
          className={`game-card phase-${phase}`}
          aria-label="Frequency guessing game"
        >
          {phase !== 'countdown' && phase !== 'done' && (
            <Signal active={playing} />
          )}
          {phase === 'ready' ? (
            <div className="card-screen intro-screen">
              <div>
                <h1>hertz.</h1>
                <p>
                  You know the pitch.
                  <br />
                  But do you know the number?
                </p>
                <p>
                  Five pure tones. Type the frequency in hertz before time runs
                  out.
                </p>
              </div>
              <div className="start-area">
                <div className="headphones">
                  <Headphones size={16} />
                  <span>Headphones on. Trust your ears.</span>
                </div>
                <div className="start-row">
                  <button
                    className="round-button"
                    aria-label="Start game"
                    onClick={() => start(true)}
                    disabled={starting}
                  >
                    <ArrowRight size={24} />
                  </button>
                  <span>
                    {starting ? 'Starting audio…' : 'Let’s hear it.'}
                    <small>{seconds} seconds per tone</small>
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="card-screen">
              <div className="card-topline">
                <span>
                  {roundNumber} / {ROUNDS}
                </span>
                <span>hertz.</span>
              </div>
              {phase === 'countdown' && (
                <output className="countdown-word" aria-live="polite">
                  ready<span>Listen closely.</span>
                </output>
              )}
              {playing && (
                <form
                  className="play-screen"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const n = Number(guess);
                    if (Number.isFinite(n) && n > 0 && n <= 20000) finish(n);
                  }}
                >
                  <div
                    className={`time-block ${remaining < 3 ? 'urgent' : ''}`}
                  >
                    <span className="big-time">{remaining.toFixed(1)}</span>
                    <span className="time-caption">seconds left</span>
                    <Progress
                      value={(remaining / seconds) * 100}
                      aria-label="Time remaining"
                    />
                  </div>
                  <div className="guess-area">
                    <label htmlFor="frequency">What do you hear?</label>
                    <div className="guess-row">
                      <div className="input-wrap">
                        <input
                          ref={input}
                          id="frequency"
                          aria-label="Frequency in hertz"
                          type="number"
                          inputMode="decimal"
                          min=".01"
                          max="20000"
                          step="any"
                          required
                          value={guess}
                          onChange={(e) => setGuess(e.target.value)}
                          placeholder="?"
                          autoComplete="off"
                        />
                        <span>Hz</span>
                      </div>
                      <button
                        type="submit"
                        className="round-button"
                        aria-label="Submit guess"
                      >
                        <ArrowRight size={23} />
                      </button>
                    </div>
                    <p className="input-hint">
                      Type your guess, then press Enter.
                    </p>
                  </div>
                </form>
              )}
              {phase === 'result' && last && (
                <div className="reveal-screen">
                  <div className="round-score" aria-live="polite">
                    <div>
                      {last.points}
                      <span> / 1,000</span>
                    </div>
                    <p>
                      {last.guess === null
                        ? 'Time slipped away.'
                        : last.points === 1000
                          ? 'Right on frequency.'
                          : last.points >= 700
                            ? 'You’ve got an ear for this.'
                            : last.points >= 300
                              ? 'Getting warmer.'
                              : 'A little out of tune.'}
                    </p>
                  </div>
                  <div className="reveal-bottom">
                    <div className="target-answer">
                      <span className="tiny-label">ACTUAL FREQUENCY</span>
                      <div>
                        {last.target}
                        <small>Hz</small>
                      </div>
                    </div>
                    <span className="tiny-label">YOUR GUESS</span>
                    <div className="guess-row">
                      <div className="your-answer">
                        {last.guess === null ? '—' : last.guess}
                        <small>Hz</small>
                      </div>
                      <button
                        ref={nextButton}
                        className="round-button"
                        disabled={starting}
                        aria-label={
                          results.length === ROUNDS
                            ? 'See final score'
                            : 'Next round'
                        }
                        onClick={() =>
                          results.length === ROUNDS ? setPhase('done') : start()
                        }
                      >
                        <ArrowRight size={23} />
                      </button>
                    </div>
                    <p className="input-hint">
                      {last.cents === null
                        ? 'No guess this round'
                        : last.cents === 0
                          ? 'Exactly right'
                          : `${Math.abs(last.cents).toFixed(1)} cents ${last.cents > 0 ? 'sharp' : 'flat'}`}
                      <span>
                        {results.length === ROUNDS
                          ? 'Final score'
                          : 'Next round'}
                      </span>
                    </p>
                  </div>
                </div>
              )}
              {phase === 'done' && (
                <div className="summary-screen">
                  <div className="final-heading">
                    <h2>good ear?</h2>
                    <p>Let the numbers speak.</p>
                  </div>
                  <div className="final-score">
                    {total.toLocaleString()}
                    <span>/ 5,000</span>
                  </div>
                  <ol className="summary-list">
                    {results.map((r, i) => (
                      <li key={i}>
                        <span className="summary-number">{i + 1}</span>
                        <div>
                          <b>{r.target} Hz</b>
                          <span>
                            {r.guess === null
                              ? 'Timed out'
                              : `You: ${r.guess} Hz`}
                          </span>
                        </div>
                        <strong>{r.points}</strong>
                      </li>
                    ))}
                  </ol>
                  <div className="summary-action">
                    <span>Another five?</span>
                    <button
                      ref={nextButton}
                      className="round-button"
                      aria-label="Play again"
                      onClick={() => start(true)}
                      disabled={starting}
                    >
                      <RotateCcw size={21} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          {error && (
            <p role="alert" className="audio-error">
              {error}
            </p>
          )}
        </section>
        <p className="stage-caption">
          {phase === 'ready'
            ? 'A little test of absolute pitch.'
            : phase === 'done'
              ? 'Every tone is a fresh start.'
              : muted
                ? 'Sound is muted. Unmute above to hear the tone.'
                : 'No notes. Just hertz.'}
        </p>
      </div>
      <footer className="site-footer">
        <span>100–1,000 Hz</span>
        <span>Pure sine. Pure instinct.</span>
      </footer>
    </main>
  );
}
