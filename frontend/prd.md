# ENVISIONGRID

## City-Scale Environmental Risk Intelligence Platform

#### PRODUCT REQUIREMENTS DOCUMENT

```
Version 2.0 | February 2026
```
```
"From complaints to predictions. From predictions to decisions."
```
### 1. PRODUCT VISION

EnvisionGrid is a city-scale environmental risk intelligence command center that transforms raw
violation signals into actionable, forward-looking intelligence. Unlike traditional monitoring
dashboards that report what happened, EnvisionGrid predicts where the next environmental
incident will occur — up to 7 days in advance — and operationalizes that intelligence into
inspector workflows, policy simulations, and leadership analytics.

The platform is purpose-built for municipal governments and environmental agencies that need
to:

- Monitor environmental risk in real time across the full city grid
- Understand why risk is rising in a specific zone, with plain-language AI explanations
- Forecast hotspot emergence at 24-hour, 72-hour, and 7-day horizons
- Take operational actions — from alert creation to inspector dispatch to case closure
- Simulate policy impact before committing resources
- Visualize future consequences if no intervention occurs
- Present leadership with strategic, budget-linked risk analytics

```
Design Mandate
```

```
EnvisionGrid is not a dashboard. It is a municipal command center — an environmental
nervous system for the city that predicts, explains, acts, and learns.
```
### 2. PROBLEM STATEMENT & MARKET GAP

Cities currently dispatch environmental inspectors reactively — after a complaint is filed, after
harm has already occurred. No commercial platform today connects all five operational layers
required for proactive environmental governance:

```
Layer What Exists What's Missing
```
```
Signal Ingestion Single-source tools (sensors only, or
complaints only)
```
```
Cross-domain fusion:
violations + complaints +
sensors + satellite
Spatial Modeling GIS visualization (Esri,
CalEnviroScreen)
```
```
ML-powered hotspot
prediction with spillover
propagation
Temporal Forecasting Single-domain (air quality only —
Delhi SAFAR)
```
```
Multi-domain 24h/72h/7d grid-
level forecasting
Explainability Black box models or none (Palantir,
Descartes Labs)
```
```
SHAP-driven, plain-language
driver attribution per grid cell
Operational Workflow Alerts only OR compliance workflow
only
```
```
Integrated: alert → case →
action → outcome → model
feedback
Policy Simulation Absent from all commercial platforms What-if counterfactual engine
for councils and planners
```
Key finding: No commercial platform in the environmental intelligence market connects
all five layers. This gap defines EnvisionGrid's market position and the procurement
category it creates.

### 3. CORE DESIGN PRINCIPLES

### 3.1 Map-First Experience

The interactive risk map occupies the primary visual space at all times. All intelligence layers —
heatmaps, alert overlays, propagation animations, zone drawers — surface as map overlays or
contextual side panels. The map is the ground truth; everything else is commentary on it.


### 3.2 Decision-Oriented UX

Every screen must answer four questions in sequence:

- What is happening? (Current risk state)
- Why is it happening? (Driver attribution with SHAP explainability)
- What happens next? (Forecasted risk at 24h / 72h / 7d)
- What should we do? (Recommended actions, inspector routing, policy levers)

### 3.3 Progressive Detail Flow

The platform guides users from macro to micro via a structured drill-down path:

```
City View → Zone View → Alert → Case → Action → Outcome → Model Feedback
```
### 3.4 Explainability by Default

Every risk score surfaces its top 3 contributing signals in plain language. No prediction is shown
without an explanation. Inspectors must be able to justify dispatch decisions; regulators must be
able to defend enforcement actions. SHAP values underpin every explanation.

### 3.5 Responsible Uncertainty Communication

Confidence intervals are displayed alongside every risk score. High-confidence cells appear in
solid risk colors; uncertain cells use gradient fills with a 'Needs More Data' annotation.
Inspection prioritization weights high-confidence signals first.

### 4. SYSTEM ARCHITECTURE OVERVIEW

EnvisionGrid operates as a five-layer intelligence pipeline, each layer feeding the next:

### Layer 1 — Signal Ingestion

The platform ingests heterogeneous environmental signals from multiple source types:

- Violation records: type, severity (1–5), timestamp, lat/lon, source facility
- Citizen complaints (311 reports): often lead violations by hours or days — treated as a
    first-class predictive signal, not CRM noise
- IoT / sensor readings: AQI, water quality, noise levels — used for compound signal
    confirmation
- Satellite-derived indicators: land cover change, burn scar detection (optional enrichment
    layer)


```
Key Insight
A single violation is not the risk. Risk emerges from patterns: repeated violations, increasing
trend, spillover into neighboring zones, recency, and multi-signal agreement. The ingestion
layer captures all of these simultaneously.
```
### Layer 2 — Spatial Discretization

Raw lat/lon event points are mapped onto an H3 hexagonal grid (configurable resolution, default
~1km cells). Every event carries a grid_id. This enables zone-level aggregation, neighbor
relationship computation, and spillover modeling — mirroring how operational city command
centers actually monitor territory.

### Layer 3 — Feature Engineering (ML Signal Pipeline)

For each grid cell and time bucket, the platform computes a rich feature matrix:

```
Feature Detail / Priority
```
```
Rolling Violation Intensity Count of violations in last 1 / 3 / 7 days, severity-
weighted (1–5 scale)
Recency Decay Score Exponential decay weighting — violations in the
last 6h carry highest signal weight
Neighbor Spillover Index Risk propagation from adjacent cells using
directional spatial weights (wind, water flow, road
network)
```
```
Trend Acceleration Last 3-day rate vs. 7-day average — rising
counts are more dangerous than stable counts
Complaint Surge Score 311 complaint clustering with spatial and
temporal density weighting
Sensor Drift Indicator Deviation from baseline sensor readings —
confirms physical impact of violation patterns
Signal Agreement Score Compound risk: zone with violation + complaint +
sensor spike is categorically higher risk than any
single signal
```
### Layer 4 — Risk Forecasting Engine

The forecasting engine produces per-cell risk scores at three time horizons:

- 24 - hour: Operational dispatch planning
- 72 - hour: Resource allocation and pre-positioning
- 7 - day: Strategic planning and budget justification

Initial implementation uses a deterministic weighted scorer with sigmoid normalization
(risk_score in [0,1]). The model adapter is decoupled from the API and UI — production
deployment swaps in a gradient-boosted tree (XGBoost/LightGBM) for tabular signals and an


LSTM or Temporal Convolutional Network for sequential sensor data, without any interface
changes.

```
Spillover / Propagation Modeling
Grid cells are modeled as nodes in a spatial graph where edges represent adjacency weighted
by physical connectivity (wind corridors, waterways, road networks, historical co-occurrence). A
high-risk industrial cell at t=0 that historically precedes elevated complaints in adjacent
residential cells propagates estimated risk forward. No commercial platform implements this.
```
### Layer 5 — Explainability & Operationalization

Every prediction surfaces its top 3 SHAP-attributed drivers in structured format, with an LLM-
generated plain-language summary. The operational layer converts predictions into alerts,
cases, recommended actions, and — after resolution — feeds outcomes back as labeled
training data to improve the next prediction cycle.

### 5. PRIMARY NAVIGATION & PAGE INVENTORY

The platform is organized into eight primary navigation modules, accessible via persistent left
sidebar:

```
Feature Detail / Priority
```
1. Command Center Real-time city risk map — the operational home
    screen
2. Zone Intelligence Deep-dive analysis for a single grid zone
3. Alerts Center Alert triage, filtering, and status management
4. Case Management Inspector case lifecycle: Open → In Progress →
    Closed
5. Policy Simulation What-if counterfactual engine for intervention
    planning
6. Daily & Historical Reports Structured intelligence summaries for decision-
    makers
7. Impact Visualization No-action scenario: animated risk propagation
    over time
8. Leadership Analytics Executive KPIs: city risk index, budget efficiency,
    hotspot recurrence

### 6. PAGE SPECIFICATIONS


### Page 1 — Command Center (Main Map)

Purpose: Real-time city-wide risk monitoring. The operational home for inspectors and duty
officers.

##### Layout

- Top Bar: City selector, time horizon toggle (24h / 72h / 7d), global search, notification
    bell, user profile
- Main Area: Risk map (70% width) + Right intelligence panel (30%)
- Bottom Strip: Risk trend timeline (7-day rolling)

##### Risk Map (deck.gl — REQUIRED)

- H3 hexagonal grid overlay with risk heatmap (Safe → Moderate → Attention → Danger
    color scale)
- Hover tooltip: Zone ID, risk score, confidence interval, predicted lead time, top driver
- Click zone → opens Zone Intelligence drawer (right panel slide-in)
- Spillover propagation arrows on high-confidence risk spread predictions
- Animation mode: toggle to show 24h → 72h → 7d risk surface evolution

##### Right Intelligence Panel Cards

- Active Alerts (count + severity distribution)
- Top 5 Risk Zones (zone ID, risk score, lead time, recommended action)
- Moderate Zones Needing Attention (escalation probability)
- Safe Zones count + stability trend
- City Risk Index — composite score vs. 30-day baseline

##### Bottom Risk Timeline

- 7 - day rolling risk trend chart (all zones aggregated)
- Complaint spike overlay (volume bars)
- Violation frequency trend
- Notable events markers (inspection outcomes, case closures)

### Page 2 — Zone Intelligence

Purpose: Full analytical deep-dive on a single H3 grid zone. Accessible via map click or direct
search.


##### Header Section

- Zone ID + coordinates
- Risk score badge (color-coded) with confidence interval (e.g., 0.78 ± 0.09)
- Risk horizon: 24h / 72h / 7d tabs
- Predicted lead time to escalation

##### Driver Breakdown Panel (SHAP-Powered)

- Violation intensity score (rolling weighted count)
- Recency effect score (decay-weighted recent events)
- Spillover influence from neighboring zones
- Complaint surge index
- Sensor drift indicator (if available)
- SHAP waterfall chart — visual attribution of each feature's contribution to the risk score

##### AI Explanation Panel

Plain-language LLM-generated summary. Example:

```
Zone 42-NE is elevated risk (0.81) primarily due to a 340% spike in sewage discharge
complaints over 72 hours, compounded by industrial emission readings 2.3 standard deviations
above baseline. Historical recurrence patterns indicate a 67% probability of confirmed violation
if uninspected within 24 hours.
```
##### Actions

- Generate Alert (pre-populated with zone data and top drivers)
- Run Policy Simulation (scoped to this zone)
- View Historical Report (zone-specific timeline)
- Export Briefing (PDF summary for field teams)

### Page 3 — Alerts Center

Purpose: Triage and manage all system-generated and manually-created alerts.

##### Table View Columns

- Severity (Critical / High / Moderate / Low) with color badge
- Zone ID + district name
- Risk Horizon (24h / 72h / 7d)
- Confidence level (% + interval)


- Top Driver (primary SHAP signal)
- Status (New / Acknowledged / Case Created / Resolved)
- Created timestamp + age

##### Filters

- Severity level (multi-select)
- Risk horizon
- Zone / district
- Confidence threshold (slider: e.g., show only alerts with >70% confidence)
- Status filter
- Date range picker

### Page 4 — Case Management

Purpose: Inspector-facing workflow to convert alerts into tracked operational actions.

##### Kanban Board Layout

- Columns: OPEN | IN PROGRESS | CLOSED
- Case card fields: Zone ID, risk score at creation, assigned team, recommended action,
    SLA timer, linked alert(s)
- Drag-and-drop between columns with status timestamp

##### Case Detail View

- Full zone intelligence snapshot at time of case creation
- Recommended action checklist (auto-generated from dominant violation type)
- Inspector notes and photo attachment
- Outcome recording: confirmed violation / no violation / escalation
- Outcome feeds back to model as labeled training data

### Page 5 — Policy Simulation

Purpose: Let city planners and councillors test interventions before committing resources. This
feature does not exist in any commercial environmental platform today.

##### Layout: Split Panel

- Left: Simulation control panel with parameter sliders
- Right: Before vs. After risk map comparison (synchronized view)


##### Simulation Controls

- Reduce violations by X% in selected zones (slider)
- Increase inspection frequency (teams / week)
- Burning/dumping reduction target
- Scope selector: city-wide / district / specific zones
- Horizon: 7-day / 30-day projection

##### Simulation Outputs

- Risk reduction % per affected zone
- Projected complaint volume change
- Estimated cost efficiency (avoided incident response cost)
- Updated risk heatmap (updated in <5 seconds using pre-computed sensitivity matrices)
- Comparison table: Current risk vs. Simulated risk per top-10 zones

```
Demo Scenario
Move the 'industrial burning reduction' slider to 30%. Three red zones transition to yellow.
Projected complaint volume drops 34%. Estimated $2.1M in avoided compliance response
costs. Toggle back — risk returns. Full simulation runs in under 5 seconds.
```
### Page 6 — Daily & Historical Reports

Purpose: Structured daily intelligence briefings for decision-makers and operational teams.
Replaces manual situation reports.

##### Layout

- Top: Date selector + report type filter (Daily Briefing / Weekly Summary / Custom Range)
- Middle: City-wide risk summary cards (aggregated metrics)
- Bottom: Structured report sections

##### Report Section A — Safe Areas

- Green zones list with stability trend
- Reason for safety (low complaint density, recent inspections, no spillover)
- Historical comparison: weeks stable

##### Report Section B — Danger Areas (Critical)


- Red zones with escalation probability score
- Top drivers per zone (SHAP summary)
- "What Can Get Worse" projection:
    ◦ If no intervention: complaint volume may increase X% in 72h
    ◦ Neighboring zones with high spillover probability
    ◦ Environmental quality degradation trajectory

##### Report Section C — Moderate Areas (Needs Attention)

- Yellow/orange zones with early warning indicators
- Trend direction (stable / worsening / improving)
- Suggested monitoring actions and inspection schedule

##### Report Visualizations

- Risk distribution pie chart (Safe / Moderate / Attention / Danger by zone count)
- Zone category map overlay (color-coded city grid snapshot)
- Historical comparison chart (current week vs. 4-week average)

### Page 7 — Impact Visualization (No-Action Scenario)

Purpose: Viscerally communicate the cost of inaction to leadership and policy stakeholders.
Show the future city if no interventions are made.

##### Layout: Split-Screen Synchronized Maps

- Left map: Current city state
- Right map: Projected city under no-action scenario
- Both maps synchronized (pan / zoom together)

##### Time Slider Interaction

- Slider positions: Day 0 → Day 3 → Day 7 → Day 14
- As slider advances: pollution spread gradients expand, moderate zones turn red, risk
    propagation arrows intensify
- Zone-level risk scores update in both map panels

##### Optional Overlays

- Projected complaint volume increase (density heatmap)
- Health risk index rise (per zone)
- Estimated economic impact ($) of inaction


### Page 8 — Leadership Analytics

Purpose: Executive-level strategic intelligence. Budget justification, response efficiency tracking,
and long-term hotspot identification.

##### Key Metrics

- City Risk Index: composite score vs. 30/90-day trend
- Budget vs. Impact: inspection spend against risk reduction achieved
- Response Efficiency: average time from alert to case closure
- Recurring Hotspots: zones with persistent risk patterns (failure of past interventions)
- Model Accuracy Tracker: how often high-confidence predictions were confirmed by
    inspection outcomes

### 7. KEY UX FLOWS

### Operational Flow (Morning Briefing Scenario)

Story: It is 7 AM. An environmental compliance officer opens the dashboard. The system has
automatically generated a risk briefing: three high-priority grid zones, each with a plain-language
SHAP explanation. The officer clicks Generate Alert, which pre-populates with zone data. One
click converts the alert to a case, assigns it to the nearest available team, and pre-calculates the
optimal inspection route by risk priority.

```
Dashboard → Zone Intelligence → Alert → Case → Action → Outcome (feeds model)
```
### Strategic Flow (Leadership Review)

```
Dashboard → Daily Reports → Danger Areas → Impact Visualization (No-Action)
```
### Policy Flow (Council Session)

```
Zone Intelligence → Policy Simulation → Compare Before/After → Export for Council
Presentation
```
### 8. VISUAL DESIGN SYSTEM


### Theme

Dark command-center UI. High-contrast risk color system. The interface should communicate
operational intelligence, not consumer software.

### Risk Color System

```
Feature Detail / Priority
```
```
Safe Green (#27AE60) — No immediate action
required
```
```
Moderate Yellow (#F39C12) — Monitor; early warning
indicators present
Attention Orange (#E67E22) — Escalating; inspection
recommended within 72h
Danger Red (#C0392B) — Critical; immediate dispatch
required
Uncertainty Gradient Soft/translucent fills for low-confidence cells —
'Needs More Data' label
```
### Confidence Visualization

High-confidence risk cells: solid fill. Low-confidence cells: gradient edge fade. Confidence
interval shown numerically (e.g., 0.78 ± 0.09) on all zone cards and tooltips.

### 9. TECHNICAL STACK & DEPENDENCIES

### Mapping & Spatial (MANDATORY)

- deck.gl + @deck.gl/react + @deck.gl/layers + @deck.gl/geo-layers — H3 hex grid
    rendering, heatmap layers, propagation overlays
- maplibre-gl + react-map-gl — Base map tiles and viewport management
- h3-js — H3 hexagonal indexing, neighbor computation, resolution management

### Charts & Analytics

- recharts — Timeline charts, trend lines, risk distribution
- visx — SHAP waterfall charts, advanced statistical visualizations
- react-chartjs- 2 — Leadership analytics charts


### UI & Interaction

- tailwindcss — Utility-first styling
- shadcn/ui — Component primitives (dialogs, cards, tables, sliders)
- lucide-react — Icon system
- framer-motion — Map transition animations, drawer slide-ins, timeline scrubbing

### State & Data

- zustand — Global state management (active zone, selected horizon, simulation state)
- @tanstack/react-query — Data fetching, caching, background refresh for live risk
    updates
- @tanstack/react-table — Alerts center and case management tables

### Utilities

- date-fns — Timeline date formatting and range computation
- clsx — Conditional class composition

### 10. COMPONENT ARCHITECTURE

```
App ├── Layout │ ├── Sidebar (navigation, active state, collapse) │ ├── Topbar (city
selector, horizon toggle, notifications) │ └── MainContainer ├── MapModule │ ├──
DeckGLMap (H3 hex layer, heatmap, propagation arrows) │ ├── RiskLayer (color mapping,
confidence opacity) │ ├── Tooltip (zone hover card) │ └── ZoneDrawer (Zone
Intelligence slide-in panel) ├── ReportModule (Daily briefing, historical comparison) ├──
ImpactSimulationModule (Split map, time slider, overlays) ├── PolicySimulationModule
(Controls, before/after maps) ├── AlertModule (Table, filters, alert creation form) ├──
CaseModule (Kanban, case detail, outcome recording) └── AnalyticsModule (Leadership
KPIs, budget charts, hotspot history)
```
### 11. INNOVATION HIGHLIGHTS & COMPETITIVE DIFFERENTIATORS

The following capabilities are absent from all reviewed commercial platforms and represent
EnvisionGrid's primary technical differentiators:

```
Feature Detail / Priority
```
```
Multi-Signal Cross-Domain Fusion Violations + complaints + sensors + satellite
fused simultaneously into one risk score. Every
competitor handles one signal type.
```

```
Spatio-Temporal Grid Forecasting 24h / 72h / 7d risk surface across all
environmental domains. Only single-domain
government systems (air quality only) approach
this.
```
```
SHAP Explainability per Grid Cell Plain-language driver attribution for every
prediction. No commercial platform provides this
at zone level.
```
```
Spillover / Risk Propagation Graph Physical propagation modeling via spatial graph
— wind, water flow, road network. Entirely
absent from commercial market.
```
```
Policy Simulation Engine What-if counterfactual engine for council-level
decision making. Not implemented by any
commercial platform.
Bayesian Uncertainty Visualization Confidence intervals per zone, visual gradient
encoding. No city-facing tool does this. Positions
platform as responsible AI.
```
```
Citizen Complaint as ML Feature 311 complaints as first-class predictive signal
fused with sensor data. Novel signal fusion
approach.
```
```
Inspector Workflow Tied to ML Scores Inspection routing and case creation driven by
predicted risk. Completely unaddressed by all
reviewed platforms.
```
### 12. IMPLEMENTATION PRIORITY

### Must Build (Hackathon Core)

- Command Center risk map with H3 deck.gl layer
- Zone Intelligence drawer with SHAP driver breakdown and AI explanation
- Alerts Center with table, filters, and alert-to-case conversion
- Policy Simulation — slider controls + before/after map
- Daily Reports page with safe / danger / moderate sections
- Impact Visualization — split-screen animated no-action scenario

### Can Be Mocked / Simplified

- Full case lifecycle management (show structure; mock data)
- Leadership Analytics (static charts with representative data)
- Model retraining from inspection outcomes (describe architecture; not required to
    execute live)
- Real-time sensor API integration (use pre-generated synthetic data)


### 13. FIVE-MINUTE DEMO SCRIPT

```
Time Segment Narrative Focus
```
```
0:00–0:30 The Problem Open with live violation data.
'Cities dispatch inspectors
after harm is done. There is no
system that predicts where the
next hotspot will be — until
now.'
0:30–1:30 Signal Ingestion & Risk Surface Show live map with
24h/72h/7d selector. Walk
through signal types fused.
Click high-risk zone to show
composite breakdown.
1:30–2:30 Explainability Click Why is this zone high
risk? Show SHAP waterfall +
LLM summary. 'Our model
does not just say where — it
says why, in language an
inspector can act on. This is
responsible AI.'
2:30–3:30 Alert → Case → Action Trigger alert. Convert to case
with auto-populated inspection
form and recommended action
checklist. 'The system does
not just alert — it creates the
case and closes the loop.'
3:30–4:30 Policy Simulation Move burning reduction slider
to 30%. Watch 7-day surface
update. 'This feature does not
exist in any commercial
platform today. Cities can test
interventions before funding
them.'
4:30–5:00 Vision Close Zoom to city grid. 'We are not
building a dashboard. We are
building the environmental
nervous system of a city that
predicts, explains, acts, and
learns.'
```
### 14. EXPECTED USER PERCEPTION

The platform must communicate:


- Operational intelligence — not a data viewer, a decision engine
- Explainable AI — every prediction justified, every action traceable
- Future forecasting — the city three, seven days from now is visible today
- Policy-level decision support — from inspector dispatch to council chambers

Positioning Close

"The question is not whether cities can afford this technology. The question is whether they can
afford to keep operating without it."

```
EnvisionGrid PRD v2.0 — February 2026 — Confidential
```

