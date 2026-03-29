'use client';

import { useEffect, useState, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { initCrossTabSync } from '@/services/auth.service';
import {
  subscribeToAuthSessionSync,
  syncBrowserSessionToBackend,
} from '@/services/auth-session.service';

const AUTH_PAGES = new Set(['/login', '/register', '/forgot-password', '/reset-password']);

function BridgeContent() {
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

      addLog('正在初始化环境...');
      await new Promise((res) => setTimeout(res, 200));
      setProgress(30);
      addLog('验证访问权限...');

      // OAuth flow (from /auth/callback) may need a brief delay for
      // Supabase client to pick up the session cookies set server-side.
      const isOAuth = searchParams?.get('oauth') === '1';
      let restored = false;

      if (isOAuth) {
        // Retry up to 3 times with increasing delay — gives Supabase
        // client time to hydrate the session from server-set cookies.
        for (let attempt = 0; attempt < 3 && !restored && mounted; attempt++) {
          if (attempt > 0) {
            await new Promise((res) => setTimeout(res, 500 * attempt));
          }
          restored = await syncBrowserSessionToBackend();
        }
      } else {
        restored = await syncBrowserSessionToBackend();
      }

      if (!mounted) return;

      if (!restored) {
        setProgress(100);
        addLog('未发现有效会话');
        addLog('系统准备就绪');
        await new Promise((res) => setTimeout(res, 400));
        if (mounted) setIsSyncing(false);
        return;
      }

      setProgress(80);
      addLog('权限验证通过');
      await new Promise((res) => setTimeout(res, 200));

      setProgress(100);
      addLog('正在进入个人工作台...');
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
           className="fixed inset-0 z-[9999] bg-[#fcfbf9] flex flex-col items-center justify-center pointer-events-none"
        >
          {/* Subtle Grid Background */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:1.5rem_1.5rem] opacity-50 pointer-events-none" />

          {/* Paper Margins */}
          <div className="fixed top-0 bottom-0 left-6 md:left-12 w-[2px] bg-red-400/20 z-0" />
          <div className="fixed top-0 bottom-0 left-[28px] md:left-[52px] w-px bg-red-400/20 z-0" />

          <div className="w-full max-w-sm p-8 flex flex-col gap-6 bg-white dark:bg-white/5 relative overflow-hidden backdrop-blur-sm shadow-xl rounded-xl border border-slate-200 dark:border-white/10 z-10">
            <div className="flex items-center justify-between text-sm border-b border-slate-100 pb-4">
              <span className="text-slate-700 dark:text-slate-300 font-medium">身份验证同步</span>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              </div>
            </div>

            <div className="flex flex-col gap-3 min-h-[120px] text-sm font-medium">
              {logs.map((log, i) => {
                const isSuccess =
                  log.includes('通过') ||
                  log.includes('进入') ||
                  log.includes('就绪');
                const isError = log.includes('未发现');

                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className={`flex items-start gap-3 ${
                      isSuccess
                        ? 'text-blue-600 dark:text-blue-400'
                        : isError
                        ? 'text-slate-400'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <span className="opacity-40 select-none">-</span>
                    <span className="tracking-wide">{log}</span>
                  </motion.div>
                );
              })}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1, 0] }}
                transition={{ repeat: Infinity, duration: 1 }}
                className="w-1.5 h-4 bg-blue-400 mt-1 ml-[22px] rounded-sm"
              />
            </div>

            <div className="mt-4 flex flex-col gap-2">
              <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 tracking-wider">
                <span>加载进度</span>
                <span>{progress}%</span>
              </div>
              <div className="h-1.5 w-full bg-slate-100 rounded-full relative overflow-hidden">
                <motion.div
                  className="absolute inset-y-0 left-0 bg-blue-500 rounded-full"
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

export function AuthSessionBridge() {
  return (
    <Suspense fallback={null}>
      <BridgeContent />
    </Suspense>
  );
}
