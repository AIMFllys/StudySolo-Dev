const STORAGE_KEY = 'studysolo:remembered-credentials';

type SavedCredentials = {
  email: string;
  remember: boolean;
  updatedAt: number;
};

function isBrowser() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function loadRememberedCredentials(): SavedCredentials | null {
  if (!isBrowser()) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<SavedCredentials>;
    if ('password' in parsed) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    if (!parsed.remember || !parsed.email) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return {
      email: parsed.email,
      remember: true,
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : Date.now(),
    };
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function saveRememberedCredentials(email: string) {
  if (!isBrowser()) {
    return;
  }

  const payload: SavedCredentials = {
    email,
    remember: true,
    updatedAt: Date.now(),
  };

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function clearRememberedCredentials() {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEY);
}
