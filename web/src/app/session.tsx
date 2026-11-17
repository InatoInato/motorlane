"use client";

import { createContext, useContext, useState, type ReactNode, type Dispatch, type SetStateAction } from "react";
import { AuthDialog, type Account } from "./auth";
import { carRequest } from "./cars";

type Session = {
  account: Account | null;
  setAccount: Dispatch<SetStateAction<Account | null>>;
  saved: Record<string, boolean>;
  setSaved: Dispatch<SetStateAction<Record<string, boolean>>>;
  signIn: (carId?: number) => void;
};
const Context = createContext<Session | null>(null);
export function useSession() {
  const session = useContext(Context);
  if (!session) throw new Error("Session provider missing");
  return session;
}
export function SessionProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<Account | null>(null);
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [prompt, setPrompt] = useState<{ carId?: number } | null>(null);
  const [error, setError] = useState("");
  return <Context.Provider value={{ account, setAccount, saved, setSaved, signIn: (carId) => setPrompt({ carId }) }}>
    {children}
    {error && <div className="notice" role="alert">{error}<button onClick={() => setError("")}>Dismiss</button></div>}
    {prompt && <AuthDialog onClose={() => setPrompt(null)} onSignedIn={async (user) => {
      const carId = prompt.carId;
      setAccount(user); setPrompt(null);
      if (carId !== undefined) {
        try {
          await carRequest(`/favorites/${carId}`, { method: "PUT" });
          setSaved(previous => ({ ...previous, [`${user.id}:${carId}`]: true }));
        } catch { setError("Couldn't save this favorite. Please try again from the listing."); }
      }
    }} />}
  </Context.Provider>;
}
