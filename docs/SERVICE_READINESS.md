# Service Readiness — SUPRA Inventory

Status date: 2026-09-16

This document records infrastructure readiness only. It does not authorize a Stable release.

## Beta — ready for application build

- Cloudflare Worker: `supra-inventory-beta`
- Custom domain: `inventory-beta.supra.cc.cd`
- Durable Object binding: `INVENTORY_CORE`
- Durable Object class: `InventoryCore`
- Storage backend: SQLite
- Schema version: `1`
- CI gate verifies TypeScript, Cloudflare token, deploy, SQLite schema health, required runtime bindings, and Google OAuth start.
- Google runtime service-account credential is stored only as a Cloudflare secret.
- Google Drive OAuth client secret and refresh token are stored only as Cloudflare secrets.
- Firebase Android and Web apps are registered for Beta.
- Google Drive API is enabled.

## Stable — configuration prepared, not provisioned/live

Stable source/config is prepared with the same `InventoryCore` + SQLite topology, but Stable remains Owner-gated. No CI job deploys Stable and the repository script intentionally blocks Stable deployment.

Before a future Stable release, the Owner must explicitly authorize deployment and the Stable Google Drive refresh token must be configured. The first authorized Stable deploy will provision its separate Durable Object namespace and SQLite storage.

## HR Sheet source

HR Sheet is intentionally **not** a fixed infrastructure resource.

The Admin/Root web UI will accept:

1. Google Sheet URL.
2. Exact tab name.

Backend validation contract is already implemented in `service/src/hr-source.ts`:

- URL must be a valid `docs.google.com/spreadsheets/d/<id>` link.
- Runtime service account must be able to read the Sheet.
- Exact tab name must exist.
- Header area must contain `MNV` and `Họ tên` (accepted normalized equivalents are handled by the validator).
- Verified source metadata is stored in `InventoryCore` SQLite, not in source code.

The public Worker does not expose an unauthenticated HR setup endpoint. The Web build must call this validator only behind Admin/Root authorization.

## SQLite schema baseline

Schema v1 prepares storage for:

- application configuration;
- HR source configuration;
- application users and roles (`PICKER`, `REPORTER`, `ADMIN`, `ROOT`);
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

## Application build contracts

Web and Android should now target only the environment-specific Worker API:

- Beta: `https://inventory-beta.supra.cc.cd`
- Stable: `https://inventory.supra.cc.cd` (do not use until Stable release authorization)

Application code must not contain Google private keys, OAuth client secrets, refresh tokens, Cloudflare tokens, root/admin passwords, or APK signing secrets.

Firebase client identifiers/configuration are environment-specific. Android package IDs remain:

- Beta: `cd.cc.supra.inventory.beta`
- Stable: `cd.cc.supra.inventory`

## Still part of application build, not infrastructure setup

- authenticated Admin/Root HR-source setup UI and API route;
- Firebase Auth/RBAC flows and Root bootstrap UX;
- WebSocket realtime protocol on `InventoryCore`;
- FCM device registration and delivery flows;
- SKU Excel import UX/API;
- report/resolve/correct/withdraw workflows;
- backup/archive execution logic;
- reporting screens and export logic;
- Android/Web source implementation and tests;
- APK signing/release material;
- Stable promotion after Owner acceptance.
