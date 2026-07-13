export const AUTH_TOKEN_KEY = "career-tracker-auth-token-v1";
export const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID || "48292852686-95nqueviim5bflqo4upq3bta29bkamej.apps.googleusercontent.com";

export function readAuthToken() {
  try {
    return window.localStorage.getItem(AUTH_TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

export function saveAuthToken(token) {
  try {
    window.localStorage.setItem(AUTH_TOKEN_KEY, token);
  } catch {
    // Cookie sessions still work when mobile browsers block local storage.
  }
}

export function clearAuthToken() {
  try {
    window.localStorage.removeItem(AUTH_TOKEN_KEY);
  } catch {
    // Ignore blocked storage on mobile/private browsers.
  }
}

export function readInitialAuthToken() {
  try {
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const redirectToken = hashParams.get("auth_token") || "";
    if (!redirectToken) return readAuthToken();
    saveAuthToken(redirectToken);
    hashParams.delete("auth_token");
    const nextHash = hashParams.toString();
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}${nextHash ? `#${nextHash}` : ""}`,
    );
    return redirectToken;
  } catch {
    return readAuthToken();
  }
}

export function readAuthRedirectMessage() {
  try {
    const errorCode = new URLSearchParams(window.location.search).get("auth_error");
    const messages = {
      google_csrf: "Google sign-in security check failed. Refresh and try again.",
      google_missing_credential: "Google did not return a sign-in credential. Please try again.",
      google_missing_token: "Google signed in, but the browser did not receive the app session. Please try again.",
      google_verify: "Google sign-in could not verify this account. Please try again.",
      google_session: "Google sign-in connected, but the database session could not be created.",
      browser_storage: "Your browser blocked local session storage. Enable site storage and try again.",
      google: "Google sign-in could not finish. Please try again.",
    };
    return messages[errorCode] || "";
  } catch {
    return "";
  }
}

export async function apiRequest(path, { method = "GET", body, token = readAuthToken() } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(path, {
    method,
    headers,
    credentials: "same-origin",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : {};

  if (!response.ok) {
    const error = new Error(payload.error || `Request failed with ${response.status}`);
    error.code = payload.code || "request_failed";
    error.actionUrl = payload.actionUrl || "";
    error.status = response.status;
    throw error;
  }
  return payload;
}
