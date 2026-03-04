# 🇺🇸 RECEIPTS — U.S. Policy Intelligence & Government Accountability Platform
### *"We've got yours."*
## Full Stack Architecture Strategy v2 — Revised with Politician Donor Intelligence

---

# THE NAME: **RECEIPTS**

**Primary:** `RECEIPTS`
**Tagline:** *"We've got yours."*
**Domain:** `receipts.gov.ai` or `getreceipts.us` or `receipts.fyi`

### Why RECEIPTS Works
- **Slang meaning**: "Show your receipts" = internet/cultural shorthand for *"prove it" or "show your evidence."* Immediately communicates the platform's mission to a wide audience.
- **Literal meaning**: Financial receipts = spending records, contracts, transactions. Exactly what the app tracks.
- **Subversive edge**: Saying to politicians and corporations — *"we have your receipts."* Implied accountability, without being aggressive.
- **Memorable**: One word. No explanation needed. Works as a verb too: *"We receipted them."*
- **Brandable**: R•E•C•E•I•P•T•S logo treatment, dark/monochrome with red accent (redacted document aesthetic)

**Runner-up names:**
| Name | Why It Works | Why It Doesn't |
|------|-------------|----------------|
| **UNREDACTED** | Powerful, speaks truth-to-power | Long, slightly aggressive |
| **THE LEDGER** | Professional gravitas, finance associations | Less memorable, generic |
| **AUDITORE** | Italian for "auditor" (assassins creed reference) | Too obscure for mass market |
| **CIVITAS** | Latin civic dignity | Too academic |
| **PRISM** | Refracts hidden data into visible light | Already used (NSA surveillance program — awkward) |

---

# PART 0 — TARGET AUDIENCE (Ranked by Relevance)

| # | Audience | Core Use Case |
|---|----------|--------------|
| 1 | **Investigative Journalists & Media** | Cross-reference donations → contracts → regulations in minutes |
| 2 | **ESG / Impact Investors & Analysts** | Identify political donation exposure, regulatory capture risk, corruption-adjacent positions |
| 3 | **Government Watchdog NGOs** | Self-service audit pipeline replacing months of FOIA grinding |
| 4 | **Academic Researchers** | Reproducible, citable datasets linking donations → policy → spending outcomes |
| 5 | **Congressional Staffers** | Real-time audit of whether appropriations match policy intent; donor influence tracking |
| 6 | **Short Sellers & Activist Hedge Funds** | Government contract cliffs, regulatory risk, political donation vulnerabilities |
| 7 | **Corporate Compliance & Law Firms** | Monitor competitor enforcement + political exposure for client industries |
| 8 | **State & Local Government Officials** | Benchmark federal funding; identify jurisdiction-level donor patterns |
| 9 | **Civic Tech Developers** | API consumers building derivative accountability tools |
| 10 | **General Public / Informed Citizens** | Plain-language: where my taxes go + who bought my representative |

---

# PART 1 — BACKEND DATA INTEGRATION STRATEGY

## 1.1 Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                        DATA SOURCES LAYER                         │
│                                                                    │
│  POLICY            SPENDING            DONOR INTELLIGENCE         │
│  ──────            ────────            ──────────────────         │
│  FederalRegister   USASpending         FEC Campaign Finance API   │
│  GovInfo           Data.gov/CKAN       OpenSecrets API            │
│  Regulations.gov   Socrata             Senate/House Disclosures   │
│  OpenGovCrawlers                       State Campaign Finance DBs │
└─────────────────────────────┬────────────────────────────────────┘
                              │
┌─────────────────────────────▼────────────────────────────────────┐
│                       ETL PIPELINE LAYER                          │
│   Per-source async Python workers (httpx + pandas + Celery)       │
│   Normalization → Entity Resolution → Deduplication               │
│   Cross-source linkage: Donor UEI ↔ Contract Recipient ↔ Company │
└──────────────┬────────────────────┬──────────────────────────────┘
               ▼                    ▼
    ┌─────────────────┐    ┌────────────────────┐    ┌──────────────┐
    │    Neo4j 5      │    │   PostgreSQL 16     │    │ Redis 7      │
    │  (Graph DB)     │    │ (Time Series +      │    │ (Cache +     │
    │  Entities +     │    │  Full Text +        │    │  Agent State)│
    │  Relations +    │    │  Audit Logs +       │    └──────────────┘
    │  Donor Network  │    │  pgvector)          │
    └─────────────────┘    └────────────────────┘
               │
┌──────────────▼───────────────────────────────────────────────────┐
│                  AI AGENT ORCHESTRATION LAYER                     │
│   FastAPI + LangGraph Multi-Agent System                          │
│                                                                    │
│   PolicyAgent | SpendingAgent | DonorAgent | CorruptionAgent      │
│   Tool calling → Graph queries → Cross-source inference           │
└─────────────────────────────┬────────────────────────────────────┘
                              │
                    REST + WebSocket + GraphQL API
```

---

## 1.2 Data Source Integration Specs

### EXISTING SOURCES (unchanged from v1)
*(FederalRegister, GovInfo, Regulations.gov, USASpending, Data.gov/CKAN, Socrata, OpenGovCrawlers — see v1 for full specs)*

---

### NEW SOURCE 8 — FEC Campaign Finance API (api.open.fec.gov)
**What it provides**: Every campaign contribution, expenditure, and PAC filing reported to the Federal Election Commission since 1979. The definitive source for federal campaign finance.

**ETL Strategy**:
- `/schedules/schedule_a/` → individual contributions (name, employer, occupation, amount, date, committee)
- `/schedules/schedule_b/` → disbursements (who campaigns paid, and for what)
- `/committees/` → all PAC registrations, super PACs, 501(c)(4) dark money orgs
- `/candidates/` → every candidate with office, party, state, district
- Key enrichment: normalize employer fields via fuzzy matching → resolve to company UEI in graph
- Contribution bundler network: identify individuals appearing across many contributions to same candidate → flag as bundlers
- PAC-to-candidate matrix: which companies' PACs fund which specific committees/candidates

**Graph nodes created**: `Politician`, `Campaign`, `PAC`, `Contribution`, `Disbursement`
**Graph edges created**: `DONATED_TO`, `FUNDED_BY_PAC`, `PAC_AFFILIATED_WITH_COMPANY`, `BUNDLED_BY`
**Refresh cadence**: Weekly (FEC quarterly reports + ongoing electronic filings)

---

### NEW SOURCE 9 — OpenSecrets API (opensecrets.org/api)
**What it provides**: Aggregated campaign finance + lobbying data with industry classification, "revolving door" employee tracking, and dark money analysis. The most analysis-ready donor data available.

**ETL Strategy**:
- `/candContrib` → top industry/company donors per candidate
- `/indExpendCode` → independent expenditure (Super PAC) data by candidate
- `/lobbyFirm` + `/lobbyIssue` → lobbying firms, clients, total spend, issues lobbied
- `/revolving` → individuals who moved between government and lobbying/industry
- `/candSummary` → full financial summary per candidate per cycle
- Industry code mapping → NAICS code → link to company graph nodes

**Graph edges created**: `INDUSTRY_SUPPORTED`, `LOBBIED_ON_BEHALF_OF`, `REVOLVING_DOOR_TRANSITION`
**Key value**: Pre-classified industry donor buckets (Defense, Health, Finance, Energy, etc.) — saves NLP work

---

### NEW SOURCE 10 — Senate & House Financial Disclosures
**What it provides**: Personal financial disclosures, stock trades (STOCK Act), and conflict-of-interest filings for all members of Congress.

**ETL Strategy**:
- Senate: `efts.senate.gov` + PDF scraping via pdfplumber
- House: `disclosures-clerk.house.gov` API
- Extract: stock holdings, transactions (buy/sell date, amount range, asset name)
- Cross-reference: stock ticker → company in graph → check if company has pending legislation/contracts
- STOCK Act violation flagging: trade within 30 days of committee hearing on that company

**Graph nodes created**: `StockTrade`, `FinancialDisclosure`, `Holding`
**Graph edges created**: `POLITICIAN_TRADED`, `HOLDS_STOCK_IN`, `POTENTIAL_CONFLICT`
**Corruption signals**: Trade timing vs. non-public committee activity = insider trading signal

---

### NEW SOURCE 11 — State Campaign Finance Databases (via Socrata + OpenGovCrawlers)
**What it provides**: State-level campaign contributions and expenditures — critical for governor/AG races that influence state contracts and regulation.

**ETL Strategy**:
- Priority states via Socrata: CA, NY, TX, FL, IL (highest contract volumes)
- OpenGovCrawlers for remaining states
- Normalize to same schema as FEC data
- Add `jurisdiction: state` property to distinguish from federal data

---

## 1.3 Expanded Graph Data Model (Neo4j)

```cypher
// NEW Node Types (added to v1 model)
(:Politician {name, bioguide_id, fec_candidate_id, office, party, state, district, chamber})
(:Campaign {id, name, cycle, total_raised, total_spent, cash_on_hand})
(:PAC {id, name, type, // super_pac | hybrid | traditional | dark_money
       total_raised, connected_org?})
(:Contribution {id, amount, date, type}) // individual | corporate PAC | bundled
(:LobbyFirm {id, name, total_income})
(:LobbyIssue {id, description, federal_agency?, bill_number?})
(:StockTrade {id, ticker, transaction_type, amount_range, transaction_date, report_date})
(:RevolvingDoor {person_id, gov_role, industry_role, transition_date, gap_days})

// NEW Relationship Types
(Company)-[:PAC_DONATED {amount, cycle}]->(Politician)
(Person)-[:INDIVIDUALLY_DONATED {amount, date}]->(Campaign)
(PAC)-[:INDEPENDENTLY_SPENT {amount, support_oppose}]->(Politician)
(Company)-[:AFFILIATED_WITH]->(PAC)
(LobbyFirm)-[:LOBBIED_FOR]->(Company)
(LobbyFirm)-[:LOBBIED_ON {amount, issue}]->(Agency)
(LobbyFirm)-[:LOBBIED_ON {amount, issue}]->(Docket)
(Person)-[:REVOLVING_DOOR {from_role, to_role}]->(Company)
(Politician)-[:SITS_ON_COMMITTEE {role}]->(Committee)
(Committee)-[:OVERSEES]->(Agency)
(Politician)-[:TRADED_STOCK {date, amount, type}]->(Company)
(Company)-[:RECEIVED_CONTRACT_FROM]->(Agency)
(Agency)-[:OVERSEEN_BY]->(Committee)

// THE KEY CORRUPTION INFERENCE CHAIN:
// (Company)-[:PAC_DONATED]->(Politician)-[:SITS_ON_COMMITTEE]->(Committee)
//   -[:OVERSEES]->(Agency)-[:AWARDED]->(Contract)-[:RECIPIENT]->(Company)
// = Donor → Oversight politician → Agency they oversee → Contract back to donor
```

---

## 1.4 AI Agent System — Donor Intelligence Added

### DonorAgent Tools
- `get_donor_profile(entity_id)` → FEC + OpenSecrets aggregated donation history
- `get_politician_donors(bioguide_id, cycle?)` → Top donors by industry/company for a politician
- `get_donation_to_contract_path(company_id, agency_id)` → Graph path: donation → politician → committee → agency → contract
- `detect_quid_pro_quo_signals(company_id)` → Correlates donation timing with contract awards / regulatory decisions
- `get_stock_trade_conflicts(politician_id)` → STOCK Act conflict detection
- `get_revolving_door_network(entity_id)` → Maps career transitions between government and industry
- `get_dark_money_trace(committee_id)` → Attempts to trace 501(c)(4) → Super PAC → Candidate chains

### Corruption Inference Engine (Updated Signals)

**Quid Pro Quo Pattern Detection**:
1. Company donates to politician's campaign
2. Politician sits on committee overseeing agency
3. Agency awards contract to same company within 12 months
→ **Score: HIGH** — flag with full chain evidence

**Regulatory Capture Pattern**:
1. Company comments on proposed regulation
2. Final rule materially changed in company's favor
3. Company had donated to committee chair who oversees that agency
→ **Score: HIGH** — regulatory capture signal

**Revolving Door Pattern**:
1. Official leaves agency
2. Joins industry lobbying firm or company within 24 months
3. Company receives contracts or favorable rules from former agency
→ **Score: MEDIUM-HIGH** — cooling-off period violation signal

**Stock Act Pattern**:
1. Politician trades stock in Company X
2. Company X has pending legislation/hearing in their committee within 30 days
→ **Score: HIGH** — potential STOCK Act violation, refer to DOJ/SEC

**Dark Money Laundering Pattern**:
1. 501(c)(4) receives large donation from unknown source
2. 501(c)(4) donates to Super PAC
3. Super PAC runs attack/support ads for candidate
4. Candidate wins → legislates favorably for industry consistent with 501(c)(4) focus
→ **Score: MEDIUM** — dark money laundering chain

---

## 1.5 Backend Tech Stack (unchanged from v1)
*(Neo4j 5 | FastAPI | PostgreSQL 16 | Redis | Celery | LangGraph | Claude API | pgvector | Docker)*

---

## 1.6 Updated ETL Pipeline Structure

```
etl/
├── base/ ...
├── sources/
│   ├── federal_register.py
│   ├── govinfo.py
│   ├── regulations_gov.py
│   ├── usa_spending.py
│   ├── data_gov.py
│   ├── socrata.py
│   ├── open_gov_crawlers.py
│   ├── fec.py                      # NEW — FEC campaign finance
│   ├── opensecrets.py              # NEW — OpenSecrets aggregated donor data
│   ├── senate_disclosures.py       # NEW — Senate financial disclosures + stock trades
│   ├── house_disclosures.py        # NEW — House financial disclosures + STOCK Act
│   └── state_campaign_finance.py   # NEW — State-level donor data
├── enrichment/
│   ├── entity_resolution.py
│   ├── nlp_extractor.py
│   ├── corruption_scorer.py
│   ├── donor_resolver.py           # NEW — Normalize employer → company UEI matching
│   ├── quid_pro_quo_detector.py    # NEW — Cross-source pattern engine
│   └── dark_money_tracer.py        # NEW — 501(c)(4) → Super PAC chain inference
└── scheduler/
    └── celery_app.py
```

---

# PART 2 — FRONTEND INTERFACE BLUEPRINT (REVISED)

## 2.1 Design Identity — RECEIPTS Brand

- **Aesthetic**: Investigative editorial + financial terminal hybrid. Think Bloomberg meets The Intercept.
- **Primary Background**: Near-black (#0D0D0D) with warm charcoal cards (#1A1A1A)
- **Accent**: Bold red (#E63946) — "red pen audit" visual language
- **Secondary**: Aged paper amber (#F4A261) — receipt/document associations
- **Typography**: `Playfair Display` (headlines — editorial gravitas) + `IBM Plex Mono` (data — financial terminal)
- **Motif**: Redacted document aesthetic — black bars that reveal on hover, receipt paper texture on export panels
- **Logo**: `R●CEIPTS` with a bullet/stamp red dot

---

## 2.2 Application Modules (10 Modules — Revised)

---

### MODULE 1 — HOME DASHBOARD (Revised)
Same as v1 but adds:
- **Donor Activity Strip**: Scrolling live feed of significant contributions filed with FEC in last 7 days
- **Hot Politician Card**: Most-donated-to politician this week + top industry donors
- **Conflict Alert Badge**: Count of active STOCK Act potential violations

---

### MODULE 2 — POLICY INTELLIGENCE AGENT
Same as v1. New example queries added:

- *"Which companies donated to the chairman of the Senate Armed Services Committee and then received defense contracts?"*
- *"Show me all politicians who traded pharmaceutical stocks within 30 days of voting on drug pricing bills"*
- *"Map the dark money trail behind the 2024 campaign ads targeting FTC commissioners"*
- *"Which lobbying firms work for both Company X and have former employees in Agency Y?"*

---

### MODULE 3 — SPENDING AUDIT DASHBOARD (unchanged from v1)

---

### MODULE 4 — POLICY TRACKER (unchanged from v1)

---

### MODULE 5 — ENTITY GRAPH EXPLORER (Revised)
New node types added to visualization: `Politician`, `PAC`, `LobbyFirm`, `StockTrade`

New subgraph views:
- **"Donor Web"**: Start from company → show all politicians donated to → show committees they sit on → show agencies they oversee → show contracts awarded
- **"Dark Money Chain"**: Trace 501(c)(4) → Super PAC → Candidate chains
- **"Revolving Door Map"**: Person-centric view of career transitions

---

### MODULE 6 — CORPORATE ACCOUNTABILITY TRACKER (Revised)
New tab on Company Profile: **Political Footprint**
- Total federal campaign donations (cycle, 5-year, all-time)
- PAC donation breakdown by politician, party, committee
- Lobbying spend vs. contract awards correlation
- Revolving door employees (former government officials now at company)
- Regulatory wins: rules changed after their lobbying/donations

---

### MODULE 7 — 🆕 POLITICIAN DONOR INTELLIGENCE MODULE

**Purpose**: Deep-dive into the financial relationships behind every federal elected official.

**Layout**: Search/filter header → politician cards → full politician profile

**Politician Search & Filter**:
- Filter by: Chamber (Senate/House) | Party | State | Committee | Industry sector donations | Cycle

**Politician Profile Page**:

*Overview Tab*:
- Career donation total + breakdown by cycle
- Top 5 donor industries (pie chart)
- Donation-to-legislation score: AI-computed correlation between donors and voting record
- RECEIPTS Accountability Score (0–100): composite of conflicts, disclosure compliance, vote-donor alignment

*Donor Breakdown Tab*:
- **Individual Donors**: Top individual donors, with employer and occupation
- **PAC Donations**: All PAC contributions, with affiliated company links
- **Super PAC Support**: Independent expenditures in support/opposition
- **Dark Money Exposure**: Any known 501(c)(4) connections
- **Industry Heatmap**: Sankey diagram — industry → PAC/bundler → politician → committee → agency → contract

*Legislative Record Tab*:
- All votes with donor alignment flag: "This vote favored X industry, which donated $Y"
- Bills sponsored/co-sponsored with industry correlation
- Committee assignments + industries most active in those committees

*STOCK Act Monitor Tab*:
- All stock trades (House/Senate disclosures)
- Red flags: trades within 30-day window of committee activity on that company
- Cumulative return vs. S&P (Do politicians outperform the market?)
- Download full trade history as CSV

*Revolving Door Tab*:
- Former employers and positions
- Former staff members now lobbying for which companies
- Former colleagues now in regulated industries

*Conflict Map Tab*:
- Interactive graph: Politician → Donors → Companies → Contracts → Agencies they oversee
- Filter by: time period, dollar threshold, industry

---

### MODULE 8 — ACCOUNTABILITY INDEX (Revised)

Adds **Politician Leaderboard**:
- Ranked by RECEIPTS Accountability Score
- Score components: Donor transparency, STOCK Act compliance, Vote-donor alignment, Disclosure timeliness, Revolving door activity
- Filters: Party, State, Chamber, Cycle
- "Hall of Shame" / "Hall of Fame" tabs (most/least accountable)
- Incumbent re-election watchlist: candidates with high accountability risk in upcoming cycle

---

### MODULE 9 — 🆕 DARK MONEY TRACKER

**Purpose**: Dedicated module for tracing non-disclosed political spending.

**Layout**: Flow diagram (primary) + evidence table

**Dark Money Flow Diagram**:
- Sankey/flow visualization: Unknown donors → 501(c)(4) → Super PAC → Candidate
- Color-coded by disclosure level: green (fully disclosed) → yellow (partially known) → red (fully dark)
- Click any node → known information + source documents

**Dark Money Organizations Index**:
- All known 501(c)(4)s with political activity
- Known parent organizations (where traceable)
- Total spend per election cycle
- Linked candidates and issues

**Inference Engine Panel**:
- AI-generated network inference: "Based on issue alignment and timing, this dark money group is likely connected to [Industry X]"
- Confidence score + evidence links
- "This is inference, not confirmed" disclaimer (legal safety)

---

### MODULE 10 — REPORTS & ALERTS (unchanged from v1, expands to include donor reports)

New report templates:
- "Politician Financial Conflict Report" — full donor → vote alignment analysis
- "Corporate Political Footprint" — company's full political spending + outcomes
- "Dark Money Exposure Brief" — unknown-origin spending around a candidate/issue
- "Committee Capture Analysis" — industry dominance of specific congressional committee

---

## 2.3 Tiered Access Model (Revised)

| Tier | Price | Access |
|------|-------|--------|
| **Public (Free)** | $0 | Home dashboard, basic politician/company search, public leaderboards, pre-built reports |
| **Analyst** | $49/mo | Full chat agent, spending audit, donor intelligence, graph explorer, custom alerts, CSV exports |
| **Professional** | $199/mo | Full API access, bulk exports, dark money tracker, STOCK Act monitor, team seats, PDF reports |
| **Enterprise** | Custom | White-label, SLA, dedicated ingestion, SSO, compliance pack, state-level expansion access |
| **Media Partner** | Custom | Embeddable widgets, API for newsroom CMS integration, co-branded reports |

---

# PART 3 — PHASED ROLLOUT PLAN (Revised)

| Phase | Scope | Timeline |
|-------|-------|----------|
| **Phase 1 — MVP** | USASpending + FedReg ETL; spending dashboard + policy agent (chat) | 3 months |
| **Phase 2 — Donor Intelligence** | FEC + OpenSecrets ETL; Politician module; Donor web graph | +3 months |
| **Phase 3 — Accountability Index** | Corruption scoring; STOCK Act monitor; Dark money tracker; Company profiles | +3 months |
| **Phase 4 — State Expansion** | State campaign finance; Socrata multi-portal; State procurement | +6 months |
| **Phase 5 — Public Platform** | Open API; community reports; mobile app; ESG investor feeds; media embed widgets | +6 months |

---

# PART 4 — LEGAL & ETHICS FRAMEWORK (Critical)

Modeled after br-acc's rigorous legal pack:

- **DISCLAIMER.md**: All data from public sources. Signals are investigative hypotheses, not legal findings.
- **METHODOLOGY.md**: Every score component, weight, and data source publicly documented.
- **DISPUTE.md**: Process for entities to challenge data accuracy (like DMCA counter-notice).
- **ETHICS.md**: No individual private citizens. Only public figures in their official capacity. No doxxing facilitation.
- **LEGAL REVIEW**: Campaign finance data is 100% public record — zero legal risk. STOCK Act data is public congressional filing. OpenSecrets is licensed for research use.
- **INFERENCE LABELING**: All AI-generated inferences labeled "Analytical inference — not legal conclusion."
- **LICENSE**: AGPL-3.0 (mirrors br-acc — maximizes public trust, forces derivative works to stay open)

---

*RECEIPTS — Because every dollar leaves a trail.*
*Built on the World Open Graph architecture (br-acc / AGPL-3.0).*
