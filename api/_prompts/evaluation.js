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
        status: z.enum(['PROVEN', 'PARTIAL', 'UNPROVEN', 'NOT_APPLICABLE']),
      })
    ),
    provenCount: z.number(),
    partialCount: z.number(),
    unprovenCount: z.number(),
    notApplicableCount: z.number(),
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
  product_technology: `## Product, Service & Delivery — Evaluation Scorecard

Each evidence item is scored as: PROVEN (1 point), PARTIAL (0.5 points), UNPROVEN (0 points), or NOT_APPLICABLE (excluded from scoring).

### Maturity Stage Thresholds

| Stage | Proven Items (of applicable) | Description |
|-------|-------------|-------------|
| **Concept** | 0–4 | Defined offering, minimal validation |
| **Early** | 5–8 | Working offering with initial customers, foundational processes |
| **Validated** | 9–13 | Customers getting measurable value, scalable delivery, quality controls |
| **Scaling** | 14–17 | Certified, proprietary advantage, partner-ready, data-driven delivery |
| **Leader** | 18–20 | Industry-recognised excellence, active innovation pipeline |

Partial items count as 0.5 toward the proven count.

### Evidence Items

| # | Evidence Item | Maturity Gate | Example Evidence |
|---|--------------|---------------|-----------------|
| 1 | Working product or service exists | Concept | \`offering is live customers can access use buy it here is how it works\` |
| 2 | Core problem clearly defined | Concept | \`the problem we solve before we existed people had to struggle with\` |
| 3 | Target customer or beneficiary identified | Concept | \`our customers are we built this for they typically need we serve\` |
| 4 | Core operational systems or processes documented | Early | \`how we deliver service operational process tools systems we use run\` |
| 5 | Offering used by real customers or clients | Early | \`active customers clients using our service buying product engaged\` |
| 6 | Core functionality or service scope complete | Early | \`key features services we deliver what it includes shipped built\` |
| 7 | Customer or user feedback collected systematically | Early | \`feedback collected customers told us satisfaction surveyed heard from\` |
| 8 | Offering delivers measurable outcomes for customers | Validated | \`customers went from to saved reduced improved results after using us\` |
| 9 | Product or service-market fit signals present | Validated | \`customers return unprompted refer others organic retention loyalty\` |
| 10 | Delivery capacity can scale with demand | Validated | \`handled increased volume demand without breakdown scalable capacity\` |
| 11 | Delivery cadence is sustainable and predictable | Validated | \`we deliver consistently reliable output repeatable process cadence\` |
| 12 | Quality control processes in place | Validated | \`quality standards review before delivery how we ensure consistency\` |
| 13 | Relevant compliance or quality certifications obtained | Scaling | \`certified compliant certification obtained industry standard requirement met\` |
| 14 | Proprietary methodology, IP or competitive advantage documented | Scaling | \`proprietary approach method we own unique process advantage hard to replicate\` |
| 15 | Offering integrates with or supports external partners | Scaling | \`partners third parties integrate with use build on our offering\` |
| 16 | Operational data drives decisions | Scaling | \`data we collect informs decisions metrics tracked analytics operational\` |
| 17 | Consistent quality across all delivery channels or locations | Scaling | \`same standard multiple channels locations consistent delivery quality\` |
| 18 | Roadmap or development driven by data and customer evidence | Leader | \`data showed we prioritised decisions informed by evidence customer signals\` |
| 19 | Industry-recognised for quality, innovation or excellence | Leader | \`award recognised top ranked best known for excellence benchmark\` |
| 20 | Active innovation pipeline with next-generation offerings | Leader | \`building next innovation new capabilities exploring future development\` |

### Maturity Stage Interpretation for Product, Service & Delivery
- **Concept** (0–4): Has a defined offering concept with limited validation
- **Early** (5–8): Working offering with initial customers, core processes in place
- **Validated** (9–13): Customers getting measurable value, scalable delivery, quality controls
- **Scaling** (14–17): Certified, proprietary advantage, partner ecosystem, data-driven
- **Leader** (18–20): Industry-recognised, active innovation, comprehensive operational excellence`,

  market_traction: `## Market Traction & Revenue — Evaluation Scorecard

Each evidence item is scored as: PROVEN (1 point), PARTIAL (0.5 points), UNPROVEN (0 points), or NOT_APPLICABLE (excluded from scoring).

### Maturity Stage Thresholds

| Stage | Proven Items (of applicable) | Description |
|-------|-------------|-------------|
| **Concept** | 0–4 | Idea stage, minimal evidence |
| **Early** | 5–8 | First customers, initial revenue, basic acquisition |
| **Validated** | 9–13 | Growing revenue, known economics, repeatable acquisition |
| **Scaling** | 14–17 | Multi-channel, positive unit economics, predictable revenue |
| **Leader** | 18–20 | Market leader, revenue at scale, organic growth flywheel |

Partial items count as 0.5 toward the proven count.

### Evidence Items

| # | Evidence Item | Maturity Gate | Example Evidence |
|---|--------------|---------------|-----------------|
| 1 | Target market identified | Concept | \`market we serve segment we focus on type of customer we go after\` |
| 2 | Value proposition articulated | Concept | \`unlike alternatives we offer reason customers choose us different because\` |
| 3 | First paying customer or revenue event | Concept | \`first sale closed customer paid initial revenue first contract signed\` |
| 4 | Revenue model defined | Early | \`how we charge revenue comes from pricing fees per transaction model\` |
| 5 | Recurring or predictable revenue established | Early | \`recurring regular predictable revenue customers subscribe fees repeat orders\` |
| 6 | Customer acquisition channel identified | Early | \`how we find customers most come from main channel outreach network\` |
| 7 | Customer retention measured | Early | \`customers return stay renew repeat low churn retention measured\` |
| 8 | Revenue growth rate documented | Validated | \`grew percent revenue doubled growth rate year over year quarter\` |
| 9 | Revenue expands from existing customers | Validated | \`existing customers spend more additional services expanded revenue upsell\` |
| 10 | Customer acquisition cost understood | Validated | \`costs us to acquire new customer spend per client acquisition cost\` |
| 11 | Total addressable market sized | Validated | \`market is worth billion opportunity size segment we address\` |
| 12 | Repeatable customer acquisition process exists | Validated | \`pipeline stages close predictable consistent process acquisition repeatable\` |
| 13 | Multiple revenue streams active | Scaling | \`additional revenue streams fees services alongside core revenue income\` |
| 14 | Unit economics positive | Scaling | \`margin per customer profitable positive return economics unit\` |
| 15 | Market share measured or estimated | Scaling | \`we have share of market one of top players position estimate\` |
| 16 | Revenue from multiple markets or geographies | Scaling | \`customers in multiple countries regions markets international revenue\` |
| 17 | Revenue predictability demonstrated | Scaling | \`can forecast revenue contracts forward visibility predictable accuracy\` |
| 18 | Category leader or market recognition | Leader | \`leading top recognised go-to known for this category leader position\` |
| 19 | Revenue at significant scale (>$1M annual) | Leader | \`annual revenue million total revenue significant milestone scale reached\` |
| 20 | Organic growth engine working | Leader | \`customers find us without paid marketing word of mouth referral organic\` |

### Maturity Stage Interpretation for Market Traction & Revenue
- **Concept** (0–4): Target market identified but minimal revenue
- **Early** (5–8): First customers, initial recurring revenue, basic acquisition channel
- **Validated** (9–13): Growing revenue, known unit economics, repeatable acquisition
- **Scaling** (14–17): Multi-market, positive economics, predictable revenue
- **Leader** (18–20): Market leader, significant revenue, organic growth flywheel`,

  business_model: `## Business Model & Economics — Evaluation Scorecard

Each evidence item is scored as: PROVEN (1 point), PARTIAL (0.5 points), UNPROVEN (0 points), or NOT_APPLICABLE (excluded from scoring).

### Maturity Stage Thresholds

| Stage | Proven Items (of applicable) | Description |
|-------|-------------|-------------|
| **Concept** | 0–4 | Basic monetisation idea, unvalidated |
| **Early** | 5–8 | Pricing defined, margins known, revenue per customer tracked |
| **Validated** | 9–13 | Healthy economics, path to profitability mapped |
| **Scaling** | 14–17 | Operating leverage, pricing power, working capital efficient |
| **Leader** | 18–20 | Profitable or near, best-in-class economics proven at scale |

Partial items count as 0.5 toward the proven count.

### Evidence Items

| # | Evidence Item | Maturity Gate | Example Evidence |
|---|--------------|---------------|-----------------|
| 1 | Business model described | Concept | \`we make money by charging how we monetise revenue comes from\` |
| 2 | Pricing or monetisation approach defined | Concept | \`price point is fee charge how we price model per unit\` |
| 3 | Customer willingness to pay validated | Concept | \`customers told us price is right willing to pay validated found\` |
| 4 | Pricing tiers, structures or packages defined | Early | \`plans tiers packages pricing options structures available\` |
| 5 | Gross margin calculated | Early | \`gross margin is percent cost to deliver service produce\` |
| 6 | Cost structure documented | Early | \`our costs are fixed variable biggest expenses headcount delivery\` |
| 7 | Revenue per customer or transaction tracked | Early | \`average revenue per customer transaction average contract value\` |
| 8 | Customer or transaction lifetime value estimated | Validated | \`average customer stays lifetime value calculated cohort analysis\` |
| 9 | Return on investment for customers documented | Validated | \`customers get return value multiple of what they pay invest payback\` |
| 10 | Gross margins healthy for the industry | Validated | \`margins healthy for sector above industry benchmark standard\` |
| 11 | Pricing approach tested or optimised | Validated | \`tested price points conversion improved customers responded optimised\` |
| 12 | Path to profitability mapped | Validated | \`break even at milestone reach profitability by quarter timeline\` |
| 13 | Contribution margin positive | Scaling | \`profitable on each customer unit after variable costs positive\` |
| 14 | Operating leverage demonstrated | Scaling | \`revenue grew faster than costs efficiency ratio improving leverage\` |
| 15 | Multi-product, upsell or ancillary revenue active | Scaling | \`customers buy additional offerings upgrade cross-sell ancillary income\` |
| 16 | Pricing power demonstrated | Scaling | \`raised prices customers stayed didn't churn at higher price\` |
| 17 | Working capital efficiently managed | Scaling | \`cash flow positive capital management efficient ahead of delivery\` |
| 18 | EBITDA positive or near break-even | Leader | \`close to break even nearly profitable operating margin positive\` |
| 19 | Business model proven at scale | Leader | \`economics hold at scale proven across cohorts replicable model\` |
| 20 | Best-in-class unit economics for the industry | Leader | \`margins economics better than industry average benchmark class\` |

### Maturity Stage Interpretation for Business Model & Economics
- **Concept** (0–4): Basic monetisation idea, willingness to pay unvalidated
- **Early** (5–8): Pricing defined, margins known, revenue per customer tracked
- **Validated** (9–13): Healthy economics, customer ROI documented, path to profitability
- **Scaling** (14–17): Operating leverage, ancillary revenue, pricing power, working capital
- **Leader** (18–20): Profitable or near, best-in-class economics, proven at scale`,

  team_organization: `## Team & Organisation — Evaluation Scorecard

Each evidence item is scored as: PROVEN (1 point), PARTIAL (0.5 points), UNPROVEN (0 points), or NOT_APPLICABLE (excluded from scoring).

### Maturity Stage Thresholds

| Stage | Proven Items (of applicable) | Description |
|-------|-------------|-------------|
| **Concept** | 0–4 | Leadership with idea, minimal team |
| **Early** | 5–8 | Core team in place, key roles filled, full-time commitment |
| **Validated** | 9–13 | Complementary skills, healthy culture, active talent pipeline |
| **Scaling** | 14–17 | Management layer, advisory board, documented org structure |
| **Leader** | 18–20 | Industry-recognised talent, large organisation, active board governance |

Partial items count as 0.5 toward the proven count.

### Evidence Items

| # | Evidence Item | Maturity Gate | Example Evidence |
|---|--------------|---------------|-----------------|
| 1 | Founding or leadership team identified | Concept | \`the founders leaders are my background previously worked at led\` |
| 2 | Relevant domain expertise present | Concept | \`years in this industry domain expertise worked at relevant background\` |
| 3 | Execution capability on the team | Concept | \`built run delivered operational experience executes well hands-on\` |
| 4 | Full-time commitment from founders or key leaders | Early | \`full time dedicated committed left jobs working on this\` |
| 5 | Core team of 3+ hired or contracted | Early | \`team of people hired full time staff partners working together\` |
| 6 | Key functional roles filled | Early | \`hired head of operations finance sales marketing delivery function\` |
| 7 | Compensation and incentive structure defined | Early | \`salary equity shares options how people are compensated incentives\` |
| 8 | Team has complementary skills | Validated | \`between us cover operational financial commercial domain I bring\` |
| 9 | Prior venture, operational or scaling experience | Validated | \`previously founded scaled built grew experience in role at\` |
| 10 | Culture and values articulated | Validated | \`our values culture we believe how we work together principles\` |
| 11 | Employee or team retention healthy | Validated | \`team has stayed average tenure low turnover people stay with us\` |
| 12 | Active talent pipeline | Validated | \`hiring roles open candidates interviewing growing team pipeline\` |
| 13 | Advisory board or external mentors established | Scaling | \`advisors include industry experts former leaders mentors helps with\` |
| 14 | Management layer in place | Scaling | \`managers directors heads of function reports lead each area\` |
| 15 | Organisational structure documented | Scaling | \`org chart reporting structure organised by function departments\` |
| 16 | Succession planning for key roles | Scaling | \`if this person left backup documented not dependent on one person\` |
| 17 | Distributed, multi-office or multi-country team processes | Scaling | \`team across countries offices distributed locations processes coordination\` |
| 18 | Industry-recognised team | Leader | \`team well-known respected recognised from notable backgrounds\` |
| 19 | Organisation scaled past 50+ staff or equivalent | Leader | \`grew to fifty staff headcount scaling hiring large organisation\` |
| 20 | Board of directors active | Leader | \`board meets directors include independent governance quarterly active\` |

### Maturity Stage Interpretation for Team & Organisation
- **Concept** (0–4): Leadership with an idea, minimal team
- **Early** (5–8): Core team hired, key roles filled, full-time commitment
- **Validated** (9–13): Complementary skills, healthy culture, talent pipeline
- **Scaling** (14–17): Management layer, advisory board, documented org structure
- **Leader** (18–20): Industry-recognised talent, large organisation, active board`,

  go_to_market: `## Go-to-Market — Evaluation Scorecard

Each evidence item is scored as: PROVEN (1 point), PARTIAL (0.5 points), UNPROVEN (0 points), or NOT_APPLICABLE (excluded from scoring).

### Maturity Stage Thresholds

| Stage | Proven Items (of applicable) | Description |
|-------|-------------|-------------|
| **Concept** | 0–4 | Target customer identified, first manual outreach |
| **Early** | 5–8 | Engagement motion defined, materials exist, leads coming in |
| **Validated** | 9–13 | Repeatable acquisition, known cycle, playbook documented |
| **Scaling** | 14–17 | Multi-channel, large deal process, partner strategy |
| **Leader** | 18–20 | Category ownership, self-sustaining growth, international execution |

Partial items count as 0.5 toward the proven count.

### Evidence Items

| # | Evidence Item | Maturity Gate | Example Evidence |
|---|--------------|---------------|-----------------|
| 1 | Target customer or investor clearly defined | Concept | \`ideal customer investor partner is type who has needs characteristics\` |
| 2 | Initial distribution or outreach channel identified | Concept | \`first customers found through network referral direct outreach community\` |
| 3 | First customers, clients or partners acquired | Concept | \`found first customers by reaching out personally signed first deal\` |
| 4 | Engagement or sales motion defined | Early | \`how we acquire engage sell process direct partnership inbound model\` |
| 5 | Marketing materials or public presence exist | Early | \`website materials case studies published presence testimonials content\` |
| 6 | Lead generation or deal flow active | Early | \`generating leads per period pipeline filling opportunities inbound outbound\` |
| 7 | Conversion or engagement funnel measured | Early | \`conversion rate close rate pipeline funnel stages tracked measured\` |
| 8 | Customer acquisition or deal closing is repeatable | Validated | \`predictably acquire close customers consistent process pipeline repeatable\` |
| 9 | Acquisition or engagement cycle length known | Validated | \`average time to close engage days weeks months first contact signed\` |
| 10 | Content, inbound or thought leadership working | Validated | \`blog organic content thought leadership customers find us inbound\` |
| 11 | Referral or word-of-mouth channel active | Validated | \`customers tell others referred by existing came from word of mouth\` |
| 12 | Sales or engagement playbook documented | Validated | \`process documented how we engage objections handling playbook scripts\` |
| 13 | Multi-channel acquisition or outreach | Scaling | \`customers come from multiple sources channels marketing events partners\` |
| 14 | Large deal or institutional engagement process | Scaling | \`large deals institutional formal process procurement significant contracts\` |
| 15 | Partner, reseller or distribution channel strategy | Scaling | \`partners distribution channel agreement resellers work with strategy\` |
| 16 | Brand awareness growing | Scaling | \`people recognise brand awareness growing name recognition market\` |
| 17 | Demand generation at scale | Scaling | \`pipeline volume large number leads opportunities at scale systematic\` |
| 18 | Market category ownership | Leader | \`when people think of this problem they think of us category leader\` |
| 19 | Self-sustaining growth engine | Leader | \`growth compounds flywheel each cohort brings others growing organically\` |
| 20 | International or multi-geography execution | Leader | \`operating multiple countries international markets global presence\` |

### Maturity Stage Interpretation for Go-to-Market
- **Concept** (0–4): Target customer identified, first manual outreach
- **Early** (5–8): Engagement motion defined, materials exist, leads coming in
- **Validated** (9–13): Repeatable acquisition, known cycle, playbook documented
- **Scaling** (14–17): Multi-channel, large deal process, partner strategy
- **Leader** (18–20): Category ownership, self-sustaining growth, international execution`,

  financial_health: `## Financial Health — Evaluation Scorecard

Each evidence item is scored as: PROVEN (1 point), PARTIAL (0.5 points), UNPROVEN (0 points), or NOT_APPLICABLE (excluded from scoring).

### Maturity Stage Thresholds

| Stage | Proven Items (of applicable) | Description |
|-------|-------------|-------------|
| **Concept** | 0–4 | Basic tracking, financial position roughly known |
| **Early** | 5–8 | Regular reporting, budget exists, cash position monitored |
| **Validated** | 9–13 | Forecasts built, adequate reserves, revenue covering significant costs |
| **Scaling** | 14–17 | Financial controls, operating leverage, disciplined treasury |
| **Leader** | 18–20 | Profitable or near, scaled finance function, capital-efficient |

Partial items count as 0.5 toward the proven count.

### Evidence Items

| # | Evidence Item | Maturity Gate | Example Evidence |
|---|--------------|---------------|-----------------|
| 1 | Basic financial records exist | Concept | \`bookkeeping accounting records transactions tracked financial system\` |
| 2 | Cash position or liquidity known | Concept | \`cash on hand balance bank accounts how much money we have\` |
| 3 | Revenue tracked | Concept | \`invoices payments income revenue tracked how much coming in period\` |
| 4 | Regular financial reporting | Early | \`P&L income statement balance sheet monthly report management accounts\` |
| 5 | Cash sustainability horizon known | Early | \`cash will last months funded through operations covers period\` |
| 6 | Budget or operating plan exists | Early | \`budget approved plan spend headcount costs next year quarter\` |
| 7 | Revenue-to-expense ratio tracked | Early | \`revenue covers percent expenses ratio burn improving self-funding\` |
| 8 | Adequate reserves for 12+ months | Validated | \`twelve months cash reserves funded comfortable position operations covered\` |
| 9 | Cash flow forecast exists | Validated | \`modeled cash flow projected inflows outflows over next months forecast\` |
| 10 | Multi-year financial projections | Validated | \`three year financial model revenue projections expenses assumptions forecast\` |
| 11 | Revenue growing year over year | Validated | \`revenue grew percent year on year growth rate quarter improving\` |
| 12 | Cost base stable or declining relative to revenue | Validated | \`costs stable declining as share of revenue efficiency improving ratio\` |
| 13 | Adequate reserves for 18+ months | Scaling | \`eighteen months covered well-funded comfortable reserves operating capital\` |
| 14 | Unit or per-activity economics tracked | Scaling | \`per unit cost to serve margin after delivery economics tracked measured\` |
| 15 | Revenue growth outpacing cost growth | Scaling | \`revenue growing faster than costs operating leverage ratio improving\` |
| 16 | Financial controls and independent audit | Scaling | \`audit completed accounting firm external review financial controls process\` |
| 17 | Treasury and capital management | Scaling | \`cash managed treasury yield banking relationships capital allocation reserves\` |
| 18 | Profitable or near break-even | Leader | \`profitable operating profit positive near break-even margin improving\` |
| 19 | Dedicated finance function | Leader | \`CFO finance director FP&A team controller reporting scaled finance\` |
| 20 | Capital-efficient growth demonstrated | Leader | \`grew revenue without proportional cost increase efficiency capital returns\` |

### Maturity Stage Interpretation for Financial Health
- **Concept** (0–4): Basic tracking, cash position roughly known
- **Early** (5–8): Regular reporting, cash horizon known, budget in place
- **Validated** (9–13): Adequate reserves, forecasts built, revenue growing
- **Scaling** (14–17): Financial controls, audit, operating leverage, treasury management
- **Leader** (18–20): Profitable or near, scaled finance function, capital-efficient growth`,

  fundraising_capital: `## Fundraising & Capital — Evaluation Scorecard

Each evidence item is scored as: PROVEN (1 point), PARTIAL (0.5 points), UNPROVEN (0 points), or NOT_APPLICABLE (excluded from scoring).

### Maturity Stage Thresholds

| Stage | Proven Items (of applicable) | Description |
|-------|-------------|-------------|
| **Concept** | 0–4 | Capital need identified, basic materials prepared |
| **Early** | 5–8 | Initial capital secured, ownership structure clean, relationships initiated |
| **Validated** | 9–13 | Credible capital partner engaged, due diligence ready |
| **Scaling** | 14–17 | Significant capital secured, governance structured, multiple options available |
| **Leader** | 18–20 | Large-scale capital raised, recognised backers, strategic optionality |

Partial items count as 0.5 toward the proven count.

### Evidence Items

| # | Evidence Item | Maturity Gate | Example Evidence |
|---|--------------|---------------|-----------------|
| 1 | Capital need articulated | Concept | \`need capital to expand hire build grow seeking investment funding\` |
| 2 | Use of capital defined | Concept | \`will use the money for allocation spending growth plan deployment\` |
| 3 | Investment or fundraising materials exist | Concept | \`deck presentation materials prepared investor brief slides ready to share\` |
| 4 | Initial external capital secured | Early | \`raised from investors closed round secured funding backed by capital in\` |
| 5 | Ownership or capital structure clean | Early | \`ownership structure clear founders hold investors hold cap table clean\` |
| 6 | Capital partner or investor relationships initiated | Early | \`meeting with investors lenders introduced to funds relationships started\` |
| 7 | Valuation or transaction benchmarks understood | Early | \`comparable companies valued similar transactions revenue multiple benchmark\` |
| 8 | Lead investor, lender or anchor partner engaged | Validated | \`lead investor committed term sheet signed anchor partner engaged\` |
| 9 | Due diligence materials prepared | Validated | \`data room prepared documents organised financial records contracts ready\` |
| 10 | Target raise and terms defined | Validated | \`raising target amount at these terms valuation size timeline set\` |
| 11 | Multiple credible capital sources in process | Validated | \`multiple investors lenders in parallel conversations introductions active\` |
| 12 | Prior round or capital terms standard | Validated | \`previous capital standard terms no unusual provisions clean simple\` |
| 13 | Significant institutional or formal capital raised | Scaling | \`institutional investor led closed formal round significant capital raised\` |
| 14 | Multiple capital types available | Scaling | \`equity debt grants revenue-based financing multiple capital sources options\` |
| 15 | Capital partner update cadence established | Scaling | \`send monthly quarterly updates to investors lenders keeping informed\` |
| 16 | Board or governance structure formalised | Scaling | \`board seat governance rights quarterly meeting agenda minutes formal\` |
| 17 | Strategic or co-investment capital available | Scaling | \`strategic partner corporate investor co-investor secondary access option\` |
| 18 | Large-scale or growth capital raised | Leader | \`growth capital raised large round scaling capital institutional closed\` |
| 19 | Backed by recognised, credible investors or lenders | Leader | \`backed by well-known investors development finance institution recognised fund\` |
| 20 | Strategic capital optionality (exit, merger, listing) | Leader | \`exit options conversations acquisition merger listing readiness preparing\` |

### Maturity Stage Interpretation for Fundraising & Capital
- **Concept** (0–4): Capital need known, materials exist
- **Early** (5–8): Initial capital secured, structure clean, relationships started
- **Validated** (9–13): Credible partner engaged, due diligence ready, terms defined
- **Scaling** (14–17): Significant capital raised, governance formalised, multiple capital types
- **Leader** (18–20): Large-scale capital, recognised backers, strategic optionality`,

  competitive_position: `## Competitive Position — Evaluation Scorecard

Each evidence item is scored as: PROVEN (1 point), PARTIAL (0.5 points), UNPROVEN (0 points), or NOT_APPLICABLE (excluded from scoring).

### Maturity Stage Thresholds

| Stage | Proven Items (of applicable) | Description |
|-------|-------------|-------------|
| **Concept** | 0–4 | Competitors known, basic differentiation articulated |
| **Early** | 5–8 | Clear UVP, documented comparison, customer preference signals |
| **Validated** | 9–13 | Defensible moat identified, market positioning clear, win/loss known |
| **Scaling** | 14–17 | Advantage compounding, pricing power, strategic intelligence |
| **Leader** | 18–20 | Category definer, multiple interlocking moats |

Partial items count as 0.5 toward the proven count.

### Evidence Items

| # | Evidence Item | Maturity Gate | Example Evidence |
|---|--------------|---------------|-----------------|
| 1 | Competitors or alternatives identified | Concept | \`competitors are alternatives customers compare us to others in space\` |
| 2 | Differentiation articulated | Concept | \`unlike X we do Y different because unique approach compared to others\` |
| 3 | Competitive landscape understood | Concept | \`we know the landscape who else does this alternatives exist we track\` |
| 4 | Competitive comparison documented | Early | \`comparison versus competitors we win on price quality service speed\` |
| 5 | Unique value proposition clear | Early | \`what makes us different why customers choose us specifically over others\` |
| 6 | Customer preference signals present | Early | \`customers chose us over X because said prefer us win against\` |
| 7 | Switching costs or lock-in factors understood | Early | \`customers stay because switching is hard relationships data integration dependency\` |
| 8 | Defensible competitive advantage identified | Validated | \`advantage that took time to build hard to replicate proprietary position\` |
| 9 | Win/loss or competitive outcome analysis | Validated | \`we win when we lose when because against these competitors\` |
| 10 | Market positioning defined | Validated | \`we position as known for category own perceived as the go-to\` |
| 11 | Barrier to entry for new entrants | Validated | \`hard to replicate because relationships scale capital access time required\` |
| 12 | First-mover, experience or scale advantage | Validated | \`first in market ahead timing advantage launched earliest scale relationships built\` |
| 13 | Competitive advantage compounds with scale | Scaling | \`advantage grows over time harder to compete as we grow compounds\` |
| 14 | Network effects, data, or supply chain control | Scaling | \`more customers makes it better supply chain locked data improves scale\` |
| 15 | Brand or reputation as competitive advantage | Scaling | \`customers trust our name brand reputation recognised trusted track record\` |
| 16 | Pricing power relative to alternatives | Scaling | \`charge more than alternatives customers pay premium command higher price\` |
| 17 | Competitive intelligence process in place | Scaling | \`monitor competitors track what they do watch market moves intelligence\` |
| 18 | Category or segment defining position | Leader | \`created category set the standard defined what it means in this space\` |
| 19 | Multiple interlocking competitive moats | Leader | \`combination of advantages technology data brand relationships all compound\` |
| 20 | Competitors benchmark themselves against you | Leader | \`competitors mention us compare themselves to us reference our standards\` |

### Maturity Stage Interpretation for Competitive Position
- **Concept** (0–4): Competitors known, basic differentiation articulated
- **Early** (5–8): Documented comparison, clear UVP, customer preference signals
- **Validated** (9–13): Defensible moat identified, market positioning, win/loss analysis
- **Scaling** (14–17): Advantage compounds, network effects, pricing power, intelligence
- **Leader** (18–20): Category definer, multiple interlocking moats, competitors reference you`,

  operations: `## Operations — Evaluation Scorecard

Each evidence item is scored as: PROVEN (1 point), PARTIAL (0.5 points), UNPROVEN (0 points), or NOT_APPLICABLE (excluded from scoring).

### Maturity Stage Thresholds

| Stage | Proven Items (of applicable) | Description |
|-------|-------------|-------------|
| **Concept** | 0–4 | Basic infrastructure and communication in place |
| **Early** | 5–8 | Core delivery process defined, customer support active, service tracked |
| **Validated** | 9–13 | Service commitments defined, vendor management, QA, documentation |
| **Scaling** | 14–17 | Continuity planning, compliance, dashboards, automation |
| **Leader** | 18–20 | Operational excellence, exceptional reliability, documented playbooks |

Partial items count as 0.5 toward the proven count.

### Evidence Items

| # | Evidence Item | Maturity Gate | Example Evidence |
|---|--------------|---------------|-----------------|
| 1 | Core tools and infrastructure in place | Concept | \`tools systems infrastructure we use running operational set up\` |
| 2 | Internal communication processes exist | Concept | \`team meeting sync regular cadence how we communicate coordination\` |
| 3 | Work planning and prioritisation approach | Concept | \`plan priority track tasks backlog schedule how we organise work\` |
| 4 | Core delivery or operational process defined | Early | \`process for delivering our service or product steps how it works\` |
| 5 | Customer or client support function exists | Early | \`support team responds issues requests help desk client service response\` |
| 6 | Service reliability or output consistency tracked | Early | \`reliability availability uptime output quality consistency monitored tracked\` |
| 7 | Issue escalation and response process | Early | \`when problem occurs escalation steps who handles how respond resolved\` |
| 8 | Service level commitments defined | Validated | \`we commit to turnaround time quality standards SLA guarantee contract\` |
| 9 | Supplier and vendor management in place | Validated | \`vendors suppliers partners contracts procurement manage relationships\` |
| 10 | Quality assurance and review process | Validated | \`quality checks review before delivery QA process checklist standard\` |
| 11 | Internal knowledge and documentation maintained | Validated | \`internal docs procedures knowledge base written updated accessible team\` |
| 12 | Employee or contractor onboarding process | Validated | \`new hire onboarding training first week process ramp up checklist\` |
| 13 | Business continuity plan | Scaling | \`if key person or system fails backup plan redundancy recovery continuity\` |
| 14 | Relevant compliance frameworks adopted | Scaling | \`compliance certification standard framework process working toward industry\` |
| 15 | Operational metrics visible to leadership | Scaling | \`dashboard KPIs tracked visible to team operations metrics reviewed regular\` |
| 16 | Support or delivery function scales with demand | Scaling | \`scaled support team delivery capacity ratio managed growing demand\` |
| 17 | Repetitive processes automated or systematised | Scaling | \`automated workflows eliminated manual repetitive saved time systematised\` |
| 18 | Operational efficiency benchmarked | Leader | \`efficient operations measured benchmarked more output per resource\` |
| 19 | Exceptional service reliability track record | Leader | \`track record reliable delivery consistent quality exceptional availability\` |
| 20 | Operational playbooks for all key functions | Leader | \`playbooks runbooks written step-by-step documented procedures all functions\` |

### Maturity Stage Interpretation for Operations
- **Concept** (0–4): Basic tools, ad-hoc processes, informal coordination
- **Early** (5–8): Core delivery process defined, support exists, reliability tracked
- **Validated** (9–13): Service commitments, vendor management, QA, documentation
- **Scaling** (14–17): Continuity planning, compliance, dashboards, automation
- **Leader** (18–20): Benchmarked efficiency, exceptional reliability, documented playbooks`,

  legal_compliance: `## Legal & Compliance — Evaluation Scorecard

Each evidence item is scored as: PROVEN (1 point), PARTIAL (0.5 points), UNPROVEN (0 points), or NOT_APPLICABLE (excluded from scoring).

### Maturity Stage Thresholds

| Stage | Proven Items (of applicable) | Description |
|-------|-------------|-------------|
| **Concept** | 0–4 | Formally incorporated, basic agreements in place |
| **Early** | 5–8 | Employment and partner agreements signed, IP and data handled |
| **Validated** | 9–13 | Customer contracts standard, insurance, regulatory requirements mapped |
| **Scaling** | 14–17 | IP portfolio, industry certification, legal counsel, investor rights |
| **Leader** | 18–20 | Full regulatory compliance demonstrated, exit-ready |

Partial items count as 0.5 toward the proven count.

### Evidence Items

| # | Evidence Item | Maturity Gate | Example Evidence |
|---|--------------|---------------|-----------------|
| 1 | Formally registered or incorporated | Concept | \`registered incorporated entity structure formation legal status jurisdiction\` |
| 2 | Founder or partner agreements signed | Concept | \`founder agreement equity split ownership vesting signed between partners\` |
| 3 | Basic customer-facing legal terms exist | Concept | \`terms of service terms and conditions customer agreement basic legal published\` |
| 4 | Employment or staff agreements in place | Early | \`offer letters employment contracts all staff have signed agreements\` |
| 5 | Contractor or partner agreements standardised | Early | \`contractor NDA consultant agreement partner signed standardised template\` |
| 6 | IP or work product ownership documented | Early | \`IP ownership work product assigned employees contractors signed over\` |
| 7 | Data handling and privacy obligations met | Early | \`privacy policy data handling compliant regulations customer data protected\` |
| 8 | Ownership structure properly maintained | Validated | \`ownership breakdown shareholders investors register maintained updated\` |
| 9 | Industry-specific regulatory requirements identified | Validated | \`regulations that apply to us industry compliance requirements mapped identified\` |
| 10 | Standard customer contracts in use | Validated | \`standard contract template all customers sign agreement MSA purchase order\` |
| 11 | Insurance coverage in place | Validated | \`liability insurance D&O professional indemnity policy coverage in place\` |
| 12 | Active compliance with key regulations | Validated | \`we comply with regulations required by industry data labour environment\` |
| 13 | IP portfolio documented | Scaling | \`patents filed trademarks registered trade secrets listed IP documented\` |
| 14 | Industry certification or regulatory approval obtained | Scaling | \`certified approved by regulator industry certification compliance audit passed\` |
| 15 | Multi-jurisdiction legal framework in place | Scaling | \`operating across countries jurisdictions legal entities compliance each market\` |
| 16 | External legal counsel retained | Scaling | \`working with law firm attorney outside counsel represents advises us\` |
| 17 | Investor or shareholder rights agreements comprehensive | Scaling | \`investor rights voting rights information rights shareholder agreement comprehensive\` |
| 18 | Full demonstrated compliance with all material regulations | Leader | \`passed regulatory audit certified authority compliance demonstrated all material\` |
| 19 | Active IP protection strategy | Leader | \`patents granted pending trademarks enforced IP portfolio actively protected\` |
| 20 | Legal and structural readiness for strategic transaction | Leader | \`data room prepared diligence ready exit merger acquisition documents clean\` |

### Maturity Stage Interpretation for Legal & Compliance
- **Concept** (0–4): Formally registered, basic agreements in place
- **Early** (5–8): Employment, contractor and IP agreements, data/privacy handled
- **Validated** (9–13): Standard contracts, insurance, regulatory requirements mapped
- **Scaling** (14–17): IP portfolio, industry certification, legal counsel, investor rights
- **Leader** (18–20): Full regulatory compliance demonstrated, strategic transaction-ready`,
};

// ---------------------------------------------------------------------------
// System prompt template
// ---------------------------------------------------------------------------

const EVAL_SYSTEM_TEMPLATE = `You are evaluating a company or organisation across the dimension: {{CATEGORY_TITLE}}.

The company may be a software startup, a holding company, a fund, a manufacturer, an agricultural business, a services firm, a marketplace, or any other business model. Apply each evidence item in spirit rather than literally. Examples of how to interpret common phrasings:
- "MRR established" → "predictable recurring revenue from any source"
- "Technical architecture documented" → "core operational systems or processes are documented"
- "SOC2 certified" → "relevant industry compliance certification obtained"
- "Delaware C-corp" → "formally incorporated or registered in any jurisdiction"
- "Sprint velocity sustainable" → "delivery cadence is reliable and repeatable"
- "API extensibility" → "the offering can integrate with or support external partners"
- "Uptime 99.9%" → "exceptional and consistent service quality track record"

## Scoring Methodology

Score each of the 20 evidence items below as:
- **PROVEN** (1.0) — Clear, specific evidence provided
- **PARTIAL** (0.5) — Some evidence but incomplete or vague
- **UNPROVEN** (0.0) — No evidence found, but the item is applicable to this business
- **NOT_APPLICABLE** — The item fundamentally cannot apply to this company's business model (use sparingly; when in doubt, use UNPROVEN)

## Step 1a: Initial Scoring
Score each item. Mark NOT_APPLICABLE only when the item genuinely cannot apply (e.g., software uptime metrics for a non-digital company). Most items apply to most businesses in some form — evaluate them for the spirit of the underlying principle.

## Step 1b: Maturity Inference
After initial scoring, check for maturity inference:
- If a PROVEN item is 2+ maturity gates above an UNPROVEN item → upgrade UNPROVEN to PROVEN
- If a PROVEN item is exactly 1 gate above an UNPROVEN item → upgrade UNPROVEN to PARTIAL
- Only PROVEN items trigger inference; only UNPROVEN items get promoted (NOT_APPLICABLE items are never inferred)

Gate levels: Concept=1, Early=2, Validated=3, Scaling=4, Leader=5

Rules:
- Only PROVEN items (not PARTIAL) at higher gates trigger inference
- Only UNPROVEN items at lower gates are affected — PARTIAL, PROVEN, and NOT_APPLICABLE items stay as-is
- Inference only flows downward (higher gate → lower gates), never upward
- Examples:
  - Item #15 (Scaling, level 4) is PROVEN → UNPROVEN Concept items (level 1, gap=3) become PROVEN; UNPROVEN Early items (level 2, gap=2) become PROVEN; UNPROVEN Validated items (level 3, gap=1) become PARTIAL
  - Item #8 (Validated, level 3) is PROVEN → UNPROVEN Concept items (level 1, gap=2) become PROVEN; UNPROVEN Early items (level 2, gap=1) become PARTIAL

## Step 2: Calculate Completeness
completeness = (sum of PROVEN and PARTIAL scores) / (count of items NOT scored NOT_APPLICABLE) × 100
If all items are NOT_APPLICABLE, return 0.

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
Exclude inferred items and NOT_APPLICABLE items from gap recommendations.

Write each gap "action" as a specific, actionable recommendation tailored to this company's actual industry, operating context, and stage. Use language appropriate to their business model — not generic tech-startup terminology. For example:
- For an agricultural company: "Document the smallholder farmer sourcing and aggregation process" not "Define the API data pipeline"
- For a services firm: "Establish a standard client engagement and delivery methodology" not "Define sprint velocity"
- For a holding company: "Map the unit economics across each portfolio company" not "Instrument product analytics"

The "deepDivePrompt" field should be a focused, company-specific question that would uncover the most important missing information in this dimension — grounded in their actual business, not a generic prompt.

## Step 6: Build Output
notApplicableCount = count of items scored NOT_APPLICABLE
Respond with ONLY valid JSON matching the required schema. No markdown fences, no explanation.

## Evidence Scorecard
{{SCORECARD}}`;

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

/**
 * Build system + user messages for a single evaluation category.
 * @param {string} categoryId - One of the 10 evaluation category IDs
 * @param {string} context - Onboarding summary context for this category
 * @param {string} [documentContext] - Raw text from uploaded documents (optional)
 * @returns {{ system: string, user: string }}
 */
export function buildEvalPrompt(categoryId, context, documentContext = '') {
  const scorecard = EVALUATION_SCORECARDS[categoryId];
  const title = CATEGORY_TITLES[categoryId];

  if (!scorecard || !title) {
    throw new Error(`Unknown evaluation category: '${categoryId}'`);
  }

  const system = EVAL_SYSTEM_TEMPLATE.replace('{{CATEGORY_TITLE}}', title).replace('{{SCORECARD}}', scorecard);

  let user = `## Available Information\n\n${context}`;
  if (documentContext) {
    user += `\n\n## Supporting Document Content\n\n${documentContext}`;
  }

  return { system, user };
}
