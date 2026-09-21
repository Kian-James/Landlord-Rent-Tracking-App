frontend/
├── .env.example
├── .gitignore
├── README.md
├── eslint.config.js
├── index.html
├── package.json
├── postcss.config.js
├── tailwind.config.js
├── vite.config.js
├── public/
│   └── icons/
│       └── icon-192.png
└── src/
    ├── App.jsx
    ├── main.jsx
    ├── index.css
    ├── api/
    │   └── client.js
    ├── context/
    │   └── AuthContext.jsx
    ├── lib/
    │   ├── apiCache.js
    │   ├── authError.js
    │   ├── billIcons.jsx
    │   ├── calendarGrid.js
    │   └── firebase.js
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
    └── pages/
        ├── BillChecklist.jsx
        ├── Calendar.jsx
        ├── Dashboard.jsx
        ├── Login.jsx
        ├── Properties.jsx
        ├── Register.jsx
        ├── Settings.jsx
        ├── Tenants.jsx