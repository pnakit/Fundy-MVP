export const EVALUATION_DIMENSIONS = [
  { id: 'product_technology', title: 'Product & Technology', shortTitle: 'Product', icon: '🔧' },
  { id: 'market_traction', title: 'Market Traction & Revenue', shortTitle: 'Market', icon: '📈' },
  { id: 'business_model', title: 'Business Model & Economics', shortTitle: 'Business', icon: '💡' },
  { id: 'team_organization', title: 'Team & Organization', shortTitle: 'Team', icon: '👥' },
  { id: 'go_to_market', title: 'Go-to-Market', shortTitle: 'GTM', icon: '🚀' },
  { id: 'financial_health', title: 'Financial Health', shortTitle: 'Finance', icon: '💰' },
  { id: 'fundraising_capital', title: 'Fundraising & Capital', shortTitle: 'Fundraising', icon: '🏦' },
  { id: 'competitive_position', title: 'Competitive Position', shortTitle: 'Competition', icon: '🏆' },
  { id: 'operations', title: 'Operations', shortTitle: 'Ops', icon: '⚙️' },
  { id: 'legal_compliance', title: 'Legal & Compliance', shortTitle: 'Legal', icon: '⚖️' },
];

export const MATURITY_STAGES = [
  { level: 1, name: 'Concept' },
  { level: 2, name: 'Early' },
  { level: 3, name: 'Validated' },
  { level: 4, name: 'Scaling' },
  { level: 5, name: 'Leader' },
];

export const MOCK_EVALUATION_DATA = {
  overallMaturity: { level: 3, name: 'Validated' },
  overallPerformance: { score: 3.2, label: 'Average' },
  description:
    'Your company has validated its core offering and is building toward scale, with strong product execution but gaps in legal readiness and financial planning.',

  dimensions: [
    {
      id: 'product_technology',
      maturityLevel: 4,
      performanceScore: 4,
      description:
        'Strong technical foundation with proprietary ML pipeline and API-first architecture. Good scalability but IP protection strategy needs attention. Technical debt is manageable.',
    },
    {
      id: 'market_traction',
      maturityLevel: 3,
      performanceScore: 3,
      description:
        'Growing MRR with strong net retention. Customer acquisition cost trending down. Total addressable market analysis and competitor market share data still needed.',
    },
    {
      id: 'business_model',
      maturityLevel: 3,
      performanceScore: 3,
      description:
        'SaaS subscription model with tiered pricing and gross margins above 70%. Unit economics promising but need validation at scale. Customer lifetime value calculation incomplete.',
    },
    {
      id: 'team_organization',
      maturityLevel: 4,
      performanceScore: 4,
      description:
        'Strong founding team with complementary skills. CEO has deep domain expertise, CTO has scaled systems before. Key hires needed: VP Sales, 2 senior engineers.',
    },
    {
      id: 'go_to_market',
      maturityLevel: 3,
      performanceScore: 3,
      description:
        'Product-led growth motion with emerging enterprise sales. Self-serve funnel converting at 4.2%. Enterprise playbook and partner channel strategy need formalization.',
    },
    {
      id: 'financial_health',
      maturityLevel: 2,
      performanceScore: 2,
      description:
        '18 months runway at current burn. Revenue covers 40% of expenses. Detailed financial projections and cash flow forecasting not yet provided.',
    },
    {
      id: 'fundraising_capital',
      maturityLevel: 2,
      performanceScore: 3,
      description:
        'Seed round closed 8 months ago. Warm introductions to 3 Series A funds. Target valuation and detailed use of funds breakdown still needed.',
    },
    {
      id: 'competitive_position',
      maturityLevel: 3,
      performanceScore: 4,
      description:
        'Clear technical moat with 3x performance advantage. First-mover in AI-powered segment. Competitive matrix and barrier-to-entry analysis would strengthen positioning narrative.',
    },
    {
      id: 'operations',
      maturityLevel: 2,
      performanceScore: 2,
      description:
        'Lean operations with strong engineering processes. CI/CD with 99.9% uptime. Customer support scaling plan, vendor management, and disaster recovery all need attention.',
    },
    {
      id: 'legal_compliance',
      maturityLevel: 1,
      performanceScore: 1,
      description:
        'Basic corporate structure in place (Delaware C-Corp). GDPR compliance unknown, IP assignments not confirmed, regulatory requirements not mapped for target markets.',
    },
  ],
};

// Mock investment recommendations — matches the investment_recommendations LLM node output shape.
// Represents an early_traction / average performance company.
export const MOCK_INVESTMENT_DATA = {
  investment_readiness_summary: {
    assessment: 'Your company is at early traction stage with average performance across key dimensions. You have promising early signals but need to strengthen financial health and market traction documentation before approaching most institutional investors.',
    primary_recommendation: 'Pre-Seed Investment',
    readiness_score: 'Moderate',
  },
  recommended_funding: [
    {
      investment_type: 'pre_seed',
      rating: 'strong_fit',
      fit_explanation: 'Strong team with relevant experience and early product traction make you an attractive pre-seed candidate. Investors at this stage focus on team and vision, which you have demonstrated.',
      typical_terms: '$50K–$500K at $2–5M pre-money valuation. Expect 10–20% dilution.',
      investor_expectations: ['Compelling vision and large market opportunity', 'Exceptional founding team', 'Early customer validation or prototype'],
      prepare_for_objections: ['Limited revenue traction so far', 'Financial projections need strengthening', 'Go-to-market strategy needs more detail'],
    },
    {
      investment_type: 'grant_funding',
      rating: 'acceptable',
      fit_explanation: 'Non-dilutive grants are well-suited for your stage and can extend runway while you build toward seed readiness. Look for innovation-focused programs aligned with your technology.',
      typical_terms: 'Non-dilutive. Varies by program: $25K–$250K.',
      investor_expectations: ['Clear innovation or social impact narrative', 'Specific use of funds tied to deliverables', 'Reporting requirements'],
      prepare_for_objections: ['Application process can take 3–6 months', 'Usage may be restricted to specific activities'],
    },
  ],
  conditional_options: [
    {
      investment_type: 'seed',
      conditions_for_fit: 'Achievable once you reach $25–50K ARR with clear PMF signals and stronger financial documentation.',
      improvements_needed: [
        {
          category: 'market_traction',
          current_state: 'Early customers, limited ARR data',
          target_state: '$25–50K ARR, documented growth metrics',
          actions: ['Document MRR growth month-over-month for 6+ months', 'Collect and publish customer testimonials', 'Define and measure CAC and LTV'],
        },
        {
          category: 'financial_health',
          current_state: 'Basic financials without detailed projections',
          target_state: '18-month runway model with scenario planning',
          actions: ['Build a 3-year financial model', 'Document burn rate trends', 'Prepare detailed use-of-funds breakdown'],
        },
      ],
    },
  ],
  improvement_roadmap: [
    {
      priority: 1,
      category: 'market_traction',
      current_score: 45,
      target_score: 70,
      unlocks: ['seed', 'revenue_based_financing'],
      specific_actions: ['Track and document MRR with month-over-month growth', 'Define customer acquisition channels with CAC data', 'Gather 3–5 detailed customer case studies'],
      timeline: '2–3 months',
    },
    {
      priority: 2,
      category: 'financial_health',
      current_score: 38,
      target_score: 60,
      unlocks: ['seed', 'venture_debt', 'revenue_based_financing'],
      specific_actions: ['Build 18-month cash flow model', 'Document unit economics (CAC, LTV, payback period)', 'Prepare investor-ready P&L summary'],
      timeline: '1–2 months',
    },
    {
      priority: 3,
      category: 'go_to_market',
      current_score: 50,
      target_score: 70,
      unlocks: ['seed', 'series_a'],
      specific_actions: ['Document primary sales motion and channel strategy', 'Define ideal customer profile (ICP)', 'Track conversion rates through each funnel stage'],
      timeline: '2–3 months',
    },
  ],
  not_recommended: [
    { investment_type: 'series_a', reason: 'Too early — need proven PMF and $150K+ ARR first.' },
    { investment_type: 'venture_debt', reason: 'Requires predictable recurring revenue and existing VC backing.' },
    { investment_type: 'revenue_based_financing', reason: 'Revenue volume too low to support repayment obligations at this stage.' },
  ],
  next_steps: [
    {
      priority: 1,
      action: 'Build detailed MRR tracking and growth metrics dashboard',
      timeline: '2 weeks',
      expected_outcome: 'Clear evidence of traction growth for investor conversations',
    },
    {
      priority: 2,
      action: 'Prepare pre-seed investor deck (10–12 slides)',
      timeline: '3 weeks',
      expected_outcome: 'Investment-ready materials targeting pre-seed funds',
    },
    {
      priority: 3,
      action: 'Research and apply to 2–3 relevant grant programs',
      timeline: '4 weeks',
      expected_outcome: 'Non-dilutive capital to extend runway by 3–6 months',
    },
    {
      priority: 4,
      action: 'Build 18-month financial model with scenario analysis',
      timeline: '2 weeks',
      expected_outcome: 'Investor-ready financials that demonstrate capital efficiency',
    },
    {
      priority: 5,
      action: 'Identify and build relationships with 15–20 target pre-seed investors',
      timeline: '6 weeks',
      expected_outcome: 'Active investor pipeline for fundraise in next quarter',
    },
  ],
};

export const ONBOARDING_CATEGORIES = [
  { id: 'product_technology', title: 'Product & Technology', icon: '🔧' },
  { id: 'market_traction', title: 'Market Traction & Revenue', icon: '📈' },
  { id: 'business_model', title: 'Business Model & Economics', icon: '💡' },
  { id: 'team_organization', title: 'Team & Organization', icon: '👥' },
  { id: 'go_to_market', title: 'Go-to-Market', icon: '🚀' },
  { id: 'financial_health', title: 'Financial Health', icon: '💰' },
  { id: 'fundraising_capital', title: 'Fundraising & Capital', icon: '🏦' },
  { id: 'competitive_position', title: 'Competitive Position', icon: '🏆' },
  { id: 'operations', title: 'Operations', icon: '⚙️' },
  { id: 'legal_compliance', title: 'Legal & Compliance', icon: '⚖️' },
];

export const MOCK_ONBOARDING_SUMMARY = {
  version: "1.0",
  companyName: "Acme Corp",
  generatedAt: new Date().toISOString(),
  overallCompleteness: 68,
  categories: [
    {
      id: "product_technology",
      title: "Product & Technology",
      summary: "SaaS platform with proprietary ML pipeline. Strong technical differentiation but limited IP protection strategy.",
      completeness: 85,
      status: "complete",
      highlights: [
        "Proprietary ML model with 3x benchmark performance",
        "API-first architecture enables rapid integration"
      ],
      gaps: [
        "No patent filings documented",
        "Technical debt assessment missing"
      ],
      keyMetrics: { techStackMaturity: "Advanced", ipProtection: "Low", productStage: "Growth" },
      deepDivePrompt: "Let's dive deeper into your product and technology. Based on what you shared, I'd like to explore your IP strategy, technical debt, and product roadmap in more detail."
    },
    {
      id: "market_traction",
      title: "Market Traction & Revenue",
      summary: "Growing MRR with strong net retention. Customer acquisition cost trending down but market size validation needed.",
      completeness: 72,
      status: "complete",
      highlights: [
        "$45K MRR with 15% month-over-month growth",
        "Net revenue retention at 120%"
      ],
      gaps: [
        "Total addressable market analysis incomplete",
        "Competitor market share data missing"
      ],
      keyMetrics: { mrr: "$45K", mrrGrowth: "15% MoM", netRetention: "120%" },
      deepDivePrompt: "Let's explore your market traction in more detail. I'd like to understand your customer acquisition channels, unit economics, and market sizing better."
    },
    {
      id: "business_model",
      title: "Business Model & Economics",
      summary: "SaaS subscription model with tiered pricing. Unit economics are promising but need validation at scale.",
      completeness: 60,
      status: "needs_attention",
      highlights: [
        "Three-tier pricing model with clear value differentiation",
        "Gross margins above 70%"
      ],
      gaps: [
        "Customer lifetime value calculation incomplete",
        "Pricing strategy documentation needed"
      ],
      keyMetrics: { grossMargin: "72%", pricingModel: "Tiered SaaS", avgContractValue: "$1,200/yr" },
      deepDivePrompt: "Let's examine your business model more closely. I'd like to understand your pricing strategy, unit economics, and path to profitability."
    },
    {
      id: "team_organization",
      title: "Team & Organization",
      summary: "Strong founding team with complementary skills. Key engineering hires needed for next growth phase.",
      completeness: 78,
      status: "complete",
      highlights: [
        "CEO has 10+ years domain expertise",
        "CTO previously built systems at scale (100M+ users)"
      ],
      gaps: [
        "VP of Sales position unfilled",
        "Advisory board composition not discussed"
      ],
      keyMetrics: { teamSize: "12", keyHiresNeeded: "3", founderExperience: "Strong" },
      deepDivePrompt: "Let's discuss your team and organizational structure. I'd like to explore your hiring plan, team gaps, and organizational design for scaling."
    },
    {
      id: "go_to_market",
      title: "Go-to-Market",
      summary: "Product-led growth motion with emerging enterprise sales. Channel strategy needs formalization.",
      completeness: 55,
      status: "needs_attention",
      highlights: [
        "Self-serve funnel converting at 4.2%",
        "First enterprise deals closing via inbound"
      ],
      gaps: [
        "Enterprise sales playbook not documented",
        "Partner channel strategy undefined"
      ],
      keyMetrics: { primaryMotion: "PLG", conversionRate: "4.2%", salesCycle: "45 days" },
      deepDivePrompt: "Let's explore your go-to-market strategy. I'd like to understand your sales motion, channel strategy, and customer acquisition approach in more detail."
    },
    {
      id: "financial_health",
      title: "Financial Health",
      summary: "18 months of runway remaining. Burn rate manageable but increasing with planned hires.",
      completeness: 65,
      status: "needs_attention",
      highlights: [
        "18 months runway at current burn",
        "Revenue covering 40% of monthly expenses"
      ],
      gaps: [
        "Detailed financial projections not provided",
        "Cash flow forecast needed"
      ],
      keyMetrics: { runway: "18 months", burnRate: "$80K/mo", revenueVsBurn: "40%" },
      deepDivePrompt: "Let's look at your financial health more closely. I'd like to review your burn rate trends, runway projections, and financial planning."
    },
    {
      id: "fundraising_capital",
      title: "Fundraising & Capital",
      summary: "Seed round completed. Series A timeline and strategy need clarification.",
      completeness: 50,
      status: "needs_attention",
      highlights: [
        "$1.5M seed round closed 8 months ago",
        "Warm introductions to 3 Series A funds"
      ],
      gaps: [
        "Series A target valuation not discussed",
        "Use of funds breakdown needed",
        "Investor pipeline details missing"
      ],
      keyMetrics: { lastRound: "Seed ($1.5M)", nextRound: "Series A", targetTimeline: "Q3 2026" },
      deepDivePrompt: "Let's discuss your fundraising strategy. I'd like to understand your capital needs, target investors, and fundraising timeline in detail."
    },
    {
      id: "competitive_position",
      title: "Competitive Position",
      summary: "Clear technical moat but competitive landscape analysis is surface-level.",
      completeness: 45,
      status: "incomplete",
      highlights: [
        "3x performance advantage over nearest competitor",
        "First-mover advantage in AI-powered segment"
      ],
      gaps: [
        "Detailed competitive matrix not provided",
        "Barrier to entry analysis missing",
        "Switching cost evaluation needed"
      ],
      keyMetrics: { primaryDifferentiator: "AI Performance", competitorCount: "5 direct", moatStrength: "Moderate" },
      deepDivePrompt: "Let's analyze your competitive position. I'd like to map out your competitive landscape, understand your moats, and evaluate your defensibility."
    },
    {
      id: "operations",
      title: "Operations",
      summary: "Lean operations with strong engineering processes. Customer support and compliance frameworks need attention.",
      completeness: 40,
      status: "incomplete",
      highlights: [
        "CI/CD pipeline with 99.9% uptime SLA",
        "Agile development with 2-week sprints"
      ],
      gaps: [
        "Customer support scaling plan not discussed",
        "Vendor management processes undefined",
        "Disaster recovery plan not documented"
      ],
      keyMetrics: { uptime: "99.9%", deployFrequency: "Daily", supportModel: "Not defined" },
      deepDivePrompt: "Let's review your operations. I'd like to understand your infrastructure, support processes, and operational scaling plans."
    },
    {
      id: "legal_compliance",
      title: "Legal & Compliance",
      summary: "Basic corporate structure in place. Data privacy and regulatory compliance need review.",
      completeness: 35,
      status: "incomplete",
      highlights: [
        "Delaware C-Corp with clean cap table",
        "Standard employee agreements in place"
      ],
      gaps: [
        "GDPR/data privacy compliance status unknown",
        "IP assignment agreements not confirmed",
        "Regulatory requirements not mapped"
      ],
      keyMetrics: { entityType: "Delaware C-Corp", gdprStatus: "Unknown", ipProtection: "Partial" },
      deepDivePrompt: "Let's discuss your legal and compliance posture. I'd like to review your corporate structure, IP protection, data privacy compliance, and regulatory requirements."
    }
  ]
};

export const INITIAL_ACTION_ITEMS = [
  { id: 1, actionKey: 'gdpr-compliance', title: 'GDPR Compliance Audit', description: 'Review data handling practices for EU regulatory compliance', priority: 'critical', status: 'pending', sourceType: 'evaluation', sourceId: null, dimensionId: 'legal_compliance', files: [], inputs: {} },
  { id: 2, actionKey: 'ip-assignments', title: 'IP Assignment Review', description: 'Confirm IP assignment agreements for all contributors and contractors', priority: 'high', status: 'pending', sourceType: 'evaluation', sourceId: null, dimensionId: 'legal_compliance', files: [], inputs: {} },
  { id: 3, actionKey: 'regulatory-mapping', title: 'Regulatory Requirements Mapping', description: 'Identify and document all regulatory requirements for target markets', priority: 'medium', status: 'pending', sourceType: 'evaluation', sourceId: null, dimensionId: 'legal_compliance', files: [], inputs: {} },
  { id: 4, actionKey: 'cash-flow-forecast', title: 'Cash Flow Forecast', description: 'Build 12-month cash flow projection with scenario modeling', priority: 'high', status: 'pending', sourceType: 'evaluation', sourceId: null, dimensionId: 'financial_health', files: [], inputs: {} },
  { id: 5, actionKey: 'financial-projections', title: 'Financial Projections', description: 'Provide last 12 months of financial data and 3-year projections', priority: 'medium', status: 'pending', sourceType: 'evaluation', sourceId: null, dimensionId: 'financial_health', files: [], inputs: {} },
  { id: 6, actionKey: 'disaster-recovery', title: 'Disaster Recovery Plan', description: 'Document disaster recovery and business continuity procedures', priority: 'high', status: 'pending', sourceType: 'evaluation', sourceId: null, dimensionId: 'operations', files: [], inputs: {} },
  { id: 7, actionKey: 'support-scaling', title: 'Customer Support Scaling Plan', description: 'Define support model and scaling strategy for next growth phase', priority: 'medium', status: 'pending', sourceType: 'evaluation', sourceId: null, dimensionId: 'operations', files: [], inputs: {} },
  { id: 8, actionKey: 'series-a-strategy', title: 'Series A Strategy', description: 'Define target valuation, investor pipeline, and fundraising timeline', priority: 'high', status: 'pending', sourceType: 'evaluation', sourceId: null, dimensionId: 'fundraising_capital', files: [], inputs: {} },
  { id: 9, actionKey: 'gtm-playbook', title: 'Enterprise Sales Playbook', description: 'Document enterprise sales motion, pricing, and channel strategy', priority: 'medium', status: 'pending', sourceType: 'evaluation', sourceId: null, dimensionId: 'go_to_market', files: [], inputs: {} },
  { id: 10, actionKey: 'patent-filings', title: 'Provisional Patent Filings', description: 'Protect core IP with provisional patent applications', priority: 'medium', status: 'pending', sourceType: 'evaluation', sourceId: null, dimensionId: 'product_technology', files: [], inputs: {} },
];

// ─── Due Diligence Checklists ─────────────────────────────────────────────────
// Additive structure: shared base → equity stages build cumulatively
// (pre_seed ⊂ seed ⊂ series_a); non-equity tracks inherit only the base.

const DD_BASE = [
  { key: 'company-reg',        title: 'Company Registration Documents', description: 'Certificate of incorporation, registered address, and company number.',            priority: 'high'   },
  { key: 'founder-bios',       title: 'Founder & Key Team Bios',        description: 'LinkedIn profiles and brief bios for all founders and C-suite.',                   priority: 'high'   },
  { key: 'exec-summary',       title: 'Executive Summary',              description: 'One-page overview: problem, solution, market size, traction, and ask.',            priority: 'high'   },
  { key: 'corporate-structure',title: 'Corporate Structure Chart',      description: 'Legal entity diagram showing subsidiaries and holding structure.',                 priority: 'medium' },
];

const DD_PRE_SEED = [
  { key: 'pitch-deck',     title: 'Pitch Deck',                    description: 'Investor-facing deck covering problem, solution, market, team, and ask.',           priority: 'high'   },
  { key: 'financial-proj', title: 'Financial Projections (12 mo)', description: 'Revenue and expense projections with clearly stated assumptions.',                   priority: 'high'   },
  { key: 'product-demo',   title: 'Product Demo / Prototype',      description: 'Working demo, prototype, or recorded walkthrough.',                                  priority: 'high'   },
  { key: 'cap-table',      title: 'Cap Table',                     description: 'Current equity structure including all founders and any prior investors.',            priority: 'medium' },
];

const DD_SEED_ADDITIONS = [
  { key: 'financial-model',    title: 'Financial Model with Unit Economics', description: 'CAC, LTV, payback period, and 18-month P&L projection.',             priority: 'high'   },
  { key: 'mrr-docs',           title: 'MRR / ARR Documentation',            description: 'Monthly recurring revenue history with growth trend.',                priority: 'high'   },
  { key: 'cap-table-pool',     title: 'Cap Table with Option Pool',          description: 'Fully diluted cap table including ESOP allocation.',                  priority: 'high'   },
  { key: 'customer-contracts', title: 'Customer Contracts / LOIs',           description: 'Signed agreements or letters of intent from key customers.',         priority: 'medium' },
  { key: 'product-roadmap',    title: 'Product Roadmap',                     description: '12-month roadmap with milestones and resource plan.',                priority: 'medium' },
];

const DD_SERIES_A_ADDITIONS = [
  { key: 'audited-financials',    title: 'Audited Financial Statements',  description: '2 years of audited or accountant-reviewed financials (income, balance, cash flow).', priority: 'high'   },
  { key: 'board-deck',            title: 'Board / Investor Update Deck',  description: 'Most recent board presentation or investor update showing KPIs and strategy.',        priority: 'high'   },
  { key: 'metrics-dashboard',     title: 'Growth Metrics Dashboard',      description: 'ARR, NRR, gross/net churn rate, and cohort retention analysis.',                      priority: 'high'   },
  { key: 'unit-economics-detail', title: 'Detailed Unit Economics',        description: 'Deep-dive on CAC by channel, LTV by segment, and gross margin per cohort.',          priority: 'high'   },
  { key: 'customer-refs',         title: 'Key Customer Reference List',   description: 'Top 5–10 customers willing to provide investor references.',                          priority: 'medium' },
  { key: 'legal-ip',              title: 'Legal & IP Summary',            description: 'IP ownership, patent filings, key contracts, and any outstanding legal matters.',    priority: 'medium' },
  { key: 'data-room',             title: 'Virtual Data Room',             description: 'Organised data room with all legal, financial, and operational documents.',          priority: 'medium' },
];

const DD_GRANT_ADDITIONS = [
  { key: 'application-form',     title: 'Grant Application Form',       description: 'Completed grant application specific to the target programme.',              priority: 'high'   },
  { key: 'project-plan',         title: 'Project Plan & Milestones',    description: 'Detailed plan showing how grant funds will be used and measured.',           priority: 'high'   },
  { key: 'budget-justification', title: 'Budget Justification',         description: 'Line-item budget with clear rationale for each expense category.',           priority: 'high'   },
  { key: 'eligibility-evidence', title: 'Eligibility Criteria Evidence',description: 'Documentation confirming the company meets all grant eligibility criteria.', priority: 'high'   },
  { key: 'impact-statement',     title: 'Impact / Outcomes Statement',  description: 'Description of measurable social, economic, or technological outcomes.',     priority: 'medium' },
];

const DD_VENTURE_DEBT_ADDITIONS = [
  { key: 'financial-statements',title: 'Financial Statements (2 years)',   description: 'Income statement, balance sheet, and cash flow for 2 prior years.',           priority: 'high'   },
  { key: 'revenue-forecast',    title: 'Revenue History & 18-mo Forecast', description: 'Historical revenue with a forward projection and key assumptions.',           priority: 'high'   },
  { key: 'bank-statements',     title: 'Bank Statements (6 months)',        description: 'Business bank account statements confirming cash position.',                  priority: 'high'   },
  { key: 'existing-debt',       title: 'Existing Debt & Covenants',         description: 'Summary of all current debt facilities, terms, covenants, and maturity dates.',priority: 'high'   },
  { key: 'cap-table',           title: 'Cap Table',                         description: 'Equity structure for covenant and anti-dilution reference.',                  priority: 'medium' },
  { key: 'ip-assets',           title: 'IP & Asset Register',               description: 'List of owned intellectual property or assets available as collateral.',      priority: 'medium' },
];

const DD_RBF_ADDITIONS = [
  { key: 'mrr-history',      title: 'MRR History (6+ months)',      description: 'Month-by-month MRR/ARR going back at least 6 months.',                          priority: 'high'   },
  { key: 'pnl-statements',   title: 'Profit & Loss Statements',     description: 'Monthly P&L for the past 12 months.',                                           priority: 'high'   },
  { key: 'revenue-cohorts',  title: 'Revenue Cohort Analysis',      description: 'Customer cohort retention and revenue expansion data.',                         priority: 'high'   },
  { key: 'bank-statements',  title: 'Bank Statements (3–6 months)', description: 'Business account statements confirming regular revenue deposits.',               priority: 'high'   },
  { key: 'churn-data',       title: 'Customer Churn Data',          description: 'Monthly gross and net churn rates with explanation of any spikes.',              priority: 'medium' },
  { key: 'revenue-contracts',title: 'Key Revenue Contracts',        description: 'Top customer contracts or subscription agreements confirming ARR.',              priority: 'medium' },
];

export const DUE_DILIGENCE_CHECKLISTS = {
  pre_seed:                [...DD_BASE, ...DD_PRE_SEED],
  seed:                    [...DD_BASE, ...DD_PRE_SEED, ...DD_SEED_ADDITIONS],
  series_a:                [...DD_BASE, ...DD_PRE_SEED, ...DD_SEED_ADDITIONS, ...DD_SERIES_A_ADDITIONS],
  grant_funding:           [...DD_BASE, ...DD_GRANT_ADDITIONS],
  venture_debt:            [...DD_BASE, ...DD_VENTURE_DEBT_ADDITIONS],
  revenue_based_financing: [...DD_BASE, ...DD_RBF_ADDITIONS],
};
