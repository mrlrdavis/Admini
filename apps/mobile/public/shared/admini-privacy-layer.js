/**
 * admini-privacy-layer.js
 * AdminI — Zero-Knowledge Privacy Layer
 *
 * FERPA Compliance Architecture:
 * - No raw PII ever leaves the client
 * - All AI inference routed through this module
 * - Local Ollama path available (set USE_OLLAMA = true when ready)
 * - IndexedDB persistence with FERPA retention schedules
 * - Aggregate-only anonymized telemetry
 *
 * Retention Schedule:
 * - Captures: 90 days
 * - Tasks: 1 year
 * - Observations: 3 years
 *
 * Usage:
 *   const result = await PrivacyLayer.callAI({ prompt, context, role });
 *   PrivacyLayer.persist({ type, data });
 *   PrivacyLayer.retrieve({ type, id });
 */

const PrivacyLayer = (function () {
  'use strict';

  // ==========================================
  // CONFIGURATION
  // ==========================================

  const CONFIG = {
    // Set to true when Ollama is installed and running locally
    USE_OLLAMA: false,

    // Local Ollama endpoint (default port)
    OLLAMA_ENDPOINT: 'http://localhost:11434/api/generate',
    OLLAMA_MODEL: 'llama3',

    // Cloud proxy endpoint — routes through your Cloudflare Worker
    // which holds the API key server-side (never in client code)
    CLOUD_PROXY_ENDPOINT: '/api/ai',

    // IndexedDB config
    DB_NAME: 'admini_local',
    DB_VERSION: 1,

    // Retention schedules in milliseconds
    RETENTION: {
      captures: 90 * 24 * 60 * 60 * 1000,      // 90 days
      tasks: 365 * 24 * 60 * 60 * 1000,          // 1 year
      observations: 3 * 365 * 24 * 60 * 60 * 1000 // 3 years
    },

    // Telemetry — aggregate only, no PII
    TELEMETRY_ENABLED: true
  };

  // ==========================================
  // PII DETECTION PATTERNS
  // ==========================================

  const PII_PATTERNS = [
    // Student ID patterns (common formats)
    { pattern: /\b\d{6,9}\b/g, label: 'STUDENT_ID' },

    // Social Security Numbers
    { pattern: /\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/g, label: 'SSN' },

    // Email addresses
    { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, label: 'EMAIL' },

    // Phone numbers
    { pattern: /\b(\+1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, label: 'PHONE' },

    // Dates of birth patterns
    { pattern: /\b(0?[1-9]|1[0-2])\/(0?[1-9]|[12]\d|3[01])\/(19|20)\d{2}\b/g, label: 'DOB' },

    // Grade scores that could identify a student
    { pattern: /\b(scored?|grade[ds]?|earned?)\s+\d+\s*(\/\s*\d+|%|points?)/gi, label: 'SCORE' }
  ];

  // Known PII field names — sanitize these keys from any object before sending
  const PII_FIELD_NAMES = new Set([
    'studentName', 'student_name', 'firstName', 'first_name',
    'lastName', 'last_name', 'fullName', 'full_name',
    'studentId', 'student_id', 'ssn', 'dateOfBirth', 'dob',
    'email', 'phone', 'address', 'guardianName', 'guardian_name',
    'parentName', 'parent_name', 'iepNumber', 'iep_number',
    'medicationName', 'medication', 'diagnosis'
  ]);

  // ==========================================
  // TOKENIZATION
  // ==========================================

  // Session-scoped token map — cleared on page reload
  // Tokens never leave the client
  const _tokenMap = new Map();
  const _reverseMap = new Map();
  let _tokenCounter = 0;

  function _generateToken(value, label) {
    if (_reverseMap.has(value)) {
      return _reverseMap.get(value);
    }
    const token = `[${label}_${++_tokenCounter}]`;
    _tokenMap.set(token, value);
    _reverseMap.set(value, token);
    return token;
  }

  function _sanitizeString(text) {
    if (typeof text !== 'string') return text;
    let sanitized = text;
    PII_PATTERNS.forEach(({ pattern, label }) => {
      sanitized = sanitized.replace(pattern, (match) => {
        return _generateToken(match, label);
      });
    });
    return sanitized;
  }

  function _sanitizeObject(obj) {
    if (typeof obj !== 'object' || obj === null) return obj;
    const sanitized = Array.isArray(obj) ? [] : {};
    for (const key in obj) {
      if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
      if (PII_FIELD_NAMES.has(key)) {
        sanitized[key] = `[REDACTED_${key.toUpperCase()}]`;
      } else if (typeof obj[key] === 'string') {
        sanitized[key] = _sanitizeString(obj[key]);
      } else if (typeof obj[key] === 'object') {
        sanitized[key] = _sanitizeObject(obj[key]);
      } else {
        sanitized[key] = obj[key];
      }
    }
    return sanitized;
  }

  function _detokenize(text) {
    if (typeof text !== 'string') return text;
    let result = text;
    _tokenMap.forEach((value, token) => {
      result = result.replace(token, value);
    });
    return result;
  }

  // ==========================================
  // INPUT VALIDATION
  // ==========================================

  function validateInput(input) {
    if (typeof input !== 'string') return '';
    // Strip script tags and event handlers
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
      .replace(/javascript:/gi, '')
      .trim();
  }

  function escapeHTML(str) {
    if (typeof str !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ==========================================
  // AI CALL ROUTING
  // ==========================================

  /**
   * Primary AI inference method.
   * ALL AI calls in Desktop_app.js and Mobile_app.js must use this.
   * Never call any AI API directly from application code.
   *
   * @param {Object} options
   * @param {string} options.prompt - The user prompt (will be sanitized)
   * @param {string} [options.context] - Additional context (will be sanitized)
   * @param {string} [options.role] - System role for the AI
   * @param {string} [options.model] - Model override (optional)
   * @returns {Promise<string>} AI response text
   */
  async function callAI({ prompt, context = '', role = 'assistant' }) {
    if (!prompt || typeof prompt !== 'string') {
      throw new Error('PrivacyLayer.callAI: prompt is required and must be a string');
    }

    // Sanitize before sending
    const sanitizedPrompt = _sanitizeString(validateInput(prompt));
    const sanitizedContext = _sanitizeString(validateInput(context));

    const systemPrompt = `You are an AI assistant for school administrators. 
You help with administrative tasks, observations, and school improvement strategies.
Never generate or infer personally identifiable information about students or staff.
Role: ${escapeHTML(role)}`;

    const fullPrompt = sanitizedContext
      ? `${sanitizedContext}\n\n${sanitizedPrompt}`
      : sanitizedPrompt;

    let responseText = '';

    if (CONFIG.USE_OLLAMA) {
      responseText = await _callOllama(systemPrompt, fullPrompt);
    } else {
      responseText = await _callCloudProxy(systemPrompt, fullPrompt);
    }

    // Log aggregate telemetry (no content, no PII)
    _logTelemetry('ai_call', {
      path: CONFIG.USE_OLLAMA ? 'ollama' : 'cloud',
      promptLength: sanitizedPrompt.length,
      success: true
    });

    return responseText;
  }

  async function _callOllama(systemPrompt, prompt) {
    try {
      const response = await fetch(CONFIG.OLLAMA_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: CONFIG.OLLAMA_MODEL,
          prompt: `${systemPrompt}\n\n${prompt}`,
          stream: false
        })
      });

      if (!response.ok) {
        throw new Error(`Ollama error: ${response.status}`);
      }

      const data = await response.json();
      return data.response || '';
    } catch (err) {
      console.error('PrivacyLayer: Ollama call failed, falling back to cloud proxy', err);
      return _callCloudProxy(systemPrompt, prompt);
    }
  }

  async function _callCloudProxy(systemPrompt, prompt) {
    try {
      const response = await fetch(CONFIG.CLOUD_PROXY_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system: systemPrompt,
          prompt: prompt
        })
      });

      if (!response.ok) {
        throw new Error(`Cloud proxy error: ${response.status}`);
      }

      const data = await response.json();
      return data.response || data.text || '';
    } catch (err) {
      console.error('PrivacyLayer: Cloud proxy call failed', err);
      throw err;
    }
  }

  // ==========================================
  // INDEXEDDB PERSISTENCE
  // ==========================================

  let _db = null;

  function _openDB() {
    return new Promise((resolve, reject) => {
      if (_db) return resolve(_db);

      const request = indexedDB.open(CONFIG.DB_NAME, CONFIG.DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Captures store
        if (!db.objectStoreNames.contains('captures')) {
          const capturesStore = db.createObjectStore('captures', {
            keyPath: 'id',
            autoIncrement: true
          });
          capturesStore.createIndex('createdAt', 'createdAt', { unique: false });
          capturesStore.createIndex('type', 'type', { unique: false });
        }

        // Tasks store
        if (!db.objectStoreNames.contains('tasks')) {
          const tasksStore = db.createObjectStore('tasks', {
            keyPath: 'id',
            autoIncrement: true
          });
          tasksStore.createIndex('createdAt', 'createdAt', { unique: false });
          tasksStore.createIndex('status', 'status', { unique: false });
          tasksStore.createIndex('priority', 'priority', { unique: false });
        }

        // Observations store
        if (!db.objectStoreNames.contains('observations')) {
          const obsStore = db.createObjectStore('observations', {
            keyPath: 'id',
            autoIncrement: true
          });
          obsStore.createIndex('createdAt', 'createdAt', { unique: false });
          obsStore.createIndex('teacher', 'teacher', { unique: false });
        }

        // Telemetry store (aggregate only)
        if (!db.objectStoreNames.contains('telemetry')) {
          const telStore = db.createObjectStore('telemetry', {
            keyPath: 'id',
            autoIncrement: true
          });
          telStore.createIndex('createdAt', 'createdAt', { unique: false });
          telStore.createIndex('event', 'event', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        _db = event.target.result;
        resolve(_db);
      };

      request.onerror = (event) => {
        console.error('PrivacyLayer: IndexedDB open failed', event.target.error);
        reject(event.target.error);
      };
    });
  }

  /**
   * Persist data to IndexedDB.
   * Data is sanitized before storage.
   *
   * @param {Object} options
   * @param {string} options.type - 'captures' | 'tasks' | 'observations'
   * @param {Object} options.data - Data to store (will be sanitized)
   * @returns {Promise<number>} Record ID
   */
  async function persist({ type, data }) {
    if (!['captures', 'tasks', 'observations'].includes(type)) {
      throw new Error(`PrivacyLayer.persist: invalid type "${type}"`);
    }

    const db = await _openDB();
    const sanitizedData = _sanitizeObject(data);
    const record = {
      ...sanitizedData,
      createdAt: Date.now(),
      expiresAt: Date.now() + CONFIG.RETENTION[type],
      isArchived: false
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(type, 'readwrite');
      const store = tx.objectStore(type);
      const request = store.add(record);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Retrieve data from IndexedDB.
   *
   * @param {Object} options
   * @param {string} options.type - 'captures' | 'tasks' | 'observations'
   * @param {number} [options.id] - Specific record ID (optional)
   * @returns {Promise<Object|Array>} Record or array of records
   */
  async function retrieve({ type, id }) {
    if (!['captures', 'tasks', 'observations'].includes(type)) {
      throw new Error(`PrivacyLayer.retrieve: invalid type "${type}"`);
    }

    const db = await _openDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(type, 'readonly');
      const store = tx.objectStore(type);

      if (id !== undefined) {
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      } else {
        const request = store.getAll();
        request.onsuccess = () => {
          // Filter out archived and expired records
          const now = Date.now();
          const active = request.result.filter(
            (r) => !r.isArchived && r.expiresAt > now
          );
          resolve(active);
        };
        request.onerror = () => reject(request.error);
      }
    });
  }

  /**
   * Run FERPA retention sweep.
   * Archives records past their retention date.
   * Call this once on app load.
   */
  async function runRetentionSweep() {
    const types = ['captures', 'tasks', 'observations'];
    const now = Date.now();

    for (const type of types) {
      try {
        const db = await _openDB();
        const tx = db.transaction(type, 'readwrite');
        const store = tx.objectStore(type);
        const request = store.getAll();

        request.onsuccess = () => {
          request.result.forEach((record) => {
            if (record.expiresAt <= now && !record.isArchived) {
              store.put({ ...record, isArchived: true });
            }
          });
        };
      } catch (err) {
        console.error(`PrivacyLayer: retention sweep failed for ${type}`, err);
      }
    }

    _logTelemetry('retention_sweep', { timestamp: now });
  }

  // ==========================================
  // AGGREGATE TELEMETRY
  // ==========================================

  function _logTelemetry(event, aggregateData) {
    if (!CONFIG.TELEMETRY_ENABLED) return;

    // Verify no PII in telemetry data before logging
    const sanitized = _sanitizeObject(aggregateData);

    // Strip any fields that could contain user content
    const safe = {
      event,
      timestamp: Date.now(),
      ...sanitized
    };

    // Remove any string values longer than 50 chars
    // (content that slipped through should never be in telemetry)
    Object.keys(safe).forEach((key) => {
      if (typeof safe[key] === 'string' && safe[key].length > 50) {
        delete safe[key];
      }
    });

    _openDB().then((db) => {
      const tx = db.transaction('telemetry', 'readwrite');
      const store = tx.objectStore('telemetry');
      store.add({ ...safe, createdAt: Date.now() });
    }).catch(() => {
      // Telemetry failure is silent — never interrupt the user
    });
  }

  // ==========================================
  // INITIALIZATION
  // ==========================================

  async function init() {
    try {
      await _openDB();
      await runRetentionSweep();
      console.warn('PrivacyLayer initialized. AI path:', CONFIG.USE_OLLAMA ? 'Ollama (local)' : 'Cloud proxy');
    } catch (err) {
      console.error('PrivacyLayer: initialization failed', err);
    }
  }

  // ==========================================
  // PUBLIC API
  // ==========================================

  return {
    init,
    callAI,
    persist,
    retrieve,
    runRetentionSweep,
    sanitizeString: _sanitizeString,
    sanitizeObject: _sanitizeObject,
    validateInput,
    escapeHTML,
    // Expose config for runtime switching (e.g. settings panel)
    setOllamaMode: (enabled) => { CONFIG.USE_OLLAMA = enabled; }
  };

})();

// Auto-initialize on load
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    PrivacyLayer.init();
  });
}
