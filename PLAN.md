Phase 5: Report History & Comparison — Plan Mode (CPO)
Core User Problem
Users cannot revisit past analyses or compare performance across time periods, limiting their ability to:
- Track improvement after implementing recommendations
- Understand seasonal/trend variations in their business
- Compare different scenarios (e.g., pre/post menu change, marketing campaign)
- Maintain longitudinal business intelligence
Value Proposition
Transform CBO.AI from a one-time analysis tool into a continuous intelligence platform that enables:
- Progress tracking: Measure impact of actions over time
- Contextual understanding: Compare current performance against historical baselines
- Informed decision-making: Base strategies on trends, not snapshots
- Accountability: Verify whether recommended actions produced expected results
Scope & Structure
1. History View (Enhanced Business Sidebar)
- Location: Left business sidebar (in RTL)
- Content: List of past workflow runs with:
  - Date/time (formatted: "YYYY-MM-DD HH:mm")
  - Business name
  - Health score (with color-coded badge: exceptional/healthy/warning/critical)
  - Overall status icon
  - Business type
- Interaction:
  - Click to load historical report (maintains current report in memory for comparison)
  - Long press/swipe to delete (with confirmation)
  - "Set as baseline" option for comparison tracking
2. Comparison Engine
- Trigger: When viewing a historical report OR explicitly selecting "Compare Reports"
- UI: Split-view or toggleable comparison mode
- Compared Elements:
  - Metric Cards: Side-by-side/current vs. baseline with Δ (delta) values
    - Financial: Net revenue, gross margin %, break-even gap
    - Digital: Sentiment score, engagement rate, follower growth
    - Market: Rating vs. competitors, review volume trend
    - Action Plan: Completion % of recommended tasks
  - Section Narratives: Highlight changed conclusions/risks
  - Chart Comparisons: Overlay or side-by-side rendering of key charts
  - Action Plan Evolution: Show completed/pending/tasks added/removed
3. Technical Implementation
- Storage: Extend Zustand store (src/store/report-store.ts) with:
  - history: ReportManifest[] (limited to last 20 for performance)
  - baselineId: string | null
  - comparisonMode: boolean
  - comparedReportId: string | null
- API Endpoints:
  - GET /api/report/history — paginated history list
  - DELETE /api/report/history/[id] — delete specific report
  - POST /api/report/history/[id]/baseline — set as comparison baseline
- Persistence: History saved to localStorage (key: cbo-report-history)
4. Key User Flows
A. Tracking Progress
1. User completes initial report
2. Implements 2-3 high-priority recommendations from action plan
3. After 30 days, generates new report
4. Compares new report against original (automatically set as baseline)
5. Sees measurable improvements in targeted metrics
B. Scenario Analysis
1. User runs report for current menu
2. Tests new menu item subset for 2 weeks
3. Runs second report
4. Compares: Did test items improve contribution margin?
5. Decides whether to roll out full menu change
C. Continuous Monitoring
1. User sets last report as baseline
2. Enables weekly auto-reminder (via settings)
3. Gets notified when significant deviation detected (>15% Δ in health score)
Success Metrics
- % of users who generate ≥2 reports (indicates recurring value)
- Average time between report generations (target: <45 days)
- Comparison feature usage rate (target: >30% of returning users)
- User-reported insight: "I could see the impact of my changes"
Dependencies & Prerequisites
- Phase 4 must be stable (progress events reliable)
- Manifest schema must include all comparable metrics
- Chat context must support history-aware questioning
- Export functionality (PDF/Excel) could be bundled here or Phase 6
Non-Goals for Phase 5
- Real-time collaboration (multiple users editing same report)
- AI-generated comparison insights (manual comparison first)
- Advanced statistical forecasting (simple Δ only)
- Cross-business benchmarking (requires anonymized aggregation)
This plan maintains our principles: minimal clean code, user-first value, Arabic-first UI, and leverages existing patterns (Zustand, motion, shadcn). No technical execution occurs yet — awaiting your agreement to proceed to CTO mode for implementation.



Now I have a complete picture. Here's my plan:
---
Color Strategy Plan
1. Business Sidebar (Brand Reinforcement)
Current: Minimal branding ("CBO.AI" in plain text), gray backgrounds, standard borders
Changes:
Area	Change
Header	Add Vivid Blue accent (text-primary) to "CBO.AI" logo, subtle gradient underline
Business Profile Card	Add subtle colored top border (emerald for exceptional, blue for healthy, amber for warning, red for critical)
Focus Area Cards	Add colored left border: Financial→emerald, Digital→blue, Market→orange
Health Score	Add subtle card tint matching status (emerald/blue/amber/red at 5% opacity)
2. Generation Progress (Color Enhancement)
Current: Already has semantic color (icons, status), but feels muted
Changes:
Area	Change
Header	Add brand glow accent (Vivid Blue gradient underline on progress bar)
Phase Cards	Add colored accent bar on left based on phase type (Financial=emerald, Location=blue, Reviews=orange, Social=purple, Analysis=cyan, Strategy=amber, Experts=teal, Assembly=primary)
Running Phase	Add subtle pulsing glow effect in brand color
Expert Cards	Reinforce with colored icon backgrounds matching their domain
3. Chat Sidebar
Two options:
- Option A (Remove): Remove entirely → gives ~320px more width to report view
- Option B (Keep minimal): Keep as-is but shrink width to 280px, make header more subtle
---
Tradeoff Question
For the Chat Sidebar: Given that the content issue is lack of messages (not design), which approach do you prefer?
- Remove it entirely — More space for the report, cleaner interface
- Keep but shrink — Maintains the chat capability for future use, just less prominent

Build successful ✓
Completed Changes Summary
Schema Enhancements (src/mastra/shared/schemas.ts)
- reportSectionSchema: Added bulletPoints array, emoji field (max 1) to conclusion
- expectedOutcomeSchema: Added displayPriority boolean
- chartReferenceSchema: Added chartType enum (bar, gauge, table, matrix)
- competitorReviewSummarySchema: Added estimatedMonthlyRevenue, photoUrl, priceLevel
Types Update (src/lib/types.ts)
- ReportSection: Added emoji? and bulletPoints? fields
- ExpectedOutcome: Added displayPriority? field
Workflow Enhancements (src/mastra/workflows/main-workflow.ts)
- fetchCompetitorReviews: Fetches top 6 competitors with photos, calculates estimated monthly revenue (rating × reviewCount × 1000 SAR)
- generateFinancialSection: Includes local market context with competitor revenue estimates
- generateMarketSection: Updated prompt for unified competitive matrix
Agent Instruction Updates
- financial-expert-agent: Emphasizes salesShare, uses full COGS terminology, limits emojis to one
- market-expert-agent: Unified matrix table, competitor photos, limits emojis
- digital-expert-agent: Gauge chart type specification, organized top content
- CBO-agent: "التحضير والتنفيذ" pattern, displayPriority: true on all KPIs
Frontend Updates
- ConclusionBadge: New creative design with colored background, emoji support, no alert icon
- SectionContent: Added bullet points rendering
- MarketDataSection: Page size 6, sorting by rating/reviews buttons
- engagement-gauge.tsx: New component for engagement rate visualization
All 16 points addressed. Ready for testing!