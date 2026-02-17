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

// Dify API placeholder
const DifyAPI = {
  baseUrl: "https://api.dify.ai/v1", // Placeholder
  apiKey: "YOUR_DIFY_API_KEY", // Placeholder
  
  async sendMessage(message, conversationId = null) {
    // Placeholder - simulate API call
    console.log("Dify API Call:", { message, conversationId });
    
    // Simulate response delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Mock response based on message content
    const responses = [
      "Thanks for sharing that information. I've recorded your company details. Could you tell me more about your target market and customer segments?",
      "That's helpful context. What stage would you say your product is at? Are you pre-revenue, early revenue, or scaling?",
      "Great progress! Can you share some metrics around your current traction? Things like MRR, customer count, or growth rates would be useful.",
      "I've updated your profile with this information. Based on what you've shared, I can see some interesting patterns emerging. Would you like to discuss your funding strategy next?",
      "Thanks for the details. I've captured this in your company profile. Is there anything specific about your business model or competitive landscape you'd like to elaborate on?"
    ];
    
    return {
      message: responses[Math.floor(Math.random() * responses.length)],
      conversationId: conversationId || "conv_" + Date.now(),
      data: MOCK_EVALUATION_DATA
    };
  },
  
  async uploadFile(file) {
    console.log("Dify File Upload:", file.name);
    await new Promise(resolve => setTimeout(resolve, 1000));
    return { success: true, fileId: "file_" + Date.now() };
  },
  
  async getEvaluation() {
    await new Promise(resolve => setTimeout(resolve, 500));
    return MOCK_EVALUATION_DATA;
  },
  
  async getInvestmentMatches() {
    await new Promise(resolve => setTimeout(resolve, 500));
    return MOCK_INVESTMENT_DATA;
  }
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
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    if (passwordInput === 'fundy2026') {
      setIsAuthenticated(true);
      setPasswordError('');
    } else {
      setPasswordError('Incorrect password');
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;
    
    const userMessage = { role: 'user', content: inputValue };
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);
    
    try {
      const response = await DifyAPI.sendMessage(inputValue, conversationId);
      setConversationId(response.conversationId);
      setMessages(prev => [...prev, { role: 'assistant', content: response.message }]);
      
      // Update evaluation data from response
      if (response.data) {
        setEvaluationData(response.data);
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: "I apologize, but I encountered an error. Please try again." }]);
    }
    
    setIsTyping(false);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setMessages(prev => [...prev, { role: 'user', content: `📎 Uploaded: ${file.name}`, isFile: true }]);
    setIsTyping(true);
    
    try {
      await DifyAPI.uploadFile(file);
      setMessages(prev => [...prev, { role: 'assistant', content: `I've received "${file.name}". I'll analyze this document and incorporate the insights into your evaluation. Is there anything specific in this document you'd like me to focus on?` }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: "There was an issue uploading your file. Please try again." }]);
    }
    
    setIsTyping(false);
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

  // Window 1: Chat Onboarding
  const renderChatWindow = () => (
    <div className="chat-window">
      <div className="chat-header">
        <div className="chat-title">
          <div className="chat-avatar">💬</div>
          <div>
            <h2>Company Onboarding</h2>
            <span>Share your company information through conversation</span>
          </div>
        </div>
        <div className="chat-status">
          <span className="status-dot"></span>
          Connected to Dify
        </div>
      </div>
      
      <div className="chat-messages">
        {messages.map((msg, idx) => (
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
