---
sidebar_position: 1
title: API Reference
slug: /
---

# Autobind Lead & Call Acquisition API

## Overview

JSON API for submitting auto insurance leads and call transfers via ping-post. You ping with partial consumer data to get a bid, then post the full data if you accept our price.

**Two media types:**
- **`lead`** — Form-submitted consumer data. We buy the data.
- **`call`** — Live call transfer. We provide a phone number to transfer the consumer's call to.

**Base URL:** `https://api.autobind.ai`

---

## How It Works

### Lead Flow

1. Consumer submits a form on your site
2. You **ping** us with the required fields (state, insured status, drivers, vehicles) plus any optional fields you have — more data improves bid accuracy
3. We return a `bid_id` and `price`, or decline
4. If you accept our bid, you **post** the full consumer data (name, phone, email, address, etc.) along with the `bid_id`. Include as much data as possible — the more we have, the better we can service the lead
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

Keys are issued per partner during onboarding. The key identifies your account — no partner ID is needed in the request body.

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

### Call Ping — Bid Response

```json
{
  "status": "bid",
  "bid_id": "550e8400-e29b-41d4-a716-446655440000",
  "external_id": "your-unique-id-123",
  "price": "4.80",
  "transfer_phone": "4103989038",
  "minimum_call_duration": 90
}
```

- `bid_id` — Include this in your post request
- `external_id` — Your ID echoed back so you can match this response to your consumer
- `transfer_phone` — The phone number to transfer the consumer's call to
- `minimum_call_duration` — Seconds the call must last to qualify for payment

### Lead Ping — Request

No PII required — only demographic and risk data for bidding.

```bash
curl -X POST https://api.autobind.ai/leads/ping \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "media_type": "lead",
    "external_id": "your-unique-id-456",
    "ip_address": "73.162.100.50",
    "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0",
    "media_source": "Google",
    "landing_page": "https://example.com/auto-insurance",
    "lead_created_at": "2026-03-22T14:30:00Z",
    "state_abbreviation": "TX",
    "zip": "75201",
    "currently_insured": true,
    "home_ownership": false,
    "credit_status": "average",
    "drivers": [
      {
        "gender": "male",
        "birth_date": "1990-06-15",
        "marital_status": "married",
        "license_status": "active",
        "sr_twenty_two": false,
        "dui": false
      }
    ],
    "vehicles": [
      { "year": 2021, "make": "Toyota", "model": "Camry", "primary_purpose": false }
    ]
  }'
```

### Lead Ping — Bid Response

```json
{
  "status": "bid",
  "bid_id": "660f9500-a12c-41d4-b827-557766550000",
  "external_id": "your-unique-id-456",
  "price": "0.29"
}
```

Lead bids do NOT include `transfer_phone` or `minimum_call_duration`.

### Decline Response (both types)

```json
{
  "status": "decline",
  "reason": "no_bid",
  "external_id": "your-unique-id-123",
  "message": "Data validated successfully but no bid is available for this lead."
}
```

**Decline reasons:**

| Reason | Meaning |
|--------|---------|
| `no_bid` | Data validated successfully but no bid is available. This covers all cases where we choose not to buy (state not supported, budget exhausted, doesn't meet criteria, outside operating hours, zip issues, etc.) |

### Ping Field Reference

**Required for all pings (call and lead):**

| Field | Type | Description |
|-------|------|-------------|
| `media_type` | `"call"` or `"lead"` | Determines validation rules and response shape |
| `state_abbreviation` | string (2 uppercase letters) | US state code, e.g., `"TX"` |
| `currently_insured` | boolean | Whether consumer has active auto insurance |

**Required for call pings only:**

| Field | Type | Description |
|-------|------|-------------|
| `language` | `"en"` (English) or `"es"` (Spanish) | Consumer's preferred language. Default to `"en"` if not collected. |

**Required for lead pings only:**

| Field | Type | Description |
|-------|------|-------------|
| `ip_address` | string | Consumer's IP address |
| `user_agent` | string (max 500) | Consumer's browser user agent |
| `media_source` | string | Traffic source — `"Google"`, `"Facebook"`, etc. |
| `landing_page` | string (max 500) | URL consumer came from |
| `zip` | string (5 digits) | Zip code, e.g., `"75201"` |
| `home_ownership` | boolean | `true` = homeowner |
| `lead_created_at` | timestamp | When consumer submitted the form. Format: `YYYY-MM-DDTHH:mm:ssZ`, e.g. `"2026-03-23T19:36:43Z"` |
| `drivers` | array (1–6) | At least one driver object (see below) |
| `vehicles` | array (1–6) | At least one vehicle object (see below) |

**Optional for all pings (improves bid accuracy):**

| Field | Type | Description |
|-------|------|-------------|
| `external_id` | string (max 100) | Your unique ID for this consumer/session. Echoed back in all responses for correlation. |
| `sub_id` | string (max 30) | Sub-affiliate tracking ID |
| `traffic_channel` | `"cpc"`, `"organic"`, `"display"`, `"social"`, `"email"` | Channel type |
| `campaign_name` | string (max 100) | Your marketing campaign identifier |
| `placement_type` | `"thank_you_page"`, `"early_exit"`, `"form_page"` | Where consumer converted |
| `search_keyword` | string | Search term that triggered the ad |
| `credit_status` | `"excellent"`, `"above_average"`, `"average"`, `"below_average"`, `"poor"` | Self-reported credit |
| `residence_type` | `"single_family_home"`, `"townhouse"`, `"condo"`, `"apartment"`, `"mobile_home"`, `"other"` | Dwelling type |

**Optional for call pings only (required for lead pings — listed above):**

| Field | Type | Description |
|-------|------|-------------|
| `ip_address` | string | Consumer's IP address |
| `user_agent` | string (max 500) | Consumer's browser user agent |
| `media_source` | string | Traffic source |
| `landing_page` | string (max 500) | URL consumer came from |
| `home_ownership` | boolean | `true` = homeowner |
| `zip` | string (5 digits) | Zip code |
| `language` | `"en"` (English) or `"es"` (Spanish) | Consumer's preferred language |
| `drivers` | array (1–6) | Driver objects (see below) |
| `vehicles` | array (1–6) | Vehicle objects (see below) |

**Ping driver object:**

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `gender` | YES | `"male"`, `"female"` | |
| `birth_date` | YES | string | `YYYY-MM-DD` |
| `marital_status` | YES | enum | `"single"`, `"married"`, `"divorced"`, `"separated"`, `"widowed"`, `"domestic_partnership"`, `"civil_union"` |
| `license_status` | YES | enum | `"active"`, `"suspended"`, `"expired"`, `"permit"`, `"no_license"` |
| `sr_twenty_two` | YES | boolean | SR-22 or SR-1P filing requirement. Default to `false` if not collected. |
| `dui` | Leads: YES, Calls: NO | boolean | DUI in past 5 years. Default to `false` if not collected. |
| `incidents` | NO | array (0–6) | Incidents for this driver. Omit if none. See ping incident object below. |

**Ping incident object:**

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `type` | YES | enum | `"accident"`, `"violation"`, `"claim"` |
| `incident_date` | NO | string | `YYYY-MM-DD` — include if available |

**Ping vehicle object:**

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `year` | YES | number | Model year (min 1900) |
| `make` | YES | string | e.g., `"Toyota"` |
| `model` | YES | string | e.g., `"Camry"` |
| `primary_purpose` | Leads: YES, Calls: NO | boolean | `false` = personal/commute, `true` = primarily used for commercial purposes (triggers `type_of_business_use` on post). Default to `false` if not collected. |

---

## POST /leads/post

Submit full data after winning the auction. Include the `bid_id` from the ping response.

**Bid expiry:**
- Lead bids expire after **90 seconds**
- Call bids expire after **60 seconds**

Posting after expiry returns `{"status": "rejected", "reason": "bid_expired"}`.

### Call Post — Request

```bash
curl -X POST https://api.autobind.ai/leads/post \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "media_type": "call",
    "bid_id": "550e8400-e29b-41d4-a716-446655440000",
    "dial_in_phone": "2145559688",
    "language": "en"
  }'
```

### Call Post — Accepted Response

```json
{
  "status": "accepted",
  "bid_id": "550e8400-e29b-41d4-a716-446655440000",
  "external_id": "your-unique-id-123",
  "transfer_phone": "4103989038",
  "minimum_call_duration": 90
}
```

Transfer the consumer to `transfer_phone`. The call must last at least `minimum_call_duration` seconds to qualify for payment.

### Call Post Field Reference

**Required:**

| Field | Type | Description |
|-------|------|-------------|
| `media_type` | `"call"` | |
| `bid_id` | string (UUID) | From ping response |
| `dial_in_phone` | string (10 digits) | Consumer's caller ID |

**Optional — if the call originated from a form, you may include full lead data. We'll store it but will not reject the call based on it.**

`ip_address`, `user_agent`, `lead_created_at`, `language`, `trusted_form_url`, `tcpa_language`, `tcpa_json`, `leadid_token`, `first_name`, `middle_name`, `last_name`, `contact_phone`, `mobile_phone`, `daytime_phone`, `evening_phone`, `email`, `street_address`, `city`, `state_abbreviation`, `zip`, `credit_status`, `residence_type`, `home_ownership`, `years_at_address`, `months_at_address`, `currently_insured`, `insured_last_thirty_days`, `insured_last_five_years`, `current_company`, `current_policy_expires`, `current_bi_per_person`, `current_bi_per_accident`, `current_company_tenure_months`, `insured_duration`, `lapse_reason`, `coverage_type`, `policy_start_date`, `vehicles_in_household`, `drivers[]`, `vehicles[]`

See the Lead Post Field Reference and TypeScript types for field details.

### Lead Post — Request

**`trusted_form_url` is required for all lead posts.** Leads without a TrustedForm certificate (by ActiveProspect) will be rejected with `"missing_consent_proof"`.

```bash
curl -X POST https://api.autobind.ai/leads/post \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "media_type": "lead",
    "bid_id": "660f9500-a12c-41d4-b827-557766550000",
    "ip_address": "73.162.100.50",
    "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0",
    "media_source": "Google",
    "landing_page": "https://example.com/auto-insurance",
    "lead_created_at": "2026-03-22T14:30:00Z",
    "trusted_form_url": "https://cert.trustedform.com/abc123",
    "first_name": "John",
    "last_name": "Doe",
    "contact_phone": "2145559012",
    "email": "john@example.com",
    "street_address": "123 Main St",
    "city": "Dallas",
    "state_abbreviation": "TX",
    "zip": "75201",
    "currently_insured": true,
    "home_ownership": false,
    "drivers": [
      {
        "first_name": "John",
        "last_name": "Doe",
        "gender": "male",
        "birth_date": "1990-06-15",
        "marital_status": "married",
        "relationship_to_policyholder": "self",
        "license_status": "active",
        "sr_twenty_two": false
      }
    ],
    "vehicles": [
      { "year": 2021, "make": "Toyota", "model": "Camry", "primary_purpose": false }
    ]
  }'
```

### Lead Post — Accepted Response

```json
{
  "status": "accepted",
  "bid_id": "660f9500-a12c-41d4-b827-557766550000",
  "external_id": "your-unique-id-456"
}
```

### Rejected Response (both types)

```json
{
  "status": "rejected",
  "reason": "duplicate_phone"
}
```

**Post rejection reasons (both leads and calls):**

| Reason | Meaning |
|--------|---------|
| `invalid_bid` | bid_id not found, wrong partner, or media type mismatch |
| `bid_expired` | Bid has expired (leads: 90s, calls: 60s) |
| `duplicate_phone` | Phone number seen in last 30 days |
| `missing_consent_proof` | `trusted_form_url` is missing (leads only) |
| `failed_secondary_evaluation` | Lead data failed our secondary evaluation checks (leads only) |

### Lead Post Field Reference

**Required fields:**

| Field | Type | Description |
|-------|------|-------------|
| `media_type` | `"lead"` | |
| `bid_id` | string (UUID) | From ping response |
| `ip_address` | string | Consumer's IP address |
| `user_agent` | string (max 500) | Consumer's browser user agent |
| `media_source` | string | Traffic source — `"Google"`, `"Facebook"`, etc. |
| `landing_page` | string (max 500) | URL consumer came from |
| `lead_created_at` | timestamp | Format: `YYYY-MM-DDTHH:mm:ssZ`, e.g. `"2026-03-23T19:36:43Z"` |
| `trusted_form_url` | string | TrustedForm certificate URL (by ActiveProspect). **Required.** |
| `first_name` | string (max 100) | Policyholder's first name |
| `last_name` | string (max 100) | Policyholder's last name |
| `contact_phone` | string (10 digits) | Phone number the consumer provided consent to be contacted on. |
| `email` | string (max 100) | Valid email address |
| `street_address` | string (max 200) | Street address including unit/apt |
| `city` | string (max 100) | City name |
| `state_abbreviation` | string (2 uppercase letters) | US state code |
| `zip` | string (5 digits) | Zip code |
| `currently_insured` | boolean | Has active auto insurance |
| `home_ownership` | boolean | `true` = homeowner |
| `drivers` | array (1–6) | Full driver objects. `drivers[0].relationship_to_policyholder` must be `"self"` |
| `vehicles` | array (1–6) | Full vehicle objects. `primary_purpose` is required on each vehicle. |

**Optional fields (see TypeScript types section for complete list):**

`middle_name`, `mobile_phone` (include only if the consumer also consented to be contacted on their mobile number), `daytime_phone`, `evening_phone`, `tcpa_language`, `tcpa_json`, `leadid_token`, `credit_status`, `residence_type`, `years_at_address`, `months_at_address`, `insured_last_thirty_days`, `insured_last_five_years`, `current_company`, `current_policy_expires`, `current_bi_per_person`, `current_bi_per_accident`, `current_company_tenure_months`, `insured_duration`, `lapse_reason`, `coverage_type`, `policy_start_date`, `vehicles_in_household`, `language`

### Incident Examples

Each incident has a `type` that determines which additional fields apply. All additional fields are optional — include what you have.

**Accident:**
```json
{
  "type": "accident",
  "incident_date": "2025-06-15",
  "fault_status": "majority_at_fault",
  "damage_type": "property_and_bodily_injury"
}
```
- `fault_status`: `"not_at_fault"`, `"less_than_50_percent"`, `"majority_at_fault"`
- `damage_type`: `"property_only"`, `"bodily_injury"`, `"property_and_bodily_injury"`

**Violation — DUI:**
```json
{
  "type": "violation",
  "violation_type": "driving_under_the_influence"
}
```

**Violation — other:**
```json
{
  "type": "violation",
  "violation_type": "other",
  "violation_type_other": "Running a red light"
}
```
- `violation_type`: `"driving_under_the_influence"`, `"speeding"`, `"driving_while_using_a_cell_phone"`, `"other"`
- If `"other"`, include `violation_type_other` with a description

**Claim:**
```json
{
  "type": "claim",
  "claim_type": "theft",
  "claim_amount": 3500
}
```
- `claim_type`: `"theft"`, `"vandalism"`, `"glass_repair"`, `"other"`
- `claim_amount`: dollar amount of the claim

> **Note:** All fields besides `type` are optional — include what you have. `incident_date` (`YYYY-MM-DD`) is helpful but not required.

---

## GET /leads/status/:id

Check the status of an accepted lead or call. The `:id` is the `bid_id` from the ping/post responses.

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
  "error": "'external_id' is required",
  "errors": ["'external_id' is required"]
}
```

Multiple errors:

```json
{
  "status": "error",
  "error": "Multiple validation errors",
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
  "error": "Invalid or missing API key"
}
```

### HTTP 429 — Rate Limited

| Endpoint | Limit |
|----------|-------|
| `POST /leads/ping` | 100 req/sec |
| `POST /leads/post` | 20 req/sec |
| `GET /leads/status/:id` | 50 req/sec |

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
- `drivers`: 1–6 (required for lead pings/posts, optional for call pings)
- `vehicles`: 1–6 (required for lead pings/posts, optional for call pings)
- `incidents`: 0–6 per driver

### Critical rules
- `drivers[0].relationship_to_policyholder` must be `"self"` on lead posts
- `trusted_form_url` (TrustedForm by ActiveProspect) is **required** on lead posts
- Lead posts use `.strict()` — unknown fields are rejected

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
  birth_date: string;
  marital_status: MaritalStatus;
  license_status: "active" | "suspended" | "expired" | "permit" | "no_license";
  sr_twenty_two: boolean;
  dui?: boolean;
  incidents?: PingIncident[]; // omit if none
}

interface PingIncident {
  type: "accident" | "violation" | "claim";
  incident_date?: string; // YYYY-MM-DD — include if available
}

interface PingVehicle {
  year: number;
  make: string;
  model: string;
  primary_purpose?: boolean;
}

// Lead ping driver/vehicle — dui and primary_purpose are required
interface LeadPingDriver extends PingDriver {
  dui: boolean;
  incidents?: PingIncident[]; // omit if none
}

interface LeadPingVehicle extends PingVehicle {
  primary_purpose: boolean;
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
  home_ownership?: boolean;
  language: Language; // required for calls
  credit_status?: CreditStatus;
  residence_type?: ResidenceType;
  drivers?: PingDriver[];
  vehicles?: PingVehicle[];
}

interface LeadPingRequest {
  media_type: "lead";
  external_id?: string;
  sub_id?: string;
  media_source: string; // required for leads
  traffic_channel?: TrafficChannel;
  campaign_name?: string;
  placement_type?: PlacementType;
  search_keyword?: string;
  landing_page: string; // required for leads
  ip_address: string;
  user_agent: string; // required for leads
  lead_created_at: string;
  state_abbreviation: string;
  zip: string;
  currently_insured: boolean;
  home_ownership: boolean; // required for leads
  credit_status?: CreditStatus;
  residence_type?: ResidenceType;
  language?: Language;
  drivers: LeadPingDriver[]; // required, 1–6
  vehicles: LeadPingVehicle[]; // required, 1–6
}

type PingRequest = CallPingRequest | LeadPingRequest;

// ── Ping Responses ──

interface CallBidResponse {
  status: "bid";
  bid_id: string;
  external_id: string;
  price: string; // USD, always 2 decimal places, e.g. "4.80"
  transfer_phone: string;
  minimum_call_duration: number;
}

interface LeadBidResponse {
  status: "bid";
  bid_id: string;
  external_id: string;
  price: string; // USD, always 2 decimal places, e.g. "0.29"
}

interface DeclineResponse {
  status: "decline";
  reason: string;
  external_id: string;
}

type PingResponse = CallBidResponse | LeadBidResponse | DeclineResponse;

// ── Post Requests ──

// Only bid_id + dial_in_phone required. Full lead data accepted for form-originated calls.
interface CallPostRequest {
  media_type: "call";
  bid_id: string;
  dial_in_phone: string; // 10 digits
  ip_address?: string;
  user_agent?: string;
  lead_created_at?: string;
  language?: Language;
  trusted_form_url?: string;
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
  credit_status?: CreditStatus;
  residence_type?: ResidenceType;
  home_ownership?: boolean;
  years_at_address?: number;
  months_at_address?: number;
  currently_insured?: boolean;
  insured_last_thirty_days?: boolean;
  insured_last_five_years?: boolean;
  current_company?: CurrentCompany;
  current_policy_expires?: string;
  current_bi_per_person?: number;
  current_bi_per_accident?: number;
  current_company_tenure_months?: number;
  insured_duration?: number;
  lapse_reason?: "military" | "no_vehicle" | "no_license" | "no_need" | "other";
  coverage_type?: "state_minimum" | "basic" | "superior" | "premium";
  policy_start_date?: string;
  vehicles_in_household?: number;
  drivers?: LeadPostDriver[];
  vehicles?: LeadPostVehicle[];
}

interface LeadPostIncident {
  type: "accident" | "violation" | "claim";
  incident_date?: string; // YYYY-MM-DD

  // Accidents
  fault_status?: "not_at_fault" | "less_than_50_percent" | "majority_at_fault";
  damage_type?: "property_only" | "bodily_injury" | "property_and_bodily_injury";

  // Violations
  violation_type?: "driving_under_the_influence" | "speeding" | "driving_while_using_a_cell_phone" | "other";
  violation_type_other?: string;

  // Claims
  claim_type?: "theft" | "vandalism" | "glass_repair" | "other";
  claim_amount?: number;
}

interface LeadPostDriver {
  first_name: string;
  middle_name?: string;
  last_name: string;
  gender: "male" | "female";
  birth_date: string;
  marital_status: MaritalStatus;
  relationship_to_policyholder: "self" | "spouse" | "child" | "parent" | "sibling" | "other";
  license_status: "active" | "suspended" | "expired" | "permit" | "no_license";
  license_state_or_country?: string; // US state: 2-letter code ("CA"). Foreign: full country name ("Mexico")
  license_number?: string;
  license_revoked?: boolean;
  suspended_or_revoked_past_five_years?: boolean;
  bankruptcy?: boolean;
  sr_twenty_two: boolean;
  age_first_licensed?: number;
  first_licensed_date?: string;
  continuous_coverage_six_months?: boolean;
  lapse_over_fifteen_days?: boolean;
  suspension_reason?: "driving_related" | "non_driving_related" | "failed_medical_exam" | "failed_exam" | "failed_to_comply";
  education?: Education;
  employment_status?: EmploymentStatus;
  occupation?: string;
  industry?: Industry;
  government_employment_type?: "federal_employee" | "city_state_employee";
  student_type?: StudentType;
  military_affiliation?: MilitaryAffiliation;
  us_resident_past_twelve_months?: boolean;
  incidents?: LeadPostIncident[]; // omit if none
}

interface LeadPostVehicle {
  year: number;
  make: string;
  model: string;
  trim?: string;
  vin?: string;
  ownership?: "fully_paid" | "financed" | "leased";
  primary_purpose: boolean; // required for lead posts, optional for call posts
  type_of_business_use?: BusinessUseType;
  primary_driver?: boolean;
  annual_mileage?: number;
  current_mileage?: number;
  average_mileage?: number;
  commute_distance?: number;
  commute_days_per_week?: number;
  ride_share?: boolean;
  alarm?: boolean;
  parking?: "driveway" | "private_garage" | "parking_garage" | "parking_lot" | "street";
  license_plate?: string;
  license_plate_state?: string; // 2-letter US state code, e.g. "TX"
  vehicle_purchased_new?: boolean;
  vehicle_purchase_date?: string;
}

interface LeadPostRequest {
  media_type: "lead";
  bid_id: string;
  ip_address: string;
  user_agent: string;
  media_source: string;
  landing_page: string;
  lead_created_at: string;
  trusted_form_url: string; // REQUIRED — TrustedForm by ActiveProspect
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
  state_abbreviation: string;
  zip: string;
  credit_status?: CreditStatus;
  residence_type?: ResidenceType;
  home_ownership: boolean;
  years_at_address?: number;
  months_at_address?: number;
  currently_insured: boolean;
  insured_last_thirty_days?: boolean;
  insured_last_five_years?: boolean;
  current_company?: CurrentCompany;
  current_policy_expires?: string;
  current_bi_per_person?: number;
  current_bi_per_accident?: number;
  current_company_tenure_months?: number;
  insured_duration?: number;
  lapse_reason?: "military" | "no_vehicle" | "no_license" | "no_need" | "other";
  coverage_type?: "state_minimum" | "basic" | "superior" | "premium";
  policy_start_date?: string;
  vehicles_in_household?: number;
  language?: Language;
  drivers: LeadPostDriver[];
  vehicles: LeadPostVehicle[];
}

type PostRequest = CallPostRequest | LeadPostRequest;

// ── Post Responses ──

interface CallAcceptedResponse {
  status: "accepted";
  bid_id: string;
  external_id: string;
  transfer_phone: string;
  minimum_call_duration: number;
}

interface LeadAcceptedResponse {
  status: "accepted";
  bid_id: string;
  external_id: string;
}

interface RejectedResponse {
  status: "rejected";
  reason: string;
}

type PostResponse = CallAcceptedResponse | LeadAcceptedResponse | RejectedResponse;

// ── Status Responses ──

interface LeadStatusResponse {
  bid_id: string;
  external_id: string;
  status: "accepted" | "rejected";
  billable: boolean;
  created_at: string;
}

interface CallStatusResponse {
  bid_id: string;
  external_id: string;
  status: "accepted" | "rejected";
  billable: boolean;
  call_duration: number | null;
  minimum_call_duration: number;
  created_at: string;
}

// ── Error Response ──

interface ErrorResponse {
  status: "error";
  error: string;
}

// ── Enums ──

type MaritalStatus = "single" | "married" | "divorced" | "separated" | "widowed" | "domestic_partnership" | "civil_union";
type CreditStatus = "excellent" | "above_average" | "average" | "below_average" | "poor";
type ResidenceType = "single_family_home" | "townhouse" | "condo" | "apartment" | "mobile_home" | "other";
type Education = "less_than_high_school" | "vocational" | "high_school" | "high_school_pursuing_bachelors" | "associate" | "associate_pursuing_bachelors" | "bachelors" | "bachelors_pursuing_graduate" | "masters" | "doctors" | "lawyer" | "phd";
type EmploymentStatus = "company" | "self" | "military" | "government" | "retired" | "student" | "homemaker" | "unemployed";
type Industry = "financial" | "agriculture" | "arts" | "assistants" | "automotive" | "cleaning" | "computers" | "construction" | "counseling" | "education" | "engineering" | "executives" | "health" | "law" | "operators" | "postal" | "maintenance" | "service" | "food" | "sales" | "science" | "travel";
type StudentType = "high_school_student" | "technical_vocational_student" | "freshman_undergraduate" | "sophomore_undergraduate" | "junior_undergraduate" | "senior_undergraduate" | "graduate_student" | "law_student" | "medical_student";
type MilitaryAffiliation = "active_duty" | "military_retiree" | "veteran" | "military_academy_cadet" | "national_guard" | "military_reserves";
type BusinessUseType = "clergy" | "courier_service" | "daycare" | "delivery_fast_food" | "delivery_retail_wholesale" | "delivery_route" | "delivery_us_mail" | "delivery_and_sales" | "doctor_professional" | "farm_use" | "lawyer_professional" | "real_estate" | "repair_installation" | "ridesharing" | "sales_multistate" | "sales_route" | "sales_calls" | "social_worker" | "transport_people" | "travel_to_jobsites" | "travel_to_meetings" | "visit_clients" | "visit_outside_offices";
type CurrentCompany = "21stCentury" | "AAA" | "Allstate" | "AmFam" | "AmericanFamily" | "Amica" | "AssuranceAmerica" | "BristolWest" | "Dairyland" | "DirectAuto" | "Elephant" | "Erie" | "Esurance" | "Farmers" | "Gainsco" | "Geico" | "Hartford" | "Infinity" | "Kemper" | "LibertyMutual" | "Mercury" | "MetLife" | "NationalGeneral" | "Nationwide" | "Progressive" | "Root" | "SafeAuto" | "Safeco" | "StateFarm" | "TheGeneral" | "Travelers" | "USAA" | "other";
```
