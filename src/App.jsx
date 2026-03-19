import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ONBOARDING_CATEGORIES,
  MOCK_ONBOARDING_SUMMARY,
  EVALUATION_DIMENSIONS,
  MATURITY_STAGES,
  DUE_DILIGENCE_CHECKLISTS,
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
import DebugPanel from './components/DebugPanel';
import { uploadFiles, buildUploadMessages, DIFY_MAX_FILES, DIFY_MAX_FILE_SIZE_MB } from './utils/fileUpload';
import { generateEvaluation } from './api/evaluationApi';
import { refreshActionItems } from './api/actionItemRefreshApi';

const CHAT_ERROR_MESSAGE = 'I apologize, but I encountered an error. Please try again.';

// Opt-in debug panel — add ?debug to the URL to enable
const debugEnabled = new URLSearchParams(window.location.search).has('debug');

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
    customData: dbRow.custom_data || {},
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
  const [deleteConfirmState, setDeleteConfirmState] = useState('idle'); // 'idle' | 'confirming' | 'deleting'
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
  const [investmentData, setInvestmentData] = useState(null);
  const [actionItems, setActionItems] = useState([]);
  const [selectedInvestments, setSelectedInvestments] = useState([]);
  const [expandedAction, setExpandedAction] = useState(null);
  const [expandedStretch, setExpandedStretch] = useState(new Set());
  const [expandedAddressed, setExpandedAddressed] = useState(new Set());
  const [onboardingPhase, setOnboardingPhase] = useState('chat');
  const [onboardingSummary, setOnboardingSummary] = useState(null);
  const [activeCategory, setActiveCategory] = useState(null);
  const [categoryConversations, setCategoryConversations] = useState({});
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [expandedDimension, setExpandedDimension] = useState(null);
  const [debugLogs, setDebugLogs] = useState([]);
  const [actionConversations, setActionConversations] = useState({});
  const [actionTyping, setActionTyping] = useState(null);
  const [refreshLoading, setRefreshLoading] = useState(false);
  const [refreshError, setRefreshError] = useState(null);
  const [embedFailureCount, setEmbedFailureCount] = useState(0);

  const addDebugLog = useCallback((label, detail) => {
    if (!debugEnabled) return;
    const ts = new Date().toLocaleTimeString('en-GB', { hour12: false });
    setDebugLogs((prev) => [...prev.slice(-99), { ts, label, detail }]);
  }, []);

  // Refs track Supabase conversation UUIDs — using refs avoids stale closure
  // issues in fire-and-forget async helpers called from streaming callbacks.
  const conversationDbIdRef = useRef(null);    // onboarding conversation DB UUID
  const deepDiveConvDbIdsRef = useRef({});     // { [categoryId]: DB UUID }
  const actionConvDbIdsRef = useRef({});       // { [actionId]: DB UUID }
  const investmentActionsRef = useRef(null);   // scroll target for investment actions section

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

  /** Save the completed evaluation result (and investment recommendations) to Supabase. Fire-and-forget. */
  const persistEvaluation = async (data, investmentRecommendations = null) => {
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
        body: JSON.stringify({
          evaluationData: data,
          actionItems: evalActionItems,
          investmentRecommendations: investmentRecommendations || undefined,
        }),
      });
      if (!res.ok) { console.error('[persistEvaluation] HTTP', res.status); return false; }
      return true;
    } catch (err) {
      console.error('[persistEvaluation] Failed:', err.message);
      return false;
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
        workflow === 'onboarding'
          ? conversationDbIdRef.current
          : workflow === 'action_item'
          ? actionConvDbIdsRef.current[categoryId]
          : deepDiveConvDbIdsRef.current[categoryId];

      if (!dbId) {
        dbId = await createConversation(workflow, categoryId);
        if (!dbId) return;
        if (workflow === 'onboarding') conversationDbIdRef.current = dbId;
        else if (workflow === 'action_item') actionConvDbIdsRef.current = { ...actionConvDbIdsRef.current, [categoryId]: dbId };
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
        if (savedEval.investment_data) {
          setInvestmentData(savedEval.investment_data);
        }
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
    // Use onAuthStateChange as the single source of truth for session state.
    // Supabase fires INITIAL_SESSION on load, SIGNED_IN on login, and
    // TOKEN_REFRESHED on JWT refresh. We only restore data once per sign-in.
    let restored = false;

    const unsubscribe = onAuthStateChange((event, s) => {
      setSession(s);
      setAuthLoading(false);
      if (s && !restored && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN')) {
        restored = true;
        restoreUserData();
      }
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
    setInvestmentData(null);
    setSelectedInvestments([]);
    setActionItems([]);
    setConversationId(null);
    setCategoryConversations({});
    setActionConversations({});
    conversationDbIdRef.current = null;
    deepDiveConvDbIdsRef.current = {};
    actionConvDbIdsRef.current = {};
  };

  const handleDeleteData = async () => {
    setDeleteConfirmState('deleting');
    try {
      const s = await getSession();
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.access_token}` },
      });
      if (res.ok || res.status === 207) {
        // Reset all state — keep session (user stays logged in, clean slate)
        setOnboardingSummary(null);
        setOnboardingPhase('chat');
        setEvaluationData(null);
        setInvestmentData(null);
        setSelectedInvestments([]);
        setActionItems([]);
        setConversationId(null);
        setCategoryConversations({});
        setActionConversations({});
        setMessages([{ role: 'assistant', content: "Welcome to Fundy MVP! I'm here to help understand your business and provide tailored insights. Let's start with the basics — what's your company name and what problem are you solving?" }]);
        conversationDbIdRef.current = null;
        deepDiveConvDbIdsRef.current = {};
        actionConvDbIdsRef.current = {};
        setActiveWindow(0);
      } else {
        console.error('[handleDeleteData] Server error', res.status);
      }
    } catch (err) {
      console.error('[handleDeleteData] Failed:', err.message);
    }
    setDeleteConfirmState('idle');
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

        // Timeout detection: if response is empty, the Vercel function likely timed out
        // before the ANSWER node fired (summary generation takes ~44s + overhead).
        if (!result && !response.message?.trim()) {
          setMessages(prev => replaceLastMessage(prev, {
            role: 'assistant',
            content: "Your summary is taking longer than expected to generate. Please type 'done' to try again.",
            isError: true,
          }));
          return;
        }

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

    if (uploadedFiles.length + files.length > DIFY_MAX_FILES) {
      const remaining = DIFY_MAX_FILES - uploadedFiles.length;
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            remaining > 0
              ? `You can attach up to ${DIFY_MAX_FILES} files per message. You have ${uploadedFiles.length} file(s) pending — you can add ${remaining} more. Send your message first to free up space.`
              : `You've reached the ${DIFY_MAX_FILES}-file limit for this message. Please send it first before uploading more files.`,
          isError: true,
        },
      ]);
      e.target.value = '';
      return;
    }

    setMessages((prev) => [...prev, { role: 'user', content: `Uploaded: ${files.map((f) => f.name).join(', ')}`, isFile: true }]);
    setIsTyping(true);

    const { succeeded, failed, oversized, uploadedFiles: newFiles } = await uploadFiles(files);
    setUploadedFiles((prev) => [...prev, ...newFiles]);

    if (succeeded.length > 0) {
      const { message, prompt } = buildUploadMessages(succeeded, 'onboarding');
      setMessages((prev) => [...prev, { role: 'assistant', content: message }]);
      setInputValue(prompt);
    }

    if (oversized.length > 0) {
      const details = oversized.map((f) => `"${f.name}" (${f.sizeMB}MB)`).join(', ');
      setMessages((prev) => [...prev, { role: 'assistant', content: `${details} exceeded the ${DIFY_MAX_FILE_SIZE_MB}MB file size limit and was not uploaded.`, isError: true }]);
    }

    if (failed.length > 0) {
      setMessages((prev) => [...prev, { role: 'assistant', content: `Failed to upload: ${failed.join(', ')}. Please try again.`, isError: true }]);
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

  const handleRefreshActionItems = async () => {
    const nonCompleted = actionItems.filter((a) => a.status !== 'completed');
    if (nonCompleted.length === 0) return;
    setRefreshLoading(true);
    setRefreshError(null);
    try {
      const { results } = await refreshActionItems(nonCompleted.map((a) => a.id));
      setActionItems((prev) =>
        prev.map((item) => {
          const refresh = results[item.id];
          if (!refresh) return item;
          return { ...item, customData: { ...item.customData, refresh } };
        }),
      );
    } catch (err) {
      console.error('[handleRefreshActionItems]', err.message);
      setRefreshError(err.message);
    } finally {
      setRefreshLoading(false);
    }
  };

  const toggleInvestment = (investmentId) => {
    const isSelected = selectedInvestments.includes(investmentId);
    const userId = session?.user?.id;

    if (isSelected) {
      setSelectedInvestments((prev) => prev.filter((id) => id !== investmentId));
      upsertInvestmentSelection(investmentId, false);
      // Remove due diligence items for this investment — content already embedded in KB
      setActionItems((prev) => prev.filter((a) => !(a.sourceType === 'investment' && a.sourceId === investmentId)));
      if (userId) deleteActionItemsBySourceId(investmentId);
    } else {
      setSelectedInvestments((prev) => [...prev, investmentId]);
      upsertInvestmentSelection(investmentId, true);
      // Add predefined due diligence checklist items
      const checklist = DUE_DILIGENCE_CHECKLISTS[investmentId] || [];
      setActionItems((prev) => {
        const existingKeys = new Set(prev.filter((a) => a.sourceId === investmentId).map((a) => a.actionKey));
        const newItems = checklist
          .filter((item) => !existingKeys.has(`dd-${investmentId}-${item.key}`))
          .map((item) => ({
            id: crypto.randomUUID(),
            title: item.title,
            description: item.description,
            priority: item.priority,
            status: 'pending',
            sourceType: 'investment',
            sourceId: investmentId,
            dimensionId: null,
            actionKey: `dd-${investmentId}-${item.key}`,
            files: [],
            inputs: {},
          }));
        if (userId) newItems.forEach((item) => saveActionItem(item, userId));
        return [...prev, ...newItems];
      });
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

    if (!DifyAPI.isMock) {
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
        updateLastMessage(response.message, { conversationId: response.conversationId });
        persistConversationExchange('deepdive', categoryId, currentMessage, response.message, response.conversationId);
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

        setCategoryConversations(prev => {
          if (!prev[categoryId]) return prev;
          return {
            ...prev,
            [categoryId]: {
              conversationId: response.conversationId,
              messages: [
                ...prev[categoryId].messages,
                { role: 'assistant', content: response.message }
              ],
            },
          };
        });
        persistConversationExchange('deepdive', categoryId, currentMessage, response.message, response.conversationId);
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

    if (uploadedFiles.length + files.length > DIFY_MAX_FILES) {
      const remaining = DIFY_MAX_FILES - uploadedFiles.length;
      setCategoryConversations((prev) => {
        if (!prev[categoryId]) return prev;
        return {
          ...prev,
          [categoryId]: {
            ...prev[categoryId],
            messages: [
              ...prev[categoryId].messages,
              {
                role: 'assistant',
                content:
                  remaining > 0
                    ? `You can attach up to ${DIFY_MAX_FILES} files per message. You have ${uploadedFiles.length} file(s) pending — you can add ${remaining} more. Send your message first to free up space.`
                    : `You've reached the ${DIFY_MAX_FILES}-file limit for this message. Please send it first before uploading more files.`,
                isError: true,
              },
            ],
          },
        };
      });
      e.target.value = '';
      return;
    }

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

    const { succeeded, failed, oversized, uploadedFiles: newFiles } = await uploadFiles(files, 'default-user', 'deepdive');
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

    if (oversized.length > 0) {
      const details = oversized.map((f) => `"${f.name}" (${f.sizeMB}MB)`).join(', ');
      setCategoryConversations((prev) => {
        if (!prev[categoryId]) return prev;
        return {
          ...prev,
          [categoryId]: {
            ...prev[categoryId],
            messages: [...prev[categoryId].messages, { role: 'assistant', content: `${details} exceeded the ${DIFY_MAX_FILE_SIZE_MB}MB file size limit and was not uploaded.`, isError: true }],
          },
        };
      });
    }

    if (failed.length > 0) {
      setCategoryConversations((prev) => {
        if (!prev[categoryId]) return prev;
        return {
          ...prev,
          [categoryId]: {
            ...prev[categoryId],
            messages: [...prev[categoryId].messages, { role: 'assistant', content: `Failed to upload: ${failed.join(', ')}. Please try again.`, isError: true }],
          },
        };
      });
    }

    setIsTyping(false);
    e.target.value = '';
  };

  // ─── Action item chat helpers ─────────────────────────────────────────

  /** Initialise conversation state for an action item on first expand. */
  const initActionConversation = (action) => {
    if (actionConversations[action.id]) return;
    setActionConversations((prev) => ({
      ...prev,
      [action.id]: {
        messages: [{ role: 'assistant', content: `I can help you work through this: **${action.title}**\n\n${action.description}\n\nWhat do you need help with, or are you ready to upload documentation?` }],
        conversationId: null,
        inputValue: '',
      },
    }));
  };

  const handleActionChatInputChange = (actionId, value) => {
    setActionConversations((prev) => ({
      ...prev,
      [actionId]: { ...prev[actionId], inputValue: value },
    }));
  };

  /** Embed a completed action item chat exchange into the KB. Fire-and-forget. */
  const embedActionItemExchange = async (actionId, userMsg, assistantMsg) => {
    try {
      const s = await getSession();
      if (!s) return;
      const conversationDbId = actionConvDbIdsRef.current[actionId] || null;
      const response = await fetch('/api/action-items/embed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.access_token}` },
        body: JSON.stringify({ conversationDbId, actionItemId: actionId, userMessage: userMsg, assistantMessage: assistantMsg }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    } catch (err) {
      console.error('[embedActionItemExchange] Failed:', err.message);
      setEmbedFailureCount((n) => n + 1);
    }
  };

  const handleActionChatSend = async (actionId) => {
    const conv = actionConversations[actionId];
    if (!conv?.inputValue?.trim()) return;
    const currentMessage = conv.inputValue;

    setActionConversations((prev) => ({
      ...prev,
      [actionId]: {
        ...prev[actionId],
        inputValue: '',
        messages: [...prev[actionId].messages, { role: 'user', content: currentMessage }],
      },
    }));

    const appendAssistant = (content, extra = {}) => {
      setActionConversations((prev) => {
        if (!prev[actionId]) return prev;
        return {
          ...prev,
          [actionId]: { ...prev[actionId], messages: [...prev[actionId].messages, { role: 'assistant', content, ...extra }] },
        };
      });
    };

    const updateLastMessage = (content, extra = {}) => {
      setActionConversations((prev) => {
        if (!prev[actionId]) return prev;
        const msgs = [...prev[actionId].messages];
        msgs[msgs.length - 1] = { role: 'assistant', content, ...extra };
        return { ...prev, [actionId]: { ...prev[actionId], ...extra, messages: msgs } };
      });
    };

    if (!DifyAPI.isMock) {
      appendAssistant('', { isStreaming: true });
      try {
        const response = await DifyAPI.sendMessageStreaming(
          currentMessage, conv.conversationId, [], 'default-user',
          (accumulated) => updateLastMessage(accumulated, { isStreaming: true }),
          'action_item',
        );
        updateLastMessage(response.message);
        setActionConversations((prev) => ({
          ...prev,
          [actionId]: { ...prev[actionId], conversationId: response.conversationId },
        }));
        await persistConversationExchange('action_item', actionId, currentMessage, response.message, response.conversationId);
        embedActionItemExchange(actionId, currentMessage, response.message);
      } catch (error) {
        console.error('[action-chat/streaming] Send failed:', error.message);
        updateLastMessage(CHAT_ERROR_MESSAGE);
      }
    } else {
      setActionTyping(actionId);
      try {
        const response = await DifyAPI.sendMessage(currentMessage, conv.conversationId, [], 'default-user', 'action_item');
        setActionConversations((prev) => ({
          ...prev,
          [actionId]: {
            ...prev[actionId],
            conversationId: response.conversationId,
            messages: [...prev[actionId].messages, { role: 'assistant', content: response.message }],
          },
        }));
        await persistConversationExchange('action_item', actionId, currentMessage, response.message, response.conversationId);
        embedActionItemExchange(actionId, currentMessage, response.message);
      } catch (error) {
        console.error('[action-chat/blocking] Send failed:', error.message);
        appendAssistant(CHAT_ERROR_MESSAGE);
      }
      setActionTyping(null);
    }
  };

  const handleActionChatFileUpload = async (actionId, e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setActionConversations((prev) => ({
      ...prev,
      [actionId]: {
        ...prev[actionId],
        messages: [...prev[actionId].messages, { role: 'user', content: `Uploaded: ${files.map((f) => f.name).join(', ')}`, isFile: true }],
      },
    }));
    setActionTyping(actionId);

    const { succeeded, failed, oversized } = await uploadFiles(files, 'default-user', 'action_item');

    if (succeeded.length > 0) {
      const { message, prompt } = buildUploadMessages(succeeded, 'discussion');
      setActionConversations((prev) => ({
        ...prev,
        [actionId]: {
          ...prev[actionId],
          messages: [...prev[actionId].messages, { role: 'assistant', content: message }],
          inputValue: prev[actionId].inputValue || prompt,
        },
      }));
    }
    if (oversized.length > 0) {
      const details = oversized.map((f) => `"${f.name}" (${f.sizeMB}MB)`).join(', ');
      setActionConversations((prev) => ({
        ...prev,
        [actionId]: {
          ...prev[actionId],
          messages: [...prev[actionId].messages, { role: 'assistant', content: `${details} exceeded the ${DIFY_MAX_FILE_SIZE_MB}MB limit and was not uploaded.`, isError: true }],
        },
      }));
    }
    if (failed.length > 0) {
      setActionConversations((prev) => ({
        ...prev,
        [actionId]: {
          ...prev[actionId],
          messages: [...prev[actionId].messages, { role: 'assistant', content: `Failed to upload: ${failed.join(', ')}. Please try again.`, isError: true }],
        },
      }));
    }

    setActionTyping(null);
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
      placeholder="Type your response, or 'done' to generate your summary..."
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

                  {category.gaps.length > 0 && (() => {
                    const tableStakes = category.gaps.filter((g) => (typeof g === 'string' ? false : g.type === 'table_stakes')).length;
                    const stretch = category.gaps.length - tableStakes;
                    return (
                      <div className="category-gaps">
                        {tableStakes > 0 && <span className="gaps-label gaps-table-stakes">{tableStakes} must-have{tableStakes > 1 ? 's' : ''}</span>}
                        {stretch > 0 && <span className="gaps-label gaps-stretch">{stretch} stretch goal{stretch > 1 ? 's' : ''}</span>}
                      </div>
                    );
                  })()}

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
    let capturedInvestmentRecommendations = null;

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

        // Convert gaps to action items — gated by type:
        //   • All table_stakes gaps (must-haves for current maturity stage)
        //   • Top MAX_STRETCH_PER_CATEGORY stretch gaps (future readiness)
        // Gaps are objects: { action: string, type: 'table_stakes'|'stretch', evidence_items: number[] }
        // Falls back to plain string gaps for backward compatibility
        const MAX_STRETCH_PER_CATEGORY = 2;
        if (categoryData.gaps?.length > 0) {
          const tableStakesGaps = categoryData.gaps.filter((g) =>
            typeof g === 'string' ? true : g.type !== 'stretch',
          );
          const stretchGaps = categoryData.gaps
            .filter((g) => typeof g !== 'string' && g.type === 'stretch')
            .slice(0, MAX_STRETCH_PER_CATEGORY);
          const gatedGaps = [...tableStakesGaps, ...stretchGaps];

          setActionItems((prev) => {
            // Remove old evaluation items for this category before adding new ones
            const withoutOldCategory = prev.filter(
              (a) => !(a.sourceType === 'evaluation' && a.dimensionId === categoryData.category_id),
            );
            const dimDef = EVALUATION_DIMENSIONS.find((d) => d.id === categoryData.category_id);
            const dimTitle = dimDef?.title || categoryData.category_id;
            const newItems = gatedGaps.map((gap) => {
              const gapText = typeof gap === 'string' ? gap : gap.action;
              const gapType = typeof gap === 'string' ? 'table_stakes' : gap.type;
              const slug = gapText
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '')
                .slice(0, 50);
              return {
                id: crypto.randomUUID(),
                title: gapText,
                description: `${dimTitle} — ${gapType === 'table_stakes' ? 'must-have' : 'stretch goal'}`,
                priority: gapType === 'table_stakes' ? 'high' : 'medium',
                status: 'pending',
                sourceType: 'evaluation',
                sourceId: null,
                dimensionId: categoryData.category_id,
                actionKey: `${categoryData.category_id}-${slug}`,
                gapType,
                evidenceItems: typeof gap === 'string' ? [] : (gap.evidence_items || []),
                files: [],
                inputs: {},
              };
            });
            return [...withoutOldCategory, ...newItems];
          });
        }
      },
      onInvestmentMatchingStarted: () => {
        setEvaluationStatus('Matching investment types...');
      },
      onMaturityCalculated: (data) => {
        // Update evaluation with the server-side weighted maturity score
        setEvaluationData((prev) => {
          if (!prev) return prev;
          const maturityNames = { concept: 'Concept', early_traction: 'Early', validated: 'Validated', scaling: 'Scaling', market_leader: 'Leader' };
          const perfLabels = { poor: 'Poor', fair: 'Fair', average: 'Average', good: 'Good', exceptional: 'Exceptional' };
          const maturityLevel = { concept: 1, early_traction: 2, validated: 3, scaling: 4, market_leader: 5 }[data.maturity_stage] ?? prev.overallMaturity?.level ?? 0;
          return {
            ...prev,
            overallMaturity: { level: maturityLevel, name: maturityNames[data.maturity_stage] || prev.overallMaturity?.name || '—' },
            overallPerformance: {
              score: data.overall_completeness > 0
                ? Math.round((data.overall_completeness / 20) * 10) / 10
                : prev.overallPerformance?.score ?? 0,
              label: perfLabels[data.performance_level] || prev.overallPerformance?.label || '—',
            },
          };
        });
      },
      onInvestmentRecommendationsComplete: (data) => {
        capturedInvestmentRecommendations = data;
        setInvestmentData(data);
        // Re-save evaluation now that Phase 2 investment data is available.
        // persistEvaluation is called in result.success before this callback fires,
        // so capturedInvestmentRecommendations was null at that point — re-save here.
        setEvaluationData((prev) => {
          if (prev?.dimensions?.length) {
            persistEvaluation(prev, data);
          }
          return prev;
        });
        // Auto-add next_steps as investment action items, replacing any previous ones
        const nextSteps = data.next_steps || [];
        if (nextSteps.length > 0) {
          setActionItems((prev) => {
            const withoutOld = prev.filter((a) => a.sourceId !== 'investment_matching');
            const existingKeys = new Set(
              prev.filter((a) => a.sourceId === 'investment_matching').map((a) => a.actionKey).filter(Boolean),
            );
            const newItems = nextSteps
              .map((step) => {
                const slug = step.action
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, '-')
                  .replace(/^-+|-+$/g, '')
                  .slice(0, 50);
                const actionKey = `investment-${slug}`;
                if (existingKeys.has(actionKey)) return null;
                return {
                  id: crypto.randomUUID(),
                  title: step.action,
                  description: step.expected_outcome || '',
                  priority: step.priority <= 2 ? 'high' : 'medium',
                  status: 'pending',
                  sourceType: 'investment',
                  sourceId: 'investment_matching',
                  dimensionId: null,
                  actionKey,
                  files: [],
                  inputs: {},
                };
              })
              .filter(Boolean);
            return [...withoutOld, ...newItems];
          });
          // Persist new investment action items to DB
          const userId = session?.user?.id;
          if (userId) {
            nextSteps.forEach((step) => {
              const slug = step.action.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50);
              saveActionItem(
                {
                  id: crypto.randomUUID(),
                  title: step.action,
                  description: step.expected_outcome || '',
                  priority: step.priority <= 2 ? 'high' : 'medium',
                  status: 'pending',
                  sourceType: 'investment',
                  sourceId: 'investment_matching',
                  dimensionId: null,
                  actionKey: `investment-${slug}`,
                },
                userId,
              );
            });
          }
        }
      },
      onStatus: (message) => {
        setEvaluationStatus(message);
        if (message.includes('unavailable') || message.includes('Mock mode')) {
          setEvaluationWarning(message);
        }
      },
      onError: (message) => setEvaluationError(message),
      onDebugLog: debugEnabled ? addDebugLog : undefined,
    });

    setEvaluationLoading(false);
    setEvaluationStatus(null);

    if (result.success) {
      setEvaluationData((prev) => {
        const finalData = {
          ...prev,
          description: `Your company has been evaluated across ${prev.dimensions.length} key business dimensions.`,
        };
        persistEvaluation(finalData, capturedInvestmentRecommendations).then((ok) => {
          addDebugLog('SAVE', ok ? 'evaluation + investment_data saved ✓' : 'save failed ✗');
        });
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

    // Group evaluation action items by dimension, split into must-haves and stretch
    const evaluationActions = actionItems.filter((a) => a.sourceType === 'evaluation');
    const actionsByDimension = enrichedDimensions
      .filter((d) => evaluationActions.some((a) => a.dimensionId === d.id))
      .map((d) => {
        const dimActions = evaluationActions.filter((a) => a.dimensionId === d.id);
        const sortByPriority = (a, b) => (PRIORITY_ORDER[a.priority] ?? 4) - (PRIORITY_ORDER[b.priority] ?? 4);
        const isAddressed = (a) => a.customData?.refresh?.status === 'addressed';
        return {
          dimension: d,
          mustHaves: dimActions.filter((a) => a.gapType !== 'stretch' && !isAddressed(a)).sort(sortByPriority),
          stretch: dimActions.filter((a) => a.gapType === 'stretch' && !isAddressed(a)).sort(sortByPriority),
          addressed: dimActions.filter(isAddressed).sort(sortByPriority),
        };
      });

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
                  title={onboardingSummary ? 'Run AI evaluation' : 'Complete onboarding first'}
                >
                  Run Evaluation
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
                  ? 'Click "Run Evaluation" to analyze your company across 10 key business dimensions.'
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
                <span className="eval-overall-label">Overall Progress</span>
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
              <h3>Action Items <span className="action-count">{actionItems.filter((a) => a.status !== 'completed' && a.customData?.refresh?.status !== 'addressed').length} pending</span></h3>
              <button
                className="eval-generate-btn"
                onClick={handleRefreshActionItems}
                disabled={refreshLoading || actionItems.filter((a) => a.status !== 'completed').length === 0}
              >
                {refreshLoading ? 'Analyzing...' : 'Refresh Status'}
              </button>
            </div>
            {refreshError && (
              <p className="actions-warning">Refresh failed: {refreshError}</p>
            )}
            {embedFailureCount > 0 && (
              <p className="actions-warning">Some chat data may not be indexed — refresh results may be incomplete.</p>
            )}

            <div className="action-cards">
              {(() => {
                const renderActionCard = (action) => (
                  <div
                    key={action.id}
                    className={`action-card ${expandedAction === action.id ? 'expanded' : ''}`}
                  >
                    <div className="action-card-header" onClick={() => { const opening = expandedAction !== action.id; setExpandedAction(opening ? action.id : null); if (opening) initActionConversation(action); }}>
                      <div className="action-priority-dot" style={{ background: action.gapType === 'table_stakes' ? '#f59e0b' : '#818cf8' }}></div>
                      <div className="action-info">
                        <h4>{action.title}</h4>
                        <p>{action.description}</p>
                      </div>
                      <div className="action-meta">
                        {action.customData?.refresh ? (
                          <span className={`action-status ${action.customData.refresh.status}`} title={action.customData.refresh.summary}>
                            {action.customData.refresh.status === 'addressed' ? 'Addressed'
                              : action.customData.refresh.status === 'partially_addressed' ? 'Partial'
                              : action.customData.refresh.status === 'not_addressed' ? 'Not addressed'
                              : 'No evidence'}
                          </span>
                        ) : (
                          <span className={`action-status ${action.status}`}>
                            {action.status.replace('_', ' ')}
                          </span>
                        )}
                      </div>
                      <span className="expand-icon">{expandedAction === action.id ? '−' : '+'}</span>
                    </div>

                    {expandedAction === action.id && (
                      <div className="action-card-body">
                        <div className="action-chat-container">
                          <ChatPanel
                            messages={actionConversations[action.id]?.messages || []}
                            isTyping={actionTyping === action.id}
                            inputValue={actionConversations[action.id]?.inputValue || ''}
                            onInputChange={(v) => handleActionChatInputChange(action.id, v)}
                            onSend={() => handleActionChatSend(action.id)}
                            onFileUpload={(e) => handleActionChatFileUpload(action.id, e)}
                            placeholder="Ask for guidance, add notes, or upload documentation..."
                          />
                        </div>
                        {action.customData?.refresh && (
                          <div className={`evidence-panel ${action.customData.refresh.status}`}>
                            <p className="evidence-summary">{action.customData.refresh.summary}</p>
                            {action.customData.refresh.evidence?.length > 0 && (
                              <div className="evidence-chunks">
                                {action.customData.refresh.evidence.map((e, i) => (
                                  <div key={i} className="evidence-chunk">
                                    <span className={`evidence-source-tag ${e.source_type}`}>
                                      {e.source_type === 'summary' ? 'Onboarding' : e.source_type === 'file' ? 'File' : 'Chat'}
                                    </span>
                                    <span className="evidence-content">{e.content}</span>
                                    <span className="evidence-score">{Math.round(e.score * 100)}%</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        <div className="action-buttons">
                          <button className="btn-complete" onClick={() => handleMarkComplete(action.id)}>
                            Mark Complete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );

                return actionsByDimension.map(({ dimension, mustHaves, stretch, addressed }) => {
                const stretchOpen = expandedStretch.has(dimension.id);
                const addressedOpen = expandedAddressed.has(dimension.id);
                return (
                  <div key={dimension.id} className="action-dimension-group">
                    <div className="action-dimension-header">
                      <span>{dimension.icon}</span>
                      <span className="action-dimension-name">{dimension.title}</span>
                      <span className="action-dimension-perf-badge" style={{ background: `${getPerformanceColor(dimension.performanceScore)}20`, color: getPerformanceColor(dimension.performanceScore), borderColor: `${getPerformanceColor(dimension.performanceScore)}40` }}>
                        {getPerformanceLabel(dimension.performanceScore)}
                      </span>
                    </div>
                    {mustHaves.map(renderActionCard)}
                    {stretch.length > 0 && (
                      <div className="stretch-goals-section">
                        <button
                          className="stretch-goals-toggle"
                          onClick={() => setExpandedStretch((prev) => {
                            const next = new Set(prev);
                            if (next.has(dimension.id)) next.delete(dimension.id);
                            else next.add(dimension.id);
                            return next;
                          })}
                        >
                          <span className="stretch-goals-icon">{stretchOpen ? '▾' : '▸'}</span>
                          <span>Stretch Goals</span>
                          <span className="stretch-goals-count">{stretch.length}</span>
                        </button>
                        {stretchOpen && (
                          <div className="stretch-goals-cards">
                            {stretch.map(renderActionCard)}
                          </div>
                        )}
                      </div>
                    )}
                    {addressed.length > 0 && (
                      <div className="addressed-items-section">
                        <button
                          className="addressed-items-toggle"
                          onClick={() => setExpandedAddressed((prev) => {
                            const next = new Set(prev);
                            if (next.has(dimension.id)) next.delete(dimension.id);
                            else next.add(dimension.id);
                            return next;
                          })}
                        >
                          <span className="addressed-items-icon">{addressedOpen ? '▾' : '▸'}</span>
                          <span>Addressed</span>
                          <span className="addressed-items-count">{addressed.length}</span>
                        </button>
                        {addressedOpen && (
                          <div className="addressed-items-cards">
                            {addressed.map(renderActionCard)}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              });
              })()}

            </div>
          </div>
          </>
          )}
        </div>
      </div>
    );
  };

  // Window 3: Investment Matching
  const renderInvestmentWindow = () => {
    // Map LLM rating to a 0-100 suitability score for the progress ring
    const ratingToSuitability = { ideal: 95, strong_fit: 80, acceptable: 65, conditional: 50, marginal: 40, not_suitable: 15 };
    const ratingToStatus = { ideal: 'strong_match', strong_fit: 'strong_match', acceptable: 'moderate_match', conditional: 'partial_match', marginal: 'partial_match', not_suitable: 'weak_match' };
    // Display names for investment type IDs
    const investmentTypeNames = {
      grant_funding: 'Grant Funding',
      pre_seed: 'Pre-Seed',
      seed: 'Seed',
      series_a: 'Series A',
      venture_debt: 'Venture Debt',
      revenue_based_financing: 'Revenue-Based Financing',
    };

    if (!investmentData) {
      return (
        <div className="investment-window">
          <div className="invest-header">
            <h2>Investment Matching</h2>
            {onboardingSummary ? (
              <button
                className="eval-generate-btn"
                onClick={handleGenerateEvaluation}
                disabled={evaluationLoading}
                title="Recommend investments based on evaluation"
              >
                {evaluationLoading ? 'Evaluating...' : 'Recommend Investments'}
              </button>
            ) : (
              <p>Complete onboarding to unlock investment recommendations</p>
            )}
          </div>
          <div className="invest-content">
            {evaluationLoading ? (
              <div className="eval-progress-indicator" style={{ justifyContent: 'center', padding: '60px 24px' }}>
                <span className="eval-progress-icon">&#10022;</span>
                <span>{evaluationStatus || 'Evaluating...'}</span>
                <span className="eval-progress-count">{evaluationProgress.size}/10</span>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '60px 24px' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
                <p style={{ margin: '0 0 20px', fontSize: 15, color: 'rgba(255,255,255,0.4)' }}>
                  {onboardingSummary
                    ? 'Click "Recommend Investments" to generate your personalized recommendations.'
                    : 'Complete the onboarding conversation first to unlock investment recommendations.'}
                </p>
              </div>
            )}
          </div>
        </div>
      );
    }

    const { investment_readiness_summary, recommended_funding = [], conditional_options = [], improvement_roadmap = [], not_recommended = [] } = investmentData;
    const investmentActions = actionItems.filter((a) => a.sourceType === 'investment' && a.sourceId === 'investment_matching');
    const dueDiligenceItems = actionItems.filter((a) => a.sourceType === 'investment' && a.sourceId !== 'investment_matching');
    const investmentActionCount = [...investmentActions, ...dueDiligenceItems].filter((a) => a.status !== 'completed').length;

    return (
      <div className="investment-window">
        <div className="invest-header">
          <h2>Investment Matching</h2>
          <p>Personalized funding recommendations based on your evaluation</p>
        </div>

        <div className="invest-content">
          {/* Summary stats */}
          <div className="invest-summary">
            <div className="summary-card">
              <span className="summary-value">{recommended_funding.length}</span>
              <span className="summary-label">Recommended</span>
            </div>
            <div className="summary-card">
              <span className="summary-value">{selectedInvestments.length}</span>
              <span className="summary-label">Pursuing</span>
            </div>
            <div className="summary-card summary-card-link" onClick={() => investmentActionsRef.current?.scrollIntoView({ behavior: 'smooth' })}>
              <span className="summary-value">{investmentActionCount}</span>
              <span className="summary-label">Action Items ↓</span>
            </div>
          </div>

          {/* Investment Readiness Summary */}
          {investment_readiness_summary && (
            <div className="invest-readiness-block">
              <div className="readiness-header">
                <span className="readiness-score-badge">{investment_readiness_summary.readiness_score}</span>
                <strong>{investment_readiness_summary.primary_recommendation}</strong>
              </div>
              <p className="readiness-assessment">{investment_readiness_summary.assessment}</p>
            </div>
          )}

          {/* Recommended funding cards */}
          {recommended_funding.length > 0 && (
            <>
              <h3 className="invest-section-heading">Recommended</h3>
              <div className="investment-grid">
                {recommended_funding.map((inv) => {
                  const suitability = ratingToSuitability[inv.rating] ?? 50;
                  const status = ratingToStatus[inv.rating] ?? 'partial_match';
                  const isSelected = selectedInvestments.includes(inv.investment_type);
                  return (
                    <div key={inv.investment_type} className={`investment-card ${isSelected ? 'selected' : ''}`}>
                      <div className="invest-card-header">
                        <div className="invest-type">
                          <h3>{investmentTypeNames[inv.investment_type] || inv.investment_type}</h3>
                          <span className="invest-status" style={{ background: `${getStatusColor(status)}22`, color: getStatusColor(status) }}>
                            {inv.rating.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <div className="suitability-ring">
                          <ProgressRing size={60} radius={26} strokeWidth={4} percent={suitability} color={getSuitabilityColor(suitability)} fontSize={14} />
                        </div>
                      </div>
                      <p className="invest-description">{inv.fit_explanation}</p>
                      <div className="invest-details">
                        <div className="detail-row">
                          <span className="detail-label">Typical Terms</span>
                          <span className="detail-value">{inv.typical_terms}</span>
                        </div>
                      </div>
                      {inv.investor_expectations?.length > 0 && (
                        <div className="invest-requirements">
                          <span className="req-label">Investors look for:</span>
                          <div className="req-tags">
                            {inv.investor_expectations.map((exp, idx) => <span key={idx} className="req-tag">{exp}</span>)}
                          </div>
                        </div>
                      )}
                      <button className={`invest-select-btn ${isSelected ? 'selected' : ''}`} onClick={() => toggleInvestment(inv.investment_type)}>
                        {isSelected ? '✓ Pursuing' : 'Mark as Pursuing'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Conditional options */}
          {conditional_options.length > 0 && (
            <>
              <h3 className="invest-section-heading">Conditional Options</h3>
              <div className="investment-grid">
                {conditional_options.map((opt) => {
                  const isSelected = selectedInvestments.includes(opt.investment_type);
                  return (
                    <div key={opt.investment_type} className={`investment-card conditional ${isSelected ? 'selected' : ''}`}>
                      <div className="invest-card-header">
                        <div className="invest-type">
                          <h3>{investmentTypeNames[opt.investment_type] || opt.investment_type}</h3>
                          <span className="invest-status" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>conditional</span>
                        </div>
                        <div className="suitability-ring">
                          <ProgressRing size={60} radius={26} strokeWidth={4} percent={50} color="#f59e0b" fontSize={14} />
                        </div>
                      </div>
                      <p className="invest-description">{opt.conditions_for_fit}</p>
                      {opt.improvements_needed?.length > 0 && (
                        <div className="invest-requirements">
                          <span className="req-label">Needs improvement in:</span>
                          <div className="req-tags">
                            {opt.improvements_needed.map((imp, idx) => <span key={idx} className="req-tag">{imp.category.replace(/_/g, ' ')}</span>)}
                          </div>
                        </div>
                      )}
                      <button className={`invest-select-btn ${isSelected ? 'selected' : ''}`} onClick={() => toggleInvestment(opt.investment_type)}>
                        {isSelected ? '✓ Pursuing' : 'Mark as Pursuing'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Improvement Roadmap */}
          {improvement_roadmap.length > 0 && (
            <div className="invest-roadmap-section">
              <h3 className="invest-section-heading">Improvement Roadmap</h3>
              <div className="roadmap-list">
                {improvement_roadmap.map((item) => (
                  <div key={item.category} className="roadmap-item">
                    <div className="roadmap-item-header">
                      <span className="roadmap-priority">#{item.priority}</span>
                      <span className="roadmap-category">{item.category.replace(/_/g, ' ')}</span>
                    </div>
                    <div className="roadmap-item-meta">
                      <span className="roadmap-score-label">Readiness</span>
                      <span className="roadmap-score">{item.current_score} → {item.target_score}</span>
                      <span className="roadmap-timeline">{item.timeline}</span>
                    </div>
                    {item.unlocks?.length > 0 && (
                      <div className="roadmap-unlocks">
                        Unlocks: {item.unlocks.map((u) => investmentTypeNames[u] || u).join(', ')}
                      </div>
                    )}
                    {item.specific_actions?.length > 0 && (
                      <ul className="roadmap-actions">
                        {item.specific_actions.map((action, idx) => <li key={idx}>{action}</li>)}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Not Recommended */}
          {not_recommended.length > 0 && (
            <div className="invest-not-recommended">
              <h3 className="invest-section-heading">Not Recommended</h3>
              <div className="not-rec-list">
                {not_recommended.map((item) => {
                  const isSelected = selectedInvestments.includes(item.investment_type);
                  return (
                    <div key={item.investment_type} className={`not-rec-item ${isSelected ? 'selected' : ''}`}>
                      <div className="not-rec-info">
                        <span className="not-rec-name">{investmentTypeNames[item.investment_type] || item.investment_type}</span>
                        <span className="not-rec-reason">{item.reason}</span>
                      </div>
                      <button
                        className={`invest-select-btn not-rec ${isSelected ? 'selected' : ''}`}
                        onClick={() => toggleInvestment(item.investment_type)}
                      >
                        {isSelected ? '✓ Pursuing' : 'Pursue Anyway'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Investment Readiness Action Items — always visible when LLM next_steps exist */}
          {investmentActions.length > 0 && (
            <div className="invest-actions-section" ref={investmentActionsRef}>
              <h3 className="invest-section-heading">
                Investment Readiness Actions <span className="action-count">{investmentActions.filter((a) => a.status !== 'completed').length} pending</span>
              </h3>
              <p className="invest-section-subtext">General steps to improve your investment readiness, regardless of which funding type you pursue.</p>
              <div className="action-cards">
                {investmentActions.map((action) => (
                  <div
                    key={action.id}
                    className={`action-card ${expandedAction === action.id ? 'expanded' : ''}`}
                  >
                    <div className="action-card-header" onClick={() => { const opening = expandedAction !== action.id; setExpandedAction(opening ? action.id : null); if (opening) initActionConversation(action); }}>
                      <div className="action-priority-dot" style={{ background: getPriorityColor(action.priority) }}></div>
                      <div className="action-info">
                        <h4>{action.title}</h4>
                        <p>{action.description}</p>
                      </div>
                      <div className="action-meta">
                        <span className={`action-status ${action.status}`}>{action.status.replace('_', ' ')}</span>
                      </div>
                      <span className="expand-icon">{expandedAction === action.id ? '−' : '+'}</span>
                    </div>
                    {expandedAction === action.id && (
                      <div className="action-card-body">
                        <div className="action-chat-container">
                          <ChatPanel
                            messages={actionConversations[action.id]?.messages || []}
                            isTyping={actionTyping === action.id}
                            inputValue={actionConversations[action.id]?.inputValue || ''}
                            onInputChange={(v) => handleActionChatInputChange(action.id, v)}
                            onSend={() => handleActionChatSend(action.id)}
                            onFileUpload={(e) => handleActionChatFileUpload(action.id, e)}
                            placeholder="Ask for guidance, add notes, or upload documentation..."
                          />
                        </div>
                        <div className="action-buttons">
                          <button className="btn-complete" onClick={() => handleMarkComplete(action.id)}>Mark Complete</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Due Diligence checklists — one group per pursued investment, shown only when pursuing */}
          {selectedInvestments.some((id) => dueDiligenceItems.some((a) => a.sourceId === id)) && (
            <div className="invest-dd-section">
              <h3 className="invest-section-heading">
                Due Diligence <span className="action-count">{dueDiligenceItems.filter((a) => a.status !== 'completed').length} pending</span>
              </h3>
              <p className="invest-section-subtext">Documents and evidence required for each funding type you are actively pursuing.</p>
              {selectedInvestments.map((invId) => {
                const ddItems = dueDiligenceItems.filter((a) => a.sourceId === invId);
                if (ddItems.length === 0) return null;
                const pendingCount = ddItems.filter((a) => a.status !== 'completed').length;
                return (
                  <div key={invId} className="invest-dd-group">
                    <div className="invest-dd-group-heading">
                      {investmentTypeNames[invId] || invId}
                      <span className="invest-dd-count">{pendingCount} of {ddItems.length} remaining</span>
                    </div>
                    <div className="action-cards">
                      {ddItems.map((action) => (
                        <div
                          key={action.id}
                          className={`action-card ${expandedAction === action.id ? 'expanded' : ''}`}
                        >
                          <div className="action-card-header" onClick={() => { const opening = expandedAction !== action.id; setExpandedAction(opening ? action.id : null); if (opening) initActionConversation(action); }}>
                            <div className={`action-priority-dot dd-doc ${action.priority}`}></div>
                            <div className="action-info">
                              <h4>{action.title}</h4>
                              <p>{action.description}</p>
                            </div>
                            <div className="action-meta">
                              <span className={`action-status ${action.status}`}>{action.status.replace('_', ' ')}</span>
                            </div>
                            <span className="expand-icon">{expandedAction === action.id ? '−' : '+'}</span>
                          </div>
                          {expandedAction === action.id && (
                            <div className="action-card-body">
                              <div className="action-chat-container">
                                <ChatPanel
                                  messages={actionConversations[action.id]?.messages || []}
                                  isTyping={actionTyping === action.id}
                                  inputValue={actionConversations[action.id]?.inputValue || ''}
                                  onInputChange={(v) => handleActionChatInputChange(action.id, v)}
                                  onSend={() => handleActionChatSend(action.id)}
                                  onFileUpload={(e) => handleActionChatFileUpload(action.id, e)}
                                  placeholder="Upload this document or ask for guidance..."
                                />
                              </div>
                              <div className="action-buttons">
                                <button className="btn-complete" onClick={() => handleMarkComplete(action.id)}>Mark Complete</button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  if (authLoading) {
    return (
      <div className="password-screen">
        <div className="password-box">
          <div className="logo-mark">Fundy</div>
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
          <div className="logo-mark">Fundy</div>
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
          {deleteConfirmState === 'confirming' ? (
            <>
              <button className="delete-data-btn confirming" onClick={handleDeleteData}>
                Confirm delete
              </button>
              <button className="delete-data-cancel" onClick={() => setDeleteConfirmState('idle')}>
                Cancel
              </button>
            </>
          ) : deleteConfirmState === 'deleting' ? (
            <button className="delete-data-btn deleting" disabled>Deleting...</button>
          ) : (
            <button className="delete-data-btn" onClick={() => setDeleteConfirmState('confirming')}>
              Delete my data
            </button>
          )}
          <button className="sign-out-btn" onClick={handleSignOut}>Sign out</button>
        </div>
      </header>

      <main className="main-content">
        {activeWindow === 0 && <ErrorBoundary name="Onboarding">{renderChatWindow()}</ErrorBoundary>}
        {activeWindow === 1 && <ErrorBoundary name="Evaluation">{renderEvaluationWindow()}</ErrorBoundary>}
        {activeWindow === 2 && <ErrorBoundary name="Investments">{renderInvestmentWindow()}</ErrorBoundary>}
      </main>

      {debugEnabled && <DebugPanel logs={debugLogs} onClear={() => setDebugLogs([])} />}
    </div>
  );
}
