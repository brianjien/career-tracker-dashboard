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

async function requestGmailAccessToken(tokenClientRef) {
  await loadGoogleIdentityScript();
  return new Promise((resolve, reject) => {
    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: GMAIL_READONLY_SCOPE,
        include_granted_scopes: true,
        callback: (response) => {
          if (response?.access_token) resolve(response.access_token);
          else reject(new Error(response?.error_description || "Gmail permission was not granted."));
        },
        error_callback: () => reject(new Error("Google authorization was closed or blocked.")),
      });
      tokenClientRef.current = client;
      client.requestAccessToken({ prompt: "select_account" });
    } catch {
      reject(new Error("Google authorization could not start."));
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
  const [error, setError] = useState("");
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
        setError(requestError.message);
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
    setError("");
    try {
      const gmailAccessToken = await requestGmailAccessToken(tokenClientRef);
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
      setError(requestError instanceof Error ? requestError.message : "Inbox analysis failed.");
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
          <span>{error}</span>
          <button type="button" onClick={analyzeInbox}>Try again</button>
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
