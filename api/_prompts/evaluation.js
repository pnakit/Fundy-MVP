import { z } from 'zod';

// ---------------------------------------------------------------------------
// Zod schema for a single evaluation category output
// ---------------------------------------------------------------------------

export const EvalCategorySchema = z.object({
  category_id: z.string(),
  category_title: z.string(),
  summary: z.string(),
  completeness: z.number().min(0).max(100),
  status: z.enum(['complete', 'needs_attention', 'incomplete']),
  highlights: z.array(z.string()),
  gaps: z.array(
    z.object({
      action: z.string(),
      type: z.enum(['table_stakes', 'stretch']),
      evidence_items: z.array(z.number()),
    })
  ),
  keyMetrics: z.object({
    perItemAssessment: z.array(
      z.object({
        item: z.string(),
        status: z.enum(['PROVEN', 'PARTIAL', 'UNPROVEN']),
      })
    ),
    provenCount: z.number(),
    partialCount: z.number(),
    unprovenCount: z.number(),
  }),
  deepDivePrompt: z.string(),
});

// ---------------------------------------------------------------------------
// Category ID → display title mapping
// ---------------------------------------------------------------------------

export const CATEGORY_TITLES = {
  product_technology: 'Product & Technology',
  market_traction: 'Market Traction & Revenue',
  business_model: 'Business Model & Economics',
  team_organization: 'Team & Organization',
  go_to_market: 'Go-to-Market',
  financial_health: 'Financial Health',
  fundraising_capital: 'Fundraising & Capital',
  competitive_position: 'Competitive Position',
  operations: 'Operations',
  legal_compliance: 'Legal & Compliance',
};

// ---------------------------------------------------------------------------
// Per-category evaluation scorecards (extracted from Dify environment variables)
// ---------------------------------------------------------------------------

export const EVALUATION_SCORECARDS = {
  product_technology: `## Product & Technology — Evaluation Scorecard

Each evidence item is scored as: PROVEN (1 point), PARTIAL (0.5 points), or UNPROVEN (0 points).

### Maturity Stage Thresholds

| Stage | Proven Items | Description |
|-------|-------------|-------------|
| **Concept** | 0–4 | Idea stage, minimal evidence |
| **Early** | 5–8 | Some traction, foundational work underway |
| **Validated** | 9–13 | Core claims substantiated |
| **Scaling** | 14–17 | Strong evidence across most items |
| **Leader** | 18–20 | Comprehensive evidence, market-leading position |

Partial items count as 0.5 toward the proven count.

### Evidence Items

| # | Evidence Item | Maturity Gate | Semantic Search Query |
|---|--------------|---------------|----------------------|
| 1 | Working product exists | Concept | \`product is live users can sign up here is the demo how it works\` |
| 2 | Core problem clearly defined | Concept | \`companies have to manually struggle with this costs time before we built\` |
| 3 | Target user identified | Concept | \`our customers are we built this for they typically work at\` |
| 4 | Technical architecture documented | Early | \`we built using our stack is runs on AWS GCP Node Python React Postgres\` |
| 5 | Product used by real customers | Early | \`we have active users customers logging in daily weekly usage numbers\` |
| 6 | Core feature set complete | Early | \`the product lets you users can do key features include we shipped\` |
| 7 | User feedback collected systematically | Early | \`users told us our NPS is customers said they wish survey results\` |
| 8 | Product solves problem measurably | Validated | \`customers went from to saved time reduced cost results after using\` |
| 9 | Product-market fit signals present | Validated | \`customers keep coming back referring friends organic retention stayed without asking\` |
| 10 | Technical scalability demonstrated | Validated | \`system handled peak requests per second concurrent users latency at load\` |
| 11 | Development velocity sustainable | Validated | \`we deploy weekly shipped features this sprint two-week releases cadence\` |
| 12 | Technical debt managed | Validated | \`code review test coverage we allocate time refactoring quality standards\` |
| 13 | Security practices in place | Scaling | \`pen test passed SOC2 encrypt customer data audit security assessment\` |
| 14 | IP protection strategy exists | Scaling | \`filed patent provisional application trade secret we own proprietary algorithm\` |
| 15 | Platform/API extensibility | Scaling | \`our API third parties integrate developers built on webhooks SDK ecosystem\` |
| 16 | Data infrastructure mature | Scaling | \`we track events per day analytics warehouse Mixpanel Segment dashboards alerts\` |
| 17 | Multi-environment deployment | Scaling | \`staging before production CI pipeline automated tests deploy process\` |
| 18 | Product roadmap driven by data | Leader | \`data showed users doing so we prioritized A/B test analytics informed decision\` |
| 19 | Industry-recognized technical excellence | Leader | \`won recognized benchmark compared top ranked award featured in\` |
| 20 | Innovation pipeline active | Leader | \`building next R&D exploring research upcoming capabilities working on new\` |

### Maturity Stage Interpretation for Product & Technology
- **Concept** (0–4): Has an idea or early prototype but no real users
- **Early** (5–8): Working product with initial users, basic architecture in place
- **Validated** (9–13): Product-market fit signals, customers getting measurable value, scalable architecture
- **Scaling** (14–17): Enterprise-ready security, IP protected, extensible platform, data-driven development
- **Leader** (18–20): Industry-recognized technology, active innovation pipeline, comprehensive technical excellence`,

  market_traction: `## Market Traction & Revenue — Evaluation Scorecard

Each evidence item is scored as: PROVEN (1 point), PARTIAL (0.5 points), or UNPROVEN (0 points).

### Maturity Stage Thresholds

| Stage | Proven Items | Description |
|-------|-------------|-------------|
| **Concept** | 0–4 | Idea stage, minimal evidence |
| **Early** | 5–8 | Some traction, foundational work underway |
| **Validated** | 9–13 | Core claims substantiated |
| **Scaling** | 14–17 | Strong evidence across most items |
| **Leader** | 18–20 | Comprehensive evidence, market-leading position |

Partial items count as 0.5 toward the proven count.

### Evidence Items

| # | Evidence Item | Maturity Gate | Semantic Search Query |
|---|--------------|---------------|----------------------|
| 1 | Target market identified | Concept | \`the market we are going after segment we focus on companies that\` |
| 2 | Value proposition articulated | Concept | \`unlike alternatives we offer reason customers choose us different because\` |
| 3 | First paying customer acquired | Concept | \`first sale closed customer paid us initial revenue first contract signed\` |
| 4 | Revenue model defined | Early | \`we charge per seat subscription monthly fee pricing is annual contract\` |
| 5 | Monthly recurring revenue established | Early | \`MRR is thousand monthly recurring revenue subscription paying customers\` |
| 6 | Customer acquisition channel identified | Early | \`we find customers through most customers come from our main channel is\` |
| 7 | Customer retention measured | Early | \`percent of customers renew churn is low customers stay average tenure\` |
| 8 | Revenue growth rate documented | Validated | \`grew percent last month revenue doubled this quarter growth rate\` |
| 9 | Net revenue retention above 100% | Validated | \`existing customers spend more upsell expanded account increased seats\` |
| 10 | Customer acquisition cost known | Validated | \`costs us dollars to acquire new customer marketing spend per acquisition\` |
| 11 | Total addressable market sized | Validated | \`the market is billion we are going after segment worth opportunity\` |
| 12 | Repeatable sales process exists | Validated | \`sales pipeline stages close rate we convert from demo to paid\` |
| 13 | Multiple revenue streams active | Scaling | \`also generate from services professional implementation in addition to subscription\` |
| 14 | Unit economics positive | Scaling | \`we make profit per customer lifetime value multiple of acquisition cost\` |
| 15 | Market share measured | Scaling | \`we have percent of the market one of the top players in space\` |
| 16 | International or multi-market revenue | Scaling | \`customers in UK Europe Canada international revenue outside US global\` |
| 17 | Revenue predictability demonstrated | Scaling | \`annual contracts we can forecast revenue ninety percent accuracy cohort\` |
| 18 | Category leader position | Leader | \`we are the leading top three recognized as the go-to solution\` |
| 19 | Revenue at scale (>$1M ARR) | Leader | \`ARR is million annual revenue run rate crossed million dollar\` |
| 20 | Organic growth engine working | Leader | \`customers find us without paid ads word of mouth referral came from\` |

### Maturity Stage Interpretation for Market Traction & Revenue
- **Concept** (0–4): Has an idea of target market but no revenue
- **Early** (5–8): First customers, initial MRR, basic acquisition channel
- **Validated** (9–13): Growing revenue, known unit economics, repeatable sales
- **Scaling** (14–17): Multi-channel, positive unit economics, predictable revenue
- **Leader** (18–20): Market leader, revenue at scale, organic growth flywheel`,

  business_model: `## Business Model & Economics — Evaluation Scorecard

Each evidence item is scored as: PROVEN (1 point), PARTIAL (0.5 points), or UNPROVEN (0 points).

### Maturity Stage Thresholds

| Stage | Proven Items | Description |
|-------|-------------|-------------|
| **Concept** | 0–4 | Idea stage, minimal evidence |
| **Early** | 5–8 | Some traction, foundational work underway |
| **Validated** | 9–13 | Core claims substantiated |
| **Scaling** | 14–17 | Strong evidence across most items |
| **Leader** | 18–20 | Comprehensive evidence, market-leading position |

Partial items count as 0.5 toward the proven count.

### Evidence Items

| # | Evidence Item | Maturity Gate | Semantic Search Query |
|---|--------------|---------------|----------------------|
| 1 | Business model described | Concept | \`we make money by charging customers for how we monetize revenue comes from\` |
| 2 | Pricing approach exists | Concept | \`price point is per month per seat per user we charge\` |
| 3 | Target customer willingness to pay validated | Concept | \`customers told us price is right willing to pay validated found price\` |
| 4 | Pricing tiers or packages defined | Early | \`plans are starter professional enterprise tiers pricing packages options\` |
| 5 | Gross margin calculated | Early | \`gross margin is percent cost to deliver service infrastructure\` |
| 6 | Cost structure documented | Early | \`our costs are fixed variable biggest expenses headcount infrastructure hosting\` |
| 7 | Revenue per customer tracked | Early | \`average revenue per customer per month ARPU average contract value\` |
| 8 | Customer lifetime value estimated | Validated | \`average customer stays years lifetime value calculated cohort analysis\` |
| 9 | LTV:CAC ratio above 3:1 | Validated | \`lifetime value is times what we spend to acquire payback period months\` |
| 10 | Gross margins above 60% | Validated | \`margins are percent healthy gross profit on each subscription SaaS\` |
| 11 | Pricing optimization tested | Validated | \`tested different price points at this price conversion improved customers responded\` |
| 12 | Path to profitability mapped | Validated | \`break even at MRR we reach profitability by quarter timeline\` |
| 13 | Contribution margin positive | Scaling | \`profitable on each customer after variable costs contribution positive\` |
| 14 | Operating leverage demonstrated | Scaling | \`revenue grew faster than costs this quarter efficiency ratio improving\` |
| 15 | Multi-product or upsell revenue | Scaling | \`customers buy add-ons upgrade to higher plan upsell cross-sell expansion\` |
| 16 | Pricing power demonstrated | Scaling | \`raised prices customers stayed didn't churn at higher price point\` |
| 17 | Working capital efficient | Scaling | \`customers pay upfront annual billing cash flow positive before delivering\` |
| 18 | EBITDA positive or near | Leader | \`close to break even nearly profitable operating margin positive\` |
| 19 | Business model proven at scale | Leader | \`economics hold as we scale proven across cohorts replicable\` |
| 20 | Best-in-class unit economics | Leader | \`our margins LTV CAC ratio better than industry average benchmark comparison\` |

### Maturity Stage Interpretation for Business Model & Economics
- **Concept** (0–4): Basic pricing idea, no validated economics
- **Early** (5–8): Pricing defined, gross margins known, tracking ARPU
- **Validated** (9–13): Healthy LTV:CAC, good margins, path to profitability mapped
- **Scaling** (14–17): Operating leverage, upsell working, pricing power proven
- **Leader** (18–20): Profitable or near, best-in-class economics, model proven at scale`,

  team_organization: `## Team & Organization — Evaluation Scorecard

Each evidence item is scored as: PROVEN (1 point), PARTIAL (0.5 points), or UNPROVEN (0 points).

### Maturity Stage Thresholds

| Stage | Proven Items | Description |
|-------|-------------|-------------|
| **Concept** | 0–4 | Idea stage, minimal evidence |
| **Early** | 5–8 | Some traction, foundational work underway |
| **Validated** | 9–13 | Core claims substantiated |
| **Scaling** | 14–17 | Strong evidence across most items |
| **Leader** | 18–20 | Comprehensive evidence, market-leading position |

Partial items count as 0.5 toward the proven count.

### Evidence Items

| # | Evidence Item | Maturity Gate | Semantic Search Query |
|---|--------------|---------------|----------------------|
| 1 | Founding team identified | Concept | \`the founders are I am cofounder my background previously worked at\` |
| 2 | Relevant domain expertise present | Concept | \`spent years in this industry worked at domain deep expertise insider\` |
| 3 | Technical capability on team | Concept | \`CTO cofounder engineer built previously technical background software\` |
| 4 | Full-time commitment from founders | Early | \`all full time left jobs dedicated working on this not nights and weekends\` |
| 5 | Core team of 3+ hired | Early | \`team of people hired employees full time staff working with us\` |
| 6 | Key roles filled (eng, product, sales) | Early | \`hired VP sales director of engineering product manager marketing lead head of\` |
| 7 | Compensation structure defined | Early | \`salary equity vesting cliff four year schedule options grant\` |
| 8 | Team has complementary skills | Validated | \`between us cover technical business domain sales I bring he brings\` |
| 9 | Prior startup or scaling experience | Validated | \`previously founded built scaled early employee at grew from to\` |
| 10 | Culture and values articulated | Validated | \`our values are company culture we believe in how we work together\` |
| 11 | Employee retention healthy | Validated | \`team has been here years average tenure no one has left people stay\` |
| 12 | Hiring pipeline active | Validated | \`actively hiring open roles candidates interviewing recruiting pipeline\` |
| 13 | Advisory board established | Scaling | \`advisors include former VP at connected to investor industry expert helps\` |
| 14 | Management layer in place | Scaling | \`VP of director of managers lead each function reports directly to\` |
| 15 | Organizational structure documented | Scaling | \`org chart reporting structure team organized by function departments\` |
| 16 | Succession planning for key roles | Scaling | \`if this person left backup can cover documented not dependent on one person\` |
| 17 | Remote/hybrid work processes | Scaling | \`team distributed remote offices hybrid async Slack documentation\` |
| 18 | Industry-recognized team | Leader | \`team from Google Facebook Stripe top company well known previously at notable\` |
| 19 | Team scaled past 50+ employees | Leader | \`grew from to fifty employees headcount scaling hiring rapidly organization\` |
| 20 | Board of directors active | Leader | \`board meets quarterly directors include independent board member governance\` |

### Maturity Stage Interpretation for Team & Organization
- **Concept** (0–4): Founders with an idea, minimal team
- **Early** (5–8): Core team hired, key roles filled, full-time commitment
- **Validated** (9–13): Complementary skills, healthy culture, active hiring
- **Scaling** (14–17): Management layer, advisory board, org structure
- **Leader** (18–20): Industry talent, 50+ employees, active board governance`,

  go_to_market: `## Go-to-Market — Evaluation Scorecard

Each evidence item is scored as: PROVEN (1 point), PARTIAL (0.5 points), or UNPROVEN (0 points).

### Maturity Stage Thresholds

| Stage | Proven Items | Description |
|-------|-------------|-------------|
| **Concept** | 0–4 | Idea stage, minimal evidence |
| **Early** | 5–8 | Some traction, foundational work underway |
| **Validated** | 9–13 | Core claims substantiated |
| **Scaling** | 14–17 | Strong evidence across most items |
| **Leader** | 18–20 | Comprehensive evidence, market-leading position |

Partial items count as 0.5 toward the proven count.

### Evidence Items

| # | Evidence Item | Maturity Gate | Semantic Search Query |
|---|--------------|---------------|----------------------|
| 1 | Target customer defined | Concept | \`ideal customer is company that has these problems decision maker is\` |
| 2 | Initial distribution channel identified | Concept | \`first customers came from started with direct outreach community network\` |
| 3 | First customers acquired manually | Concept | \`found first customers by reaching out personally cold outreach direct\` |
| 4 | Sales motion defined (PLG/sales-led/hybrid) | Early | \`sell through self-serve trial signup product led or direct sales outbound\` |
| 5 | Marketing website and materials exist | Early | \`website pricing page case studies testimonials content published\` |
| 6 | Lead generation active | Early | \`generating leads per month inbound outbound pipeline filling\` |
| 7 | Conversion funnel measured | Early | \`trial to paid conversion is percent demo close rate funnel\` |
| 8 | Customer acquisition repeatable | Validated | \`predictably acquire customers same process pipeline consistent\` |
| 9 | Sales cycle length known | Validated | \`average time to close is days weeks months from first contact to signature\` |
| 10 | Content or inbound marketing working | Validated | \`blog SEO organic traffic content thought leadership customers find us\` |
| 11 | Referral or word-of-mouth channel | Validated | \`customers tell others referred by existing customer came from word of mouth\` |
| 12 | Sales playbook documented | Validated | \`sales process documented objection handling how we run demos scripts\` |
| 13 | Multi-channel acquisition | Scaling | \`customers come from paid SEO events partnerships multiple sources\` |
| 14 | Enterprise sales process | Scaling | \`enterprise deals six figure procurement legal review security questionnaire\` |
| 15 | Partner or channel strategy | Scaling | \`partner with resellers distributors integration partners channel agreement\` |
| 16 | Brand awareness growing | Scaling | \`people recognize us heard of us market awareness name recognition growing\` |
| 17 | Demand generation at scale | Scaling | \`MQLs per month pipeline volume programs running generating demand\` |
| 18 | Market category ownership | Leader | \`when people think of this problem they think of us category leader\` |
| 19 | Self-sustaining growth engine | Leader | \`growth compounds each cohort brings others flywheel growing without spending\` |
| 20 | International GTM execution | Leader | \`launched in UK Europe international team hiring local market sales\` |

### Maturity Stage Interpretation for Go-to-Market
- **Concept** (0–4): Target customer identified, first manual sales
- **Early** (5–8): Sales motion defined, website up, leads coming in
- **Validated** (9–13): Repeatable acquisition, known sales cycle, playbook documented
- **Scaling** (14–17): Multi-channel, enterprise sales, partner strategy
- **Leader** (18–20): Category ownership, self-sustaining growth, international`,

  financial_health: `## Financial Health — Evaluation Scorecard

Each evidence item is scored as: PROVEN (1 point), PARTIAL (0.5 points), or UNPROVEN (0 points).

### Maturity Stage Thresholds

| Stage | Proven Items | Description |
|-------|-------------|-------------|
| **Concept** | 0–4 | Idea stage, minimal evidence |
| **Early** | 5–8 | Some traction, foundational work underway |
| **Validated** | 9–13 | Core claims substantiated |
| **Scaling** | 14–17 | Strong evidence across most items |
| **Leader** | 18–20 | Comprehensive evidence, market-leading position |

Partial items count as 0.5 toward the proven count.

### Evidence Items

| # | Evidence Item | Maturity Gate | Semantic Search Query |
|---|--------------|---------------|----------------------|
| 1 | Basic financial records exist | Concept | \`bookkeeping accounting QuickBooks Xero financial records tracked transactions\` |
| 2 | Burn rate known | Concept | \`spending per month burn rate monthly cash out going\` |
| 3 | Revenue tracked | Concept | \`invoices receipts payment revenue coming in dollars per month tracking\` |
| 4 | Monthly financial reporting | Early | \`P&L income statement balance sheet monthly report reviewed\` |
| 5 | Runway calculated | Early | \`have months of cash remaining at current burn will last until\` |
| 6 | Budget exists | Early | \`allocated budget headcount plan spend this year next quarter approved\` |
| 7 | Revenue vs expenses tracked | Early | \`revenue covers percent of our expenses burn ratio improving\` |
| 8 | 12+ months runway | Validated | \`twelve months runway cash will last through comfortable position funded\` |
| 9 | Cash flow forecast exists | Validated | \`modeled cash flow projected inflows outflows over next months model\` |
| 10 | Financial projections (3-year) | Validated | \`three year financial model revenue projections expenses assumptions forecast\` |
| 11 | Revenue covering >30% of expenses | Validated | \`revenue covers third of our burn expenses percentage of spend\` |
| 12 | Burn rate declining or stable | Validated | \`burn came down reduced costs efficiency spending less than before\` |
| 13 | 18+ months runway | Scaling | \`eighteen months comfortable runway raised enough will last through milestone\` |
| 14 | Detailed unit economics tracked | Scaling | \`per customer cost to serve margin after delivery unit economics\` |
| 15 | Revenue growth outpacing expense growth | Scaling | \`revenue growing faster than costs ratio improving efficiency gain\` |
| 16 | Financial controls and auditing | Scaling | \`audit completed reviewed by accounting firm financial controls process\` |
| 17 | Treasury management | Scaling | \`cash in treasury short term yield banking relationship managing reserves\` |
| 18 | Near break-even or profitable | Leader | \`close to breaking even a few months away nearly profitable positive\` |
| 19 | Financial operations scaled | Leader | \`CFO controller FP&A finance team running numbers reporting\` |
| 20 | Capital efficient growth demonstrated | Leader | \`grew revenue efficiently low burn multiple capital efficient ratio\` |

### Maturity Stage Interpretation for Financial Health
- **Concept** (0–4): Basic tracking, knows burn rate
- **Early** (5–8): Monthly reporting, runway calculated, budget in place
- **Validated** (9–13): 12+ months runway, forecasts exist, revenue growing
- **Scaling** (14–17): 18+ months runway, financial controls, operating leverage
- **Leader** (18–20): Near profitable, scaled finance ops, capital efficient`,

  fundraising_capital: `## Fundraising & Capital — Evaluation Scorecard

Each evidence item is scored as: PROVEN (1 point), PARTIAL (0.5 points), or UNPROVEN (0 points).

### Maturity Stage Thresholds

| Stage | Proven Items | Description |
|-------|-------------|-------------|
| **Concept** | 0–4 | Idea stage, minimal evidence |
| **Early** | 5–8 | Some traction, foundational work underway |
| **Validated** | 9–13 | Core claims substantiated |
| **Scaling** | 14–17 | Strong evidence across most items |
| **Leader** | 18–20 | Comprehensive evidence, market-leading position |

Partial items count as 0.5 toward the proven count.

### Evidence Items

| # | Evidence Item | Maturity Gate | Semantic Search Query |
|---|--------------|---------------|----------------------|
| 1 | Funding need articulated | Concept | \`raising million need capital to hire expand build grow\` |
| 2 | Use of funds defined | Concept | \`will use the money for spending on hiring product sales market\` |
| 3 | Pitch materials exist | Concept | \`deck presentation investor materials prepared slides ready to share\` |
| 4 | Pre-seed or seed raised | Early | \`raised million from closed seed round pre-seed funding investors backed\` |
| 5 | Cap table clean | Early | \`founders own percent investors own option pool percent shares outstanding\` |
| 6 | Investor relationships initiated | Early | \`introduced to VC been meeting with investors warm intro through\` |
| 7 | Valuation benchmark understood | Early | \`comparable companies valued at our valuation based on revenue multiple\` |
| 8 | Lead investor secured (or lined up) | Validated | \`lead investor committed signed term sheet leading the round\` |
| 9 | Due diligence ready | Validated | \`data room prepared documents organized financial records contracts ready\` |
| 10 | Target round size and valuation set | Validated | \`raising at valuation this round post-money pre-money target\` |
| 11 | Warm introductions to multiple funds | Validated | \`introductions to multiple VCs warm intro through portfolio friend\` |
| 12 | Prior round terms clean | Validated | \`previous investors standard terms no unusual provisions clean simple\` |
| 13 | Series A+ raised or in process | Scaling | \`Series A closed institutional investor led the round raised\` |
| 14 | Multiple funding options available | Scaling | \`venture debt SBIR grant revenue financing in addition to equity\` |
| 15 | Investor update cadence established | Scaling | \`send monthly update to investors quarterly report keeping informed\` |
| 16 | Board governance structured | Scaling | \`board seat observer rights quarterly meeting agenda minutes\` |
| 17 | Secondary or strategic capital access | Scaling | \`strategic investor corporate venture arm secondary sale option\` |
| 18 | Growth round raised | Leader | \`Series B C growth capital raised institutional scaling round closed\` |
| 19 | Strong investor brand association | Leader | \`Sequoia Andreessen Y Combinator top tier investor backed portfolio\` |
| 20 | Capital markets optionality (IPO/M&A) | Leader | \`thinking about IPO acquisition conversations exit options preparing readiness\` |

### Maturity Stage Interpretation for Fundraising & Capital
- **Concept** (0–4): Knows funding need, pitch deck exists
- **Early** (5–8): Seed raised, cap table clean, investor network started
- **Validated** (9–13): Lead investor engaged, due diligence ready, target set
- **Scaling** (14–17): Institutional round, board governance, multiple capital options
- **Leader** (18–20): Growth rounds complete, top investors, exit optionality`,

  competitive_position: `## Competitive Position — Evaluation Scorecard

Each evidence item is scored as: PROVEN (1 point), PARTIAL (0.5 points), or UNPROVEN (0 points).

### Maturity Stage Thresholds

| Stage | Proven Items | Description |
|-------|-------------|-------------|
| **Concept** | 0–4 | Idea stage, minimal evidence |
| **Early** | 5–8 | Some traction, foundational work underway |
| **Validated** | 9–13 | Core claims substantiated |
| **Scaling** | 14–17 | Strong evidence across most items |
| **Leader** | 18–20 | Comprehensive evidence, market-leading position |

Partial items count as 0.5 toward the proven count.

### Evidence Items

| # | Evidence Item | Maturity Gate | Semantic Search Query |
|---|--------------|---------------|----------------------|
| 1 | Competitors identified | Concept | \`our competitors are alternatives customers compare us to others in space\` |
| 2 | Differentiation articulated | Concept | \`unlike X we do Y we are different because unique approach compared to\` |
| 3 | Basic competitive awareness | Concept | \`we know the landscape what else is out there alternatives exist\` |
| 4 | Competitive matrix documented | Early | \`comparison versus competitors we win on feature price service\` |
| 5 | Unique value proposition clear | Early | \`what makes us different is why customers choose us specifically\` |
| 6 | Customer preference signals | Early | \`customers chose us over X because they said prefer us win deals against\` |
| 7 | Switching costs understood | Early | \`customers integrate deeply to migrate would have to customers locked in stay\` |
| 8 | Technical moat identified | Validated | \`proprietary algorithm took years to build technical advantage hard to copy\` |
| 9 | Win/loss analysis conducted | Validated | \`we win against X when we lose to Y because deals closed against\` |
| 10 | Market positioning defined | Validated | \`we position as we are known for category we own perceived as\` |
| 11 | Barrier to entry assessed | Validated | \`hard to replicate because took years data network relationships built up\` |
| 12 | First-mover or fast-follower advantage | Validated | \`we were first earliest in market ahead timing advantage launched before\` |
| 13 | Sustainable competitive advantage demonstrated | Scaling | \`advantage grows over time harder to compete as we scale compounds\` |
| 14 | Network effects or data advantages | Scaling | \`more users makes it better each adds value data improves with scale\` |
| 15 | Brand as competitive advantage | Scaling | \`customers trust our name brand association recognized trusted reputation\` |
| 16 | Pricing power vs competitors | Scaling | \`charge more than alternatives customers pay premium we command higher\` |
| 17 | Competitive intelligence process | Scaling | \`we monitor competitors track what they release watch market moves\` |
| 18 | Category defining company | Leader | \`we created this category set the standard defined what it means\` |
| 19 | Multiple defensible moats | Leader | \`combination of technology data network brand all working together\` |
| 20 | Competitors benchmark against you | Leader | \`competitors mention us in their marketing compare themselves to us reference\` |

### Maturity Stage Interpretation for Competitive Position
- **Concept** (0–4): Knows competitors exist, basic differentiation idea
- **Early** (5–8): Competitive matrix, clear UVP, some customer preference
- **Validated** (9–13): Technical moat, market positioning, win/loss data
- **Scaling** (14–17): Sustainable advantage, network effects, pricing power
- **Leader** (18–20): Category definer, multiple moats, competitors benchmark against you`,

  operations: `## Operations — Evaluation Scorecard

Each evidence item is scored as: PROVEN (1 point), PARTIAL (0.5 points), or UNPROVEN (0 points).

### Maturity Stage Thresholds

| Stage | Proven Items | Description |
|-------|-------------|-------------|
| **Concept** | 0–4 | Idea stage, minimal evidence |
| **Early** | 5–8 | Some traction, foundational work underway |
| **Validated** | 9–13 | Core claims substantiated |
| **Scaling** | 14–17 | Strong evidence across most items |
| **Leader** | 18–20 | Comprehensive evidence, market-leading position |

Partial items count as 0.5 toward the proven count.

### Evidence Items

| # | Evidence Item | Maturity Gate | Semantic Search Query |
|---|--------------|---------------|----------------------|
| 1 | Basic tools and infrastructure in place | Concept | \`we use Slack Notion Jira Linear AWS tools set up running\` |
| 2 | Communication processes exist | Concept | \`daily standup weekly team meeting sync how we communicate process\` |
| 3 | Project management approach | Concept | \`track in Jira Linear sprints backlog priority planning tickets\` |
| 4 | Development process defined | Early | \`agile two-week sprints pull request review merge deploy process\` |
| 5 | Customer support exists | Early | \`support team responds tickets email chat Intercom help desk response time\` |
| 6 | Uptime and reliability tracked | Early | \`uptime percent availability monitored status page SLA\` |
| 7 | Incident response process | Early | \`when outage happens on-call runbook escalate post-mortem review\` |
| 8 | SLA commitments defined | Validated | \`we commit to uptime response time SLA guarantee enterprise contract\` |
| 9 | Vendor management in place | Validated | \`vendors suppliers contracts procurement negotiate manage relationships\` |
| 10 | Quality assurance process | Validated | \`QA testing before release review checklist bug tracking regression\` |
| 11 | Documentation maintained | Validated | \`internal docs wiki Notion Confluence knowledge base written updated\` |
| 12 | Onboarding process for employees | Validated | \`new hire first week checklist training onboarding ramp up process\` |
| 13 | Business continuity plan | Scaling | \`if X fails backup plan redundancy disaster recovery we would\` |
| 14 | Compliance frameworks adopted | Scaling | \`SOC2 ISO 27001 GDPR HIPAA compliance process working toward certification\` |
| 15 | Operational metrics dashboarded | Scaling | \`dashboard KPIs tracked visible to team operations metrics reviewed\` |
| 16 | Support scaling plan | Scaling | \`support team grew customers to agent ratio tickets handled per person\` |
| 17 | Automation of repetitive processes | Scaling | \`automated scripts workflows eliminated manual repetitive saved time\` |
| 18 | World-class operational efficiency | Leader | \`operations running smoothly efficient team doing more with less\` |
| 19 | 99.9%+ uptime demonstrated | Leader | \`system has been up nine nines availability demonstrated track record\` |
| 20 | Operational playbooks for all key functions | Leader | \`runbooks written step by step documented procedures playbook\` |

### Maturity Stage Interpretation for Operations
- **Concept** (0–4): Basic tools, ad-hoc processes
- **Early** (5–8): Dev process defined, support exists, uptime tracked
- **Validated** (9–13): SLAs, vendor management, QA, documentation
- **Scaling** (14–17): BCP, compliance, dashboards, automation
- **Leader** (18–20): Operational excellence, 99.9%+ uptime, playbooks for everything`,

  legal_compliance: `## Legal & Compliance — Evaluation Scorecard

Each evidence item is scored as: PROVEN (1 point), PARTIAL (0.5 points), or UNPROVEN (0 points).

### Maturity Stage Thresholds

| Stage | Proven Items | Description |
|-------|-------------|-------------|
| **Concept** | 0–4 | Idea stage, minimal evidence |
| **Early** | 5–8 | Some traction, foundational work underway |
| **Validated** | 9–13 | Core claims substantiated |
| **Scaling** | 14–17 | Strong evidence across most items |
| **Leader** | 18–20 | Comprehensive evidence, market-leading position |

Partial items count as 0.5 toward the proven count.

### Evidence Items

| # | Evidence Item | Maturity Gate | Semantic Search Query |
|---|--------------|---------------|----------------------|
| 1 | Company incorporated | Concept | \`incorporated in Delaware C-corp LLC entity structure formation registered\` |
| 2 | Founder agreements signed | Concept | \`founder agreement equity split vesting schedule signed between cofounders\` |
| 3 | Basic terms of service exist | Concept | \`terms of service privacy policy website legal pages published\` |
| 4 | Employment agreements in place | Early | \`offer letters employment contracts signed all employees have agreements\` |
| 5 | Contractor agreements standardized | Early | \`contractor NDA independent contractor agreement consultant signed\` |
| 6 | IP assignment agreements signed | Early | \`employees assigned IP work product invention assignment signed over\` |
| 7 | Privacy policy published | Early | \`privacy policy data collection handling published GDPR compliant\` |
| 8 | Cap table properly maintained | Validated | \`founders own percent investors own option pool outstanding shares breakdown\` |
| 9 | Data handling compliant (GDPR/CCPA) | Validated | \`GDPR CCPA data privacy user data handling processing compliant\` |
| 10 | Customer contracts standardized | Validated | \`standard MSA SaaS agreement template all customers sign same contract\` |
| 11 | Insurance coverage in place | Validated | \`D&O liability insurance E&O errors omissions policy coverage\` |
| 12 | Regulatory requirements mapped | Validated | \`regulations in our industry we must comply with identified mapped\` |
| 13 | IP portfolio documented | Scaling | \`patents filed trademarks registered trade secrets listed documented\` |
| 14 | SOC2 or equivalent compliance | Scaling | \`SOC2 Type II report audit passed security certified compliance\` |
| 15 | International legal framework | Scaling | \`operating in multiple countries EU UK legal entities set up cross-border\` |
| 16 | Legal counsel retained | Scaling | \`working with law firm attorney outside counsel represents us legal\` |
| 17 | Shareholder agreement comprehensive | Scaling | \`investor rights agreement voting rights pro-rata information rights\` |
| 18 | Full regulatory compliance demonstrated | Leader | \`passed regulatory audit approved certified by authority compliance demonstrated\` |
| 19 | Patent portfolio active | Leader | \`patents granted pending filed portfolio growing protection IP claims\` |
| 20 | Legal readiness for exit (M&A/IPO) | Leader | \`data room organized diligence ready documents clean exit preparation\` |

### Maturity Stage Interpretation for Legal & Compliance
- **Concept** (0–4): Incorporated, basic agreements
- **Early** (5–8): Employment/contractor/IP agreements, privacy policy
- **Validated** (9–13): Data compliance, standardized contracts, insurance
- **Scaling** (14–17): IP portfolio, SOC2, international framework, legal counsel
- **Leader** (18–20): Full regulatory compliance, active patents, exit-ready`,
};

// ---------------------------------------------------------------------------
// System prompt template
// ---------------------------------------------------------------------------

const EVAL_SYSTEM_TEMPLATE = `You are evaluating a startup across the dimension: {{CATEGORY_TITLE}}.

## Scoring Methodology

Score each of the 20 evidence items below as:
- **PROVEN** (1.0) — Clear, specific evidence provided
- **PARTIAL** (0.5) — Some evidence but incomplete or vague
- **UNPROVEN** (0.0) — No evidence found

## Step 1a: Initial Scoring
Score each item based on the provided context.

## Step 1b: Maturity Inference
After initial scoring, check for maturity inference:
- If a PROVEN item is 2+ maturity gates above an UNPROVEN item → upgrade UNPROVEN to PROVEN
- If a PROVEN item is exactly 1 gate above an UNPROVEN item → upgrade UNPROVEN to PARTIAL
- Only PROVEN items trigger inference; only UNPROVEN items get promoted

Gate levels: Concept=1, Early=2, Validated=3, Scaling=4, Leader=5

Rules:
- Only PROVEN items (not PARTIAL) at higher gates trigger inference
- Only UNPROVEN items at lower gates are affected — items already PARTIAL or PROVEN stay as-is
- Inference only flows downward (higher gate → lower gates), never upward
- Examples:
  - Item #15 (Scaling, level 4) is PROVEN → UNPROVEN Concept items (level 1, gap=3) become PROVEN; UNPROVEN Early items (level 2, gap=2) become PROVEN; UNPROVEN Validated items (level 3, gap=1) become PARTIAL
  - Item #8 (Validated, level 3) is PROVEN → UNPROVEN Concept items (level 1, gap=2) become PROVEN; UNPROVEN Early items (level 2, gap=1) become PARTIAL

## Step 2: Calculate Completeness
completeness = (sum of all scores / 20) * 100

## Step 3: Derive Status
- completeness >= 70 → "complete"
- completeness >= 40 → "needs_attention"
- completeness < 40 → "incomplete"

## Step 4: Determine Maturity Stage
Based on which maturity gates have the most PROVEN items.

## Step 5: Identify Gaps (max 5)
Only include UNPROVEN/PARTIAL items at:
- Current maturity gate (type: "table_stakes")
- Next gate up (type: "stretch")
Exclude inferred items from gap recommendations.

## Step 6: Build Output
Respond with ONLY valid JSON matching the required schema. No markdown fences, no explanation.

## Evidence Scorecard
{{SCORECARD}}`;

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

/**
 * Build system + user messages for a single evaluation category.
 * @param {string} categoryId - One of the 10 evaluation category IDs
 * @param {string} context - Pre-retrieved context for this category
 * @returns {{ system: string, user: string }}
 */
export function buildEvalPrompt(categoryId, context) {
  const scorecard = EVALUATION_SCORECARDS[categoryId];
  const title = CATEGORY_TITLES[categoryId];

  if (!scorecard || !title) {
    throw new Error(`Unknown evaluation category: '${categoryId}'`);
  }

  const system = EVAL_SYSTEM_TEMPLATE.replace('{{CATEGORY_TITLE}}', title).replace('{{SCORECARD}}', scorecard);

  const user = `## Available Information\n\n${context}`;

  return { system, user };
}
