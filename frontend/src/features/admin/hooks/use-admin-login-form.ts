'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminLogin } from '@/services/admin.service';
import { useAdminStore } from '@/stores/admin/use-admin-store';

const LOCK_FAILS_KEY = 'admin_lock_fails';
const LOCK_WINDOW_MS = 3 * 60 * 1000;
const LOCK_LIMIT = 5;

function loadRecentFails() {
  const now = Date.now();
  const fails = JSON.parse(localStorage.getItem(LOCK_FAILS_KEY) || '[]') as number[];
  const recentFails = fails.filter((timestamp) => now - timestamp < LOCK_WINDOW_MS);
  localStorage.setItem(LOCK_FAILS_KEY, JSON.stringify(recentFails));
  return recentFails;
}

export function useAdminLoginForm() {
  const router = useRouter();
  const { setAdmin } = useAdminStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [keepSession, setKeepSession] = useState(false);

  useEffect(() => {
    try {
      if (loadRecentFails().length >= LOCK_LIMIT) {
        window.location.replace('/404');
      }
    } catch {
      // Ignore malformed storage payloads.
    }
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      const data = await adminLogin(username, password);
      localStorage.removeItem(LOCK_FAILS_KEY);
      setAdmin(data.admin);
      router.push(data.admin.force_change_password ? '/admin-analysis/change-password' : '/admin-analysis');
    } catch {
      const fails = JSON.parse(localStorage.getItem(LOCK_FAILS_KEY) || '[]') as number[];
      fails.push(Date.now());
      localStorage.setItem(LOCK_FAILS_KEY, JSON.stringify(fails));
      window.location.replace('/404');
    } finally {
      setLoading(false);
    }
  };

  return {
    username,
    setUsername,
    password,
    setPassword,
    showPassword,
    setShowPassword,
    loading,
    keepSession,
    setKeepSession,
    handleSubmit,
  };
}
