# Dify API Reference

Base URL: `https://api.dify.ai/v1` (configurable via `VITE_DIFY_BASE_URL`)

> This file is a reference for Claude Code when building Dify integrations in the Fundy MVP.
> Source: [docs.dify.ai](https://docs.dify.ai)

---

## 0. API Key Security & Backend Proxy Architecture

### The Problem

**Dify's official guidance:** "API keys should be called through the backend, rather than being directly exposed in plaintext within frontend code or requests. This helps prevent your application from being abused or attacked."

The current Fundy MVP architecture calls the Dify API directly from the browser using `import.meta.env.VITE_DIFY_API_KEY`. Vite inlines all `VITE_` prefixed environment variables into the client JavaScript bundle at build time. This means:

- The API key is visible in the browser's DevTools (Network tab, Sources tab)
- The API key is embedded in the built `dist/assets/*.js` file
- Anyone who views the page source can extract and abuse the key
- The key cannot be rotated without rebuilding and redeploying

### Recommended Architecture: Vercel Serverless Proxy

Since the app is deployed on Vercel, the recommended approach is a thin API proxy using Vercel Serverless Functions. The API key lives server-side only.

```
Browser (React App)                Vercel Edge/Serverless              Dify Cloud
──────────────────                 ──────────────────────              ──────────
POST /api/chat                  →  reads DIFY_API_KEY from env   →   POST /v1/chat-messages
  { query, conversation_id }       adds Authorization header          { query, ... }
                                   forwards request
                                ←  streams/returns response      ←   SSE or JSON response
```

#### Implementation Steps

1. **Create `/api/chat.js`** (Vercel serverless function):

```javascript
// api/chat.js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { query, conversation_id, user, files, response_mode } = req.body;

  const difyResponse = await fetch('https://api.dify.ai/v1/chat-messages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.DIFY_API_KEY}`, // Server-side only
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: {},
      query,
      response_mode: response_mode || 'blocking',
      conversation_id: conversation_id || '',
      user: user || 'default-user',
      files: files || [],
    }),
  });

  if (response_mode === 'streaming') {
    // Forward SSE stream
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    difyResponse.body.pipeTo(new WritableStream({
      write(chunk) { res.write(chunk); },
      close() { res.end(); },
    }));
  } else {
    const data = await difyResponse.json();
    res.status(difyResponse.status).json(data);
  }
}
```

2. **Create `/api/upload.js`** for file uploads (forwards multipart form data)

3. **Update `DifyAPI` in `App.jsx`** to call `/api/chat` and `/api/upload` instead of `api.dify.ai` directly

4. **Move env var** from `VITE_DIFY_API_KEY` (client-exposed) to `DIFY_API_KEY` (server-only, no `VITE_` prefix)

5. **Set `DIFY_API_KEY`** in Vercel dashboard under Project Settings > Environment Variables

#### Proxy Routes Needed

| Frontend calls | Proxy route | Forwards to |
|---------------|-------------|-------------|
| Send message | `POST /api/chat` | `POST /v1/chat-messages` |
| Upload file | `POST /api/upload` | `POST /v1/files/upload` |
| Stop generation | `POST /api/chat/stop` | `POST /v1/chat-messages/{task_id}/stop` |
| Get messages | `GET /api/messages` | `GET /v1/messages` |
| Get conversations | `GET /api/conversations` | `GET /v1/conversations` |

### Current State (Acceptable for MVP/Dev)

For local development and early MVP testing, the current `VITE_DIFY_API_KEY` approach is functional. Transition to the backend proxy before:
- Deploying to production with real user data
- Using a paid Dify API plan
- Sharing the app URL publicly

---

## 1. Authentication

All requests require a Bearer token in the `Authorization` header:

```
Authorization: Bearer {API_KEY}
```

- API keys are created per-app in Dify's **API Access** settings
- Multiple keys can be created for different environments
- Service API conversations are isolated from WebApp conversations

---

## 2. Chat API

### 2.1 Send Chat Message

**`POST /chat-messages`**

Sends a message in a conversational application. Supports multi-turn dialogue via `conversation_id`.

#### Request Body

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `query` | string | Yes | — | User's message text |
| `user` | string | Yes | — | Unique user identifier |
| `inputs` | object | No | `{}` | App-defined input variables (key-value pairs) |
| `response_mode` | string | No | `streaming` | `blocking` or `streaming` |
| `conversation_id` | string | No | `""` | Empty string for new conversation; pass existing ID to continue |
| `files` | array | No | `[]` | File attachments (see File Object below) |
| `auto_generate_name` | boolean | No | `true` | Auto-generate conversation title |

#### File Object (in `files` array)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | File type: `image`, `document`, `audio`, `video`, `custom` |
| `transfer_method` | string | Yes | `remote_url` or `local_file` |
| `url` | string | Conditional | Required if `transfer_method` is `remote_url` |
| `upload_file_id` | string | Conditional | Required if `transfer_method` is `local_file` (from File Upload API) |

#### Supported File Types (Chatflow/Advanced)

| Category | Extensions |
|----------|-----------|
| Document | TXT, MD, PDF, HTML, XLSX, DOCX, CSV, EML, MSG, PPTX, XML, EPUB |
| Image | JPG, PNG, GIF, WEBP, SVG |
| Audio | MP3, M4A, WAV, WEBM, AMR |
| Video | MP4, MOV, MPEG, MPGA |
| Custom | Other formats |

> **Note:** Basic Chat apps only support `image` type (PNG, JPG, JPEG, WEBP, GIF). Chatflow/Advanced apps support all types above.

#### Blocking Response (`application/json`)

```json
{
  "event": "message",
  "task_id": "uuid",
  "id": "uuid",
  "message_id": "uuid",
  "conversation_id": "uuid",
  "mode": "chat",
  "answer": "Complete response text",
  "metadata": { },
  "created_at": 1234567890
}
```

#### Streaming Response (`text/event-stream`)

Returns Server-Sent Events. See [Section 3: Streaming Events](#3-streaming-events-reference) for all event types.

---

### 2.2 Stop Chat Message Generation

**`POST /chat-messages/{task_id}/stop`**

Stops a streaming response in progress. Only works in streaming mode.

| Parameter | Location | Type | Description |
|-----------|----------|------|-------------|
| `task_id` | path | string | Task ID from the streaming response |
| `user` | body | string | Must match the user from the original request |

**Response:** `200 OK`
```json
{ "result": "success" }
```

---

### 2.3 Next Suggested Questions

**`GET /messages/{message_id}/suggested`**

Returns AI-generated follow-up question suggestions.

| Parameter | Location | Type | Description |
|-----------|----------|------|-------------|
| `message_id` | path | string | Message ID |
| `user` | query | string | User identifier |

**Response:** `200 OK`
```json
{
  "result": "success",
  "data": ["Question 1?", "Question 2?", "Question 3?"]
}
```

---

### 2.4 Message Feedback

**`POST /messages/{message_id}/feedbacks`**

Submit thumbs up/down feedback on a message.

| Parameter | Location | Type | Description |
|-----------|----------|------|-------------|
| `message_id` | path | string | Message ID |
| `rating` | body | string | `like`, `dislike`, or `null` (to revoke) |
| `user` | body | string | User identifier |
| `content` | body | string | Optional feedback text |

**Response:** `200 OK`
```json
{ "result": "success" }
```

---

## 3. Streaming Events Reference

When `response_mode` is `streaming`, the API returns `text/event-stream` with the following SSE event types. Each event is delivered as `data: {json}\n\n`.

### 3.1 `message` (Basic Chat Mode)

Text chunk from the LLM response.

```json
{
  "event": "message",
  "task_id": "uuid",
  "message_id": "uuid",
  "conversation_id": "uuid",
  "answer": "text chunk",
  "created_at": 1234567890
}
```

### 3.2 `agent_message` (Agent Mode)

Text chunk from an agent's response. Same schema as `message` but emitted in agent mode.

```json
{
  "event": "agent_message",
  "task_id": "uuid",
  "message_id": "uuid",
  "conversation_id": "uuid",
  "answer": "text chunk",
  "created_at": 1234567890
}
```

### 3.3 `agent_thought` (Agent Mode)

Emitted during each agent reasoning iteration (Think-Act-Observe cycle).

```json
{
  "event": "agent_thought",
  "id": "uuid",
  "task_id": "uuid",
  "message_id": "uuid",
  "conversation_id": "uuid",
  "position": 1,
  "thought": "Agent's reasoning text",
  "observation": "Result returned by tool call",
  "tool": "tool_name",
  "tool_input": "{\"param\": \"value\"}",
  "message_files": ["file_id_1", "file_id_2"],
  "created_at": 1234567890
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique ID for this thought iteration |
| `position` | integer | 1-based position in the agent's chain of thought |
| `thought` | string | The agent's reasoning text |
| `observation` | string | Result returned by the tool call |
| `tool` | string | Name of the tool being used |
| `tool_input` | string | JSON string of tool input parameters |
| `message_files` | array | File IDs associated with this thought |

### 3.4 `message_file` (Agent Mode)

File created by a tool during agent execution.

```json
{
  "event": "message_file",
  "id": "uuid",
  "type": "image",
  "belongs_to": "assistant",
  "url": "https://...",
  "conversation_id": "uuid"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | File type (e.g., `image`) |
| `belongs_to` | string | `user` or `assistant` |
| `url` | string | URL to access the file |

### 3.5 `message_end`

Signals the end of the stream. Contains metadata with token usage and retriever resources.

```json
{
  "event": "message_end",
  "task_id": "uuid",
  "message_id": "uuid",
  "conversation_id": "uuid",
  "metadata": {
    "usage": { },
    "retriever_resources": [ ]
  }
}
```

### 3.6 Workflow Events (Chatflow/Advanced)

| Event | Description |
|-------|-------------|
| `workflow_started` | Workflow execution begins. Contains `data.id`, `data.workflow_id`, `data.created_at` |
| `node_started` | A workflow node begins. Contains `data.node_id`, `data.node_type`, `data.title`, `data.index` |
| `node_finished` | A node completes. Contains `data.status`, `data.inputs`, `data.outputs`, `data.elapsed_time` |
| `workflow_finished` | Workflow completes. Contains `data.status`, `data.total_tokens`, `data.total_steps`, `data.elapsed_time` |

### 3.7 `tts_message` / `tts_message_end`

Text-to-speech audio stream events. `audio` field contains base64-encoded audio data.

### 3.8 `error`

Error during streaming.

```json
{
  "event": "error",
  "status": 400,
  "code": "error_code",
  "message": "Error description"
}
```

### 3.9 `ping`

Keep-alive signal sent every 10 seconds.

---

## 4. Metadata Objects

### Usage Object

```json
{
  "prompt_tokens": 100,
  "prompt_unit_price": "0.001",
  "prompt_price_unit": "0.001",
  "prompt_price": "0.100",
  "completion_tokens": 50,
  "completion_unit_price": "0.002",
  "completion_price_unit": "0.001",
  "completion_price": "0.100",
  "total_tokens": 150,
  "total_price": "0.200",
  "currency": "USD",
  "latency": 1.234
}
```

### Retriever Resources (RAG results attached to response)

```json
{
  "position": 1,
  "dataset_id": "uuid",
  "dataset_name": "Knowledge Base Name",
  "document_id": "uuid",
  "document_name": "document.pdf",
  "segment_id": "uuid",
  "score": 0.95,
  "content": "Retrieved text chunk..."
}
```

---

## 5. File Upload API

### 5.1 Basic File Upload (Chat Apps)

**`POST /files/upload`**

Uploads a file for use in the next chat message. **Images only** for basic chat apps.

| Form Field | Type | Required | Description |
|------------|------|----------|-------------|
| `file` | binary | Yes | The file to upload |
| `user` | string | Yes | User identifier |

**Supported types:** PNG, JPG, JPEG, WEBP, GIF

**Response:** `200 OK`
```json
{
  "id": "72fa9618-8f89-4a37-9b33-7e1178a24a67",
  "name": "example.png",
  "size": 1024,
  "extension": "png",
  "mime_type": "image/png",
  "created_by": "uuid",
  "created_at": 1577836800
}
```

### 5.2 Workflow File Upload (Chatflow/Advanced Apps)

**`POST /files/upload`**

Same endpoint, but supports all file types when used with Chatflow/Advanced apps:

**Supported types:** TXT, MD, PDF, HTML, XLSX, DOCX, CSV, EML, MSG, PPTX, XML, EPUB, JPG, PNG, GIF, WEBP, SVG, MP3, M4A, WAV, WEBM, AMR, MP4, MOV, MPEG, MPGA, and custom formats.

**Response:** Same schema as basic upload.

**Error Codes:**
| Code | Description |
|------|-------------|
| `no_file_uploaded` | No file in request |
| `too_many_files` | Only one file at a time |
| `unsupported_file_type` | File type not allowed |
| `file_too_large` | Exceeds size limit |

---

## 6. Conversation Management

### 6.1 Get Conversations

**`GET /conversations`**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `user` | string | Yes | — | User identifier |
| `last_id` | string | No | — | Last conversation ID for pagination |
| `limit` | integer | No | 20 | Results per page (1-100) |
| `sort_by` | string | No | `-updated_at` | Sort: `created_at`, `-created_at`, `updated_at`, `-updated_at` |

**Response:**
```json
{
  "limit": 20,
  "has_more": true,
  "data": [
    {
      "id": "uuid",
      "name": "Conversation title",
      "inputs": {},
      "status": "normal",
      "introduction": null,
      "created_at": 1234567890,
      "updated_at": 1234567890
    }
  ]
}
```

### 6.2 Get Conversation History Messages

**`GET /messages`**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `conversation_id` | string | Yes | — | Conversation ID |
| `user` | string | Yes | — | User identifier |
| `first_id` | string | No | — | First message ID on current page (cursor pagination) |
| `limit` | integer | No | 20 | Messages per page |

**Response:**
```json
{
  "limit": 20,
  "has_more": false,
  "data": [
    {
      "id": "uuid",
      "conversation_id": "uuid",
      "inputs": {},
      "query": "User's question",
      "answer": "AI's response",
      "message_files": [
        {
          "id": "uuid",
          "type": "image",
          "url": "https://...",
          "belongs_to": "assistant"
        }
      ],
      "feedback": { "rating": "like" },
      "retriever_resources": [ ],
      "created_at": 1234567890
    }
  ]
}
```

### 6.3 Rename Conversation

**`POST /conversations/{conversation_id}/name`**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | No | Custom name (nullable) |
| `auto_generate` | boolean | No | Auto-generate name (default: false) |
| `user` | string | Yes | User identifier |

**Response:** `200 OK` — Returns full conversation object.

### 6.4 Delete Conversation

**`DELETE /conversations/{conversation_id}`**

| Field | Location | Type | Description |
|-------|----------|------|-------------|
| `conversation_id` | path | string | Conversation ID |
| `user` | body | string | User identifier |

**Response:** `204 No Content`

### 6.5 Get Conversation Variables

**`GET /conversations/{conversation_id}/variables`**

Returns the current values of conversation variables for the given session.

---

## 7. Knowledge Base (RAG) API

> **Note:** Knowledge base APIs use a separate **Dataset API key** (not the app API key). Generate it from **Knowledge > API** in the Dify dashboard.

### 7.1 Create Empty Knowledge Base

**`POST /datasets`**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Knowledge base name |
| `description` | string | No | Description |
| `indexing_technique` | string | No | `high_quality` or `economy` |
| `permission` | string | No | `only_me`, `all_team_members`, `partial_members` |
| `provider` | string | No | `vendor` (Dify-managed) or `external` |
| `embedding_model` | string | No | Embedding model name |
| `embedding_model_provider` | string | No | Embedding model provider |
| `retrieval_model` | object | No | Search/retrieval configuration |

**Response:** `200 OK` — Returns Dataset object with `id`, `name`, `document_count`, `word_count`, etc.

### 7.2 Get Knowledge Base List

**`GET /datasets`**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | integer | No | 1 | Page number |
| `limit` | integer | No | 20 | Items per page |

### 7.3 Get Knowledge Base Details

**`GET /datasets/{dataset_id}`**

Returns full dataset object with configuration details.

### 7.4 Update Knowledge Base

**`PATCH /datasets/{dataset_id}`**

Accepts same fields as create (all optional for update).

### 7.5 Create Document from File

**`POST /datasets/{dataset_id}/document/create-by-file`**

Uploads a document into a knowledge base for indexing.

**Content-Type:** `multipart/form-data`

| Form Field | Type | Required | Description |
|------------|------|----------|-------------|
| `file` | binary | Yes | Document file |
| `data` | string (JSON) | Yes | Processing configuration |

**`data` JSON schema:**
```json
{
  "indexing_technique": "high_quality",
  "process_rule": {
    "mode": "automatic",
    "rules": {
      "segmentation": {
        "separator": "\\n\\n",
        "max_tokens": 500
      }
    }
  }
}
```

**Response:**
```json
{
  "document": {
    "id": "uuid",
    "name": "filename.pdf",
    "position": 1,
    "data_source_type": "upload_file",
    "indexing_status": "indexing",
    "tokens": 0,
    "word_count": 0,
    "enabled": true,
    "archived": false,
    "created_at": 1234567890
  },
  "batch": "batch_tracking_id"
}
```

### 7.6 Get Document List

**`GET /datasets/{dataset_id}/documents`**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | integer | No | 1 | Page number |
| `limit` | integer | No | 20 | Items per page |
| `keyword` | string | No | — | Search by document name |

### 7.7 Get Document Detail

**`GET /datasets/{dataset_id}/documents/{document_id}`**

Returns full document object with indexing status, token count, etc.

### 7.8 Retrieve Chunks (Search/Test Retrieval)

**`POST /datasets/{dataset_id}/retrieve`**

Performs a search query against the knowledge base. This is the core RAG retrieval endpoint.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `query` | string | Yes | Search query string |
| `retrieval_model` | object | No | Search configuration (see below) |

**`retrieval_model` schema:**
```json
{
  "search_method": "hybrid_search",
  "reranking_enable": true,
  "reranking_mode": "reranking_model",
  "reranking_model": {
    "provider": "cohere",
    "model": "rerank-english-v2.0"
  },
  "top_k": 5,
  "score_threshold_enabled": true,
  "score_threshold": 0.5,
  "weights": null,
  "metadata_filtering_conditions": {
    "logical_operator": "and",
    "conditions": []
  }
}
```

**Search methods:** `hybrid_search`, `semantic_search`, `full_text_search`, `keyword_search`

**Response:**
```json
{
  "query": { "content": "processed query" },
  "records": [
    {
      "segment": {
        "id": "uuid",
        "position": 1,
        "document_id": "uuid",
        "content": "Retrieved text chunk...",
        "answer": null,
        "word_count": 150,
        "tokens": 200,
        "keywords": ["keyword1", "keyword2"],
        "hit_count": 5,
        "enabled": true,
        "created_at": 1234567890
      },
      "score": 0.95
    }
  ]
}
```

---

## 8. Audio API

### 8.1 Speech to Text

**`POST /audio-to-text`**

**Content-Type:** `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | binary | Yes | Audio file (MP3, WAV, etc.) |
| `user` | string | Yes | User identifier |

**Response:** `{ "text": "Transcribed text" }`

### 8.2 Text to Speech

**`POST /text-to-audio`**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `text` | string | Yes | Text to convert |
| `user` | string | Yes | User identifier |
| `message_id` | string | No | Use the TTS voice from this message's config |

**Response:** Audio binary stream.

---

## 9. Utility Endpoints

### 9.1 App Info

**`GET /info`**

Returns basic application information (name, description, tags, etc.).

### 9.2 App Parameters

**`GET /parameters`**

Returns the app's configured input parameters, file upload settings, and system parameters.

---

## 10. Error Reference

### HTTP Status Codes

| Status | Meaning |
|--------|---------|
| 200 | Success |
| 201 | Created (file upload) |
| 204 | No Content (delete) |
| 400 | Bad request / validation error |
| 404 | Resource not found |
| 409 | Conflict (duplicate name) |
| 413 | File too large |
| 415 | Unsupported file type |
| 500 | Internal server error |
| 503 | Service unavailable (S3/storage) |

### Error Response Shape

```json
{
  "status": 400,
  "code": "error_code_string",
  "message": "Human-readable error description"
}
```

### Common Error Codes

| Code | Description |
|------|-------------|
| `invalid_param` | Invalid request parameters |
| `app_unavailable` | App not configured correctly |
| `provider_not_initialize` | Model provider credentials missing |
| `provider_quota_exceeded` | Provider quota exhausted |
| `model_currently_not_support` | Model unavailable |
| `completion_request_error` | Generation failure |
| `no_file_uploaded` | No file in upload request |
| `too_many_files` | Multiple files not supported |
| `unsupported_file_type` | File type not allowed |
| `file_too_large` | File exceeds size limit |
| `s3_connection_failed` | Storage connection error |
