// n8n Code node: this branch never calls a model and never echoes a raw error.
const item = $input.first()?.json ?? {};
const error = item.error ?? item;
const detail = typeof error === 'string' ? error : [error?.name, error?.message, error?.description, error?.httpCode, error?.status].filter(Boolean).join(' ');
const diagnostic = detail.slice(0, 4096).toLowerCase();
let code = 'SERVICE_UNAVAILABLE';
let retryable = true;
let message = 'Un service nécessaire à l’estimation est indisponible. Réessayez dans un instant.';
if (/401|403|unauthori[sz]ed|authori[sz]ation.*fail|authentication|check your credentials|invalid.*api.*key|incorrect.*api.*key/.test(diagnostic)) {
  code = 'AUTHENTICATION'; retryable = false;
  message = 'La connexion au service IA doit être vérifiée par le responsable de la démonstration.';
} else if (/insufficient[ _-]?quota|quota.*exceed|billing|credit balance/.test(diagnostic)) {
  code = 'QUOTA_EXCEEDED'; retryable = false;
  message = 'Le quota du service IA ne permet pas de continuer. Le responsable de la démonstration doit vérifier le compte.';
} else if (/429|rate.?limit|too many requests/.test(diagnostic)) {
  code = 'RATE_LIMITED';
  message = 'Le service IA reçoit trop de demandes. Patientez un moment, puis réessayez.';
} else if (/timeout|timed out|abort/.test(diagnostic)) {
  code = 'TIMEOUT';
  message = 'Le service n’a pas répondu dans le délai prévu. Réessayez dans un instant.';
} else if (/json|parse|parsing|invalid.*response|unexpected.*token/.test(diagnostic)) {
  code = 'INVALID_RESPONSE';
  message = 'La réponse reçue est inexploitable. Réessayez ; aucun chiffrage n’a été validé.';
}
const executionId = String($execution.id ?? '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80) || 'local';
const reference = `chantier-${executionId}`;
return [{ json: {
  output: `Je n’ai pas pu terminer votre estimation. ${message}\n\nAucun montant ne doit être considéré comme final pour cette demande. Aucun achat n’a été effectué.\n\nRéférence de l’incident : ${reference}.`,
  status: 'technical_error',
  incident: { code, retryable, reference },
  no_order_placed: true,
} }];
