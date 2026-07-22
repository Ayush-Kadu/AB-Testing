## HTML Form Tracking Script (scripts-htmlFormTrackingScript.js)

A client-side helper that enriches forms with hidden analytics fields, posts submissions to the conversion API, and conditionally triggers SMS/Email campaigns after a successful conversion.

### Key features

- **Form detection**: Targets forms matching `.urlpt_form`, `.wpcf7-form`, `.gform_106`, `.isolate` and common submit buttons.
- **Cookie/util helpers**: Safely reads cookies, creates hidden inputs, and flattens nested objects.
- **User resolution**: Reads `window.userId` first, else falls back to `userId` cookie. Retries up to 50 times and injects into the form when found.
- **Session enrichment**: Reads `userCookie` (JSON) and flattens its properties into hidden inputs.
- **Visitor/visit IDs**: Adds `visitorId` and `visitId` from cookies.
- **Device/location hints**: Adds `user_agent`, current URL (`urlpt_url`), referrer (`urlpt_ref`), public IP (`urlpt_ip`, via `https://api.ipify.org?format=json`).
- **UTM/ad params**: Captures `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, `fbclid`, `msclkid`, `gclid` from the query string.
- **Custom hidden fields**: Loads `customFormTrackingInputs` from `localStorage` and injects them. Provides `window.refreshCustomFormInputs()` to refresh.
- **Traffic source**: Classifies source (`Direct`, `Internal`, `Google`, `Facebook`, `Twitter`, `Instagram`, `LinkedIn`, `YouTube`, `Bing`, `Yahoo`, `Referral`) from `document.referrer`.
- **Submission handling**: Gathers inputs, normalizes common fields, appends visitor/visit/user IDs, and POSTs to the conversion API.
- **Post-conversion triggers**: If successful, triggers user-specific SMS and/or Email campaigns via backend APIs.

### Execution flow

1. Wait for `DOMContentLoaded`.
2. Find target form and submit button; aborts if no form is present.
3. Attempt to resolve `userId` from `window.userId`, else from `userId` cookie, with retry backoff.
4. Inject hidden inputs for:
   - Flattened `userCookie` (if valid JSON)
   - `visitorId`, `visitId`
   - `user_agent`, `urlpt_url`, `urlpt_ref`, `urlpt_ip`
   - UTM/ad parameters
   - `traffic_source`
   - Custom fields from `localStorage`
5. Wire `click` and `submit` listeners to a single handler.
6. On submit:
   - Collect all form fields by `name` or `id`.
   - Normalize keys using heuristics (see below).
   - Add `visitorId`, `visitId`, `userId`.
   - POST JSON to `http://localhost:5008/api/conversion/add-conversion`.
7. On successful conversion response:
   - If `phone` present: save `phone` cookie and trigger SMS campaigns.
   - If `email` present: save `email` cookie and trigger Email campaigns.

### Field auto-mapping heuristics

- **email**: Keys containing `email`, `mail`, `e-mail`, `useremail`, `user_email`, or Gravity-style `input_*/field_*` when value contains `@`.
- **name**: Keys with `name`, `fname`, `firstname`, `first_name`, `fullname`, `full_name`, `username`, `user_name` (and generic `input_*` that aren’t email/phone).
- **phone**: Keys with `phone`, `tel`, `mobile`, `cell`, `telephone`, `userphone`, `user_phone`, or `input_*` with phone-like characters and length ≥ 7.
- **firstName**: Keys with `first`, `fname`, `firstname`, `first_name`.
- **lastName**: Keys with `last`, `lname`, `lastname`, `last_name`, `surname`.

### Hidden inputs added automatically

- `userId` (from `window.userId` or `userId` cookie)
- `visitorId` (cookie)
- `visitId` (cookie)
- `user_agent` (from `navigator.userAgent`)
- `urlpt_url` (current page URL)
- `urlpt_ref` (document referrer)
- `urlpt_ip` (public IP from ipify)
- `traffic_source` (classified source)
- UTM/ad params: `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, `fbclid`, `msclkid`, `gclid`
- Flattened `userCookie` object (every key becomes a hidden input)
- Any entries from `localStorage` under `customFormTrackingInputs`

### Example payload posted to the conversion API

```json
{
  "email": "jane.doe@example.com",
  "name": "Jane Doe",
  "firstName": "Jane",
  "lastName": "Doe",
  "phone": "+1 415 555 0199",
  "visitorId": "abc123",
  "visitId": "visit-xyz",
  "userId": "user-789",
  "user_agent": "Mozilla/5.0 ...",
  "urlpt_url": "https://example.com/landing",
  "urlpt_ref": "https://google.com",
  "urlpt_ip": "203.0.113.42",
  "traffic_source": "Google",
  "utm_source": "google",
  "utm_medium": "cpc",
  "utm_campaign": "spring_sale",
  "fbclid": null,
  "msclkid": null,
  "gclid": "Cj0...",
  "custom_field": "custom value",
  "nested_parent_child": "flattened value"
}
```

### Post-conversion campaign triggers

- **SMS campaigns**
  - Fetch active: `GET http://localhost:5008/api/campaign/get-active-sms-campaigns?userId={userId}`
  - Trigger send: `POST http://localhost:5008/api/script/send-sms`
  - Body includes: `contact` (phone), `templateId` (campaign `_id`), `userId`, `visitorId`, `visitId`

- **Email campaigns**
  - Fetch active: `GET http://localhost:5008/api/campaign/get-active-email-campaigns?userId={userId}`
  - Trigger send: `POST http://localhost:5008/api/script/send-email-campaign`
  - Body includes: `email`, `templateId`, `userId`, `visitorId`, `visitId`

On successful conversion, the script stores `phone` and/or `email` in cookies for future campaign usage.

### How to use

1. Ensure your page has a form that matches one of the supported selectors:
   - `.urlpt_form`, `.wpcf7-form`, `.gform_106`, `.isolate`
2. Optionally make `window.userId` available early; otherwise, set a `userId` cookie.
3. (Optional) Provide custom hidden fields via `localStorage`:

```javascript
localStorage.setItem(
  'customFormTrackingInputs',
  JSON.stringify([
    { name: 'account_id', value: 'acc_123' },
    { name: 'plan', value: 'pro' }
  ])
);

// When you need to refresh injected fields without reloading:
window.refreshCustomFormInputs();
```

4. Submit the form normally; the script handles enrichment and posting.

### Logging and troubleshooting

- The script logs key steps to the console with emojis for scannability.
- If you see “No form found…”, confirm your form matches a supported selector.
- If `userId` is missing after retries, provide `window.userId` earlier or set a `userId` cookie.
- If IP fetch fails, the rest of the enrichment still proceeds.
- If the conversion API returns a non-2xx, the error is logged and campaign triggers are skipped.

### Security and privacy notes

- Avoid storing sensitive PII in `localStorage` or long-lived cookies unless necessary and compliant.
- UTM and referrer data can contain user-attributable info; handle according to your policies.


