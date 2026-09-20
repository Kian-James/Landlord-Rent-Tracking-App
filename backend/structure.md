backend/
├── .env.example
├── .gitignore
├── README.md
├── package.json
├── server.js
├── supabase/
│   └── schema.sql
├── scripts/
│   ├── smokeTest.js
│   └── wiringCheck.js
└── src/
    ├── app.js
    ├── config/
    │   ├── firebase.js
    │   └── supabase.js
    ├── db/
    │   ├── helper.js
    │   └── mapper.js
    ├── middleware/
    │   ├── auth.js
    │   ├── errorHandler.js
    │   ├── rateLimit.js
    │   └── validate.js
    ├── controllers/
    │   ├── authController.js
    │   ├── contractController.js
    │   ├── dashboardController.js
    │   ├── notificationController.js
    │   ├── propertyController.js
    │   ├── rentController.js
    │   ├── tenantController.js
    │   ├── unitController.js
    │   └── utilityBillController.js
    ├── routes/
    │   ├── authRoutes.js
    │   ├── contractRoutes.js
    │   ├── dashboardRoutes.js
    │   ├── gmailRoutes.js
    │   ├── notificationRoutes.js
    │   ├── propertyRoutes.js
    │   ├── rentRoutes.js
    │   ├── settingsRoutes.js
    │   ├── tenantRoutes.js
    │   ├── unitRoutes.js
    │   └── utilityBillRoutes.js
    ├── services/
    │   ├── audit.js
    │   ├── landlords.js
    │   ├── notifications.js
    │   ├── prepaidPeriods.js
    │   ├── rentGenerator.js
    │   ├── rentStatus.js
    │   └── utilityBillGenerator.js
    ├── jobs/
    │   ├── contractReminders.js
    │   └── scheduler.js
    └── utils/
        ├── ApiError.js
        ├── asyncHandler.js
        └── moveInFunds.js