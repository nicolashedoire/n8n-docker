# Lire le workflow et comprendre les données

Guide pédagogique fondé sur le code et l’export public lus le 3 octobre 2026. Il explique les **25 nœuds de traitement et les 5 notes**, ainsi que le service local auquel n8n fait appel. Le nœud Google Sheets fait partie des 25, mais il est désactivé dans l’export public sans configuration.

Les extraits de code sont tirés du projet ou réduits à leur partie utile, avec les omissions signalées. Les exemples de données sont fictifs. Les JSON d’illustration montrent les contrats ; ils ne prétendent pas reproduire mot pour mot toutes les réponses d’une exécution enregistrée.

## 1. Le besoin métier avant les nœuds

Une personne reçoit des demandes de devis, de rendez-vous, de support et de renseignements. Avant d’y répondre, elle doit comprendre la demande, repérer les précisions nécessaires et préparer une réponse cohérente.

Le workflow prépare ce travail. L’IA choisit une catégorie et extrait des faits du message. Des règles écrites dans n8n vérifient les faits, calculent les informations manquantes et composent un brouillon. Le dossier est enregistré avant sa présentation à une personne. Aucun email n’est envoyé, même après approbation.

Ce projet est un **workflow déterministe avec une étape IA** : les étapes sont fixées dans le graphe. Le modèle n’a aucun outil et ne décide pas de lancer des actions. Le qualifier d’agent entièrement autonome décrirait un autre fonctionnement.

### Les responsabilités des composants

| Composant | Ce qu’il fait | Ce qu’il ne décide pas |
| --- | --- | --- |
| n8n | Déclenchement, validation initiale, branchements, appels HTTP, règles métier, gabarits, intégration Sheets | Il ne laisse pas le modèle choisir les branches à sa place |
| Service Node.js local | Réservation atomique, adaptateur du fournisseur IA, nouvelle vérification du résultat, SQLite, interface de revue | Il ne considère pas un JSON provenant de n8n comme fiable sans contrôle |
| OpenAI ou Ollama | Catégorie et faits extraits du texte | Approbation, envoi, écriture directe dans la base, choix des étapes |
| SQLite | Demandes, résultats, métriques, événements et décisions | Le stockage ne remplace pas la validation métier |
| Google Sheets, facultatif | Copie de suivi du résultat initial | Il n’est pas le stockage qui fait autorité |
| Personne qui relit | Approuver ou rejeter le brouillon dans le tableau | L’approbation n’envoie aucun message dans ce prototype |

L’appel visible dans n8n est `n8n → http://qualification-api:3000/llm`. Le service appelle ensuite le fournisseur configuré. Avec OpenAI, il appelle l’API Responses distante ; avec Ollama, le serveur de modèle local. La clé OpenAI reste dans le service, hors du workflow exporté.

## 2. Lire les données n8n sans se perdre

n8n transmet des **items**, généralement sous la forme suivante :

```js
[
  { json: { /* données du premier item */ } }
]
```

Ce workflow traite **une demande par exécution**. Les nœuds Code lisent donc le premier item et renvoient un seul item. Envoyer un lot de plusieurs demandes dans le même item ne produit pas automatiquement plusieurs dossiers.

| Syntaxe rencontrée | Signification ici |
| --- | --- |
| `$input.first().json` | Les données reçues par le nœud Code courant |
| `$json` | Les données de l’item courant dans une expression n8n |
| `$('Réserver sans doublon').first().json` | Les données produites précédemment par ce nœud nommé |
| `={{ ... }}` | Expression évaluée par n8n dans un champ de configuration |
| `??` | Utiliser la valeur de droite seulement si celle de gauche vaut `null` ou `undefined` |
| `?.` | Accéder à une propriété sans planter si l’objet intermédiaire est absent |
| `...objet` | Recopier les propriétés d’un objet dans un nouvel objet |
| `try / catch` | Intercepter une erreur et la transformer en une sortie contrôlée |
| `return [{ json: résultat }]` | Fournir un item à la suite du workflow |

Les références par nom permettent de retrouver le message original et la réservation après un appel HTTP, dont la réponse remplace les données de l’item courant. Renommer un nœud nécessite de vérifier aussi ces références ; le générateur conserve cette cohérence.

Un nœud IF possède une sortie vraie et une sortie fausse. Un nœud HTTP configuré avec `onError: continueErrorOutput` possède une sortie normale et une sortie d’erreur. **Une sortie d’erreur n’est pas la sortie fausse d’un IF** : les deux expriment des situations différentes.



![Vue du parcours réel, exécution terminée avec OpenAI](https://raw.githubusercontent.com/nicolashedoire/n8n-docker/main/docs/images/execution-n8n-openai.png)

## 3. Carte du parcours et numérotation

Les numéros ci-dessous servent à lire le tutoriel ; ils ne sont pas ajoutés aux noms réels des nœuds.

```text
1 Formulaire ─┐
             ├─ 3 Normaliser ─ 4 Entrée valide ?
2 Webhook ───┘                 ├─ non ─ 5 Entrée à corriger
                               └─ oui ─ 6 Réserver
                                        ├─ erreur ─ 9 Réservation refusée
                                        └─ succès ─ 7 Nouvelle tentative ?
                                                    ├─ non ─ 8 Résultat existant
                                                    └─ oui ─ 10 Extraire avec IA
                                                              ├─ erreur ─ 14 Contenir la panne ─┐
                                                              └─ succès ─ 11 Valider les faits │
                                                                           ↓                   │
                                                                     12 Règles métier          │
                                                                           ↓                   │
                                                                     13 Brouillon ─────────────┤
                                                                                              ↓
                                                                                     15 Enregistrer
                                                                                      ├─ erreur ─ 16
                                                                                      └─ succès ─ 17 Préparer le suivi
                                                                                                  ↓
                                                                                        18 Sheets configuré ?
                                                                                          ├─ non ─ 22 → 23
                                                                                          └─ oui ─ 19 Sheets
                                                                                                    ├─ succès ─ 20
                                                                                                    └─ erreur ─ 21
                                                                                                         ↓
                                                                                                      24 Fin
```

Toute erreur des appels de confirmation **20, 21 ou 22** rejoint **25 — Suivi de synchronisation à vérifier**. Le détail de ces branches est expliqué plus bas.

## 4. Le contrat d’entrée, avec Camille

Le tableau local envoie un objet de ce type au webhook. Le nom, l’email et l’identifiant ci-dessous sont fictifs :

```json
{
  "request_id": "tuto_camille_001",
  "first_name": "Camille",
  "last_name": "Exemple",
  "email": "camille@example.test",
  "message": "Bonjour, nous souhaitons automatiser la qualification de nos demandes commerciales et leur enregistrement dans Google Sheets. Nous recevons environ 50 demandes par semaine. Notre budget est de 4 000 € et nous souhaitons démarrer avant le 15 novembre 2026. Pouvez-vous nous proposer un devis ?",
  "scenario": "normal"
}
```

L’identifiant sert à reconnaître un rejeu. Il ne faut pas le confondre avec l’identité du client. Le scénario `normal` appelle réellement le modèle configuré ; les scénarios `api_error` et `invalid_json` servent aux injections de panne explicites.

## Sources et navigation

[Accueil du tutoriel dans Notion](https://app.notion.com/p/3eece9b72fb781898b1df8126e706fee) · [Générateur du workflow](https://github.com/nicolashedoire/n8n-docker/blob/main/scripts/build-workflows.mjs) · [Politique de qualification](https://github.com/nicolashedoire/n8n-docker/blob/main/demo/qualification-policy.mjs) · [Export JSON](https://github.com/nicolashedoire/n8n-docker/blob/main/workflows/02-qualification-ia.json)
