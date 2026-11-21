import { useEffect, useMemo, useState } from 'react';
import { AudioLines, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Disc3, Maximize2, Pause, Play, Settings2, Sparkles, Volume2 } from 'lucide-react';
import { DEMO_LYRICS, DEMO_TRACK, getDemoState, type LyricState } from '@verseglow/engine';
import { STYLE_CATALOG } from '@verseglow/styles';

const APP_NAME = 'VerseGlow';
const styles = ['Fisheye', 'Constellation', 'Messages', 'Karaoke Sweep'];

export default function App() {
  const [position, setPosition] = useState(2600);
  const [playing, setPlaying] = useState(true);
  const [style, setStyle] = useState('Constellation');
  const [showMenu, setShowMenu] = useState(false);
  const state: LyricState = useMemo(() => getDemoState(position, playing ? 'playing' : 'paused'), [position, playing]);
  const line = state.activeLineIndex >= 0 ? DEMO_LYRICS[state.activeLineIndex] : undefined;

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => setPosition((current) => (current + 40) % DEMO_TRACK.durationMs), 40);
    return () => window.clearInterval(timer);
  }, [playing]);

  const stepStyle = (direction: number) => {
    const index = styles.indexOf(style);
    setStyle(styles[(index + direction + styles.length) % styles.length]);
  };

  return (
    <main className="wallpaper" aria-label={`${APP_NAME} live lyrics wallpaper`}>
      <div className="aurora aurora-one" />
      <div className="aurora aurora-two" />
      <div className="grain" />
      <header className="topbar">
        <div className="brand"><span className="brand-mark"><AudioLines size={17} /></span><span>{APP_NAME}</span><span className="live-dot" /> <span className="demo-label">DEMO</span></div>
        <nav className="glass-nav" aria-label="Main controls">
          <button className="nav-item active"><Sparkles size={14} /> Scene</button>
          <button className="nav-item" onClick={() => setShowMenu(!showMenu)}>Styles <ChevronDown size={13} /></button>
          <button className="nav-item"><Disc3 size={14} /> Displays</button>
          <button className="nav-item"><Settings2 size={14} /> Settings</button>
        </nav>
        <div className="top-actions"><button className="icon-button" aria-label="Help"><CircleHelp size={17} /></button><button className="icon-button" aria-label="Toggle fullscreen"><Maximize2 size={16} /></button></div>
      </header>
      {showMenu && <div className="style-popover">{styles.map((item) => <button key={item} className={style === item ? 'chosen' : ''} onClick={() => { setStyle(item); setShowMenu(false); }}>{item}<span>{STYLE_CATALOG.find((meta) => meta.name === item)?.group}</span></button>)}</div>}
      <section className="scene-content">
        <div className="eyebrow"><span className="eyebrow-line" /> LIVE SCENE <span className="eyebrow-divider">/</span> {style.toUpperCase()}</div>
        <div className="lyric-scene" key={style}>
          <button className="side-arrow" aria-label="Previous style" onClick={() => stepStyle(-1)}><ChevronLeft size={20} /></button>
          {style === 'Constellation' ? <ConstellationView state={state} /> : <div className={`lyric-treatment ${style.toLowerCase().replaceAll(' ', '-')}`}>
            {line?.words.map((word, index) => {
              const phase = position >= word.startMs ? (position <= word.endMs ? 'active' : 'settled') : (word.startMs - position < 150 ? 'ghost' : 'hidden');
              return <span key={`${state.activeLineIndex}-${index}`} className={`lyric-word ${phase}`} style={{ '--word-index': index } as React.CSSProperties}>{word.text}</span>;
            })}
          </div>}
          <button className="side-arrow" aria-label="Next style" onClick={() => stepStyle(1)}><ChevronRight size={20} /></button>
        </div>
        <div className="track-meta"><span className="track-kicker"><span className="sound-wave"><i/><i/><i/><i/></span> NOW PLAYING</span><h1>{DEMO_TRACK.title}</h1><p>{DEMO_TRACK.artist}<span className="meta-dot">·</span>{DEMO_TRACK.album}</p></div>
      </section>
      <footer className="bottom-dock">
        <div className="dock-left"><button className="cover-art" aria-label="Demo album artwork"><span className="cover-moon"/><span className="cover-horizon"/><span className="cover-title">little<br/>lights</span></button><div className="dock-track"><strong>{DEMO_TRACK.title}</strong><span>{DEMO_TRACK.artist}</span></div></div>
        <div className="transport"><div className="transport-buttons"><button className="transport-side" onClick={() => setPosition(0)} aria-label="Restart demo"><ChevronLeft size={18}/></button><button className="play-button" onClick={() => setPlaying(!playing)} aria-label={playing ? 'Pause demo' : 'Play demo'}>{playing ? <Pause size={17} fill="currentColor"/> : <Play size={17} fill="currentColor"/>}</button><button className="transport-side" onClick={() => setPosition((position + 4000) % DEMO_TRACK.durationMs)} aria-label="Skip ahead"><ChevronRight size={18}/></button></div><div className="progress-row"><span>{formatTime(position)}</span><input aria-label="Seek demo track" type="range" min="0" max={DEMO_TRACK.durationMs} value={position} onChange={(event) => setPosition(Number(event.target.value))}/><span>{formatTime(DEMO_TRACK.durationMs)}</span></div></div>
        <div className="dock-right"><div className="sync-badge"><span className="sync-pulse"/> Word synced</div><button className="icon-button volume-button" aria-label="Volume"><Volume2 size={16}/></button><div className="style-chip"><span className="chip-spark">✳</span>{style}<ChevronDown size={13}/></div></div>
      </footer>
      <div className="wallpaper-caption"><span className="caption-orbit"/><span>Let the music live here.</span><span className="caption-separator"/>A QUIETER KIND OF PLAYER</div>
    </main>
  );
}

function ConstellationView({ state }: { state: LyricState }) {
  const current = state.activeLineIndex >= 0 ? state.lines[state.activeLineIndex] : undefined;
  return <div className="constellation-view" aria-label="Constellation lyric style">
    <div className="constellation-orbit orbit-a"/><div className="constellation-orbit orbit-b"/>
    {current?.words.map((word, index) => {
      const count = current.words.length;
      const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
      const radiusX = count > 4 ? 27 : 20;
      const radiusY = 20;
      const x = 50 + Math.cos(angle) * radiusX;
      const y = 49 + Math.sin(angle) * radiusY;
      const active = index === state.activeWordIndex;
      const past = index < state.activeWordIndex;
      return <div key={`${state.activeLineIndex}-${index}`} className={`star-word ${active ? 'is-active' : ''} ${past ? 'is-past' : ''}`} style={{ left: `${x}%`, top: `${y}%`, '--i': index } as React.CSSProperties}>
        <span className="star-node">✦</span><span className="star-label">{word.text}</span>
      </div>;
    })}
    <div className="constellation-center"><span className="center-orb"/><span className="center-word">{current?.words[state.activeWordIndex]?.text ?? ''}</span></div>
  </div>;
}

function formatTime(value: number) {
  const seconds = Math.floor(value / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
