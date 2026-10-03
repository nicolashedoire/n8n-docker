# Qualité des réponses — version facts-v2

## Le défaut qui a motivé cette correction

La première version pouvait produire un résumé juste tout en écrivant le brouillon au nom du client (« nous souhaitons automatiser »), puis redemander le périmètre déjà fourni. Les contrôles de structure et de cheminement réussissaient : ils ne mesuraient pas suffisamment la pertinence de la réponse.

Un essai de prompt plus strict n’a pas suffi : d’autres cas redemandaient une disponibilité connue ou considéraient une demande de renseignements sans sujet comme complète. La correction porte donc sur les responsabilités du modèle et de n8n.

## Le nouveau parcours visible dans n8n

1. **Extraire les faits avec IA** : le service appelle le fournisseur choisi, OpenAI ou Ollama, pour proposer une catégorie et des extraits du message.
2. **Valider les faits** : vérifier le contrat et retrouver chaque extrait dans le message original.
3. **Appliquer les règles de qualification** : calculer les informations manquantes selon la catégorie.
4. **Composer le brouillon** : utiliser des gabarits rédigés au nom du prestataire ; poser uniquement les questions nécessaires.
5. **Enregistrer le résultat** : le serveur recalcule indépendamment le résultat avant de le conserver.

L’IA ne rédige plus librement la réponse. Ce choix est explicite : elle interprète le texte et extrait les faits ; les règles déterministes assurent le statut et la cohérence du brouillon. L’interface indique « Brouillon préparé par n8n » pour cette version.

## Contrat d’extraction

```json
{
  "category": "devis",
  "facts": {
    "need": "automatiser la qualification de nos demandes commerciales et leur enregistrement dans Google Sheets",
    "budget": "4 000 €",
    "deadline": "avant le 15 novembre 2026",
    "availability": "",
    "product": "",
    "problem": ""
  }
}
```

Une chaîne vide signifie que le fait est absent ou non suffisamment précisé. Les six clés sont obligatoires ; aucun champ supplémentaire n’est accepté. Les chaînes renseignées doivent être des extraits du message, de 300 caractères au maximum ; elles ne doivent pas être inventées ou reformulées.

La preuve de source applique exactement : normalisation Unicode **NFC**, remplacement des apostrophes **U+2018 `‘` et U+2019 `’`** par **U+0027 `'`**, regroupement des espaces, suppression des espaces périphériques et passage en minuscules. Elle ne retire pas les accents, ne change pas la ponctuation restante et ne reformate pas les nombres. `l’automatisation` peut correspondre à `l'automatisation` ; un budget inventé ou une paraphrase reste refusé. Les tests couvrent ces deux frontières.

| Catégorie | Éléments nécessaires |
| --- | --- |
| Devis | Besoin concret, budget, échéance |
| Rendez-vous | Sujet et disponibilité |
| Support | Produit ou service concerné, description du problème |
| Autre | Sujet ou besoin suffisamment précis |

Les gabarits de réponse n’insèrent pas le texte libre du client. Une demande complète reçoit un accusé de réception sans question ni chiffrage inventé. Une demande incomplète reçoit exclusivement les questions correspondant aux éléments manquants. Les extraits restent utiles au diagnostic et au résumé.

Une courte liste explicite de besoins génériques, tels que « automatiser mon entreprise » ou « des renseignements », est traitée comme imprécise par les règles. Cette liste couvre les régressions observées ; elle ne constitue pas un détecteur universel de demandes vagues.

Le résultat conservé garde les quatre champs `category`, `summary`, `missing_information`, `draft_reply`. Les métriques identifient la version `facts-v2`, la méthode `template`, le fournisseur et le modèle. L’extraction est conservée dans l’événement d’enregistrement et exposée dans le dossier. Les anciennes demandes sont préservées et leur brouillon est signalé comme provenant de la version précédente ; rejouer un ancien identifiant conserve son ancien résultat, conformément à la règle de déduplication. Un nouvel identifiant est requis pour tester la correction.

## Le fournisseur ne remplace pas la politique métier

`LLM_PROVIDER` vaut `openai` ou `ollama`, sans basculement automatique. Le mode OpenAI utilise Responses API, `OPENAI_MODEL=gpt-5.6-terra` par défaut et un schéma JSON strict ; le mode Ollama fourni utilise `qwen2.5:3b`. Les mêmes contrôles de source, règles de complétude et gabarits s’appliquent aux deux. [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs) contraint la forme de la réponse ; la pertinence des faits et leur affectation au bon champ restent à évaluer. Le [modèle OpenAI](https://developers.openai.com/api/docs/models/gpt-5.6-terra) est configurable.

## Ce qu’on vérifie désormais

Les cas de qualité ont des attentes fixées avant l’appel du modèle : catégorie, faits reconnus, informations manquantes, rôle du rédacteur, questions autorisées et absence de fausse approbation ou d’envoi. Un simple HTTP 200 ou un JSON conforme ne suffit pas.

```bash
npm test
EXPECTED_PROVIDER=openai node scripts/test-workflow.mjs
EXPECTED_PROVIDER=openai node scripts/test-quality.mjs
```

La suite de qualité utilise des messages fictifs et le vrai workflow publié. Remplacer `openai` par `ollama` pour tester le fournisseur local ; cette variable vérifie la configuration, elle ne la modifie pas. Les règles sont également testées sans modèle pour distinguer un défaut d’extraction d’un défaut de logique métier.

**État au 3 octobre 2026 :** la nouvelle mesure facts-v2 avec Ollama donne **7/7 contrôles de parcours et 5/9 cas de qualité métier**. Les quatre échecs sont un extrait non attesté correctement bloqué, une demande vague considérée complète et deux demandes de précision inutiles. La correction des gabarits ne résout donc pas tous les défauts d’extraction. Les résultats et les critères fixés avant l’inférence sont conservés dans le [rapport du corpus](quality-2026-10-03.json).

Les sept contrôles historiques de la première version restent une mesure distincte et n’annulent pas ses défauts de contenu. L’adaptateur OpenAI a des tests simulés ; aucune exécution OpenAI réelle n’est validée, car la clé n’a pas encore été fournie. Voir le [rapport de validation daté](VALIDATION.md) avant de citer un taux de réussite. Ces résultats ne permettent pas d’annoncer un service prêt pour la production.

## Limites à expliquer en entretien

Une citation présente dans le message peut encore être mal classée. La validation de provenance ne prouve donc pas à elle seule la pertinence de l’extraction. Les règles de complétude ne remplacent pas une étude commerciale, et un dossier sans information manquante n’est pas un devis établi. La catégorie, les faits et le brouillon restent à relire.

Le modèle n’a aucun outil d’action. Les gabarits empêchent la recopie d’une instruction hostile dans le brouillon, mais le classement et le résumé fondés sur les faits restent à examiner. Aucune garantie générale d’immunité aux injections n’est revendiquée. Aucun email n’est envoyé.
