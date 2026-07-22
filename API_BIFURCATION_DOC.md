# URLPT API Bifurcation Document

This document lists all currently wired APIs in `backend/urlpt-api`, grouped by business use-case.

## Base Paths

- `v1 base`: `/api`
- `legacy v2 base`: `/api/v2` (plus `/api/v2/campaign`, `/api/v2/visitors`, `/api/v2/script`)

## Auth Legend

- `Public`: no auth middleware
- `Auth`: protected by `authMiddleware` / `isAuthenticate`
- `Admin`: protected and admin-only

---

## 1) Login, Auth, Account & Onboarding APIs
Route group: `/api/auth`

### Core login/signup/password
- `POST /login` - User login (`Public`)
- `GET /me` - Current user profile (`Auth`)
- `POST /sign-up` - User registration (`Public`)
- `POST /forgot-password` - Password reset request (`Public`)
- `POST /reset-password` - Password reset submit (`Public`)
- `POST /change-password` - Change password (`Auth`)
- `POST /delete-account` - Delete current account (`Auth`)

### OAuth login
- `GET /google` - Start Google OAuth (`Public`)
- `GET /google/callback` - Google callback (`Public`)
- `GET /microsoft` - Start Microsoft OAuth (`Public`)
- `GET /microsoft/callback` - Microsoft callback (`Public`)
- `POST /microsoft/login` - Microsoft token login (`Public`)

### Session, login history, and account controls
- `POST /cookie-consent` - Save cookie consent (`Auth`)
- `GET /login-history` - Login history (`Auth`, `Admin`)
- `GET /login-history-with-id` - Login history by user id (`Auth`)
- `POST /logout/history` - Logout history tracking (`Auth`)
- `POST /active-user` - Mark/check active user (`Public`)
- `POST /activation-mail/:email` - Send activation mail (`Public`)
- `GET /get-all-users` - Get all users (`Auth`)
- `POST /set-timeout` - Auto logout timeout (`Auth`)
- `POST /set-auto-delete-days` - Set account auto-delete policy (`Auth`)
- `GET /get-auto-delete-days` - Get account auto-delete policy (`Auth`)
- `POST /complete-onboarding` - Mark onboarding complete (`Auth`)
- `POST /send-emailotp` - Send email OTP (`Public`)

### User website management
- `POST /add/websites` - Add website (`Auth`)
- `PUT /websites/primary` - Set primary website (`Auth`)
- `PUT /websites/deactivate` - Deactivate website (`Auth`)
- `DELETE /websites/delete` - Delete website (`Auth`)

### Push notifications
- `PUT /websites/push` - Toggle push notifications for website (`Auth`)
- `POST /websites/push/save-subscription` - Save browser push subscription (`Public`)
- `POST /websites/push/send-push` - Send push notification (`Auth`)

---

## 2) Tracking, Script & Runtime Delivery APIs

### Script runtime
Route group: `/api/script`

- `GET /` - Get scripts (`Public`)
- `GET /crate-main-script` - Generate/create main script (`Public`)
- `POST /send-mail` - Trigger email send from script flow (`Public`)
- `POST /send-sms` - Trigger SMS send from script flow (`Public`)
- `POST /send-email-campaign` - Trigger email campaign send (`Public`)
- `POST /send-whatsapp` - Trigger WhatsApp campaign send (`Public`)
- `POST /add-form-tracking/:userId` - Add form tracking script (`Public`)

### Visitor tracking events
Route group: `/api/visitors`

- `POST /add-visitors` - Add visitor event (`Public`)
- `POST /visitor-data` - Store visitor/device data (`Public`)
- `POST /email-submission` - Store email submission event (`Public`)
- `GET /get-visitor-limit` - Get visitor limit for account (`Auth`)

### Conversion and contact events
Route group: `/api/conversion`

- `POST /add-conversion` - Add conversion event (`Public`)
- `GET /get-all-conversion` - List conversions (`Auth`)
- `GET /get-all-contact` - List contacts (`Auth`)
- `POST /contact` - Add contact (`Auth`)
- `PUT /contact/:contactId` - Update contact (`Auth`)
- `GET /contact/:contactId` - Get contact by id (`Auth`)
- `DELETE /contact/:contactId` - Delete contact (`Auth`)
- `GET /getCurrency` - Get currency helper data (`Public`)
- `POST /createConversion` - Create conversion from panel flow (`Auth`)

---

## 3) Campaign Management APIs
Route group: `/api/campaign`

### Campaign setup and CRUD
- `GET /get-campaign` - Get campaign list/admin view (`Auth`)
- `GET /get-campaign-type` - Campaign type dropdown (`Auth`)
- `GET /get-campaign-action` - Campaign action options (`Auth`)
- `GET /get-campaign-triggers` - Campaign trigger options (`Auth`)
- `POST /create-campaign` - Create campaign (`Auth`)
- `GET /get-campaign/:id` - Get campaign by id (`Auth`)
- `PUT /update-campaign/:id` - Update campaign (`Auth`)
- `PUT /script-update/:id` - Update campaign script (`Auth`)
- `POST /upload-file` - Upload campaign assets (`Auth`)

### Campaign runtime counters and eligibility
- `POST /increase-counter` - Increment campaign click counter (`Public`)
- `POST /increase-appear` - Increment campaign appearance counter (`Public`)
- `POST /check-display-limit/:campaignId` - Check campaign display limit (`Public`)
- `GET /campaign-stat/:id` - Campaign stats (public-facing usage path) (`Public`)

### Campaign analytics
- `GET /appearances/:campaignId` - Appearance analytics (`Auth`)
- `GET /clicks/:campaignId` - Click analytics (`Auth`)
- `GET /closes/:campaignId` - Close analytics (`Auth`)
- `GET /total/conversions/:campaignId` - Total conversions (`Auth`)
- `GET /conversions/:campaignId` - Conversion list/stats (`Auth`)
- `GET /email-submissions/:campaignId` - Email submissions (`Auth`)
- `GET /total/email-submissions/:campaignId` - Total email submissions (`Auth`)
- `GET /sms-activity-stats/:campaignId` - SMS stats (`Auth`)
- `GET /email-activity-stats/:campaignId` - Email stats (`Auth`)
- `GET /whatsapp-activity-stats/:campaignId` - WhatsApp stats (`Auth`)
- `GET /sms-activities/:campaignId` - SMS activity list (`Auth`)
- `GET /email-activities/:campaignId` - Email activity list (`Auth`)
- `GET /whatsapp-activities/:campaignId` - WhatsApp activity list (`Auth`)

### Active campaign fetchers for script delivery
- `GET /get-active-sms-campaigns` - Active SMS campaigns (`Public`)
- `GET /get-active-email-campaigns` - Active Email campaigns (`Public`)
- `GET /get-active-whatsapp-campaigns` - Active WhatsApp campaigns (`Public`)
- `POST /regenerate-all-active` - Regenerate all active campaigns (`Auth`)

### Shared helper
- `GET /api/filters` - Get campaign filters (`Public`)

---

## 4) Payment, Pricing, Subscription & Invoice APIs

### Payment
Route group: `/api/payment`

- `POST /create-order` - Create payment order (`Auth`)
- `POST /payment-verification` - Verify payment callback (`Public`)
- `GET /transactions` - Transaction list (`Auth`)
- `POST /success-email` - Send success email / save transaction (`Auth`)

### Pricing/package management
Route group: `/api/pricing`

- `POST /add-package` - Add package (`Auth`)
- `PUT /edit-package/:packageId` - Edit package (`Auth`)
- `GET /get-package/:packageId` - Get package by id (`Auth`)
- `DELETE /delete-package/:packageId` - Delete package (`Auth`)
- `GET /get-packages` - List packages (protected view) (`Auth`)
- `POST /package/primary/:packageId` - Set default package (`Auth`)
- `GET /getPackages` - List packages (public usage) (`Public`)
- `PUT /update-package/:id` - Update package (`Auth`)

### Subscription lifecycle
Route group: `/api/subscription`

- `POST /subscribe` - Subscribe to plan (`Auth`)
- `GET /user-subscription` - Get user subscriptions (`Auth`)
- `POST /upgrade` - Upgrade subscription (`Auth`)
- `POST /downgrade` - Downgrade subscription (`Auth`)
- `POST /downgrade-new` - New downgrade flow (`Auth`)
- `POST /check-downgrade-eligibility` - Check downgrade eligibility (`Auth`)
- `POST /cancel` - Cancel subscription (`Auth`)
- `GET /download-invoice/:orderId` - Download invoice (`Public`)

### Admin billing/settings
Route group: `/api/adminSeting`

- `POST /usd-to-inr` - Set USD to INR conversion settings (`Auth`)
- `POST /update-gst-settings` - Update GST settings (`Auth`)
- `GET /get-invoice-series` - Get invoice series config (`Auth`)
- `POST /update-invoice-series` - Update invoice series (`Auth`)
- `POST /freeze-invoice-series` - Freeze invoice series (`Auth`)
- `POST /restart-invoice-series` - Restart invoice series (`Auth`)

---

## 5) Dashboard, Analytics & Segmentation APIs

### Dashboard
Route group: `/api/dashboard`

- `GET /getvisitorlocation` - Visitor location analytics (`Auth`)
- `GET /getvisitordevice` - Visitor device analytics (`Auth`)
- `GET /getvisitor` - Visitor analytics (`Auth`)
- `GET /getConversion` - Conversion analytics (`Auth`)
- `GET /statistics` - Global dashboard stats (`Auth`)
- `GET /unique-visitors-since-signup` - Unique visitor stats since signup (`Auth`)

### Segment management
Route group: `/api/segment`

- `POST /create-segment` - Create segment (`Auth`)
- `GET /get-segments` - Get all segments (`Auth`)
- `GET /get-segments-dropdown` - Segment dropdown list (`Auth`)

### Credentials/profile support
Route groups: `/api/credentials`, `/api/userProfile`

- `POST /api/credentials/add-cred` - Add credentials (`Auth`)
- `PUT /api/credentials/update-cred/:id` - Update credentials (`Auth`)
- `GET /api/credentials/get-cred` - Get credentials (`Auth`)

- `GET /api/userProfile/getAllUserProfile` - Get all user profiles (`Auth`)
- `GET /api/userProfile/userProfile/:userProfileId` - Get profile by id (`Auth`)
- `POST /api/userProfile/email-credentials` - Add email credentials (`Auth`)
- `GET /api/userProfile/email-credentials/:userId` - Get email credentials (`Auth`)
- `PUT /api/userProfile/email-credentials/:editingId` - Update email credentials (`Auth`)
- `PATCH /api/userProfile/email-credentials/:id` - Toggle email credential status (`Auth`)
- `DELETE /api/userProfile/email-credentials/:id` - Delete email credentials (`Auth`)
- `POST /api/userProfile/sms-credentials` - Add SMS credentials (`Auth`)
- `GET /api/userProfile/sms-credentials/:userId` - Get SMS credentials (`Auth`)
- `PUT /api/userProfile/sms-credentials/:editingId` - Update SMS credentials (`Auth`)
- `PATCH /api/userProfile/sms-credentials/:id` - Toggle SMS credential status (`Auth`)
- `DELETE /api/userProfile/sms-credentials/:id` - Delete SMS credentials (`Auth`)
- `POST /api/userProfile/sendgrid-test-email` - Send test email (`Auth`)
- `POST /api/userProfile/twilio-test-sms` - Send test SMS (`Auth`)

---

## 6) Template Management APIs
Route group: `/api/templates`

- `GET /test` - Route health check (`Public`)
- `POST /add-template` - Add template (`Auth`, template manager)
- `GET /get-templates` - List templates (`Auth`)
- `GET /get-draft-templates` - List draft templates (`Auth`)
- `GET /debug-templates` - Debug templates (`Auth`)
- `GET /get-template/:id` - Get template by id (`Auth`)
- `PUT /edit-template/:id` - Edit template (`Auth`, template manager)
- `PUT /edit-template-details/:id` - Edit template details (`Auth`, template manager)
- `PUT /approve-template/:id` - Approve template (`Auth`)
- `DELETE /delete-template/:id` - Delete template (`Auth`, template manager)

---

## 7) WhatsApp APIs

### Webhook (Meta callback)
- `GET /api/webhook/whatsapp` - Webhook verification (`Public`)
- `POST /api/webhook/whatsapp` - Webhook event receiver (`Public`)

### Auth route WhatsApp APIs
Route group: `/api/auth/whatsapp/*`

- Provider config + logs:
  - `POST /configure`, `GET /config`, `DELETE /config`, `GET /logs`
- Test and template APIs:
  - `POST /send-test-message`, `GET /templates`, `GET /templates-enhanced`
  - `POST /templates/create`, `GET /templates/list`, `DELETE /templates/:templateName`
- Meta setup and utilities:
  - `POST /meta-setup`, `GET /recipients`, `POST /generate-token`, `PUT /update-data`, `GET /setup-access`
- Phone number setup:
  - `POST /phone-numbers/add`, `POST /phone-numbers/request-code`, `POST /phone-numbers/verify`

### Multi-tenant WhatsApp APIs (two route entries in project)

1) Under `/api/auth/whatsapp/multi-tenant/*`  
2) Under `/api/whatsapp/multi-tenant/*`

Common operations include:
- `GET /status` - Connection status (`Auth`)
- `GET /signup-link` - Embedded signup link (`Auth`)
- `GET /callback` - Callback receive (`Public`)
- `POST /callback` - Callback process (`Auth`)
- `DELETE /disconnect` - Disconnect integration (`Auth`)
- `POST /send-message` - Send WhatsApp message (`Auth`)

Additional endpoints exist under auth route for:
- Template operations, phone refresh/testing, token checks, logs, and WABA account diagnostics.

### WATI APIs (`/api/auth/whatsapp/wati/*`)
- `GET /config`, `POST /configure`, `DELETE /config`, `POST /send-message`, `GET /templates` (`Auth`)

### Twilio WhatsApp APIs (`/api/auth/whatsapp/twilio/*`)
- `GET /config`, `POST /configure`, `DELETE /config`, `POST /send-message`, `POST /send-media`, `GET /message-status/:messageId` (`Auth`)

---

## 8) Legacy v2 APIs (Backward Compatibility)

### `/api/v2` (user.route.js)
- `POST /register` - Register (`Public`)
- `POST /login` - Login (`Public`)
- `POST /logout` - Logout (`Public`)
- `GET /userdata` - All users (`Public`)
- `GET /singleuser/:id` - Single user (`Public`)
- `PUT /update/:id` - Update user (`Public`)
- `GET /loginhistory` - Login history (`Public`)
- `POST /forgotPassword` - Forgot password (`Public`)
- `PATCH /resetPassword/:token` - Reset password (`Public`)

### `/api/v2/campaign` (user.campaign.route.js)
- `POST /` - Create campaign (`Auth`)
- `GET /:id` - Get campaign (`Public`)
- `PUT /update-status/:id` - Update campaign status (`Auth`)
- `DELETE /delete/:id` - Delete campaign (`Public`)
- `PUT /update/:id` - Update campaign (`Auth`)
- `GET /` - List campaigns (`Public`)

### `/api/v2/visitors` (user.visitor.route.js)
- `POST /` - Add visitor (`Public`)
- `GET /getvisitor` - Get all visitors (`Auth`)
- `GET /getvisitor/:id` - Get visitor by id (`Public`)

### `/api/v2/script` (script.route.js)
- `GET /` - Get script (`Public`)
- `POST /write-script` - Write script test (`Public`)
- `POST /add-campaign-type` - Add campaign type (`Public`)
- `POST /add-campaign-action` - Add campaign action (`Public`)
- `POST /add-campaign-triggers` - Add campaign triggers (`Public`)

---

## 9) Root Utility Endpoints

- `GET /` - API uptime and server info (`Public`)
- `POST /send-message` - Twilio message utility endpoint (`Public`)
- `POST /send-whatsapp` - Twilio WhatsApp utility endpoint (`Public`)

