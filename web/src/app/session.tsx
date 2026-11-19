"use client";

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
} from "react";
import { AuthDialog, type Account } from "./auth";
import { carRequest } from "./cars";

type SignInAction = { carId?: number; onSuccess?: () => void };

type Session = {
  account: Account | null;
  setAccount: Dispatch<SetStateAction<Account | null>>;
  saved: Record<string, boolean>;
  setSaved: Dispatch<SetStateAction<Record<string, boolean>>>;
  signIn: (action?: SignInAction) => void;
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
  const [prompt, setPrompt] = useState<SignInAction | null>(null);
  const [error, setError] = useState("");
  return (
    <Context.Provider
      value={{
        account,
        setAccount,
        saved,
        setSaved,
        signIn: (action = {}) => setPrompt(action),
      }}
    >
      {children}
      {error && (
        <div className="notice toast" role="alert">
          {error}
          <button
            className="icon-button"
            aria-label="Dismiss message"
            onClick={() => setError("")}
          >
            ×
          </button>
        </div>
      )}
      {prompt && (
        <AuthDialog
          onClose={() => setPrompt(null)}
          onSignedIn={async (user) => {
            const carId = prompt.carId;
            setAccount(user);
            setPrompt(null);
            if (prompt.onSuccess) prompt.onSuccess();
            else if (carId === undefined)
              requestAnimationFrame(() =>
                document
                  .querySelector<HTMLElement>(".account-control summary")
                  ?.focus(),
              );
            if (carId !== undefined) {
              try {
                await carRequest(`/favorites/${carId}`, { method: "PUT" });
                setSaved((previous) => ({
                  ...previous,
                  [`${user.id}:${carId}`]: true,
                }));
              } catch {
                setError(
                  "Couldn't save this favorite. Please try again from the listing.",
                );
              }
            }
          }}
        />
      )}
    </Context.Provider>
  );
}
