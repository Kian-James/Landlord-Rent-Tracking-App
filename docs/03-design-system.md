# Design system

The rules the interface follows, taken from the code. The swatches, type samples and component states still need to be added as images in `assets/`, because part of this document is visual.

## Colour

Defined once in `client/tailwind.config.js` and used as Tailwind classes.

| Name in code | Hex | Used for |
| --- | --- | --- |
| `canvas` | `#F5F6F3` | page background |
| `surface` | `#FFFFFF` | cards |
| `ink` | `#0F1712` | text, primary buttons |
| `brand` / `brand-soft` | `#14532D` / `#E7F0EA` | links, focus outline, accents |
| `line` | `#E7E9E4` | borders and dividers |
| `status-paid` / `status-paidSoft` | `#1E8E5A` / `#E4F5EC` | paid badge |
| `status-pending` / `status-pendingSoft` | `#B8860B` / `#FBF1DD` | pending badge |
| `status-overdue` / `status-overdueSoft` | `#C23B3B` / `#FBE9E9` | overdue badge, error text |
| `status-upcoming` / `status-upcomingSoft` | `#2563A8` / `#E7F0FA` | upcoming badge |
| `status-verify` | `#6B4FA0` | avatar text accent |
| `avatar-a` to `avatar-e` | `#DCEFE3`, `#E4E9F8`, `#F6E7D8`, `#F1E1EE`, `#DEEAF1` | avatar circle backgrounds |

Secondary text is `ink` at reduced opacity: `text-ink/40` to `text-ink/70`.

### Contrast (WCAG minimum 4.5 to 1 for normal text)

| Pair | Ratio | Result |
| --- | --- | --- |
| `ink` on `canvas` | 16.8 | pass |
| `ink` on `surface` | 18.2 | pass |
| white on `brand` | 9.1 | pass |
| `brand` on white | 9.1 | pass |
| `status-upcoming` on its soft background | 5.3 | pass |
| `status-overdue` on its soft background | 4.5 | pass, at the limit |
| `status-paid` on its soft background | 3.7 | **fails** |
| `status-pending` on its soft background | 2.9 | **fails** |
| `text-ink/70` on `surface` | 6.7 | pass |
| `text-ink/60` on `surface` | 4.8 | pass |
| `text-ink/50` on `surface` | 3.5 | **fails** |
| `text-ink/45` on `surface` | 3.0 | **fails** |
| `text-ink/40` on `surface` | 2.6 | **fails** |

Known issue: the paid and pending badges and the lightest secondary text fall below 4.5 to 1. Darker text colours for those badges and nothing lighter than `text-ink/60` would fix it.

## Type

The family is `Inter`, falling back to `system-ui`. Inter is declared in the config but not loaded from a font service, so most visitors see their system font.

| Size | Used for |
| --- | --- |
| `text-3xl` | page titles |
| `text-xl` and `text-2xl` | section and card headings |
| `text-base` | property and card names |
| `text-sm` | body text, form fields, buttons |
| `text-xs` | labels, secondary lines |
| `text-[11px]`, `text-[10px]`, `text-[9px]` | hints and badges |

## Spacing

Tailwind's default 4px scale. Cards use `p-4` to `p-6`, groups of fields use `gap-2` to `gap-4`, and sections are separated with `space-y-4` or `space-y-6`. Cards have the `rounded-bento` radius and the `shadow-bento` shadow from the config.

## Components

| Component | File | Notes |
| --- | --- | --- |
| Card | `BentoCard.jsx` | the container for almost everything |
| Status badge | `StatusBadge.jsx` | one colour pair per rent status |
| Skeleton | `Skeleton.jsx` | loading placeholders shaped like the content |
| Filter dropdown | `FilterDropdown.jsx` | property filter on the dashboard and bills |
| Modal | `Modal.jsx` | the "Mark Bill as Paid" dialog |
| Avatar | `Avatar.jsx` | initials in a coloured circle |
| Notification bell | `NotificationBell.jsx` | unread count and list |
| Layout, user menu | `Layout.jsx`, `UserMenu.jsx` | top bar on desktop, bottom bar on phones |

Every interactive element shows a 2px `brand` outline on keyboard focus, set once in `client/src/index.css` with `:focus-visible`. Animations and transitions are shortened for visitors who ask for reduced motion.

## States

- **Loading:** skeleton blocks in the shape of the content
- **Empty:** a centred card with a heading and one sentence, such as "No properties yet"
- **Error:** red text under the form or list header, using the API's own message
- **Data:** the normal view

## In code

Colours, fonts, radius and shadow live in `client/tailwind.config.js`. Global rules (focus outline, reduced motion) live in `client/src/index.css`. There is no separate component library.
