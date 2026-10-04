# Validation des incidents — 4 octobre 2026

**Huit cas injectés, huit résultats conformes**, dans le moteur natif **n8n 2.39.8**. Une première campagne couvre sept cas ; un essai supplémentaire vérifie une panne après un véritable appel d'outil. Aucun appel à OpenAI ou à un autre modèle réel n'a été effectué par ces tests.

## Dispositif

Le [harness](../test-agent-incidents.mjs) crée une instance n8n jetable, avec la même image Docker que la démonstration, une base neuve, un serveur Responses fictif et un réseau Docker interne sans accès à Internet. Aucun port n'est exposé. Les seules connexions importées contiennent une clé explicitement synthétique. La base, les workflows et les connexions de production ne sont ni copiés ni modifiés.

Les clones reprennent les nœuds natifs Agent, Modèle OpenAI et **Expliquer l'incident** depuis l'export public. Le déclencheur devient manuel et le message est synthétique. Le Code de réponse d'incident est identique à celui du workflow. La politique testée est :

- Agent : `retryOnFail:true`, `maxTries:2`, `waitBetweenTries:1000`.
- Modèle : `maxRetries:0`, pour éviter de cumuler deux mécanismes de reprise.
- Sortie d'erreur de l'Agent : `continueErrorOutput`, reliée au Code d'incident.
- Cas timeout uniquement : délai modèle réduit à **1 seconde** dans le clone ; la production garde **60 secondes**.

Les reprises de l'Agent ne sélectionnent pas les erreurs selon leur cause : **401 et quota sont aussi retentés une fois** avant le message final. Le champ `retryable:false` du résultat conseille une intervention sur le compte ; il ne signifie pas qu'aucune tentative automatique n'a déjà eu lieu.

## Résultats observés

| Cas injecté | Résultat du vrai workflow n8n | Requêtes au faux modèle | Durée côté test |
| --- | --- | ---: | ---: |
| Clé invalide, HTTP 401 persistant | `AUTHENTICATION`, message contrôlé | 2 | 3,049 s |
| Quota épuisé, HTTP 429 persistant | `QUOTA_EXCEEDED`, message contrôlé | 2 | 2,990 s |
| Service indisponible, HTTP 503 persistant | `SERVICE_UNAVAILABLE`, message contrôlé | 2 | 3,041 s |
| HTTP 200 contenant un JSON invalide | `INVALID_RESPONSE`, message contrôlé | 2 | 2,986 s |
| Réponse trop lente, délai du clone dépassé | `TIMEOUT`, message contrôlé | 2 | 5,029 s |
| HTTP 503 puis réponse valide | Récupération : réponse synthétique de l'Agent, sans passage par le Code d'incident | 2 | 3,128 s |
| Limitation temporaire HTTP 429 puis réponse valide | Récupération : réponse synthétique de l'Agent, sans passage par le Code d'incident | 2 | 3,101 s |
| Appel d'outil demandé par le modèle, outil HTTP réussi, puis HTTP 503 persistant | `SERVICE_UNAVAILABLE` après l'outil, message contrôlé | 3 | 3,143 s |

Le dernier cas a réellement exécuté **une fois** le nœud d'outil HTTP synthétique. Sa première réponse modèle demandait cet outil ; les deux suivantes ont retourné l'erreur 503. Ce test couvre donc une erreur au cours de la boucle de l'Agent, après un résultat d'outil. Il ne s'agit pas simplement d'un objet d'erreur envoyé directement au Code.

Les compteurs proviennent du serveur fictif. Deux essais du nœud Agent ne signifient pas deux appels modèle maximum pour toute une conversation : un fonctionnement normal peut appeler le modèle plusieurs fois pour choisir des outils et lire leurs résultats.

## Réponses réellement retournées

Le Code a notamment produit les textes suivants, chacun entouré du même message d'échec explicite et d'une référence d'incident :

| Code | Phrase observée |
| --- | --- |
| `AUTHENTICATION` | « La connexion au service IA doit être vérifiée par le responsable de la démonstration. » |
| `QUOTA_EXCEEDED` | « Le quota du service IA ne permet pas de continuer. Le responsable de la démonstration doit vérifier le compte. » |
| `SERVICE_UNAVAILABLE` | « Un service nécessaire à l'estimation est indisponible. Réessayez dans un instant. » |
| `INVALID_RESPONSE` | « La réponse reçue est inexploitable. Réessayez ; aucun chiffrage n'a été validé. » |
| `TIMEOUT` | « Le service n'a pas répondu dans le délai prévu. Réessayez dans un instant. » |

Chaque résultat d'incident contient `status:"technical_error"`, une référence `chantier-<id>` et `no_order_placed:true`. Les assertions vérifient l'absence de clé, d'en-tête d'authentification, de diagnostic brut ou d'adresse technique du faux fournisseur dans le texte utilisateur. Le message précise qu'aucun montant ne doit être considéré comme final.

Les exécutions n8n se terminent avec le statut technique `success` parce que la panne a été prise en charge et qu'une réponse a été produite. **Cela ne signifie pas qu'un chiffrage a réussi** : le résultat métier conserve `technical_error`.

## Preuves et nettoyage

Les sept premiers cas sont dans le dossier local ignoré :

`work/chantier-incidents/chantier-incidents-20261004151545732-476c6b/`

Le cas après outil est dans :

`work/chantier-incidents/chantier-incidents-20261004151705476-d24569/`

Chaque dossier contient le rapport, les traces n8n, les compteurs du serveur fictif et les empreintes du workflow et du Code testés. Les identifiants d'exécution **1 à 7**, puis **1**, appartiennent à des bases jetables différentes ; ils ne désignent pas les exécutions de production.

Le contrôle final a confirmé **zéro conteneur, volume ou réseau de test restant** après chaque campagne. Les fichiers locaux de preuves sont conservés ; ils ne contiennent que les données synthétiques du test.

## Reproduire

```sh
# Aucun Docker ni réseau : présente les cas prévus.
node chantier/test-agent-incidents.mjs --dry-run

# Huit cas, sur l'image déjà présente localement, sans modèle réel.
node chantier/test-agent-incidents.mjs --run

# Rejouer uniquement le cas après un outil.
node chantier/test-agent-incidents.mjs --run --only=after_tool503
```

L'option `--agent-retry-probe` reste un outil de diagnostic : elle force deux essais de l'Agent **dans les clones seulement**. Les deux campagnes finales ci-dessus ont utilisé la politique publique telle quelle, sans cette option.

Une campagne antérieure, avec `maxRetries:1` sur le seul modèle et sans reprise de l'Agent, avait correctement traité les cinq incidents mais n'avait pas récupéré les deux erreurs transitoires : une seule requête était observée. C'est la raison du choix ensuite validé : reprise bornée de l'Agent et reprise du modèle désactivée.

Ces tests prouvent les comportements observés pour ces formes d'erreurs. Ils ne garantissent pas la récupération à tous les stades possibles, ni la disponibilité de Docker, de n8n ou du fournisseur réel. Le dernier cas prouve une réponse sûre après un outil, pas la conservation ou le rejeu parfait d'une longue conversation après toute panne.
