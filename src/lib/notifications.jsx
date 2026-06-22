import { FiBell as Bell, FiCalendar as CalendarDays, FiCheckSquare as CheckSquare2, FiFileText as FileText, FiTarget as Target, FiAward as Trophy, FiUsers as Users } from "react-icons/fi";
import { blankGoal, stages } from "../config/appConfig.jsx";
import { daysUntil, formatDate, formatRelativeDate } from "./dates.js";

export function safeNotificationId(value = "") {
  const id = String(value || "").trim().slice(0, 180);
  if (id.includes("..") || id.startsWith("/")) return "";
  return /^[a-zA-Z0-9_.:@|/-]{1,180}$/.test(id) ? id : "";
}

export function cleanNotificationIdList(value = []) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value.slice(0, 600).reduce((items, item) => {
    const id = safeNotificationId(item);
    if (id && !seen.has(id)) {
      seen.add(id);
      items.push(id);
    }
    return items;
  }, []);
}

export function normalizeNotificationState(state = {}) {
  return {
    readIds: cleanNotificationIdList(state.readIds),
    dismissedIds: cleanNotificationIdList(state.dismissedIds),
    browserAlerts: Boolean(state.browserAlerts),
  };
}

function notificationSeverityRank(severity = "info") {
  return { critical: 0, warning: 1, success: 2, info: 3 }[severity] ?? 4;
}

export function buildNotificationFeed({ jobs = [], tasks = [], documents = [], goal = blankGoal }) {
  const notifications = [];
  const appliedCount = jobs.filter((job) => job.stage !== "saved").length;
  const goalTarget = Number(goal?.target || 0);
  const goalDaysLeft = daysUntil(goal?.deadline);

  function push(notification) {
    const id = safeNotificationId(notification.id);
    if (!id) return;
    notifications.push({
      severity: "info",
      icon: Bell,
      date: "",
      dueDays: Number.POSITIVE_INFINITY,
      native: false,
      ...notification,
      id,
    });
  }

  tasks
    .filter((task) => !task.done && task.due)
    .forEach((task) => {
      const dueDays = daysUntil(task.due);
      if (dueDays > 7) return;
      const isOverdue = dueDays < 0;
      push({
        id: `task:${task.id}:${task.due}`,
        type: "Task",
        icon: CheckSquare2,
        title: isOverdue ? "Task overdue" : dueDays === 0 ? "Task due today" : "Task due soon",
        body: `${task.title}${task.subtitle ? ` · ${task.subtitle}` : ""}`,
        meta: formatRelativeDate(task.due),
        severity: isOverdue || dueDays <= 1 || task.priority === "High" ? "critical" : "warning",
        date: task.due,
        dueDays,
        native: isOverdue || dueDays <= 1,
        action: { view: "Tasks", taskId: task.id },
      });
    });

  jobs
    .filter((job) => job.deadline && job.stage !== "offer")
    .forEach((job) => {
      const dueDays = daysUntil(job.deadline);
      if (dueDays > 14) return;
      const stageLabel = stages.find((stage) => stage.id === job.stage)?.label || "Pipeline";
      push({
        id: `job-deadline:${job.id}:${job.deadline}`,
        type: "Deadline",
        icon: CalendarDays,
        title: dueDays < 0 ? "Application deadline passed" : dueDays === 0 ? "Application deadline today" : "Application deadline coming up",
        body: `${job.company} · ${job.role}`,
        meta: `${formatRelativeDate(job.deadline)} · ${stageLabel}`,
        severity: dueDays < 0 || dueDays <= 1 ? "critical" : dueDays <= 7 ? "warning" : "info",
        date: job.deadline,
        dueDays,
        native: dueDays >= 0 && dueDays <= 1,
        action: { view: "Pipeline", jobId: job.id },
      });
    });

  jobs
    .filter((job) => job.stage === "interview")
    .forEach((job) => {
      push({
        id: `interview:${job.id}:${job.statusDate || "active"}`,
        type: "Pipeline",
        icon: Users,
        title: "Interview loop needs prep",
        body: `${job.company} · ${job.nextStep || "Prepare notes and follow-up questions."}`,
        meta: job.statusDate || "Interview stage",
        severity: "info",
        action: { view: "Pipeline", jobId: job.id },
      });
    });

  jobs
    .filter((job) => job.stage === "offer")
    .forEach((job) => {
      push({
        id: `offer:${job.id}:${job.statusDate || "active"}`,
        type: "Offer",
        icon: Trophy,
        title: "Offer to review",
        body: `${job.company} · compare compensation, deadline, and fit.`,
        meta: job.statusDate || "Offer stage",
        severity: "success",
        action: { view: "Pipeline", jobId: job.id },
      });
    });

  documents
    .filter((document) => document.status === "Needs Review")
    .forEach((document) => {
      push({
        id: `document-review:${document.id}:${document.updated || "review"}`,
        type: "Document",
        icon: FileText,
        title: "Document needs review",
        body: `${document.name} · ${document.type} for ${document.target || "General"}`,
        meta: document.updated ? `Updated ${formatDate(document.updated, { month: "short", day: "numeric" })}` : "Needs review",
        severity: "warning",
        action: { view: "Documents", documentId: document.id },
      });
    });

  if (goalTarget > 0) {
    const remaining = Math.max(0, goalTarget - appliedCount);
    if (remaining > 0 && Number.isFinite(goalDaysLeft) && goalDaysLeft <= 14) {
      push({
        id: `goal:${goalTarget}:${goal.deadline || "open"}:${appliedCount}`,
        type: "Goal",
        icon: Target,
        title: "Goal pace check",
        body: `${appliedCount}/${goalTarget} ${goal.label || "applications"} logged. ${remaining} left to hit your goal.`,
        meta: goal.deadline ? `${formatRelativeDate(goal.deadline)} to deadline` : "Goal active",
        severity: goalDaysLeft <= 3 ? "critical" : "warning",
        date: goal.deadline,
        dueDays: goalDaysLeft,
        native: goalDaysLeft <= 1,
        action: { view: "Settings" },
      });
    }
  }

  return notifications
    .sort((left, right) => {
      const severityCompare = notificationSeverityRank(left.severity) - notificationSeverityRank(right.severity);
      if (severityCompare !== 0) return severityCompare;
      if (left.dueDays !== right.dueDays) return left.dueDays - right.dueDays;
      return String(left.title).localeCompare(String(right.title));
    })
    .slice(0, 60);
}
