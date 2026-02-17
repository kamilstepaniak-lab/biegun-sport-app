'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface SelectedChildContextType {
  selectedChildId: string | null;
  selectedChildName: string | null;
  setSelectedChild: (id: string | null, name: string | null) => void;
  clearSelectedChild: () => void;
}

const SelectedChildContext = createContext<SelectedChildContextType>({
  selectedChildId: null,
  selectedChildName: null,
  setSelectedChild: () => {},
  clearSelectedChild: () => {},
});

const STORAGE_KEY = 'biegun_selected_child';

function loadFromStorage(): { id: string; name: string } | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.id && parsed.name) return parsed;
    }
  } catch {
    // ignore
  }
  return null;
}

export function SelectedChildProvider({ children }: { children: ReactNode }) {
  // Inicjalizujemy od razu z localStorage (działa tylko po stronie klienta)
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [selectedChildName, setSelectedChildName] = useState<string | null>(null);

  useEffect(() => {
    const stored = loadFromStorage();
    if (stored) {
      setSelectedChildId(stored.id);
      setSelectedChildName(stored.name);
    }
  }, []);

  function setSelectedChild(id: string | null, name: string | null) {
    setSelectedChildId(id);
    setSelectedChildName(name);
    if (id && name) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ id, name }));
      } catch {
        // ignore
      }
    } else {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
    }
  }

  function clearSelectedChild() {
    setSelectedChild(null, null);
  }

  return (
    <SelectedChildContext.Provider value={{ selectedChildId, selectedChildName, setSelectedChild, clearSelectedChild }}>
      {children}
    </SelectedChildContext.Provider>
  );
}

export function useSelectedChild() {
  return useContext(SelectedChildContext);
}
