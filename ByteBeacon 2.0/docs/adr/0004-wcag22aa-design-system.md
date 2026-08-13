# ADR 0004: Design System Tokens & WCAG 2.2 Level AA Accessibility

## Status
`ACCEPTED` (BYTEBEACON DECISION / CONFIRMED EXTERNAL REQUIREMENT - WCAG 2.2)

## Context
ByteBeacon's UI must project a premium, restrained aesthetic (Obsidian base, selective Cyan/Lime accents) while adhering to strict international web accessibility standards.

## Decision
- Build custom UI primitives with Vanilla CSS Modules and CSS Custom Properties.
- Enforce WCAG 2.2 Level AA compliance: minimum 4.5:1 text contrast, visible focus rings (`2px solid var(--color-cyan)`), semantic HTML elements, keyboard navigation, and reduced-motion media queries.
- Restrict glassmorphism strictly to floating navigation, overlays, and dialogs.

## Consequences
- Eliminates bulky uncurated UI framework bloat.
- Guarantees seamless accessibility and fluid responsiveness across desktop and mobile.
