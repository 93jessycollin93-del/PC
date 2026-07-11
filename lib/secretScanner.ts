/**
 * Secret Leak Detector
 * Scans strings for plaintext API keys, tokens, and PII using regex patterns.
 * Used by defensive security tools and export sanitizers (Phase B step 21).
 */

export interface SecretMatch {
  type: 'api_key' | 'token' | 'pii' | 'entropy_high';
  match: string;
  start: number;
  end: number;
  confidence: 'high' | 'medium' | 'low';
}

// Patterns for common secret formats
const SECRET_PATTERNS = [
  // API keys: long hex strings, Base64 sequences (common across providers)
  {
    type: 'api_key' as const,
    name: 'Long hex string (32+ chars)',
    pattern: /[a-f0-9]{32,}/gi,
    confidence: 'medium' as const,
  },
  // Bearer tokens, JWT-like patterns
  {
    type: 'token' as const,
    name: 'Bearer token',
    pattern: /bearer\s+[a-z0-9_-]+/gi,
    confidence: 'high' as const,
  },
  // AWS key format
  {
    type: 'api_key' as const,
    name: 'AWS access key',
    pattern: /AKIA[0-9A-Z]{16}/g,
    confidence: 'high' as const,
  },
  // Google API key format
  {
    type: 'api_key' as const,
    name: 'Google API key',
    pattern: /AIza[0-9A-Za-z_-]{35}/g,
    confidence: 'high' as const,
  },
  // Slack webhook/token
  {
    type: 'token' as const,
    name: 'Slack token',
    pattern: /xox[baprs]-\d+-\d+[a-z0-9]{30}/g,
    confidence: 'high' as const,
  },
  // Common keywords followed by long strings (like 'api_key=', 'token=', 'secret=')
  {
    type: 'api_key' as const,
    name: 'Labeled secret',
    pattern: /(api[_-]?key|secret|token|password|passwd|pwd)\s*[=:]\s*[a-z0-9_\-\.]{20,}/gi,
    confidence: 'high' as const,
  },
  // Email addresses (PII)
  {
    type: 'pii' as const,
    name: 'Email address',
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    confidence: 'medium' as const,
  },
  // Phone numbers (US format, PII)
  {
    type: 'pii' as const,
    name: 'Phone number',
    pattern: /\b(?:\+?1[-.]?)?\(?([0-9]{3})\)?[-.]?([0-9]{3})[-.]?([0-9]{4})\b/g,
    confidence: 'low' as const,
  },
];

/**
 * Scan a string for potential secrets and return all matches.
 * Returns empty array if no secrets detected.
 */
export function scanForSecrets(input: string): SecretMatch[] {
  if (!input || typeof input !== 'string' || input.length === 0) return [];

  const matches: SecretMatch[] = [];
  const seen = new Set<string>(); // Dedup matches

  for (const rule of SECRET_PATTERNS) {
    let match;
    const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
    while ((match = regex.exec(input)) !== null) {
      const matchText = match[0];
      if (!seen.has(matchText) && matchText.length > 8) {
        // Avoid tiny matches
        seen.add(matchText);
        matches.push({
          type: rule.type,
          match: matchText,
          start: match.index,
          end: match.index + matchText.length,
          confidence: rule.confidence,
        });
      }
    }
  }

  // High-entropy detector (Shannon entropy > threshold suggests encoded key)
  const highEntropyMatches = findHighEntropySections(input);
  for (const m of highEntropyMatches) {
    if (!seen.has(m.match)) {
      seen.add(m.match);
      matches.push(m);
    }
  }

  // Sort by position
  return matches.sort((a, b) => a.start - b.start);
}

/**
 * Find sections of text with unusually high character entropy
 * (indicator of base64/hex-encoded secrets).
 */
function findHighEntropySections(input: string): SecretMatch[] {
  const matches: SecretMatch[] = [];
  const minLen = 20;
  const minEntropy = 4.5;

  // Scan in sliding windows
  for (let i = 0; i < input.length - minLen; i++) {
    const window = input.slice(i, i + minLen);

    // Skip whitespace-heavy sections
    if (/\s/.test(window.slice(0, 5))) continue;

    const entropy = calculateEntropy(window);
    if (entropy >= minEntropy) {
      matches.push({
        type: 'entropy_high',
        match: window,
        start: i,
        end: i + minLen,
        confidence: 'medium',
      });
      i += minLen - 1; // Skip to avoid overlaps
    }
  }

  return matches;
}

/**
 * Calculate Shannon entropy of a string (0-8).
 * Higher entropy indicates more randomness (indicator of secrets).
 */
function calculateEntropy(str: string): number {
  const freq: Record<string, number> = {};
  for (const ch of str) {
    freq[ch] = (freq[ch] || 0) + 1;
  }

  let entropy = 0;
  for (const count of Object.values(freq)) {
    const p = count / str.length;
    entropy -= p * Math.log2(p);
  }

  return entropy;
}

/**
 * Redact secrets in a string, replacing matches with [REDACTED].
 * Returns the sanitized string.
 */
export function redactSecrets(input: string): string {
  const secrets = scanForSecrets(input);
  if (secrets.length === 0) return input;

  // Sort by position descending so we can replace without breaking indices
  const sorted = [...secrets].sort((a, b) => b.start - a.start);
  let result = input;
  for (const secret of sorted) {
    result =
      result.slice(0, secret.start) + '[REDACTED]' + result.slice(secret.end);
  }

  return result;
}

/**
 * Summary of detected secrets for reporting.
 */
export function summarizeSecrets(matches: SecretMatch[]): Record<string, number> {
  const summary: Record<string, number> = {};
  for (const m of matches) {
    const key = `${m.type}_${m.confidence}`;
    summary[key] = (summary[key] || 0) + 1;
  }
  return summary;
}
