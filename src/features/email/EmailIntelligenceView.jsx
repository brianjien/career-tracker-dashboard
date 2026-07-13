import { useEffect, useMemo, useRef, useState } from "react";
import {
  FiAlertCircle as AlertCircle,
  FiBriefcase as Briefcase,
  FiCheckCircle as CheckCircle,
  FiClock as Clock,
  FiExternalLink as ExternalLink,
  FiInbox as Inbox,
  FiMail as Mail,
  FiPlus as Plus,
  FiRefreshCcw as RefreshCcw,
  FiShield as Shield,
  FiZap as Zap,
} from "react-icons/fi";
import { ViewHeader } from "../../components/ui.jsx";
import { apiRequest, GOOGLE_CLIENT_ID } from "../../lib/auth.js";

const GMAIL_READONLY_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

const errorCopy = {
  gmail_api_disabled: {
    title: "Enable the Gmail API",
    action: "Open Google Cloud",
  },
  gmail_scope_missing: {
    title: "Allow read-only Gmail access",
    action: "Grant permission",
  },
  gmail_access_denied: {
    title: "Gmail permission was not granted",
    action: "Choose account",
  },
  gmail_permission_denied: {
    title: "Gmail access was rejected",
    action: "Reconnect",
  },
  gmail_auth_expired: {
    title: "Gmail access expired",
    action: "Reconnect",
  },
  gmail_domain_policy: {
    title: "This account blocks Gmail access",
    action: "Choose another account",
  },
  gmail_quota: {
    title: "Gmail is temporarily rate limited",
    action: "Try again",
  },
};

function createGmailError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function normalizeEmailError(error) {
  return {
    message: error instanceof Error ? error.message : "Inbox analysis failed.",
    code: error?.code || "email_analysis_failed",
    actionUrl: error?.actionUrl || "",
  };
}

const categoryLabels = {
  offer: "Offer",
  interview: "Interview",
  online_assessment: "Online assessment",
  application_update: "Application update",
  rejection: "Rejection",
  recruiter_outreach: "Recruiter outreach",
  other: "Other",
};

function loadGoogleIdentityScript() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", reject, { once: true });
    });
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

async function requestGmailAccessToken(tokenClientRef, { forceConsent = false } = {}) {
  await loadGoogleIdentityScript();
  return new Promise((resolve, reject) => {
    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: GMAIL_READONLY_SCOPE,
        include_granted_scopes: true,
        callback: (response) => {
          if (response?.error) {
            const code = response.error === "access_denied" ? "gmail_access_denied" : "gmail_scope_missing";
            reject(createGmailError(response.error_description || "Gmail permission was not granted.", code));
            return;
          }
          if (!response?.access_token) {
            reject(createGmailError("Google did not return Gmail access.", "gmail_scope_missing"));
            return;
          }
          const hasReadScope = typeof window.google.accounts.oauth2.hasGrantedAllScopes === "function"
            ? window.google.accounts.oauth2.hasGrantedAllScopes(response, GMAIL_READONLY_SCOPE)
            : String(response.scope || "").split(/\s+/).includes(GMAIL_READONLY_SCOPE);
          if (!hasReadScope) {
            reject(createGmailError(
              "Read-only Gmail access was not selected. Reconnect and approve the Gmail permission.",
              "gmail_scope_missing",
            ));
            return;
          }
          resolve(response.access_token);
        },
        error_callback: (oauthError) => {
          const message = oauthError?.type === "popup_failed_to_open"
            ? "Your browser blocked the Google authorization window. Allow pop-ups and try again."
            : "Google authorization was closed before Gmail access was granted.";
          reject(createGmailError(message, "gmail_access_denied"));
        },
      });
      tokenClientRef.current = client;
      client.requestAccessToken({
        scope: GMAIL_READONLY_SCOPE,
        include_granted_scopes: true,
        prompt: forceConsent ? "consent select_account" : "select_account",
      });
    } catch {
      reject(createGmailError("Google authorization could not start.", "gmail_access_denied"));
    }
  });
}

function formatReceived(value) {
  if (!value) return "Recently";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}

function findTrackedJob(item, jobs) {
  const company = String(item.company || "").trim().toLowerCase();
  if (!company) return null;
  return jobs.find((job) => String(job.company || "").trim().toLowerCase() === company) || null;
}

export function EmailIntelligenceView({ authToken, jobs, onCreateTask, onSelectJob, onToast }) {
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({ scannedCount: 0, relevantCount: 0, analyzedAt: "", aiStatus: "idle" });
  const [days, setDays] = useState("90");
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);
  const tokenClientRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    apiRequest("/api/email/analyses", { token: authToken })
      .then((data) => {
        if (cancelled) return;
        setItems(Array.isArray(data.items) ? data.items : []);
        setSummary(data.summary || {});
        setStatus("ready");
      })
      .catch((requestError) => {
        if (cancelled) return;
        setError(normalizeEmailError(requestError));
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [authToken]);

  const metrics = useMemo(() => ({
    actionNeeded: items.filter((item) => item.nextAction && item.category !== "rejection").length,
    interviews: items.filter((item) => ["interview", "online_assessment"].includes(item.category)).length,
    offers: items.filter((item) => item.category === "offer").length,
  }), [items]);

  async function analyzeInbox() {
    setStatus("authorizing");
    const forceConsent = [
      "gmail_scope_missing",
      "gmail_access_denied",
      "gmail_permission_denied",
      "gmail_auth_expired",
    ].includes(error?.code);
    setError(null);
    try {
      const gmailAccessToken = await requestGmailAccessToken(tokenClientRef, { forceConsent });
      setStatus("analyzing");
      const data = await apiRequest("/api/email/analyze", {
        method: "POST",
        token: authToken,
        body: { gmailAccessToken, days: Number(days), maxMessages: 40 },
      });
      setItems(Array.isArray(data.items) ? data.items : []);
      setSummary(data.summary || {});
      setStatus("ready");
      onToast?.(`Analyzed ${data.summary?.scannedCount || 0} Gmail messages`);
    } catch (requestError) {
      setError(normalizeEmailError(requestError));
      setStatus("error");
    }
  }

  function createFollowUp(item) {
    const trackedJob = findTrackedJob(item, jobs);
    onCreateTask({
      title: item.nextAction || `Review ${item.company || "recruiting"} email`,
      subtitle: `${item.company || item.senderName || "Gmail"} · ${categoryLabels[item.category] || "Email"}`,
      priority: ["offer", "interview", "online_assessment"].includes(item.category) ? "High" : "Medium",
      due: item.deadline || "",
      sourceJobId: trackedJob?.id || "",
      taskType: "Email follow-up",
    });
  }

  const isBusy = status === "authorizing" || status === "analyzing";

  return (
    <section className="email-intelligence-view">
      <ViewHeader eyebrow="Gmail intelligence" title="Recruiting inbox">
        <div className="email-header-actions">
          <label>
            <span>Look back</span>
            <select value={days} onChange={(event) => setDays(event.target.value)} disabled={isBusy}>
              <option value="30">30 days</option>
              <option value="90">90 days</option>
              <option value="180">180 days</option>
            </select>
          </label>
          <button className="primary-button" type="button" onClick={analyzeInbox} disabled={isBusy}>
            {isBusy ? <RefreshCcw className="is-spinning" size={16} /> : <Mail size={16} />}
            {status === "authorizing" ? "Connecting" : status === "analyzing" ? "Analyzing" : items.length ? "Scan again" : "Connect Gmail"}
          </button>
        </div>
      </ViewHeader>

      <div className="email-privacy-note">
        <Shield size={17} aria-hidden="true" />
        <div>
          <strong>Read-only and on demand</strong>
          <span>Your token and full message bodies are never stored. Selected subjects, senders, and Gmail snippets are sent to Gemini; only recruiting metadata and action summaries are saved.</span>
        </div>
      </div>

      {error && (
        <div className="email-error" role="alert">
          <AlertCircle size={17} />
          <div>
            <strong>{errorCopy[error.code]?.title || "Inbox analysis could not finish"}</strong>
            <span>{error.message}</span>
          </div>
          {error.actionUrl ? (
            <a href={error.actionUrl} target="_blank" rel="noreferrer">
              {errorCopy[error.code]?.action || "Open setup"} <ExternalLink size={13} />
            </a>
          ) : (
            <button type="button" onClick={analyzeInbox}>{errorCopy[error.code]?.action || "Try again"}</button>
          )}
        </div>
      )}

      <div className="email-metrics" aria-label="Email analysis summary">
        <article><Inbox size={18} /><div><strong>{items.length}</strong><span>recruiting signals</span></div></article>
        <article><Zap size={18} /><div><strong>{metrics.actionNeeded}</strong><span>need action</span></div></article>
        <article><Clock size={18} /><div><strong>{metrics.interviews}</strong><span>OA or interview</span></div></article>
        <article><CheckCircle size={18} /><div><strong>{metrics.offers}</strong><span>offers</span></div></article>
      </div>

      <div className="email-results-bar">
        <div>
          <strong>{summary.relevantCount || items.length} relevant messages</strong>
          <span>{summary.scannedCount ? `${summary.scannedCount} scanned` : "Connect Gmail to begin"}</span>
        </div>
        <span>{summary.analyzedAt ? `Updated ${formatReceived(summary.analyzedAt)}` : "No inbox data yet"}</span>
      </div>

      {status === "loading" ? (
        <div className="email-empty"><RefreshCcw className="is-spinning" size={22} /><strong>Loading email signals</strong></div>
      ) : items.length === 0 ? (
        <div className="email-empty">
          <Mail size={24} />
          <strong>Turn recruiting emails into next steps</strong>
          <span>Connect Gmail to identify recruiter outreach, application updates, assessments, interviews, rejections, and offers.</span>
          <button className="primary-button" type="button" onClick={analyzeInbox} disabled={isBusy}><Mail size={16} /> Connect Gmail</button>
        </div>
      ) : (
        <div className="email-signal-list">
          {items.map((item) => {
            const trackedJob = findTrackedJob(item, jobs);
            return (
              <article className="email-signal-row" key={item.id}>
                <span className={`email-category-icon tone-${item.category}`}><Briefcase size={17} /></span>
                <div className="email-signal-main">
                  <div className="email-signal-title">
                    <strong>{item.company || item.senderName || "Recruiting team"}</strong>
                    <span className={`email-category-label tone-${item.category}`}>{categoryLabels[item.category] || "Recruiting email"}</span>
                    {item.isUnread && <span className="email-unread">Unread</span>}
                  </div>
                  <h3>{item.subject}</h3>
                  <p>{item.summary}</p>
                  <div className="email-signal-meta">
                    <span>{item.senderEmail || item.senderName}</span>
                    <span>{formatReceived(item.receivedAt)}</span>
                    <span>{Math.round(Number(item.confidence || 0) * 100)}% confidence</span>
                  </div>
                </div>
                <div className="email-next-action">
                  <span>Next action</span>
                  <strong>{item.nextAction || "Review this message"}</strong>
                  <div>
                    {trackedJob && <button className="secondary-button" type="button" onClick={() => onSelectJob(trackedJob.id)}>Open job <ExternalLink size={13} /></button>}
                    <button className="secondary-button" type="button" onClick={() => createFollowUp(item)}><Plus size={14} /> Add task</button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
