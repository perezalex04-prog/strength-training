import { useState, useRef, useCallback, useEffect } from 'react';

export function useRestTimer(defaultSeconds: number = 180) {
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsRunning(false);
    setSecondsLeft(0);
  }, []);

  const start = useCallback((seconds?: number) => {
    stop();
    const duration = seconds ?? defaultSeconds;
    setSecondsLeft(duration);
    setIsRunning(true);

    intervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          stop();
          // Vibrate if available
          if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [defaultSeconds, stop]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const formatTime = (s: number) => {
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  return {
    secondsLeft,
    isRunning,
    formattedTime: formatTime(secondsLeft),
    start,
    stop,
  };
}
