# Design Language & Visual System

## Core Aesthetic

- **Minimal, cyberpunk-inspired, high-tech**: The UI draws from references like Wipeout Pure, Mirror's Edge, and TRON Legacy, but always leans toward minimalism and clarity over visual noise.
- **B2B, developer analytics focus**: The look is clean, professional, and high-contrast, designed for engineering managers and technical users.

## Layout & Spacing

- **Dot grid, pixel grid**: All layout, spacing, and sizing use PX units in multiples of 4px (e.g., 4px, 8px, 12px, 16px, etc.).
- **No responsive breakpoints**: The layout is fixed and non-responsive unless functionally required.
- **No flexbox/grid tricks**: Only use layout primitives as needed for function.

## Color System

- **Greyscale base**: All UI elements outside of data visualizations use only greyscale (no colors, no custom fonts, no embellishments).
- **Two accent colors only**:
  - **Good/Attention**: A color close to cyan/teal (hue ~180º), used for positive highlights, primary actions, and to draw user attention.
  - **Bad/Error**: A color close to red (hue ~0º), used sparingly for errors, warnings, or critical states.
- **Shades**: Use opacity or calculated blends to create subtle shades of the two accent colors, but do not use actual transparency that would reduce readability.
- **High contrast**: Always ensure strong separation between background and foreground/subject elements for maximum readability.

## Visual Interest

- **All visual interest is in the data visualizations**: Charts and analytics are where color, animation, and "flash" are allowed.
- **No visual embellishments in layout/UI**: No gradients, shadows, or decorative elements outside of the chart area.

## Typography

- **System font stack**: No custom fonts.
- **No font color except greyscale or accent color for emphasis**.

## Charting

- **SVG or Canvas only**: All charts are rendered in SVG or Canvas, with no frameworks.
- **Minimal dependencies**: If a library is needed, use only minimal, framework-free options.
- **All chart sizing, padding, and positioning use PX units in multiples of 4px**.

## Dark Mode

- **Default to dark mode**: Backgrounds are dark, with high-contrast foreground elements and accent colors that "pop" against the dark base.

## References

- Wipeout Pure UI
- Mirror's Edge & Mirror's Edge Catalyst
- TRON Legacy

---

_Last updated: 2025-04-12_
