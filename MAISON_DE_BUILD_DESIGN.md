## MAISON_DE_BUILD_DESIGN.md — Master Design System & Build Specification
# This file is the single source of truth. Every design and code decision must reference this document.

---

## Brand Identity

**Brand Name:** Maison de Build ("House of Build")
**Owner:** Rushil Johnson — competitive bodybuilder, 15+ years experience
**Positioning:** An exclusive, invite-only luxury fitness maison. Not a gym — a house of physical craft.
**Aesthetic North Star:** Hermès. The Row. Celine (Phoebe Philo era). Luxury fashion house, not fitness brand.
**Tone:** Quiet, editorial confidence. Refined. Restrained. The website whispers luxury — it never shouts.
**Tagline options (pick best fit per section):** "The art of building" / "Craft over noise" / "By invitation"

---

## Hard Rules — NEVER Break These

1. **ZERO photos of people.** No stock photos of humans. No silhouettes. No illustrated people. Non-negotiable client instruction.
2. **ZERO generic stock photography.** Every image is AI-generated (Nano Banana Pro), a 3D render, or a refined atmospheric visual.
3. **Restrained color palette.** Cream/white + charcoal + one accent orange. Like Hermès — the orange is rare and precious.
4. **Not text-heavy.** Each section: maximum 2-3 short lines of body copy. Let typography, whitespace, and motion carry the weight.
5. **Editorial whitespace.** Generous breathing room everywhere. Whitespace IS the luxury. Never crowd elements.
6. **No gym clichés.** No "TRANSFORM YOUR BODY." No fire emojis. No aggressive sales language. No urgency banners. No countdown timers.
7. **No horizontal scrolling as a primary or full-page navigation pattern.** A single pinned horizontal-pan section is permitted where it serves a specific interaction moment (currently: The Disciplines), provided it degrades gracefully to the stacked layout on touch and narrow viewports, honours `prefers-reduced-motion`, and does not hijack native scroll. One such section per page, maximum.
8. **Smooth, refined scroll.** Use Lenis. Every transition is graceful and slow, like turning pages of a luxury magazine.

---

## Color System

```
--bg-primary: #FAF8F4        /* Warm cream white — main background. Soft, editorial, NOT stark white */
--bg-secondary: #FFFFFF      /* Pure white — for cards and elevated surfaces */
--bg-tertiary: #F0EDE6       /* Slightly deeper cream — subtle section differentiation */
--bg-dark: #1A1613           /* Warm near-black — for ONE dramatic dark section (contrast moment) */

--accent: #F2662A            /* THE Maison de Build orange. Hermès-like. Use with EXTREME restraint */
--accent-hover: #D9541F      /* Darker orange — for button hover states */
--accent-soft: #F2662A15     /* Orange at ~8% opacity — for the faintest tints, hover backgrounds */

--text-primary: #1A1613      /* Warm charcoal — headlines, primary text */
--text-secondary: #5C564E    /* Warm gray — body copy, descriptions */
--text-muted: #A39E95        /* Light warm gray — labels, metadata, captions */
--text-on-dark: #FAF8F4      /* Cream — text on the dark section */

--border-subtle: #E5E0D8     /* Barely visible warm border — dividers, card outlines */
--border-accent: #F2662A40   /* Orange-tinted border — for featured/active elements */
```

### Accent Color Rules (CRITICAL):
The orange (#F2662A) appears in a MAXIMUM of 5 places on the entire page:
1. The logo/wordmark in the nav
2. A single accent detail in the hero (a thin line, or one word emphasis)
3. Primary CTA button fills (max 2 buttons on entire page)
4. One accent line or detail in the stats/numbers section
5. The contact form submit button
Everything else is cream, white, charcoal, or gray. The orange is powerful BECAUSE it is rare. This is the Hermès principle.

---

## Typography

```
--font-display: 'Cormorant Garamond', serif    /* Headlines — high-contrast elegant serif, matches logo */
--font-body: 'Inter', sans-serif                /* Body text — clean, light, highly legible */
```

### Type Scale:
```
Hero headline:        clamp(3rem, 7vw, 6.5rem)    /* Large, elegant serif */
Section headline:     clamp(2rem, 4vw, 3.5rem)     /* Refined serif */
Sub-headline:         1.25rem                       /* 20px, light weight */
Body:                 1.0625rem                     /* 17px, comfortable reading */
Caption/Label:        0.75rem                       /* 12px, uppercase, letter-spacing 0.2em */
Stat number:          clamp(3rem, 6vw, 5.5rem)      /* Large elegant serif numbers */
```

### Typography Rules:
- Headlines: Cormorant Garamond, font-weight 400-500 (serif looks elegant at LIGHT weights, not bold), letter-spacing 0.01em
- The brand wordmark "MAISON de BUILD": uppercase serif with "de" in italic, wide letter-spacing (0.15em)
- Body: Inter, font-weight 300-400, line-height 1.7 (generous for editorial feel)
- Labels/Captions: uppercase, Inter, letter-spacing 0.2em, text-muted color
- Headings use WIDE letter-spacing for couture elegance
- NEVER use heavy bold weights on the serif — luxury serifs breathe at light weights
- NEVER center-align long body text. Hero and section intros can center; body copy left-aligns.

---

## Spacing & Layout

```
--section-padding: clamp(100px, 18vh, 200px)    /* GENEROUS vertical padding — whitespace is luxury */
--content-max-width: 1240px                      /* Max content width */
--content-padding: clamp(24px, 6vw, 100px)      /* Generous horizontal padding */
--card-gap: 32px                                 /* Gap between cards */
--card-radius: 4px                               /* SUBTLE radius — luxury is sharp, not rounded */
--card-padding: 40px                             /* Generous internal card padding */
```

### Layout Rules:
- Generous whitespace is the #1 priority. When in doubt, add more space.
- Full-bleed sections for hero, the dark contrast moment, and contact
- Contained sections (max-width 1240px, centered) for services, stats, membership
- Single-column dominant. Multi-column only for service cards and membership tiers.
- Asymmetry is elegant — off-center compositions feel editorial, not templated
- On mobile (< 768px): everything stacks, whitespace remains generous

---

## Animation & Motion System

### Library: GSAP + ScrollTrigger + Lenis

### Animation Rules:
1. **Scroll-triggered, graceful.** Elements fade and rise gently as they enter the viewport.
2. **Slow and refined.** Duration 1.0s - 1.4s. Luxury moves slowly and deliberately.
3. **Direction: subtle rise.** Elements enter from below (translateY: 30px → 0) with fade (opacity: 0 → 1).
4. **Easing: power2.out** for entries, **power1.inOut** for scrub-linked. Soft, never snappy.
5. **Stagger: 0.12s - 0.18s** when revealing groups.
6. **Parallax: whisper-subtle.** Background elements at 0.2-0.3x scroll speed.
7. **No bounce, no elastic, no spring.** This is haute couture, not playful.
8. **Text reveals:** Serif headlines can fade in word by word, or with an elegant mask-reveal (text slides up from behind an invisible line).
9. **Respect prefers-reduced-motion.**

### Specific Sequences:
- **Hero entrance:** The wordmark and headline fade in gracefully over 1.6s on load. The ONLY load animation.
- **Text reveals:** Serif lines mask-reveal (slide up from behind a line) as they enter — very editorial, very luxury.
- **Stat counters:** Numbers count up elegantly from 0 over 1.8s when scrolled into view.
- **Card reveals:** Service and membership cards fade + rise with 0.15s stagger.
- **Contact form:** Fades in gently when scrolled to.

---

## 3D Element — Three.js Configuration

The dumbbell now sits in a LIGHT, airy, editorial setting — like a sculptural object on display in a Hermès window, not a dark gym.

### Scene setup:
```javascript
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.3
// Background stays transparent — the cream page shows through

// Lighting — bright, soft, gallery-like
ambientLight: 0xffffff, intensity 0.7                          // Bright, soft base (light setting)
directionalLight: 0xffffff, intensity 1.2, position(5, 5, 5)  // Key light
directionalLight2: 0xfff5ee, intensity 0.5, position(-5, 3, -5) // Warm fill
// Optional: a very subtle warm rim light (0xF2662A at low intensity) for a whisper of brand color

// Camera
fov: 40, near: 0.1, far: 100
position: (0, 0, 5)

// Object behavior
autoRotate: true, speed: 0.25 RPM                              // Very slow, contemplative — museum piece
scrollLinked: true                                              // Gentle rotation shift on scroll
```

### Material note:
- The dumbbell's metallic/chrome finish will read beautifully against the cream background
- Keep it clean and sculptural — this is the "product" in the boutique window

### When 3D is NOT available (fallback):
- A refined CSS line-art shape (thin elegant circle or arc) in charcoal with a whisper of orange
- This is placeholder until the GLB loads

### Performance:
- Lazy-load the scene. Only render when visible (IntersectionObserver).
- Mobile: static high-quality render fallback instead of live WebGL.
- Target 60fps desktop, 30fps mobile.

---

## Glassmorphism / Frosted Effect (used sparingly)

On a LIGHT background, glass reads differently. Use a soft frosted-white effect:

```css
.frosted-panel {
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(229, 224, 216, 0.8);
  border-radius: 4px;
  box-shadow: 0 8px 40px rgba(26, 22, 19, 0.06);
}
```

Use ONLY on:
- The contact/lead capture form
- Nav bar background on scroll (frosted cream)

Do NOT use on section backgrounds or buttons (buttons are solid fills).

---

## Custom Cursor Effect (refined, optional)

### Hero section only, desktop only:
- A small, elegant circle (12px, 1px charcoal border, no fill)
- On hover over interactive elements: expands to 40px with orange border
- Magnetic effect on CTA buttons: button shifts 2-3px toward cursor
- Disable entirely on touch devices
- Keep it subtle and refined — this is not a gimmick, it's a whisper of interactivity

---

## Scroll Progress Indicator

- A thin (1px) horizontal line at the very top of the viewport
- Color: accent orange (#F2662A)
- Width: 0% → 100% as user scrolls top to bottom
- Fixed, above all content
- No background track — just the orange line on cream

---

## Page Architecture — 7 Sections

### Section 1: HERO (100vh)

**Layout:**
- Full viewport, warm cream (#FAF8F4) background
- Center-aligned, with GENEROUS whitespace around everything
- The 3D dumbbell floats above/beside the wordmark as a sculptural object

**Content:**
- Small caption above: "EST. 2024 — HYDERABAD" in Inter, uppercase, wide letter-spacing, text-muted
- The wordmark: "MAISON de BUILD" — Cormorant Garamond, uppercase, "de" in italic script, large, charcoal, wide letter-spacing
- Sub-line below: "The art of building" — Cormorant Garamond italic, text-secondary, elegant
- Scroll indicator at bottom: a thin vertical line (40px) in charcoal with subtle downward animation

**3D Element:**
- The chrome dumbbell from public/models/dumbbell.glb
- Slowly rotating, lit brightly like a gallery piece against the cream
- Positioned as a refined sculptural accent — could be above the wordmark or offset to one side (asymmetry = editorial)
- Optional whisper of orange rim light
- Scroll-linked: drifts gently as user scrolls past

**Background:**
- Warm cream. Clean. Possibly the faintest texture (opacity 0.02) for warmth.
- NOT the dark hero-bg. (Note: hero-bg.jpg was generated for the dark version — we may not use it, or use it very faintly. See asset notes.)

---

### Section 2: PHILOSOPHY (editorial text reveal)

**Layout:**
- Full viewport, cream background
- Large elegant serif text, mask-revealing line by line as user scrolls
- Generous whitespace — the text sits in a sea of cream

**Content — revealed line by line (mask-reveal, slide up):**
```
We do not build bodies.
We build discipline.
We build craft.
We build a way of living.
```
- Cormorant Garamond, large (clamp 2.5rem to 4rem), charcoal, light weight
- Center or elegantly left-aligned
- After all lines revealed: a thin orange line (80px) draws itself below

**Background:**
- Cream. Perhaps the faintest warm gradient. Nothing busy.

---

### Section 3: THE SPACE (Environmental showcase — the ONE dark moment)

This is the dramatic contrast section — the dark gym interior against the otherwise light site.

**Layout:**
- Full-bleed. This section uses the dark warm background (#1A1613) OR the gym-interior.jpg
- Desktop: the gym-interior.jpg fills the section as a full-bleed cinematic image
- Text overlaid elegantly, or in a clean panel beside it

**Visual:**
- gym-interior.jpg (the dark moody gym) — this dark image becomes the dramatic pause
- Subtle parallax (0.25x)

**Content (overlaid or beside, in cream text on the dark image):**
- Caption: "THE SPACE" — Inter, uppercase, wide letter-spacing, orange accent
- Headline: "Where craft has a home" — Cormorant Garamond, cream
- Body (2 lines): "Twelve thousand square feet, considered down to the last detail. A space built for those who take the work seriously."
- Three refined stats: "12,000 SQ FT" / "EST. 2024" / "HYDERABAD" — cream text, orange accent lines

**Note:** This dark section is intentional contrast. It's the one moment the site goes dark, making the return to cream feel like light.

---

### Section 4: THE DISCIPLINES (Services — 4 refined cards)

**Layout:**
- Back to cream background
- Contained (max-width 1240px)
- Caption + serif headline at top, elegantly aligned
- 4 cards in a row (single column mobile), generous gaps

**Content:**
- Caption: "THE DISCIPLINES" — Inter, uppercase, orange
- Headline: "Four pursuits" — Cormorant Garamond, charcoal

**Cards (clean, minimal — white with subtle border):**
1. **Strength** — "Progressive programming, guided by those who compete."
2. **Nourishment** — "Nutrition considered as carefully as training."
3. **Recovery** — "The discipline of rest, done properly."
4. **Guidance** — "Private counsel with Rushil and senior coaches."

Each card:
- White (#FFFFFF) background, 1px subtle border (#E5E0D8), 4px radius
- A thin elegant line-drawn icon at top (charcoal, minimal — a simple abstract mark)
- Card title in Cormorant Garamond, charcoal, elegant
- One-line description in Inter, text-secondary, light
- Fade + rise reveal on scroll, 0.15s stagger
- No CTA inside cards — they are informational

---

### Section 5: IN NUMBERS (Data as elegant design)

**Layout:**
- Full-bleed cream, centered
- 4 stat blocks in a row (stacks on mobile), generous spacing

**Content:**
- "150" with label "MEMBERS"
- "15" with label "YEARS OF CRAFT"
- "4" with label "COACHES"
- "1" with label "STANDARD"

**Design:**
- Stat numbers: large (clamp 3rem to 5.5rem), Cormorant Garamond, light weight, charcoal
- A single accent detail (a thin orange underline, 40px) below each number
- Labels: Inter, uppercase, wide letter-spacing, text-muted
- Numbers count up elegantly from 0 on scroll into view (1.8s, ease)

---

### Section 6: MEMBERSHIP (Tiers — refined)

**Layout:**
- Cream background, contained
- Caption + serif headline
- 2 or 3 tier cards, elegant and minimal

**Content:**
- Caption: "MEMBERSHIP" — Inter, uppercase, orange
- Headline: "An invitation" — Cormorant Garamond

**Tier Cards (white, minimal, refined):**
1. **Foundation** — "Access to the space, the equipment, and the community."
2. **Atelier** (FEATURED) — "Foundation, with private coaching, nutrition, and recovery." — subtle orange border, gentle emphasis
3. **Maison** — "Complete access. Priority. A direct line to Rushil." — most exclusive

Each card:
- White background, subtle border
- Tier name in Cormorant Garamond, charcoal
- Short description in Inter, text-secondary
- Price: "By enquiry" — never a number (exclusivity)
- CTA: "Enquire" — the featured tier has a solid orange fill button; others have an elegant outlined button (charcoal border)
- Featured tier: 1px orange border, the faintest orange tint background (#F2662A08)
- Magnetic hover on buttons

---

### Section 7: ENQUIRE (Lead capture — refined form)

**Layout:**
- Full viewport (min-height 100vh), cream background
- A refined form, elegantly centered, max-width 500px
- Generous whitespace around it

**Above form:**
- Headline: "Begin the conversation" — Cormorant Garamond, charcoal, centered
- Sub-text: "Leave your details. We will be in touch." — Inter, text-secondary, centered, light

**Form Fields (clean, minimal, elegant):**
- "Full name" — text input, thin underline style (not boxed — elegant underline inputs)
- "Telephone" — tel input, underline style
- "What draws you here?" — select dropdown (Strength / Aesthetics / Longevity / Competition / Simply curious)
- "A note (optional)" — textarea, underline style, 2 rows
- Submit: "Enquire" — solid orange fill, cream text, magnetic hover, generous padding

**Input style note:** Use elegant underline inputs (border-bottom only, no full box) — this reads far more luxury than boxed inputs. On focus, the underline turns orange.

**Backend:**
- POST to /api/contact (create route, console.log for now, returns success)
- Success state: form fades out gracefully, replaced with "Thank you. We will be in touch." in elegant serif + a subtle orange checkmark/line animation

**Below form:**
- Small, refined: WhatsApp and Instagram, in text-muted. The only social links on the site.

---

### Footer (Minimal, elegant)

- Cream background, 1px top border (#E5E0D8)
- Left: "MAISON de BUILD" wordmark small, in charcoal (with "de" italic)
- Center or right: "© 2024 — All rights reserved" — text-muted, small
- Far right: "Crafted by Tachtix AI" — text-muted, small
- Generous padding (~60px vertical)
- No sitemap, no link grid, no newsletter

---

## Navigation

- Fixed top bar, transparent over the cream hero
- Left: "MAISON de BUILD" wordmark in charcoal (with "de" in italic script), OR just "MdB" monogram in orange for compactness
- Right: "Enquire" — a single elegant text link (charcoal), smooth-scrolls to Section 7
- On scroll: nav gets a frosted cream background (rgba(250,248,244,0.8) + backdrop-blur)
- No hamburger menu — single page, one scroll
- Mobile: wordmark/monogram left, "Enquire" right

---

## Technical Stack

```
Framework:      Next.js 15 (App Router)
Styling:        Tailwind CSS 4
3D:             Three.js + @react-three/fiber + @react-three/drei
Animation:      GSAP + ScrollTrigger + Lenis
Fonts:          Google Fonts (Cormorant Garamond, Inter)
Icons:          Custom minimal SVG line art (4-5 icons only)
Forms:          React Hook Form + Zod
Deployment:     Vercel (free tier)
```

### File Structure:
```
maison-de-build/
├── public/
│   ├── models/dumbbell.glb          # 3D hero model (READY)
│   ├── textures/
│   │   ├── gym-interior.jpg          # Section 3 dark image (READY)
│   │   └── hero-bg.jpg               # (generated for dark version — use faintly or not at all)
│   └── og-image.jpg                  # social sharing image
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── api/contact/route.ts
│   ├── components/
│   │   ├── Nav.tsx
│   │   ├── Hero.tsx
│   │   ├── Philosophy.tsx
│   │   ├── Space.tsx
│   │   ├── Disciplines.tsx
│   │   ├── Numbers.tsx
│   │   ├── Membership.tsx
│   │   ├── Enquire.tsx
│   │   ├── Footer.tsx
│   │   ├── ScrollProgress.tsx
│   │   ├── CustomCursor.tsx
│   │   ├── FrostedPanel.tsx
│   │   ├── AnimatedCounter.tsx
│   │   ├── MagneticButton.tsx
│   │   └── Scene3D.tsx
│   ├── hooks/
│   └── styles/globals.css
├── MAISON_DE_BUILD_DESIGN.md
├── tailwind.config.ts
└── package.json
```

---

## Performance Targets

- Lighthouse Performance: > 90
- First Contentful Paint: < 1.5s
- Largest Contentful Paint: < 2.5s
- Page weight (excl. lazy 3D): < 3MB
- 3D model lazy-loads only when hero in view

---

## Responsive Breakpoints

```
Mobile:     < 768px   — single column, static 3D fallback, no custom cursor, whitespace preserved
Tablet:     768-1024  — refined 2-column where fitting
Desktop:    > 1024    — full experience, custom cursor, 3-4 column cards
```

---

## SEO & Meta

```
Title: "Maison de Build — The Art of Building. Hyderabad."
Description: "An exclusive fitness maison in Hyderabad. Strength, nourishment, recovery, guidance. By invitation."
OG Image: og-image.jpg (the Maison de Build wordmark on cream)
```

---

## The One-Line Essence

Maison de Build is not a gym website. It is the digital storefront of a luxury house that happens to be about physical craft. Cream and orange. Serif and whitespace. Hermès, if Hermès made athletes. One page. One graceful scroll. One invitation.

---

## What This Website is NOT

- NOT an e-commerce site. No cart, no checkout.
- NOT a content platform. No blog, no articles.
- NOT a booking system. No schedules, no calendars.
- NOT a social feed. No member profiles.
- NOT dark, techy, or aggressive. It is light, elegant, and quiet.
- It IS a single-page, editorial, luxury lead-capture experience. One scroll. One form. Understated authority.
