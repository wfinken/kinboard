Product Requirements Document (PRD)

Project Name: KinBoard
Domain: kinboard.xyz
Target Environment: Self-hosted (Phase 1), scaling to SaaS (Phase 2)

1. Product Overview

Vision: To provide a highly accessible, lightweight digital family dashboard that organizes chaotic household schedules, lists, and chores, viewable on any device—especially low-powered smart TVs and old tablets.
Concept: A software alternative to expensive, proprietary wall-mounted family dashboards (e.g., Skylight Frame, Echo Show). KinBoard acts as the household's "Command Center."

2. Technical Architecture

To prioritize Smart TV compatibility and low resource usage, the app will minimize client-side JavaScript.

Framework: Astro (configured for SSR - Server-Side Rendering). Astro's Islands architecture ensures only necessary interactive components ship JS.

Authentication: @auth/astro (Auth.js) for Google OAuth integration.

Database: SQLite (via LibSQL or Prisma/Drizzle). Ideal for self-hosting; easily portable.

Styling: Tailwind CSS (compiles to pure CSS, avoiding heavy runtime styling engines).

Hosting (Phase 1): Dockerized Node.js environment for easy self-hosting (Homelab, Raspberry Pi, VPS).

3. Core Features (MVP Parity)

3.1. Unified Calendar (The Core)

Google OAuth Sync: Authenticate via Google to pull in one or multiple Google Calendars.

Views: Daily agenda, 3-day rolling view, and monthly overview.

Color Coding: Ability to assign colors to different family members or calendar sources.

Read-Only Default: Display-first mentality for the TV, with easy ways to add events from a mobile device.

3.2. Task & Chore Management

Daily Checklists: Simple to-do lists categorized by family member (e.g., "Kids Chores", "House Maintenance").

State: Checkboxes that reset daily or weekly.

3.3. Meal Planning

Weekly Menu: A simple text-based widget displaying Breakfast/Lunch/Dinner for the current day, and a glance at the week ahead.

3.4. Household Bulletin Board

Sticky Notes: A module for custom text (e.g., "Don't forget your gym bag!", "Plumber coming at 2 PM").

Photo Rotation (Optional): Ability to point to a local folder or Google Photos album for a screensaver mode.

3.5. Ambient Information

Weather Widget: Current temperature, daily high/low, and a simple 3-day forecast using a free API (e.g., Open-Meteo).

Clock: Prominent time and date display.

4. User Interface & Experience

Smart TV Optimization:

Large, high-contrast typography.

No complex hover states required (as TVs lack mice).

Auto-refresh logic (meta refresh or lightweight polling) so the screen stays up-to-date without manual intervention.

Dark mode by default (better for ambient screens in living rooms).

Admin Dashboard: A separate, mobile-responsive route (e.g., /admin) where the household "IT person" configures API keys, OAuth, and widget layouts.

5. Development Phases

Phase 1: Self-Hosted MVP (Current Focus)

Setup Astro project with Node adapter for SSR.

Implement @auth/astro with Google OAuth.

Build the Google Calendar fetcher (server-side).

Build the Weather and Time widgets.

Create a simple SQLite schema for Chores and Sticky Notes.

Wrap the application in a Dockerfile for easy local deployment.

Phase 2: Refinement & UI Polish

Implement customizable layouts (grid system where users can toggle widgets on/off).

Add auto-refresh logic for the "Kiosk Mode" view.

Finalize mobile admin view for adding chores/notes on the go.

Phase 3: SaaS Preparation

Migrate from SQLite to PostgreSQL.

Implement multi-tenancy (Workspaces/Households) so multiple families can register and manage their own dashboards on kinboard.xyz.

Implement Stripe for subscription billing.

6. Open Questions & Considerations

Smart TV Browsers: Older WebOS or Tizen browsers have limited ES6 support. Astro targeting older environments in its build step may be required.

Google API Quotas: For self-hosting, users will need to provide their own Google Cloud API credentials, or KinBoard will need an approved OAuth app status before transitioning to a SaaS model.