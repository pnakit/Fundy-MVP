import React, { useState, useRef, useEffect } from 'react';

// Simulated Dify API responses for demo
const MOCK_EVALUATION_DATA = {
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

const MOCK_INVESTMENT_DATA = {
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

const INVESTMENT_ACTIONS = {
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

// Onboarding category definitions
const ONBOARDING_CATEGORIES = [
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

// Mock onboarding summary for development
const MOCK_ONBOARDING_SUMMARY = {
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

// Summary detection markers for Dify responses
const SUMMARY_START_MARKER = '[ONBOARDING_SUMMARY]';
const SUMMARY_END_MARKER = '[/ONBOARDING_SUMMARY]';

function extractOnboardingSummary(responseText) {
  const startIdx = responseText.indexOf(SUMMARY_START_MARKER);
  if (startIdx === -1) return null;

  const jsonStart = startIdx + SUMMARY_START_MARKER.length;
  const endIdx = responseText.indexOf(SUMMARY_END_MARKER, jsonStart);
  if (endIdx === -1) return null;

  let jsonString = responseText.substring(jsonStart, endIdx).trim();

  // Fix trailing commas — most common LLM JSON error
  jsonString = jsonString.replace(/,\s*([}\]])/g, '$1');

  let parsed;
  try {
    parsed = JSON.parse(jsonString);
  } catch (e) {
    console.error('Failed to parse onboarding summary JSON:', e);
    return { error: 'parse_error', message: 'The summary data could not be parsed.' };
  }

  if (!parsed.categories || !Array.isArray(parsed.categories)) {
    console.warn('Onboarding summary missing categories array:', parsed);
    return { error: 'missing_categories', message: 'The summary is missing category data.' };
  }

  if (parsed.categories.length < 5) {
    console.warn(`Onboarding summary has only ${parsed.categories.length} categories`);
    return { error: 'too_few_categories', message: `Only ${parsed.categories.length} categories were returned.` };
  }

  const validIds = new Set(ONBOARDING_CATEGORIES.map(c => c.id));

  // Normalize each category: coerce types, derive status, ensure required fields
  parsed.categories = parsed.categories
    .filter(cat => cat && typeof cat === 'object' && validIds.has(cat.id))
    .map(cat => {
      const completeness = Math.max(0, Math.min(100, Math.round(Number(cat.completeness) || 0)));
      const status = completeness >= 70 ? 'complete' : completeness >= 40 ? 'needs_attention' : 'incomplete';
      const catDef = ONBOARDING_CATEGORIES.find(c => c.id === cat.id);

      return {
        ...cat,
        completeness,
        status,
        title: cat.title || catDef?.title || cat.id,
        highlights: Array.isArray(cat.highlights) ? cat.highlights.filter(h => typeof h === 'string') : [],
        gaps: Array.isArray(cat.gaps) ? cat.gaps.filter(g => typeof g === 'string') : [],
        keyMetrics: (cat.keyMetrics && typeof cat.keyMetrics === 'object') ? cat.keyMetrics : {},
        deepDivePrompt: typeof cat.deepDivePrompt === 'string' ? cat.deepDivePrompt
          : `Let's explore ${catDef?.title || 'this area'} in more detail.`,
      };
    });

  // Fill missing categories with placeholders
  const presentIds = new Set(parsed.categories.map(c => c.id));
  for (const catDef of ONBOARDING_CATEGORIES) {
    if (!presentIds.has(catDef.id)) {
      parsed.categories.push({
        id: catDef.id,
        title: catDef.title,
        summary: 'This area was not covered during the onboarding conversation.',
        completeness: 0,
        status: 'incomplete',
        highlights: [],
        gaps: ['Not yet discussed — click to explore this topic'],
        keyMetrics: {},
        deepDivePrompt: `We haven't discussed ${catDef.title} yet. Let's start by understanding your current situation in this area.`,
      });
    }
  }

  // Sort to match ONBOARDING_CATEGORIES order
  const orderMap = Object.fromEntries(ONBOARDING_CATEGORIES.map((c, i) => [c.id, i]));
  parsed.categories.sort((a, b) => (orderMap[a.id] ?? 99) - (orderMap[b.id] ?? 99));

  // Recalculate overall completeness
  parsed.overallCompleteness = Math.round(
    parsed.categories.reduce((sum, c) => sum + c.completeness, 0) / parsed.categories.length
  );
  parsed.companyName = parsed.companyName || 'Your Company';

  return parsed;
}

// Dify API — supports blocking, streaming, and mock fallback modes
const DifyAPI = {
  get useStreaming() { return import.meta.env.VITE_DIFY_STREAMING === 'true'; },
  get isMock() { return import.meta.env.VITE_DIFY_MOCK === 'true'; },

  // Blocking mode: waits for full response
  async sendMessage(message, conversationId = null, files = [], user = 'default-user', workflow = 'onboarding') {
    if (this.isMock) return this.sendMessageMock(message, conversationId);

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workflow,
        inputs: {},
        query: message,
        response_mode: 'blocking',
        conversation_id: conversationId || '',
        user,
        files: files.map(f => ({
          type: 'document',
          transfer_method: 'local_file',
          upload_file_id: f.fileId,
        })),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Dify API error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    return {
      message: data.answer,
      conversationId: data.conversation_id,
      messageId: data.message_id,
      fallback: data._fallback || false,
    };
  },

  // Streaming mode: calls onChunk with accumulated text as tokens arrive
  async sendMessageStreaming(message, conversationId = null, files = [], user = 'default-user', onChunk, workflow = 'onboarding') {
    if (this.isMock) return this.sendMessageMock(message, conversationId);

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workflow,
        inputs: {},
        query: message,
        response_mode: 'streaming',
        conversation_id: conversationId || '',
        user,
        files: files.map(f => ({
          type: 'document',
          transfer_method: 'local_file',
          upload_file_id: f.fileId,
        })),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Dify API error ${response.status}: ${errorText}`);
    }

    const fallback = response.headers.get('X-Dify-Fallback') === 'true';
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullMessage = '';
    let resultConversationId = conversationId;
    let resultMessageId = null;
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const jsonStr = line.slice(6).trim();
        if (!jsonStr) continue;

        try {
          const event = JSON.parse(jsonStr);

          if (event.event === 'message') {
            fullMessage += event.answer;
            if (onChunk) onChunk(fullMessage);
          } else if (event.event === 'message_end') {
            resultConversationId = event.conversation_id;
            resultMessageId = event.message_id;
          }
        } catch (e) {
          // Skip malformed SSE lines
        }
      }
    }

    return {
      message: fullMessage,
      conversationId: resultConversationId,
      messageId: resultMessageId,
      fallback,
    };
  },

  // File upload
  async uploadFile(file, user = 'default-user', workflow = 'onboarding') {
    if (this.isMock) return this.uploadFileMock(file);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('user', user);

    const response = await fetch(`/api/upload?workflow=${workflow}`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`File upload error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    return { success: true, fileId: data.id, fileName: data.name };
  },

  // Mock fallback — used when VITE_DIFY_MOCK=true
  async sendMessageMock(message, conversationId) {
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Trigger summary generation when user types "summary" or "finish"
    const lower = message.toLowerCase();
    if (lower.includes('summary') || lower.includes('finish')) {
      const summaryJson = JSON.stringify(MOCK_ONBOARDING_SUMMARY);
      return {
        message: `Great, I've compiled everything you've shared into a comprehensive evaluation across 10 key dimensions.\n\n${SUMMARY_START_MARKER}\n${summaryJson}\n${SUMMARY_END_MARKER}`,
        conversationId: conversationId || 'conv_' + Date.now(),
        messageId: 'msg_' + Date.now(),
        fallback: false,
      };
    }

    const responses = [
      "Thanks for sharing that information. I've recorded your company details. Could you tell me more about your target market and customer segments?",
      "That's helpful context. What stage would you say your product is at? Are you pre-revenue, early revenue, or scaling?",
      "Great progress! Can you share some metrics around your current traction? Things like MRR, customer count, or growth rates would be useful.",
      "I've updated your profile with this information. Based on what you've shared, I can see some interesting patterns emerging. Would you like to discuss your funding strategy next?",
      "Thanks for the details. I've captured this in your company profile. Is there anything specific about your business model or competitive landscape you'd like to elaborate on?"
    ];

    return {
      message: '[mock] ' + responses[Math.floor(Math.random() * responses.length)],
      conversationId: conversationId || 'conv_' + Date.now(),
      messageId: 'msg_' + Date.now(),
      fallback: false,
    };
  },

  async uploadFileMock(file) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    return { success: true, fileId: 'file_' + Date.now(), fileName: file.name };
  },
};

// Shared data store (simulating a backend)
const DataStore = {
  messages: [],
  files: [],
  actionItems: [
    { id: 1, title: "Complete Company Profile", description: "Finish entering basic company information in the onboarding chat", priority: "high", status: "in_progress", files: [], inputs: {} },
    { id: 2, title: "Upload Pitch Deck", description: "Share your current investor presentation", priority: "high", status: "pending", files: [], inputs: {} },
    { id: 3, title: "Financial Statements", description: "Provide last 12 months of financial data", priority: "medium", status: "pending", files: [], inputs: {} }
  ],
  selectedInvestments: [],
  
  addMessage(msg) { this.messages.push(msg); },
  addFile(file) { this.files.push(file); },
  addActionItem(item) { 
    this.actionItems.push({ ...item, id: Date.now(), status: "pending", files: [], inputs: {} }); 
  },
  updateActionItem(id, updates) {
    const idx = this.actionItems.findIndex(a => a.id === id);
    if (idx !== -1) this.actionItems[idx] = { ...this.actionItems[idx], ...updates };
  }
};

// Radar/Spiderweb Chart Component
const RadarChart = ({ data, size = 300 }) => {
  const center = size / 2;
  const radius = size * 0.38;
  const angleStep = (2 * Math.PI) / data.length;
  
  const getPoint = (index, value) => {
    const angle = angleStep * index - Math.PI / 2;
    const r = (value / 100) * radius;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle)
    };
  };
  
  const gridLevels = [20, 40, 60, 80, 100];
  
  const dataPoints = data.map((d, i) => getPoint(i, d.score));
  const pathD = dataPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';
  
  return (
    <svg width={size} height={size} className="radar-chart">
      {/* Grid circles */}
      {gridLevels.map(level => (
        <polygon
          key={level}
          points={data.map((_, i) => {
            const p = getPoint(i, level);
            return `${p.x},${p.y}`;
          }).join(' ')}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="1"
        />
      ))}
      
      {/* Axis lines */}
      {data.map((_, i) => {
        const p = getPoint(i, 100);
        return (
          <line
            key={i}
            x1={center}
            y1={center}
            x2={p.x}
            y2={p.y}
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="1"
          />
        );
      })}
      
      {/* Data polygon */}
      <path
        d={pathD}
        fill="rgba(99, 102, 241, 0.25)"
        stroke="#6366f1"
        strokeWidth="2"
      />
      
      {/* Data points */}
      {dataPoints.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r="5"
          fill="#6366f1"
          stroke="#fff"
          strokeWidth="2"
        />
      ))}
      
      {/* Labels */}
      {data.map((d, i) => {
        const labelRadius = radius + 30;
        const angle = angleStep * i - Math.PI / 2;
        const x = center + labelRadius * Math.cos(angle);
        const y = center + labelRadius * Math.sin(angle);
        return (
          <text
            key={i}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="rgba(255,255,255,0.7)"
            fontSize="12"
            fontWeight="500"
          >
            {d.name}
          </text>
        );
      })}
    </svg>
  );
};

// Main App Component
export default function StartupPlatform() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [activeWindow, setActiveWindow] = useState(0);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Welcome to Startup Evaluator! I'm here to help understand your business and provide tailored insights. Let's start with the basics — what's your company name and what problem are you solving?" }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [evaluationData, setEvaluationData] = useState(MOCK_EVALUATION_DATA);
  const [investmentData, setInvestmentData] = useState(MOCK_INVESTMENT_DATA);
  const [actionItems, setActionItems] = useState(DataStore.actionItems);
  const [selectedInvestments, setSelectedInvestments] = useState([]);
  const [expandedAction, setExpandedAction] = useState(null);
  const [onboardingPhase, setOnboardingPhase] = useState('chat'); // 'chat' | 'summary' | 'deep-dive'
  const [onboardingSummary, setOnboardingSummary] = useState(null);
  const [activeCategory, setActiveCategory] = useState(null);
  const [categoryConversations, setCategoryConversations] = useState({});
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const deepDiveFileInputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, categoryConversations, activeCategory]);

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    if (passwordInput === 'fundy2026') {
      setIsAuthenticated(true);
      setPasswordError('');
    } else {
      setPasswordError('Incorrect password');
    }
  };

  // Process a completed Dify response — check for summary, update messages
  const processCompletedResponse = (response) => {
    setConversationId(response.conversationId);
    setUploadedFiles([]);

    const result = extractOnboardingSummary(response.message);

    if (result && result.error) {
      // Summary markers found but extraction failed
      const conversationalPart = response.message
        .substring(0, response.message.indexOf(SUMMARY_START_MARKER))
        .trim();

      if (conversationalPart) {
        setMessages(prev => [...prev, { role: 'assistant', content: conversationalPart }]);
      }
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `I prepared your summary but encountered a formatting issue: ${result.message} Let me try generating it again.`,
        isError: true,
      }]);
    } else if (result) {
      // Valid summary — transition to summary phase
      const conversationalPart = response.message
        .substring(0, response.message.indexOf(SUMMARY_START_MARKER))
        .trim();

      if (conversationalPart) {
        setMessages(prev => [...prev, { role: 'assistant', content: conversationalPart }]);
      }

      setOnboardingSummary(result);
      setOnboardingPhase('summary');
    } else {
      // No summary markers — normal chat message
      setMessages(prev => [...prev, { role: 'assistant', content: response.message }]);
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    const currentMessage = inputValue;
    setMessages(prev => [...prev, { role: 'user', content: currentMessage }]);
    setInputValue('');

    if (DifyAPI.useStreaming && !DifyAPI.isMock) {
      // Streaming: add empty assistant message, update as chunks arrive
      setMessages(prev => [...prev, { role: 'assistant', content: '', isStreaming: true }]);

      try {
        const response = await DifyAPI.sendMessageStreaming(
          currentMessage, conversationId, uploadedFiles, 'default-user',
          (accumulated) => {
            setMessages(prev => {
              const updated = [...prev];
              updated[updated.length - 1] = { role: 'assistant', content: accumulated, isStreaming: true };
              return updated;
            });
          }
        );

        // Finalize: remove streaming flag, check for summary
        setConversationId(response.conversationId);
        setUploadedFiles([]);
        const result = extractOnboardingSummary(response.message);

        if (result && result.error) {
          // Summary markers found but extraction failed
          const conversationalPart = response.message
            .substring(0, response.message.indexOf(SUMMARY_START_MARKER))
            .trim();
          setMessages(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              role: 'assistant',
              content: conversationalPart || 'I tried to prepare your summary but encountered an issue.',
            };
            return [...updated, {
              role: 'assistant',
              content: `Formatting issue: ${result.message} Let me try again.`,
              isError: true,
            }];
          });
        } else if (result) {
          const conversationalPart = response.message
            .substring(0, response.message.indexOf(SUMMARY_START_MARKER))
            .trim();
          setMessages(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = { role: 'assistant', content: conversationalPart || response.message };
            return updated;
          });
          setOnboardingSummary(result);
          setOnboardingPhase('summary');
        } else {
          setMessages(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = { role: 'assistant', content: response.message };
            return updated;
          });
        }
      } catch (error) {
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: 'I apologize, but I encountered an error. Please try again.' };
          return updated;
        });
      }
    } else {
      // Blocking: show typing indicator, wait for full response
      setIsTyping(true);
      try {
        const response = await DifyAPI.sendMessage(currentMessage, conversationId, uploadedFiles);
        processCompletedResponse(response);
      } catch (error) {
        setMessages(prev => [...prev, { role: 'assistant', content: "I apologize, but I encountered an error. Please try again." }]);
      }
      setIsTyping(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setMessages(prev => [...prev, { role: 'user', content: `Uploaded: ${file.name}`, isFile: true }]);
    setIsTyping(true);

    try {
      const result = await DifyAPI.uploadFile(file);
      setUploadedFiles(prev => [...prev, { fileId: result.fileId, fileName: file.name }]);
      setMessages(prev => [...prev, { role: 'assistant', content: `I've received "${file.name}". I'll incorporate this into your evaluation. You can continue sharing information or send a message to discuss the document.` }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: "There was an issue uploading your file. Please try again." }]);
    }

    setIsTyping(false);
    e.target.value = '';
  };

  const handleActionFileUpload = (actionId, e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setActionItems(prev => prev.map(item => {
      if (item.id === actionId) {
        return { ...item, files: [...item.files, { name: file.name, uploadedAt: new Date() }] };
      }
      return item;
    }));
  };

  const handleActionInput = (actionId, field, value) => {
    setActionItems(prev => prev.map(item => {
      if (item.id === actionId) {
        return { ...item, inputs: { ...item.inputs, [field]: value } };
      }
      return item;
    }));
  };

  const toggleInvestment = (investmentId) => {
    setSelectedInvestments(prev => {
      const isSelected = prev.includes(investmentId);
      if (isSelected) {
        // Remove investment and its actions
        return prev.filter(id => id !== investmentId);
      } else {
        // Add investment and its actions
        const newActions = INVESTMENT_ACTIONS[investmentId] || [];
        setActionItems(prevActions => [
          ...prevActions,
          ...newActions.map(action => ({
            ...action,
            id: Date.now() + Math.random(),
            status: "pending",
            files: [],
            inputs: {},
            source: investmentId
          }))
        ]);
        return [...prev, investmentId];
      }
    });
  };

  const getCategoryStatusColor = (status) => {
    switch (status) {
      case 'complete': return '#10b981';
      case 'needs_attention': return '#f59e0b';
      case 'incomplete': return '#ef4444';
      default: return '#64748b';
    }
  };

  const handleCategoryClick = (categoryId) => {
    setActiveCategory(categoryId);
    setOnboardingPhase('deep-dive');

    // Initialize conversation for this category if it doesn't exist
    if (!categoryConversations[categoryId]) {
      const category = onboardingSummary.categories.find(c => c.id === categoryId);
      setCategoryConversations(prev => ({
        ...prev,
        [categoryId]: {
          messages: [{ role: 'assistant', content: category.deepDivePrompt }],
          conversationId: null,
        }
      }));
    }
  };

  const handleDeepDiveSendMessage = async () => {
    if (!inputValue.trim() || !activeCategory) return;

    const categoryId = activeCategory;
    const convState = categoryConversations[categoryId];
    const currentMessage = inputValue;

    setCategoryConversations(prev => ({
      ...prev,
      [categoryId]: {
        ...prev[categoryId],
        messages: [...prev[categoryId].messages, { role: 'user', content: currentMessage }],
      }
    }));

    setInputValue('');

    // Helper to append an assistant message to this category's conversation
    const appendAssistant = (content, extra = {}) => {
      setCategoryConversations(prev => ({
        ...prev,
        [categoryId]: {
          ...prev[categoryId],
          ...extra,
          messages: [...prev[categoryId].messages, { role: 'assistant', content, ...extra }],
        }
      }));
    };

    // Helper to update the last message in this category's conversation
    const updateLastMessage = (content, extra = {}) => {
      setCategoryConversations(prev => {
        const msgs = [...prev[categoryId].messages];
        msgs[msgs.length - 1] = { role: 'assistant', content, ...extra };
        return {
          ...prev,
          [categoryId]: { ...prev[categoryId], ...extra, messages: msgs },
        };
      });
    };

    if (DifyAPI.useStreaming && !DifyAPI.isMock) {
      // Streaming: add empty assistant message, update as chunks arrive
      appendAssistant('', { isStreaming: true });

      try {
        const response = await DifyAPI.sendMessageStreaming(
          currentMessage, convState.conversationId, uploadedFiles, 'default-user',
          (accumulated) => updateLastMessage(accumulated, { isStreaming: true }),
          'deepdive'
        );

        setUploadedFiles([]);
        const prefix = response.fallback ? '[onboarding] ' : '';
        updateLastMessage(prefix + response.message, { conversationId: response.conversationId });
      } catch (error) {
        updateLastMessage('I apologize, but I encountered an error. Please try again.');
      }
    } else {
      // Blocking: show typing indicator, wait for full response
      setIsTyping(true);
      try {
        const response = await DifyAPI.sendMessage(
          currentMessage, convState.conversationId, uploadedFiles, 'default-user', 'deepdive'
        );

        setUploadedFiles([]);
        const prefix = response.fallback ? '[onboarding] ' : '';

        setCategoryConversations(prev => ({
          ...prev,
          [categoryId]: {
            conversationId: response.conversationId,
            messages: [
              ...prev[categoryId].messages,
              { role: 'assistant', content: prefix + response.message }
            ],
          }
        }));
      } catch (error) {
        appendAssistant('I apologize, but I encountered an error. Please try again.');
      }
      setIsTyping(false);
    }
  };

  const handleDeepDiveFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !activeCategory) return;

    const categoryId = activeCategory;

    setCategoryConversations(prev => ({
      ...prev,
      [categoryId]: {
        ...prev[categoryId],
        messages: [...prev[categoryId].messages, { role: 'user', content: `Uploaded: ${file.name}`, isFile: true }],
      }
    }));
    setIsTyping(true);

    try {
      const result = await DifyAPI.uploadFile(file, 'default-user', 'deepdive');
      setUploadedFiles(prev => [...prev, { fileId: result.fileId, fileName: file.name }]);
      setCategoryConversations(prev => ({
        ...prev,
        [categoryId]: {
          ...prev[categoryId],
          messages: [...prev[categoryId].messages, { role: 'assistant', content: `I've received "${file.name}". I'll incorporate this into our discussion.` }],
        }
      }));
    } catch (error) {
      setCategoryConversations(prev => ({
        ...prev,
        [categoryId]: {
          ...prev[categoryId],
          messages: [...prev[categoryId].messages, { role: 'assistant', content: "There was an issue uploading your file. Please try again." }],
        }
      }));
    }

    setIsTyping(false);
    e.target.value = '';
  };

  const getSuitabilityColor = (score) => {
    if (score >= 75) return '#10b981';
    if (score >= 50) return '#f59e0b';
    return '#ef4444';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'strong_match': return '#10b981';
      case 'moderate_match': return '#f59e0b';
      case 'partial_match': return '#6366f1';
      default: return '#ef4444';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'critical': return '#ef4444';
      case 'high': return '#f59e0b';
      case 'medium': return '#6366f1';
      default: return '#64748b';
    }
  };

  // Window 1: Chat Onboarding — phase dispatcher
  const renderChatWindow = () => {
    switch (onboardingPhase) {
      case 'summary':
        return renderOnboardingSummary();
      case 'deep-dive':
        return renderDeepDive();
      case 'chat':
      default:
        return renderOnboardingChat();
    }
  };

  // Phase 1: Conversational onboarding chat
  // Render message content with mock badge and file support
  const renderMessageContent = (msg) => {
    if (msg.isFile) {
      return <div className="file-message">{msg.content}</div>;
    }
    if (msg.isError) {
      return (
        <div className="message-error">
          <span className="error-badge">error</span>
          {msg.content}
        </div>
      );
    }
    if (msg.content.startsWith('[mock] ')) {
      return (
        <>
          <span className="mock-badge">mock</span>
          {msg.content.slice(7)}
        </>
      );
    }
    if (msg.content.startsWith('[onboarding] ')) {
      return (
        <>
          <span className="onboarding-badge">onboarding</span>
          {msg.content.slice(13)}
        </>
      );
    }
    return msg.content;
  };

  const renderOnboardingChat = () => (
    <div className="chat-window">
      <div className="chat-header">
        <div className="chat-title">
          <div className="chat-avatar">💬</div>
          <div>
            <h2>Company Onboarding</h2>
            <span>Share your company information through conversation</span>
          </div>
        </div>
        <div className="chat-header-right">
          {onboardingSummary && (
            <button className="view-summary-btn" onClick={() => setOnboardingPhase('summary')}>
              View Summary
            </button>
          )}
          <div className="chat-status">
            <span className="status-dot"></span>
            Connected to Dify
          </div>
        </div>
      </div>

      <div className="chat-messages">
        {messages.map((msg, idx) => (
          <div key={idx} className={`message ${msg.role}`}>
            {msg.role === 'assistant' && <div className="message-avatar">S</div>}
            <div className="message-content">
              {renderMessageContent(msg)}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="message assistant">
            <div className="message-avatar">S</div>
            <div className="message-content typing">
              <span></span><span></span><span></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-area">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          style={{ display: 'none' }}
          accept=".pdf,.doc,.docx,.txt,.csv,.xlsx,.pptx"
        />
        <button className="attach-btn" onClick={() => fileInputRef.current.click()}>
          <span>📎</span>
        </button>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
          placeholder="Type your message..."
          className="chat-input"
        />
        <button className="send-btn" onClick={handleSendMessage} disabled={!inputValue.trim()}>
          <span>→</span>
        </button>
      </div>
    </div>
  );

  // Phase 2: Onboarding summary cards
  const renderOnboardingSummary = () => {
    const summary = onboardingSummary || MOCK_ONBOARDING_SUMMARY;

    return (
      <div className="chat-window summary-window">
        <div className="summary-back-bar">
          <button className="back-to-chat-btn" onClick={() => setOnboardingPhase('chat')}>
            ← Back to conversation
          </button>
        </div>
        <div className="chat-header">
          <div className="chat-title">
            <div className="chat-avatar">📋</div>
            <div>
              <h2>{summary.companyName} — Onboarding Summary</h2>
              <span>Click a category to explore in detail</span>
            </div>
          </div>
          <div className="chat-header-right">
            <div className="overall-completeness">
              <svg width="48" height="48" viewBox="0 0 48 48">
                <circle cx="24" cy="24" r="20" fill="none"
                  stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
                <circle cx="24" cy="24" r="20" fill="none"
                  stroke="#6366f1" strokeWidth="4"
                  strokeDasharray={`${(summary.overallCompleteness / 100) * 125.66} 125.66`}
                  strokeLinecap="round" transform="rotate(-90 24 24)" />
                <text x="24" y="28" textAnchor="middle" fill="#fff"
                  fontSize="12" fontWeight="600" fontFamily="DM Sans, sans-serif">
                  {summary.overallCompleteness}%
                </text>
              </svg>
              <span className="completeness-label">Overall</span>
            </div>
          </div>
        </div>

        <div className="category-grid-container">
          <div className="category-grid">
            {summary.categories.map(category => {
              const catDef = ONBOARDING_CATEGORIES.find(c => c.id === category.id);
              const statusColor = getCategoryStatusColor(category.status);
              const circumference = 2 * Math.PI * 18; // r=18

              return (
                <div
                  key={category.id}
                  className={`category-card ${category.status}`}
                  onClick={() => handleCategoryClick(category.id)}
                >
                  <div className="category-card-header">
                    <div className="category-info">
                      <span className="category-icon">{catDef?.icon}</span>
                      <h3>{category.title}</h3>
                    </div>
                    <div className="category-ring">
                      <svg width="44" height="44" viewBox="0 0 44 44">
                        <circle cx="22" cy="22" r="18" fill="none"
                          stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
                        <circle cx="22" cy="22" r="18" fill="none"
                          stroke={statusColor} strokeWidth="3"
                          strokeDasharray={`${(category.completeness / 100) * circumference} ${circumference}`}
                          strokeLinecap="round" transform="rotate(-90 22 22)" />
                        <text x="22" y="26" textAnchor="middle" fill="#fff"
                          fontSize="11" fontWeight="600" fontFamily="DM Sans, sans-serif">
                          {category.completeness}%
                        </text>
                      </svg>
                    </div>
                  </div>

                  <p className="category-summary">{category.summary}</p>

                  {category.highlights.length > 0 && (
                    <div className="category-highlights">
                      {category.highlights.slice(0, 2).map((h, i) => (
                        <span key={i} className="highlight-chip">{h}</span>
                      ))}
                    </div>
                  )}

                  {category.gaps.length > 0 && (
                    <div className="category-gaps">
                      <span className="gaps-label">
                        {category.gaps.length} area{category.gaps.length > 1 ? 's' : ''} to explore
                      </span>
                    </div>
                  )}

                  <div className="category-action">
                    <span>Deep dive</span>
                    <span className="category-arrow">→</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    );
  };

  // Phase 3: Deep-dive category chat
  const renderDeepDive = () => {
    const category = onboardingSummary
      ? onboardingSummary.categories.find(c => c.id === activeCategory)
      : MOCK_ONBOARDING_SUMMARY.categories.find(c => c.id === activeCategory);
    const catDef = ONBOARDING_CATEGORIES.find(c => c.id === activeCategory);
    const convState = categoryConversations[activeCategory] || { messages: [], conversationId: null };
    const statusColor = getCategoryStatusColor(category?.status || 'incomplete');
    const circumference = 2 * Math.PI * 18;

    return (
      <div className="chat-window">
        <div className="chat-header">
          <div className="chat-title">
            <button className="back-btn" onClick={() => setOnboardingPhase('summary')}>←</button>
            <div className="chat-avatar" style={{ fontSize: '1rem' }}>
              {catDef?.icon}
            </div>
            <div>
              <h2>{category?.title || 'Deep Dive'}</h2>
              <span>Deep-dive conversation</span>
            </div>
          </div>
          <div className="chat-header-right">
            <div className="category-ring">
              <svg width="44" height="44" viewBox="0 0 44 44">
                <circle cx="22" cy="22" r="18" fill="none"
                  stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
                <circle cx="22" cy="22" r="18" fill="none"
                  stroke={statusColor} strokeWidth="3"
                  strokeDasharray={`${((category?.completeness || 0) / 100) * circumference} ${circumference}`}
                  strokeLinecap="round" transform="rotate(-90 22 22)" />
                <text x="22" y="26" textAnchor="middle" fill="#fff"
                  fontSize="11" fontWeight="600" fontFamily="DM Sans, sans-serif">
                  {category?.completeness || 0}%
                </text>
              </svg>
            </div>
          </div>
        </div>

        <div className="chat-messages">
          {convState.messages.map((msg, idx) => (
            <div key={idx} className={`message ${msg.role}`}>
              {msg.role === 'assistant' && <div className="message-avatar">S</div>}
              <div className="message-content">
                {msg.isFile ? (
                  <div className="file-message">{msg.content}</div>
                ) : (
                  msg.content
                )}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="message assistant">
              <div className="message-avatar">S</div>
              <div className="message-content typing">
                <span></span><span></span><span></span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="chat-input-area">
          <input
            type="file"
            ref={deepDiveFileInputRef}
            onChange={handleDeepDiveFileUpload}
            style={{ display: 'none' }}
            accept=".pdf,.doc,.docx,.txt,.csv,.xlsx,.pptx"
          />
          <button className="attach-btn" onClick={() => deepDiveFileInputRef.current.click()}>
            <span>📎</span>
          </button>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleDeepDiveSendMessage()}
            placeholder={`Ask about ${category?.title || 'this category'}...`}
            className="chat-input"
          />
          <button className="send-btn" onClick={handleDeepDiveSendMessage} disabled={!inputValue.trim()}>
            <span>→</span>
          </button>
        </div>
      </div>
    );
  };

  // Window 2: Evaluation & Actions
  const renderEvaluationWindow = () => (
    <div className="evaluation-window">
      <div className="eval-header">
        <h2>Evaluation & Actions</h2>
        <p>Your company's performance analysis and required actions</p>
      </div>
      
      <div className="eval-content">
        {/* Maturity Stage */}
        <div className="maturity-section">
          <div className="maturity-card">
            <div className="maturity-badge">
              <span className="maturity-level">Stage {evaluationData.maturityLevel}</span>
              <span className="maturity-name">{evaluationData.maturityStage}</span>
            </div>
            <p className="maturity-desc">{evaluationData.maturityDescription}</p>
            <div className="maturity-track">
              {['Ideation', 'Validation', 'Growth', 'Scale', 'Mature'].map((stage, idx) => (
                <div key={stage} className={`track-step ${idx < evaluationData.maturityLevel ? 'completed' : ''} ${idx === evaluationData.maturityLevel - 1 ? 'current' : ''}`}>
                  <div className="track-dot"></div>
                  <span>{stage}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Charts Section */}
        <div className="charts-section">
          <div className="chart-card radar-card">
            <h3>Performance Dimensions</h3>
            <div className="radar-container">
              <RadarChart data={evaluationData.dimensions} size={320} />
            </div>
          </div>
          
          <div className="chart-card bars-card">
            <h3>Performance Metrics</h3>
            <div className="bar-charts">
              {evaluationData.performance.map((item, idx) => (
                <div key={idx} className="bar-item">
                  <div className="bar-label">
                    <span>{item.metric}</span>
                    <span className="bar-value">{item.value}%</span>
                  </div>
                  <div className="bar-track">
                    <div 
                      className="bar-fill" 
                      style={{ 
                        width: `${item.value}%`,
                        background: item.value >= item.benchmark ? '#10b981' : '#f59e0b'
                      }}
                    ></div>
                    <div 
                      className="bar-benchmark" 
                      style={{ left: `${item.benchmark}%` }}
                      title={`Benchmark: ${item.benchmark}%`}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
            <div className="bar-legend">
              <span><i className="legend-line"></i> Your Performance</span>
              <span><i className="legend-dot"></i> Industry Benchmark</span>
            </div>
          </div>
        </div>

        {/* Action Items */}
        <div className="actions-section">
          <div className="actions-header">
            <h3>Action Items</h3>
            <span className="action-count">{actionItems.filter(a => a.status !== 'completed').length} pending</span>
          </div>
          
          <div className="action-cards">
            {actionItems.map(action => (
              <div 
                key={action.id} 
                className={`action-card ${expandedAction === action.id ? 'expanded' : ''}`}
              >
                <div className="action-card-header" onClick={() => setExpandedAction(expandedAction === action.id ? null : action.id)}>
                  <div className="action-priority-dot" style={{ background: getPriorityColor(action.priority) }}></div>
                  <div className="action-info">
                    <h4>{action.title}</h4>
                    <p>{action.description}</p>
                  </div>
                  <div className="action-meta">
                    {action.source && (
                      <span className="action-source">{MOCK_INVESTMENT_DATA.investments.find(i => i.id === action.source)?.type}</span>
                    )}
                    <span className={`action-status ${action.status}`}>
                      {action.status.replace('_', ' ')}
                    </span>
                  </div>
                  <span className="expand-icon">{expandedAction === action.id ? '−' : '+'}</span>
                </div>
                
                {expandedAction === action.id && (
                  <div className="action-card-body">
                    <div className="action-input-group">
                      <label>Notes / Response</label>
                      <textarea
                        value={action.inputs.notes || ''}
                        onChange={(e) => handleActionInput(action.id, 'notes', e.target.value)}
                        placeholder="Add your notes or response here..."
                      />
                    </div>
                    
                    <div className="action-files">
                      <label>Attachments</label>
                      <div className="file-upload-zone">
                        <input
                          type="file"
                          id={`file-${action.id}`}
                          onChange={(e) => handleActionFileUpload(action.id, e)}
                          style={{ display: 'none' }}
                        />
                        <label htmlFor={`file-${action.id}`} className="file-upload-btn">
                          <span>📎</span> Upload File
                        </label>
                        {action.files.map((file, idx) => (
                          <div key={idx} className="uploaded-file-chip">
                            📄 {file.name}
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div className="action-buttons">
                      <button 
                        className="btn-complete"
                        onClick={() => setActionItems(prev => prev.map(a => a.id === action.id ? {...a, status: 'completed'} : a))}
                      >
                        Mark Complete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  // Window 3: Investment Matching
  const renderInvestmentWindow = () => (
    <div className="investment-window">
      <div className="invest-header">
        <h2>Investment Matching</h2>
        <p>Discover funding opportunities matched to your company profile</p>
      </div>
      
      <div className="invest-content">
        <div className="invest-summary">
          <div className="summary-card">
            <span className="summary-value">{investmentData.investments.filter(i => i.suitability >= 75).length}</span>
            <span className="summary-label">Strong Matches</span>
          </div>
          <div className="summary-card">
            <span className="summary-value">{selectedInvestments.length}</span>
            <span className="summary-label">Selected</span>
          </div>
          <div className="summary-card">
            <span className="summary-value">{actionItems.filter(a => a.source).length}</span>
            <span className="summary-label">Actions Added</span>
          </div>
        </div>

        <div className="investment-grid">
          {investmentData.investments.map(investment => {
            const isSelected = selectedInvestments.includes(investment.id);
            return (
              <div 
                key={investment.id} 
                className={`investment-card ${isSelected ? 'selected' : ''}`}
              >
                <div className="invest-card-header">
                  <div className="invest-type">
                    <h3>{investment.type}</h3>
                    <span 
                      className="invest-status"
                      style={{ background: `${getStatusColor(investment.status)}22`, color: getStatusColor(investment.status) }}
                    >
                      {investment.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="suitability-ring">
                    <svg width="60" height="60">
                      <circle cx="30" cy="30" r="26" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
                      <circle 
                        cx="30" cy="30" r="26" 
                        fill="none" 
                        stroke={getSuitabilityColor(investment.suitability)} 
                        strokeWidth="4"
                        strokeDasharray={`${(investment.suitability / 100) * 163.36} 163.36`}
                        strokeLinecap="round"
                        transform="rotate(-90 30 30)"
                      />
                      <text x="30" y="35" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="600">
                        {investment.suitability}%
                      </text>
                    </svg>
                  </div>
                </div>
                
                <p className="invest-description">{investment.description}</p>
                
                <div className="invest-details">
                  <div className="detail-row">
                    <span className="detail-label">Amount Range</span>
                    <span className="detail-value">{investment.minAmount} - {investment.maxAmount}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Timeline</span>
                    <span className="detail-value">{investment.timeline}</span>
                  </div>
                </div>
                
                <div className="invest-requirements">
                  <span className="req-label">Requirements:</span>
                  <div className="req-tags">
                    {investment.requirements.map((req, idx) => (
                      <span key={idx} className="req-tag">{req}</span>
                    ))}
                  </div>
                </div>
                
                <button 
                  className={`invest-select-btn ${isSelected ? 'selected' : ''}`}
                  onClick={() => toggleInvestment(investment.id)}
                >
                  {isSelected ? '✓ Selected' : 'Select & Add Actions'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap');
        
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
          background: #08080c;
          color: #e8e8ed;
          font-family: 'DM Sans', sans-serif;
          line-height: 1.6;
        }
        
        .app-container {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }
        
        .main-header {
          padding: 1rem 2rem;
          background: rgba(10, 10, 15, 0.95);
          border-bottom: 1px solid rgba(255,255,255,0.06);
          display: flex;
          align-items: center;
          justify-content: space-between;
          backdrop-filter: blur(20px);
          position: sticky;
          top: 0;
          z-index: 100;
        }
        
        .logo {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        
        .logo-mark {
          width: 36px;
          height: 36px;
          background: linear-gradient(135deg, #6366f1, #a855f7);
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 1.125rem;
        }
        
        .logo-text {
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 1.375rem;
          font-weight: 700;
          letter-spacing: -0.02em;
        }
        
        .window-tabs {
          display: flex;
          gap: 0.25rem;
          background: rgba(255,255,255,0.03);
          padding: 0.25rem;
          border-radius: 12px;
        }
        
        .window-tab {
          padding: 0.625rem 1.25rem;
          border-radius: 10px;
          border: none;
          background: transparent;
          color: rgba(255,255,255,0.5);
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          font-family: inherit;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        
        .window-tab:hover {
          color: rgba(255,255,255,0.8);
        }
        
        .window-tab.active {
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          color: white;
        }
        
        .window-tab-icon {
          font-size: 1rem;
        }
        
        .main-content {
          flex: 1;
          padding: 1.5rem 2rem;
          max-width: 1600px;
          margin: 0 auto;
          width: 100%;
        }
        
        /* Chat Window Styles */
        .chat-window {
          height: calc(100vh - 140px);
          display: flex;
          flex-direction: column;
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 16px;
          overflow: hidden;
        }
        
        .chat-header {
          padding: 1.25rem 1.5rem;
          background: rgba(0,0,0,0.3);
          border-bottom: 1px solid rgba(255,255,255,0.06);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .chat-title {
          display: flex;
          align-items: center;
          gap: 1rem;
        }
        
        .chat-avatar {
          width: 44px;
          height: 44px;
          background: linear-gradient(135deg, #6366f1, #a855f7);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.25rem;
        }
        
        .chat-title h2 {
          font-size: 1.125rem;
          font-weight: 600;
          margin-bottom: 0.125rem;
        }
        
        .chat-title span {
          font-size: 0.8125rem;
          color: rgba(255,255,255,0.5);
        }
        
        .chat-status {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.8125rem;
          color: rgba(255,255,255,0.5);
        }
        
        .status-dot {
          width: 8px;
          height: 8px;
          background: #10b981;
          border-radius: 50%;
          animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        
        .chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        
        .message {
          display: flex;
          gap: 0.75rem;
          max-width: 80%;
          animation: slideIn 0.3s ease;
        }
        
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .message.user {
          align-self: flex-end;
          flex-direction: row-reverse;
        }
        
        .message-avatar {
          width: 32px;
          height: 32px;
          background: linear-gradient(135deg, #6366f1, #a855f7);
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.875rem;
          font-weight: 600;
          flex-shrink: 0;
        }
        
        .message-content {
          padding: 0.875rem 1.125rem;
          border-radius: 16px;
          font-size: 0.9375rem;
          line-height: 1.5;
        }
        
        .message.assistant .message-content {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px 16px 16px 4px;
        }
        
        .message.user .message-content {
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          border-radius: 16px 16px 4px 16px;
        }
        
        .file-message {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        
        .typing {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 1rem 1.25rem !important;
        }
        
        .typing span {
          width: 8px;
          height: 8px;
          background: rgba(255,255,255,0.4);
          border-radius: 50%;
          animation: typing 1.4s infinite;
        }
        
        .typing span:nth-child(2) { animation-delay: 0.2s; }
        .typing span:nth-child(3) { animation-delay: 0.4s; }
        
        @keyframes typing {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
        }
        
        .chat-input-area {
          padding: 1rem 1.5rem;
          background: rgba(0,0,0,0.3);
          border-top: 1px solid rgba(255,255,255,0.06);
          display: flex;
          gap: 0.75rem;
          align-items: center;
        }
        
        .attach-btn, .send-btn {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
          font-size: 1.25rem;
        }
        
        .attach-btn {
          background: rgba(255,255,255,0.05);
          color: rgba(255,255,255,0.6);
        }
        
        .attach-btn:hover {
          background: rgba(255,255,255,0.1);
          color: white;
        }
        
        .send-btn {
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          color: white;
        }
        
        .send-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        .send-btn:not(:disabled):hover {
          transform: scale(1.05);
        }
        
        .chat-input {
          flex: 1;
          padding: 0.875rem 1rem;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px;
          color: white;
          font-size: 0.9375rem;
          font-family: inherit;
        }
        
        .chat-input:focus {
          outline: none;
          border-color: #6366f1;
          background: rgba(99, 102, 241, 0.05);
        }
        
        .chat-input::placeholder {
          color: rgba(255,255,255,0.4);
        }
        
        .mock-badge {
          display: inline-block;
          padding: 0.125rem 0.375rem;
          background: rgba(251, 191, 36, 0.15);
          border: 1px solid rgba(251, 191, 36, 0.3);
          border-radius: 4px;
          font-size: 0.6875rem;
          color: #fbbf24;
          margin-right: 0.5rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          font-weight: 600;
          vertical-align: middle;
        }

        .onboarding-badge {
          display: inline-block;
          padding: 0.125rem 0.375rem;
          background: rgba(99, 102, 241, 0.15);
          border: 1px solid rgba(99, 102, 241, 0.3);
          border-radius: 4px;
          font-size: 0.6875rem;
          color: #818cf8;
          margin-right: 0.5rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          font-weight: 600;
          vertical-align: middle;
        }

        .error-badge {
          display: inline-block;
          padding: 0.125rem 0.375rem;
          background: rgba(245, 158, 11, 0.15);
          border: 1px solid rgba(245, 158, 11, 0.3);
          border-radius: 4px;
          font-size: 0.6875rem;
          color: #f59e0b;
          margin-right: 0.5rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          font-weight: 600;
          vertical-align: middle;
        }

        .message-error {
          border-left: 3px solid #f59e0b;
          padding-left: 0.75rem;
        }

        /* Summary & Deep-Dive Styles */
        .chat-header-right {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .view-summary-btn {
          padding: 0.5rem 1rem;
          background: rgba(99, 102, 241, 0.15);
          border: 1px solid rgba(99, 102, 241, 0.3);
          border-radius: 8px;
          color: #a5b4fc;
          font-size: 0.8125rem;
          font-family: inherit;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .view-summary-btn:hover {
          background: rgba(99, 102, 241, 0.25);
          border-color: rgba(99, 102, 241, 0.5);
          color: white;
        }

        .overall-completeness {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.25rem;
        }

        .completeness-label {
          font-size: 0.6875rem;
          color: rgba(255,255,255,0.5);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .summary-window {
          display: flex;
          flex-direction: column;
        }

        .category-grid-container {
          flex: 1;
          overflow-y: auto;
          padding: 1.5rem;
        }

        .category-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 1rem;
        }

        .category-card {
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 16px;
          padding: 1.25rem;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          border-left: 3px solid rgba(255,255,255,0.1);
        }

        .category-card:hover {
          background: rgba(255,255,255,0.04);
          border-color: rgba(255,255,255,0.12);
          transform: translateY(-2px);
        }

        .category-card.complete {
          border-left-color: #10b981;
        }

        .category-card.needs_attention {
          border-left-color: #f59e0b;
        }

        .category-card.incomplete {
          border-left-color: #ef4444;
        }

        .category-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }

        .category-info {
          display: flex;
          align-items: center;
          gap: 0.625rem;
          flex: 1;
          min-width: 0;
        }

        .category-icon {
          font-size: 1.25rem;
          flex-shrink: 0;
        }

        .category-info h3 {
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 0.9375rem;
          font-weight: 600;
          color: #e8e8ed;
        }

        .category-ring {
          flex-shrink: 0;
        }

        .category-summary {
          font-size: 0.8125rem;
          color: rgba(255,255,255,0.6);
          line-height: 1.5;
        }

        .category-highlights {
          display: flex;
          flex-direction: column;
          gap: 0.375rem;
        }

        .highlight-chip {
          font-size: 0.75rem;
          color: #6ee7b7;
          padding: 0.25rem 0.5rem;
          background: rgba(16, 185, 129, 0.08);
          border-radius: 6px;
          line-height: 1.4;
        }

        .category-gaps {
          padding-top: 0.25rem;
        }

        .gaps-label {
          font-size: 0.75rem;
          color: #fbbf24;
        }

        .category-action {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-top: 0.5rem;
          border-top: 1px solid rgba(255,255,255,0.06);
          font-size: 0.8125rem;
          color: #a5b4fc;
          font-weight: 500;
        }

        .category-arrow {
          transition: transform 0.2s ease;
        }

        .category-card:hover .category-arrow {
          transform: translateX(4px);
        }

        .summary-back-bar {
          padding: 0.625rem 1.5rem;
          background: rgba(0,0,0,0.3);
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }

        .back-to-chat-btn {
          background: none;
          border: none;
          color: rgba(255,255,255,0.5);
          font-size: 0.8125rem;
          font-family: inherit;
          cursor: pointer;
          padding: 0.5rem 0;
          transition: color 0.2s ease;
        }

        .back-to-chat-btn:hover {
          color: white;
        }

        .back-btn {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.05);
          color: rgba(255,255,255,0.7);
          font-size: 1.125rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
          flex-shrink: 0;
        }

        .back-btn:hover {
          background: rgba(255,255,255,0.1);
          border-color: rgba(255,255,255,0.2);
          color: white;
        }

        /* Evaluation Window Styles */
        .evaluation-window {
          height: calc(100vh - 140px);
          overflow-y: auto;
        }
        
        .eval-header, .invest-header {
          margin-bottom: 2rem;
        }
        
        .eval-header h2, .invest-header h2 {
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 2rem;
          font-weight: 700;
          margin-bottom: 0.5rem;
        }
        
        .eval-header p, .invest-header p {
          color: rgba(255,255,255,0.5);
        }
        
        .maturity-section {
          margin-bottom: 2rem;
        }
        
        .maturity-card {
          background: linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(168, 85, 247, 0.05));
          border: 1px solid rgba(99, 102, 241, 0.2);
          border-radius: 16px;
          padding: 1.5rem;
        }
        
        .maturity-badge {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 0.75rem;
        }
        
        .maturity-level {
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          padding: 0.375rem 0.75rem;
          border-radius: 6px;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        
        .maturity-name {
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 1.5rem;
          font-weight: 700;
        }
        
        .maturity-desc {
          color: rgba(255,255,255,0.6);
          font-size: 0.9375rem;
          margin-bottom: 1.5rem;
        }
        
        .maturity-track {
          display: flex;
          justify-content: space-between;
          position: relative;
        }
        
        .maturity-track::before {
          content: '';
          position: absolute;
          top: 12px;
          left: 24px;
          right: 24px;
          height: 2px;
          background: rgba(255,255,255,0.1);
        }
        
        .track-step {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
          position: relative;
          z-index: 1;
        }
        
        .track-dot {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: rgba(255,255,255,0.1);
          border: 2px solid rgba(255,255,255,0.2);
          transition: all 0.3s ease;
        }
        
        .track-step.completed .track-dot {
          background: #6366f1;
          border-color: #6366f1;
        }
        
        .track-step.current .track-dot {
          background: #6366f1;
          border-color: #a855f7;
          box-shadow: 0 0 20px rgba(99, 102, 241, 0.5);
        }
        
        .track-step span {
          font-size: 0.75rem;
          color: rgba(255,255,255,0.5);
        }
        
        .track-step.completed span,
        .track-step.current span {
          color: rgba(255,255,255,0.9);
        }
        
        .charts-section {
          display: grid;
          grid-template-columns: 380px 1fr;
          gap: 1.5rem;
          margin-bottom: 2rem;
        }
        
        .chart-card {
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 16px;
          padding: 1.5rem;
        }
        
        .chart-card h3 {
          font-size: 1rem;
          font-weight: 600;
          margin-bottom: 1.5rem;
        }
        
        .radar-container {
          display: flex;
          justify-content: center;
          align-items: center;
        }
        
        .bar-charts {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }
        
        .bar-item {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        
        .bar-label {
          display: flex;
          justify-content: space-between;
          font-size: 0.875rem;
        }
        
        .bar-label span:first-child {
          color: rgba(255,255,255,0.7);
        }
        
        .bar-value {
          font-weight: 600;
        }
        
        .bar-track {
          height: 8px;
          background: rgba(255,255,255,0.1);
          border-radius: 4px;
          position: relative;
          overflow: visible;
        }
        
        .bar-fill {
          height: 100%;
          border-radius: 4px;
          transition: width 1s ease-out;
        }
        
        .bar-benchmark {
          position: absolute;
          top: -4px;
          width: 2px;
          height: 16px;
          background: rgba(255,255,255,0.5);
          transform: translateX(-50%);
        }
        
        .bar-legend {
          display: flex;
          gap: 1.5rem;
          margin-top: 1.5rem;
          padding-top: 1rem;
          border-top: 1px solid rgba(255,255,255,0.06);
          font-size: 0.8125rem;
          color: rgba(255,255,255,0.5);
        }
        
        .bar-legend span {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        
        .legend-line {
          width: 16px;
          height: 4px;
          background: linear-gradient(90deg, #10b981, #f59e0b);
          border-radius: 2px;
        }
        
        .legend-dot {
          width: 2px;
          height: 12px;
          background: rgba(255,255,255,0.5);
        }
        
        .actions-section {
          margin-top: 2rem;
        }
        
        .actions-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }
        
        .actions-header h3 {
          font-size: 1.25rem;
          font-weight: 600;
        }
        
        .action-count {
          background: rgba(99, 102, 241, 0.2);
          color: #a5b4fc;
          padding: 0.25rem 0.75rem;
          border-radius: 100px;
          font-size: 0.8125rem;
        }
        
        .action-cards {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        
        .action-card {
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 12px;
          overflow: hidden;
          transition: all 0.2s ease;
        }
        
        .action-card:hover {
          border-color: rgba(255,255,255,0.1);
        }
        
        .action-card.expanded {
          border-color: #6366f1;
        }
        
        .action-card-header {
          padding: 1rem 1.25rem;
          display: flex;
          align-items: center;
          gap: 1rem;
          cursor: pointer;
        }
        
        .action-priority-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        
        .action-info {
          flex: 1;
        }
        
        .action-info h4 {
          font-size: 0.9375rem;
          font-weight: 600;
          margin-bottom: 0.25rem;
        }
        
        .action-info p {
          font-size: 0.8125rem;
          color: rgba(255,255,255,0.5);
        }
        
        .action-meta {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        
        .action-source {
          font-size: 0.6875rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: rgba(255,255,255,0.4);
          background: rgba(255,255,255,0.05);
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
        }
        
        .action-status {
          font-size: 0.75rem;
          padding: 0.25rem 0.625rem;
          border-radius: 6px;
          text-transform: capitalize;
        }
        
        .action-status.pending {
          background: rgba(245, 158, 11, 0.2);
          color: #f59e0b;
        }
        
        .action-status.in_progress {
          background: rgba(99, 102, 241, 0.2);
          color: #a5b4fc;
        }
        
        .action-status.completed {
          background: rgba(16, 185, 129, 0.2);
          color: #10b981;
        }
        
        .expand-icon {
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255,255,255,0.05);
          border-radius: 6px;
          font-size: 1rem;
          color: rgba(255,255,255,0.5);
        }
        
        .action-card-body {
          padding: 0 1.25rem 1.25rem;
          border-top: 1px solid rgba(255,255,255,0.06);
          margin-top: 0;
          padding-top: 1.25rem;
          animation: expandIn 0.2s ease;
        }
        
        @keyframes expandIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        .action-input-group {
          margin-bottom: 1rem;
        }
        
        .action-input-group label,
        .action-files label {
          display: block;
          font-size: 0.8125rem;
          font-weight: 500;
          color: rgba(255,255,255,0.6);
          margin-bottom: 0.5rem;
        }
        
        .action-input-group textarea {
          width: 100%;
          padding: 0.75rem 1rem;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px;
          color: white;
          font-size: 0.875rem;
          font-family: inherit;
          resize: vertical;
          min-height: 80px;
        }
        
        .action-input-group textarea:focus {
          outline: none;
          border-color: #6366f1;
        }
        
        .file-upload-zone {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          align-items: center;
        }
        
        .file-upload-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.5rem 0.875rem;
          background: rgba(255,255,255,0.05);
          border: 1px dashed rgba(255,255,255,0.2);
          border-radius: 6px;
          font-size: 0.8125rem;
          color: rgba(255,255,255,0.6);
          cursor: pointer;
          transition: all 0.2s ease;
        }
        
        .file-upload-btn:hover {
          background: rgba(255,255,255,0.08);
          border-color: #6366f1;
          color: white;
        }
        
        .uploaded-file-chip {
          display: inline-flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.375rem 0.75rem;
          background: rgba(16, 185, 129, 0.1);
          border: 1px solid rgba(16, 185, 129, 0.3);
          border-radius: 6px;
          font-size: 0.8125rem;
          color: #10b981;
        }
        
        .action-buttons {
          margin-top: 1rem;
          display: flex;
          justify-content: flex-end;
        }
        
        .btn-complete {
          padding: 0.625rem 1.25rem;
          background: linear-gradient(135deg, #10b981, #059669);
          border: none;
          border-radius: 8px;
          color: white;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          font-family: inherit;
          transition: all 0.2s ease;
        }
        
        .btn-complete:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
        }
        
        /* Investment Window Styles */
        .investment-window {
          height: calc(100vh - 140px);
          overflow-y: auto;
        }
        
        .invest-summary {
          display: flex;
          gap: 1rem;
          margin-bottom: 2rem;
        }
        
        .summary-card {
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 12px;
          padding: 1.25rem 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }
        
        .summary-value {
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 2rem;
          font-weight: 800;
          color: #6366f1;
        }
        
        .summary-label {
          font-size: 0.8125rem;
          color: rgba(255,255,255,0.5);
        }
        
        .investment-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
          gap: 1.25rem;
        }
        
        .investment-card {
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 16px;
          padding: 1.5rem;
          transition: all 0.2s ease;
        }
        
        .investment-card:hover {
          border-color: rgba(255,255,255,0.12);
          transform: translateY(-2px);
        }
        
        .investment-card.selected {
          border-color: #6366f1;
          background: rgba(99, 102, 241, 0.05);
        }
        
        .invest-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 1rem;
        }
        
        .invest-type h3 {
          font-size: 1.125rem;
          font-weight: 600;
          margin-bottom: 0.5rem;
        }
        
        .invest-status {
          display: inline-block;
          padding: 0.25rem 0.625rem;
          border-radius: 6px;
          font-size: 0.6875rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        
        .invest-description {
          font-size: 0.875rem;
          color: rgba(255,255,255,0.6);
          margin-bottom: 1.25rem;
          line-height: 1.5;
        }
        
        .invest-details {
          display: flex;
          flex-direction: column;
          gap: 0.625rem;
          margin-bottom: 1.25rem;
        }
        
        .detail-row {
          display: flex;
          justify-content: space-between;
          font-size: 0.8125rem;
        }
        
        .detail-label {
          color: rgba(255,255,255,0.5);
        }
        
        .detail-value {
          font-weight: 500;
        }
        
        .invest-requirements {
          margin-bottom: 1.25rem;
        }
        
        .req-label {
          font-size: 0.75rem;
          color: rgba(255,255,255,0.4);
          margin-bottom: 0.5rem;
          display: block;
        }
        
        .req-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 0.375rem;
        }
        
        .req-tag {
          padding: 0.25rem 0.5rem;
          background: rgba(255,255,255,0.05);
          border-radius: 4px;
          font-size: 0.75rem;
          color: rgba(255,255,255,0.7);
        }
        
        .invest-select-btn {
          width: 100%;
          padding: 0.75rem;
          border-radius: 10px;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.03);
          color: rgba(255,255,255,0.8);
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          font-family: inherit;
        }
        
        .invest-select-btn:hover {
          background: rgba(99, 102, 241, 0.1);
          border-color: #6366f1;
          color: white;
        }
        
        .invest-select-btn.selected {
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          border-color: transparent;
          color: white;
        }
        
        @media (max-width: 1024px) {
          .charts-section {
            grid-template-columns: 1fr;
          }
          
          .radar-card {
            display: flex;
            flex-direction: column;
            align-items: center;
          }
        }
        
        @media (max-width: 768px) {
          .main-header {
            flex-direction: column;
            gap: 1rem;
            padding: 1rem;
          }
          
          .window-tabs {
            width: 100%;
            justify-content: center;
          }
          
          .window-tab {
            padding: 0.5rem 0.75rem;
            font-size: 0.8125rem;
          }
          
          .window-tab-text {
            display: none;
          }
          
          .main-content {
            padding: 1rem;
          }
          
          .investment-grid {
            grid-template-columns: 1fr;
          }
          
          .invest-summary {
            flex-wrap: wrap;
          }
          
          .summary-card {
            flex: 1;
            min-width: 100px;
          }
        }
        .password-screen {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #08080c;
        }

        .password-box {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px;
          padding: 2.5rem;
          width: 100%;
          max-width: 380px;
          text-align: center;
          backdrop-filter: blur(20px);
        }

        .password-box .logo-mark {
          width: 48px;
          height: 48px;
          margin: 0 auto 1.5rem;
          font-size: 1.375rem;
        }

        .password-box h2 {
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 1.25rem;
          font-weight: 700;
          margin-bottom: 0.5rem;
          color: #e8e8ed;
        }

        .password-box p {
          font-size: 0.875rem;
          color: rgba(255,255,255,0.5);
          margin-bottom: 1.5rem;
        }

        .password-input {
          width: 100%;
          padding: 0.75rem 1rem;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px;
          color: #e8e8ed;
          font-family: 'DM Sans', sans-serif;
          font-size: 0.9375rem;
          outline: none;
          transition: border-color 0.2s;
        }

        .password-input:focus {
          border-color: #6366f1;
        }

        .password-input.error {
          border-color: #ef4444;
        }

        .password-error {
          color: #ef4444;
          font-size: 0.8125rem;
          margin-top: 0.5rem;
          min-height: 1.25rem;
        }

        .password-submit {
          width: 100%;
          padding: 0.75rem;
          margin-top: 1rem;
          background: linear-gradient(135deg, #6366f1, #a855f7);
          border: none;
          border-radius: 8px;
          color: white;
          font-family: 'DM Sans', sans-serif;
          font-weight: 600;
          font-size: 0.9375rem;
          cursor: pointer;
          transition: opacity 0.2s;
        }

        .password-submit:hover {
          opacity: 0.9;
        }
      `}</style>

      {!isAuthenticated ? (
        <div className="password-screen">
          <form className="password-box" onSubmit={handlePasswordSubmit}>
            <div className="logo-mark">S</div>
            <h2>Startup Evaluator</h2>
            <p>Enter the password to continue</p>
            <input
              type="password"
              className={`password-input${passwordError ? ' error' : ''}`}
              placeholder="Password"
              value={passwordInput}
              onChange={(e) => { setPasswordInput(e.target.value); setPasswordError(''); }}
              autoFocus
            />
            <div className="password-error">{passwordError}</div>
            <button type="submit" className="password-submit">Enter</button>
          </form>
        </div>
      ) : (
      <div className="app-container">
        <header className="main-header">
          <div className="logo">
            <div className="logo-mark">S</div>
            <span className="logo-text">Startup Evaluator</span>
          </div>
          
          <div className="window-tabs">
            <button 
              className={`window-tab ${activeWindow === 0 ? 'active' : ''}`}
              onClick={() => setActiveWindow(0)}
            >
              <span className="window-tab-icon">💬</span>
              <span className="window-tab-text">Onboarding</span>
            </button>
            <button 
              className={`window-tab ${activeWindow === 1 ? 'active' : ''}`}
              onClick={() => setActiveWindow(1)}
            >
              <span className="window-tab-icon">📊</span>
              <span className="window-tab-text">Evaluation</span>
            </button>
            <button 
              className={`window-tab ${activeWindow === 2 ? 'active' : ''}`}
              onClick={() => setActiveWindow(2)}
            >
              <span className="window-tab-icon">💰</span>
              <span className="window-tab-text">Investments</span>
            </button>
          </div>
        </header>
        
        <main className="main-content">
          {activeWindow === 0 && renderChatWindow()}
          {activeWindow === 1 && renderEvaluationWindow()}
          {activeWindow === 2 && renderInvestmentWindow()}
        </main>
      </div>
      )}
    </>
  );
}
