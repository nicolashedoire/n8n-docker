import { readFileSync } from 'node:fs';

// One attempt per call. n8n owns the bounded retry policy, avoiding nested retries.
export class LlmProviderError extends Error {
  constructor(status, code, message, metrics = {}) {
    super(message);
    this.name = 'LlmProviderError';
    this.status = status;
    this.code = code;
    this.metrics = metrics;
  }
}

function openaiText(data) {
  const outputs = Array.isArray(data?.output) ? data.output : [];
  const messages = outputs.filter(item => item?.type === 'message');
  const content = messages.flatMap(item => Array.isArray(item.content) ? item.content : []);
  if (data?.refusal || content.some(item => item?.type === 'refusal')) {
    throw new LlmProviderError(422, 'llm_refused', 'Le modèle a refusé cette demande. Une relecture humaine est nécessaire.');
  }
  if (data?.status === 'incomplete' || messages.some(item => item.status === 'incomplete')) {
    throw new LlmProviderError(502, 'llm_incomplete', 'La réponse du modèle est incomplète ; aucun résultat partiel n’a été accepté.');
  }
  if (data?.status !== 'completed' || data?.error) {
    throw new LlmProviderError(502, 'llm_failed', 'Le fournisseur n’a pas terminé la génération.');
  }
  const text = content.filter(item => item?.type === 'output_text' && typeof item.text === 'string').map(item => item.text).join('');
  if (!text.trim()) throw new LlmProviderError(502, 'llm_envelope_invalid', 'La réponse du modèle ne contient aucun résultat exploitable.');
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new LlmProviderError(502, 'llm_invalid_json', 'Le modèle a renvoyé un JSON invalide.'); }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new LlmProviderError(502, 'llm_invalid_json', 'Le modèle a renvoyé un résultat JSON de type inattendu.');
  return text;
}

export function createLlmProvider(options = {}) {
  const env = options.env ?? process.env;
  const provider = options.provider ?? env.LLM_PROVIDER ?? 'ollama';
  if (!['ollama', 'openai'].includes(provider)) throw new Error('LLM_PROVIDER doit être ollama ou openai.');
  const model = provider === 'openai'
    ? (options.openaiModel ?? env.OPENAI_MODEL ?? 'gpt-5.6-terra')
    : (options.ollamaModel ?? env.OLLAMA_MODEL ?? 'qwen2.5:3b');
  const ollamaUrl = options.ollamaUrl ?? env.OLLAMA_URL ?? 'http://host.docker.internal:11434';
  const fetcher = options.fetchImpl ?? fetch;
  const now = options.now ?? Date.now;
  const timeoutMs = Math.min(120_000, Math.max(1, options.timeoutMs ?? 60_000));
  const standardKeyFile = Object.hasOwn(options, 'defaultKeyFile') ? options.defaultKeyFile : '/run/secrets/openai_api_key';

  function keyState() {
    // Explicit injection exists for isolated tests; production uses a mounted file first.
    if (Object.hasOwn(options, 'apiKey')) return { key: String(options.apiKey ?? '').trim() };
    const configuredFile = options.keyFile ?? env.OPENAI_API_KEY_FILE;
    const file = configuredFile || standardKeyFile;
    if (file) {
      try {
        const key = readFileSync(file, 'utf8').trim();
        if (!key || key.length > 8192 || /\s/.test(key)) return { key: '', error: 'openai_key_invalid' };
        return { key };
      } catch (error) {
        if (configuredFile || error.code !== 'ENOENT') return { key: '', error: 'openai_key_unreadable' };
      }
    }
    const key = String(env.OPENAI_API_KEY ?? '').trim();
    return !key || key.length > 8192 || /\s/.test(key) ? { key: '' } : { key };
  }

  const metadata = () => ({ provider, model, key_configured: provider === 'openai' && Boolean(keyState().key) });
  async function generate({ messages, schema }) {
    const started = now();
    const metrics = () => ({ provider, model, qualification_version: 'facts-v2', duration_ms: now() - started });
    let body; let url; let headers;
    if (provider === 'openai') {
      const state = keyState();
      if (!state.key) throw new LlmProviderError(503, state.error ?? 'openai_key_missing', 'La clé API OpenAI n’est pas configurée ou n’est pas accessible.', metrics());
      url = 'https://api.openai.com/v1/responses';
      headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${state.key}` };
      body = { model, input: messages, store: false, reasoning: { effort: 'low' }, max_output_tokens: 2000,
        text: { format: { type: 'json_schema', name: 'qualification_facts', strict: true, schema } } };
    } else {
      url = `${ollamaUrl.replace(/\/$/, '')}/api/chat`;
      headers = { 'Content-Type': 'application/json' };
      body = { model, stream: false, format: schema, messages, options: { temperature: 0, num_ctx: 4096, num_predict: 500 } };
    }
    let response;
    try {
      response = await fetcher(url, { method: 'POST', headers, body: JSON.stringify(body), redirect: 'error', signal: AbortSignal.timeout(timeoutMs) });
    } catch (error) {
      throw new LlmProviderError(502, ['AbortError', 'TimeoutError'].includes(error.name) ? 'llm_timeout' : 'llm_unavailable', 'Le fournisseur du modèle ne répond pas.', metrics());
    }
    if (!response.ok) {
      // Never include provider error bodies: they may echo inputs or credential details.
      if (provider === 'openai' && response.status === 401) throw new LlmProviderError(502, 'openai_auth_error', 'OpenAI a refusé la clé API. Vérifier la connexion configurée.', metrics());
      if (provider === 'openai' && response.status === 429) throw new LlmProviderError(503, 'openai_rate_limited', 'La limite OpenAI est atteinte. Réessayer plus tard ou vérifier le quota du projet.', metrics());
      if (provider === 'openai' && response.status === 403) throw new LlmProviderError(502, 'openai_access_denied', 'Ce projet OpenAI n’est pas autorisé à utiliser le modèle configuré.', metrics());
      throw new LlmProviderError(502, 'llm_http_error', `Le fournisseur du modèle a répondu HTTP ${response.status}.`, metrics());
    }
    let data;
    try { data = await response.json(); } catch { throw new LlmProviderError(502, 'llm_envelope_invalid', 'L’enveloppe du modèle est illisible.', metrics()); }
    if (provider === 'openai') {
      let text;
      try { text = openaiText(data); } catch (error) { error.metrics = metrics(); throw error; }
      return { text, metrics: { ...metrics(), prompt_tokens: data.usage?.input_tokens, completion_tokens: data.usage?.output_tokens } };
    }
    if (data?.done === false) throw new LlmProviderError(502, 'llm_incomplete', 'La réponse du modèle local est incomplète.', metrics());
    if (typeof data?.message?.content !== 'string') throw new LlmProviderError(502, 'llm_envelope_invalid', 'Réponse du modèle local absente.', metrics());
    return { text: data.message.content, metrics: { ...metrics(), prompt_tokens: data.prompt_eval_count, completion_tokens: data.eval_count } };
  }
  return { metadata, generate };
}
