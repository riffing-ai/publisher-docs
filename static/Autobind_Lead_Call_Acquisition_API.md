<!-- This document is the complete API reference for the Autobind Lead & Call Acquisition API.
     It contains everything needed to build a working integration: endpoints, field schemas,
     TypeScript types, validation rules, and examples. The TypeScript types section is
     authoritative for request/response shapes. -->

# Autobind Lead & Call Acquisition API

*Last updated: 2026-03-23*

## Overview

JSON API for submitting auto insurance leads and call transfers via ping-post. You ping with bid parameters (demographics, drivers, vehicles) to get a price, then post the consumer's PII if you accept our bid. Compliance proof (TrustedForm) can go on either request but we strongly recommend the ping.

**Two media types:**
- **`lead`** — Form-submitted consumer data. We buy the data.
- **`call`** — Live call transfer. We provide a phone number to transfer the consumer's call to.

**Base URL:** `https://api.autobind.ai`

---

## Quick Start

### Lead — ping then post

```bash
# 1. Ping with consumer data (no PII)
curl -X POST https://api.autobind.ai/leads/ping \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "media_type": "lead",
    "campaign_name": "google-auto-full-form",
    "ip_address": "73.162.100.50",
    "user_agent": "Mozilla/5.0 Chrome/120.0.0.0",
    "media_source": "Google",
    "landing_page": "https://example.com/quote",
    "lead_created_at": "2026-03-23T14:30:00Z",
    "state_abbreviation": "TX",
    "zip": "75201",
    "language": "en",
    "currently_insured": true,
    "sr_twenty_two": false,
    "home_ownership": false,
    "drivers": [{ "gender": "male", "age": 35, "marital_status": "married", "license_status": "active" }],
    "vehicles": [{ "year": 2021, "make": "Toyota", "model": "Camry", "commercial_use": false }]
  }'
# → { "status": "bid", "bid_id": "...", "price": "4.20" }

# 2. Post PII (use the bid_id from step 1)
curl -X POST https://api.autobind.ai/leads/post \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "media_type": "lead",
    "bid_id": "BID_ID_FROM_PING",
    "trusted_form_cert_url": "https://cert.trustedform.com/abc123",
    "first_name": "John", "last_name": "Doe",
    "contact_phone": "2145559012", "email": "john@example.com",
    "street_address": "123 Main St", "city": "Dallas",
    "drivers": [{ "first_name": "John", "last_name": "Doe", "relationship_to_policyholder": "self", "birth_date": "1990-06-15" }]
  }'
# → { "status": "accepted", "bid_id": "..." }
```

### Call — ping then post

```bash
# 1. Ping with minimal data
curl -X POST https://api.autobind.ai/leads/ping \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "media_type": "call",
    "external_id": "your-unique-id-123",
    "state_abbreviation": "TX",
    "currently_insured": true,
    "language": "en"
  }'
# → { "status": "bid", "bid_id": "...", "price": "12.40", "transfer_phone": "8773119191", "minimum_call_duration": 90 }

# 2. Post with consumer's phone number (use the bid_id from step 1)
curl -X POST https://api.autobind.ai/leads/post \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "media_type": "call",
    "bid_id": "BID_ID_FROM_PING",
    "dial_in_phone": "2145559688"
  }'
# → { "status": "ok" }
# Transfer the consumer to transfer_phone from step 1.
# Call must last at least minimum_call_duration (90) seconds to qualify for payment.
```

---

## How It Works

> **Ping = bid parameters. Post = PII.** All demographic, insurance, driver, vehicle, and incident data is sent on the **ping** — these are the parameters we use to calculate your bid. The **post** contains only personally identifiable information (names, phones, email, address) and driver identity. Compliance proof (`trusted_form_cert_url`) can be sent on either request, but we strongly recommend including it on the ping — it's available at form fill time and lets us validate consent before you send PII.

### Lead Flow

1. Consumer submits a form on your site
2. You **ping** us with the required fields (state, insured status, drivers, vehicles) plus any optional fields you have — more data improves bid accuracy
3. We return a `bid_id` and `price`, or decline
4. If you accept our bid, you **post** the consumer's PII (name, phone, email, address) along with the `bid_id`. Bid parameters and compliance proof from the ping are already stored with the bid
5. We accept or reject the post — use `GET /leads/status/{bid_id}` to check status later

### Call Flow

1. Consumer wants an auto insurance quote (via your site or phone system)
2. You **ping** us with the required fields (`state_abbreviation`, `currently_insured`, `external_id`) plus any additional data you have — driver/vehicle info, zip, credit status, etc. all improve bid accuracy
3. We return a `bid_id`, `price`, `transfer_phone` (the number to transfer the consumer's call to), and `minimum_call_duration` (seconds required for payment)
4. If you accept our bid, you **post** the `bid_id` along with the consumer's phone number (`dial_in_phone`) — we need this to match the incoming call to your bid. If the call originated from a form and you have full lead data (name, address, drivers, vehicles, etc.), we strongly recommend including it in the post
5. Transfer the consumer to `transfer_phone`
6. Use `GET /leads/status/:id` later to check whether the call met the minimum duration and is billable

> **Why does the post require the consumer's phone number?** When the consumer calls our `transfer_phone`, we match the incoming caller ID to the `dial_in_phone` you provided. This is how we connect the call to your bid.

---

## Authentication

All requests require your API key in the `Authorization` header:

```
Authorization: Bearer YOUR_API_KEY
```

Keys are issued per partner during onboarding. The key identifies your account — no partner ID is needed in the request body. This is a server-to-server API — CORS is not supported, so do not call it from browser-side code.

---

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `POST /leads/ping` | Submit partial data, receive a bid or decline |
| `POST /leads/post` | Accept the bid — submit full data (leads) or consumer phone (calls) |
| `GET /leads/status/:id` | Check the status of an accepted lead or call |

---

## POST /leads/ping

Submit partial consumer data to receive a bid price. Response time < 200ms. No side effects — no data is stored until you post.

### Call Ping — Request

Minimal required fields. Providing driver/vehicle data is optional but improves bid accuracy.

```bash
curl -X POST https://api.autobind.ai/leads/ping \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "media_type": "call",
    "external_id": "your-unique-id-123",
    "state_abbreviation": "TX",
    "currently_insured": true,
    "language": "en"
  }'
```

### Call Ping — Rich Request (optional driver/vehicle data)

Including driver and vehicle data is optional for calls, but improves bid accuracy and the price we return.

```bash
curl -X POST https://api.autobind.ai/leads/ping \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "media_type": "call",
    "external_id": "your-unique-id-789",
    "state_abbreviation": "CA",
    "zip": "90210",
    "currently_insured": true,
    "language": "en",
    "trusted_form_cert_url": "https://cert.trustedform.com/abc123def456",
    "drivers": [
      {
        "gender": "female",
        "birth_date": "1988-04-12",
        "marital_status": "married",
        "license_status": "active"
      }
    ],
    "vehicles": [
      { "year": 2022, "make": "Honda", "model": "Civic", "commercial_use": false }
    ]
  }'
```

### Call Ping — Bid Response

```json
{
  "status": "bid",
  "bid_id": "550e8400-e29b-41d4-a716-446655440000",
  "external_id": "your-unique-id-123",
  "price": "12.40",
  "transfer_phone": "4103989038",
  "minimum_call_duration": 90
}
```

- `bid_id` — Include this in your post request
- `external_id` — Your ID echoed back so you can match this response to your consumer
- `transfer_phone` — The phone number to transfer the consumer's call to (10 digits, no country code)
- `minimum_call_duration` — Seconds the call must last to qualify for payment

### Lead Ping — Request

No PII required — only bid parameters (demographics, insurance, drivers, vehicles). `drivers[0]` is always the policyholder. Each driver can include an `incidents` array.

```bash
curl -X POST https://api.autobind.ai/leads/ping \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "media_type": "lead",
    "external_id": "your-unique-id-456",
    "campaign_name": "google-auto-full-form",
    "ip_address": "73.162.100.50",
    "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0",
    "media_source": "Google",
    "landing_page": "https://example.com/auto-insurance",
    "lead_created_at": "2026-03-22T14:30:00Z",
    "state_abbreviation": "TX",
    "zip": "75201",
    "language": "en",
    "currently_insured": true,
    "sr_twenty_two": false,
    "home_ownership": false,
    "credit_status": "average",
    "trusted_form_cert_url": "https://cert.trustedform.com/abc123def456",
    "drivers": [
      {
        "gender": "male",
        "birth_date": "1990-06-15",
        "marital_status": "married",
        "license_status": "active",
        "incidents": [
          {
            "type": "violation",
            "violation_type": "driving_under_the_influence"
          }
        ]
      },
      {
        "gender": "female",
        "age": 33,
        "marital_status": "married",
        "license_status": "active",
        "incidents": [
          {
            "type": "accident",
            "incident_date": "2025-06-15",
            "fault_status": "majority_at_fault",
            "damage_type": "property_and_bodily_injury"
          }
        ]
      }
    ],
    "vehicles": [
      { "year": 2021, "make": "Toyota", "model": "Camry", "commercial_use": false },
      { "year": 2023, "make": "Honda", "model": "CR-V", "commercial_use": false }
    ]
  }'
```

### Lead Ping — Bid Response

```json
{
  "status": "bid",
  "bid_id": "660f9500-a12c-41d4-b827-557766550000",
  "external_id": "your-unique-id-456",
  "price": "4.20"
}
```

Lead bids do NOT include `transfer_phone` or `minimum_call_duration`.

> **`price` is a string** to preserve decimal precision. Always 2 decimal places. Parse as a decimal type, not a float.

### Decline Response (both types)

```json
{
  "status": "decline",
  "reason": "no_bid",
  "external_id": "your-unique-id-123",
  "message": "Data validated successfully but no bid is available for this lead."
}
```

`message` is optional and human-readable — suitable for logging but not for display to end users. The text may change without notice; always use `reason` for programmatic logic.

**Decline reasons:**

| Reason | Meaning |
|--------|---------|
| `no_bid` | Data validated successfully but no bid is available. This covers all cases where we choose not to buy (state not supported, budget exhausted, doesn't meet criteria, outside operating hours, zip issues, etc.) |

### Handling Ping Responses

```pseudocode
response = ping(consumer_data)

if response.status == "bid":
    // We want to buy — post PII to accept
    post_response = post(bid_id, pii)
    if post_response.status == "accepted" or post_response.status == "ok":
        // Success — for calls, transfer consumer to transfer_phone from ping
    else:
        // Rejected — check post_response.reason (duplicate, expired, etc.)

else if response.status == "decline":
    // We don't want this lead/call — try another buyer or skip
    log(response.reason, response.message)

else if response.status == "error":
    // Bad request — fix the payload based on response.errors[]
    log(response.errors)
```

---

## POST /leads/post

Submit full data after winning the auction. Include the `bid_id` from the ping response.

**Bid expiry:**
- Lead bids expire after **90 seconds**
- Call bids expire after **60 seconds**

Posting after expiry returns `{"status": "rejected", "reason": "bid_expired"}`.

### Post — Accepted Responses

**Lead:**
```json
{ "status": "accepted", "bid_id": "660f9500-...", "external_id": "your-id" }
```

**Call:**
```json
{ "status": "ok" }
```

Once accepted, transfer the consumer to the `transfer_phone` returned in the ping response. The call must last at least `minimum_call_duration` seconds to qualify for payment.

### Rejected Response

```json
{ "status": "rejected", "reason": "duplicate_phone" }
```

| Reason | Meaning |
|--------|---------|
| `invalid_bid` | bid_id not found, wrong partner, or media type mismatch |
| `bid_expired` | Bid has expired (leads: 90s, calls: 60s) |
| `duplicate_phone` | Phone number seen in last 30 days (leads) |
| `duplicate_call` | Same phone had a billable call from your account in the last hour (calls) |
| `missing_consent_proof` | `trusted_form_cert_url` is missing (leads only) |
| `failed_secondary_evaluation` | Lead data failed our evaluation (leads only) |

---

## Compliance Proof

`trusted_form_cert_url` is required for all leads — it can be sent on either the **ping** or the **post** (not both needed). This is a [TrustedForm](https://activeprospect.com/trustedform/) certificate URL from ActiveProspect that proves the consumer consented on your form. Leads missing it on both requests are rejected with `"missing_consent_proof"`.

We strongly recommend sending `trusted_form_cert_url` (and all compliance fields) on the **ping**. The TrustedForm certificate is generated at form fill time, before you have PII — so it's available when you ping. Sending it early means your post only needs `bid_id`, PII, and driver identity.

---

## Field Reference

All ping and post fields in one table. ✅ = required, ○ = optional, — = not applicable.

> See the key principle above: **ping = bid parameters (+ compliance), post = PII.**

> **Call posts:** Only `media_type`, `bid_id`, and `dial_in_phone` are required. All other fields are optional — but including lead data improves conversion rates and the price we're willing to pay on future bids.


### Core Fields

| Field | Type | Lead Ping | Lead Post | Call Ping | Call Post | Description |
|-------|------|-----------|-----------|-----------|-----------|-------------|
| `media_type` | `"lead"` / `"call"` | ✅ | ✅ | ✅ | ✅ |  |
| `bid_id` | UUID | — | ✅ | — | ✅ | From ping response |
| `external_id` | string (100) | ○ | ○ | ○ | ○ | Your ID — echoed in responses. Omitted from response if not provided |
| `state_abbreviation` | string (2) | ✅ | — | ✅ | ○ | `"TX"` — 2 uppercase letters |
| `zip` | string (5) | ✅ | — | ○ | ○ | 5 digits, e.g. `"75201"` |
| `language` | `"en"` / `"es"` | ○ | ○ | ✅ | ○ | `"en"` = English, `"es"` = Spanish. Required for calls |
| `currently_insured` | boolean | ✅ | — | ✅ | — | Does the policyholder currently have an active auto insurance policy? |
| `home_ownership` | boolean | ✅ | — | ○ | — | Does the policyholder own their home? |
| `sr_twenty_two` | boolean | ✅ | — | ○ | — | `true` if **any** driver in the household has an SR-22, FR-44, or similar filing. For per-driver detail, use `.sr_twenty_two` on each driver |
| `dial_in_phone` | string (10 digits) | — | — | — | ✅ | Calls only. The caller ID we use to match the incoming call to your bid |

### Compliance & Consent

| Field | Type | Lead Ping | Lead Post | Call Ping | Call Post | Description |
|-------|------|-----------|-----------|-----------|-----------|-------------|
| `trusted_form_cert_url` | string (500) | ○ | ○ | ○ | ○ | **Required for leads** — send on ping or post (ping strongly recommended). TrustedForm cert URL proving consumer consent |
| `tcpa_language` | string (2000) | ○ | ○ | ○ | ○ | TCPA consent text shown on the form. We encourage sending this on the ping |
| `tcpa_json` | string (5000) | ○ | ○ | ○ | ○ | Structured TCPA consent data (includes consumer IP, timestamp). We encourage sending this on the ping |
| `leadid_token` | string | ○ | ○ | ○ | ○ | Jornaya LeadiD token. We encourage sending this on the ping |

### Submission Metadata

| Field | Type | Lead Ping | Lead Post | Call Ping | Call Post | Description |
|-------|------|-----------|-----------|-----------|-----------|-------------|
| `ip_address` | string | ✅ | — | ○ | — | Consumer's IP |
| `user_agent` | string (500) | ✅ | — | ○ | — | Browser user agent |
| `lead_created_at` | timestamp | ✅ | — | ○ | — | `YYYY-MM-DDTHH:mm:ssZ`. For calls originated from a form, include the timestamp of the original form fill |

### Traffic & Campaign

| Field | Type | Lead Ping | Lead Post | Call Ping | Call Post | Description |
|-------|------|-----------|-----------|-----------|-----------|-------------|
| `sub_id` | string (30) | ○ | — | ○ | — | Sub-affiliate tracking ID. Alphanumeric, hyphens, underscores |
| `campaign_name` | string (100) | ✅ | — | ○ | — |  |
| `media_source` | string | ○ | — | ○ | — | `"Google"`, `"Facebook"`, etc. |
| `traffic_channel` | enum | ○ | — | ○ | — | `"cpc"` `"organic"` `"display"` `"social"` `"email"` |
| `placement_type` | enum | ○ | — | ○ | — | `"thank_you_page"` `"early_exit"` `"form_page"` |
| `landing_page` | string (500) | ○ | — | ○ | — | URL consumer came from |
| `search_keyword` | string | ○ | — | ○ | — |  |

### Policyholder Contact & Address (post only)

| Field | Type | Lead Ping | Lead Post | Call Ping | Call Post | Description |
|-------|------|-----------|-----------|-----------|-----------|-------------|
| `first_name` | string (100) | — | ✅ | — | ○ |  |
| `middle_name` | string (100) | — | ○ | — | ○ |  |
| `last_name` | string (100) | — | ✅ | — | ○ |  |
| `street_address` | string (200) | — | ✅ | — | ○ | Including unit/apt |
| `city` | string (100) | — | ✅ | — | ○ |  |
| `contact_phone` | string (10 digits) | — | ✅ | — | ○ | Phone the policyholder consented to be contacted on. For calls, often the same as `dial_in_phone` — but may differ if the consumer calls from one number and consents to contact on another |
| `mobile_phone` | string (10 digits) | — | ○ | — | ○ | Only if consumer consented to mobile contact |
| `daytime_phone` | string (10 digits) | — | ○ | — | ○ |  |
| `evening_phone` | string (10 digits) | — | ○ | — | ○ |  |
| `email` | string (100) | — | ✅ | — | ○ |  |

### Demographics & Insurance (Policyholder)

| Field | Type | Lead Ping | Lead Post | Call Ping | Call Post | Description |
|-------|------|-----------|-----------|-----------|-----------|-------------|
| `credit_status` | enum | ○ | — | ○ | — | Policyholder's self-reported credit rating: `"excellent"` `"above_average"` `"average"` `"below_average"` `"poor"` |
| `residence_type` | enum | ○ | — | ○ | — | Policyholder's dwelling type: `"single_family_home"` `"townhouse"` `"condo"` `"apartment"` `"mobile_home"` `"other"` |
| `months_at_address` | number | ○ | — | ○ | — | Months at current address. Convert years to months (e.g. 3 years = `36`) |
| `current_company` | enum | ○ | — | ○ | — | Currently insured policyholder's insurance company: `"Allstate"` `"Geico"` `"Progressive"` ... see TypeScript types |
| `current_company_tenure_months` | number | ○ | — | ○ | — | Months with current insurer. Convert years to months (e.g. 3 years = `36`) |
| `current_policy_expires` | string | ○ | — | ○ | — | `YYYY-MM-DD` |
| `current_bi_per_person` | number | ○ | — | ○ | — | Current bodily injury limit per person in dollars, e.g. `30000` |
| `current_bi_per_accident` | number | ○ | — | ○ | — | Current bodily injury limit per accident in dollars, e.g. `60000` |
| `continuous_insurance_duration` | enum | ○ | — | ○ | — | How long continuously insured: `"less_than_6_months"` `"6_months_to_1_year"` `"1_to_2_years"` `"2_to_5_years"` `"5_plus_years"` |
| `lapse_duration` | enum | ○ | — | ○ | — | Not currently insured only. How long without insurance: `"1_to_15_days"` `"16_to_30_days"` `"31_days_to_6_months"` `"6_months_to_1_year"` `"1_to_4_years"` `"5_plus_years"` |
| `lapse_reason` | enum | ○ | — | ○ | — | Not currently insured only. Why the policyholder lapsed: `"military"` `"no_vehicle"` `"no_license"` `"no_need"` `"other"` |
| `coverage_type` | enum | ○ | — | ○ | — | Policyholder's **desired** coverage level for the new policy (not current): `"state_minimum"` `"basic"` `"superior"` `"premium"` |
| `policy_start_date` | string | ○ | — | ○ | — | Policyholder's desired start date for the new policy (`YYYY-MM-DD`) |

### drivers[] — Driver Array (1–6, policyholder = drivers[0])

| Field | Type | Lead Ping | Lead Post | Call Ping | Call Post | Description |
|-------|------|-----------|-----------|-----------|-----------|-------------|
| `drivers[]` | array | ✅ | ✅ | ○ | ○ | Ping: bid parameters. Post: PII only (names, relationship, license number) |
| `.first_name` | string (100) | — | ✅ | — | ○ |  |
| `.middle_name` | string (100) | — | ○ | — | ○ |  |
| `.last_name` | string (100) | — | ✅ | — | ○ |  |
| `.relationship_to_policyholder` | enum | ○ | ✅ | ○ | ○ | `"self"` `"spouse"` `"child"` `"parent"` `"sibling"` `"other"` — `"self"` must always be `drivers[0]` |
| `.birth_date` | string | ○ | ○ | ○ | ○ | `YYYY-MM-DD`. Ping: provide `birth_date` or `age` (at least one). Post: include if available — improves conversion, and ultimately pricing |
| `.age` | number (14–99) | ○ | — | ○ | — | Driver's age in years. Use instead of `birth_date` if PII is a concern on pings |
| `.gender` | enum | ✅ | — | ✅ | — | `"male"` `"female"` |
| `.marital_status` | enum | ✅ | — | ✅ | — | `"single"` `"married"` `"divorced"` `"separated"` `"widowed"` `"domestic_partnership"` `"civil_union"` |
| `.us_resident_past_twelve_months` | boolean | ○ | — | ○ | — | Has driver been a US resident for the past 12 months? |
| `.license_status` | enum | ✅ | — | ✅ | — | `"active"` `"suspended"` `"revoked"` `"expired"` `"permit"` `"no_license"`. Default `"active"` if not collected |
| `.license_state_or_country` | string | ○ | — | ○ | — | US: `"CA"`. Foreign: `"Mexico"` |
| `.license_number` | string (100) | — | ○ | — | ○ |  |
| `.age_first_licensed` | number (14–99) | ○ | — | ○ | — | Age when first licensed |
| `.first_licensed_date` | string | ○ | — | ○ | — | `YYYY-MM-DD` — Date first licensed |
| `.suspended_or_revoked_past_five_years` | boolean | ○ | — | ○ | — | License suspended or revoked in the past 5 years? |
| `.suspension_reason` | enum | ○ | — | ○ | — | `"driving_related"` `"non_driving_related"` `"failed_medical_exam"` `"failed_exam"` `"failed_to_comply"` |
| `.employment_status` | enum | ○ | — | ○ | — | `"company"` `"self"` `"military"` `"government"` `"retired"` `"student"` `"homemaker"` `"unemployed"` |
| `.education` | enum | ○ | — | ○ | — | `"less_than_high_school"` `"vocational"` `"high_school"` `"high_school_pursuing_bachelors"` `"associate"` `"associate_pursuing_bachelors"` `"bachelors"` `"bachelors_pursuing_graduate"` `"masters"` `"doctors"` `"lawyer"` `"phd"` |
| `.occupation` | string (100) | ○ | — | ○ | — | Driver's occupation |
| `.industry` | enum | ○ | — | ○ | — | `"financial"` `"agriculture"` `"arts"` `"assistants"` `"automotive"` `"cleaning"` `"computers"` `"construction"` `"counseling"` `"education"` `"engineering"` `"executives"` `"health"` `"law"` `"operators"` `"postal"` `"maintenance"` `"service"` `"food"` `"sales"` `"science"` `"travel"` |
| `.government_employment_type` | enum | ○ | — | ○ | — | `"federal_employee"` `"city_state_employee"` |
| `.student_type` | enum | ○ | — | ○ | — | `"high_school_student"` `"technical_vocational_student"` `"freshman_undergraduate"` `"sophomore_undergraduate"` `"junior_undergraduate"` `"senior_undergraduate"` `"graduate_student"` `"law_student"` `"medical_student"` |
| `.military_affiliation` | enum | ○ | — | ○ | — | `"active_duty"` `"military_retiree"` `"veteran"` `"military_academy_cadet"` `"national_guard"` `"military_reserves"` |
| `.sr_twenty_two` | boolean | ○ | — | ○ | — | Per-driver SR-22 status. When provided, takes precedence over the top-level `sr_twenty_two` for this driver |
| `.bankruptcy` | boolean | ○ | — | ○ | — | Has this driver filed for bankruptcy? |
| `.incidents[]` | array (0–6) | ○ | — | ○ | — | Ping-only. Omit if none |

### drivers[].incidents[] — Incidents per Driver (0–6)

| Field | Type | Lead Ping | Lead Post | Call Ping | Call Post | Description |
|-------|------|-----------|-----------|-----------|-----------|-------------|
| `.type` | enum | ✅ | — | ✅ | — | `"accident"` `"violation"` `"claim"` — required when incident is provided |
| `.incident_date` | string | ○ | — | ○ | — | `YYYY-MM-DD` |
| `.fault_status` | enum | ○ | — | ○ | — | Accidents only: `"not_at_fault"` `"less_than_50_percent"` `"majority_at_fault"` |
| `.damage_type` | enum | ○ | — | ○ | — | Accidents only: `"property_only"` `"bodily_injury"` `"property_and_bodily_injury"` |
| `.violation_type` | enum | ○ | — | ○ | — | Violations only: `"driving_under_the_influence"` `"speeding"` `"driving_while_using_a_cell_phone"` `"other"` |
| `.violation_type_other` | string | ○ | — | ○ | — | If violation_type is `"other"`, describe the violation |
| `.claim_type` | enum | ○ | — | ○ | — | Claims only: `"theft"` `"vandalism"` `"glass_repair"` `"other"` |
| `.claim_amount` | number | ○ | — | ○ | — | Dollar amount of the claim |

### vehicles[] — Vehicle Array (1–6)

| Field | Type | Lead Ping | Lead Post | Call Ping | Call Post | Description |
|-------|------|-----------|-----------|-----------|-----------|-------------|
| `vehicles[]` | array | ✅ | — | ○ | — | Ping-only. All vehicle data is sent on the ping |
| `.year` | number | ✅ | — | ✅ | — | Min 1900 |
| `.make` | string | ✅ | — | ✅ | — | `"Toyota"` |
| `.model` | string | ✅ | — | ✅ | — | `"Camry"` |
| `.trim` | string | ○ | — | ○ | — | e.g. `"LE"`, `"SE"` |
| `.vin` | string (17) | ○ | — | ○ | — | Exactly 17 characters |
| `.license_plate_state` | string (2) | ○ | — | ○ | — | `"TX"` |
| `.license_plate` | string | ○ | — | ○ | — | License plate number |
| `.commercial_use` | boolean | ✅ | — | ○ | — | Is this vehicle used for commercial/business purposes? Default `false` if not collected |
| `.type_of_commercial_use` | enum | ○ | — | ○ | — | `"clergy"` `"courier_service"` `"daycare"` `"delivery_fast_food"` `"delivery_retail_wholesale"` `"delivery_route"` `"delivery_us_mail"` `"delivery_and_sales"` `"doctor_professional"` `"farm_use"` `"lawyer_professional"` `"real_estate"` `"repair_installation"` `"ridesharing"` `"sales_multistate"` `"sales_route"` `"sales_calls"` `"social_worker"` `"transport_people"` `"travel_to_jobsites"` `"travel_to_meetings"` `"visit_clients"` `"visit_outside_offices"`. Map rideshare (Uber, Lyft) to `"transport_people"` |
| `.primary_driver` | boolean | ○ | — | ○ | — | Is this the primary driver of this vehicle? |
| `.ownership` | enum | ○ | — | ○ | — | `"fully_paid"` `"financed"` `"leased"` |
| `.vehicle_purchased_new` | boolean | ○ | — | ○ | — | Was the vehicle purchased new? |
| `.vehicle_purchase_date` | string | ○ | — | ○ | — | `YYYY-MM-DD` — Date vehicle was purchased |
| `.annual_mileage` | number | ○ | — | ○ | — | Estimated annual miles driven |
| `.current_mileage` | number | ○ | — | ○ | — | Current odometer reading |
| `.average_daily_mileage` | number | ○ | — | ○ | — | Average miles driven per day |
| `.commute_distance` | number (0–500) | ○ | — | ○ | — | One-way commute distance in miles |
| `.commute_days_per_week` | number (0–7) | ○ | — | ○ | — | Days per week driven to work |
| `.alarm` | boolean | ○ | — | ○ | — | Vehicle has anti-theft alarm? |
| `.parking` | enum | ○ | — | ○ | — | `"driveway"` `"private_garage"` `"parking_garage"` `"parking_lot"` `"street"` |

---

## Detailed Examples

Full realistic payloads showing all nesting. `drivers[0]` is always the policyholder.

### Lead Ping — 2 drivers, 2 vehicles, with incidents

```json
{
  "media_type": "lead",
  "external_id": "pub-2026-03-23-001",
  "campaign_name": "google-auto-full-form",
  "ip_address": "73.162.100.50",
  "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0",
  "media_source": "Google",
  "landing_page": "https://example.com/auto-insurance-quote",
  "lead_created_at": "2026-03-23T14:30:00Z",
  "state_abbreviation": "TX",
  "zip": "75201",
  "language": "en",
  "currently_insured": true,
  "sr_twenty_two": false,
  "home_ownership": false,
  "credit_status": "average",
  "drivers": [
    {
      "gender": "male",
      "age": 40,
      "marital_status": "married",
      "license_status": "active",
      "incidents": [
        {
          "type": "violation",
          "incident_date": "2025-01-10",
          "violation_type": "driving_under_the_influence"
        }
      ]
    },
    {
      "gender": "female",
      "age": 38,
      "marital_status": "married",
      "license_status": "active",
      "incidents": [
        {
          "type": "accident",
          "incident_date": "2025-06-15",
          "fault_status": "majority_at_fault",
          "damage_type": "property_and_bodily_injury"
        }
      ]
    }
  ],
  "vehicles": [
    { "year": 2021, "make": "Toyota", "model": "Camry", "commercial_use": false },
    { "year": 2023, "make": "Honda", "model": "CR-V", "commercial_use": false }
  ]
}
```

### Lead Post — PII for the same household

```json
{
  "media_type": "lead",
  "bid_id": "BID_ID_FROM_PING",
  "trusted_form_cert_url": "https://cert.trustedform.com/abc123def456",
  "first_name": "John",
  "last_name": "Doe",
  "contact_phone": "2145559012",
  "email": "john.doe@example.com",
  "street_address": "123 Main St",
  "city": "Dallas",
  "language": "en",
  "drivers": [
    {
      "first_name": "John",
      "last_name": "Doe",
      "relationship_to_policyholder": "self",
      "birth_date": "1985-06-15",
      "license_number": "12345678"
    },
    {
      "first_name": "Jane",
      "last_name": "Doe",
      "relationship_to_policyholder": "spouse",
      "birth_date": "1987-04-28",
      "license_number": "87654321"
    }
  ]
}
```

### Call Post — with optional PII

```json
{
  "media_type": "call",
  "bid_id": "BID_ID_FROM_PING",
  "dial_in_phone": "2145559688",
  "first_name": "John",
  "last_name": "Doe",
  "contact_phone": "2145559688",
  "email": "john.doe@example.com",
  "street_address": "123 Main St",
  "city": "Dallas",
  "state_abbreviation": "TX",
  "zip": "75201"
}
```

---

## GET /leads/status/:id

Check the status of an accepted lead or call. The `:id` is the `bid_id` from the ping/post responses.

**Polling guidance:** For calls, poll every 2–5 minutes after the transfer to check if `billable` has flipped to `true`. For leads, status is typically final within seconds of posting — a single check after 30 seconds is sufficient. Webhooks are planned for a future release.

### Lead Status Response

```json
{
  "bid_id": "660f9500-a12c-41d4-b827-557766550000",
  "external_id": "your-unique-id-456",
  "status": "accepted",
  "billable": true,
  "created_at": "2026-03-22T14:30:05Z"
}
```

### Call Status Response

```json
{
  "bid_id": "550e8400-e29b-41d4-a716-446655440000",
  "external_id": "your-unique-id-123",
  "status": "accepted",
  "billable": false,
  "call_duration": null,
  "minimum_call_duration": 90,
  "created_at": "2026-03-22T14:30:05Z"
}
```

For calls, `billable` is `false` until `call_duration >= minimum_call_duration`.

---

## Error Responses

### HTTP 400 — Validation Error

Single error:

```json
{
  "status": "error",
  "errors": ["'state_abbreviation' is required"]
}
```

Multiple errors:

```json
{
  "status": "error",
  "errors": [
    "'state_abbreviation' is required",
    "Must be exactly 10 digits, numeric only at 'contact_phone'",
    "'drivers' must have at least 1 item(s)"
  ]
}
```

### HTTP 401 — Authentication Error

```json
{
  "status": "error",
  "errors": ["Invalid or missing API key"]
}
```

### HTTP 429 — Rate Limited

| Endpoint | Limit |
|----------|-------|
| `POST /leads/ping` | 100 req/sec |
| `POST /leads/post` | 20 req/sec |
| `GET /leads/status/:id` | 50 req/sec |

No `Retry-After` header is included. Wait 1 second before retrying.

### HTTP 500 — Internal Error

Safe to retry (see Retry section).

---

## Retry & Idempotency

| Endpoint | Idempotent | Retry on |
|----------|------------|----------|
| `POST /leads/ping` | Yes (no side effects) | 429, 500, timeout |
| `POST /leads/post` | Yes (same `bid_id` returns same result) | 500, timeout |
| `GET /leads/status/:id` | Yes (read-only) | 429, 500, timeout |

**Do NOT retry on:** 400 (fix your payload), 401 (fix your API key), 200 with `"rejected"` (the lead was evaluated and rejected — retrying won't change the result).

**Retry strategy:**
```
Attempt 1: immediate
Attempt 2: wait 1 second
Attempt 3: wait 3 seconds
Give up.
```

**Timeout guidance:**

| Endpoint | Recommended timeout |
|----------|-------------------|
| Ping | 2 seconds |
| Post | 15 seconds |
| Status | 5 seconds |

---

## Validation Rules

### Phone numbers
All phone fields: exactly 10 digits, numeric only. No dashes, spaces, parentheses, or `+1` prefix.

### Dates
- `YYYY-MM-DD`: `birth_date`, `incident_date`, `first_licensed_date`, `current_policy_expires`, `policy_start_date`, `vehicle_purchase_date`
- `YYYY-MM-DDTHH:mm:ssZ`: `lead_created_at`

### State codes
- `state_abbreviation`, `license_plate_state`: 2 uppercase letters — `"TX"` not `"tx"` or `"Texas"`
- `license_state_or_country`: US states use 2-letter code (`"CA"`). For foreign licenses, use the full country name (`"Mexico"`, `"India"`, `"United Kingdom"`).

### Zip codes
5 digits. Leading zeros are significant: `"06510"`.

### Email
Must contain `@` and a domain with `.`. Max 100 characters.

### VIN
If provided, exactly 17 characters.

### Language
`"en"` (English) or `"es"` (Spanish). Required for call pings, optional for leads.

### Arrays
- `drivers`: 1–6 (required for lead pings and posts, optional for call pings)
- `vehicles`: 1–6 (required for lead pings, optional for call pings, not accepted on posts)
- `incidents`: 0–6 per driver

### Critical rules
- `drivers[0].relationship_to_policyholder` must be `"self"` on lead posts
- `trusted_form_cert_url` (TrustedForm by ActiveProspect) is **required** — on the ping or the post (ping recommended)
- Unknown fields are silently stripped and returned as `warnings` in the response (not rejected)

---

## Versioning

This API is not versioned. Breaking changes (removed fields, changed validation rules, new required fields) will be communicated via email with 30 days notice. Additive changes (new optional fields in responses, new optional request fields) may be made without notice — your integration should ignore unknown response fields.

---

## Test Environment

Append `?environment=test` as a **query parameter** to any endpoint URL (not in the JSON body):

```
POST https://api.autobind.ai/leads/ping?environment=test
POST https://api.autobind.ai/leads/post?environment=test
GET  https://api.autobind.ai/leads/status/{bid_id}?environment=test
```

| Behavior | Test | Production (default) |
|----------|------|---------------------|
| Bidding (ping) | Runs normally | Runs normally |
| Validation (post) | Full validation + schema dry-run | Full validation |
| Evaluation (post) | Skipped | Full |
| Data persisted | No | Yes |
| Budget consumed | No | Yes |

Test mode validates your payload structure and returns any errors. No data is persisted. Use this to verify your payloads are correctly formatted before going live.

---

## TypeScript Types

Copy this block into your project. All request and response shapes are defined here.

```typescript
// ── Shared ──

type TrafficChannel = "cpc" | "organic" | "display" | "social" | "email";
type PlacementType = "thank_you_page" | "early_exit" | "form_page";
type Language = "en" | "es";

// ── Ping Requests ──

interface PingDriver {
  gender: "male" | "female";
  birth_date?: string; // Provide birth_date or age (at least one)
  age?: number; // 14–99. At least one of birth_date or age required
  marital_status: MaritalStatus;
  relationship_to_policyholder?: "self" | "spouse" | "child" | "parent" | "sibling" | "other";
  license_status: "active" | "suspended" | "revoked" | "expired" | "permit" | "no_license";
  sr_twenty_two?: boolean; // Per-driver SR-22. When provided, takes precedence over top-level for this driver
  incidents?: PingIncident[]; // omit if none
}

interface PingIncident {
  type: "accident" | "violation" | "claim";
  incident_date?: string; // YYYY-MM-DD
  fault_status?: "not_at_fault" | "less_than_50_percent" | "majority_at_fault"; // accidents
  damage_type?: "property_only" | "bodily_injury" | "property_and_bodily_injury"; // accidents
  violation_type?: ViolationType; // violations
  violation_type_other?: string;  // if violation_type is "other"
  claim_type?: "theft" | "vandalism" | "glass_repair" | "other"; // claims
  claim_amount?: number; // claims
}

interface PingVehicle {
  year: number;
  make: string;
  model: string;
  commercial_use?: boolean;
}

// Lead ping driver/vehicle — commercial_use is required
// LeadPingDriver is the same as PingDriver — no additional fields
type LeadPingDriver = PingDriver;

interface LeadPingVehicle extends PingVehicle {
  commercial_use: boolean;
}

interface CallPingRequest {
  media_type: "call";
  external_id?: string;
  sub_id?: string;
  media_source?: string;
  traffic_channel?: TrafficChannel;
  campaign_name?: string;
  placement_type?: PlacementType;
  search_keyword?: string;
  landing_page?: string;
  ip_address?: string;
  user_agent?: string;
  state_abbreviation: string;
  zip?: string;
  currently_insured: boolean;
  sr_twenty_two?: boolean;
  home_ownership?: boolean;
  language: Language; // required for calls
  credit_status?: CreditStatus;
  residence_type?: ResidenceType;
  trusted_form_cert_url?: string;
  tcpa_language?: string;
  tcpa_json?: string;
  leadid_token?: string;
  drivers?: PingDriver[];
  vehicles?: PingVehicle[];
}

interface LeadPingRequest {
  media_type: "lead";
  external_id?: string;
  sub_id?: string;
  media_source?: string;
  traffic_channel?: TrafficChannel;
  campaign_name: string; // required for leads
  placement_type?: PlacementType;
  search_keyword?: string;
  landing_page?: string;
  ip_address: string;
  user_agent: string; // required for leads
  lead_created_at: string;
  state_abbreviation: string;
  zip: string;
  currently_insured: boolean;
  sr_twenty_two: boolean;
  home_ownership: boolean; // required for leads
  credit_status?: CreditStatus;
  residence_type?: ResidenceType;
  language?: Language;
  trusted_form_cert_url?: string;
  tcpa_language?: string;
  tcpa_json?: string;
  leadid_token?: string;
  drivers: LeadPingDriver[]; // required, 1–6
  vehicles: LeadPingVehicle[]; // required, 1–6
}

type PingRequest = CallPingRequest | LeadPingRequest;

// ── Ping Responses ──

interface CallBidResponse {
  status: "bid";
  bid_id: string;
  external_id?: string;
  price: string; // USD, always 2 decimal places, e.g. "12.40"
  transfer_phone: string; // 10 digits, no country code
  minimum_call_duration: number;
  warnings?: string[]; // e.g. ["Unknown field 'dui' was ignored"]
}

interface LeadBidResponse {
  status: "bid";
  bid_id: string;
  external_id?: string;
  price: string; // USD, always 2 decimal places, e.g. "4.20"
  warnings?: string[];
}

interface DeclineResponse {
  status: "decline";
  reason: "no_bid";
  external_id?: string;
  message?: string; // Human-readable explanation, suitable for logging. Do not display to end users — text may change.
}

type PingResponse = CallBidResponse | LeadBidResponse | DeclineResponse;

// ── Post Requests ──

// Only bid_id + dial_in_phone required. PII accepted for form-originated calls.
interface CallPostRequest {
  media_type: "call";
  bid_id: string;
  dial_in_phone: string; // 10 digits
  language?: Language;
  trusted_form_cert_url?: string;
  tcpa_language?: string;
  tcpa_json?: string;
  leadid_token?: string;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  contact_phone?: string;
  mobile_phone?: string;
  daytime_phone?: string;
  evening_phone?: string;
  email?: string;
  street_address?: string;
  city?: string;
  state_abbreviation?: string;
  zip?: string;
  drivers?: LeadPostDriver[]; // Optional driver PII for form-originated calls
}

// Post drivers contain only PII — risk fields are on the ping
interface LeadPostDriver {
  first_name: string;
  middle_name?: string;
  last_name: string;
  relationship_to_policyholder: "self" | "spouse" | "child" | "parent" | "sibling" | "other";
  license_number?: string;
  birth_date?: string; // Include if available — improves conversion, and ultimately pricing
}

interface LeadPostRequest {
  media_type: "lead";
  bid_id: string;
  trusted_form_cert_url?: string; // Required for leads — send on ping or post (not both needed)
  tcpa_language?: string;
  tcpa_json?: string;
  leadid_token?: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  contact_phone: string;
  mobile_phone?: string;
  daytime_phone?: string;
  evening_phone?: string;
  email: string;
  street_address: string;
  city: string;
  language?: Language;
  drivers: LeadPostDriver[]; // PII only — no vehicles on post
}

type PostRequest = CallPostRequest | LeadPostRequest;

// ── Post Responses ──

interface CallAcceptedResponse {
  status: "ok";
}

interface LeadAcceptedResponse {
  status: "accepted";
  bid_id: string;
  external_id?: string;
  warnings?: string[];
}

interface RejectedResponse {
  status: "rejected";
  reason: "invalid_bid" | "bid_expired" | "duplicate_phone" | "duplicate_call" | "missing_consent_proof" | "failed_secondary_evaluation";
}

type PostResponse = CallAcceptedResponse | LeadAcceptedResponse | RejectedResponse;

// ── Status Responses ──

interface LeadStatusResponse {
  bid_id: string;
  external_id?: string;
  status: "accepted" | "rejected";
  billable: boolean;
  created_at: string;
}

interface CallStatusResponse {
  bid_id: string;
  external_id?: string;
  status: "accepted" | "rejected";
  billable: boolean;
  call_duration: number | null;
  minimum_call_duration: number;
  created_at: string;
}

// ── Error Response ──

interface ErrorResponse {
  status: "error";
  errors: string[]; // Always an array, even for single errors
}

// ── Enums ──

type MaritalStatus = "single" | "married" | "divorced" | "separated" | "widowed" | "domestic_partnership" | "civil_union";
type CreditStatus = "excellent" | "above_average" | "average" | "below_average" | "poor";
type ResidenceType = "single_family_home" | "townhouse" | "condo" | "apartment" | "mobile_home" | "other";
type ViolationType = "driving_under_the_influence" | "speeding" | "driving_while_using_a_cell_phone" | "other";
type Education = "less_than_high_school" | "vocational" | "high_school" | "high_school_pursuing_bachelors" | "associate" | "associate_pursuing_bachelors" | "bachelors" | "bachelors_pursuing_graduate" | "masters" | "doctors" | "lawyer" | "phd";
type EmploymentStatus = "company" | "self" | "military" | "government" | "retired" | "student" | "homemaker" | "unemployed";
type Industry = "financial" | "agriculture" | "arts" | "assistants" | "automotive" | "cleaning" | "computers" | "construction" | "counseling" | "education" | "engineering" | "executives" | "health" | "law" | "operators" | "postal" | "maintenance" | "service" | "food" | "sales" | "science" | "travel";
type StudentType = "high_school_student" | "technical_vocational_student" | "freshman_undergraduate" | "sophomore_undergraduate" | "junior_undergraduate" | "senior_undergraduate" | "graduate_student" | "law_student" | "medical_student";
type MilitaryAffiliation = "active_duty" | "military_retiree" | "veteran" | "military_academy_cadet" | "national_guard" | "military_reserves";
type CommercialUseType =
  // Delivery
  | "courier_service" | "delivery_fast_food" | "delivery_retail_wholesale"
  | "delivery_route" | "delivery_us_mail" | "delivery_and_sales"
  // Sales & client visits
  | "sales_multistate" | "sales_route" | "sales_calls"
  | "visit_clients" | "visit_outside_offices"
  // Professional
  | "doctor_professional" | "lawyer_professional" | "clergy" | "social_worker"
  // Travel & transport
  | "travel_to_jobsites" | "travel_to_meetings" | "transport_people" | "ridesharing"
  // Other
  | "daycare" | "farm_use" | "real_estate" | "repair_installation";
type CurrentCompany = "21stCentury" | "AAA" | "Allstate" | "AmFam" | "Amica" | "AssuranceAmerica" | "BristolWest" | "Dairyland" | "DirectAuto" | "Elephant" | "Erie" | "Esurance" | "Farmers" | "Gainsco" | "Geico" | "Hartford" | "Infinity" | "Kemper" | "LibertyMutual" | "Mercury" | "MetLife" | "NationalGeneral" | "Nationwide" | "Progressive" | "Root" | "SafeAuto" | "Safeco" | "StateFarm" | "TheGeneral" | "Travelers" | "USAA" | "other";
```
