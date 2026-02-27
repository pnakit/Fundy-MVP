import { useState } from 'react';
import {
  MOCK_EVALUATION_DATA,
  MOCK_INVESTMENT_DATA,
  INVESTMENT_ACTIONS,
  ONBOARDING_CATEGORIES,
  MOCK_ONBOARDING_SUMMARY,
  INITIAL_ACTION_ITEMS,
  EVALUATION_DIMENSIONS,
  MATURITY_STAGES,
} from './data/mockData';
import DifyAPI from './api/difyApi';
import { extractOnboardingSummary, SUMMARY_START_MARKER } from './utils/extractSummary';
import {
  getSuitabilityColor,
  getStatusColor,
  getPriorityColor,
  getCategoryStatusColor,
  getMaturityColor,
  getPerformanceColor,
  getPerformanceLabel,
  getMaturityLabel,
} from './utils/colors';
import RadarChart from './components/RadarChart';
import ProgressRing from './components/ProgressRing';
import ChatPanel from './components/ChatPanel';
import PasswordScreen from './components/PasswordScreen';
import ErrorBoundary from './components/ErrorBoundary';
import { addInvestmentActions, removeInvestmentActions } from './utils/actionItems';

let nextActionId = 100;
function generateActionId() {
  return nextActionId++;
}

export default function StartupPlatform() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => sessionStorage.getItem('fundy_authenticated') === 'true'
  );
  const [activeWindow, setActiveWindow] = useState(0);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Welcome to Startup Evaluator! I'm here to help understand your business and provide tailored insights. Let's start with the basics — what's your company name and what problem are you solving?" }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [evaluationData, _setEvaluationData] = useState(MOCK_EVALUATION_DATA);
  const [investmentData, _setInvestmentData] = useState(MOCK_INVESTMENT_DATA);
  const [actionItems, setActionItems] = useState(INITIAL_ACTION_ITEMS);
  const [selectedInvestments, setSelectedInvestments] = useState([]);
  const [expandedAction, setExpandedAction] = useState(null);
  const [onboardingPhase, setOnboardingPhase] = useState('chat');
  const [onboardingSummary, setOnboardingSummary] = useState(null);
  const [activeCategory, setActiveCategory] = useState(null);
  const [categoryConversations, setCategoryConversations] = useState({});
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [expandedDimension, setExpandedDimension] = useState(null);

  // Process a completed Dify response — check for summary, update messages
  const processCompletedResponse = (response) => {
    setConversationId(response.conversationId);
    setUploadedFiles([]);

    const result = extractOnboardingSummary(response.message);

    if (result && result.error) {
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
      const conversationalPart = response.message
        .substring(0, response.message.indexOf(SUMMARY_START_MARKER))
        .trim();

      if (conversationalPart) {
        setMessages(prev => [...prev, { role: 'assistant', content: conversationalPart }]);
      }

      setOnboardingSummary(result);
      setOnboardingPhase('summary');
    } else {
      setMessages(prev => [...prev, { role: 'assistant', content: response.message }]);
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    const currentMessage = inputValue;
    setMessages(prev => [...prev, { role: 'user', content: currentMessage }]);
    setInputValue('');

    if (DifyAPI.useStreaming && !DifyAPI.isMock) {
      setMessages(prev => [...prev, { role: 'assistant', content: '', isStreaming: true }]);

      try {
        const response = await DifyAPI.sendMessageStreaming(
          currentMessage, conversationId, uploadedFiles, 'default-user',
          (accumulated) => {
            const markerIdx = accumulated.indexOf(SUMMARY_START_MARKER);
            if (markerIdx === -1) {
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: 'assistant', content: accumulated, isStreaming: true };
                return updated;
              });
            } else {
              const conversational = accumulated.substring(0, markerIdx).trim();
              const jsonPart = accumulated.substring(markerIdx);
              const idMatches = jsonPart.match(/"id"\s*:\s*"([^"]+)"/g) || [];
              const categoriesFound = idMatches.length;
              // Extract the last category ID to look up its title
              const lastIdMatch = jsonPart.match(/"id"\s*:\s*"([^"]+)"/g);
              let currentCategoryTitle = '';
              if (lastIdMatch && lastIdMatch.length > 0) {
                const lastId = lastIdMatch[lastIdMatch.length - 1].match(/"id"\s*:\s*"([^"]+)"/)[1];
                const catDef = ONBOARDING_CATEGORIES.find(c => c.id === lastId);
                currentCategoryTitle = catDef ? catDef.title : lastId;
              }
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  role: 'assistant',
                  content: conversational,
                  isStreaming: true,
                  isSummaryGenerating: true,
                  categoriesFound,
                  currentCategoryTitle,
                };
                return updated;
              });
            }
          },
          'onboarding',
          (progress) => {
            setMessages(prev => {
              const last = prev[prev.length - 1];
              if (last?.isStreaming && !last?.content && !last?.isSummaryGenerating) {
                const updated = [...prev];
                updated[updated.length - 1] = { ...last, workflowNode: progress.title };
                return updated;
              }
              return prev;
            });
          }
        );

        setConversationId(response.conversationId);
        setUploadedFiles([]);
        const result = extractOnboardingSummary(response.message);

        if (result && result.error) {
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
      } catch (_error) {
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: 'I apologize, but I encountered an error. Please try again.' };
          return updated;
        });
      }
    } else {
      setIsTyping(true);
      try {
        const response = await DifyAPI.sendMessage(currentMessage, conversationId, uploadedFiles);
        processCompletedResponse(response);
      } catch (_error) {
        setMessages(prev => [...prev, { role: 'assistant', content: "I apologize, but I encountered an error. Please try again." }]);
      }
      setIsTyping(false);
    }
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const fileNames = files.map((f) => f.name);
    setMessages((prev) => [...prev, { role: 'user', content: `Uploaded: ${fileNames.join(', ')}`, isFile: true }]);
    setIsTyping(true);

    const succeeded = [];
    const failed = [];

    for (const file of files) {
      try {
        const result = await DifyAPI.uploadFile(file);
        setUploadedFiles((prev) => [...prev, { fileId: result.fileId, fileName: file.name }]);
        succeeded.push(file.name);
      } catch (_error) {
        failed.push(file.name);
      }
    }

    if (succeeded.length > 0) {
      const namesStr = succeeded.map((n) => `"${n}"`).join(', ');
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `I've received ${namesStr}. Send a message to incorporate ${succeeded.length === 1 ? 'it' : 'them'} into your evaluation.`,
        },
      ]);
      const prompt =
        succeeded.length === 1
          ? `I've uploaded "${succeeded[0]}". Please review it and ask me any relevant questions.`
          : `I've uploaded ${succeeded.length} files (${succeeded.join(', ')}). Please review them and ask me any relevant questions.`;
      setInputValue(prompt);
    }

    if (failed.length > 0) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `There was an issue uploading: ${failed.join(', ')}. Please try again.`,
          isError: true,
        },
      ]);
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
    setSelectedInvestments((prev) => {
      const isSelected = prev.includes(investmentId);
      if (isSelected) {
        setActionItems((prevActions) => removeInvestmentActions(prevActions, investmentId));
        return prev.filter((id) => id !== investmentId);
      } else {
        const rawActions = INVESTMENT_ACTIONS[investmentId] || [];
        setActionItems((prevActions) => addInvestmentActions(prevActions, investmentId, rawActions, generateActionId));
        return [...prev, investmentId];
      }
    });
  };

  const handleCategoryClick = (categoryId) => {
    setActiveCategory(categoryId);
    setOnboardingPhase('deep-dive');

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
      appendAssistant('', { isStreaming: true });

      try {
        const response = await DifyAPI.sendMessageStreaming(
          currentMessage, convState.conversationId, uploadedFiles, 'default-user',
          (accumulated) => updateLastMessage(accumulated, { isStreaming: true }),
          'deepdive',
          (progress) => {
            setCategoryConversations(prev => {
              const msgs = prev[categoryId]?.messages;
              if (!msgs) return prev;
              const last = msgs[msgs.length - 1];
              if (last?.isStreaming && !last?.content) {
                const updated = [...msgs];
                updated[updated.length - 1] = { ...last, workflowNode: progress.title };
                return { ...prev, [categoryId]: { ...prev[categoryId], messages: updated } };
              }
              return prev;
            });
          }
        );

        setUploadedFiles([]);
        const prefix = response.fallback ? '[onboarding] ' : '';
        updateLastMessage(prefix + response.message, { conversationId: response.conversationId });
      } catch (_error) {
        updateLastMessage('I apologize, but I encountered an error. Please try again.');
      }
    } else {
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
      } catch (_error) {
        appendAssistant('I apologize, but I encountered an error. Please try again.');
      }
      setIsTyping(false);
    }
  };

  const handleDeepDiveFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0 || !activeCategory) return;

    const categoryId = activeCategory;
    const fileNames = files.map((f) => f.name);

    setCategoryConversations((prev) => ({
      ...prev,
      [categoryId]: {
        ...prev[categoryId],
        messages: [...prev[categoryId].messages, { role: 'user', content: `Uploaded: ${fileNames.join(', ')}`, isFile: true }],
      },
    }));
    setIsTyping(true);

    const succeeded = [];
    const failed = [];

    for (const file of files) {
      try {
        const result = await DifyAPI.uploadFile(file, 'default-user', 'deepdive');
        setUploadedFiles((prev) => [...prev, { fileId: result.fileId, fileName: file.name }]);
        succeeded.push(file.name);
      } catch (_error) {
        failed.push(file.name);
      }
    }

    if (succeeded.length > 0) {
      const namesStr = succeeded.map((n) => `"${n}"`).join(', ');
      setCategoryConversations((prev) => ({
        ...prev,
        [categoryId]: {
          ...prev[categoryId],
          messages: [
            ...prev[categoryId].messages,
            {
              role: 'assistant',
              content: `I've received ${namesStr}. Send a message to incorporate ${succeeded.length === 1 ? 'it' : 'them'} into our discussion.`,
            },
          ],
        },
      }));
      const prompt =
        succeeded.length === 1
          ? `I've uploaded "${succeeded[0]}". Please incorporate this into our discussion.`
          : `I've uploaded ${succeeded.length} files (${succeeded.join(', ')}). Please incorporate them into our discussion.`;
      setInputValue(prompt);
    }

    if (failed.length > 0) {
      setCategoryConversations((prev) => ({
        ...prev,
        [categoryId]: {
          ...prev[categoryId],
          messages: [
            ...prev[categoryId].messages,
            {
              role: 'assistant',
              content: `There was an issue uploading: ${failed.join(', ')}. Please try again.`,
              isError: true,
            },
          ],
        },
      }));
    }

    setIsTyping(false);
    e.target.value = '';
  };

  // Render message content with mock badge and file support
  const renderMessageContent = (msg) => {
    if (msg.isStreaming && !msg.content && !msg.isSummaryGenerating) {
      return (
        <div className="workflow-progress">
          <span className="workflow-progress-icon">&#10022;</span>
          <span className="workflow-progress-text">
            {msg.workflowNode || 'Starting'}<span className="spaced-ellipsis"><span> .</span><span> .</span><span> .</span></span>
          </span>
        </div>
      );
    }
    if (msg.isSummaryGenerating) {
      return (
        <>
          {msg.content && <p>{msg.content}</p>}
          <div className="summary-progress">
            <div className="summary-progress-header">
              <span className="summary-progress-icon">&#10022;</span>
              Preparing your evaluation...
            </div>
            <div className="summary-progress-bar-track">
              <div
                className="summary-progress-bar-fill"
                style={{ width: `${(msg.categoriesFound / 10) * 100}%` }}
              />
            </div>
            <div className="summary-progress-detail">
              {msg.categoriesFound === 0 ? (
                <span>Beginning analysis<span className="spaced-ellipsis"><span> .</span><span> .</span><span> .</span></span></span>
              ) : (
                <span>Analyzing {msg.currentCategoryTitle}<span className="spaced-ellipsis"><span> .</span><span> .</span><span> .</span></span> <span className="summary-progress-count">{msg.categoriesFound}/10</span></span>
              )}
            </div>
          </div>
        </>
      );
    }
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

  const renderDeepDiveMessageContent = (msg) => {
    if (msg.isStreaming && !msg.content) {
      return (
        <div className="workflow-progress">
          <span className="workflow-progress-icon">&#10022;</span>
          <span className="workflow-progress-text">
            {msg.workflowNode || 'Starting'}<span className="spaced-ellipsis"><span> .</span><span> .</span><span> .</span></span>
          </span>
        </div>
      );
    }
    if (msg.isFile) {
      return <div className="file-message">{msg.content}</div>;
    }
    return msg.content;
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
  const renderOnboardingChat = () => (
    <ChatPanel
      messages={messages}
      isTyping={isTyping}
      inputValue={inputValue}
      onInputChange={setInputValue}
      onSend={handleSendMessage}
      onFileUpload={handleFileUpload}
      placeholder="Type your message..."
      renderMessageContent={renderMessageContent}
      headerContent={
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
      }
    />
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
              <ProgressRing size={48} radius={20} strokeWidth={4} percent={summary.overallCompleteness} color="#6366f1" fontSize={12} />
              <span className="completeness-label">Overall</span>
            </div>
          </div>
        </div>

        <div className="category-grid-container">
          <div className="category-grid">
            {summary.categories.map(category => {
              const catDef = ONBOARDING_CATEGORIES.find(c => c.id === category.id);
              const statusColor = getCategoryStatusColor(category.status);

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
                      <ProgressRing size={44} radius={18} strokeWidth={3} percent={category.completeness} color={statusColor} fontSize={11} />
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

    return (
      <ChatPanel
        messages={convState.messages}
        isTyping={isTyping}
        inputValue={inputValue}
        onInputChange={setInputValue}
        onSend={handleDeepDiveSendMessage}
        onFileUpload={handleDeepDiveFileUpload}
        placeholder={`Ask about ${category?.title || 'this category'}...`}
        renderMessageContent={renderDeepDiveMessageContent}
        headerContent={
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
                <ProgressRing size={44} radius={18} strokeWidth={3} percent={category?.completeness || 0} color={statusColor} fontSize={11} />
              </div>
            </div>
          </div>
        }
      />
    );
  };

  // Window 2: Evaluation & Actions
  const renderEvaluationWindow = () => {
    const PRIORITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

    // Enrich dimensions with metadata, sorted by performance ascending (worst first)
    const enrichedDimensions = evaluationData.dimensions
      .map((d) => ({
        ...d,
        ...EVALUATION_DIMENSIONS.find((ed) => ed.id === d.id),
      }))
      .sort((a, b) => a.performanceScore - b.performanceScore);

    // Radar chart data: maturity levels scaled to 0-100
    const radarData = evaluationData.dimensions.map((d) => {
      const def = EVALUATION_DIMENSIONS.find((ed) => ed.id === d.id);
      return { name: def?.shortTitle || d.id, score: d.maturityLevel * 20 };
    });

    // Group evaluation action items by dimension, sorted worst-performing first
    const evaluationActions = actionItems.filter((a) => a.sourceType === 'evaluation');
    const actionsByDimension = enrichedDimensions
      .filter((d) => evaluationActions.some((a) => a.dimensionId === d.id))
      .map((d) => ({
        dimension: d,
        actions: evaluationActions
          .filter((a) => a.dimensionId === d.id)
          .sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 4) - (PRIORITY_ORDER[b.priority] ?? 4)),
      }));

    // Investment-sourced actions (shown after evaluation groups)
    const investmentActions = actionItems.filter((a) => a.sourceType === 'investment');

    return (
      <div className="evaluation-window">
        <div className="eval-header">
          <div>
            <h2>Evaluation & Actions</h2>
            <p>Your company&apos;s evaluation across key business dimensions</p>
          </div>
        </div>

        <div className="eval-content">
          {/* Overall Assessment */}
          <div className="eval-overall-card">
            <div className="eval-overall-row">
              <div className="eval-overall-box">
                <span className="eval-overall-label">Stage</span>
                <span className="eval-overall-value">{evaluationData.overallMaturity.name}</span>
                <div className="maturity-track">
                  {MATURITY_STAGES.map((stage) => (
                    <div
                      key={stage.level}
                      className={`track-step ${stage.level <= evaluationData.overallMaturity.level ? 'completed' : ''} ${stage.level === evaluationData.overallMaturity.level ? 'current' : ''}`}
                    >
                      <div className="track-dot"></div>
                      <span>{stage.name}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="eval-overall-box">
                <span className="eval-overall-label">Progress</span>
                <span className="eval-overall-value">
                  {evaluationData.overallPerformance.score} <span className="eval-overall-unit">/ 5</span>
                </span>
                <span className="eval-overall-sublabel" style={{ color: getPerformanceColor(evaluationData.overallPerformance.score) }}>
                  {evaluationData.overallPerformance.label}
                </span>
              </div>
            </div>
            <p className="eval-description">{evaluationData.description}</p>
          </div>

          {/* Dimension Analysis — radar + progress details side by side */}
          <div className="dimension-analysis">
            <div className="dimension-analysis-chart">
              <h3>Maturity</h3>
              <div className="radar-container">
                <RadarChart data={radarData} size={300} />
              </div>
            </div>
            <div className="dimension-analysis-details">
              <h3>Progress Details</h3>
              <div className="dimension-grid">
                {enrichedDimensions.map((dim) => (
                  <div
                    key={dim.id}
                    className={`dimension-card ${expandedDimension === dim.id ? 'expanded' : ''}`}
                    onClick={() => setExpandedDimension(expandedDimension === dim.id ? null : dim.id)}
                  >
                    <div className="dimension-card-top">
                      <span className="dimension-icon">{dim.icon}</span>
                      <span className="dimension-title">{dim.title}</span>
                    </div>
                    <span className="perf-label" style={{ color: getPerformanceColor(dim.performanceScore) }}>
                      {dim.performanceScore}/5 {getPerformanceLabel(dim.performanceScore)}
                    </span>
                    <div className="dimension-card-perf">
                      <div className="perf-bar">
                        {[1, 2, 3, 4, 5].map((seg) => (
                          <div
                            key={seg}
                            className={`perf-bar-segment ${seg <= dim.performanceScore ? 'filled' : ''}`}
                            style={seg <= dim.performanceScore ? { background: getPerformanceColor(dim.performanceScore) } : undefined}
                          />
                        ))}
                      </div>
                    </div>
                    <span className="dimension-expand-hint">
                      {expandedDimension === dim.id ? 'Details ▴' : 'Details ▾'}
                    </span>
                    {expandedDimension === dim.id && (
                      <div className="dimension-description">{dim.description}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Action Items */}
          <div className="actions-section">
            <div className="actions-header">
              <h3>Action Items <span className="action-count">{actionItems.filter((a) => a.status !== 'completed').length} pending</span></h3>
            </div>

            <div className="action-cards">
              {actionsByDimension.map(({ dimension, actions }) => (
                <div key={dimension.id} className="action-dimension-group">
                  <div className="action-dimension-header">
                    <span>{dimension.icon}</span>
                    <span className="action-dimension-name">{dimension.title}</span>
                    <span className="action-dimension-perf-badge" style={{ background: `${getPerformanceColor(dimension.performanceScore)}20`, color: getPerformanceColor(dimension.performanceScore), borderColor: `${getPerformanceColor(dimension.performanceScore)}40` }}>
                      {getPerformanceLabel(dimension.performanceScore)}
                    </span>
                  </div>
                  {actions.map((action) => (
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
                              onClick={() => setActionItems((prev) => prev.map((a) => (a.id === action.id ? { ...a, status: 'completed' } : a)))}
                            >
                              Mark Complete
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))}

              {investmentActions.length > 0 && (
                <div className="action-dimension-group">
                  <div className="action-dimension-header">
                    <span>💰</span>
                    <span className="action-dimension-name">Investment Actions</span>
                  </div>
                  {investmentActions.map((action) => (
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
                          {action.sourceId && (
                            <span className="action-source">{MOCK_INVESTMENT_DATA.investments.find((i) => i.id === action.sourceId)?.type}</span>
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
                              onClick={() => setActionItems((prev) => prev.map((a) => (a.id === action.id ? { ...a, status: 'completed' } : a)))}
                            >
                              Mark Complete
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

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
            <span className="summary-value">{actionItems.filter(a => a.sourceType === 'investment').length}</span>
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
                    <ProgressRing size={60} radius={26} strokeWidth={4} percent={investment.suitability} color={getSuitabilityColor(investment.suitability)} fontSize={14} />
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

  if (!isAuthenticated) {
    return <PasswordScreen onAuthenticated={() => setIsAuthenticated(true)} />;
  }

  return (
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
        {activeWindow === 0 && <ErrorBoundary name="Onboarding">{renderChatWindow()}</ErrorBoundary>}
        {activeWindow === 1 && <ErrorBoundary name="Evaluation">{renderEvaluationWindow()}</ErrorBoundary>}
        {activeWindow === 2 && <ErrorBoundary name="Investments">{renderInvestmentWindow()}</ErrorBoundary>}
      </main>
    </div>
  );
}
