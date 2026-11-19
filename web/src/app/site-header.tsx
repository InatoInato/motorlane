"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { AccountControl } from "./auth";
import { ListingDialog } from "./listing-dialog";
import { useSession } from "./session";

export function Wordmark() {
  return (
    <Link className="wordmark" href="/" aria-label="Motorlane home">
      <span className="brand-mark" aria-hidden="true" />
      motorlane<span className="brand-dot">.</span>
    </Link>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { account, setAccount, signIn } = useSession();
  const [selling, setSelling] = useState(false);
  const [notice, setNotice] = useState("");
  const signInButton = useRef<HTMLButtonElement>(null);

  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="site-header">
        <div className="shell header-inner">
          <Wordmark />
          <nav aria-label="Main navigation">
            <Link
              href="/#listings"
              aria-current={pathname === "/" ? "page" : undefined}
            >
              Browse cars
            </Link>
            <Link
              href="/favorites"
              aria-current={pathname === "/favorites" ? "page" : undefined}
            >
              My favorites
            </Link>
          </nav>
          <div className="header-actions">
            {account ? (
              <AccountControl
                account={account}
                onSignedOut={() => {
                  setAccount(null);
                  requestAnimationFrame(() => signInButton.current?.focus());
                }}
              />
            ) : (
              <button
                ref={signInButton}
                className="text-button"
                onClick={() => signIn()}
              >
                Sign in
              </button>
            )}
            <button
              className="button primary"
              onClick={() => {
                setNotice("");
                if (account) setSelling(true);
                else signIn({ onSuccess: () => setSelling(true) });
              }}
            >
              <span aria-hidden="true">+</span> Sell your car
            </button>
          </div>
        </div>
      </header>
      {notice && pathname === "/" && (
        <div className="notice toast" role="status">
          {notice}
          <button
            className="icon-button"
            aria-label="Dismiss message"
            onClick={() => setNotice("")}
          >
            ×
          </button>
        </div>
      )}
      {selling && account && (
        <ListingDialog
          onClose={() => setSelling(false)}
          onChanged={() => router.refresh()}
          onSaved={(message) => {
            setSelling(false);
            setNotice(message);
            router.push("/#listings");
            router.refresh();
          }}
        />
      )}
    </>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell footer-inner">
        <Wordmark />
        <Link href="/#listings">
          Browse cars <span aria-hidden="true">↗</span>
        </Link>
      </div>
    </footer>
  );
}
