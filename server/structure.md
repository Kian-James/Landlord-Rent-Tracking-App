server/
├── .env.example
├── .gitignore
├── package.json
├── server.js
├── db/
│   ├── schema.sql
│   └── seed.sql
├── scripts/
│   ├── smokeTest.js
│   └── wiringCheck.js
└── src/
    ├── app.js
    ├── config/
    │   └── supabase.js
    ├── db/
    │   ├── helper.js
    │   └── mapper.js
    ├── middleware/
    │   ├── auth.js
    │   ├── errorHandler.js
    │   ├── rateLimit.js
    │   ├── requestLogger.js
    │   └── validate.js
    ├── controllers/
    │   ├── authController.js
    │   ├── contractController.js
    │   ├── contractPdfController.js        (one-click contract PDF download)
    │   ├── contractTemplateController.js   (upload / review / save the contract template)
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
    │   ├── notificationRoutes.js
    │   ├── propertyRoutes.js
    │   ├── rentRoutes.js
    │   ├── settingsRoutes.js
    │   ├── tenantRoutes.js
    │   ├── unitRoutes.js
    │   └── utilityBillRoutes.js
    ├── services/
    │   ├── audit.js
    │   ├── contractDetect.js       (finds a lease's values inside an uploaded contract)
    │   ├── contractFields.js       (field catalog + formatting: rent in words, dates...)
    │   ├── contractFonts.js        (font mapping + text measuring)
    │   ├── contractLayout.js       (reads a PDF's text positions -> paragraphs)
    │   ├── contractPdfStream.js    (PDF content-stream reading: text removal, colours)
    │   ├── contractStamp.js        (draws the filled-in contract on the original PDF)
    │   ├── contractTemplates.js    (template storage, slot validation, lease loading)
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

Contract PDF feature (also see CONTRACT_PDF_README.md):
    assets/fonts/      Liberation Sans/Serif/Mono + DejaVu (redrawing text)
    assets/starter/    the built-in starter contract (contract.pdf + model.json + slots.json)
    scripts/buildStarterTemplate.js   rebuilds the starter's model/slots from contract.pdf
    db/migrations/002_contract_pdf_templates.sql
