import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import UserMenu from './UserMenu.jsx';

const NAV_ITEMS = [
  { to: '/properties', label: 'Properties', shortLabel: 'Properties' },
];

export default function Layout() {
  const { landlord, logout } = useAuth();

  return (
    <div className="min-h-screen bg-canvas pb-20 md:pb-0">
      <header className="sticky top-0 z-20 border-b border-line bg-surface">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-8">
          <div className="flex items-center gap-8">
            <div className="leading-tight">
              <p className="text-base font-semibold tracking-tight">PropTrack</p>
              <p className="-mt-0.5 text-[10px] text-ink/45">Rent Tracker</p>
            </div>
            <nav className="hidden items-center gap-1 lg:flex">
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `relative rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                      isActive ? 'bg-ink text-white' : 'text-ink/60 hover:text-ink'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <UserMenu landlord={landlord} onLogout={logout} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-20 grid grid-cols-1 border-t border-line bg-surface lg:hidden">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `relative flex flex-col items-center justify-center gap-0.5 py-2 text-[9px] font-medium leading-tight ${
                isActive ? 'text-ink' : 'text-ink/45'
              }`
            }
          >
            <span className="text-center">{item.shortLabel}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}