# Backend – Project Structure

Node.js / Express backend (property & rent management: landlords, tenants, units, contracts, rent, utility bills, payments, notifications).

```
Backend/
├── package.json
├── package-lock.json
├── server.js
├── scripts/
│   ├── smokeTest.js
│   └── wiringCheck.js
├── uploads/
│   └── receipts/
└── src/
    ├── app.js
    ├── config/
    │   └── db.js
    ├── controllers/
    │   ├── authController.js
    │   ├── contractController.js
    │   ├── dashboardController.js
    │   ├── notificationController.js
    │   ├── paymentController.js
    │   ├── propertyController.js
    │   ├── rentController.js
    │   ├── tenantController.js
    │   ├── unitController.js
    │   └── utilityBillController.js
    ├── jobs/
    │   ├── contractReminders.js
    │   └── scheduler.js
    ├── middleware/
    │   ├── auth.js
    │   ├── errorHandler.js
    │   ├── rateLimit.js
    │   ├── receiptUpload.js
    │   └── validate.js
    ├── models/
    │   ├── AuditLog.js
    │   ├── Contract.js
    │   ├── Landlord.js
    │   ├── Notification.js
    │   ├── Payment.js
    │   ├── Property.js
    │   ├── PushSubscription.js
    │   ├── RefreshToken.js
    │   ├── RentRecord.js
    │   ├── Tenant.js
    │   ├── Unit.js
    │   └── UtilityBillRecord.js
    ├── routes/
    │   ├── authRoutes.js
    │   ├── contractRoutes.js
    │   ├── dashboardRoutes.js
    │   ├── gmailRoutes.js
    │   ├── notificationRoutes.js
    │   ├── paymentRoutes.js
    │   ├── propertyRoutes.js
    │   ├── pushRoutes.js
    │   ├── rentRoutes.js
    │   ├── settingsRoutes.js
    │   ├── tenantRoutes.js
    │   ├── unitRoutes.js
    │   └── utilityBillRoutes.js
    ├── services/
    │   ├── notifications.js
    │   ├── prepaidPeriods.js
    │   ├── rentGenerator.js
    │   ├── rentStatus.js
    │   ├── session.js
    │   └── utilityBillGenerator.js
    └── utils/
        ├── ApiError.js
        ├── asyncHandler.js
        ├── crypto.js
        ├── ownership.js
        └── tokens.js
```

## Layer overview

| Directory | Purpose |
|---|---|
| `server.js` | Entry point; boots the app |
| `src/app.js` | Express app setup (middleware, route mounting) |
| `src/config/` | Configuration (database connection) |
| `src/routes/` | Route definitions, one file per resource |
| `src/controllers/` | Request handlers / business logic per resource |
| `src/models/` | Data models (12 entities) |
| `src/services/` | Reusable domain logic (rent generation, statuses, notifications, sessions) |
| `src/jobs/` | Scheduled/background jobs |
| `src/middleware/` | Auth, validation, rate limiting, error handling, receipt uploads |
| `src/utils/` | Helpers (errors, async wrapper, crypto, tokens, ownership checks) |
| `scripts/` | Dev utilities (smoke test, wiring check) |
| `uploads/receipts/` | Storage for uploaded payment receipts (currently empty) |