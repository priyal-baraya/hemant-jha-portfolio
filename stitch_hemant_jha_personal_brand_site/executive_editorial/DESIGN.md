---
name: Executive Editorial
colors:
  surface: '#f8f9fa'
  surface-dim: '#d9dadb'
  surface-bright: '#f8f9fa'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f4f5'
  surface-container: '#edeeef'
  surface-container-high: '#e7e8e9'
  surface-container-highest: '#e1e3e4'
  on-surface: '#191c1d'
  on-surface-variant: '#45474d'
  inverse-surface: '#2e3132'
  inverse-on-surface: '#f0f1f2'
  outline: '#75777d'
  outline-variant: '#c5c6cd'
  surface-tint: '#545e76'
  primary: '#051125'
  on-primary: '#ffffff'
  primary-container: '#1b263b'
  on-primary-container: '#828da7'
  inverse-primary: '#bbc6e2'
  secondary: '#755a25'
  on-secondary: '#ffffff'
  secondary-container: '#fdd896'
  on-secondary-container: '#775d27'
  tertiary: '#001224'
  on-tertiary: '#ffffff'
  tertiary-container: '#0a2742'
  on-tertiary-container: '#768fae'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d7e2ff'
  primary-fixed-dim: '#bbc6e2'
  on-primary-fixed: '#101b30'
  on-primary-fixed-variant: '#3c475d'
  secondary-fixed: '#ffdea5'
  secondary-fixed-dim: '#e5c282'
  on-secondary-fixed: '#261900'
  on-secondary-fixed-variant: '#5b430f'
  tertiary-fixed: '#d1e4ff'
  tertiary-fixed-dim: '#afc9ea'
  on-tertiary-fixed: '#001d36'
  on-tertiary-fixed-variant: '#2f4865'
  background: '#f8f9fa'
  on-background: '#191c1d'
  surface-variant: '#e1e3e4'
typography:
  display-lg:
    fontFamily: Playfair Display
    fontSize: 64px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Playfair Display
    fontSize: 40px
    fontWeight: '700'
    lineHeight: '1.2'
  headline-lg:
    fontFamily: Playfair Display
    fontSize: 48px
    fontWeight: '600'
    lineHeight: '1.2'
  headline-lg-mobile:
    fontFamily: Playfair Display
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.3'
  headline-md:
    fontFamily: Playfair Display
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '400'
    lineHeight: '1.7'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: 0.05em
  quote:
    fontFamily: Playfair Display
    fontSize: 28px
    fontWeight: '400'
    lineHeight: '1.5'
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 8px
  container-max: 1120px
  gutter: 32px
  margin-desktop: 64px
  margin-mobile: 20px
  section-gap: 120px
---

## Brand & Style
The design system is engineered for Hemant Jha’s personal brand, positioning him as a definitive authority and thought leader. The aesthetic centers on **Premium Minimalism** with an **Editorial** focus, evoking the prestige of high-end intellectual journals. 

The UI prioritizes clarity and whitespace to ensure content—specifically long-form writing and strategic insights—remains the focal point. The emotional response is one of calm, focused trust and sophisticated professionalism. By utilizing generous negative space and a disciplined color palette, the system eliminates cognitive load, allowing the author's voice to resonate without visual interference.

## Colors
The palette is rooted in a deep, authoritative **Deep Navy (#1B263B)** used for primary brand elements and primary headings. The background relies on a combination of pure white and a subtle **Off-White (#F8F9FA)** to differentiate content sections without introducing harsh lines.

A sophisticated **Muted Gold (#C5A467)** serves as the sole accent color, reserved for high-value interactions, progress indicators, and subtle decorative flourishes. This creates a high-contrast, premium environment that feels both traditional and modern.

## Typography
The typography system creates a rhythmic contrast between the intellectual character of **Playfair Display** and the functional precision of **Inter**.

Headlines use Playfair Display with tight letter-spacing to create a "locked-in" editorial look. Body text is set in Inter with increased line height (1.7) to ensure maximum readability for long-form essays. Labels and small metadata should utilize Inter in semi-bold with all-caps styling and slight tracking to differentiate them from narrative text.

## Layout & Spacing
This design system employs a **Fixed Grid** philosophy for desktop to maintain the "columnar" feel of a physical book or high-end magazine. Content is centered within a 1120px container to prevent eye-strain on ultra-wide monitors.

Spacing is governed by an 8px linear scale, but emphasizes "Section Gaps" of 120px to create distinct psychological breaks between different content types (e.g., from an article body to a newsletter signup). On mobile, margins reduce to 20px, and vertical spacing compresses to 64px to maintain momentum.

## Elevation & Depth
Depth is conveyed through **Tonal Layers** rather than heavy shadows. The base background is white, while interactive cards and secondary sections sit on "Level 1" surfaces of Off-White (#F8F9FA). 

Where shadows are necessary for functional clarity (like the sticky navigation), use an "Ambient Shadow": a very soft, multi-layered blur with only 4% opacity of the Primary Navy color. This ensures elements feel like they are floating slightly above the page without breaking the flat, editorial aesthetic.

## Shapes
The shape language is **Soft (0.25rem)**. This subtle rounding removes the aggressive "sharpness" of digital boxes while maintaining a professional, structured architectural feel. 

Buttons and input fields follow this 4px (0.25rem) rule. The only exception is the "Chat Bubble" and "Newsletter Pill," which utilize a fully rounded (3rem) radius to feel more approachable and distinct from the structural content cards.

## Components
- **Buttons:** Primary buttons are solid Deep Navy with white text. Secondary buttons use the Muted Gold as a subtle underline or a "ghost" style with a 1px border. No heavy gradients.
- **Cards:** Minimalist execution. No borders; use the Off-White background color to define the container. Provide generous 40px internal padding to the content.
- **Navigation:** A sticky top-bar with a blur effect (`backdrop-filter: blur(10px)`) and a hairline bottom border in #E5E5E5.
- **Input Fields:** Search and Newsletter inputs should be "Sleek": a bottom-border only (1px Deep Navy) or a very light gray fill with no border. Focus states transition the bottom border to Muted Gold.
- **Chat Bubbles:** Fully rounded (pill-shaped) with a primary color background for the author and a neutral light-gray background for the user, ensuring a distinct visual dialogue.
- **Lists:** Use custom Muted Gold markers (small squares or elegant serifs) instead of standard bullets.