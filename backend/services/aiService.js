import OpenAI from 'openai'

// DeepSeek uses OpenAI-compatible API
// Lazy init — dotenv hasn't loaded yet at import time in ESM
let _deepseek
let _groq

function getDeepSeek() {
  if (!_deepseek) {
    _deepseek = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: 'https://api.deepseek.com/v1',
    })
  }
  return _deepseek
}

export function getGroq() {
  // Import dynamically to avoid issues if GROQ_API_KEY not set
  if (!_groq) {
    import('groq-sdk').then(Groq => {
      _groq = new Groq.default({ apiKey: process.env.GROQ_API_KEY })
    })
  }
  return _groq
}

/**
 * Create a chat completion using DeepSeek (default) or fallback to Groq
 * @param {Object} params - Completion parameters
 * @param {string} params.model - Model name (defaults to deepseek-chat)
 * @param {Array} params.messages - Message array
 * @param {Object} params.response_format - Response format (json_object supported)
 * @param {number} params.max_tokens - Max tokens
 * @returns {Promise<Object>} - Chat completion response
 */
export async function createChatCompletion(params) {
  const provider = process.env.AI_PROVIDER || 'deepseek'

  if (provider === 'deepseek') {
    return getDeepSeek().chat.completions.create({
      model: params.model || 'deepseek-chat',
      messages: params.messages,
      response_format: params.response_format,
      max_tokens: params.max_tokens || 2000,
      temperature: params.temperature || 0.3,
    })
  }

  // Fallback to Groq
  if (!getGroq()) {
    throw new Error('No AI provider available. Set DEEPSEEK_API_KEY or GROQ_API_KEY.')
  }
  return getGroq().chat.completions.create({
    model: params.model || 'llama-3.3-70b-versatile',
    messages: params.messages,
    response_format: params.response_format,
    max_tokens: params.max_tokens || 2000,
  })
}

/**
 * Quick completion helper for simple prompts
 * @param {string} systemPrompt - System prompt
 * @param {string} userPrompt - User prompt
 * @param {Object} options - Additional options
 * @returns {Promise<string>} - Response content
 */
export async function quickCompletion(systemPrompt, userPrompt, options = {}) {
  const response = await createChatCompletion({
    model: options.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    response_format: options.json ? { type: 'json_object' } : undefined,
    max_tokens: options.maxTokens || 2000,
    temperature: options.temperature || 0.3,
  })

  return response.choices[0].message.content
}

/**
 * Parse JSON safely from AI response
 * @param {string} content - JSON string
 * @returns {Object|null} - Parsed object or null
 */
export function safeJsonParse(content) {
  try {
    return JSON.parse(content)
  } catch (e) {
    console.error('Failed to parse JSON:', e.message)
    console.error('Content:', content.slice(0, 500))
    return null
  }
}
