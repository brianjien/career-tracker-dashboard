import { useEffect, useMemo, useRef, useState } from "react";
import {
  FiArrowUpRight as ArrowUpRight,
  FiBookmark as Bookmark,
  FiBookmark as BookmarkCheck,
  FiBriefcase as BriefcaseBusiness,
  FiBriefcase as Building2,
  FiCalendar as CalendarDays,
  FiCheck as Check,
  FiCheckCircle as CheckCircle2,
  FiCheckSquare as CheckSquare2,
  FiChevronDown as ChevronDown,
  FiChevronLeft as ChevronLeft,
  FiChevronRight as ChevronRight,
  FiCircle as CircleDot,
  FiClock as Clock3,
  FiColumns as Columns3,
  FiCopy as Copy,
  FiDownload as Download,
  FiEye as Eye,
  FiExternalLink as ExternalLink,
  FiFileText as FileText,
  FiFilter as Filter,
  FiCode as FlaskConical,
  FiGift as Gift,
  FiAward as GraduationCap,
  FiHome as Home,
  FiGrid as KanbanSquare,
  FiCheckSquare as ListChecks,
  FiMail as Mail,
  FiMapPin as MapPin,
  FiMenu as Menu,
  FiMoreHorizontal as MoreHorizontal,
  FiEdit3 as NotebookPen,
  FiEdit2 as Pencil,
  FiPlus as Plus,
  FiRefreshCcw as RefreshCcw,
  FiSearch as Search,
  FiSend as Send,
  FiSettings as Settings,
  FiShield as ShieldCheck,
  FiZap as Sparkles,
  FiTarget as Target,
  FiTrash2 as Trash2,
  FiAward as Trophy,
  FiUpload as Upload,
  FiUser as UserRound,
  FiUsers as Users,
  FiX as X,
} from "react-icons/fi";
import {
  blankDocumentDraft,
  blankGoal,
  companyIcons,
  defaultProfile,
  documentStatusOptions,
  documentTypeOptions,
  navItems,
  profilePresets,
  resourceLinks,
  stages,
  uploadDocumentLimit,
} from "./config/appConfig.jsx";
import {
  apiRequest,
  clearAuthToken,
  GOOGLE_CLIENT_ID,
  readAuthRedirectMessage,
  readInitialAuthToken,
  saveAuthToken,
} from "./lib/auth.js";
import {
  formatBytes,
  getDocumentDownloadUrl,
  getJobDocumentLabel,
  isOpenableUrl,
  normalizeDocument,
  safeDocumentFileUrl,
  safeExternalUrl,
  uploadDocumentFile,
} from "./lib/documents.js";
import {
  addMonths,
  buildCalendarDays,
  compareDateValues,
  createCalendarFile,
  createSprintLabels,
  dateKey,
  daysUntil,
  formatDate,
  formatRelativeDate,
} from "./lib/dates.js";
import { downloadSvg, downloadSvgAsPng } from "./lib/sankeyExport.js";
import { buildNotificationFeed, normalizeNotificationState } from "./lib/notifications.jsx";
import {
  cacheWorkspace,
  loadContacts,
  loadDocuments,
  loadGoal,
  loadJobs,
  loadNotificationState,
  loadTasks,
  normalizeWorkspace,
  serializeWorkspace,
} from "./lib/workspace.js";
import { DocumentPreviewPanel } from "./features/documents/DocumentPreviewPanel.jsx";
import { NotificationCenter } from "./components/NotificationCenter.jsx";

function getInitials(name = "") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "CT";
  return parts.slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function classNames(...values) {
  return values.filter(Boolean).join(" ");
}

function isRenderableIcon(icon) {
  return typeof icon === "function" || (typeof icon === "object" && icon !== null && "$$typeof" in icon);
}

function CompanyLogo({ company }) {
  const brand = companyIcons[company];
  const Icon = isRenderableIcon(brand?.icon) ? brand.icon : Building2;

  return (
    <span className={classNames("company-logo", brand?.className || "brand-generic")} aria-hidden="true">
      <Icon />
    </span>
  );
}

function IconButton({ label, children, className = "", ...props }) {
  return (
    <button className={classNames("icon-button", className)} type="button" aria-label={label} {...props}>
      {children}
    </button>
  );
}

function getOpportunityRoleType(job = {}) {
  const text = `${job.role || ""} ${job.season || ""} ${(job.tags || []).join(" ")}`.toLowerCase();
  if (text.includes("new grad") || text.includes("graduate") || text.includes("entry level") || text.includes("early career")) {
    return "New Grad";
  }
  if (text.includes("intern") || text.includes("co-op")) return "Internship";
  return job.season === "New Grad" ? "New Grad" : "Role";
}

function getOpportunityRequirementItems(job = {}) {
  const items = [
    { label: "Role Type", value: getOpportunityRoleType(job) },
    { label: "Season", value: job.season || "Not listed" },
    { label: "Location", value: job.location || "Not listed" },
    { label: "Work Mode", value: job.mode || "Not listed" },
    { label: "Sponsorship", value: job.sponsorship === "Unknown" ? "Verify on posting" : job.sponsorship },
    { label: "Posted", value: job.posted || "Not listed" },
  ];
  if (job.deadline) items.push({ label: "Deadline", value: formatDate(job.deadline) });
  if (job.requirements) items.push({ label: "Listed Term", value: job.requirements });
  items.push({ label: "Source", value: job.source || "Public feed" });
  return items;
}

function getOpportunitySignals(job = {}) {
  const text = `${job.role || ""} ${job.summary || ""} ${job.description || ""} ${(job.tags || []).join(" ")}`.toLowerCase();
  const signals = [];
  if (text.includes("software")) signals.push("Software engineering keyword match");
  if (text.includes("machine learning") || /\bml\b/.test(text) || text.includes(" ai ")) signals.push("ML / AI signal");
  if (text.includes("data")) signals.push("Data signal");
  if (text.includes("backend") || text.includes("platform") || text.includes("systems")) signals.push("Backend, platform, or systems signal");
  if ((job.season || "").match(/2026 Fall|2027|New Grad/i)) signals.push("Matches selected cycle");
  if ((job.mode || "").toLowerCase() === "remote") signals.push("Remote-friendly listing");
  if (!signals.length) signals.push("General role metadata match");
  return signals.slice(0, 5);
}

function OpportunityPreviewModal({ job, imported, onClose, onImport }) {
  const requirementItems = getOpportunityRequirementItems(job);
  const signals = getOpportunitySignals(job);
  const description = String(job.description || job.summary || "").trim();
  const sourceUrl = safeExternalUrl(job.sourceUrl);
  const hasSource = Boolean(sourceUrl);

  return (
    <div
      className="modal-backdrop opportunity-preview-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={`${job.role} preview`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="opportunity-preview-modal">
        <div className="opportunity-preview-head">
          <CompanyLogo company={job.company} />
          <span>
            <strong>{job.role}</strong>
            <small>{job.company} · {job.location}</small>
          </span>
          <div className="opportunity-preview-actions">
            {hasSource ? (
              <a className="secondary-button" href={sourceUrl} target="_blank" rel="noreferrer">
                Apply <ArrowUpRight size={14} aria-hidden="true" />
              </a>
            ) : (
              <button className="secondary-button" type="button" disabled>
                Apply
              </button>
            )}
            <button
              className="primary-button"
              type="button"
              onClick={() => {
                onImport(job);
                onClose();
              }}
              disabled={imported}
            >
              {imported ? "Imported" : "Import"}
            </button>
            <button className="icon-button" type="button" onClick={onClose} aria-label="Close preview">
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="opportunity-preview-body">
          <section className="opportunity-preview-summary">
            <div>
              <span>Match</span>
              <strong>{job.match || "-"}%</strong>
            </div>
            <div>
              <span>Source</span>
              <strong>{job.source || "Public feed"}</strong>
            </div>
            <div>
              <span>Status</span>
              <strong>{imported ? "Imported" : "Not imported"}</strong>
            </div>
          </section>

          <section className="opportunity-preview-section">
            <h3>Requirements and conditions</h3>
            <div className="opportunity-requirement-grid">
              {requirementItems.map((item) => (
                <span key={`${item.label}-${item.value}`}>
                  {item.label}
                  <strong>{item.value}</strong>
                </span>
              ))}
            </div>
          </section>

          <section className="opportunity-preview-section">
            <h3>Match signals</h3>
            <div className="opportunity-signal-list">
              {signals.map((signal) => (
                <span key={signal}>
                  <Check size={13} aria-hidden="true" />
                  {signal}
                </span>
              ))}
            </div>
          </section>

          <section className="opportunity-preview-section">
            <h3>Posting preview</h3>
            {description ? (
              <p>{description}</p>
            ) : (
              <p>
                This source does not publish a full job description in the feed. Open the original posting to verify
                degree, graduation date, sponsorship, location, and technical requirements before applying.
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function buildSankeyStats(jobs = []) {
  const counts = {
    total: jobs.length,
    saved: jobs.filter((job) => job.stage === "saved").length,
    applied: jobs.filter((job) => job.stage === "applied").length,
    oa: jobs.filter((job) => job.stage === "oa").length,
    interview: jobs.filter((job) => job.stage === "interview").length,
    offer: jobs.filter((job) => job.stage === "offer").length,
  };
  counts.sent = Math.max(0, counts.total - counts.saved);
  counts.replies = counts.oa + counts.interview + counts.offer;
  counts.interviewLoop = counts.interview + counts.offer;

  const nodes = [
    { id: "tracked", label: "Roles tracked", value: counts.total, x: 80, y: 260, tone: "green" },
    { id: "saved", label: "Not applied yet", value: counts.saved, x: 270, y: 360, tone: "red" },
    { id: "sent", label: "Applications sent", value: counts.sent, x: 270, y: 175, tone: "green" },
    { id: "noReply", label: "No reply / stalled", value: counts.applied, x: 475, y: 285, tone: "red" },
    { id: "replies", label: "Replies or screens", value: counts.replies, x: 475, y: 130, tone: "green" },
    { id: "oa", label: "OA / assessment", value: counts.oa, x: 690, y: 92, tone: "green" },
    { id: "interview", label: "Interview loop", value: counts.interviewLoop, x: 690, y: 190, tone: "green" },
    { id: "stillInterviewing", label: "Still interviewing", value: counts.interview, x: 900, y: 238, tone: "green" },
    { id: "offer", label: "Offer received", value: counts.offer, x: 900, y: 130, tone: "green" },
  ];
  const nodeMap = Object.fromEntries(nodes.map((node) => [node.id, node]));
  const links = [
    { from: "tracked", to: "sent", value: counts.sent, tone: "green", y1: 242, y2: 180 },
    { from: "tracked", to: "saved", value: counts.saved, tone: "red", y1: 282, y2: 360 },
    { from: "sent", to: "replies", value: counts.replies, tone: "green", y1: 164, y2: 132 },
    { from: "sent", to: "noReply", value: counts.applied, tone: "red", y1: 198, y2: 286 },
    { from: "replies", to: "oa", value: counts.oa, tone: "green", y1: 116, y2: 92 },
    { from: "replies", to: "interview", value: counts.interviewLoop, tone: "green", y1: 148, y2: 190 },
    { from: "interview", to: "offer", value: counts.offer, tone: "green", y1: 178, y2: 130 },
    { from: "interview", to: "stillInterviewing", value: counts.interview, tone: "green", y1: 208, y2: 238 },
  ].filter((link) => link.value > 0);
  return { counts, nodes, nodeMap, links };
}

function sankeyPath(x1, y1, x2, y2) {
  const curve = Math.max(60, (x2 - x1) * 0.58);
  return `M ${x1} ${y1} C ${x1 + curve} ${y1}, ${x2 - curve} ${y2}, ${x2} ${y2}`;
}

function getSankeyLabelPosition(node) {
  if (node.id === "tracked") return { x: 18, anchor: "start" };
  if (node.x > 760) return { x: 18, anchor: "start" };
  return { x: -18, anchor: "end" };
}

function JobSearchSankey({ jobs, svgRef }) {
  const { counts, nodes, nodeMap, links } = buildSankeyStats(jobs);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef(null);
  const maxFlow = Math.max(1, counts.total);
  const flowScale = Math.min(30, 150 / maxFlow);
  const activeCompanies = new Set(jobs.map((job) => job.company).filter(Boolean)).size;

  function startPan(event) {
    if (event.button !== undefined && event.button !== 0) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      panX: pan.x,
      panY: pan.y,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDragging(true);
  }

  function movePan(event) {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return;
    event.preventDefault();
    setPan({
      x: dragRef.current.panX + event.clientX - dragRef.current.startX,
      y: dragRef.current.panY + event.clientY - dragRef.current.startY,
    });
  }

  function stopPan(event) {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    dragRef.current = null;
    setDragging(false);
  }

  function panWithKeyboard(event) {
    const step = event.shiftKey ? 40 : 16;
    const moves = {
      ArrowLeft: { x: -step, y: 0 },
      ArrowRight: { x: step, y: 0 },
      ArrowUp: { x: 0, y: -step },
      ArrowDown: { x: 0, y: step },
    };
    if (event.key === "Home") {
      event.preventDefault();
      setPan({ x: 0, y: 0 });
      return;
    }
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    setPan((current) => ({ x: current.x + move.x, y: current.y + move.y }));
  }

  if (counts.total === 0) {
    return (
      <svg
        ref={svgRef}
        className="sankey-svg sankey-svg-empty"
        viewBox="0 0 720 420"
        role="img"
        aria-label="Empty job search Sankey diagram"
      >
        <rect width="720" height="420" rx="8" fill="#ffffff" />
        <circle cx="360" cy="148" r="48" fill="#e4f7ec" />
        <path d="M328 148h64M360 116v64" stroke="#087b45" strokeWidth="10" strokeLinecap="round" />
        <text x="360" y="238" textAnchor="middle" className="sankey-title">
          Job Search Sankey
        </text>
        <text x="360" y="270" textAnchor="middle" className="sankey-subtitle">
          Import or add roles to generate your diagram.
        </text>
        <text x="360" y="298" textAnchor="middle" className="sankey-empty-copy">
          Saved, applied, OA, interview, and offer stages will turn into flows automatically.
        </text>
      </svg>
    );
  }

  return (
    <svg
      ref={svgRef}
      className={classNames("sankey-svg", dragging && "is-dragging")}
      viewBox="0 0 1120 520"
      role="img"
      aria-label="Job search Sankey diagram"
      tabIndex="0"
      onPointerDown={startPan}
      onPointerMove={movePan}
      onPointerUp={stopPan}
      onPointerCancel={stopPan}
      onDoubleClick={() => setPan({ x: 0, y: 0 })}
      onKeyDown={panWithKeyboard}
    >
      <title>Drag to pan the Sankey diagram. Double-click or press Home to reset.</title>
      <rect width="1120" height="520" rx="8" fill="#ffffff" />
      <text x="560" y="58" textAnchor="middle" className="sankey-title">
        Job Search Sankey
      </text>
      <text x="560" y="85" textAnchor="middle" className="sankey-subtitle">
        {counts.total} tracked roles across {activeCompanies} companies
      </text>

      <g className="sankey-pan-layer" transform={`translate(${pan.x} ${pan.y})`}>
        <g fill="none" strokeLinecap="round">
          {links.map((link) => {
            const from = nodeMap[link.from];
            const to = nodeMap[link.to];
            return (
              <path
                key={`${link.from}-${link.to}`}
                d={sankeyPath(from.x + 12, link.y1, to.x - 12, link.y2)}
                className={classNames("sankey-flow", `is-${link.tone}`)}
                strokeWidth={Math.max(5, link.value * flowScale)}
              />
            );
          })}
        </g>

        {nodes.map((node) => {
          const labelPosition = getSankeyLabelPosition(node);
          return (
            <g
              key={node.id}
              className={classNames("sankey-node", `is-${node.tone}`, node.value === 0 && "is-empty")}
              transform={`translate(${node.x}, ${node.y})`}
            >
              <rect x="-10" y="-38" width="20" height="76" rx="4" />
              <text className="sankey-label-main" x={labelPosition.x} y="-4" textAnchor={labelPosition.anchor}>
                {node.label}
              </text>
              <text className="sankey-label-value" x={labelPosition.x} y="15" textAnchor={labelPosition.anchor}>
                {node.value}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}

function MetricCard({ label, value, caption, icon: Icon, tone = "green" }) {
  return (
    <article className="metric-card">
      <span className={classNames("metric-icon", `tone-${tone}`)} aria-hidden="true">
        <Icon size={20} strokeWidth={2} />
      </span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <span>{caption}</span>
      </div>
    </article>
  );
}

function StageSelect({ value, onChange, label = "Move stage" }) {
  return (
    <label className="stage-select">
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {stages.map((stage) => (
          <option key={stage.id} value={stage.id}>
            {stage.label}
          </option>
        ))}
      </select>
      <ChevronDown size={14} aria-hidden="true" />
    </label>
  );
}

function JobCard({ job, active, onSelect, onStageChange, onTogglePriority, onRemoveJob, onDragStart }) {
  const urgent = daysUntil(job.deadline) <= 14;
  const isSaved = job.stage === "saved";

  return (
    <article
      className={classNames("job-card", active && "is-active", job.priority && "is-priority")}
      draggable
      onDragStart={() => onDragStart(job.id)}
      onClick={() => onSelect(job.id)}
      aria-label={`${job.company} ${job.role}`}
    >
      <div className="job-card-top">
        <CompanyLogo company={job.company} />
        <span className="match-pill">{job.match}</span>
      </div>
      <div className="job-card-main">
        <h3>{job.company}</h3>
        <p>{job.role}</p>
        <span>
          {job.season} <CircleDot size={8} aria-hidden="true" /> {formatDate(job.deadline)}
        </span>
      </div>
      <div className="job-card-actions">
        <IconButton
          className={isSaved ? "danger-icon-button" : ""}
          label={isSaved ? `Remove ${job.company} from Saved` : job.priority ? "Remove priority" : "Mark priority"}
          onClick={(event) => {
            event.stopPropagation();
            if (isSaved) {
              onRemoveJob(job.id);
              return;
            }
            onTogglePriority(job.id);
          }}
        >
          {isSaved ? <Trash2 size={15} /> : job.priority ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
        </IconButton>
        <IconButton label={`Open ${job.company} details`} onClick={(event) => {
          event.stopPropagation();
          onSelect(job.id);
        }}>
          <ExternalLink size={15} />
        </IconButton>
        <StageSelect
          value={job.stage}
          label={`Move ${job.company}`}
          onChange={(stageId) => onStageChange(job.id, stageId)}
        />
      </div>
      {urgent && (
        <div className="deadline-chip">
          <Clock3 size={12} aria-hidden="true" />
          Due soon
        </div>
      )}
    </article>
  );
}

function StageColumn({
  stage,
  jobs,
  selectedId,
  onSelect,
  onStageChange,
  onTogglePriority,
  onRemoveJob,
  onDrop,
  onDragStart,
  onAdd,
}) {
  const Icon = stage.icon;

  return (
    <section
      className={classNames("stage-column", `stage-${stage.accent}`)}
      onDragOver={(event) => event.preventDefault()}
      onDrop={() => onDrop(stage.id)}
      aria-labelledby={`${stage.id}-heading`}
    >
      <div className="stage-header">
        <div>
          <Icon size={18} aria-hidden="true" />
          <h2 id={`${stage.id}-heading`}>{stage.label}</h2>
          <span>{jobs.length}</span>
        </div>
        <IconButton label={`Add job to ${stage.label}`} onClick={() => onAdd(stage.id)}>
          <Plus size={16} />
        </IconButton>
      </div>
      <div className="stage-list">
        {jobs.map((job) => (
          <JobCard
            key={job.id}
            job={job}
            active={job.id === selectedId}
            onSelect={onSelect}
            onStageChange={onStageChange}
            onTogglePriority={onTogglePriority}
            onRemoveJob={onRemoveJob}
            onDragStart={onDragStart}
          />
        ))}
        {jobs.length === 0 && <p className="empty-stage">{stage.empty}</p>}
      </div>
      <button className="add-inline" type="button" onClick={() => onAdd(stage.id)}>
        <Plus size={15} aria-hidden="true" />
        Add job
      </button>
    </section>
  );
}

function ProgressGoal({ appliedCount, goal = blankGoal, onGoalChange }) {
  const safeGoal = goal || blankGoal;
  const [draft, setDraft] = useState(safeGoal);
  const target = Number(safeGoal.target || 0);
  const hasGoal = target > 0;
  const percent = hasGoal ? Math.min(100, Math.round((appliedCount / target) * 100)) : 0;
  const remaining = hasGoal ? Math.max(0, target - appliedCount) : 0;
  const label = safeGoal.label?.trim() || "applications";
  const deadlineLabel = safeGoal.deadline ? ` by ${formatDate(safeGoal.deadline)}` : "";

  useEffect(() => {
    setDraft(safeGoal);
  }, [safeGoal]);

  function updateDraft(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function saveGoal(event) {
    event.preventDefault();
    const nextTarget = Math.max(0, Number(draft.target || 0));
    onGoalChange({
      target: nextTarget ? String(nextTarget) : "",
      deadline: draft.deadline || "",
      label: draft.label.trim(),
    });
  }

  return (
    <article className="goal-card">
      <div className="goal-card-title">
        <strong>{hasGoal ? `Goal: ${target} ${label}${deadlineLabel}` : "Set your application goal"}</strong>
        <Target size={16} aria-hidden="true" />
      </div>
      {hasGoal ? (
        <>
          <div className="goal-meter" aria-label={`${appliedCount} applications toward ${target} target`}>
            <span style={{ width: `${percent}%` }} />
          </div>
          <div className="goal-stats">
            <span>
              <strong>{appliedCount}</strong>
              Applied
            </span>
            <span>
              <strong>{remaining}</strong>
              To go
            </span>
            <span>
              <strong>{target}</strong>
              Target
            </span>
          </div>
        </>
      ) : (
        <p className="goal-empty-copy">Choose a target and deadline; progress updates automatically from your pipeline.</p>
      )}
      <form className="goal-form" onSubmit={saveGoal}>
        <label>
          <span>Target</span>
          <input
            type="number"
            min="1"
            value={draft.target}
            onChange={(event) => updateDraft("target", event.target.value)}
            placeholder="40"
            aria-label="Goal target applications"
          />
        </label>
        <label>
          <span>Deadline</span>
          <input
            value={draft.deadline}
            onChange={(event) => updateDraft("deadline", event.target.value)}
            placeholder="YYYY-MM-DD"
            aria-label="Goal deadline"
          />
        </label>
        <label>
          <span>Label</span>
          <input
            value={draft.label}
            onChange={(event) => updateDraft("label", event.target.value)}
            placeholder="quality applications"
            aria-label="Goal label"
          />
        </label>
        <div className="goal-form-actions">
          <button className="primary-button" type="submit">
            Save
          </button>
          <button className="secondary-button" type="button" onClick={() => onGoalChange({ target: "", deadline: "", label: "" })}>
            Clear
          </button>
        </div>
      </form>
    </article>
  );
}

function DetailPanel({ job, onClose, onStageChange, onUpdateNotes, onCompleteNextStep }) {
  const [tab, setTab] = useState("overview");

  if (!job) return null;

  const sourceUrl = safeExternalUrl(job.sourceUrl);

  return (
    <section className="detail-panel" aria-label={`${job.company} details`}>
      <div className="detail-top">
        <div className="detail-company">
          <CompanyLogo company={job.company} />
          <div>
            <h2>{job.company}</h2>
            <p>
              {job.role} <span>{job.match} Match</span>
            </p>
            <div className="detail-tags">
              <span>{job.season}</span>
              <span>{job.location}</span>
              <span>{job.mode}</span>
            </div>
          </div>
        </div>
        <div className="detail-actions">
          <StageSelect value={job.stage} onChange={(stageId) => onStageChange(job.id, stageId)} />
          <IconButton label="Close details" onClick={onClose}>
            <X size={17} />
          </IconButton>
        </div>
      </div>

      <div className="detail-links" aria-label="Job source links">
        <a
          href={sourceUrl || "#"}
          target={sourceUrl ? "_blank" : undefined}
          rel={sourceUrl ? "noreferrer" : undefined}
          onClick={(event) => {
            if (!sourceUrl) event.preventDefault();
          }}
        >
          {job.source} <ArrowUpRight size={13} aria-hidden="true" />
        </a>
        <a
          href={sourceUrl || "#"}
          target={sourceUrl ? "_blank" : undefined}
          rel={sourceUrl ? "noreferrer" : undefined}
          onClick={(event) => {
            if (!sourceUrl) event.preventDefault();
          }}
        >
          Job Posting <ArrowUpRight size={13} aria-hidden="true" />
        </a>
      </div>

      <div className="detail-tabs" role="tablist" aria-label="Detail sections">
        {["overview", "notes", "contacts", "history"].map((item) => (
          <button
            key={item}
            className={tab === item ? "is-active" : ""}
            type="button"
            role="tab"
            aria-selected={tab === item}
            onClick={() => setTab(item)}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="detail-grid">
        <article className="detail-stat">
          <span>Deadline</span>
          <strong>{formatDate(job.deadline, { month: "short", day: "numeric", year: "numeric" })}</strong>
        </article>
        <article className="detail-stat">
          <span>Posted</span>
          <strong>{formatDate(job.posted)}</strong>
        </article>
        <article className="detail-stat">
          <span>Status</span>
          <strong>{job.statusDate}</strong>
        </article>
        <article className="detail-stat">
          <span>Mode</span>
          <strong>{job.mode}</strong>
        </article>
      </div>

      {tab === "overview" && (
        <div className="detail-content-grid">
          <article>
            <h3>Role Summary</h3>
            <p>{job.summary}</p>
            <div className="tag-list">
              {(job.tags || []).map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
          </article>
          <article>
            <h3>My Notes</h3>
            <ul>
              {job.notes.split(". ").map((note) => (
                <li key={note}>{note.replace(/\.$/, "")}</li>
              ))}
            </ul>
            <button className="text-button" type="button" onClick={() => setTab("notes")}>
              Edit Notes
            </button>
          </article>
          <article>
            <h3>Next Step</h3>
            <p>{job.nextStep}</p>
            <button className="text-button" type="button" onClick={() => onCompleteNextStep(job.id)}>
              Mark as Complete
            </button>
          </article>
        <article>
          <h3>Recruiter / Contact</h3>
          {job.contact ? (
            <div className="contact-row">
              <span className="contact-avatar">{job.contact.slice(0, 2).toUpperCase()}</span>
              <div>
                <strong>{job.contact}</strong>
                <p>{job.contactRole || "Contact"}</p>
                {job.contactEmail ? <a href={`mailto:${job.contactEmail}`}>{job.contactEmail}</a> : <span>No email yet</span>}
              </div>
            </div>
          ) : (
            <p>No contact saved for this role yet.</p>
          )}
        </article>
      </div>
      )}

      {tab === "notes" && (
        <div className="notes-editor">
          <label htmlFor="job-notes">Notes for {job.company}</label>
          <textarea id="job-notes" value={job.notes} onChange={(event) => onUpdateNotes(job.id, event.target.value)} />
          <p>Synced to your database workspace.</p>
        </div>
      )}

      {tab === "contacts" && (
        <div className="contact-panel">
          <Mail size={18} aria-hidden="true" />
          <div>
            <h3>{job.contact || "No contact saved"}</h3>
            <p>{job.contactRole || "Add a recruiter or referral in Contacts."}</p>
            {job.contactEmail ? <a href={`mailto:${job.contactEmail}`}>{job.contactEmail}</a> : <span>No email yet</span>}
          </div>
        </div>
      )}

      {tab === "history" && (
        <ol className="history-list">
          <li>{job.statusDate}</li>
          <li>{job.source} added to tracker</li>
          <li>Matched against your profile</li>
        </ol>
      )}
    </section>
  );
}

function AddJobModal({ open, defaultStage, onClose, onAdd }) {
  const [form, setForm] = useState({
    company: "",
    role: "",
    season: "2026 Fall",
    stage: defaultStage || "saved",
    deadline: "",
    location: "",
    mode: "Hybrid",
    sourceUrl: "",
  });

  useEffect(() => {
    if (open) {
      setForm((current) => ({ ...current, stage: defaultStage || "saved" }));
    }
  }, [defaultStage, open]);

  if (!open) return null;

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (!form.company.trim() || !form.role.trim()) return;

    onAdd({
      id: `${form.company}-${form.role}-${Date.now()}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      company: form.company.trim(),
      role: form.role.trim(),
      season: form.season,
      deadline: form.deadline,
      location: form.location,
      mode: form.mode,
      sponsorship: "Unknown",
      stage: form.stage,
      match: 76,
      source: "Manual",
      sourceUrl: safeExternalUrl(form.sourceUrl),
      posted: new Date().toISOString().slice(0, 10),
      statusDate: "Added today",
      priority: false,
      contact: "",
      contactRole: "",
      contactEmail: "",
      summary: "New tracked role. Add details after reviewing the posting.",
      notes: "",
      tags: ["New", form.season],
      nextStep: "Review posting and tailor resume.",
    });

    setForm({
      company: "",
      role: "",
      season: "2026 Fall",
      stage: defaultStage || "saved",
      deadline: "",
      location: "",
      mode: "Hybrid",
      sourceUrl: "",
    });
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="add-job-title">
        <div className="modal-head">
          <div>
            <p>New opportunity</p>
            <h2 id="add-job-title">Add internship</h2>
          </div>
          <IconButton label="Close add job modal" onClick={onClose}>
            <X size={18} />
          </IconButton>
        </div>
        <form onSubmit={handleSubmit} className="modal-form">
          <label>
            Company
            <input value={form.company} onChange={(event) => updateField("company", event.target.value)} placeholder="Airbnb" />
          </label>
          <label>
            Role
            <input value={form.role} onChange={(event) => updateField("role", event.target.value)} placeholder="Software Engineer Intern" />
          </label>
          <label>
            Season
            <select value={form.season} onChange={(event) => updateField("season", event.target.value)}>
              <option>2026 Fall</option>
              <option>2027</option>
              <option>New Grad</option>
            </select>
          </label>
          <label>
            Stage
            <select value={form.stage} onChange={(event) => updateField("stage", event.target.value)}>
              {stages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Deadline
            <input type="date" value={form.deadline} onChange={(event) => updateField("deadline", event.target.value)} />
          </label>
          <label>
            Location
            <input value={form.location} onChange={(event) => updateField("location", event.target.value)} placeholder="Seattle, WA" />
          </label>
          <label>
            Posting URL
            <input value={form.sourceUrl} onChange={(event) => updateField("sourceUrl", event.target.value)} placeholder="https://..." />
          </label>
          <div className="modal-actions">
            <button className="secondary-button" type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="primary-button" type="submit">
              <Plus size={16} aria-hidden="true" />
              Add Job
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function ViewHeader({ eyebrow, title, children }) {
  return (
    <section className="view-header">
      <div>
        <span>{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  );
}

function EmptyState({ icon: Icon = Search, title, text, children }) {
  return (
    <div className="empty-state">
      <Icon size={22} aria-hidden="true" />
      <strong>{title}</strong>
      <span>{text}</span>
      {children}
    </div>
  );
}

function ProfileImagePicker({ value, onChange, compact = false }) {
  return (
    <div className={classNames("profile-image-picker", compact && "is-compact")} aria-label="Profile image presets">
      {profilePresets.map((preset) => (
        <button
          key={preset.id}
          className={preset.src === value ? "is-selected" : ""}
          type="button"
          onClick={() => onChange(preset.src)}
          aria-label={`Use ${preset.label} profile image`}
        >
          <img src={preset.src} alt="" />
          <span>{preset.label}</span>
        </button>
      ))}
    </div>
  );
}

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
        const slotWidth = buttonRef.current.closest(".auth-form")?.clientWidth || buttonRef.current.clientWidth || 320;
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

function AuthScreen({ onLogin, onRegister, onGoogleCredential }) {
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
    <main className="auth-shell">
      <section className="auth-card">
        <div className="auth-visual">
          <img src={draft.avatar} alt="" />
          <div>
            <strong>Career Tracker</strong>
            <span>Internship + New Grad</span>
          </div>
        </div>
        <form className="auth-form" onSubmit={submit}>
          <div>
            <p>{isRegister ? "Create account" : "Welcome back"}</p>
            <h1>{isRegister ? "Register your tracker" : "Log in to your tracker"}</h1>
          </div>
          {isRegister && (
            <label>
              Name
              <input value={draft.name} onChange={(event) => update("name", event.target.value)} placeholder="Your name" />
            </label>
          )}
          <label>
            Email
            <input value={draft.email} onChange={(event) => update("email", event.target.value)} placeholder="you@example.com" />
          </label>
          <label>
            Password
            <input
              type="password"
              value={draft.password}
              onChange={(event) => update("password", event.target.value)}
              placeholder="Database account password"
            />
          </label>
          {isRegister && <ProfileImagePicker value={draft.avatar} onChange={(avatar) => update("avatar", avatar)} compact />}
          {error && <span className="auth-error">{error}</span>}
          <button className="primary-button" type="submit" disabled={loading}>
            {loading ? "Connecting" : isRegister ? "Create Account" : "Log In"}
          </button>
          <div className="auth-divider">
            <span>or</span>
          </div>
          <GoogleSignInButton disabled={loading} onCredential={onGoogleCredential} />
          <button
            className="text-button auth-switch"
            type="button"
            onClick={() => {
              setMode(isRegister ? "login" : "register");
              setError("");
            }}
          >
            {isRegister ? "Already have an account? Log in" : "Need an account? Register"}
          </button>
        </form>
      </section>
    </main>
  );
}

function LiveSearchView({
  liveJobs,
  liveStatus,
  liveQuery,
  liveSeason,
  liveRemote,
  liveTotal,
  liveFilteredTotal,
  liveLimit,
  setLiveQuery,
  setLiveSeason,
  setLiveRemote,
  onLoadMore,
  onClearFilters,
  onRefresh,
  onImport,
  importedIds,
  fetchedAt,
  sources,
}) {
  const hasActiveFilters = Boolean(liveQuery.trim()) || liveSeason !== "all" || liveRemote !== "all";
  const [previewJob, setPreviewJob] = useState(null);

  useEffect(() => {
    if (!previewJob) return undefined;
    function closeOnEscape(event) {
      if (event.key === "Escape") setPreviewJob(null);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [previewJob]);

  return (
    <section className="view-shell live-search-view">
      <ViewHeader eyebrow="Live Search" title="Real internship feed">
        <button className="primary-button" type="button" onClick={() => onRefresh(true)} disabled={liveStatus === "loading"}>
          <RefreshCcw size={16} aria-hidden="true" />
          {liveStatus === "loading" ? "Fetching" : "Refresh Feed"}
        </button>
      </ViewHeader>

      <div className="live-toolbar">
        <label className="search-box live-search-box">
          <Search size={18} aria-hidden="true" />
          <span className="sr-only">Search live opportunities</span>
          <input value={liveQuery} onChange={(event) => setLiveQuery(event.target.value)} placeholder="Software, ML, data, company..." />
        </label>
        <label>
          Track
          <select value={liveSeason} onChange={(event) => setLiveSeason(event.target.value)}>
            <option value="all">All</option>
            <option value="internship">Internship</option>
            <option value="fall2026">2026 Fall</option>
            <option value="2027">2027</option>
            <option value="newgrad">New Grad</option>
          </select>
        </label>
        <label>
          Mode
          <select value={liveRemote} onChange={(event) => setLiveRemote(event.target.value)}>
            <option value="all">All</option>
            <option value="remote">Remote</option>
            <option value="hybrid">Hybrid</option>
            <option value="on-site">On-site</option>
          </select>
        </label>
        {hasActiveFilters && (
          <button className="secondary-button clear-filter-button" type="button" onClick={onClearFilters}>
            <X size={15} aria-hidden="true" />
            Clear
          </button>
        )}
      </div>

      <div className="source-row">
        <article>
          <strong>{liveJobs.length}</strong>
          <span>shown now</span>
        </article>
        <article>
          <strong>{liveFilteredTotal}</strong>
          <span>matching filters</span>
        </article>
        <article>
          <strong>{liveTotal}</strong>
          <span>indexed roles</span>
        </article>
        <article>
          <strong>{sources?.length || 0}</strong>
          <span>public sources</span>
        </article>
      </div>

      <div className="filter-summary">
        <span>
          {hasActiveFilters
            ? `Showing ${liveFilteredTotal} matches from ${liveTotal} indexed roles. Last fetch ${fetchedAt ? formatDate(fetchedAt.slice(0, 10), { month: "short", day: "numeric" }) : "-"}`
            : `Showing the top ${liveJobs.length} live roles from ${liveTotal} indexed roles.`}
        </span>
      </div>

      {liveStatus === "error" && (
        <div className="no-results">
          <ShieldCheck size={22} aria-hidden="true" />
          <strong>Live feed could not refresh</strong>
          <span>The pipeline still works with saved jobs. Try refresh again.</span>
        </div>
      )}

      {liveStatus !== "loading" && liveJobs.length === 0 && (
        <EmptyState
          icon={Search}
          title="No live roles yet"
          text="Refresh the feed or broaden the filters. The pipeline stays empty until you import or add roles."
        />
      )}

      <div className="opportunity-list">
        {liveJobs.map((job) => {
          const imported = importedIds.has(job.id);
          const sourceUrl = safeExternalUrl(job.sourceUrl);
          const hasSource = Boolean(sourceUrl);
          return (
            <article key={job.id} className="opportunity-row">
              <CompanyLogo company={job.company} />
              <div className="opportunity-main">
                <div>
                  <h3>{job.role}</h3>
                  <p>
                    {job.company} · {job.location}
                  </p>
                </div>
                <div className="tag-list">
                  <span>{job.season}</span>
                  <span>{job.mode}</span>
                  <span>{job.source}</span>
                  {(job.tags || []).slice(0, 2).map((tag) => (
                    <span key={`${job.id}-${tag}`}>{tag}</span>
                  ))}
                </div>
                <div className="opportunity-detail-strip">
                  <span>Posted {job.posted || "Recently"}</span>
                  <span>{job.sponsorship === "Unknown" ? "Sponsorship: verify" : job.sponsorship}</span>
                  <span>{sourceUrl ? "Apply link ready" : "Source link missing"}</span>
                </div>
                {job.summary && <p className="opportunity-summary">{job.summary}</p>}
              </div>
              <div className="opportunity-score">
                <strong>{job.match}</strong>
                <span>match</span>
              </div>
              <div className="opportunity-actions">
                <button className="secondary-button opportunity-preview-button" type="button" onClick={() => setPreviewJob(job)}>
                  <Eye size={14} aria-hidden="true" />
                  Preview
                </button>
                {hasSource ? (
                  <a className="secondary-button" href={sourceUrl} target="_blank" rel="noreferrer">
                    Apply <ArrowUpRight size={14} aria-hidden="true" />
                  </a>
                ) : (
                  <button className="secondary-button" type="button" disabled>
                    Apply
                  </button>
                )}
                <button className="primary-button" type="button" onClick={() => onImport(job)} disabled={imported}>
                  {imported ? "Imported" : "Import"}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {liveFilteredTotal > liveJobs.length && (
        <button className="secondary-button load-more-button" type="button" onClick={onLoadMore} disabled={liveStatus === "loading"}>
          <Plus size={16} aria-hidden="true" />
          Load more live roles
        </button>
      )}

      {previewJob && (
        <OpportunityPreviewModal
          job={previewJob}
          imported={importedIds.has(previewJob.id)}
          onClose={() => setPreviewJob(null)}
          onImport={onImport}
        />
      )}
    </section>
  );
}

function CompaniesView({ jobs, liveJobs, onSelectCompany }) {
  const companies = useMemo(() => {
    const map = new Map();
    const trackedIds = new Set(jobs.map((job) => job.id));
    for (const job of [...jobs, ...liveJobs.slice(0, 80)]) {
      const current = map.get(job.company) || {
        company: job.company,
        tracked: 0,
        live: 0,
        bestMatch: 0,
        locations: new Set(),
        roles: new Set(),
      };
      if (trackedIds.has(job.id)) current.tracked += 1;
      else current.live += 1;
      current.bestMatch = Math.max(current.bestMatch, job.match || 0);
      current.locations.add(job.location);
      current.roles.add(job.role);
      map.set(job.company, current);
    }
    return [...map.values()].sort((left, right) => right.bestMatch - left.bestMatch).slice(0, 18);
  }, [jobs, liveJobs]);

  return (
    <section className="view-shell">
      <ViewHeader eyebrow="Companies" title="Target company map" />
      {companies.length === 0 && (
        <EmptyState icon={Building2} title="No companies loaded" text="The company map builds from the live feed and imported roles." />
      )}
      <div className="company-grid">
        {companies.map((company) => (
          <button key={company.company} className="company-card" type="button" onClick={() => onSelectCompany(company.company)}>
            <CompanyLogo company={company.company} />
            <strong>{company.company}</strong>
            <span>{company.roles.size} roles · {company.locations.size} locations</span>
            <div>
              <small>{company.tracked} tracked</small>
              <small>{company.live} live</small>
              <small>{company.bestMatch} match</small>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

function ContactsView({ contacts, jobs, onAddContact, onCreateTask, onSelectJob }) {
  const [draft, setDraft] = useState({ name: "", company: "", role: "", email: "", next: "" });
  const jobContacts = jobs
    .filter((job) => job.contact)
    .map((job) => ({
      id: `job-${job.id}`,
      name: job.contact,
      role: job.contactRole,
      company: job.company,
      email: job.contactEmail,
      next: job.nextStep,
      source: "Pipeline",
      sourceJobId: job.id,
    }));
  const rows = [...contacts.map((contact) => ({ ...contact, source: contact.source || "Manual" })), ...jobContacts]
    .filter((contact, index, list) => {
      const key = `${String(contact.email || "").toLowerCase()}-${String(contact.name || "").toLowerCase()}-${String(contact.company || "").toLowerCase()}`;
      return list.findIndex((item) => `${String(item.email || "").toLowerCase()}-${String(item.name || "").toLowerCase()}-${String(item.company || "").toLowerCase()}` === key) === index;
    })
    .sort((left, right) => String(left.company || "").localeCompare(String(right.company || "")));
  const stats = [
    { label: "contacts", value: rows.length },
    { label: "with email", value: rows.filter((contact) => contact.email).length },
    { label: "linked roles", value: rows.filter((contact) => contact.sourceJobId).length },
  ];

  function update(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function submit(event) {
    event.preventDefault();
    if (!draft.name.trim() || !draft.company.trim()) return;
    onAddContact({
      id: `contact-${Date.now()}`,
      name: draft.name.trim(),
      company: draft.company.trim(),
      role: draft.role.trim(),
      email: draft.email.trim(),
      next: draft.next.trim() || "Follow up when ready.",
      source: "Manual",
    });
    setDraft({ name: "", company: "", role: "", email: "", next: "" });
  }

  function createFollowUp(contact) {
    const due = new Date();
    due.setDate(due.getDate() + 2);
    onCreateTask({
      title: `Follow up with ${contact.name}`,
      subtitle: `${contact.company || "Contact"} · ${contact.role || "Networking"}`,
      due: due.toISOString().slice(0, 10),
      priority: "High",
      sourceJobId: contact.sourceJobId || "",
      icon: Mail,
    });
  }

  return (
    <section className="view-shell">
      <ViewHeader eyebrow="Contacts" title="Recruiter and alumni CRM" />
      <div className="utility-stat-row">
        {stats.map((item) => (
          <article key={item.label}>
            <strong>{item.value}</strong>
            <span>{item.label}</span>
          </article>
        ))}
      </div>
      <form className="inline-data-form" onSubmit={submit}>
        <input value={draft.name} onChange={(event) => update("name", event.target.value)} placeholder="Name" />
        <input value={draft.company} onChange={(event) => update("company", event.target.value)} placeholder="Company" />
        <input value={draft.role} onChange={(event) => update("role", event.target.value)} placeholder="Role or note" />
        <input value={draft.email} onChange={(event) => update("email", event.target.value)} placeholder="Email" />
        <input value={draft.next} onChange={(event) => update("next", event.target.value)} placeholder="Next touch" />
        <button className="secondary-button" type="submit">
          <Plus size={16} aria-hidden="true" />
          Add Contact
        </button>
      </form>
      {rows.length === 0 && (
        <EmptyState icon={Users} title="No contacts yet" text="Add recruiters, alumni, or referrals here as you find them." />
      )}
      <div className="contact-grid">
        {rows.map((contact) => (
          <article key={contact.id || `${contact.company}-${contact.name}`} className="contact-card">
            <div className="contact-card-head">
              <span className="contact-avatar">{contact.name.slice(0, 2).toUpperCase()}</span>
              <span>
                <strong>{contact.name}</strong>
                <p>{contact.role || "Contact"} · {contact.company || "Company"}</p>
              </span>
              <small>{contact.source}</small>
            </div>
            <div className="contact-next">
              <Clock3 size={14} aria-hidden="true" />
              <span>{contact.next || "Add a next touch after your conversation."}</span>
            </div>
            <div className="contact-actions">
              {contact.email ? (
                <a
                  className="secondary-button"
                  href={`mailto:${contact.email}?subject=${encodeURIComponent(`Following up about ${contact.company || "opportunities"}`)}`}
                >
                  <Mail size={14} aria-hidden="true" />
                  Email
                </a>
              ) : (
                <button className="secondary-button" type="button" disabled>
                  <Mail size={14} aria-hidden="true" />
                  Email
                </button>
              )}
              <button className="secondary-button" type="button" onClick={() => createFollowUp(contact)}>
                <Plus size={14} aria-hidden="true" />
                Task
              </button>
              {contact.sourceJobId && (
                <button className="secondary-button" type="button" onClick={() => onSelectJob(contact.sourceJobId)}>
                  <BriefcaseBusiness size={14} aria-hidden="true" />
                  Role
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function CalendarView({ jobs, tasks, onSelectJob, onToggleTask }) {
  const todayKey = new Date().toISOString().slice(0, 10);
  const [monthDate, setMonthDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const events = [
    ...jobs
      .filter((job) => job.deadline)
      .map((job) => ({
        id: `job-${job.id}`,
        type: "Deadline",
        date: job.deadline,
        title: `${job.company} application`,
        description: `${job.role} · ${stages.find((stage) => stage.id === job.stage)?.label || "Pipeline"}`,
        stage: job.stage,
        jobId: job.id,
      })),
    ...tasks
      .filter((task) => task.due)
      .map((task) => ({
        id: `task-${task.id}`,
        type: task.done ? "Done" : "Task",
        date: task.due,
        title: task.title,
        description: task.subtitle || task.priority || "Task",
        taskId: task.id,
        done: task.done,
      })),
  ].sort((left, right) => compareDateValues(left.date, right.date));
  const eventsByDate = events.reduce((map, event) => {
    const key = dateKey(event.date);
    if (!key) return map;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(event);
    return map;
  }, new Map());
  const calendarDays = buildCalendarDays(monthDate);
  const selectedEvents = eventsByDate.get(selectedDate) || [];
  const upcomingEvents = events
    .filter((event) => !event.done && daysUntil(event.date) >= 0)
    .slice(0, 6);
  const stats = [
    { label: "overdue", value: events.filter((event) => !event.done && daysUntil(event.date) < 0).length },
    { label: "today", value: events.filter((event) => !event.done && daysUntil(event.date) === 0).length },
    { label: "next 7 days", value: events.filter((event) => !event.done && daysUntil(event.date) >= 0 && daysUntil(event.date) <= 7).length },
  ];

  function downloadEvent(event) {
    const file = createCalendarFile(event);
    if (!file) return;
    const filename = `${event.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "career-event"}.ics`;
    downloadBlob(new Blob([file], { type: "text/calendar;charset=utf-8" }), filename);
  }

  function renderEventActions(event) {
    return (
      <div className="calendar-actions">
        {event.jobId && (
          <button className="secondary-button" type="button" onClick={() => onSelectJob(event.jobId)}>
            Open
          </button>
        )}
        {event.taskId && !event.done && (
          <button className="secondary-button" type="button" onClick={() => onToggleTask(event.taskId)}>
            Done
          </button>
        )}
        <button className="secondary-button" type="button" onClick={() => downloadEvent(event)}>
          <Download size={14} aria-hidden="true" />
          ICS
        </button>
      </div>
    );
  }

  function renderAgendaEvent(event) {
    return (
      <article key={event.id} className={classNames("calendar-event", event.done && "is-done")}>
        <span className={classNames("calendar-dot", event.stage ? `dot-${event.stage}` : "dot-task")} />
        <div>
          <strong>{formatDate(event.date, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</strong>
          <p>{event.title} · {event.description}</p>
        </div>
        <span className={classNames("date-chip", daysUntil(event.date) < 0 && !event.done && "is-overdue")}>
          {event.type} · {formatRelativeDate(event.date)}
        </span>
        {renderEventActions(event)}
      </article>
    );
  }

  return (
    <section className="view-shell">
      <ViewHeader eyebrow="Calendar" title="Deadlines and interviews" />
      <div className="utility-stat-row">
        {stats.map((item) => (
          <article key={item.label}>
            <strong>{item.value}</strong>
            <span>{item.label}</span>
          </article>
        ))}
      </div>
      {events.length === 0 && (
        <EmptyState icon={CalendarDays} title="No dates yet" text="Role deadlines and task due dates will appear here automatically." />
      )}
      <div className="calendar-workspace">
        <article className="calendar-month-card">
          <div className="calendar-toolbar">
            <button className="icon-button" type="button" onClick={() => setMonthDate((current) => addMonths(current, -1))} aria-label="Previous month">
              <ChevronLeft size={17} aria-hidden="true" />
            </button>
            <span>
              <strong>{formatDate(monthDate, { month: "long", year: "numeric" })}</strong>
              <small>{events.length} scheduled items</small>
            </span>
            <button
              className="secondary-button"
              type="button"
              onClick={() => {
                const today = new Date();
                setMonthDate(today);
                setSelectedDate(todayKey);
              }}
            >
              Today
            </button>
            <button className="icon-button" type="button" onClick={() => setMonthDate((current) => addMonths(current, 1))} aria-label="Next month">
              <ChevronRight size={17} aria-hidden="true" />
            </button>
          </div>
          <div className="calendar-weekdays" aria-hidden="true">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="calendar-grid">
            {calendarDays.map((day) => {
              const dayEvents = eventsByDate.get(day.key) || [];
              return (
                <button
                  key={day.key}
                  className={classNames(
                    "calendar-day",
                    !day.currentMonth && "is-muted",
                    day.key === todayKey && "is-today",
                    day.key === selectedDate && "is-selected",
                    dayEvents.length > 0 && "has-events",
                  )}
                  type="button"
                  onClick={() => setSelectedDate(day.key)}
                >
                  <span className="calendar-day-number">{day.date.getDate()}</span>
                  <span className="calendar-day-events">
                    {dayEvents.slice(0, 3).map((event) => (
                      <span key={event.id} className={classNames("calendar-pill", event.stage ? `tone-${event.stage}` : "tone-task", event.done && "is-done")}>
                        {event.type}
                      </span>
                    ))}
                    {dayEvents.length > 3 && <span className="calendar-more">+{dayEvents.length - 3}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        </article>

        <aside className="calendar-agenda-panel">
          <div className="calendar-agenda-head">
            <span>
              <small>Selected date</small>
              <strong>{formatDate(selectedDate, { weekday: "long", month: "short", day: "numeric" })}</strong>
            </span>
            <span className="date-chip">{selectedEvents.length} items</span>
          </div>
          <div className="calendar-agenda-list">
            {selectedEvents.length > 0 ? (
              selectedEvents.map(renderAgendaEvent)
            ) : (
              <EmptyState icon={CalendarDays} title="No items on this date" text="Pick another date or add a task with a due date." />
            )}
          </div>
          {upcomingEvents.length > 0 && (
            <>
              <div className="calendar-agenda-subhead">Upcoming</div>
              <div className="calendar-agenda-list is-compact">
                {upcomingEvents.map(renderAgendaEvent)}
              </div>
            </>
          )}
        </aside>
      </div>
      <div className="timeline-list calendar-timeline">
        {events.map((event) => (
          <article key={event.id} className={classNames("calendar-event", event.done && "is-done")}>
            <span className={classNames("calendar-dot", event.stage ? `dot-${event.stage}` : "dot-task")} />
            <div>
              <strong>{formatDate(event.date, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</strong>
              <p>{event.title} · {event.description}</p>
            </div>
            <span className={classNames("date-chip", daysUntil(event.date) < 0 && !event.done && "is-overdue")}>
              {event.type} · {formatRelativeDate(event.date)}
            </span>
            {renderEventActions(event)}
          </article>
        ))}
      </div>
    </section>
  );
}

function TasksView({ tasks, jobs, onToggleTask, onAddTask }) {
  const [draft, setDraft] = useState({ title: "", due: "", priority: "Medium" });
  const [filter, setFilter] = useState("open");
  const suggestions = jobs
    .filter((job) => job.stage !== "offer")
    .slice(0, 5)
    .map((job) => {
      const stageLabel = stages.find((stage) => stage.id === job.stage)?.label || "Pipeline";
      const templates = {
        saved: { title: `Tailor resume for ${job.company}`, subtitle: `${job.role} · apply after eligibility check`, icon: Pencil, priority: "High" },
        applied: { title: `Follow up with ${job.company}`, subtitle: `${job.role} · check status or recruiter contact`, icon: Mail, priority: "Medium" },
        oa: { title: `Prep OA for ${job.company}`, subtitle: `${job.role} · practice timed problems`, icon: FlaskConical, priority: "High" },
        interview: { title: `Prep interview notes for ${job.company}`, subtitle: `${job.role} · stories, questions, and system design`, icon: Users, priority: "High" },
      };
      return {
        id: `suggestion-${job.id}`,
        sourceJobId: job.id,
        due: job.deadline || "",
        ...(templates[job.stage] || { title: `Move ${job.company} forward`, subtitle: `${job.role} · ${stageLabel}`, icon: CheckSquare2, priority: "Medium" }),
      };
    })
    .filter((suggestion) => !tasks.some((task) => task.title === suggestion.title));
  const sortedTasks = [...tasks].sort((left, right) => {
    if (left.done !== right.done) return left.done ? 1 : -1;
    const dueCompare = compareDateValues(left.due, right.due);
    if (dueCompare !== 0) return dueCompare;
    const priorityRank = { High: 0, Medium: 1, Low: 2 };
    return (priorityRank[left.priority] ?? 1) - (priorityRank[right.priority] ?? 1);
  });
  const visibleTasks = sortedTasks.filter((task) => {
    if (filter === "done") return task.done;
    if (filter === "due") return !task.done && task.due && daysUntil(task.due) <= 7;
    if (filter === "all") return true;
    return !task.done;
  });
  const stats = [
    { label: "open", value: tasks.filter((task) => !task.done).length },
    { label: "due soon", value: tasks.filter((task) => !task.done && task.due && daysUntil(task.due) <= 7).length },
    { label: "done", value: tasks.filter((task) => task.done).length },
  ];

  function submit(event) {
    event.preventDefault();
    if (!draft.title.trim()) return;
    onAddTask({
      title: draft.title.trim(),
      due: draft.due,
      priority: draft.priority,
      subtitle: draft.due ? `Due ${formatDate(draft.due)} · ${draft.priority} priority` : `${draft.priority} priority`,
      icon: CheckSquare2,
    });
    setDraft({ title: "", due: "", priority: "Medium" });
  }

  return (
    <section className="view-shell">
      <ViewHeader eyebrow="Tasks" title="Weekly action list" />
      <div className="utility-stat-row">
        {stats.map((item) => (
          <article key={item.label}>
            <strong>{item.value}</strong>
            <span>{item.label}</span>
          </article>
        ))}
      </div>
      <form className="task-form" onSubmit={submit}>
        <input value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Add a follow-up, prep block, or application task" />
        <input type="date" value={draft.due} onChange={(event) => setDraft((current) => ({ ...current, due: event.target.value }))} aria-label="Task due date" />
        <select value={draft.priority} onChange={(event) => setDraft((current) => ({ ...current, priority: event.target.value }))} aria-label="Task priority">
          <option>High</option>
          <option>Medium</option>
          <option>Low</option>
        </select>
        <button className="primary-button" type="submit">
          <Plus size={16} aria-hidden="true" />
          Add
        </button>
      </form>
      <div className="task-filter-row" role="tablist" aria-label="Task filters">
        {[
          ["open", "Open"],
          ["due", "Due soon"],
          ["done", "Done"],
          ["all", "All"],
        ].map(([id, label]) => (
          <button key={id} className={classNames(filter === id && "is-active")} type="button" onClick={() => setFilter(id)}>
            {label}
          </button>
        ))}
      </div>
      {suggestions.length > 0 && (
        <div className="suggestion-strip">
          {suggestions.map((suggestion) => {
            const Icon = suggestion.icon;
            return (
              <button key={suggestion.id} type="button" onClick={() => onAddTask(suggestion)}>
                <Icon size={15} aria-hidden="true" />
                <span>
                  <strong>{suggestion.title}</strong>
                  <small>{suggestion.subtitle}</small>
                </span>
                <Plus size={14} aria-hidden="true" />
              </button>
            );
          })}
        </div>
      )}
      {tasks.length === 0 && (
        <EmptyState icon={CheckSquare2} title="No tasks yet" text="Tasks appear only after you add them." />
      )}
      <div className="task-board-list">
        {visibleTasks.map((task) => {
          const Icon = task.icon || CheckSquare2;
          return (
            <label key={task.id} className={classNames("task-item large-task", task.done && "is-done")}>
              <span className="task-icon" aria-hidden="true">
                <Icon size={18} />
              </span>
              <span>
                <strong>{task.title}</strong>
                <small>{task.subtitle || task.priority || "Task"}</small>
              </span>
              <span className={classNames("date-chip", task.due && daysUntil(task.due) < 0 && !task.done && "is-overdue")}>
                {task.due ? formatRelativeDate(task.due) : task.priority || "Task"}
              </span>
              <input checked={task.done} onChange={() => onToggleTask(task.id)} type="checkbox" aria-label={`Complete ${task.title}`} />
            </label>
          );
        })}
      </div>
    </section>
  );
}

function DocumentsView({
  documents,
  jobs,
  authToken,
  onAddDocument,
  onUpdateDocument,
  onDeleteDocument,
  onDuplicateDocument,
  onSelectJob,
  onToast,
}) {
  const fileInputRef = useRef(null);
  const [draft, setDraft] = useState(blankDocumentDraft);
  const [editingId, setEditingId] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  const [fileNotice, setFileNotice] = useState("");
  const [previewDocument, setPreviewDocument] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const targetOptions = useMemo(() => {
    const seen = new Set(["General"]);
    const options = ["General"];
    jobs.forEach((job) => {
      const label = getJobDocumentLabel(job);
      if (!seen.has(label)) {
        seen.add(label);
        options.push(label);
      }
    });
    return options;
  }, [jobs]);
  const jobOptions = useMemo(
    () => [...jobs].sort((left, right) => getJobDocumentLabel(left).localeCompare(getJobDocumentLabel(right))),
    [jobs],
  );
  const jobById = useMemo(() => new Map(jobs.map((job) => [job.id, job])), [jobs]);
  const jobByLabel = useMemo(() => new Map(jobs.map((job) => [getJobDocumentLabel(job), job])), [jobs]);

  function resolveDocumentJob(document) {
    return jobById.get(document.sourceJobId) || jobByLabel.get(document.target) || null;
  }

  const filteredDocuments = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return documents.filter((document) => {
      const linkedJob = resolveDocumentJob(document);
      const matchesStatus = statusFilter === "All" || document.status === statusFilter;
      const matchesType = typeFilter === "All" || document.type === typeFilter;
      const blob = `${document.name} ${document.type} ${document.status} ${document.target} ${document.url} ${document.notes} ${linkedJob ? getJobDocumentLabel(linkedJob) : ""}`.toLowerCase();
      return matchesStatus && matchesType && (!needle || blob.includes(needle));
    });
  }, [documents, query, statusFilter, typeFilter, jobById, jobByLabel]);

  const readyCount = documents.filter((document) => document.status === "Ready" || document.status === "Submitted").length;
  const reviewCount = documents.filter((document) => document.status === "Needs Review").length;
  const linkedCount = documents.filter((document) => resolveDocumentJob(document)).length;
  const sortedDocumentUpdates = documents
    .map((document) => document.updated)
    .filter(Boolean)
    .sort();
  const latestUpdate = sortedDocumentUpdates[sortedDocumentUpdates.length - 1];

  useEffect(() => {
    if (!previewDocument) return undefined;
    function closeOnEscape(event) {
      if (event.key === "Escape") setPreviewDocument(null);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [previewDocument]);

  function update(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function updateLinkedJob(jobId) {
    const linkedJob = jobById.get(jobId);
    setDraft((current) => ({
      ...current,
      sourceJobId: linkedJob ? linkedJob.id : "",
      target: linkedJob ? getJobDocumentLabel(linkedJob) : current.target || "General",
    }));
  }

  function resetDraft() {
    setDraft(blankDocumentDraft);
    setEditingId("");
    setFileNotice("");
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function editDocument(document) {
    const linkedJob = resolveDocumentJob(document);
    setDraft({
      ...blankDocumentDraft,
      ...document,
      target: document.target || "General",
      sourceJobId: linkedJob?.id || document.sourceJobId || "",
    });
    setEditingId(document.id);
    setFileNotice(document.fileName ? `${document.fileName}${document.fileSize ? ` · ${formatBytes(document.fileSize)}` : ""}` : "");
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function clearAttachedFile() {
    setDraft((current) => ({
      ...current,
      fileName: "",
      fileType: "",
      fileSize: 0,
      fileData: "",
      fileKey: "",
      fileUrl: "",
      storage: "",
    }));
    setFileNotice("");
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const fileMeta = {
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
    };
    if (file.size > uploadDocumentLimit) {
      setDraft((current) => ({
        ...current,
        ...fileMeta,
        fileData: "",
        fileKey: "",
        fileUrl: "",
        storage: "",
      }));
      setSelectedFile(null);
      setFileNotice(`${file.name} is over 10 MB`);
      onToast("Use a file under 10 MB");
      return;
    }
    setSelectedFile(file);
    setDraft((current) => ({
      ...current,
      ...fileMeta,
      fileData: "",
      fileKey: "",
      fileUrl: "",
      storage: "",
    }));
    setFileNotice(`${file.name} · ${formatBytes(file.size)} ready to upload`);
  }

  async function submit(event) {
    event.preventDefault();
    if (!draft.name.trim() || uploading) return;
    setUploading(true);
    try {
      const uploadedMeta = selectedFile ? await uploadDocumentFile(selectedFile, authToken) : {};
      const linkedJob = jobById.get(draft.sourceJobId);
      const nextDocument = normalizeDocument({
        ...draft,
        ...uploadedMeta,
        id: editingId || `document-${Date.now()}`,
        name: draft.name.trim(),
        url: safeExternalUrl(draft.url),
        target: linkedJob ? getJobDocumentLabel(linkedJob) : draft.target.trim() || "General",
        sourceJobId: linkedJob?.id || "",
        owner: draft.owner.trim(),
        notes: draft.notes.trim(),
        version: draft.version.trim() || "v1",
        status: draft.status,
        fileData: uploadedMeta.fileUrl ? "" : draft.fileData,
        updated: new Date().toISOString(),
      });
      if (editingId) {
        onUpdateDocument(editingId, nextDocument);
      } else {
        onAddDocument(nextDocument);
      }
      resetDraft();
    } catch (error) {
      onToast(error instanceof Error ? error.message : "File could not upload");
    } finally {
      setUploading(false);
    }
  }

  async function copyLink(document) {
    const link = safeExternalUrl(document.url);
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      onToast(`${document.name} link copied`);
    } catch {
      onToast("Link could not be copied");
    }
  }

  function openPreview(document) {
    if (!document.fileData && !safeDocumentFileUrl(document.fileUrl) && !isOpenableUrl(document.url)) {
      onToast("Add a file or link before previewing");
      return;
    }
    setPreviewDocument(document);
  }

  return (
    <section className="view-shell">
      <ViewHeader eyebrow="Documents" title="Resume and application assets" />
      <div className="document-stats">
        <article>
          <strong>{documents.length}</strong>
          <span>assets</span>
        </article>
        <article>
          <strong>{readyCount}</strong>
          <span>ready</span>
        </article>
        <article>
          <strong>{reviewCount}</strong>
          <span>needs review</span>
        </article>
        <article>
          <strong>{linkedCount}</strong>
          <span>linked roles</span>
        </article>
        <article>
          <strong>{latestUpdate ? formatDate(latestUpdate, { month: "short", day: "numeric" }) : "None"}</strong>
          <span>last update</span>
        </article>
      </div>

      <div className="document-workspace">
        <form className="document-form" onSubmit={submit}>
          <div className="document-form-head">
            <FileText size={18} aria-hidden="true" />
            <span>
              <strong>{editingId ? "Edit asset" : "New asset"}</strong>
              <small>{editingId ? "Updating saved document" : "Saved to your workspace"}</small>
            </span>
          </div>
          <label>
            Name
            <input value={draft.name} onChange={(event) => update("name", event.target.value)} placeholder="SWE resume v1" />
          </label>
          <label>
            Type
            <select value={draft.type} onChange={(event) => update("type", event.target.value)}>
              {documentTypeOptions.map((type) => <option key={type}>{type}</option>)}
            </select>
          </label>
          <label>
            Status
            <select value={draft.status} onChange={(event) => update("status", event.target.value)}>
              {documentStatusOptions.map((status) => <option key={status}>{status}</option>)}
            </select>
          </label>
          <label>
            Target
            <select value={draft.target} onChange={(event) => update("target", event.target.value)}>
              {targetOptions.map((target) => <option key={target}>{target}</option>)}
            </select>
          </label>
          <label>
            Linked saved job
            <select value={draft.sourceJobId} onChange={(event) => updateLinkedJob(event.target.value)}>
              <option value="">No linked job</option>
              {jobOptions.map((job) => (
                <option key={job.id} value={job.id}>
                  {getJobDocumentLabel(job)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Version
            <input value={draft.version} onChange={(event) => update("version", event.target.value)} placeholder="v1" />
          </label>
          <label>
            Owner
            <input value={draft.owner} onChange={(event) => update("owner", event.target.value)} placeholder="Self, mentor, recruiter" />
          </label>
          <label className="document-wide-field">
            Link
            <input value={draft.url} onChange={(event) => update("url", event.target.value)} placeholder="https://drive.google.com/..." />
          </label>
          <label className="document-file-field">
            File
            <input ref={fileInputRef} type="file" onChange={handleFileChange} />
            <span>
              <Upload size={15} aria-hidden="true" />
              {fileNotice || "Choose file"}
            </span>
          </label>
          {draft.fileName && (
            <button className="text-button document-clear-file" type="button" onClick={clearAttachedFile}>
              Remove file
            </button>
          )}
          <label className="document-wide-field">
            Notes
            <textarea value={draft.notes} onChange={(event) => update("notes", event.target.value)} placeholder="Tailoring notes, reviewer feedback, or usage rules" />
          </label>
          <div className="document-form-actions">
            {editingId && (
              <button className="secondary-button" type="button" onClick={resetDraft} disabled={uploading}>
                Cancel
              </button>
            )}
            <button className="primary-button" type="submit" disabled={uploading}>
              <Plus size={16} aria-hidden="true" />
              {uploading ? "Uploading..." : editingId ? "Save Changes" : "Add Asset"}
            </button>
          </div>
        </form>

        <div className="document-library">
          <div className="document-toolbar">
            <div className="document-search">
              <Search size={16} aria-hidden="true" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search documents" />
            </div>
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
              <option>All</option>
              {documentTypeOptions.map((type) => <option key={type}>{type}</option>)}
            </select>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option>All</option>
              {documentStatusOptions.map((status) => <option key={status}>{status}</option>)}
            </select>
          </div>

          {documents.length === 0 && (
            <EmptyState icon={FileText} title="No documents yet" text="Add resumes, templates, or portfolio links when you create them." />
          )}
          {documents.length > 0 && filteredDocuments.length === 0 && (
            <EmptyState icon={Filter} title="No matching documents" text="Adjust the filters or search term." />
          )}
          <div className="document-grid">
            {filteredDocuments.map((doc) => {
              const documentUrl = safeExternalUrl(doc.url);
              const fileUrl = safeDocumentFileUrl(doc.fileUrl);
              const downloadUrl = getDocumentDownloadUrl(doc);
              const linkedJob = resolveDocumentJob(doc);
              const canOpenLink = Boolean(documentUrl);
              const canPreview = Boolean(doc.fileData || fileUrl || canOpenLink);
              return (
                <article key={doc.id} className="document-card">
                  <div className="document-card-head">
                    <span className="document-icon" aria-hidden="true">
                      <FileText size={18} />
                    </span>
                    <span>
                      <strong>{doc.name}</strong>
                      <small>{doc.type} · {linkedJob ? getJobDocumentLabel(linkedJob) : doc.target || "General"}</small>
                    </span>
                    <small className={classNames("document-status", `is-${doc.status.toLowerCase().replace(/\s+/g, "-")}`)}>
                      {doc.status}
                    </small>
                  </div>
                  <div className="document-meta">
                    <span>
                      Version
                      <strong>{doc.version}</strong>
                    </span>
                    <span>
                      Updated
                      <strong>{formatDate(doc.updated, { month: "short", day: "numeric" })}</strong>
                    </span>
                    <span>
                      Owner
                      <strong>{doc.owner || "Self"}</strong>
                    </span>
                  </div>
                  {(doc.fileName || doc.url) && (
                    <div className="document-source">
                      {doc.fileName ? `${doc.fileName}${doc.fileSize ? ` · ${formatBytes(doc.fileSize)}` : ""}` : doc.url}
                    </div>
                  )}
                  {doc.notes && <p className="document-notes">{doc.notes}</p>}
                  <div className="document-card-actions">
                    <button
                      className="secondary-button document-preview-trigger"
                      type="button"
                      onClick={() => openPreview(doc)}
                      disabled={!canPreview}
                      aria-label={`Preview ${doc.name}`}
                    >
                      <Eye size={14} aria-hidden="true" />
                      Preview
                    </button>
                    {canOpenLink ? (
                      <a className="secondary-button" href={documentUrl} target="_blank" rel="noreferrer">
                        Open <ArrowUpRight size={14} aria-hidden="true" />
                      </a>
                    ) : downloadUrl ? (
                      <a className="secondary-button" href={downloadUrl} download={doc.fileName || `${doc.name}.txt`}>
                        Download <Download size={14} aria-hidden="true" />
                      </a>
                    ) : doc.fileData ? (
                      <a className="secondary-button" href={doc.fileData} download={doc.fileName || `${doc.name}.txt`}>
                        Download <Download size={14} aria-hidden="true" />
                      </a>
                    ) : (
                      <button className="secondary-button" type="button" disabled>
                        Open
                      </button>
                    )}
                    <button className="secondary-button" type="button" onClick={() => editDocument(doc)} aria-label={`Edit ${doc.name}`}>
                      <Pencil size={14} aria-hidden="true" />
                    </button>
                    <button className="secondary-button" type="button" onClick={() => copyLink(doc)} disabled={!documentUrl} aria-label={`Copy ${doc.name} link`}>
                      <Copy size={14} aria-hidden="true" />
                    </button>
                    {linkedJob && (
                      <button className="secondary-button" type="button" onClick={() => onSelectJob(linkedJob.id)} aria-label={`Open linked role for ${doc.name}`}>
                        <BriefcaseBusiness size={14} aria-hidden="true" />
                        Role
                      </button>
                    )}
                    <button className="secondary-button" type="button" onClick={() => onDuplicateDocument(doc.id)} aria-label={`Duplicate ${doc.name}`}>
                      <Plus size={14} aria-hidden="true" />
                    </button>
                    <button className="secondary-button danger-button" type="button" onClick={() => onDeleteDocument(doc.id)} aria-label={`Delete ${doc.name}`}>
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>

      {previewDocument && (
        <div
          className="modal-backdrop document-preview-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={`${previewDocument.name} preview`}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPreviewDocument(null);
          }}
        >
          <div className="document-preview-modal">
            <div className="document-preview-head">
              <span className="document-icon" aria-hidden="true">
                <FileText size={18} />
              </span>
              <span>
                <strong>{previewDocument.name}</strong>
                <small>
                  {previewDocument.fileName || previewDocument.url || `${previewDocument.type} · ${previewDocument.target || "General"}`}
                </small>
              </span>
              <div className="document-preview-actions">
                {(previewDocument.fileData || getDocumentDownloadUrl(previewDocument)) && (
                  <a
                    className="secondary-button"
                    href={previewDocument.fileData || getDocumentDownloadUrl(previewDocument)}
                    download={previewDocument.fileName || `${previewDocument.name}.txt`}
                  >
                    <Download size={14} aria-hidden="true" />
                    Download
                  </a>
                )}
                {isOpenableUrl(previewDocument.url) && (
                  <a className="secondary-button" href={safeExternalUrl(previewDocument.url)} target="_blank" rel="noreferrer">
                    <ExternalLink size={14} aria-hidden="true" />
                    Open Source
                  </a>
                )}
                <button className="icon-button" type="button" onClick={() => setPreviewDocument(null)} aria-label="Close preview">
                  <X size={18} aria-hidden="true" />
                </button>
              </div>
            </div>
            <DocumentPreviewPanel document={previewDocument} authToken={authToken} />
          </div>
        </div>
      )}
    </section>
  );
}

function AnalyticsView({ jobs }) {
  const sankeyRef = useRef(null);
  const counts = stages.map((stage) => ({
    ...stage,
    count: jobs.filter((job) => job.stage === stage.id).length,
  }));
  const max = Math.max(1, ...counts.map((item) => item.count));
  const offerRate = Math.round((jobs.filter((job) => job.stage === "offer").length / Math.max(1, jobs.length)) * 100);

  return (
    <section className="view-shell">
      <ViewHeader eyebrow="Analytics" title="Pipeline health" />
      <div className="analytics-grid">
        <article className="rail-card">
          <h3>Funnel</h3>
          <div className="funnel-bars">
            {counts.map((item) => (
              <div key={item.id}>
                <span>{item.label}</span>
                <i style={{ width: `${(item.count / max) * 100}%` }} />
                <strong>{item.count}</strong>
              </div>
            ))}
          </div>
        </article>
        <article className="rail-card">
          <h3>Offer Rate</h3>
          <strong className="big-number">{offerRate}%</strong>
          <p>{jobs.length} tracked roles across {new Set(jobs.map((job) => job.company)).size} companies</p>
        </article>
        <article className="rail-card sankey-card">
          <div className="sankey-card-head">
            <span>
              <h3>Job Search Sankey</h3>
              <p>Generated from your saved, applied, OA, interview, and offer pipeline stages.</p>
            </span>
            <div className="sankey-actions">
              <button className="secondary-button" type="button" onClick={() => downloadSvgAsPng(sankeyRef.current, "job-search-sankey.png")}>
                <Download size={14} aria-hidden="true" />
                PNG
              </button>
              <button className="secondary-button" type="button" onClick={() => downloadSvg(sankeyRef.current, "job-search-sankey.svg")}>
                <Download size={14} aria-hidden="true" />
                SVG
              </button>
            </div>
          </div>
          <div className={classNames("sankey-scroll", jobs.length === 0 && "is-empty")}>
            <JobSearchSankey jobs={jobs} svgRef={sankeyRef} />
          </div>
        </article>
      </div>
    </section>
  );
}

function ResourcesView() {
  return (
    <section className="view-shell">
      <ViewHeader eyebrow="Resources" title="Internship search references" />
      <div className="resource-list">
        {resourceLinks.map((resource) => (
          <a key={resource.title} href={resource.url} target="_blank" rel="noreferrer">
            <BookOpen size={18} aria-hidden="true" />
            <span>
              <strong>{resource.title}</strong>
              <small>{resource.type} · {resource.source}</small>
            </span>
            <ArrowUpRight size={15} aria-hidden="true" />
          </a>
        ))}
      </div>
    </section>
  );
}

function SettingsView({
  liveStatus,
  fetchedAt,
  goal = blankGoal,
  currentUser,
  onGoalChange,
  onProfileUpdate,
  onLogout,
  onRefresh,
  onReset,
  sources,
}) {
  const safeGoal = goal || blankGoal;
  const safeProfile = currentUser?.profile || defaultProfile();
  const [draftGoal, setDraftGoal] = useState(safeGoal);
  const [draftProfile, setDraftProfile] = useState(safeProfile);
  const hasGoal = Number(safeGoal.target || 0) > 0;

  useEffect(() => {
    setDraftGoal(safeGoal);
  }, [safeGoal]);

  useEffect(() => {
    setDraftProfile(safeProfile);
  }, [safeProfile]);

  function updateDraftGoal(field, value) {
    setDraftGoal((current) => ({ ...current, [field]: value }));
  }

  function updateDraftProfile(field, value) {
    setDraftProfile((current) => ({ ...current, [field]: value }));
  }

  function saveSettingsGoal(event) {
    event.preventDefault();
    const nextTarget = Math.max(0, Number(draftGoal.target || 0));
    onGoalChange({
      target: nextTarget ? String(nextTarget) : "",
      deadline: draftGoal.deadline || "",
      label: draftGoal.label.trim(),
    });
  }

  function saveProfile(event) {
    event.preventDefault();
    onProfileUpdate(draftProfile);
  }

  return (
    <section className="view-shell">
      <ViewHeader eyebrow="Settings" title="Profile and data sources" />
      <div className="settings-grid">
        <article className="rail-card">
          <h3>Student Profile</h3>
          <form className="profile-settings-form" onSubmit={saveProfile}>
            <div className="profile-preview">
              <img src={draftProfile.avatar} alt="" />
              <span>
                <strong>{draftProfile.name || "Student"}</strong>
                <small>{currentUser?.email}</small>
              </span>
            </div>
            <input value={draftProfile.name} onChange={(event) => updateDraftProfile("name", event.target.value)} placeholder="Name" />
            <input value={draftProfile.program} onChange={(event) => updateDraftProfile("program", event.target.value)} placeholder="Program" />
            <input value={draftProfile.graduation} onChange={(event) => updateDraftProfile("graduation", event.target.value)} placeholder="Graduation" />
            <input value={draftProfile.visa} onChange={(event) => updateDraftProfile("visa", event.target.value)} placeholder="Visa status" />
            <ProfileImagePicker value={draftProfile.avatar} onChange={(avatar) => updateDraftProfile("avatar", avatar)} compact />
            <div className="profile-settings-actions">
              <button className="primary-button" type="submit">Save Profile</button>
              <button className="secondary-button" type="button" onClick={onLogout}>Log Out</button>
            </div>
          </form>
        </article>
        <article className="rail-card">
          <h3>Live Feed</h3>
          <p>Status: {liveStatus}. Last fetch: {fetchedAt ? new Date(fetchedAt).toLocaleString() : "not fetched yet"}.</p>
          <button className="primary-button" type="button" onClick={() => onRefresh(true)}>
            <RefreshCcw size={16} aria-hidden="true" />
            Refresh Sources
          </button>
        </article>
        <article className="rail-card settings-goal-card">
          <h3>Application Goal</h3>
          <p>
            {hasGoal
              ? `${safeGoal.target} ${safeGoal.label || "applications"}${safeGoal.deadline ? ` by ${formatDate(safeGoal.deadline)}` : ""}`
              : "No goal set yet."}
          </p>
          <form className="settings-goal-form" onSubmit={saveSettingsGoal}>
            <input
              type="number"
              min="1"
              value={draftGoal.target}
              onChange={(event) => updateDraftGoal("target", event.target.value)}
              placeholder="Target"
              aria-label="Settings goal target"
            />
            <input
              value={draftGoal.deadline}
              onChange={(event) => updateDraftGoal("deadline", event.target.value)}
              placeholder="YYYY-MM-DD"
              aria-label="Settings goal deadline"
            />
            <input
              value={draftGoal.label}
              onChange={(event) => updateDraftGoal("label", event.target.value)}
              placeholder="Label"
              aria-label="Settings goal label"
            />
            <div className="settings-goal-actions">
              <button className="secondary-button" type="submit">Save Goal</button>
              <button className="secondary-button" type="button" onClick={() => onGoalChange({ target: "", deadline: "", label: "" })}>
                Clear
              </button>
            </div>
          </form>
        </article>
        <article className="rail-card">
          <h3>Sources</h3>
          <div className="settings-sources">
            {sources.map((source) => (
              <a key={source.name} href={source.url} target="_blank" rel="noreferrer">
                {source.name}
              </a>
            ))}
          </div>
        </article>
        <article className="rail-card">
          <h3>Database Workspace</h3>
          <p>Imported live roles and data you add are saved to your account database.</p>
          <button className="secondary-button" type="button" onClick={onReset}>Clear Workspace</button>
        </article>
      </div>
    </section>
  );
}

export function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [authToken, setAuthToken] = useState(readInitialAuthToken);
  const [authReady, setAuthReady] = useState(false);
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const [activeView, setActiveView] = useState("Dashboard");
  const [jobs, setJobs] = useState(loadJobs);
  const [tasks, setTasks] = useState(loadTasks);
  const [contacts, setContacts] = useState(loadContacts);
  const [documents, setDocuments] = useState(loadDocuments);
  const [goal, setGoal] = useState(loadGoal);
  const [notificationState, setNotificationState] = useState(loadNotificationState);
  const [notificationPanelOpen, setNotificationPanelOpen] = useState(false);
  const [browserPermission, setBrowserPermission] = useState(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
    return window.Notification.permission;
  });
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState("");
  const [season, setSeason] = useState("All");
  const [sprintIndex, setSprintIndex] = useState(0);
  const [draggingId, setDraggingId] = useState(null);
  const [modalStage, setModalStage] = useState(null);
  const [toast, setToast] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [liveJobs, setLiveJobs] = useState([]);
  const [liveStatus, setLiveStatus] = useState("idle");
  const [liveQuery, setLiveQuery] = useState("");
  const [liveSeason, setLiveSeason] = useState("all");
  const [liveRemote, setLiveRemote] = useState("all");
  const [liveLimit, setLiveLimit] = useState(240);
  const [liveTotal, setLiveTotal] = useState(0);
  const [liveFilteredTotal, setLiveFilteredTotal] = useState(0);
  const [liveFetchedAt, setLiveFetchedAt] = useState("");
  const [liveSources, setLiveSources] = useState([]);
  const nativeNoticeIdsRef = useRef(new Set());
  const sprintLabels = useMemo(() => createSprintLabels(), []);
  const todayLabel = useMemo(
    () => new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(new Date()),
    [],
  );

  function applyWorkspace(workspace) {
    const next = normalizeWorkspace(workspace);
    setJobs(next.jobs);
    setTasks(next.tasks);
    setContacts(next.contacts);
    setDocuments(next.documents);
    setGoal(next.goal || blankGoal);
    setNotificationState(next.notificationState || blankNotificationState);
    cacheWorkspace(serializeWorkspace(next));
  }

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      try {
        const data = await apiRequest("/api/me", { token: authToken });
        if (cancelled) return;
        setCurrentUser(data.user);
        applyWorkspace(data.workspace);
        setWorkspaceReady(true);
      } catch {
        if (cancelled) return;
        clearAuthToken();
        setAuthToken("");
        setWorkspaceReady(false);
      } finally {
        if (!cancelled) setAuthReady(true);
      }
    }

    restoreSession();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const snapshot = serializeWorkspace({ jobs, tasks, contacts, documents, goal, notificationState });
    cacheWorkspace(snapshot);

    if (!currentUser || !workspaceReady) return undefined;
    const timer = window.setTimeout(async () => {
      try {
        await apiRequest("/api/workspace", {
          method: "PUT",
          token: authToken,
          body: { workspace: snapshot },
        });
      } catch (error) {
        setToast(error instanceof Error ? error.message : "Workspace could not save to database");
      }
    }, 650);

    return () => window.clearTimeout(timer);
  }, [jobs, tasks, contacts, documents, goal, notificationState, currentUser, authToken, workspaceReady]);

  useEffect(() => {
    if (!selectedId && jobs.length > 0) setSelectedId(jobs[0].id);
  }, [jobs, selectedId]);

  useEffect(() => {
    if (!currentUser) return undefined;
    const timer = window.setTimeout(() => {
      fetchLiveJobs(false);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [currentUser, liveQuery, liveSeason, liveRemote, liveLimit]);

  const filteredJobs = useMemo(() => {
    const query = search.trim().toLowerCase();
    return jobs.filter((job) => {
      const matchesSeason = season === "All" || job.season === season;
      const searchBlob = `${job.company} ${job.role} ${job.location} ${(job.tags || []).join(" ")} ${job.notes}`.toLowerCase();
      return matchesSeason && (!query || searchBlob.includes(query));
    });
  }, [jobs, search, season]);

  const groupedJobs = useMemo(() => {
    return stages.reduce((groups, stage) => {
      groups[stage.id] = filteredJobs
        .filter((job) => job.stage === stage.id)
        .sort((left, right) => right.match - left.match);
      return groups;
    }, {});
  }, [filteredJobs]);

  const selectedJob = jobs.find((job) => job.id === selectedId) || jobs[0];
  const hasPipelineFilters = Boolean(search.trim()) || season !== "All";
  const appliedCount = jobs.filter((job) => job.stage !== "saved").length;
  const oaCount = jobs.filter((job) => job.stage === "oa").length;
  const interviewCount = jobs.filter((job) => job.stage === "interview").length;
  const offerCount = jobs.filter((job) => job.stage === "offer").length;
  const upcoming = [...jobs]
    .filter((job) => job.deadline)
    .sort((left, right) => new Date(left.deadline) - new Date(right.deadline))
    .slice(0, 4);
  const importedIds = useMemo(() => new Set(jobs.map((job) => job.id)), [jobs]);
  const notifications = useMemo(
    () => buildNotificationFeed({ jobs, tasks, documents, goal }),
    [jobs, tasks, documents, goal],
  );
  const browserNotificationsAvailable = browserPermission !== "unsupported";
  const profile = currentUser?.profile || defaultProfile();

  useEffect(() => {
    const validIds = new Set(notifications.map((notification) => notification.id));
    setNotificationState((current) => {
      const readIds = current.readIds.filter((id) => validIds.has(id));
      const dismissedIds = current.dismissedIds.filter((id) => validIds.has(id));
      if (readIds.length === current.readIds.length && dismissedIds.length === current.dismissedIds.length) return current;
      return normalizeNotificationState({ ...current, readIds, dismissedIds });
    });
  }, [notifications]);

  useEffect(() => {
    if (!notificationState.browserAlerts || browserPermission !== "granted") return;
    const readSet = new Set(notificationState.readIds);
    const dismissedSet = new Set(notificationState.dismissedIds);
    notifications
      .filter((notification) => notification.native && !readSet.has(notification.id) && !dismissedSet.has(notification.id))
      .slice(0, 3)
      .forEach((notification) => {
        if (nativeNoticeIdsRef.current.has(notification.id)) return;
        nativeNoticeIdsRef.current.add(notification.id);
        try {
          const nativeNotification = new window.Notification(notification.title, {
            body: notification.body,
            icon: "/assets/career-track-mark.svg",
            tag: notification.id,
          });
          nativeNotification.onclick = () => {
            window.focus();
            handleNotificationOpen(notification);
            nativeNotification.close();
          };
        } catch {
          // Some mobile browsers expose Notification but still block native alerts.
        }
      });
  }, [notifications, notificationState, browserPermission]);

  async function fetchLiveJobs(refresh = false) {
    const params = new URLSearchParams({
      query: liveQuery,
      season: liveSeason,
      remote: liveRemote,
      limit: String(liveLimit),
    });
    if (refresh) params.set("refresh", "true");

    setLiveStatus("loading");
    try {
      const response = await fetch(`/api/jobs?${params.toString()}`);
      if (!response.ok) throw new Error(`Live feed returned ${response.status}`);
      const data = await response.json();
      setLiveJobs(Array.isArray(data.jobs) ? data.jobs : []);
      setLiveTotal(Number(data.total || data.count || 0));
      setLiveFilteredTotal(Number(data.filteredTotal || data.count || 0));
      setLiveFetchedAt(data.fetchedAt || "");
      setLiveSources(Array.isArray(data.sources) ? data.sources : []);
      setLiveStatus("ready");
    } catch (error) {
      setLiveStatus("error");
      setToast(error instanceof Error ? error.message : "Live feed failed");
    }
  }

  function updateJob(id, patch) {
    setJobs((current) => current.map((job) => (job.id === id ? { ...job, ...patch } : job)));
  }

  function changeStage(id, stageId) {
    const stageLabel = stages.find((item) => item.id === stageId)?.label || "pipeline";
    updateJob(id, { stage: stageId, statusDate: `${stageLabel} today` });
    setToast(`Moved to ${stageLabel}`);
  }

  function togglePriority(id) {
    setJobs((current) => current.map((job) => (job.id === id ? { ...job, priority: !job.priority } : job)));
  }

  function removeJob(id) {
    const target = jobs.find((job) => job.id === id);
    if (!target) return;
    const confirmed = window.confirm(`Remove ${target.company} from Saved? This deletes it from your tracker.`);
    if (!confirmed) return;
    setJobs((current) => current.filter((job) => job.id !== id));
    setTasks((current) => current.filter((task) => task.sourceJobId !== id));
    if (selectedId === id) setSelectedId(null);
    setToast(`${target.company} removed from Saved`);
  }

  function handleDrop(stageId) {
    if (!draggingId) return;
    changeStage(draggingId, stageId);
    setDraggingId(null);
  }

  function addJob(job) {
    setJobs((current) => [job, ...current]);
    setSelectedId(job.id);
    setModalStage(null);
    setToast(`${job.company} added to ${stages.find((stage) => stage.id === job.stage)?.label}`);
  }

  function importLiveJob(job) {
    if (jobs.some((item) => item.id === job.id)) {
      setSelectedId(job.id);
      setActiveView("Pipeline");
      setToast(`${job.company} is already in your pipeline`);
      return;
    }

    const importedJob = {
      ...job,
      stage: "saved",
      priority: job.match >= 88,
      statusDate: "Imported today",
      deadline: job.deadline || "",
      contact: job.contact || "",
      contactRole: job.contactRole || "",
      contactEmail: job.contactEmail || "",
      notes: job.notes || "Imported from live feed. Verify sponsorship, location, and timing before applying.",
      nextStep: "Open posting, verify eligibility, and tailor resume.",
    };
    setJobs((current) => [importedJob, ...current]);
    setSelectedId(importedJob.id);
    setToast(`${job.company} imported to Saved`);
  }

  function completeNextStep(id) {
    updateJob(id, { nextStep: "Next step completed. Add a fresh follow-up when ready.", statusDate: "Updated today" });
    setToast("Next step marked complete");
  }

  function toggleTask(id) {
    setTasks((current) => current.map((task) => (task.id === id ? { ...task, done: !task.done } : task)));
  }

  function addTask(taskInput) {
    const payload =
      typeof taskInput === "string"
        ? { title: taskInput, subtitle: "Added manually" }
        : taskInput;
    setTasks((current) => [
      {
        id: `task-${Date.now()}`,
        title: payload.title,
        subtitle: payload.subtitle || (payload.due ? `Due ${formatDate(payload.due)}` : "Added manually"),
        icon: payload.icon || CheckSquare2,
        done: false,
        due: payload.due || "",
        priority: payload.priority || "Medium",
        sourceJobId: payload.sourceJobId || "",
      },
      ...current,
    ]);
    setToast("Task added");
  }

  function addContact(contact) {
    setContacts((current) => [contact, ...current]);
    setToast(`${contact.name} added to contacts`);
  }

  function addDocument(document) {
    const nextDocument = normalizeDocument(document);
    setDocuments((current) => [nextDocument, ...current]);
    setToast(`${document.name} added to documents`);
  }

  function updateDocument(id, nextDocument) {
    setDocuments((current) => current.map((document) => (document.id === id ? normalizeDocument({ ...document, ...nextDocument, id }) : document)));
    setToast(`${nextDocument.name || "Document"} updated`);
  }

  function deleteDocument(id) {
    const document = documents.find((item) => item.id === id);
    setDocuments((current) => current.filter((item) => item.id !== id));
    setToast(`${document?.name || "Document"} deleted`);
  }

  function duplicateDocument(id) {
    const document = documents.find((item) => item.id === id);
    if (!document) return;
    const copy = normalizeDocument({
      ...document,
      id: `document-${Date.now()}`,
      name: `${document.name} Copy`,
      status: "Draft",
      updated: new Date().toISOString(),
    });
    setDocuments((current) => [copy, ...current]);
    setToast(`${document.name} duplicated`);
  }

  function updateGoal(nextGoal) {
    setGoal(nextGoal);
    setToast(nextGoal.target ? "Goal saved" : "Goal cleared");
  }

  function setNextNotificationState(updater) {
    setNotificationState((current) => normalizeNotificationState(typeof updater === "function" ? updater(current) : updater));
  }

  function mergeNotificationIds(ids = [], nextId = "") {
    const nextIds = Array.isArray(ids) ? ids : [];
    const cleanId = safeNotificationId(nextId);
    if (!cleanId || nextIds.includes(cleanId)) return nextIds;
    return [cleanId, ...nextIds].slice(0, 600);
  }

  function markNotificationRead(id) {
    setNextNotificationState((current) => ({
      ...current,
      readIds: mergeNotificationIds(current.readIds, id),
    }));
  }

  function markAllNotificationsRead(ids = []) {
    setNextNotificationState((current) => {
      const nextIds = [...current.readIds];
      ids.forEach((id) => {
        const cleanId = safeNotificationId(id);
        if (cleanId && !nextIds.includes(cleanId)) nextIds.push(cleanId);
      });
      return { ...current, readIds: nextIds.slice(0, 600) };
    });
    setToast("Notifications marked read");
  }

  function dismissNotification(id) {
    setNextNotificationState((current) => ({
      ...current,
      readIds: mergeNotificationIds(current.readIds, id),
      dismissedIds: mergeNotificationIds(current.dismissedIds, id),
    }));
  }

  function restoreDismissedNotifications() {
    setNextNotificationState((current) => ({ ...current, dismissedIds: [] }));
    setToast("Dismissed notifications restored");
  }

  async function toggleBrowserAlerts() {
    if (!browserNotificationsAvailable) {
      setToast("Browser alerts are not supported here");
      return;
    }
    if (notificationState.browserAlerts) {
      setNextNotificationState((current) => ({ ...current, browserAlerts: false }));
      setToast("Browser alerts off");
      return;
    }
    if (window.Notification.permission === "granted") {
      setBrowserPermission("granted");
      setNextNotificationState((current) => ({ ...current, browserAlerts: true }));
      setToast("Browser alerts on");
      return;
    }
    const permission = await window.Notification.requestPermission();
    setBrowserPermission(permission);
    setNextNotificationState((current) => ({ ...current, browserAlerts: permission === "granted" }));
    setToast(permission === "granted" ? "Browser alerts on" : "Browser alerts were blocked");
  }

  function handleNotificationOpen(notification) {
    markNotificationRead(notification.id);
    const action = notification.action || {};
    if (action.jobId) {
      setSelectedId(action.jobId);
      setActiveView(action.view || "Pipeline");
    } else if (action.view) {
      setActiveView(action.view);
    }
    setNotificationPanelOpen(false);
  }

  async function handleRegister(draft) {
    try {
      const result = await apiRequest("/api/auth/register", {
        method: "POST",
        body: {
          email: draft.email,
          password: draft.password,
          name: draft.name,
          avatar: draft.avatar,
        },
        token: "",
      });
      saveAuthToken(result.token);
      setAuthToken(result.token);
      setCurrentUser(result.user);
      applyWorkspace(result.workspace);
      setWorkspaceReady(true);
      setToast("Account created");
      return result;
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Could not create account." };
    }
  }

  async function handleLogin(draft) {
    try {
      const result = await apiRequest("/api/auth/login", {
        method: "POST",
        body: {
          email: draft.email,
          password: draft.password,
        },
        token: "",
      });
      saveAuthToken(result.token);
      setAuthToken(result.token);
      setCurrentUser(result.user);
      applyWorkspace(result.workspace);
      setWorkspaceReady(true);
      setToast("Logged in");
      return result;
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Could not log in." };
    }
  }

  async function handleGoogleCredential(credential) {
    try {
      const result = await apiRequest("/api/auth/google", {
        method: "POST",
        body: { credential },
        token: "",
      });
      saveAuthToken(result.token);
      setAuthToken(result.token);
      setCurrentUser(result.user);
      applyWorkspace(result.workspace);
      setWorkspaceReady(true);
      setToast("Logged in with Google");
      return result;
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Google sign-in could not finish." };
    }
  }

  async function updateProfile(nextProfile) {
    const updatedProfile = {
      ...defaultProfile(),
      ...currentUser?.profile,
      ...nextProfile,
    };
    setCurrentUser((current) => (current ? { ...current, profile: updatedProfile } : current));
    setToast("Profile saved");

    try {
      const result = await apiRequest("/api/profile", {
        method: "PATCH",
        token: authToken,
        body: { profile: updatedProfile },
      });
      setCurrentUser(result.user);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Profile could not save to database");
    }
  }

  function logout() {
    apiRequest("/api/auth/logout", { method: "POST", token: authToken }).catch(() => {});
    clearAuthToken();
    setAuthToken("");
    setCurrentUser(null);
    setWorkspaceReady(false);
  }

  function clearLocalData() {
    setJobs([]);
    setTasks([]);
    setContacts([]);
    setDocuments([]);
    setGoal({ target: "", deadline: "", label: "" });
    setNotificationState(blankNotificationState);
    setSelectedId(null);
    setSearch("");
    setSeason("All");
    setToast("Workspace cleared");
  }

  function loadMoreLiveJobs() {
    setLiveLimit((current) => current + 160);
  }

  function clearLiveFilters() {
    setLiveQuery("");
    setLiveSeason("all");
    setLiveRemote("all");
    setLiveLimit(240);
  }

  function clearPipelineFilters() {
    setSearch("");
    setSeason("All");
  }

  function selectCompany(company) {
    if (jobs.some((job) => job.company === company)) {
      setSearch(company);
      setSeason("All");
      setActiveView("Pipeline");
      return;
    }
    setLiveQuery(company);
    setActiveView("Search");
  }

  function renderUtilityView() {
    if (activeView === "Search") {
      return (
        <LiveSearchView
          liveJobs={liveJobs}
          liveStatus={liveStatus}
          liveQuery={liveQuery}
          liveSeason={liveSeason}
          liveRemote={liveRemote}
          liveTotal={liveTotal}
          liveFilteredTotal={liveFilteredTotal}
          liveLimit={liveLimit}
          setLiveQuery={setLiveQuery}
          setLiveSeason={setLiveSeason}
          setLiveRemote={setLiveRemote}
          onLoadMore={loadMoreLiveJobs}
          onClearFilters={clearLiveFilters}
          onRefresh={fetchLiveJobs}
          onImport={importLiveJob}
          importedIds={importedIds}
          fetchedAt={liveFetchedAt}
          sources={liveSources}
        />
      );
    }
    if (activeView === "Companies") return <CompaniesView jobs={jobs} liveJobs={liveJobs} onSelectCompany={selectCompany} />;
    if (activeView === "Contacts") {
      return (
        <ContactsView
          contacts={contacts}
          jobs={jobs}
          onAddContact={addContact}
          onCreateTask={addTask}
          onSelectJob={(id) => {
            setSelectedId(id);
            setActiveView("Pipeline");
          }}
        />
      );
    }
    if (activeView === "Calendar") {
      return (
        <CalendarView
          jobs={jobs}
          tasks={tasks}
          onToggleTask={toggleTask}
          onSelectJob={(id) => {
            setSelectedId(id);
            setActiveView("Pipeline");
          }}
        />
      );
    }
    if (activeView === "Tasks") return <TasksView tasks={tasks} jobs={jobs} onToggleTask={toggleTask} onAddTask={addTask} />;
    if (activeView === "Documents") {
      return (
        <DocumentsView
          documents={documents}
          jobs={jobs}
          authToken={authToken}
          onAddDocument={addDocument}
          onUpdateDocument={updateDocument}
          onDeleteDocument={deleteDocument}
          onDuplicateDocument={duplicateDocument}
          onSelectJob={(id) => {
            setSelectedId(id);
            setActiveView("Pipeline");
          }}
          onToast={setToast}
        />
      );
    }
    if (activeView === "Analytics") return <AnalyticsView jobs={jobs} />;
    if (activeView === "Resources") return <ResourcesView />;
    if (activeView === "Settings") {
      return (
        <SettingsView
          liveStatus={liveStatus}
          fetchedAt={liveFetchedAt}
          goal={goal}
          currentUser={currentUser}
          onGoalChange={updateGoal}
          onProfileUpdate={updateProfile}
          onLogout={logout}
          onRefresh={fetchLiveJobs}
          onReset={clearLocalData}
          sources={liveSources}
        />
      );
    }
    return null;
  }

  if (!authReady) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <div className="auth-visual">
            <img src={profilePresets[0].src} alt="" />
            <div>
              <strong>Career Tracker</strong>
              <span>Internship + New Grad</span>
            </div>
          </div>
          <div className="auth-form">
            <p>Database session</p>
            <h1>Connecting your tracker</h1>
          </div>
        </section>
      </main>
    );
  }

  if (!currentUser) {
    return <AuthScreen onLogin={handleLogin} onRegister={handleRegister} onGoogleCredential={handleGoogleCredential} />;
  }

  return (
    <div className="app-shell">
      <aside className={classNames("sidebar", mobileNavOpen && "is-open")}>
        <div className="brand-lockup">
          <img src="/assets/career-track-mark.svg" alt="Career tracker mark" />
          <div>
            <strong>Career Tracker</strong>
            <span>Internship + New Grad</span>
          </div>
        </div>

        <nav aria-label="Main navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                className={item.label === activeView ? "is-active" : ""}
                type="button"
                onClick={() => {
                  setActiveView(item.label);
                  setMobileNavOpen(false);
                }}
              >
                <Icon size={18} strokeWidth={2} aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="student-card">
          <img src={profile.avatar} alt="" />
          <strong>{profile.name}</strong>
          <span>{profile.program}</span>
          <span>{profile.graduation}</span>
          <small>{profile.visa}</small>
          <button type="button" onClick={() => setActiveView("Settings")}>
            Edit Profile <Pencil size={13} aria-hidden="true" />
          </button>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <IconButton label="Open navigation" className="mobile-menu" onClick={() => setMobileNavOpen((open) => !open)}>
            <Menu size={20} />
          </IconButton>
          <div className="title-block">
            <h1>Career Tracker Dashboard</h1>
            <p>{profile.graduation} · {profile.program}</p>
          </div>

          <div className="sprint-control" aria-label="Sprint selector">
            <IconButton label="Previous sprint" onClick={() => setSprintIndex((index) => Math.max(0, index - 1))}>
              <ChevronLeft size={17} />
            </IconButton>
            <button type="button">
              <CalendarDays size={17} aria-hidden="true" />
              Sprint: {sprintLabels[sprintIndex]}
              <ChevronDown size={14} aria-hidden="true" />
            </button>
            <IconButton label="Next sprint" onClick={() => setSprintIndex((index) => Math.min(sprintLabels.length - 1, index + 1))}>
              <ChevronRight size={17} />
            </IconButton>
          </div>

          <label className="search-box">
            <Search size={18} aria-hidden="true" />
            <span className="sr-only">Search jobs, companies, and notes</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search jobs, companies, notes..." />
            <kbd>⌘ K</kbd>
          </label>

          <div className="top-actions">
            <IconButton label="Clear workspace data" onClick={clearLocalData}>
              <RefreshCcw size={17} />
            </IconButton>
            <NotificationCenter
              notifications={notifications}
              notificationState={notificationState}
              browserPermission={browserPermission}
              browserNotificationsAvailable={browserNotificationsAvailable}
              isOpen={notificationPanelOpen}
              onToggle={() => setNotificationPanelOpen((open) => !open)}
              onClose={() => setNotificationPanelOpen(false)}
              onOpenNotification={handleNotificationOpen}
              onMarkAllRead={markAllNotificationsRead}
              onDismiss={dismissNotification}
              onRestoreDismissed={restoreDismissedNotifications}
              onToggleBrowserAlerts={toggleBrowserAlerts}
            />
            <button className="avatar-button" type="button" aria-label="Open account menu" onClick={() => setActiveView("Settings")}>
              <img src={profile.avatar} alt="" />
              {getInitials(profile.name)} <ChevronDown size={13} aria-hidden="true" />
            </button>
          </div>
        </header>

        <main className="dashboard">
          {activeView === "Dashboard" || activeView === "Pipeline" ? (
            <>
              <section className="stats-row" aria-label="Pipeline stats">
                <MetricCard label="Applications" value={appliedCount} caption={`${jobs.length} tracked roles`} icon={Send} tone="green" />
                <MetricCard label="OAs" value={oaCount} caption={`${Math.round((oaCount / Math.max(1, appliedCount)) * 100)}% of applied`} icon={CheckCircle2} tone="blue" />
                <MetricCard label="Interviews" value={interviewCount} caption={`${Math.round((interviewCount / Math.max(1, appliedCount)) * 100)}% of applied`} icon={Users} tone="purple" />
                <MetricCard label="Offers" value={offerCount} caption={jobs.length ? "From tracked roles" : "No tracked roles yet"} icon={Gift} tone="amber" />
                <ProgressGoal appliedCount={appliedCount} goal={goal} onGoalChange={updateGoal} />
              </section>

              <section className="board-toolbar" aria-label="Pipeline controls">
                <div className="season-tabs" role="tablist" aria-label="Target season">
                  {["All", "2026 Fall", "2027", "New Grad"].map((item) => (
                    <button
                      key={item}
                      className={season === item ? "is-active" : ""}
                      type="button"
                      role="tab"
                      aria-selected={season === item}
                      onClick={() => setSeason(item)}
                    >
                      {item}
                    </button>
                  ))}
                </div>
                <div className="toolbar-actions">
                  <button className="secondary-button" type="button">
                    <Filter size={16} aria-hidden="true" />
                    Filters
                  </button>
                  <button className="secondary-button" type="button">
                    <Columns3 size={16} aria-hidden="true" />
                    Columns
                  </button>
                  <button className="primary-button" type="button" onClick={() => setModalStage("saved")}>
                    <Plus size={17} aria-hidden="true" />
                    Add Job
                  </button>
                </div>
              </section>

              <div className="content-grid">
                <section className="board-section" aria-label="Application pipeline">
                  <div className="kanban-board">
                    {stages.map((stage) => (
                      <StageColumn
                        key={stage.id}
                        stage={stage}
                        jobs={groupedJobs[stage.id] || []}
                        selectedId={selectedJob?.id}
                        onSelect={setSelectedId}
                        onStageChange={changeStage}
                        onTogglePriority={togglePriority}
                        onRemoveJob={removeJob}
                        onDrop={handleDrop}
                        onDragStart={setDraggingId}
                        onAdd={setModalStage}
                      />
                    ))}
                  </div>
                  {filteredJobs.length === 0 && (
                    <div className="no-results">
                      <Search size={22} aria-hidden="true" />
                      <strong>{jobs.length === 0 ? "Pipeline is empty" : "No roles match this view"}</strong>
                      <span>
                        {jobs.length === 0
                          ? "Import a live role or add a job manually to start building the pipeline."
                          : "Try clearing the pipeline filters or search term."}
                      </span>
                      <div className="empty-actions">
                        <button className="primary-button" type="button" onClick={() => setActiveView("Search")}>
                          Import from Live Feed
                        </button>
                        {hasPipelineFilters && (
                          <button className="secondary-button" type="button" onClick={clearPipelineFilters}>
                            Clear Filters
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                  <DetailPanel
                    job={selectedJob}
                    onClose={() => setSelectedId(null)}
                    onStageChange={changeStage}
                    onUpdateNotes={(id, notes) => updateJob(id, { notes })}
                    onCompleteNextStep={completeNextStep}
                  />
                </section>

                <aside className="right-rail" aria-label="Focus rail">
                  <section className="rail-card today-card">
                    <div className="rail-head">
                      <div>
                        <h2>Today's Plan</h2>
                        <p>{todayLabel}</p>
                      </div>
                      <IconButton label="Today menu">
                        <MoreHorizontal size={17} />
                      </IconButton>
                    </div>
                    <div className="task-list">
                      {tasks.length === 0 && (
                        <EmptyState icon={CheckSquare2} title="No tasks yet" text="Add tasks from the Tasks page." />
                      )}
                      {tasks.map((task) => {
                        const Icon = task.icon;
                        return (
                          <label key={task.id} className={classNames("task-item", task.done && "is-done")}>
                            <span className="task-icon" aria-hidden="true">
                              <Icon size={18} />
                            </span>
                            <span>
                              <strong>{task.title}</strong>
                              <small>{task.subtitle}</small>
                            </span>
                            <input checked={task.done} onChange={() => toggleTask(task.id)} type="checkbox" aria-label={`Complete ${task.title}`} />
                          </label>
                        );
                      })}
                    </div>
                    <button className="text-button" type="button" onClick={() => setActiveView("Tasks")}>
                      View full task list
                    </button>
                  </section>

                  <section className="rail-card">
                    <div className="rail-head">
                      <h2>Upcoming Calendar</h2>
                      <CalendarDays size={17} aria-hidden="true" />
                    </div>
                    <div className="calendar-list">
                      {upcoming.length === 0 && (
                        <EmptyState icon={CalendarDays} title="No dates yet" text="Deadlines appear after you import or add roles." />
                      )}
                      {upcoming.map((job) => (
                        <button key={job.id} type="button" onClick={() => setSelectedId(job.id)}>
                          <span className={classNames("calendar-dot", `dot-${job.stage}`)} />
                          <span>
                            <strong>
                              {job.stage === "oa" ? "OA Deadline" : job.stage === "interview" ? "Interview" : "Deadline"}: {job.company}
                            </strong>
                            <small>{formatDate(job.deadline, { weekday: "short", month: "short", day: "numeric" })}</small>
                          </span>
                          <ExternalLink size={14} aria-hidden="true" />
                        </button>
                      ))}
                    </div>
                    <button className="text-button" type="button" onClick={() => setActiveView("Calendar")}>
                      Open Calendar <ExternalLink size={13} aria-hidden="true" />
                    </button>
                  </section>

                  <section className="rail-card">
                    <div className="rail-head">
                      <h2>Quick Actions</h2>
                      <Sparkles size={17} aria-hidden="true" />
                    </div>
                    <div className="quick-actions">
                      <button type="button" onClick={() => setModalStage("saved")}>
                        <Plus size={16} aria-hidden="true" /> Add New Job
                      </button>
                      <button type="button" onClick={() => setModalStage("applied")}>
                        <Send size={16} aria-hidden="true" /> Log Application
                      </button>
                      <button type="button" onClick={() => setActiveView("Contacts")}>
                        <UserRound size={16} aria-hidden="true" /> Add Contact
                      </button>
                      <button type="button" onClick={() => setActiveView("Search")}>
                        <ArrowUpRight size={16} aria-hidden="true" /> Import from Live Feed
                      </button>
                    </div>
                  </section>
                </aside>
              </div>
            </>
          ) : (
            renderUtilityView()
          )}
        </main>
      </div>

      <AddJobModal open={modalStage !== null} defaultStage={modalStage} onClose={() => setModalStage(null)} onAdd={addJob} />

      {toast && (
        <div className="toast" role="status" onAnimationEnd={() => setToast("")}>
          <Check size={15} aria-hidden="true" />
          {toast}
        </div>
      )}
    </div>
  );
}
