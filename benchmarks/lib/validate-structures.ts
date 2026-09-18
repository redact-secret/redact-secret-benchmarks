import type { Fixture } from '../types.ts';
import type { KeyObject } from 'node:crypto';
import { createPrivateKey, createPublicKey, verify } from 'node:crypto';

// Node-only structural checks supplement lexical contracts. Nothing contacts
// a provider. The JWT signing key is deliberately public benchmark material.
export function validateStructures(fixtures: Fixture[]) {
  const selected = fixtures.filter(f => f.assessment?.kind === 'must-redact' && f.assessment.tier !== 'T0');
  const keys: KeyObject[] = [];
  for (const f of selected.filter(f => f.assessment.contract === 'private-key')) {
    for (const r of f.expected) {
      const key = createPrivateKey(Buffer.from(f.content).subarray(r.start, r.end));
      if (key.asymmetricKeyType !== 'ed25519') throw new Error(`Unsupported reviewed key type: ${f.id}`);
      keys.push(createPublicKey(key));
    }
  }
  for (const f of selected.filter(f => f.assessment.contract === 'jwt')) {
    for (const r of f.expected) {
      const token = Buffer.from(f.content).subarray(r.start, r.end).toString();
      const parts = token.split('.');
      if (parts.length !== 3 || JSON.parse(Buffer.from(parts[0], 'base64url').toString()).alg !== 'EdDSA' || !keys.some(key => verify(null, Buffer.from(parts.slice(0, 2).join('.')), key, Buffer.from(parts[2], 'base64url')))) throw new Error(`Invalid reviewed JWT signature: ${f.id}`);
      const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
      if (claims.iss !== 'https://example.invalid' || claims.exp !== 4102444800) throw new Error(`Unexpected test JWT claims: ${f.id}`);
    }
  }
}
