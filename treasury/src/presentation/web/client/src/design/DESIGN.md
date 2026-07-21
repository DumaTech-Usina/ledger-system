---
name: Liquid Glass & Solid
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#424656'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#727687'
  outline-variant: '#c2c6d8'
  surface-tint: '#0054d6'
  primary: '#0050cb'
  on-primary: '#ffffff'
  primary-container: '#0066ff'
  on-primary-container: '#f8f7ff'
  inverse-primary: '#b3c5ff'
  secondary: '#4648d4'
  on-secondary: '#ffffff'
  secondary-container: '#6063ee'
  on-secondary-container: '#fffbff'
  tertiary: '#006645'
  on-tertiary: '#ffffff'
  tertiary-container: '#008259'
  on-tertiary-container: '#e1ffec'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae1ff'
  primary-fixed-dim: '#b3c5ff'
  on-primary-fixed: '#001849'
  on-primary-fixed-variant: '#003fa4'
  secondary-fixed: '#e1e0ff'
  secondary-fixed-dim: '#c0c1ff'
  on-secondary-fixed: '#07006c'
  on-secondary-fixed-variant: '#2f2ebe'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 48px
    fontWeight: '800'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Manrope
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Manrope
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  label-md:
    fontFamily: Manrope
    fontSize: 14px
    fontWeight: '600'
    lineHeight: '1.4'
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Manrope
    fontSize: 12px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: 0.03em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 8px
  container-max: 1280px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 40px
  stack-xs: 4px
  stack-sm: 12px
  stack-md: 24px
  stack-lg: 48px
---

## Brand & Style
The design system is centered on the "Liquid Glass" concept, blending the ethereal qualities of glassmorphism with the structural integrity of solid, modern UI. The brand personality is approachable, professional, and highly adaptable. It aims to evoke a sense of clarity and depth, making the user feel like they are interacting with a fluid, tactile surface. 

The aesthetic style is a hybrid of **Glassmorphism** and **Minimalism**. It uses light, translucent layers to create a sense of hierarchy and spatial awareness, while offering "Solid Mode" configurations for high-performance or high-accessibility contexts. The interface prioritizes "soft-tech" visuals—friendly but sophisticated.

## Colors
The default palette is a professional "Deep Sea & Slate" scheme. The primary color is a vibrant blue that signals action and trust. Because the design system is themeable, these colors act as the "base" tokens. 

The system utilizes a complex neutral scale designed to work behind glass layers. Grays are slightly tinted with the primary hue to maintain a cohesive atmosphere. Surfaces are defined by three states:
1. **Translucent:** 60-80% opacity with a 20px background blur.
2. **Frosted:** 40% opacity with a 40px background blur for deep overlays.
3. **Solid:** 100% opacity for high-contrast visibility.

## Typography
This design system uses a dual-font strategy to balance character with legibility. **Plus Jakarta Sans** is used for headlines to provide a friendly, optimistic, and slightly rounded geometric appearance that complements the "Liquid" theme. **Manrope** is utilized for body text and labels to ensure maximum readability and a professional, refined tone in functional areas.

Hierarchy is established through significant weight shifts. Headlines use Bold or ExtraBold weights to anchor the page, while body text remains in Regular weight to allow the "glass" backgrounds to remain the primary visual interest.

## Layout & Spacing
The layout philosophy follows a **Fluid Grid** model with generous white space to allow the glass effects to "breathe." A 12-column grid is standard for desktop, but elements frequently utilize "floating" containers that do not strictly adhere to column edges to reinforce the liquid concept.

Spacing is based on an 8px rhythmic scale. Inner padding within glass containers should be larger than standard solid designs (minimum 24px) to prevent content from feeling crowded against the soft, rounded edges.

## Elevation & Depth
Depth is created through "Environmental Stacking" rather than traditional heavy shadows.
- **Level 1 (Base):** Solid neutral background.
- **Level 2 (Cards/Containers):** Glassmorphism with a 1px inner white border (20% opacity) to simulate the edge of a glass pane.
- **Level 3 (Modals/Popovers):** High blur (40px+) with a very soft, diffused ambient shadow (Color: Primary Tint, Opacity: 10%, Blur: 30px).

In "Solid Mode," these levels are replaced by tonal steps (e.g., Slate 50 to Slate 100) and 1px solid borders.

## Shapes
The shape language is extremely soft. "Rounded" (Level 2) is the minimum standard, but components often scale up to "Pill-shaped" for interactive elements like buttons and chips. The goal is to eliminate all sharp points to maintain the "Liquid" metaphor. Containers use 1.5rem (24px) corner radii as a default to create a friendly, organic frame for content.

## Components
- **Buttons:** Primary buttons are pill-shaped with a subtle gradient. Secondary buttons use the "Glass" effect with a semi-transparent fill and high-contrast text.
- **Cards:** Feature a 1px "Specular Highlight" border on the top and left edges to mimic light hitting glass.
- **Inputs:** Soft, recessed wells with high-radius corners. On focus, the border glows with the primary color using a soft outer glow (bloom effect).
- **Chips:** Fully pill-shaped. Used for tags and filters, featuring a background blur even at small scales.
- **Lists:** Items are separated by generous spacing rather than lines. Hover states trigger a "Liquid" expansion where the background glass becomes slightly more opaque.
- **Glass Toggle:** A unique component that allows users to switch the entire interface between "Glass" and "Solid" modes instantly.