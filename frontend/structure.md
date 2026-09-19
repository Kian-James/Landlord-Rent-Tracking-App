# Frontend – Project Structure

React + Vite + Tailwind CSS single-page app (PWA icons included) for the property & rent management system.

```
Frontend/
├── index.html
├── package.json
├── package-lock.json
├── postcss.config.js
├── tailwind.config.js
├── vite.config.js
├── public/
│   └── icons/
│       ├── icon-192.png
│       └── icon-512.png
└── src/
    ├── main.jsx
    ├── App.jsx
    ├── index.css
    ├── api/
    │   └── client.js
    ├── components/
    │   ├── Avatar.jsx
    │   ├── BentoCard.jsx
    │   ├── FilterDropdown.jsx
    │   ├── GoogleAuthButton.jsx
    │   ├── Layout.jsx
    │   ├── Modal.jsx
    │   ├── NotificationBell.jsx
    │   ├── ProtectedRoute.jsx
    │   ├── Skeleton.jsx
    │   ├── StatusBadge.jsx
    │   └── UserMenu.jsx
    ├── context/
    │   └── AuthContext.jsx
    ├── lib/
    │   ├── apiCache.js
    │   ├── billIcons.jsx
    │   └── calendarGrid.js
    └── pages/
        ├── BillChecklist.jsx
        ├── Calendar.jsx
        ├── Dashboard.jsx
        ├── Login.jsx
        ├── Properties.jsx
        ├── Register.jsx
        ├── Settings.jsx
        ├── Tenants.jsx
        └── Verification.jsx
```

## Layer overview

| Path | Purpose |
|---|---|
| `index.html` | Vite HTML entry point |
| `vite.config.js`, `tailwind.config.js`, `postcss.config.js` | Build and styling configuration |
| `public/icons/` | App icons (192px and 512px) |
| `src/main.jsx` | React entry point |
| `src/App.jsx` | Root component and routing |
| `src/api/` | API client for talking to the backend |
| `src/components/` | Reusable UI pieces (layout, modal, notifications, badges, skeletons, etc.) |
| `src/context/` | React context (authentication state) |
| `src/lib/` | Helpers (API caching, bill icons, calendar grid logic) |
| `src/pages/` | Top-level screens (Dashboard, Tenants, Properties, Calendar, Bill Checklist, Verification, Settings, Login, Register) |