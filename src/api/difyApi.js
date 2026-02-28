import { MOCK_ONBOARDING_SUMMARY } from '../data/mockData';
import { SUMMARY_START_MARKER, parseSSELine } from '../utils/extractSummary';
import { supabase } from './supabaseClient';

// Get the current JWT for authenticated API calls
async function getAuthHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Dify API — supports blocking, streaming, and mock fallback modes
const DifyAPI = {
  get useStreaming() { return import.meta.env.VITE_DIFY_STREAMING === 'true'; },
  get isMock() { return import.meta.env.VITE_DIFY_MOCK === 'true'; },

  // Blocking mode: waits for full response
  async sendMessage(message, conversationId = null, files = [], user = 'default-user', workflow = 'onboarding') {
    if (this.isMock) return this.sendMessageMock(message, conversationId);

    const authHeaders = await getAuthHeaders();
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
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
  async sendMessageStreaming(message, conversationId = null, files = [], user = 'default-user', onChunk, workflow = 'onboarding', onProgress) {
    if (this.isMock) return this.sendMessageMock(message, conversationId);

    const authHeaders = await getAuthHeaders();
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
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
        const event = parseSSELine(line);
        if (!event) continue;

        if (event.event === 'node_started') {
          if (onProgress && event.data?.node_type === 'llm') {
            onProgress({ type: 'node_started', title: event.data?.title || 'Processing' });
          }
        } else if (event.event === 'node_finished') {
          if (onProgress && event.data?.node_type === 'llm') {
            onProgress({ type: 'node_finished', title: event.data?.title || '' });
          }
        } else if (event.event === 'message') {
          fullMessage += event.answer;
          if (onChunk) onChunk(fullMessage);
        } else if (event.event === 'message_end') {
          resultConversationId = event.conversation_id;
          resultMessageId = event.message_id;
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

    const authHeaders = await getAuthHeaders();
    const formData = new FormData();
    formData.append('file', file);
    formData.append('user', user);

    const response = await fetch(`/api/upload?workflow=${workflow}`, {
      method: 'POST',
      headers: { ...authHeaders },
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
        message: `Great, I've compiled everything you've shared into a comprehensive evaluation across 10 key dimensions.\n\n${SUMMARY_START_MARKER}\n${summaryJson}\n[/ONBOARDING_SUMMARY]`,
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

export default DifyAPI;
