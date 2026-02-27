export const MOCK_EVALUATION_DATA = {
  maturityStage: "Growth",
  maturityLevel: 3,
  maturityDescription: "Your company has established product-market fit and is scaling operations",
  dimensions: [
    { name: "Team", score: 78 },
    { name: "Product", score: 85 },
    { name: "Market", score: 72 },
    { name: "Traction", score: 68 },
    { name: "Financials", score: 55 },
    { name: "Strategy", score: 80 },
    { name: "Operations", score: 65 },
    { name: "Technology", score: 88 }
  ],
  performance: [
    { metric: "Revenue Growth", value: 82, benchmark: 70 },
    { metric: "Customer Retention", value: 75, benchmark: 80 },
    { metric: "Burn Efficiency", value: 60, benchmark: 65 },
    { metric: "Team Velocity", value: 88, benchmark: 75 },
    { metric: "Market Penetration", value: 45, benchmark: 50 }
  ]
};

export const MOCK_INVESTMENT_DATA = {
  investments: [
    {
      id: "seed",
      type: "Seed Funding",
      description: "Early-stage capital for product development and initial market validation",
      suitability: 45,
      minAmount: "$250K",
      maxAmount: "$2M",
      timeline: "3-6 months",
      requirements: ["MVP", "Initial traction", "Founding team"],
      status: "partial_match"
    },
    {
      id: "series_a",
      type: "Series A",
      description: "Growth capital for scaling operations and expanding market reach",
      suitability: 82,
      minAmount: "$2M",
      maxAmount: "$15M",
      timeline: "4-8 months",
      requirements: ["Product-market fit", "Revenue traction", "Scalable model"],
      status: "strong_match"
    },
    {
      id: "venture_debt",
      type: "Venture Debt",
      description: "Non-dilutive financing to extend runway between equity rounds",
      suitability: 78,
      minAmount: "$500K",
      maxAmount: "$5M",
      timeline: "2-4 months",
      requirements: ["Existing VC backing", "Recurring revenue", "Clear path to profitability"],
      status: "strong_match"
    },
    {
      id: "grants",
      type: "Government Grants",
      description: "Non-dilutive funding for R&D and innovation projects",
      suitability: 65,
      minAmount: "$50K",
      maxAmount: "$500K",
      timeline: "2-6 months",
      requirements: ["Innovation focus", "Job creation", "Local presence"],
      status: "moderate_match"
    },
    {
      id: "strategic",
      type: "Strategic Investment",
      description: "Capital from corporate investors with strategic synergies",
      suitability: 58,
      minAmount: "$1M",
      maxAmount: "$10M",
      timeline: "6-12 months",
      requirements: ["Market position", "Strategic value", "Partnership potential"],
      status: "moderate_match"
    },
    {
      id: "crowdfunding",
      type: "Equity Crowdfunding",
      description: "Raise capital from a large number of small investors",
      suitability: 35,
      minAmount: "$100K",
      maxAmount: "$5M",
      timeline: "2-4 months",
      requirements: ["Consumer brand", "Community", "Marketing capability"],
      status: "weak_match"
    }
  ]
};

export const INVESTMENT_ACTIONS = {
  seed: [
    { title: "Prepare Pitch Deck", description: "Create a compelling 10-15 slide pitch deck", priority: "high" },
    { title: "Financial Projections", description: "Build 3-year financial model with key assumptions", priority: "high" },
    { title: "Cap Table", description: "Organize current ownership structure", priority: "medium" }
  ],
  series_a: [
    { title: "Data Room Setup", description: "Compile due diligence documents in organized data room", priority: "critical" },
    { title: "Growth Metrics Dashboard", description: "Prepare detailed metrics and KPI tracking", priority: "high" },
    { title: "Customer References", description: "Identify 5-10 customers willing to speak with investors", priority: "high" },
    { title: "Board Deck Template", description: "Create professional board meeting materials", priority: "medium" }
  ],
  venture_debt: [
    { title: "Revenue Documentation", description: "Prepare MRR/ARR reports and projections", priority: "high" },
    { title: "Covenant Analysis", description: "Review and prepare for typical debt covenants", priority: "medium" },
    { title: "Use of Funds", description: "Document specific use cases for debt capital", priority: "medium" }
  ],
  grants: [
    { title: "Grant Research", description: "Identify applicable government grant programs", priority: "high" },
    { title: "R&D Documentation", description: "Document innovation and R&D activities", priority: "high" },
    { title: "Impact Metrics", description: "Prepare job creation and economic impact data", priority: "medium" }
  ],
  strategic: [
    { title: "Strategic Mapping", description: "Identify potential strategic partners and investors", priority: "high" },
    { title: "Partnership Deck", description: "Create partnership-focused presentation", priority: "high" },
    { title: "Integration Analysis", description: "Document potential synergies and integration points", priority: "medium" }
  ],
  crowdfunding: [
    { title: "Campaign Strategy", description: "Develop crowdfunding campaign plan and timeline", priority: "high" },
    { title: "Marketing Assets", description: "Create video, graphics, and promotional materials", priority: "high" },
    { title: "Reward Tiers", description: "Design backer rewards and perks structure", priority: "medium" }
  ]
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
  { id: 1, title: "Complete Company Profile", description: "Finish entering basic company information in the onboarding chat", priority: "high", status: "in_progress", files: [], inputs: {} },
  { id: 2, title: "Upload Pitch Deck", description: "Share your current investor presentation", priority: "high", status: "pending", files: [], inputs: {} },
  { id: 3, title: "Financial Statements", description: "Provide last 12 months of financial data", priority: "medium", status: "pending", files: [], inputs: {} }
];
