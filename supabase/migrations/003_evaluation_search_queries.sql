-- Seed app_config with evaluation search queries per category.
-- These are the semantic search queries used to retrieve relevant evidence
-- from the knowledge base for each evaluation dimension.
-- Editable via Supabase dashboard without code deploy.

INSERT INTO app_config (key, value)
VALUES ('evaluation_search_queries', '{
  "product_technology": [
    "working product demo prototype MVP functional",
    "technical architecture system design stack infrastructure",
    "product market fit Sean Ellis organic growth retention",
    "scalability load testing performance under load",
    "intellectual property patents trade secrets IP filings"
  ],
  "market_traction": [
    "revenue MRR ARR growth rate month over month",
    "customer acquisition cost CAC payback period",
    "total addressable market TAM SAM SOM market size",
    "net revenue retention expansion churn rate",
    "customer count growth active users paying customers"
  ],
  "business_model": [
    "pricing model subscription tiers freemium enterprise",
    "unit economics LTV CAC ratio gross margin",
    "revenue streams monetization business model canvas",
    "customer lifetime value retention cohort analysis",
    "gross margins cost structure contribution margin"
  ],
  "team_organization": [
    "founding team background experience domain expertise",
    "team size headcount organizational structure",
    "key hires VP engineering sales marketing roles",
    "advisory board mentors investors advisors",
    "culture values retention employee satisfaction"
  ],
  "go_to_market": [
    "sales channels distribution strategy go to market",
    "customer acquisition channels marketing funnel",
    "product led growth PLG self serve conversion",
    "enterprise sales playbook pipeline deal cycle",
    "partnerships channel strategy reseller distributor"
  ],
  "financial_health": [
    "runway months cash burn rate monthly expenses",
    "revenue vs expenses break even path profitability",
    "financial projections forecast model assumptions",
    "cash flow working capital liquidity position",
    "cost reduction efficiency operational leverage"
  ],
  "fundraising_capital": [
    "funding rounds raised seed series investment history",
    "valuation cap table dilution ownership structure",
    "investor pipeline warm introductions term sheets",
    "use of funds allocation deployment strategy",
    "fundraising timeline next round target amount"
  ],
  "competitive_position": [
    "competitive advantage moat differentiation unique value",
    "competitor analysis market landscape alternatives",
    "barriers to entry switching costs network effects",
    "market share positioning category leadership",
    "competitive matrix feature comparison benchmarks"
  ],
  "operations": [
    "operational processes workflows automation efficiency",
    "infrastructure uptime SLA reliability monitoring",
    "customer support scaling help desk response time",
    "vendor management procurement supply chain",
    "disaster recovery business continuity compliance"
  ],
  "legal_compliance": [
    "corporate structure entity type incorporation jurisdiction",
    "intellectual property IP assignments contractor agreements",
    "regulatory compliance GDPR data privacy requirements",
    "employment law contracts equity vesting agreements",
    "insurance liability coverage risk management"
  ]
}'::JSONB)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
