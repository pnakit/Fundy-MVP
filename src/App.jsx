import { useState, useEffect, useRef } from 'react';
import {
  MOCK_INVESTMENT_DATA,
  INVESTMENT_ACTIONS,
  ONBOARDING_CATEGORIES,
  MOCK_ONBOARDING_SUMMARY,
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
  getPerformanceColor,
  getPerformanceLabel,
} from './utils/colors';
import RadarChart from './components/RadarChart';
import ProgressRing from './components/ProgressRing';
import ChatPanel from './components/ChatPanel';
import LoginScreen from './components/LoginScreen';
import {
  getSession,
  signOut,
  onAuthStateChange,
  loadOnboardingSummary,
  loadEvaluation,
  loadInvestmentSelections,
  loadActionItems,
  upsertInvestmentSelection,
  saveActionItem,
  updateActionItemStatus,
  deleteActionItemsBySourceId,
  createConversation,
  updateConversationDifyId,
  saveMessages,
  loadMessages,
  loadOnboardingConversation,
  loadDeepDiveConversations,
} from './api/dataAccess';
import ErrorBoundary from './components/ErrorBoundary';
import { addInvestmentActions, removeInvestmentActions } from './utils/actionItems';
import { uploadFiles, buildUploadMessages } from './utils/fileUpload';
import { generateEvaluation } from './api/evaluationApi';

const CHAT_ERROR_MESSAGE = 'I apologize, but I encountered an error. Please try again.';

/** Reconstruct evaluationData state shape from a DB evaluations row. */
function mapDbEvalToState(dbRow) {
  return {
    companyName: dbRow.maturity_stage?.companyName,
    overallMaturity: dbRow.maturity_stage?.overallMaturity,
    overallPerformance: dbRow.performance_metrics?.overallPerformance,
    description: dbRow.maturity_stage?.description,
    dimensions: dbRow.dimensions || [],
  };
}

/** Reconstruct action item state shape from a DB action_items row. */
function mapDbActionToState(dbRow) {
  return {
    id: dbRow.id,
    title: dbRow.title,
    description: dbRow.description || '',
    priority: dbRow.priority || 'medium',
    status: dbRow.status || 'pending',
    sourceType: dbRow.source_type || null,
    sourceId: dbRow.source_id || null,
    dimensionId: dbRow.dimension_id || null,
    actionKey: dbRow.action_key || null,
    files: [],
    inputs: {},
  };
}

/** Replace the last message in a messages array. Returns a new array. */
function replaceLastMessage(messages, newMsg) {
  const updated = [...messages];
  updated[updated.length - 1] = newMsg;
  return updated;
}

export default function StartupPlatform() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeWindow, setActiveWindow] = useState(0);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Welcome to Fundy MVP! I'm here to help understand your business and provide tailored insights. Let's start with the basics — what's your company name and what problem are you solving?" }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [evaluationData, setEvaluationData] = useState(null);
  const [evaluationLoading, setEvaluationLoading] = useState(false);
  const [evaluationProgress, setEvaluationProgress] = useState(new Set());
  const [evaluationStatus, setEvaluationStatus] = useState(null);
  const [evaluationError, setEvaluationError] = useState(null);
  const [evaluationWarning, setEvaluationWarning] = useState(null);
  const [investmentData, _setInvestmentData] = useState(MOCK_INVESTMENT_DATA);
  const [actionItems, setActionItems] = useState([]);
  const [selectedInvestments, setSelectedInvestments] = useState([]);
  const [expandedAction, setExpandedAction] = useState(null);
  const [onboardingPhase, setOnboardingPhase] = useState('chat');
  const [onboardingSummary, setOnboardingSummary] = useState(null);
  const [activeCategory, setActiveCategory] = useState(null);
  const [categoryConversations, setCategoryConversations] = useState({});
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [expandedDimension, setExpandedDimension] = useState(null);

  // Refs track Supabase conversation UUIDs — using refs avoids stale closure
  // issues in fire-and-forget async helpers called from streaming callbacks.
  const conversationDbIdRef = useRef(null);    // onboarding conversation DB UUID
  const deepDiveConvDbIdsRef = useRef({});     // { [categoryId]: DB UUID }

  // ─── Persistence helpers ──────────────────────────────────────────────

  /** Save the onboarding summary to Supabase and embed it for KB search. Fire-and-forget. */
  const persistSummary = async (summary) => {
    try {
      const session = await getSession();
      if (!session) return;
      const res = await fetch('/api/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ onboardingSummary: summary, onboardingPhase: 'summary' }),
      });
      if (!res.ok) console.error('[persistSummary] HTTP', res.status);
    } catch (err) {
      console.error('[persistSummary] Failed:', err.message);
    }
  };

  /** Save the completed evaluation result to Supabase. Fire-and-forget. */
  const persistEvaluation = async (data) => {
    if (!data?.dimensions?.length) return;
    try {
      const session = await getSession();
      if (!session) return;
      const evalActionItems = actionItems
        .filter((a) => a.sourceType === 'evaluation')
        .map((a) => ({
          title: a.title,
          description: a.description,
          priority: a.priority,
          dimensionId: a.dimensionId,
          actionKey: a.actionKey,
          sourceId: a.sourceId,
        }));
      const res = await fetch('/api/evaluation/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ evaluationData: data, actionItems: evalActionItems }),
      });
      if (!res.ok) console.error('[persistEvaluation] HTTP', res.status);
    } catch (err) {
      console.error('[persistEvaluation] Failed:', err.message);
    }
  };

  /**
   * Save a user+assistant exchange to the conversations + messages tables. Fire-and-forget.
   * Creates the conversation row on first call; reuses the stored DB UUID on subsequent calls.
   * Skips if assistantMsg is empty or an error message.
   * @param {'onboarding'|'deepdive'} workflow
   * @param {string|null} categoryId - null for onboarding, category ID for deep-dive
   * @param {string} userMsg
   * @param {string} assistantMsg
   * @param {string|null} difyConvId - Dify's conversation ID (to store for later resumption)
   */
  const persistConversationExchange = async (workflow, categoryId, userMsg, assistantMsg, difyConvId) => {
    if (!assistantMsg || assistantMsg === CHAT_ERROR_MESSAGE) return;
    if (!session?.user?.id) return;
    const userId = session.user.id;
    try {
      let dbId =
        workflow === 'onboarding' ? conversationDbIdRef.current : deepDiveConvDbIdsRef.current[categoryId];

      if (!dbId) {
        dbId = await createConversation(workflow, categoryId);
        if (!dbId) return;
        if (workflow === 'onboarding') conversationDbIdRef.current = dbId;
        else deepDiveConvDbIdsRef.current = { ...deepDiveConvDbIdsRef.current, [categoryId]: dbId };
      }

      if (difyConvId) updateConversationDifyId(dbId, difyConvId); // fire-and-forget, idempotent
      await saveMessages(dbId, userId, [
        { role: 'user', content: userMsg },
        { role: 'assistant', content: assistantMsg },
      ]);
    } catch (err) {
      console.error('[persistConversationExchange] Failed:', err.message);
    }
  };

  /** Restore all persisted user data from Supabase after sign-in. */
  const restoreUserData = async () => {
    try {
      const [savedSummary, savedEval, savedInvestments, savedActions, savedOnboardingConv, savedDeepDive] =
        await Promise.all([
          loadOnboardingSummary(),
          loadEvaluation(),
          loadInvestmentSelections(),
          loadActionItems(),
          loadOnboardingConversation(),
          loadDeepDiveConversations(),
        ]);

      if (savedSummary) {
        setOnboardingSummary(savedSummary.summaryData);
        setOnboardingPhase('summary');
      }
      if (savedEval) {
        setEvaluationData(mapDbEvalToState(savedEval));
      }
      if (savedInvestments.length > 0) {
        setSelectedInvestments(savedInvestments);
      }
      if (savedActions.length > 0) {
        setActionItems(savedActions.map(mapDbActionToState));
      }

      // Restore conversation DB IDs into refs (prevents duplicate rows on re-send)
      // and restore Dify's conversation ID so resumed chats continue the same thread.
      if (savedOnboardingConv) {
        conversationDbIdRef.current = savedOnboardingConv.id;
        if (savedOnboardingConv.dify_conversation_id) {
          setConversationId(savedOnboardingConv.dify_conversation_id);
        }
        // Restore message history so it's available for the read-only conversation view
        // (accessible from the summary view) as well as for mid-onboarding restore.
        const savedMsgs = await loadMessages(savedOnboardingConv.id);
        if (savedMsgs.length > 0) {
          setMessages((prev) => [prev[0], ...savedMsgs]);
        }
      }

      // Restore deep-dive conversation history and IDs (only when summary exists
      // so we have the deepDivePrompt to prepend as the opening message).
      if (Object.keys(savedDeepDive).length > 0 && savedSummary) {
        const restoredConvs = {};
        for (const [catId, conv] of Object.entries(savedDeepDive)) {
          const cat = savedSummary.summaryData.categories.find((c) => c.id === catId);
          const prompt = cat?.deepDivePrompt || `Let's dive deeper into ${catId}.`;
          restoredConvs[catId] = {
            conversationId: conv.conversationId,
            messages: [{ role: 'assistant', content: prompt }, ...conv.messages],
          };
          deepDiveConvDbIdsRef.current[catId] = conv.conversationDbId;
        }
        setCategoryConversations(restoredConvs);
      }
    } catch (err) {
      console.error('[restoreUserData] Failed:', err.message);
    }
  };

  // ─── Auth ─────────────────────────────────────────────────────────────

  // Check existing session on mount + restore persisted data; listen for future auth changes.
  useEffect(() => {
    getSession()
      .then((s) => {
        setSession(s);
        setAuthLoading(false);
        if (s) restoreUserData();
      })
      .catch(() => setAuthLoading(false));

    const unsubscribe = onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'SIGNED_IN') restoreUserData();
    });

    return unsubscribe;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSignOut = async () => {
    await signOut();
    setSession(null);
    // Clear persisted state on sign-out
    setOnboardingSummary(null);
    setOnboardingPhase('chat');
    setEvaluationData(null);
    setSelectedInvestments([]);
    setActionItems([]);
    setConversationId(null);
    setCategoryConversations({});
    conversationDbIdRef.current = null;
    deepDiveConvDbIdsRef.current = {};
  };

  // Process a completed Dify response — check for summary, update messages.
  // Returns the final assistant text to persist, or null if it should not be saved.
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
      return null; // don't persist error exchanges
    } else if (result) {
      const conversationalPart = response.message
        .substring(0, response.message.indexOf(SUMMARY_START_MARKER))
        .trim();

      if (conversationalPart) {
        setMessages(prev => [...prev, { role: 'assistant', content: conversationalPart }]);
      }

      setOnboardingSummary(result);
      setOnboardingPhase('summary');
      persistSummary(result);
      return conversationalPart || null;
    } else {
      setMessages(prev => [...prev, { role: 'assistant', content: response.message }]);
      return response.message;
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
            // Also detect raw JSON from Dify structured output (no markers)
            const isRawJson = markerIdx === -1 && accumulated.trim().startsWith('{');
            if (markerIdx === -1 && !isRawJson) {
              setMessages(prev => replaceLastMessage(prev, { role: 'assistant', content: accumulated, isStreaming: true }));
            } else {
              const conversational = markerIdx !== -1 ? accumulated.substring(0, markerIdx).trim() : '';
              const jsonPart = markerIdx !== -1 ? accumulated.substring(markerIdx) : accumulated;
              const idMatches = jsonPart.match(/"id"\s*:\s*"([^"]+)"/g) || [];
              const categoriesFound = idMatches.length;
              let currentCategoryTitle = '';
              if (idMatches.length > 0) {
                const lastId = idMatches[idMatches.length - 1].match(/"id"\s*:\s*"([^"]+)"/)[1];
                const catDef = ONBOARDING_CATEGORIES.find(c => c.id === lastId);
                currentCategoryTitle = catDef ? catDef.title : lastId;
              }
              setMessages(prev => replaceLastMessage(prev, {
                role: 'assistant',
                content: conversational,
                isStreaming: true,
                isSummaryGenerating: true,
                categoriesFound,
                currentCategoryTitle,
              }));
            }
          },
          'onboarding',
          (progress) => {
            setMessages(prev => {
              const last = prev[prev.length - 1];
              if (last?.isStreaming && !last?.content && !last?.isSummaryGenerating) {
                return replaceLastMessage(prev, { ...last, workflowNode: progress.title });
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
          setMessages(prev => [
            ...replaceLastMessage(prev, {
              role: 'assistant',
              content: conversationalPart || 'I tried to prepare your summary but encountered an issue.',
            }),
            { role: 'assistant', content: `Formatting issue: ${result.message} Let me try again.`, isError: true },
          ]);
        } else if (result) {
          const conversationalPart = response.message
            .substring(0, response.message.indexOf(SUMMARY_START_MARKER))
            .trim();
          setMessages(prev => replaceLastMessage(prev, { role: 'assistant', content: conversationalPart || response.message }));
          setOnboardingSummary(result);
          setOnboardingPhase('summary');
          persistSummary(result);
          if (conversationalPart) {
            persistConversationExchange('onboarding', null, currentMessage, conversationalPart, response.conversationId);
          }
        } else {
          setMessages(prev => replaceLastMessage(prev, { role: 'assistant', content: response.message }));
          persistConversationExchange('onboarding', null, currentMessage, response.message, response.conversationId);
        }
      } catch (error) {
        console.error('[chat/streaming] Send message failed:', error.message);
        setMessages(prev => replaceLastMessage(prev, { role: 'assistant', content: CHAT_ERROR_MESSAGE }));
      }
    } else {
      setIsTyping(true);
      try {
        const response = await DifyAPI.sendMessage(currentMessage, conversationId, uploadedFiles);
        const finalContent = processCompletedResponse(response);
        if (finalContent) {
          persistConversationExchange('onboarding', null, currentMessage, finalContent, response.conversationId);
        }
      } catch (error) {
        console.error('[chat/blocking] Send message failed:', error.message);
        setMessages(prev => [...prev, { role: 'assistant', content: CHAT_ERROR_MESSAGE }]);
      }
      setIsTyping(false);
    }
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setMessages((prev) => [...prev, { role: 'user', content: `Uploaded: ${files.map((f) => f.name).join(', ')}`, isFile: true }]);
    setIsTyping(true);

    const { succeeded, failed, uploadedFiles: newFiles } = await uploadFiles(files);
    setUploadedFiles((prev) => [...prev, ...newFiles]);

    if (succeeded.length > 0) {
      const { message, prompt } = buildUploadMessages(succeeded, 'onboarding');
      setMessages((prev) => [...prev, { role: 'assistant', content: message }]);
      setInputValue(prompt);
    }

    if (failed.length > 0) {
      setMessages((prev) => [...prev, { role: 'assistant', content: `There was an issue uploading: ${failed.join(', ')}. Please try again.`, isError: true }]);
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

  const toggleInvestment = async (investmentId) => {
    const isSelected = selectedInvestments.includes(investmentId);
    if (isSelected) {
      setActionItems((prevActions) => removeInvestmentActions(prevActions, investmentId));
      setSelectedInvestments((prev) => prev.filter((id) => id !== investmentId));
      // Persist: mark deselected + remove action items from DB
      upsertInvestmentSelection(investmentId, false);
      deleteActionItemsBySourceId(investmentId);
    } else {
      const rawActions = INVESTMENT_ACTIONS[investmentId] || [];
      const newActions = addInvestmentActions([], investmentId, rawActions, () => crypto.randomUUID());
      setActionItems((prevActions) => [...prevActions, ...newActions]);
      setSelectedInvestments((prev) => [...prev, investmentId]);
      // Persist: mark selected + save new action items to DB
      upsertInvestmentSelection(investmentId, true);
      const userId = session?.user?.id;
      if (userId) {
        newActions.forEach((action) => saveActionItem(action, userId));
      }
    }
  };

  const handleMarkComplete = (actionId) => {
    setActionItems((prev) => prev.map((a) => (a.id === actionId ? { ...a, status: 'completed' } : a)));
    updateActionItemStatus(actionId, 'completed');
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
      setCategoryConversations(prev => {
        if (!prev[categoryId]) return prev;
        return {
          ...prev,
          [categoryId]: {
            ...prev[categoryId],
            ...extra,
            messages: [...prev[categoryId].messages, { role: 'assistant', content, ...extra }],
          },
        };
      });
    };

    const updateLastMessage = (content, extra = {}) => {
      setCategoryConversations(prev => {
        if (!prev[categoryId]) return prev;
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
        const finalContent = prefix + response.message;
        updateLastMessage(finalContent, { conversationId: response.conversationId });
        persistConversationExchange('deepdive', categoryId, currentMessage, finalContent, response.conversationId);
      } catch (error) {
        console.error('[deepdive/streaming] Send message failed:', error.message);
        updateLastMessage(CHAT_ERROR_MESSAGE);
      }
    } else {
      setIsTyping(true);
      try {
        const response = await DifyAPI.sendMessage(
          currentMessage, convState.conversationId, uploadedFiles, 'default-user', 'deepdive'
        );

        setUploadedFiles([]);
        const prefix = response.fallback ? '[onboarding] ' : '';
        const finalContent = prefix + response.message;

        setCategoryConversations(prev => {
          if (!prev[categoryId]) return prev;
          return {
            ...prev,
            [categoryId]: {
              conversationId: response.conversationId,
              messages: [
                ...prev[categoryId].messages,
                { role: 'assistant', content: finalContent }
              ],
            },
          };
        });
        persistConversationExchange('deepdive', categoryId, currentMessage, finalContent, response.conversationId);
      } catch (error) {
        console.error('[deepdive/blocking] Send message failed:', error.message);
        appendAssistant(CHAT_ERROR_MESSAGE);
      }
      setIsTyping(false);
    }
  };

  const handleDeepDiveFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0 || !activeCategory) return;

    const categoryId = activeCategory;

    setCategoryConversations((prev) => {
      if (!prev[categoryId]) return prev;
      return {
        ...prev,
        [categoryId]: {
          ...prev[categoryId],
          messages: [...prev[categoryId].messages, { role: 'user', content: `Uploaded: ${files.map((f) => f.name).join(', ')}`, isFile: true }],
        },
      };
    });
    setIsTyping(true);

    const { succeeded, failed, uploadedFiles: newFiles } = await uploadFiles(files, 'default-user', 'deepdive');
    setUploadedFiles((prev) => [...prev, ...newFiles]);

    if (succeeded.length > 0) {
      const { message, prompt } = buildUploadMessages(succeeded, 'discussion');
      setCategoryConversations((prev) => {
        if (!prev[categoryId]) return prev;
        return {
          ...prev,
          [categoryId]: {
            ...prev[categoryId],
            messages: [...prev[categoryId].messages, { role: 'assistant', content: message }],
          },
        };
      });
      setInputValue(prompt);
    }

    if (failed.length > 0) {
      setCategoryConversations((prev) => {
        if (!prev[categoryId]) return prev;
        return {
          ...prev,
          [categoryId]: {
            ...prev[categoryId],
            messages: [...prev[categoryId].messages, { role: 'assistant', content: `There was an issue uploading: ${failed.join(', ')}. Please try again.`, isError: true }],
          },
        };
      });
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

  // Window 1: Chat Onboarding — phase dispatcher
  const renderChatWindow = () => {
    switch (onboardingPhase) {
      case 'summary':
        return renderOnboardingSummary();
      case 'deep-dive':
        return renderDeepDive();
      case 'chat-readonly':
        return renderOnboardingChatReadonly();
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

  // Phase 1b: Read-only view of the original onboarding conversation
  const ONBOARDING_READONLY_NOTE = {
    role: 'assistant',
    content:
      'Your onboarding conversation is complete. To provide further context or explore any area in depth, use the category deep dives in your summary dashboard — each category has a dedicated space for ongoing discussion.',
  };

  const renderOnboardingChatReadonly = () => (
    <ChatPanel
      messages={[...messages, ONBOARDING_READONLY_NOTE]}
      readOnly
      renderMessageContent={renderMessageContent}
      headerContent={
        <div className="chat-header">
          <div className="chat-title">
            <div className="chat-avatar">💬</div>
            <div>
              <h2>Onboarding conversation</h2>
              <span>Read-only history</span>
            </div>
          </div>
          <div className="chat-header-right">
            <button className="view-summary-btn" onClick={() => setOnboardingPhase('summary')}>
              ← Back to summary
            </button>
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
          <button className="back-to-chat-btn" onClick={() => setOnboardingPhase('chat-readonly')}>
            ← View conversation
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
        renderMessageContent={renderMessageContent}
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

  // Load sample onboarding data for evaluation testing
  const handleLoadSampleData = () => {
    setOnboardingSummary(MOCK_ONBOARDING_SUMMARY);
    persistSummary(MOCK_ONBOARDING_SUMMARY);
  };

  // Generate evaluation via streaming API
  const handleGenerateEvaluation = async () => {
    if (evaluationLoading) return;
    if (!onboardingSummary?.categories) {
      setEvaluationError('Complete onboarding first to generate an evaluation.');
      return;
    }

    setEvaluationLoading(true);
    setEvaluationError(null);
    setEvaluationWarning(null);
    setEvaluationStatus('Starting evaluation...');
    setEvaluationProgress(new Set());

    // Start with a blank evaluation shell
    setEvaluationData({
      overallMaturity: { level: 0, name: '—' },
      overallPerformance: { score: 0, label: '—' },
      description: '',
      dimensions: [],
    });

    const companyName = onboardingSummary.companyName || 'Unknown Company';

    const result = await generateEvaluation(companyName, onboardingSummary, {
      onCategoryStarted: (categoryId) => {
        setEvaluationProgress((prev) => new Set([...prev, categoryId]));
        const dim = EVALUATION_DIMENSIONS.find((d) => d.id === categoryId);
        setEvaluationStatus(`Evaluating ${dim?.title || categoryId}...`);
      },
      onCategoryComplete: (categoryData) => {
        setEvaluationData((prev) => {
          const dimensions = [...(prev.dimensions || [])];
          const existingIdx = dimensions.findIndex((d) => d.id === categoryData.category_id);
          const completeness = categoryData.completeness ?? 0;
          const dim = {
            id: categoryData.category_id,
            maturityLevel: completeness >= 70 ? 4 : completeness >= 40 ? 3 : completeness >= 20 ? 2 : 1,
            performanceScore: Math.round(completeness / 20),
            description: categoryData.summary,
            status: categoryData.status,
            highlights: categoryData.highlights || [],
            gaps: categoryData.gaps || [],
            keyMetrics: categoryData.keyMetrics || {},
            deepDivePrompt: categoryData.deepDivePrompt || '',
          };
          if (existingIdx >= 0) {
            dimensions[existingIdx] = dim;
          } else {
            dimensions.push(dim);
          }

          // Recalculate overall scores
          const avgPerformance = dimensions.reduce((sum, d) => sum + d.performanceScore, 0) / dimensions.length;
          const avgMaturity = dimensions.reduce((sum, d) => sum + d.maturityLevel, 0) / dimensions.length;
          const maturityLevel = Math.round(avgMaturity);
          const maturityNames = ['', 'Concept', 'Early', 'Validated', 'Scaling', 'Leader'];
          const perfLabels = ['', 'Poor', 'Fair', 'Average', 'Good', 'Exceptional'];

          return {
            ...prev,
            dimensions,
            overallMaturity: { level: maturityLevel, name: maturityNames[maturityLevel] || '—' },
            overallPerformance: {
              score: Math.round(avgPerformance * 10) / 10,
              label: perfLabels[Math.round(avgPerformance)] || '—',
            },
            description: prev.description || `Evaluation in progress — ${dimensions.length}/10 dimensions complete.`,
          };
        });

        // Convert gaps to action items (merge — skip any action_key already in state)
        if (categoryData.gaps?.length > 0) {
          const completeness = categoryData.completeness ?? 0;
          const priority = completeness < 40 ? 'high' : 'medium';
          setActionItems((prev) => {
            const existingKeys = new Set(
              prev.filter((a) => a.sourceType === 'evaluation').map((a) => a.actionKey).filter(Boolean),
            );
            const newItems = categoryData.gaps
              .map((gap) => {
                const slug = gap
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, '-')
                  .replace(/^-+|-+$/g, '')
                  .slice(0, 50);
                return {
                  id: crypto.randomUUID(),
                  title: gap,
                  description: '',
                  priority,
                  status: 'pending',
                  sourceType: 'evaluation',
                  sourceId: null,
                  dimensionId: categoryData.category_id,
                  actionKey: `${categoryData.category_id}-${slug}`,
                  files: [],
                  inputs: {},
                };
              })
              .filter((item) => !existingKeys.has(item.actionKey));
            return [...prev, ...newItems];
          });
        }
      },
      onStatus: (message) => {
        setEvaluationStatus(message);
        if (message.includes('unavailable') || message.includes('Mock mode')) {
          setEvaluationWarning(message);
        }
      },
      onError: (message) => setEvaluationError(message),
    });

    setEvaluationLoading(false);
    setEvaluationStatus(null);

    if (result.success) {
      setEvaluationData((prev) => {
        const finalData = {
          ...prev,
          description: `Your company has been evaluated across ${prev.dimensions.length} key business dimensions.`,
        };
        persistEvaluation(finalData);
        return finalData;
      });
    }
  };

  // Window 2: Evaluation & Actions
  const renderEvaluationWindow = () => {
    const PRIORITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
    const hasEvaluation = evaluationData && evaluationData.dimensions && evaluationData.dimensions.length > 0;

    // Enrich dimensions with metadata, sorted by performance ascending (worst first)
    const enrichedDimensions = hasEvaluation
      ? evaluationData.dimensions
          .map((d) => ({
            ...d,
            ...EVALUATION_DIMENSIONS.find((ed) => ed.id === d.id),
          }))
          .sort((a, b) => a.performanceScore - b.performanceScore)
      : [];

    // Radar chart data: maturity levels scaled to 0-100
    const radarData = hasEvaluation
      ? evaluationData.dimensions.map((d) => {
          const def = EVALUATION_DIMENSIONS.find((ed) => ed.id === d.id);
          return { name: def?.shortTitle || d.id, score: d.maturityLevel * 20 };
        })
      : [];

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
          <div className="eval-header-actions">
            {evaluationLoading ? (
              <div className="eval-progress-indicator">
                <span className="eval-progress-icon">&#10022;</span>
                <span>{evaluationStatus || 'Evaluating...'}</span>
                <span className="eval-progress-count">{evaluationProgress.size}/10</span>
              </div>
            ) : (
              <>
                {!onboardingSummary && (
                  <button className="eval-sample-btn" onClick={handleLoadSampleData}>
                    Use Sample Data
                  </button>
                )}
                <button
                  className="eval-generate-btn"
                  onClick={handleGenerateEvaluation}
                  disabled={!onboardingSummary}
                  title={onboardingSummary ? 'Generate AI evaluation' : 'Complete onboarding first'}
                >
                  Generate Evaluation
                </button>
              </>
            )}
          </div>
        </div>
        {evaluationError && (
          <div className="eval-error">
            {evaluationError}
            <button className="eval-error-dismiss" onClick={() => setEvaluationError(null)}>&times;</button>
          </div>
        )}
        {evaluationWarning && !evaluationLoading && (
          <div className="eval-warning">
            {evaluationWarning}
            <button className="eval-warning-dismiss" onClick={() => setEvaluationWarning(null)}>&times;</button>
          </div>
        )}

        <div className="eval-content">
          {!hasEvaluation && !evaluationLoading ? (
            <div className="eval-placeholder">
              <div className="eval-placeholder-icon">&#9776;</div>
              <h3>{onboardingSummary ? 'Ready to evaluate' : 'Complete onboarding to begin'}</h3>
              <p>
                {onboardingSummary
                  ? 'Click "Generate Evaluation" to analyze your company across 10 key business dimensions.'
                  : 'Complete the onboarding conversation first, or load sample data to test the evaluation flow.'}
              </p>
            </div>
          ) : (
          <>
          {/* Overall Assessment */}
          <div className="eval-overall-card">
            <div className="eval-overall-row">
              <div className="eval-overall-box">
                <span className="eval-overall-label">Stage</span>
                <span className="eval-overall-value">{evaluationData?.overallMaturity?.name || '—'}</span>
                <div className="maturity-track">
                  {MATURITY_STAGES.map((stage) => (
                    <div
                      key={stage.level}
                      className={`track-step ${stage.level <= evaluationData?.overallMaturity?.level ? 'completed' : ''} ${stage.level === evaluationData?.overallMaturity?.level ? 'current' : ''}`}
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
                  {evaluationData?.overallPerformance?.score} <span className="eval-overall-unit">/ 5</span>
                </span>
                <span className="eval-overall-sublabel" style={{ color: getPerformanceColor(evaluationData?.overallPerformance?.score) }}>
                  {evaluationData?.overallPerformance?.label}
                </span>
              </div>
            </div>
            <p className="eval-description">{evaluationData?.description}</p>
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
                              onClick={() => handleMarkComplete(action.id)}
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
                              onClick={() => handleMarkComplete(action.id)}
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
          </>
          )}
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

  if (authLoading) {
    return (
      <div className="password-screen">
        <div className="password-box">
          <div className="logo-mark">S</div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <LoginScreen onAuthenticated={() => {}} />;
  }

  return (
    <div className="app-container">
      <header className="main-header">
        <div className="logo">
          <div className="logo-mark">S</div>
          <span className="logo-text">Fundy MVP</span>
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

        <div className="header-actions">
          <span className="header-email">{session.user?.email}</span>
          <button className="sign-out-btn" onClick={handleSignOut}>Sign out</button>
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
