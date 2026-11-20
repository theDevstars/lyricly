import { useEffect, useRef, useState } from 'react';

interface SingAlong {
  /** Microphone level, 0..1. */
  level: number;
  /** Share of sung words the microphone heard, 0..1. */
  score: number;
  error: string | null;
}

const SILENT = { level: 0, score: 0, error: null } as SingAlong;

/**
 * Opt-in sing-along scoring. The microphone is only opened when asked for, the
 * stream never leaves the machine, and nothing is recorded or stored.
 */
export function useSingAlong(enabled: boolean, singing: boolean): SingAlong {
  const [state, setState] = useState<SingAlong>(SILENT);
  const levelRef = useRef(0);
  const singingRef = useRef(singing);
  singingRef.current = singing;

  useEffect(() => {
    if (!enabled) {
      setState(SILENT);
      return;
    }
    const media = navigator.mediaDevices;
    if (!media?.getUserMedia) {
      setState({ level: 0, score: 0, error: 'No microphone available' });
      return;
    }

    let context: AudioContext | null = null;
    let stream: MediaStream | null = null;
    let frame = 0;
    let total = 0;
    let heard = 0;
    let cancelled = false;

    const start = async () => {
      try {
        stream = await media.getUserMedia({ audio: true });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        context = new AudioContext();
        const source = context.createMediaStreamSource(stream);
        const analyser = context.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);
        const buffer = new Float32Array(analyser.fftSize);

        const tick = () => {
          frame = requestAnimationFrame(tick);
          analyser.getFloatTimeDomainData(buffer);
          let sum = 0;
          for (let index = 0; index < buffer.length; index += 1) sum += buffer[index] * buffer[index];
          const rms = Math.sqrt(sum / buffer.length);
          levelRef.current = Math.min(1, rms * 6);

          if (singingRef.current) {
            total += 1;
            if (levelRef.current > 0.06) heard += 1;
          }
          setState({
            level: levelRef.current,
            score: total > 0 ? heard / total : 0,
            error: null,
          });
        };
        tick();
      } catch (error) {
        setState({ level: 0, score: 0, error: String(error) });
      }
    };

    void start();

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
      void context?.close();
    };
  }, [enabled]);

  return state;
}
