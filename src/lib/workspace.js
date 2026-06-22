import { FiCheckSquare as CheckSquare2 } from "react-icons/fi";
import { blankGoal, emptyStoredData, STORAGE_KEY } from "../config/appConfig.jsx";
import { normalizeDocument } from "./documents.js";
import { normalizeNotificationState } from "./notifications.jsx";

export function serializeWorkspace({ jobs, tasks, contacts, documents, goal, notificationState }) {
  return {
    jobs,
    tasks: tasks.map(({ icon, ...task }) => task),
    contacts,
    documents,
    goal,
    notificationState: normalizeNotificationState(notificationState),
  };
}

export function normalizeWorkspace(workspace = emptyStoredData) {
  return {
    jobs: Array.isArray(workspace.jobs) ? workspace.jobs : [],
    tasks: Array.isArray(workspace.tasks) ? workspace.tasks.map((task) => ({ ...task, icon: CheckSquare2 })) : [],
    contacts: Array.isArray(workspace.contacts) ? workspace.contacts : [],
    documents: Array.isArray(workspace.documents) ? workspace.documents.map(normalizeDocument) : [],
    goal: workspace.goal && typeof workspace.goal === "object" ? workspace.goal : blankGoal,
    notificationState: normalizeNotificationState(workspace.notificationState),
  };
}

export function cacheWorkspace(workspace) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
  } catch {
    // The database remains the source of truth when local storage is unavailable.
  }
}

export function readStoredData() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return emptyStoredData;
    const parsed = JSON.parse(stored);
    return {
      jobs: Array.isArray(parsed.jobs) ? parsed.jobs : [],
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      contacts: Array.isArray(parsed.contacts) ? parsed.contacts : [],
      documents: Array.isArray(parsed.documents) ? parsed.documents : [],
      goal: parsed.goal && typeof parsed.goal === "object" ? parsed.goal : null,
      notificationState: normalizeNotificationState(parsed.notificationState),
    };
  } catch {
    return emptyStoredData;
  }
}

export function loadJobs() {
  return readStoredData().jobs;
}

export function loadTasks() {
  return readStoredData().tasks.map((task) => ({
    ...task,
    icon: CheckSquare2,
  }));
}

export function loadContacts() {
  return readStoredData().contacts;
}

export function loadDocuments() {
  return readStoredData().documents.map(normalizeDocument);
}

export function loadGoal() {
  const goal = readStoredData().goal;
  if (!goal) return blankGoal;
  return {
    target: goal.target ? String(goal.target) : "",
    deadline: goal.deadline || "",
    label: goal.label || "",
  };
}

export function loadNotificationState() {
  return normalizeNotificationState(readStoredData().notificationState);
}
