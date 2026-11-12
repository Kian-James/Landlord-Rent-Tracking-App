import React, { Suspense, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Skeleton } from './Skeleton.jsx';
import AddressGate from './AddressGate.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { RentoraMark } from './RentoraLogo.jsx';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faTableCellsLarge,
  faFileInvoiceDollar,
  faUsers,
  faBuilding,
  faCalendarDays,
  faGear,
  faArrowRightFromBracket,
} from '@fortawesome/free-solid-svg-icons';

// Same routes as before - only the chrome around them changed (top pill nav
// -> floating left icon rail, per the design pass applied across the app).
// `icon` is new and only used by the rail; the mobile bottom nav still uses
// `shortLabel` as text, unchanged. Settings moves from the account dropdown
// into the rail itself, alongside the other primary sections.
const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', shortLabel: 'Home', end: true, icon: faTableCellsLarge },
  { to: '/bills', label: 'Bill Checklist', shortLabel: 'Bills', icon: faFileInvoiceDollar },
  { to: '/tenants', label: 'Tenants & Leases', shortLabel: 'Tenants', icon: faUsers },
  { to: '/properties', label: 'Properties', shortLabel: 'Properties', icon: faBuilding },
  { to: '/calendar', label: 'Calendar', shortLabel: 'Calendar', icon: faCalendarDays },
  { to: '/settings', label: 'Settings', shortLabel: 'Settings', icon: faGear },
];

export default function Layout() {
  // Once the first screen is up and the browser is idle, download the other screens
  // in the background so moving around the app feels instant. Skipped on data saver.
  useEffect(() => {
    if (navigator.connection?.saveData) return undefined;
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 2000));
    const handle = idle(() => {
      import('../pages/Tenants.jsx');
      import('../pages/Properties.jsx');
      import('../pages/BillChecklist.jsx');
      import('../pages/Calendar.jsx');
      import('../pages/Settings.jsx');
    });
    return () => (window.cancelIdleCallback ? window.cancelIdleCallback(handle) : clearTimeout(handle));
  }, []);

  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-canvas pb-28 lg:pb-0">
      <AddressGate />
      {/* Floating left icon rail - fixed, doesn't scroll with the page.
          Hidden below lg, where the existing bottom tab bar takes over. */}
      <aside className="fixed bottom-6 left-6 top-6 z-30 hidden w-[72px] flex-col items-center rounded-bento bg-surface py-6 shadow-bento lg:flex">
        <RentoraMark className="h-9 w-9" />

        <nav className="mt-8 flex flex-1 flex-col items-center gap-2">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              title={item.label}
              className={({ isActive }) =>
                `relative flex h-11 w-11 items-center justify-center rounded-2xl text-lg transition-colors ${
                  isActive ? 'bg-primary text-white' : 'text-ink/40 hover:bg-canvas hover:text-ink'
                }`
              }
            >
              <FontAwesomeIcon icon={item.icon} className="h-4 w-4" />
            </NavLink>
          ))}
        </nav>

        <button
          onClick={handleLogout}
          title="Log out"
          className="flex h-11 w-11 items-center justify-center rounded-2xl text-ink/40 hover:bg-canvas hover:text-ink"
        >
          <FontAwesomeIcon icon={faArrowRightFromBracket} className="h-4 w-4" />
        </button>
      </aside>

      {/* Top bar removed - it duplicated the icon rail as a second nav.
          Account-level controls (notifications, settings, logout) now live
          on the icon rail / Dashboard page instead. */}
      <main className="mx-3 pb-6 pt-3 sm:mx-4 sm:pt-4 lg:ml-[112px] lg:mr-6 lg:pt-6">
        <Suspense
          fallback={
            <div className="space-y-4">
              <Skeleton className="h-10 w-56" />
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          }
        >
          <Outlet />
        </Suspense>
      </main>

      {/* Mobile bottom navigation - the icon rail is lg-and-up only, so
          small screens keep the original bottom tab bar. */}
      <nav className="fixed inset-x-0 bottom-0 z-20 rounded-t-3xl border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-12px_rgba(15,23,42,0.18)] backdrop-blur lg:hidden">
        <div className="grid grid-cols-6 px-1 pt-1.5">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              aria-label={item.label}
              className={({ isActive }) =>
                `flex min-h-[56px] flex-col items-center justify-center gap-0.5 rounded-2xl text-[10px] font-medium leading-none transition-colors active:scale-95 ${
                  isActive ? 'text-primary' : 'text-ink/45'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`flex h-8 w-12 items-center justify-center rounded-full transition-colors ${
                      isActive ? 'bg-primary text-white' : ''
                    }`}
                  >
                    <FontAwesomeIcon icon={item.icon} className="h-[18px] w-[18px]" />
                  </span>
                  <span>{item.shortLabel}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
