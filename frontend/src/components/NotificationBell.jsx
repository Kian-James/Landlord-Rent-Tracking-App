import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBell } from '@fortawesome/free-solid-svg-icons';
import client from '../api/client.js';

const DESTINATION_BY_TYPE = {
  rent_due_soon: '/bills',
  rent_due_today: '/bills',
  rent_overdue: '/bills',
  utility_bill_overdue: '/bills',
  contract_expiring: '/tenants',
  contract_renewed: '/tenants',
};

function timeAgo(dateStr) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function NotificationBell() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const closeTimer = useRef(null);

  const load = async () => {
    try {
      const { data } = await client.get('/notifications');
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch {
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const cancelScheduledClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const scheduleClose = () => {
    cancelScheduledClose();
    closeTimer.current = setTimeout(() => setOpen(false), 200);
  };

  const handleNotificationClick = (n) => {
    setOpen(false);
    if (!n.read) {
      setNotifications((prev) => prev.map((item) => (item._id === n._id ? { ...item, read: true } : item)));
      setUnreadCount((c) => Math.max(0, c - 1));
      client.post(`/notifications/${n._id}/read`, {}).catch(() => {});
    }
    navigate(DESTINATION_BY_TYPE[n.type] || '/');
  };

  const handleMarkAllRead = async (e) => {
    e.stopPropagation();
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    try {
      await client.post('/notifications/read-all', {});
    } catch {
      load();
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseEnter={() => {
        cancelScheduledClose();
        setOpen(true);
      }}
      onMouseLeave={scheduleClose}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-full border border-line p-2 text-ink/60 hover:bg-canvas"
        aria-label="Notifications"
        aria-expanded={open}
      >
        <span aria-hidden="true"><FontAwesomeIcon icon={faBell} /></span>
        {unreadCount > 0 && (
          <span className="absolute -right-2 -top-2 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-status-overdue px-1 text-[9px] font-bold leading-none text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      <div
        className={`absolute right-4 top-full z-30 -mt-3 w-80 origin-top-right rounded-lg border border-line bg-surface shadow-lg transition-all duration-150 ease-out ${
          open ? 'pointer-events-auto scale-100 opacity-100' : 'pointer-events-none scale-95 opacity-0'
        }`}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
          <p className="text-sm font-semibold">Notifications</p>
          {unreadCount > 0 && (
            <button onClick={handleMarkAllRead} className="text-xs font-medium text-ink/50 hover:text-ink">
              Mark all read
            </button>
          )}
        </div>

        <div className="max-h-96 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-ink/50">You're all caught up.</p>
          ) : (
            notifications.map((n) => (
              <button
                key={n._id}
                onClick={() => handleNotificationClick(n)}
                className={`block w-full border-b border-line px-4 py-3 text-left last:border-b-0 hover:bg-canvas ${
                  n.read ? '' : 'bg-brand-soft/40'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium">{n.title}</p>
                  {!n.read && <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />}
                </div>
                <p className="mt-0.5 text-xs text-ink/60">{n.message}</p>
                <p className="mt-1 text-[11px] text-ink/40">{timeAgo(n.createdAt)}</p>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}