# UI_DESIGN_SYSTEM — Concept 3

Status: **CANONICAL OWNER-SELECTED DESIGN DIRECTION**.

## Visual language

- Light background.
- Green is the primary action/positive accent.
- Orange is reserved for attention/warning states.
- Red is reserved for error/destructive states.
- Clean borders, restrained shadows, low visual clutter.
- Clear typography hierarchy and consistent status chips/cards.
- Web and Android share component language but do not copy desktop layout onto PDA.

## Web information architecture

Role-aware navigation:
- Tổng quan (Admin/Root)
- Hàng chờ (Reporter/Admin/Root)
- Báo cáo (Admin/Root)
- Master SKU (Admin/Root)
- Nhân sự (Admin/Root according to hierarchy)
- Tài khoản

Dashboard is an overview; detailed data lives in Reporting. Tables/actions must remain usable at narrow widths.

## Android/PDA information architecture

Optimize for fast warehouse operation:
- large touch targets;
- minimal steps;
- strong status hierarchy;
- Picker flow prioritizes SKU search/report/current status;
- Reporter/Admin/Root operational mode prioritizes queue → batch detail → resolve/correct.

Deep desktop administration does not need to be duplicated onto PDA unless Owner approves it.

## Semantic states

- Success: green.
- Warning/attention/in-progress: orange/neutral as context requires.
- Error/destructive: red.
- Status must not rely on color alone; include text/icon/shape semantics.

## Scope guard

Concept artwork is visual direction, not business authority. Never import mock fields such as stock quantity, location/bin, or unapproved capabilities simply because they appeared in a generated concept image.
