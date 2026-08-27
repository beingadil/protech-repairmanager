## 2025-05-18 - Collapsed Sidebar Navigation Accessibility
**Learning:** Collapsible sidebars that hide label text when collapsed leave screen reader users and mouse users with icon-only links lacking `aria-label` or `title` tooltips, creating a poor keyboard/screen reader experience and visual ambiguity.
**Action:** Always provide explicit `aria-label` and conditional `title` attributes on navigation links so that collapsed icon-only states remain accessible to assistive technologies and display contextual tooltips on hover.
