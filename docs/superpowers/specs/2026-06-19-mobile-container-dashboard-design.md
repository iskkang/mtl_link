# Mobile ContainerDashboard — Design

Date: 2026-06-19
Status: Approved

## Problem

Entering the FESCO tracking section lands on `ContainerDashboard` (the "dashboard"
sub-view), which has **no mobile layout** — no `useIsMobile`, no width media queries.
Its desktop multi-column layout (live map + fixed 320px detail card; 240px donut + two
side-by-side list panels) is crammed into mobile width, so the page is unusable on phones.
The sibling `FescoTrackingPage` ("Bookings") already has a dedicated `MobileFescoView`,
but that is only reachable via "View all", so the first impression on mobile is the broken
dashboard.

See [FescoTrackingShell.tsx:11-17](../../../src/components/tracking/FescoTrackingShell.tsx)
— default `activeView='dashboard'`.

## Goal

Add a mobile-optimized render branch to `ContainerDashboard`, mirroring the existing
`FescoTrackingPage → MobileFescoView` pattern. Desktop render and all CSS untouched —
additive only.

## Approach

`ContainerDashboard` already computes all data/state/handlers (stats, actionNeeded,
recentOrders, countryCounts, mapPoints, containerDetails, fetch/refresh). The main
component continues to compute these, then branches at render time:

```tsx
const isMobile = useIsMobile()
if (isMobile) return <MobileContainerDashboard {...props} />
// existing desktop render unchanged
```

`MobileContainerDashboard` is a new component in the same file, receiving data + handlers
as props (same convention as `MobileFescoView`). Module-level helpers (`daysSince`,
`fmtRelTime`, `hasRealLocation`, `SegmentLine`, `SignalDot`, `DonutChart`, `CountryChip`,
`StatPill`) are reused directly.

## Mobile layout (vertical scroll, `paddingBottom: 64` for bottom nav)

1. **Header** — "FESCO 추적" title + compact refresh button (spinner when refreshing).
2. **Stat pills row** — `N 조치필요` / `N 주의` / `N 정상` (red/yellow/green), hidden when zero.
3. **Summary card** — `DonutChart` + legend rows (정상/주의/조치필요), reusing existing components.
4. **Destination filter chips** — horizontal scroll row of `CountryChip` (RU/UZ/BY/KZ) + clear.
5. **Tabbed lists** — tab bar `[조치필요 (badge)] [최근주문]`; list area below.
   - 조치필요: rows = SignalDot + container # (links to FESCO) + days-overdue + `SegmentLine`.
     Reuses the desktop action-row markup. Internal "show all / less" toggle.
   - 최근주문: rows = SignalDot + order # + route + container count. Header has
     **"전체 보기 →"** invoking `onViewBookings` (→ Bookings / MobileFescoView).
6. **Map (collapsed, bottom)** — fixed height ~240px `ContainerMap` for overview only.
   Marker taps use ContainerMap's own popup. The 320px `DetailCard` and the
   cluster-selection → detail flow are **not** rendered on mobile; selection handlers
   are passed as harmless no-ops (or retained state with no visible panel).

## Scope decisions (YAGNI)

- `CleanupBanner` (stale cleanup) is **excluded** from mobile v1 — desktop ops feature.
- Map cluster-selection → `DetailCard` flow excluded on mobile.
- Loading shows simple skeletons; error shows a banner with Retry (`fetchData`).

## States

- **loading**: skeleton blocks (summary + list + map placeholders).
- **error**: red banner + Retry button.
- **empty**: 조치필요 tab → "조치 필요 항목 없음"; 최근주문 → empty hint; map renders with 0 points.

## Props passed to `MobileContainerDashboard`

`loading, error, refreshing, lastFetch, fetchData, stats, totalActive, actionNeeded,
recentOrders, countryCounts, selectedCountries, toggleCountry, resetFilter, mapPoints,
allContainerNumbers, containerDetails, onViewBookings`. (i18n `t` obtained internally via
`useTranslation`.)

## Guardrails

`ContainerDashboard.tsx` is **not** in the CLAUDE.md FESCO-protected file list. This change
touches no sync/auth logic and leaves the desktop render path and `index.css` unchanged.

## Verification

- `npx tsc --noEmit` passes.
- `npm run build` (or lint) passes.
- Manual: narrow viewport (≤768px) shows the mobile dashboard; desktop ≥769px unchanged.
