// Fonction autonome : aussi insérée telle quelle dans le nœud Code n8n.
export function verifyPage(response) {
  const status = Number(response.statusCode);
  if (status === 429) throw new Error('LINKEDIN_429 : collecte limitée par le site. Arrêter et réessayer plus tard, sans relance automatique.');
  if ([401, 403, 999].includes(status)) throw new Error(`LINKEDIN_${status} : accès public refusé. Aucun contournement ni export de résultats.`);
  if (status >= 300 && status < 400) throw new Error(`LINKEDIN_REDIRECTION_${status} : la page publique redirige. Vérifier manuellement la source.`);
  if (status !== 200) throw new Error(`LINKEDIN_HTTP_${status || 'INCONNU'} : la collecte n'a pas abouti.`);
  const html = response.body ?? response.data;
  const contentType = String(response.headers?.['content-type'] || '');
  if (typeof html !== 'string' || (contentType && !/text\/html/i.test(contentType))) {
    throw new Error('LINKEDIN_FORMAT : une page HTML était attendue.');
  }
  // Ne pas confondre un simple lien « Sign in » du site avec un mur de connexion.
  const hasList = /<ul\b[^>]*class=["'][^"']*\bjobs-search__results-list\b/i.test(html);
  const hasCard = /<div\b[^>]*class=["'][^"']*\bbase-search-card\b/i.test(html);
  if (!hasList || !hasCard) {
    throw new Error('LINKEDIN_SANS_CARTES : aucune annonce exploitable détectée. Recherche vide, page de connexion ou structure modifiée : contrôler la réponse HTTP.');
  }
  return { html, collected_at: new Date().toISOString(), http_status: status };
}
