# Service Readiness — SUPRA Inventory

Status date: 2026-09-16

This document records current Beta readiness. It does not authorize or modify Stable.

## Beta — application foundation ready for Owner test

- Cloudflare Worker: `supra-inventory-beta`
- Custom domain: `inventory-beta.supra.cc.cd`
- Durable Object binding: `INVENTORY_CORE`
- Durable Object class: `InventoryCore`
- Storage backend: SQLite
- Beta schema version: `2`
- CI verifies Firebase client configuration, TypeScript, Cloudflare token, deploy, required runtime bindings, Root bootstrap secret presence, SQLite schema health, Web shell and Google OAuth start.
- Google runtime service-account credential is stored only as a Cloudflare secret.
- Google Drive OAuth client secret and refresh token are stored only as Cloudflare secrets.
- Firebase Android and Web apps are registered and their Beta client API key is wired into Web/Android builds without committing it into source.
- Web Beta builds and serves successfully from the custom domain.
- Android Beta package `cd.cc.supra.inventory.beta` builds successfully.
- CI publishes the debug APK as artifact `supra-inventory-beta-apk` with 7-day retention.
- Root bootstrap secret is configured in Cloudflare. The Root password hash is initialized lazily on first login and only PBKDF2-SHA256 derived material is stored in SQLite; Root can change the password from the authenticated UI.

## Stable — configuration prepared, not provisioned/live

Stable remains Owner-gated and has not been deployed, provisioned for traffic, or modified by the Beta test work. No CI job deploys Stable and the repository script intentionally blocks Stable deployment.

Before a future Stable release, the Owner must explicitly authorize deployment and complete the Stable-only runtime setup required at that time.

## HR Sheet source

HR source remains an Admin/Root-configured application setting rather than a hard-coded source.

The Web Admin/Root UI accepts:

1. Google Sheet URL.
2. Exact tab name.

The backend validates:

- URL is a valid `docs.google.com/spreadsheets/d/<id>` link;
- runtime service account can read the Sheet;
- exact tab name exists;
- header area contains `MNV` and `Họ tên` or accepted normalized equivalents.

Verified source metadata is stored in `InventoryCore` SQLite. There is no unauthenticated public HR setup endpoint.

For Beta test preparation, the test HR Sheet contains 500 generated employees and the Beta runtime service account has confirmed Reader access. The actual source selection is still saved only through authenticated Admin/Root setup.

## SQLite schema v2 baseline

Schema v2 currently covers:

- application configuration;
- HR source configuration;
- application users and roles (`PICKER`, `REPORTER`, `ADMIN`, `ROOT`);
- password salt/hash/change timestamp fields for server-authoritative application login;
- SKU master;
- report tickets;
- grouped processing batches;
- report/audit events;
- FCM device registrations;
- presence sessions;
- archive checkpoints;
- audit log.

Business invariants prepared at schema level include:

- only one open ticket per Picker + SKU;
- separate ticket / batch / event records;
- grouped batch indexes;
- role/status constraints;
- no location/bin inventory model.

## Authentication and client baseline

The Beta authentication path is:

`username/password → Beta Worker → server-side credential verification → Firebase custom token → Firebase client session`

This prevents relying on open Firebase email/password self-registration for application accounts. Application roles remain server-authoritative.

Implemented application foundation:

- Web login shell;
- Android Beta shell;
- Firebase client initialization;
- custom-token authentication foundation;
- Root role and bootstrap secret;
- authenticated password-change flow;
- Admin/Root HR-source setup API + Web UI;
- Web live-shell smoke check;
- Android debug APK build + artifact pipeline.

## Still pending application implementation

These are the next application nodes, not missing service provisioning:

- WebSocket realtime protocol and presence handling;
- FCM device registration and background delivery flows;
- SKU Excel import UX/API;
- report / resolve / correct / withdraw workflows;
- backup/archive execution logic;
- reporting screens and export logic;
- load/resilience tests;
- APK production signing/release material;
- Stable promotion only after explicit Owner acceptance.
