import React, { createContext, useContext, useState, useCallback } from 'react';

export interface FeatureFlags {
  simulateTransactionErrors: boolean;
  simulateAccountCreationErrors: boolean;
  simulateSlowNetwork: boolean;
  simulateCardDeclined: boolean;
  showMaintenanceBanner: boolean;
}

interface FeatureFlagContextType {
  flags: FeatureFlags;
  toggle: (flag: keyof FeatureFlags) => void;
  panelOpen: boolean;
  openPanel: () => void;
  closePanel: () => void;
  /**
   * Returns partial object with deliberately bad fields to merge into the
   * request body when the flag is active — null when flag is off.
   * The caller merges this so the HTTP request fails server-side (4xx).
   */
  getBadPayload: (flag: keyof FeatureFlags) => Record<string, unknown> | null;
  maybeDelay: () => Promise<void>;
}

const defaults: FeatureFlags = {
  simulateTransactionErrors: false,
  simulateAccountCreationErrors: false,
  simulateSlowNetwork: false,
  simulateCardDeclined: false,
  showMaintenanceBanner: false,
};

/** Bad payloads sent to the server so it returns 4xx */
const BAD_PAYLOADS: Record<keyof FeatureFlags, Record<string, unknown>> = {
  simulateTransactionErrors: {
    amount: -99999,
    accountId: '__FF_INVALID__',
  },
  simulateAccountCreationErrors: {
    accountType: 'INVALID_ACCOUNT_TYPE_FF',
  },
  simulateCardDeclined: {
    cardType: 'INVALID_CARD_TYPE_FF',
  },
  simulateSlowNetwork: {},
  showMaintenanceBanner: {},
};

const FeatureFlagContext = createContext<FeatureFlagContextType | null>(null);

export function FeatureFlagProvider({ children }: { children: React.ReactNode }) {
  const [flags, setFlags] = useState<FeatureFlags>(() => {
    try {
      const saved = localStorage.getItem('__ff__');
      return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
    } catch {
      return defaults;
    }
  });
  const [panelOpen, setPanelOpen] = useState(false);

  const toggle = useCallback((flag: keyof FeatureFlags) => {
    setFlags((prev) => {
      const next = { ...prev, [flag]: !prev[flag] };
      localStorage.setItem('__ff__', JSON.stringify(next));
      return next;
    });
  }, []);

  const getBadPayload = useCallback(
    (flag: keyof FeatureFlags): Record<string, unknown> | null => {
      if (!flags[flag]) return null;
      return BAD_PAYLOADS[flag] ?? null;
    },
    [flags]
  );

  const maybeDelay = useCallback(async () => {
    if (flags.simulateSlowNetwork) {
      await new Promise((r) => setTimeout(r, 2500 + Math.random() * 2000));
    }
  }, [flags.simulateSlowNetwork]);

  return (
    <FeatureFlagContext.Provider
      value={{
        flags,
        toggle,
        panelOpen,
        openPanel: () => setPanelOpen(true),
        closePanel: () => setPanelOpen(false),
        getBadPayload,
        maybeDelay,
      }}
    >
      {children}
    </FeatureFlagContext.Provider>
  );
}

export function useFeatureFlags() {
  const ctx = useContext(FeatureFlagContext);
  if (!ctx) throw new Error('useFeatureFlags must be used inside FeatureFlagProvider');
  return ctx;
}
