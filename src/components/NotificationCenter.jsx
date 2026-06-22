import { useEffect, useMemo, useRef } from "react";
import { FiBell as Bell, FiX as X } from "react-icons/fi";

function classNames(...values) {
  return values.filter(Boolean).join(" ");
}

function IconButton({ label, children, className = "", ...props }) {
  return (
    <button className={classNames("icon-button", className)} type="button" aria-label={label} {...props}>
      {children}
    </button>
  );
}

export function NotificationCenter({
  notifications,
  notificationState,
  browserPermission,
  browserNotificationsAvailable,
  isOpen,
  onToggle,
  onClose,
  onOpenNotification,
  onMarkAllRead,
  onDismiss,
  onRestoreDismissed,
  onToggleBrowserAlerts,
}) {
  const shellRef = useRef(null);
  const readSet = useMemo(() => new Set(notificationState.readIds), [notificationState.readIds]);
  const dismissedSet = useMemo(() => new Set(notificationState.dismissedIds), [notificationState.dismissedIds]);
  const visibleNotifications = notifications.filter((notification) => !dismissedSet.has(notification.id));
  const unreadCount = visibleNotifications.filter((notification) => !readSet.has(notification.id)).length;
  const dismissedCount = notifications.filter((notification) => dismissedSet.has(notification.id)).length;

  useEffect(() => {
    if (!isOpen) return undefined;
    function closeOnPointer(event) {
      if (shellRef.current && !shellRef.current.contains(event.target)) onClose();
    }
    function closeOnEscape(event) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("pointerdown", closeOnPointer);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnPointer);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen, onClose]);

  return (
    <div className="notification-shell" ref={shellRef}>
      <IconButton
        label="Notifications"
        className={classNames("notification-button", isOpen && "is-active")}
        onClick={onToggle}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <Bell size={18} />
        {unreadCount > 0 && <span className="notification-dot">{unreadCount}</span>}
      </IconButton>

      {isOpen && (
        <div className="notification-panel" role="dialog" aria-label="Notifications">
          <div className="notification-panel-head">
            <span>
              <small>Notifications</small>
              <strong>{unreadCount ? `${unreadCount} unread` : "All caught up"}</strong>
            </span>
            <button
              className="text-button"
              type="button"
              onClick={() => onMarkAllRead(visibleNotifications.map((notification) => notification.id))}
              disabled={!unreadCount}
            >
              Mark all read
            </button>
          </div>

          <div className="notification-toolbar">
            <button
              className={classNames("secondary-button", notificationState.browserAlerts && "is-active")}
              type="button"
              onClick={onToggleBrowserAlerts}
              disabled={!browserNotificationsAvailable || browserPermission === "denied"}
            >
              <Bell size={14} aria-hidden="true" />
              {notificationState.browserAlerts ? "Browser alerts on" : browserPermission === "denied" ? "Browser blocked" : "Browser alerts"}
            </button>
            {dismissedCount > 0 && (
              <button className="secondary-button" type="button" onClick={onRestoreDismissed}>
                Restore {dismissedCount}
              </button>
            )}
          </div>

          <div className="notification-list">
            {visibleNotifications.length > 0 ? (
              visibleNotifications.map((notification) => {
                const Icon = notification.icon || Bell;
                const unread = !readSet.has(notification.id);
                return (
                  <article
                    key={notification.id}
                    className={classNames("notification-item", `is-${notification.severity}`, unread && "is-unread")}
                  >
                    <button type="button" onClick={() => onOpenNotification(notification)}>
                      <span className="notification-item-icon" aria-hidden="true">
                        <Icon size={16} />
                      </span>
                      <span className="notification-copy">
                        <span>
                          <strong>{notification.title}</strong>
                          <small>{notification.type}</small>
                        </span>
                        <p>{notification.body}</p>
                        <em>{notification.meta}</em>
                      </span>
                    </button>
                    <button
                      className="notification-dismiss"
                      type="button"
                      onClick={() => onDismiss(notification.id)}
                      aria-label={`Dismiss ${notification.title}`}
                    >
                      <X size={14} aria-hidden="true" />
                    </button>
                  </article>
                );
              })
            ) : (
              <div className="notification-empty">
                <Bell size={24} aria-hidden="true" />
                <strong>No active notifications</strong>
                <span>Deadlines, tasks, document reviews, and goal alerts will appear here.</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
