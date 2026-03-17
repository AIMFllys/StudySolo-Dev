'use client';

import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { initCrossTabSync } from '@/services/auth.service';
import {
  subscribeToAuthSessionSync,
  syncBrowserSessionToBackend,
} from '@/services/auth-session.service';

const AUTH_PAGES = new Set(['/login', '/register', '/forgot-password', '/reset-password']);

export function AuthSessionBridge() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [isSyncing, setIsSyncing] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);

  // Global cross-tab sync listeners (only run once)
  useEffect(() => {
    const disposeCrossTabSync = initCrossTabSync();
    const disposeSessionSync = subscribeToAuthSessionSync();

    return () => {
      disposeCrossTabSync();
      disposeSessionSync();
    };
  }, []);

  // Boot sequence per auth page navigation
  useEffect(() => {
    if (!pathname || !AUTH_PAGES.has(pathname)) {
      setTimeout(() => setIsSyncing(false), 0);
      return;
    }

    let mounted = true;

    const addLog = (msg: string) => {
      if (mounted) setLogs((prev) => [...prev, msg]);
    };

    void (async () => {
      if (!mounted) return;
      setLogs([]);
      setIsSyncing(true);
      setProgress(10);

      addLog('INIT_SESSION_SYNC...');
      await new Promise((res) => setTimeout(res, 200));
      setProgress(30);
      addLog('CHECKING_CREDENTIALS...');

      const restored = await syncBrowserSessionToBackend();

      if (!mounted) return;

      if (!restored) {
        setProgress(100);
        addLog('NO_SESSION_FOUND');
        addLog('SYSTEM_READY');
        await new Promise((res) => setTimeout(res, 400));
        if (mounted) setIsSyncing(false);
        return;
      }

      setProgress(80);
      addLog('AUTHORIZATION_GRANTED');
      await new Promise((res) => setTimeout(res, 200));

      setProgress(100);
      addLog('ROUTING_TO_WORKSPACE...');
      await new Promise((res) => setTimeout(res, 300));

      if (mounted) {
        const next = searchParams?.get('next');
        window.location.replace(next || '/workspace');
      }
    })();

    return () => {
      mounted = false;
    };
  }, [pathname, searchParams]);

  return (
    <AnimatePresence>
      {isSyncing && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[9999] bg-[#070707] flex flex-col items-center justify-center font-mono pointer-events-none"
        >
          {/* Blueprint Grid Background */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />

          <div className="w-full max-w-md p-8 flex flex-col gap-6 border border-white/10 bg-black/80 relative overflow-hidden backdrop-blur-sm shadow-[0_0_30px_rgba(163,230,53,0.05)]">
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-lime-400/50 to-transparent" />

            <div className="flex items-center justify-between text-xs tracking-widest uppercase border-b border-white/10 pb-4">
              <span className="text-lime-400">SYS.AUTH_BRIDGE</span>
              <div className="flex items-center gap-2">
                <span className="text-white/40">v1.0</span>
                <div className="w-2 h-2 bg-lime-400 animate-pulse" />
              </div>
            </div>

            <div className="flex flex-col gap-2 min-h-[120px] text-sm">
              {logs.map((log, i) => {
                const isSuccess =
                  log.includes('GRANTED') ||
                  log.includes('ROUTING') ||
                  log.includes('READY');
                const isError = log.includes('NO_SESSION');

                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2 }}
                    className={`flex items-start gap-3 ${
                      isSuccess
                        ? 'text-lime-400'
                        : isError
                        ? 'text-white/40'
                        : 'text-white/80'
                    }`}
                  >
                    <span className="opacity-50 mt-[2px]">&gt;</span>
                    <span className="tracking-wide">{log}</span>
                  </motion.div>
                );
              })}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1, 0] }}
                transition={{ repeat: Infinity, duration: 1 }}
                className="w-2 h-4 bg-lime-400/80 mt-1 ml-4"
              />
            </div>

            <div className="mt-4 flex flex-col gap-2">
              <div className="flex justify-between text-[10px] text-white/40 uppercase tracking-widest">
                <span>PROGRESS</span>
                <span>{progress}%</span>
              </div>
              <div className="h-[2px] w-full bg-white/10 relative overflow-hidden">
                <motion.div
                  className="absolute inset-y-0 left-0 bg-lime-400"
                  initial={{ width: '0%' }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                />
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
