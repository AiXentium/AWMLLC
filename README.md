# AWM Coastal Windows

Create a completely new and independent Lovable project named “AWM LLC Website & Takeoff Portal.” Do not reuse, import, remix, reference, connect to, or modify Affiliate Preneurs, AiXentium, or any other existing project. This project must have its own isolated codebase, routes, components, product data, branding, login flow, and future backend architecture.

Build a polished production-quality frontend website for AWM LLC (American Windows Manufacturer LLC), a Florida-based supplier/distributor of YKK AP residential windows and patio doors. The public website should be original but visually inspired by the premium, architectural presentation of Renaissance Windows & Doors: large residential imagery, generous whitespace, refined typography, elegant product cards, clear calls to action, and a Florida/coastal construction tone. Do not copy Renaissance branding, text, layout, assets, or trade dress.

PRIMARY GOAL
Build the public marketing website now, plus a separate login page for a future internal AWM Takeoff AI backend. The website should serve homeowners, builders, contractors, architects, and multifamily developers.

BRAND
Name: AWM LLC
Expanded name: American Windows Manufacturer LLC
Positioning: AWM LLC supplies YKK AP residential window and patio door solutions. Do not claim official authorized status unless explicitly confirmed.
Geographic focus: Florida and Southeast projects.
Style: premium, modern, dependable, architectural, coastal-ready.
Colors: dark navy, warm white, soft gray, restrained bronze/gold accent.
Typography: Georgia for major headings where practical, clean sans-serif for body text.

PRODUCT STRUCTURE
Use current official YKK AP residential product structure from official YKK AP sources only:

- StyleView® Premium Vinyl Windows & Doors — new construction
- StyleGuard® Impact-Resistant Windows & Patio Doors — coastal/high-wind applications
- Precedence® Replacement Windows — remodel and replacement

Cover these product types where applicable:

- Single-hung
- Double-hung
- Casement
- Awning
- Picture/fixed
- Transom
- Geometric
- Horizontal slider
- Sliding patio doors

Where applicable, distinguish frame/application choices such as Classic/flat frame, J-channel, and flange. State that availability, performance, colors, glazing, impact ratings, and installation requirements vary by configuration and project. Do not invent ratings.

ROUTES

1. Home /
2. Products /products
3. StyleView /products/styleview
4. StyleGuard /products/styleguard
5. Precedence /products/precedence
6. Builders & Multifamily /builders
7. Why AWM /about
8. Resources /resources
9. Contact /contact
10. Takeoff Login /takeoff-login
11. Takeoff Dashboard Preview /takeoff-dashboard

HOME
Include:

- Hero with premium modern Florida residence imagery
- Headline such as “Windows Built for Florida Living”
- Supporting copy about supplying YKK AP residential windows and patio doors for new construction, coastal, multifamily, and replacement projects
- Request a Quote and Explore Products CTAs
- Three product-family cards
- Product-type visual grid
- Audience section for homeowners, builders, contractors, architects, and multifamily
- Coastal-performance section written carefully without unsupported guarantees
- Process: Consult, Select, Quote, Deliver
- Resources links
- Final CTA and footer

PRODUCTS
Create filterable visual product cards. Filters:

- Product family
- New construction, coastal/impact, replacement
- Window type
- Patio door
- Frame/application style where relevant

Use reusable structured product data and dynamic detail drawers/modals instead of dozens of repetitive pages.

PRODUCT FAMILY PAGES
Each page includes:

- Hero visual
- Family explanation
- Best-use cases
- Available window and patio door types
- Carefully stated benefits
- Frame/application options
- Product gallery/cards
- Request Quote CTA
- Links to official YKK AP resources

BUILDERS
Include single-family and multifamily support, project consultation, plan review, product selection, quantity/takeoff support teaser, delivery coordination, and Florida compliance awareness. Add an upload-plans CTA placeholder but do not implement uploads yet.

ABOUT
Present AWM LLC as a practical supply and project-support partner. Do not imply that AWM manufactures YKK AP products.

RESOURCES
Cards for official YKK AP product portfolio, installation instructions, warranty, ENERGY STAR information, glass options, and brochures. Label external manufacturer resources.

CONTACT
Fields: name, company, email, phone, project type, project address, product interest, message, consent checkbox. Show success state on submit.

TAKEOFF LOGIN
Route: /takeoff-login
Brand: AWM Takeoff AI
Fields: email, password, remember me, forgot password, sign in, back to main site.
Development demo credentials:
admin@awmllc.com
AWMdemo2026!
Correct login routes to /takeoff-dashboard.

TAKEOFF DASHBOARD PREVIEW
Frontend-only internal shell with Projects, Recent Plan Sets, Takeoffs in Progress, Jurisdiction Reviews, New Project button, and “Phase 1 workspace preview” badge. Do not build the full takeoff system yet.

IMAGERY
Do not scrape or copy Renaissance imagery. Use high-quality royalty-free architectural imagery, tasteful neutral product visuals, or official public YKK AP assets where lawful and technically stable. Make all imagery easy to replace.

LEGAL
Footer note: “YKK AP®, StyleView®, StyleGuard®, and Precedence® are trademarks of their respective owner. AWM LLC is an independent supplier/distributor. Product availability and specifications are subject to manufacturer confirmation.”
Do not claim authorized dealer status.

UX
Responsive, accessible, sticky header, mobile menu, restrained animation, no broken routes, keyboard-friendly controls, proper alt text.

TECHNICAL
Use TypeScript, Tailwind, and shadcn/ui. Use local product data for now. Do not connect Supabase or any shared database yet. Keep this project fully isolated from all other projects.

Verify every route, product filters, contact form success state, mobile navigation, demo login, and dashboard navigation before completion.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/250d31fc-706d-4ec9-8d13-cf87789bc128).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
# AWMLLC
