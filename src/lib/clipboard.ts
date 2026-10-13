/**
 * Clipboard write that never throws.
 *
 * The async Clipboard API (`navigator.clipboard.writeText`) can be missing or
 * blocked: sandboxed iframes / embedded previews apply a permissions policy
 * that rejects it with `NotAllowedError`, some browsers require a secure
 * context, and users can deny the permission outright.
 *
 * Strategy:
 *  1. Try the async Clipboard API.
 *  2. On any failure, fall back to the legacy selection + `execCommand("copy")`
 *     path, which is permitted in more embedding contexts.
 *  3. If both fail, resolve `false` so callers can show a "copy manually"
 *     hint instead of crashing the page.
 */
export async function copyTextToClipboard(value: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // Blocked by permissions policy or denied by the user — try legacy path.
    }
  }

  if (typeof document === "undefined") return false;

  try {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.top = "0";
    textarea.style.left = "0";
    textarea.style.width = "1px";
    textarea.style.height = "1px";
    textarea.style.opacity = "0";
    textarea.style.pointerEvents = "none";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, value.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}
