import { useEffect, useRef, useState } from "react";
import {
  FiArrowRight as ArrowRight,
  FiBarChart2 as BarChart,
  FiBriefcase as Briefcase,
  FiCheck as Check,
  FiCheckCircle as CheckCircle,
  FiClock as Clock,
  FiSearch as Search,
  FiShield as Shield,
  FiX as X,
  FiZap as Zap,
} from "react-icons/fi";
import { profilePresets } from "../../config/appConfig.jsx";
import { GOOGLE_CLIENT_ID, readAuthRedirectMessage } from "../../lib/auth.js";
import { classNames, ProfileImagePicker } from "../../components/ui.jsx";

function loadGoogleIdentityScript() {
  if (window.google?.accounts?.id) return Promise.resolve();
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

function GoogleSignInButton({ disabled = false, onCredential }) {
  const buttonRef = useRef(null);
  const onCredentialRef = useRef(onCredential);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    onCredentialRef.current = onCredential;
  }, [onCredential]);

  useEffect(() => {
    let cancelled = false;

    async function renderGoogleButton() {
      try {
        await loadGoogleIdentityScript();
        if (cancelled || !buttonRef.current) return;
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          ux_mode: "popup",
          itp_support: true,
          callback: async (response) => {
            if (!response?.credential || !onCredentialRef.current) {
              setError("Google did not return a sign-in credential.");
              return;
            }
            setBusy(true);
            setError("");
            const result = await onCredentialRef.current(response.credential);
            if (result?.error) setError(result.error);
            setBusy(false);
          },
        });
        buttonRef.current.innerHTML = "";
        const slotWidth = buttonRef.current.clientWidth || buttonRef.current.closest(".auth-form")?.clientWidth || 320;
        window.google.accounts.id.renderButton(buttonRef.current, {
          theme: "outline",
          size: "large",
          type: "standard",
          shape: "rectangular",
          text: "continue_with",
          width: Math.max(220, Math.min(slotWidth, 380)),
        });
        setReady(true);
      } catch {
        setReady(false);
        setError("Google sign-in could not load. Use email login or refresh.");
      }
    }

    renderGoogleButton();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className={classNames("google-auth-slot", (disabled || busy) && "is-disabled", !ready && "is-loading")}>
      <div ref={buttonRef} />
      {!ready && <span>Loading Google sign-in</span>}
      {busy && <span>Signing in with Google</span>}
      {error && <span className="google-auth-error">{error}</span>}
    </div>
  );
}

function ProductPreview() {
  const roles = [
    { company: "Nuro", role: "Software Engineer Intern", score: 96, signal: "OPT mentioned", tone: "green" },
    { company: "Figma", role: "Product Engineering Intern", score: 92, signal: "CPT mentioned", tone: "blue" },
    { company: "Databricks", role: "New Grad Software Engineer", score: 89, signal: "Verify eligibility", tone: "amber" },
  ];

  return (
    <div className="public-product-preview" aria-label="Career Tracker product preview">
      <div className="public-preview-topbar">
        <span><Search size={15} /> Search 3,000+ live roles</span>
        <strong>2026–2027 cycle</strong>
      </div>
      <div className="public-preview-body">
        <aside className="public-preview-sidebar" aria-hidden="true">
          <img src="/assets/career-track-mark.svg" alt="" />
          <span className="is-active"><BarChart size={16} /> Overview</span>
          <span><Briefcase size={16} /> Pipeline</span>
          <span><Search size={16} /> Search</span>
        </aside>
        <section className="public-preview-content">
          <header>
            <div>
              <span>LIVE SEARCH</span>
              <h2>Roles that fit your path</h2>
            </div>
            <button type="button">F-1 friendly</button>
          </header>
          <div className="public-preview-metrics">
            <span><strong>48</strong> strong matches</span>
            <span><strong>12</strong> saved this sprint</span>
            <span><strong>4</strong> applications due</span>
          </div>
          <div className="public-preview-roles">
            {roles.map((role) => (
              <article key={`${role.company}-${role.role}`}>
                <span className={`public-preview-company tone-${role.tone}`}>{role.company.slice(0, 1)}</span>
                <div>
                  <strong>{role.role}</strong>
                  <span>{role.company} · {role.signal}</span>
                </div>
                <b>{role.score}</b>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export function AuthScreen({ onLogin, onRegister, onGoogleCredential }) {
  const [authOpen, setAuthOpen] = useState(false);
  const [mode, setMode] = useState("register");
  const [draft, setDraft] = useState({
    name: "",
    email: "",
    password: "",
    avatar: profilePresets[0].src,
  });
  const [error, setError] = useState(readAuthRedirectMessage);
  const [loading, setLoading] = useState(false);

  const isRegister = mode === "register";

  useEffect(() => {
    if (!authOpen) return undefined;
    function closeOnEscape(event) {
      if (event.key === "Escape" && !loading) setAuthOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [authOpen, loading]);

  function openAuth(nextMode) {
    setMode(nextMode);
    setError("");
    setAuthOpen(true);
  }

  function update(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
    setError("");
  }

  async function submit(event) {
    event.preventDefault();
    if (!draft.email.trim() || !draft.password) {
      setError("Email and password are required.");
      return;
    }
    if (isRegister && draft.password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }

    setLoading(true);
    const result = isRegister ? await onRegister(draft) : await onLogin(draft);
    if (result?.error) setError(result.error);
    setLoading(false);
  }

  return (
    <main className="public-shell">
      <header className="public-nav">
        <a className="public-brand" href="#top" aria-label="Career Tracker home">
          <img src="/assets/career-track-mark.svg" alt="" />
          <span><strong>Career Tracker</strong><small>Internship + New Grad</small></span>
        </a>
        <nav aria-label="Public navigation">
          <a href="#workflow">Workflow</a>
          <a href="#f1-support">F-1 support</a>
          <a href="#outcomes">Outcomes</a>
        </nav>
        <div className="public-nav-actions">
          <button className="secondary-button" type="button" onClick={() => openAuth("login")}>Sign in</button>
          <button className="primary-button" type="button" onClick={() => openAuth("register")}>Start tracking</button>
        </div>
      </header>

      <section className="public-hero" id="top">
        <div className="public-hero-copy">
          <span className="public-eyebrow"><Zap size={14} /> Built for early-career job searches</span>
          <h1>Career Tracker for international students</h1>
          <p>Find live internship and new-grad roles, surface OPT and CPT signals, then move every application from saved to offer in one focused workspace.</p>
          <div className="public-hero-actions">
            <button className="primary-button" type="button" onClick={() => openAuth("register")}>
              Create free workspace <ArrowRight size={17} />
            </button>
            <button className="secondary-button" type="button" onClick={() => openAuth("login")}>Open my tracker</button>
          </div>
          <div className="public-trust-row">
            <span><Check size={15} /> No sample jobs added to your account</span>
            <span><Shield size={15} /> Private workspace</span>
            <span><Clock size={15} /> Live public sources</span>
          </div>
        </div>
        <ProductPreview />
      </section>

      <section className="public-workflow" id="workflow">
        <header>
          <span className="public-section-label">ONE SEARCH, ONE SYSTEM</span>
          <h2>Turn scattered applications into a clear weekly plan.</h2>
        </header>
        <div className="public-workflow-grid">
          <article>
            <Search size={20} />
            <span>01</span>
            <h3>Find the right roles</h3>
            <p>Search internships and new-grad openings across live public sources with cycle, mode, and F-1 filters.</p>
          </article>
          <article id="f1-support">
            <Shield size={20} />
            <span>02</span>
            <h3>Check eligibility signals</h3>
            <p>Separate explicit OPT, CPT, F-1, and sponsorship language from listings that still need manual verification.</p>
          </article>
          <article id="outcomes">
            <BarChart size={20} />
            <span>03</span>
            <h3>Build application momentum</h3>
            <p>Track sprints, deadlines, OA attempts, interviews, documents, and outcomes without losing context.</p>
          </article>
        </div>
      </section>

      <section className="public-cta-band">
        <div>
          <span>YOUR NEXT SPRINT STARTS HERE</span>
          <h2>Make every application count.</h2>
        </div>
        <button className="primary-button" type="button" onClick={() => openAuth("register")}>
          Build my tracker <ArrowRight size={17} />
        </button>
      </section>

      <footer className="public-footer">
        <span>Career Tracker</span>
        <span>Built for internship and new-grad recruiting cycles.</span>
      </footer>

      {authOpen && (
        <div className="public-auth-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !loading) setAuthOpen(false);
        }}>
          <section className="public-auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-dialog-title">
            <div className="public-auth-context">
              <img src="/assets/career-track-mark.svg" alt="" />
              <span>CAREER TRACKER</span>
              <h2>{isRegister ? "Your search deserves a system." : "Welcome back to your search."}</h2>
              <p>{isRegister ? "Create a private workspace for roles, applications, interviews, and documents." : "Pick up your current sprint and next actions."}</p>
              <ul>
                <li><CheckCircle size={16} /> Live role search</li>
                <li><CheckCircle size={16} /> F-1 eligibility signals</li>
                <li><CheckCircle size={16} /> Application pipeline</li>
              </ul>
            </div>
            <form className="auth-form public-auth-form" onSubmit={submit}>
              <button className="icon-button public-auth-close" type="button" aria-label="Close sign in" onClick={() => setAuthOpen(false)} disabled={loading}>
                <X size={18} />
              </button>
              <div>
                <p>{isRegister ? "Create account" : "Secure sign in"}</p>
                <h1 id="auth-dialog-title">{isRegister ? "Start your workspace" : "Log in to Career Tracker"}</h1>
              </div>
              {isRegister && (
                <label>
                  Name
                  <input value={draft.name} onChange={(event) => update("name", event.target.value)} placeholder="Your name" autoComplete="name" />
                </label>
              )}
              <label>
                Email
                <input type="email" value={draft.email} onChange={(event) => update("email", event.target.value)} placeholder="you@example.com" autoComplete="email" />
              </label>
              <label>
                Password
                <input
                  type="password"
                  value={draft.password}
                  onChange={(event) => update("password", event.target.value)}
                  placeholder={isRegister ? "At least 8 characters" : "Your account password"}
                  autoComplete={isRegister ? "new-password" : "current-password"}
                />
              </label>
              {isRegister && <ProfileImagePicker value={draft.avatar} onChange={(avatar) => update("avatar", avatar)} compact />}
              {error && <span className="auth-error">{error}</span>}
              <button className="primary-button" type="submit" disabled={loading}>
                {loading ? "Connecting" : isRegister ? "Create workspace" : "Log in"}
              </button>
              <div className="auth-divider"><span>or continue with</span></div>
              <GoogleSignInButton disabled={loading} onCredential={onGoogleCredential} />
              <button className="text-button auth-switch" type="button" onClick={() => {
                setMode(isRegister ? "login" : "register");
                setError("");
              }}>
                {isRegister ? "Already tracking? Log in" : "New to Career Tracker? Create account"}
              </button>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
