import { useState, useCallback, useEffect, useRef } from 'react';

interface PlaybackState {
  currentTime: number;
  isPlaying: boolean;
  playbackSpeed: number;
}

interface PlaybackControls {
  play: () => void;
  pause: () => void;
  toggle: () => void;
  setTime: (time: number) => void;
  setSpeed: (speed: number) => void;
}

export function usePlayback(
  startTime: number,
  endTime: number
): [PlaybackState, PlaybackControls] {
  const [currentTime, setCurrentTime] = useState(startTime);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  const lastUpdateRef = useRef<number>(0);

  // Animation loop
  useEffect(() => {
    if (!isPlaying) return;

    let animationFrame: number;
    lastUpdateRef.current = performance.now();

    const animate = (now: number) => {
      const delta = now - lastUpdateRef.current;
      lastUpdateRef.current = now;

      // Convert real milliseconds to simulation minutes
      // 1 second real time = 1 minute simulation time * playbackSpeed
      const simulationDelta = (delta / 1000) * playbackSpeed;

      setCurrentTime((prev) => {
        const next = prev + simulationDelta;
        if (next >= endTime) {
          setIsPlaying(false);
          return endTime;
        }
        return next;
      });

      animationFrame = requestAnimationFrame(animate);
    };

    animationFrame = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrame);
    };
  }, [isPlaying, playbackSpeed, endTime]);

  const play = useCallback(() => {
    if (currentTime >= endTime) {
      setCurrentTime(startTime);
    }
    setIsPlaying(true);
  }, [currentTime, endTime, startTime]);

  const pause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const toggle = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);

  const setTime = useCallback(
    (time: number) => {
      setCurrentTime(Math.max(startTime, Math.min(endTime, time)));
    },
    [startTime, endTime]
  );

  const setSpeed = useCallback((speed: number) => {
    setPlaybackSpeed(speed);
  }, []);

  return [
    { currentTime, isPlaying, playbackSpeed },
    { play, pause, toggle, setTime, setSpeed },
  ];
}
