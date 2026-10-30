# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primarily students and learners who want to understand how real software systems are built: people studying system design, preparing for interviews, or curious how products like ChatGPT, Uber, or Netflix work under the hood. They explore on a laptop, often in long sessions, alternating between looking at a system, reading about its parts, and asking follow-up questions.

## Product Purpose

ORBIT is a personal AI workspace for learning how systems fit together. Its centre is the Visual Learning Studio: search any system and get an explorable 3D architecture with every part explained (what it does, its APIs, data model, failure modes, trade-offs, and scaling), a guided tour of the request flow, and optional hand-gesture control. Around it sit an AI chat, user-controlled memory, projects, tasks, and local workspace tools. Success is a learner who can explain a system's architecture after exploring it.

## Positioning

Any system the learner names becomes a navigable 3D model with grounded explanations, designed on demand by the connected model and validated before it renders, rather than a static diagram or a wall of text. Learners can point at and grab the architecture with their hands, and save what they learn into their own memory.

## Operating Context

- Laptop browser, local development deployment (React + Vite frontend, FastAPI backend).
- Model provider is configurable between NVIDIA's hosted Nemotron API (default) and Nebius Token Factory (OpenAI-compatible); a labelled demo mode works without a model.
- Camera frames for hand tracking stay in the browser.

## Capabilities and Constraints

- Screens: Home, AI Workspace (chat), Projects, Visual Learning, Memory, Skills, Tasks and Plans, Settings and Privacy.
- Visual Learning: three hand-built scenes (LLM platform, Amazon-like e-commerce, three-tier web app) plus model-generated scenes for any searched system; 3D stack is Three.js via React Three Fiber.
- Existing stack: React 18, TypeScript, Tailwind CSS v4, TanStack Query.
- Generation takes about 15 to 30 seconds per new system; repeat searches are cached in memory.

## Brand Commitments

- The product name is ORBIT (confirmed by the user).
- Dark interface: the 3D studio's look (graphite models with glowing color-coded accents on a deep night ground) is liked by the user and stays.

## Evidence on Hand

- No logo, screenshots, testimonials, or usage data exist yet. Do not invent users, metrics, or claims.

## Product Principles

- Understanding over decoration: every visual element should help a learner see how a system works.
- Show the system doing its job: flows, parts, and failure modes are demonstrated, not just described.
- The learner stays in control: their memory, their camera, their data.
- Honest about the model: generated designs are labelled as proposed designs and as model-generated.
