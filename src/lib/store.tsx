"use client";

// Stage 1 demo store: all data lives in the browser. Changes are kept in
// localStorage so they survive a page refresh during review, and can be reset
// from Settings. Stage 2 replaces this with the real API and database.

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, type ReactNode } from "react";
import { createMockData } from "./mock-data";
import type { CollectionKey, DataState, Role } from "./types";

const STORAGE_KEY = "rohan-demo-data-v1";
const SESSION_KEY = "rohan-demo-session-v1";

type Item<K extends CollectionKey> = DataState[K][number];

type Action =
  | { type: "add"; key: CollectionKey; item: { id: string } }
  | { type: "update"; key: CollectionKey; id: string; patch: object }
  | { type: "remove"; key: CollectionKey; id: string }
  | { type: "settings"; patch: Partial<DataState["settings"]> }
  | { type: "replace"; state: DataState };

function reducer(state: DataState, a: Action): DataState {
  switch (a.type) {
    case "add":
      return { ...state, [a.key]: [a.item, ...(state[a.key] as { id: string }[])] };
    case "update":
      return { ...state, [a.key]: (state[a.key] as { id: string }[]).map((r) => (r.id === a.id ? { ...r, ...a.patch } : r)) };
    case "remove":
      return { ...state, [a.key]: (state[a.key] as { id: string }[]).filter((r) => r.id !== a.id) };
    case "settings":
      return { ...state, settings: { ...state.settings, ...a.patch } };
    case "replace":
      return a.state;
  }
}

export interface Session {
  name: string;
  email: string;
  role: Role;
}

const DEFAULT_SESSION: Session = { name: "Hamza Raza", email: "hamza@rohanconstruction.pk", role: "ADMIN" };

interface StoreValue {
  data: DataState;
  add: <K extends CollectionKey>(key: K, item: Omit<Item<K>, "id">) => string;
  update: <K extends CollectionKey>(key: K, id: string, patch: Partial<Item<K>>) => void;
  remove: (key: CollectionKey, id: string) => void;
  updateSettings: (patch: Partial<DataState["settings"]>) => void;
  reset: () => void;
  session: Session;
  setSession: (s: Session) => void;
  canEdit: boolean;
  /** False until saved demo data has been read from the browser. */
  ready: boolean;
}

const StoreContext = createContext<StoreValue | null>(null);

let counter = 0;
export const newId = (prefix = "n") => `${prefix}${Date.now().toString(36)}${(counter++).toString(36)}`;

interface Root {
  data: DataState;
  session: Session;
  loaded: boolean;
}

type RootAction = Action | { type: "hydrate"; data?: DataState; session?: Session } | { type: "session"; session: Session };

function rootReducer(state: Root, a: RootAction): Root {
  if (a.type === "hydrate") return { data: a.data ?? state.data, session: a.session ?? state.session, loaded: true };
  if (a.type === "session") return { ...state, session: a.session };
  return { ...state, data: reducer(state.data, a) };
}

function readStorage<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined; // storage unavailable: keep the built-in demo data
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [root, dispatch] = useReducer(rootReducer, undefined, () => ({ data: createMockData(), session: DEFAULT_SESSION, loaded: false }));
  const { data, session, loaded } = root;

  useEffect(() => {
    dispatch({ type: "hydrate", data: readStorage<DataState>(STORAGE_KEY), session: readStorage<Session>(SESSION_KEY) });
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      /* ignore */
    }
  }, [data, loaded]);

  const setSession = useCallback((s: Session) => {
    dispatch({ type: "session", session: s });
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<StoreValue>(
    () => ({
      data,
      add: (key, item) => {
        const id = newId();
        dispatch({ type: "add", key, item: { ...(item as object), id } });
        return id;
      },
      update: (key, id, patch) => dispatch({ type: "update", key, id, patch: patch as object }),
      remove: (key, id) => dispatch({ type: "remove", key, id }),
      updateSettings: (patch) => dispatch({ type: "settings", patch }),
      reset: () => {
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch {
          /* ignore */
        }
        dispatch({ type: "replace", state: createMockData() });
      },
      session,
      setSession,
      canEdit: session.role === "ADMIN",
      ready: loaded,
    }),
    [data, session, setSession, loaded],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const v = useContext(StoreContext);
  if (!v) throw new Error("useStore must be used inside StoreProvider");
  return v;
}

export function useLookup() {
  const { data } = useStore();
  return useMemo(() => {
    const index = <T extends { id: string }>(rows: T[]) => new Map(rows.map((r) => [r.id, r]));
    return {
      project: index(data.projects),
      client: index(data.clients),
      contractor: index(data.contractors),
      contract: index(data.contracts),
      supplier: index(data.suppliers),
      material: index(data.materials),
      partner: index(data.partners),
      expenseCategory: index(data.expenseCategories),
      materialCategory: index(data.materialCategories),
      workCategory: index(data.workCategories),
    };
  }, [data]);
}

export { STORAGE_KEY, SESSION_KEY };
