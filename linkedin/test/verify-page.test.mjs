import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyPage } from '../lib/verify-page.mjs';

const html = '<ul class="jobs-search__results-list"><li><div class="base-card base-search-card">Offre</div></li></ul>';
test('accepte une vraie structure de résultats même avec un lien de connexion', () => {
  assert.equal(verifyPage({ statusCode: 200, body: html + '<a>Sign in</a>' }).http_status, 200);
});
test('signale les refus, limitations et redirections au lieu de les exporter', () => {
  for (const status of [401, 403, 429, 999, 302, 500]) {
    assert.throws(() => verifyPage({ statusCode: status, body: html }), new RegExp(String(status)));
  }
});
test('un mur de connexion et une recherche vide ne deviennent pas des succès', () => {
  for (const body of ['<html>Sign in to LinkedIn</html>', '<ul class="jobs-search__results-list"></ul>']) {
    assert.throws(() => verifyPage({ statusCode: 200, body }), /SANS_CARTES/);
  }
});
test('refuse un corps JSON ou un mauvais content-type', () => {
  assert.throws(() => verifyPage({ statusCode: 200, body: {} }), /FORMAT/);
  assert.throws(() => verifyPage({ statusCode: 200, body: html, headers: { 'content-type': 'application/json' } }), /FORMAT/);
});
