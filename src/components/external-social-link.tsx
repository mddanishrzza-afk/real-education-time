"use client";

import type { MouseEvent, ReactNode } from "react";

type ExternalSocialLinkProps = {
  href: string;
  label: string;
  className: string;
  children: ReactNode;
};

/**
 * Keeps a normal accessible link for production and provides a same-window
 * fallback when an embedded preview blocks new tabs/popups.
 */
export function ExternalSocialLink({ href, label, className, children }: ExternalSocialLinkProps) {
  function openSocialPage(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    // Normal browser tabs should use native link behaviour. Arena and similar
    // previews may sandbox popups, so embedded views get an explicit fallback.
    if (window.self === window.top) return;

    event.preventDefault();
    try {
      const popup = window.open(href, "_blank");
      if (popup) {
        popup.opener = null;
        return;
      }
    } catch {
      // Continue to a user-initiated top/same-frame navigation fallback.
    }

    try {
      const topWindow = window.open(href, "_top");
      if (!topWindow) window.location.assign(href);
    } catch {
      window.location.assign(href);
    }
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer external"
      aria-label={`Open Real Education Time on ${label}`}
      title={`Open ${label}`}
      className={className}
      onClick={openSocialPage}
    >
      {children}
    </a>
  );
}
