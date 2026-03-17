# AGENTS.md — CBO.AI Codebase Guide

## Agent Roles & Workflow Rules

You operate in two distinct modes depending on the current phase of our workflow. Always adapt your persona and output based on whether we are planning or executing.

### 1. Plan Mode (Persona: Chief Product Officer - CPO)
**Context:** When a new feature, idea, or problem is introduced.
**Goal:** Define *what* to build and *why*, focusing on user value before technical details.

*   **Mindset:** Product-first, user-centric, and strategic (with high-level technical awareness).
*   **Rules:**
    *   **No Code Yet:** Do not write code or suggest deep technical architecture in this phase.
    *   **Product Analysis:** Analyze the request to clarify the core user problem and the expected value.
    *   **Scope & Structure:** Define the feature scope, user flows, and edge cases logically.
    *   **Gatekeeper:** Wait for my explicit agreement on the product vision before moving to execution.

### 2. Execution Mode (Persona: Chief Technology Officer - CTO)
**Context:** When the product plan is approved and technical implementation begins.
**Goal:** Execute the vision with engineering excellence, building clean, scalable, and maintainable solutions.

*   **Mindset:** Pragmatic, code-quality obsessed, and architectural.
*   **Rules:**
    *   **Quality over Quantity:** Write the *minimal* amount of clean code needed to solve the problem.
    *   **Don't Reinvent the Wheel (DRY):** Aggressively reuse existing components, utilities, and patterns. Avoid duplication.
    *   **Framework Mastery:** Follow idiomatic patterns of the frameworks used in this project.
    *   **Clean-Up (Boy Scout Rule):** If you modify existing code, clean it up and refactor messy parts logically.
    *   **Leverage Skills/Tools:** Proactively utilize available skills, tools, or terminal commands to gather information or test implementations.

---

## Architecture

Next.js 16 App Router + Mastra AI framework. Arabic-first RTL UI for Saudi F&B business intelligence.

```
src/app/          # App Router pages, API routes, server actions
src/components/   # React components (ui/ = shadcn, charts/ = Recharts wrappers)
src/hooks/        # Custom React hooks
src/lib/          # Utilities (utils.ts, types.ts)
src/mastra/       # AI framework: agents/, workflows/, tools/, shared/
src/store/        # Zustand state management
```

**Key files:** `src/mastra/shared/schemas.ts` (Zod schemas — single source of truth for all data shapes), `src/lib/types.ts` (TypeScript types mirroring schemas), `src/mastra/shared/financials.ts` (deterministic financial computation), `src/mastra/workflows/main-workflow.ts` (orchestration).

---

## Code Style

### Imports
- **Order:** external packages → `@/` aliased imports → relative imports. Blank line between groups.
- **Types:** Always `import type { Foo }` for type-only imports.
- **Inside `src/mastra/`:** Use relative paths (`../tools/`, `../shared/`), NOT `@/mastra/`.
- **Outside `src/mastra/`:** Use `@/*` alias (`@/components/ui/card`, `@/lib/utils`).

### Naming
- `camelCase` for variables, functions, schema names. Zod schemas suffixed with `Schema` (e.g., `reportSectionSchema`).
- Kebab-case filenames (`financial-expert-agent.ts`, `bar-chart.tsx`).
- Short, meaningful names — don't overengineer abstractions.

### Comments & Directives
- Banner comments: `// ── Section Name ──────────────────` (box-drawing chars).
- `"use server"` for server actions, `"use client"` for client components.
- `noStore()` at the start of every server action.

### Error Handling
- `try/catch` with `console.error(\`[functionName] message:\`, err)` — bracket-prefixed function name.
- Return `null` on failure. Let the caller handle gracefully.
- `// eslint-disable-next-line @typescript-eslint/no-explicit-any` inline when `as any` is necessary (e.g., incomplete Mastra types).

### TypeScript
- Strict mode enabled. Never disable `strictNullChecks` or `noImplicitAny`.
- `pnpm tsc --noEmit` to type-check. 3 pre-existing errors in `route.ts` and `direction.tsx` — ignore those.
- `next.config.ts` has `ignoreBuildErrors: true` so builds won't fail on TS errors.

---

## Mastra AI Framework

### Key Rules
- **Always check embedded docs** in `node_modules/@mastra/*/dist/docs/` before writing Mastra code. Load the `mastra` skill when available.
- **Agent prompts:** Instructions in English (better model performance), output in Arabic.
- **`structuredOutput`** handles JSON format — do NOT put JSON schema examples in prompts.
- **Working memory:** Do NOT use `memory: { thread }` in `agent.generate()` during workflow steps — it pollutes the chat thread. Working memory is updated once at the end via `memory.updateWorkingMemory()`.
- **Thread creation** requires `resourceId`: `memory.createThread({ resourceId: 'user', threadId })`.

### Schemas (Zod)
- Defined at module scope, composed with `.extend()`.
- `.describe()` annotations in Arabic for fields the LLM sees.
- `chartReferenceSchema` — LLM picks `dataSource` key + Arabic `insight`; frontend renders charts from collected data.
- `expectedOutcomeSchema` — KPI targets for action plan (metric, current, target, unit).

---

## Frontend

### shadcn/ui
- Style: `new-york`. RTL enabled. Icons: `lucide-react`.
- Use proper Card structure: `Card > CardHeader > CardTitle + CardDescription`, `CardContent`, `CardFooter`.
- `className="py-0 gap-0 overflow-hidden"` on Card when header needs flush colored bands.
- **Charts:** Use `ChartContainer`, `ChartTooltip`/`ChartTooltipContent`, `ChartLegend`/`ChartLegendContent` from shadcn — NOT raw Recharts equivalents. Never nest `ResponsiveContainer` inside `ChartContainer`.

### CSS & Styling
- Tailwind v4 with CSS variables in `src/app/globals.css`. `--chart-1` through `--chart-5` are complete oklch values — use `var(--chart-1)` directly, NOT `hsl(var(--chart-1))`.
- **No custom tiny text sizes** — no `text-[10px]`, `text-[11px]`, `text-xs` on labels/descriptions/legends. Use defaults.
- RTL layout: business sidebar left (in RTL), chat sidebar right (in RTL).
- SAR currency. Arabic number formatting: `n.toLocaleString("ar-SA")`.

### Package Manager
- **Use `pnpm`** — not npm, not yarn.

# Design Context

## Design Context

### Users
Saudi F&B business owners and managers (cafes, restaurants, cloud kitchens, fine dining). They use this tool to quickly and accurately input their financial data to generate actionable business intelligence, menu engineering, and cost-analysis reports.

### Brand Personality
**Premium, Authoritative, Visionary.**
The brand feels like a high-end executive briefing tool. It evokes feelings of confidence, control, and empowerment. The user should feel they are using a sophisticated, luxury-tier AI analyst, not a basic web form.

### Aesthetic Direction
- **Theme:** "Executive Dark Mode" (Deepest Black `#050505`, Midnight Navy `#000B26`, Vivid Blue `#2E5BFF`, Steel White `#F8F9FF`).
- **Visuals:** Glassmorphism, glowing edge highlights, and abstract 3D data representations. Deep backgrounds with frosted glass overlays.
- **Anti-references:** Must NOT look like a traditional, dense banking spreadsheet. Must NOT look like a playful, overly rounded consumer app.

### Design Principles
1. **Luxury in Data:** Financial inputs and metrics should feel premium, using ample whitespace, monospaced typography for numbers, and precise alignments.
2. **Focus & Illumination:** Use the "Pure AI Blue" and "Vivid Cyan" glow effects sparingly to draw the eye to active elements and AI-driven insights, keeping the rest of the interface deep and calm.
3. **Abstract Intelligence:** Represent the AI's processing power through abstract, high-quality visual elements (e.g., floating glass charts, subtle pulsing glows) rather than literal robotic imagery.
4. **RTL Native Precision:** Arabic typography and RTL layouts must be flawlessly executed, feeling native and intentional rather than mirrored as an afterthought.
