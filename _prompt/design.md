# MTL Link Design System

Based on the Telegram iOS Design System, customized for MTL Link.
Design source: claude.ai/design (Telegram Design System Community Figma file).

---

## Color Tokens

### Sidebar (always dark, regardless of theme)
| Token | Light | Dark |
|---|---|---|
| `--side-bg` | `#1A2238` | `#060B17` |
| `--side-deep` | `#131A2C` | `#03060F` |
| `--side-text` | `#F1F5F9` | `#F1F5F9` |
| `--side-mute` | `#94A3B8` | `#94A3B8` |
| `--side-row` | `#232E4A` | `#0F172A` |
| `--side-active` | `#2D3A5F` | `#1E293B` |
| `--side-line` | `#2A3656` | `#111827` |

### Chat Surface
| Token | Light | Dark |
|---|---|---|
| `--chat-bg` | `#F0F2F7` | `#0E1626` |
| `--bubble-in` | `#FFFFFF` | `#1F2937` |
| `--bubble-out` | `#DBEAFE` | `#1E3A5F` |
| `--bubble-out-bd` | `#BFDBFE` | `#2C4F86` |

### App / Global
| Token | Light | Dark |
|---|---|---|
| `--ink` | `#0F172A` | `#F1F5F9` |
| `--ink-2` | `#334155` | `#CBD5E1` |
| `--ink-3` | `#64748B` | `#94A3B8` |
| `--ink-4` | `#94A3B8` | `#64748B` |
| `--line` | `#E2E8F0` | `#1F2937` |
| `--bg` | `#F8FAFC` | `#0B1220` |
| `--card` | `#FFFFFF` | `#111827` |
| `--blue` | `#2563EB` | `#60A5FA` |
| `--blue-soft` | `#EFF6FF` | `#1E2A44` |

### Brand
- Primary blue: `#2563EB`
- Brand mark red: `#EF3F1A` (gradient to `#B83113`)
- MTL Navy: `#1A3A6B`
- MTL Cyan: `#29AEE8`

---

## Typography

| Role | Font | Weight | Size |
|---|---|---|---|
| UI / Body | Noto Sans KR | 400, 500, 600, 700 | 12–16px |
| Monospace | JetBrains Mono | 400, 500, 600 | 10–13px |

Type scale (iOS-spec):
- Caption: 11px / 13px line
- Body SM: 13px / 15px line
- Body: 14px / 1.5 line
- Subtitle: 14px / 16px line
- Headline: 15px / 18px line
- Title: 17px / 20px line
- Title2: 20px / 23px line

---

## Layout

- App shell: `320px sidebar` + `flex-1 chat`
- Sidebar: always dark navy, fixed 320px
- Chat header: 56px (white/dark-card)
- Composer: 60px (white/dark-card)
- Message padding: 24px horizontal, 12px vertical

---

## Components

### Message Bubbles
- Own (outgoing): `#DBEAFE` bg, `#BFDBFE` border (light) / `#1E3A5F` bg (dark)
- Other (incoming): White bg, `#E2E8F0` border (light) / `#1F2937` bg (dark)
- Border radius: 14px with one corner cut (4px) toward the tail
- Padding: 10px 14px
- Shadow: `0 1px 2px rgba(15,23,42,0.04)`

### Chat Header
- Background: `--card` (white / dark-card)
- Border bottom: `--line`
- Shadow: `0 1px 2px rgba(0,0,0,0.07)` (light only)

### Composer
- Background: `--card`
- Border top: `--line`
- Input bg: `--bg`
- Border radius: 14px
- Send button: `--blue` fill, white icon

### Sidebar Rows
- Normal: transparent background
- Hover: `--side-row`
- Active: `--side-active`
- Border bottom: `--side-line`

### Avatars
- Always 50% (perfect circles)
- Group: gradient `#6366F1 → #8B5CF6`
- Individual: deterministic color from name

### Badges / Status
- Unread count: `--blue` fill, white text
- Online dot: `#10B981` (green)

---

## Animations
- New message slide-in: `translateY(8px) → 0`, 320ms ease spring
- Modal in: `scale(0.98) → 1` + fade, 220ms
- Bubble hover: `translateY(-1px)`, 120ms
- Typing indicator: bounce dots

---

## Tailwind Config Mapping

```js
sidebar: {
  DEFAULT: '#1A2238',  // always dark
  deep: '#131A2C',
  text: '#F1F5F9',
  muted: '#94A3B8',
  row: '#232E4A',
  active: '#2D3A5F',
  line: '#2A3656',
},
accent: {
  DEFAULT: '#2563EB',
  hover: '#1D4ED8',
},
bubble: {
  own: '#1E3A5F',    // dark mode
  other: '#1F2937',  // dark mode
},
surface: {
  DEFAULT: '#1A2238',  // dark sidebar
  chat: '#0E1626',     // dark chat bg
  panel: '#111827',    // dark panels
  hover: '#1E293B',    // dark hover
  input: '#1E293B',    // dark input
},
```
