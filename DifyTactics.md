# Dify Tactics — Hard-Won Lessons

This file documents gotchas, type coercion traps, and design rules discovered while building Dify workflows for Fundy. Consult it before designing any new workflow or debugging unexpected failures.

---

## 1. Type Coercion Between Nodes

### The LLM text → Code node trap

**Problem:** When an LLM node outputs valid JSON as its `text` variable (String type), Dify sometimes auto-parses the JSON into a Python dict before passing it to a downstream Code node. The Code node receives a dict, not a string — even when the input variable is declared as String.

**Symptom:** `'dict' object has no attribute 'replace'` — Dify's internal framework calls `.replace()` on the value during variable substitution, expecting a String but receiving a dict.

**What does NOT work:**
- Declaring the Code node input as String (Dify ignores the declared type when auto-parsing JSON text)
- Trying to change the input type to Object (the type is locked to the upstream output's declared type)
- Handling dict-vs-string in Python with `isinstance(investment_json, dict)` — the error occurs in Dify's framework before your `main()` is even called

**The fix:** Parse the LLM JSON in JavaScript (`_difyWorkflow.js`) rather than in a downstream Code node. The `node_finished` event delivers `outputs.text` as the raw string — parse it there and skip the Code node entirely.

```js
if (outputs.text) {
  try {
    let text = outputs.text.trim();
    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) text = fenceMatch[1].trim();
    const parsed = JSON.parse(text);
    if (parsed.investment_readiness_summary) {
      return { type: 'investment_recommendations_complete', data: parsed };
    }
  } catch (_e) {}
}
```

**Rule:** Never use a Code node solely to parse LLM JSON output when that output needs to be detected downstream. Parse it in the SSE handler instead.

---

### Variable Aggregator output type

**Problem:** Dify's Variable Aggregator can output in two modes depending on how it's configured:
- **Array mode** → Python `list` of items
- **Object mode** (badge shows "OBJECT") → Python `dict` with integer or string keys

**Problem 2:** The Dify test panel (single-node test) passes pasted JSON as a **string**, not a parsed object.

**Problem 3:** If `user_id` (String) is included among the aggregated inputs, it leaks into the list alongside the 10 eval dicts and causes `AttributeError: 'str' object has no attribute 'get'`.

**The fix — normalize all three forms and filter scalars:**

```python
if isinstance(aggregated_evaluations, str):
    aggregated_evaluations = json.loads(aggregated_evaluations)
if isinstance(aggregated_evaluations, dict):
    aggregated_evaluations = list(aggregated_evaluations.values())
aggregated_evaluations = [item for item in aggregated_evaluations if isinstance(item, dict)]
```

**Rule:** Any Code node receiving Variable Aggregator output must handle string, dict, and list forms, and filter out non-dict scalar values.

---

### JSON strings from Code nodes must be declared as String, not Object

**Problem:** When a Code node returns `json.dumps(some_dict)`, the result is a JSON-serialized **string**. Dify must be told this is a String type output. If you declare it as Object or Array, Dify tries to coerce it and either fails or passes an integer (e.g., `1`) downstream.

**Symptom:** `KeyError: 1` in a downstream Code node when looking up a string key in a dict.

**Affected outputs in `calculate_maturity`:**

| Output | Correct type |
|---|---|
| `category_scores` | **String** |
| `category_details` | **String** |
| `strongest_categories` | **String** |
| `weakest_categories` | **String** |

**Rule:** If your Python code does `json.dumps(x)`, declare the output as **String** in Dify — not Object, not Array.

---

### Downstream Code nodes receiving JSON strings

**Problem:** A Code node receiving a `json.dumps` string from an upstream Code node may receive it as-is (a String) or as an already-parsed Python dict (if Dify auto-parses it). This is inconsistent.

**The fix — normalize both forms:**

```python
if isinstance(category_scores, dict):
    scores = category_scores
else:
    scores = json.loads(category_scores)
```

**Rule:** Any Code node that calls `json.loads()` on a parameter should also handle the case where it arrives as an already-parsed dict.

---

## 2. Variable Binding Errors

### Wrong variable bound → silent type mismatch

**Problem:** If you bind `maturity_stage` (String) to `maturity_score` (Number) by accident in Dify Studio, the downstream code receives an integer and fails with a confusing `KeyError`.

**Symptom:** `KeyError: 1` or `KeyError: 320` in dict lookups that use the bound variable as a key.

**Rule:** After building a new workflow, open each Code node and verify every input binding is pointing to the correct upstream variable — not just the right node, but the right output variable on that node. Check types match (Number → Number, String → String).

---

### Node title case in SSE events

**Problem:** Dify emits node titles in SSE events exactly as they are named in the UI. If you name a node `CALCULATE_MATURITY` (uppercase), the SSE event will contain `"title": "CALCULATE_MATURITY"`. JavaScript string comparison is case-sensitive.

**Symptom:** Investment matching events silently return `null` — the stream looks empty even though the workflow is running. After 60s the connection drops.

**The fix:** Always normalize node titles to lowercase before comparison:

```js
const nodeTitle = (event.data?.title || '').toLowerCase();
```

**Rule:** All Dify node title comparisons must use `.toLowerCase()`. Name nodes in lowercase in Dify Studio to be safe.

---

## 3. Dify Studio Test Panel vs. Run Panel

### Test panel (single-node test)

- Passes all input as a **JSON string**, even for Object-type inputs
- Useful for testing individual Code nodes in isolation
- Input must be pasted as a valid JSON string (the full object as text, not parsed)

### Run panel (full workflow test — "Run" button)

- Shows each START node input variable as a **separate labelled field**
- Paste **only the value** into each field — not `"key": value` pairs
- For Object variables, paste the raw JSON object: `{"category_id": "product_technology", ...}`
- For String variables, paste the raw string: `test-user-123`

**Common mistake:** Pasting `"eval_product_technology": {"category_id": ...}` into the Run panel — this includes the key name, which Dify rejects with "JSON object for 'eval_product_technology' must be an object".

---

## 4. SSE Stream & Timeout

### Vercel 60s idle connection timeout

**Problem:** Vercel drops outgoing fetch streams that are idle (no bytes received) for 60 seconds. Dify's workflow has two silent phases that exceed this:
1. KB Iteration phase (~10-20s): no events while 10 parallel HTTP searches run
2. Parallel LLM phase (~40-60s): all 10 LLM nodes fire simultaneously, no events until all finish

**The fix:**
- Add lightweight Code nodes (`workflow_kickstart`, `workflow_evaluating`) at silent points — they complete in <1s and emit a `node_finished` event, resetting the idle timer
- Split Phase 2 (investment matching) into a separate API call (`/api/evaluation/investment-match`) so each call fits comfortably under 60s

**Rule:** Any workflow phase longer than ~45s of silence needs a keepalive node. Budget for Dify's own processing overhead on top of LLM response time.

---

## 5. Output Variable Detection in `_difyWorkflow.js`

### Detection by output shape, not node title

`_difyWorkflow.js` detects the investment recommendations event by checking for a specific output key on any `node_finished` event:

```js
if (outputs.investment_readiness_summary) {
  return { type: 'investment_recommendations_complete', data: outputs };
}
```

This means:
- The node title does not matter — it can be named anything
- The output variable `investment_readiness_summary` must exist and be truthy
- Originally this was created by a `parse_recommendations` Code node; now it's parsed directly from the LLM's `text` output in the JS fallback

### Markdown code fence stripping

LLMs sometimes wrap JSON output in ` ```json ... ``` ` even when instructed not to. Always strip code fences before parsing:

```js
const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
if (fenceMatch) text = fenceMatch[1].trim();
```

---

## 6. Phase 2 Workflow Architecture

### No `parse_recommendations` Code node needed

The `parse_recommendations` node was originally designed to:
1. Parse the LLM's raw JSON text
2. Create typed output variables that `_difyWorkflow.js` could detect

It was removed because Dify's type coercion made it unreliable. The parsing now happens in `_difyWorkflow.js` directly.

**Current architecture:**
```
START → Variable Aggregator → calculate_maturity → generate_matrix → investment_recommendations (LLM) → END
```

**Detection in `_difyWorkflow.js`:**
1. Primary: `outputs.investment_readiness_summary` (structured output, if ever re-enabled)
2. Fallback: parse `outputs.text` as JSON and check for `investment_readiness_summary` key

### Why retrieval is in our API, not Dify

Dify's KB node cannot swap dynamically between backends. By doing retrieval in `/api/evaluation/generate` (10 parallel searches), we can swap the KB backend without changing any Dify workflow. Context is passed as pre-assembled strings in the START node inputs.

---

## 7. General Rules

1. **Name all Code nodes in lowercase** — avoids case mismatch bugs in SSE title detection
2. **Declare output types carefully** — `json.dumps()` → String; raw dict → Object; raw list → Array
3. **Normalize Variable Aggregator inputs** — always handle string/dict/list forms + filter scalars
4. **Never rely on a Code node to parse LLM JSON for downstream detection** — do it in `_difyWorkflow.js` instead
5. **Test single nodes before running full workflow** — use the node test panel first; it surfaces Python errors faster
6. **Run panel = per-field values only** — never paste key-value pairs, just values
7. **Budget for Dify overhead** — add ~5-10s buffer when estimating workflow duration for timeout planning
