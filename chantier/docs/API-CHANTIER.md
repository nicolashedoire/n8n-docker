# API de l’agent chantier — comprendre les échanges et les incidents

Guide relu dans le code le **5 octobre 2026**, pour présenter la configuration réelle de l’agent en entretien. Les exemples de calcul ci-dessous ont été vérifiés en appelant les fonctions locales avec le catalogue du **4 octobre 2026**. Ils ne sont pas des captures d’un nouvel appel OpenAI.

## 1. L’explication en trente secondes

> « J’ai séparé l’intelligence conversationnelle du métier. OpenAI comprend la demande et choisit les outils. Mon API métier lui donne des règles, des références de matériaux et des calculs contrôlés. L’agent transmet un objet JSON à chaque outil ; il lit ensuite le résultat pour répondre, affiner ou demander une précision. Les surfaces, les conditionnements et les montants sont calculés par du code. »

Une **API** est une interface par laquelle deux logiciels échangent des données selon un contrat. Ici, ce contrat indique l’adresse appelée, la méthode, les champs acceptés et la forme de la réponse.

Le mot API recouvre deux services distincts dans ce projet :

| Service | Son rôle | Ce qui l’appelle | Où se trouve sa configuration |
| --- | --- | --- | --- |
| **API OpenAI** | Comprendre le texte, choisir un outil et ses arguments, interpréter les résultats, rédiger la réponse. | Le nœud **Modèle OpenAI**, utilisé par l’agent. | Connexion OpenAI n8n ; modèle `gpt-5.6-terra` ; Responses API activée. |
| **API métier chantier** | Lire les règles et le catalogue, contrôler les entrées, calculer, produire le PDF. | Les quatre outils HTTP attachés à l’agent. | Service Node `chantier-api`, écrit dans [server.mjs](../server.mjs). |

Le service métier n’utilise pas la clé OpenAI et ne rappelle pas le modèle. Il s’appuie sur [rules.json](../rules.json), [catalog.json](../catalog.json), [quantities.mjs](../quantities.mjs) et les fonctions d’export PDF. Cette séparation rend les calculs testables sans consommation de crédits IA.

## 2. Ce qui se passe pour « Je refais ma salle de bains de 4 m sur 3 m »

1. Le chat fournit le texte et l’identifiant de session à **Agent achats chantier**.
2. Le modèle reçoit les consignes de l’agent, le contexte de conversation et la description des outils disponibles.
3. L’agent peut appeler **Consulter les règles** avec `project_type: "bathroom"` et `room_type: "wet"`. La réponse donne le périmètre couvert, les hypothèses, les sources et les données attendues.
4. Il recherche les matériaux dans la sélection datée. Les identifiants retournés servent à consulter une fiche ou à choisir des références pour le calcul.
5. Il appelle **Calculer les quantités** avec les dimensions connues. Le serveur vérifie les entrées puis applique les règles et les formules. Le serveur annonce lui-même les hypothèses manquantes.
6. L’API ajoute l’état de l’export PDF au résultat. L’agent présente les quantités, les limites, les points à confirmer et le lien exact si le document est prêt.

Les outils ne constituent pas une chaîne fixe dans laquelle chaque brique doit devenir verte à chaque message. L’agent choisit un appel selon le besoin ; un simple complément de conversation peut ne pas nécessiter tous les outils.

## 3. Montrer la configuration de l’API dans n8n

Ouvrir le workflow **L’Atelier · Agent IA achats chantier**, puis le nœud **Consulter les règles**.

| Paramètre visible | Valeur ou comportement | Comment l’expliquer |
| --- | --- | --- |
| Description de l’outil | Texte qui précise quand le consulter et les paramètres acceptés. | « Le modèle lit cette description pour décider si cet outil convient. » |
| Method | `POST` | « J’envoie des paramètres structurés dans le corps de la requête. » |
| URL | `http://chantier-api:3000/tools/rules` | « C’est l’adresse du service métier dans le réseau Docker. » |
| Send Body / JSON | Activé, corps JSON. | « Les noms et les types des champs forment le contrat. » |
| `$fromAI(...)` | Arguments proposés par le modèle pour cet appel. | « Le modèle remplit les arguments ; le serveur doit encore les valider. » |
| Response Format | JSON | « L’agent reçoit un résultat structuré exploitable. » |
| Timeout | `15000` millisecondes | « L’outil n’attend pas indéfiniment une réponse. » |

![Configuration réelle de l’outil Consulter les règles : corps JSON et délai HTTP.](images/configuration/08-regles-json.png)

Le corps de cet outil est une expression n8n :

```js
={{ {
  project_type: $fromAI("project_type", "Type du projet", "string"),
  room_type: $fromAI("room_type", "Type de pièce", "string")
} }}
```

Cet extrait pédagogique abrège seulement les descriptions des paramètres. L’expression construit un objet ; elle ne contient aucune formule de quantité. `"string"` demande un texte. Dans l’outil de calcul, `$fromAI("calculation", ..., "json")` demande un objet JSON complet. Ces indications aident le modèle à former son appel ; elles ne remplacent pas les contrôles du serveur.

Pour montrer la consultation d’un fournisseur, ouvrir **Consulter une fiche fournisseur** :

![Configuration réelle de la fiche fournisseur : identifiant de catalogue, booléen refresh et réponse JSON.](images/configuration/12-fiche-json.png)

Dans ce nœud, `product_id` est un texte et `refresh` un booléen. `false` signifie « lire le relevé daté » ; `true` signifie « tenter une vérification en ligne ». Le modèle ne fournit pas une URL libre.

**Adresses à distinguer :** les nœuds utilisent `http://chantier-api:3000` entre conteneurs. Le navigateur du Mac et les diagnostics utilisent `http://localhost:8788`. Le fichier [compose.chantier.yaml](../../compose.chantier.yaml) publie ce port sur `127.0.0.1`, pour l’usage local. Les liens PDF utilisent l’adresse du navigateur, pas le nom interne Docker.

## 4. Les six routes de l’API métier

Les quatre routes `/tools/...` attendent `Content-Type: application/json` et un **objet JSON**, pas un tableau. Le corps est limité à **65 536 octets, soit 64 Kio**.

| Méthode et route | Entrées acceptées | Sortie principale | Usage dans la démonstration |
| --- | --- | --- | --- |
| `GET /health` | Aucun corps. | `status`, nom du service, nombre de produits, date du catalogue, mode de prix. | Vérifier que le service répond. Aucun appel au modèle ni au fournisseur. |
| `POST /tools/rules` | `project_type`, `room_type`. | Règle, état métier, champs requis, questions, hypothèses, limites et sources. | Définir ce que le calculateur sait traiter. |
| `POST /tools/search` | `query` obligatoire ; `category` facultatif. | Produits classés, date du relevé, périmètre de recherche, nombre de correspondances. | Trouver les identifiants exacts du catalogue. |
| `POST /tools/product` | `product_id` obligatoire ; `refresh` facultatif, booléen. | Produit, prix daté, état de la vérification et éventuel prix en ligne séparé. | Examiner une référence et sa source. |
| `POST /tools/estimate` | Paramètres du projet ; le cas `bathroom` accepte au minimum `project_type`, `length_m`, `width_m`. | Mesures, hypothèses, lignes de matériaux, montants, état métier et `report`. | Calculer puis produire l’étude. |
| `GET /reports/<id>.pdf` | Identifiant généré par le serveur, exactement 32 caractères hexadécimaux minuscules. | Fichier PDF, ou HTTP 404. | Télécharger le rapport existant. |

Le serveur renvoie HTTP **404**, avec `not_found`, pour une route ou une méthode non prise en charge. Il ne renvoie pas un code 405 spécifique pour une mauvaise méthode dans cette version.

### Consulter les règles

Corps exact possible :

```json
{
  "project_type": "bathroom",
  "room_type": "wet"
}
```

Extrait de réponse, **champs omis pour la lecture** :

```json
{
  "status": "allowed",
  "rule_id": "bathroom_private_initial_estimate",
  "required_fields": ["length_m", "width_m"]
}
```

`allowed` signifie que le gabarit du prototype couvre cette demande. Cela ne certifie ni un ouvrage réalisé ni un système complet d’étanchéité. La réponse complète apporte précisément les hypothèses et les limites que l’agent doit annoncer.

`selectRules` accepte les projets `bathroom`, `tiling`, `partition` et `lining`. Une demande de plafond n’est pas calculable par ce moteur : le serveur renvoie `unsupported`. Pour les projets autres que `bathroom`, une pièce absente ou `unknown` demande une précision. Le gabarit salle de bains reconnaît une pièce humide ; déclarer explicitement `dry` est contradictoire.

### Rechercher les matériaux

```json
{
  "query": "carrelage",
  "category": "tile"
}
```

`category` peut valoir `tile`, `board`, `rail`, `stud` ou `insulation`. Le nœud n8n actuel envoie seulement `query` ; le filtre facultatif existe dans l’API.

La recherche porte sur **11 références sélectionnées**, dans le catalogue daté du 4 octobre 2026. Le code enlève les accents et normalise la casse, sépare la demande en mots, puis compte les mots présents dans l’identifiant, le nom, la catégorie et les étiquettes du produit. Une correspondance sur au moins un mot suffit. Les meilleurs scores sortent en premier ; à égalité, les identifiants départagent les résultats. La réponse contient au maximum **10 produits**, tandis que `total_matches` compte toutes les correspondances.

Ce choix est une recherche lexicale simple et inspectable. Ce n’est ni une recherche sémantique par embeddings, ni une base vectorielle, ni une exploration de tout le site Leroy Merlin. Zéro résultat donne une liste vide, sans référence inventée.

### Consulter une référence

```json
{
  "product_id": "tile_arcano_95985488",
  "refresh": false
}
```

Extrait de réponse, **objet `product` et autres champs omis** :

```json
{
  "status": "ok",
  "price_status": "snapshot",
  "refresh": { "status": "not_requested" },
  "catalog_snapshot_date": "2026-10-04",
  "estimate_price_basis": "catalog_snapshot"
}
```

Un identifiant inconnu donne HTTP **404** et `unknown_product`. Envoyer `"refresh": "true"` est refusé : le texte `"true"` n’est pas le booléen `true`.

### Calculer une étude

Pour le gabarit salle de bains, voici une requête minimale exacte :

```json
{
  "project_type": "bathroom",
  "length_m": 4,
  "width_m": 3
}
```

Les nombres JSON utilisent le point décimal, par exemple `2.5`. Ils ne sont ni entourés de guillemets ni accompagnés de `m`. Le texte utilisateur peut dire « 2,50 mètres » ; c’est l’agent qui prépare `2.5` pour l’outil.

Les champs facultatifs acceptés par le calculateur salle de bains sont `height_m`, `room_type`, `room_usage`, `margin_pct`, `openings`, `include_insulation`, `wall_finish`, `water_exposure`, `shower_footprint_m2`, `product_ids` et `budget_eur`. `room_type` accepte `wet` ou `unknown` ; `room_usage` accepte `private_bathroom` ou `unknown`. Ces deux champs servent notamment à refuser une contradiction ou un usage hors périmètre. La liste simplifiée `input_contract.optional` retournée par l’outil de règles ne les énumère pas ; la liste ci-dessus décrit l’implémentation de `estimateBathroom`.

Le calculateur possède ses références par défaut ; l’agent peut fournir des identifiants sélectionnés après consultation des règles et du catalogue. Les dimensions et options non indiquées par l’utilisateur doivent rester omises, pour que le moteur les signale comme hypothèses.

Extrait exact du résultat calculé avec le catalogue courant, **nombreux champs omis** :

```json
{
  "status": "ok",
  "preliminary": true,
  "total_eur": 1316.41,
  "known_subtotal_eur": 1316.41,
  "pricing_status": "snapshot_complete",
  "catalogue_snapshot_date": "2026-10-04",
  "no_order_placed": true
}
```

Le total concerne le panier de matériaux sélectionnés. `snapshot_complete` signifie que les prix de ces lignes sont connus ; il ne signifie pas que tous les travaux de rénovation sont chiffrés. `preliminary: true`, les exclusions et les confirmations demandées restent essentiels.

La fonction pure `estimate` produit le résultat métier. Ensuite seulement, la route HTTP ajoute `report`, dont l’état dépend de la création effective du fichier. Il ne faut pas inventer une URL dans l’explication : l’agent reprend celle du serveur.

## 5. HTTP et état métier : deux informations différentes

**HTTP indique si l’échange a été traité ; le champ métier indique ce que le logiciel peut en faire.** Cette version emploie une convention qu’il faut montrer honnêtement : la validation de `rules` et `estimate` retourne généralement HTTP 200 avec un statut métier. La validation de `search` et `product` utilise aussi des erreurs HTTP 422.

| Situation | HTTP | Réponse à lire | Conséquence |
| --- | --- | --- | --- |
| Calcul de la salle de bains 4 × 3 m | 200 | `status: "ok"`, estimation préliminaire. | Présenter les postes et les hypothèses. |
| Largeur manquante | 200 | `status: "needs_information"`, `missing_fields: ["width_m"]`. | Demander la largeur. |
| Longueur transmise comme texte `"4"` | 200 | `status: "invalid_input"`, problème sur `length_m`. | Corriger le type avant calcul. |
| Projet hors périmètre | 200 | `status: "unsupported"` et motif. | Expliquer la limite ; ne pas inventer de dimensionnement. |
| Hauteur de salle de bains portée à 2,70 m | 200 | `status: "partial"`, total global `null`, sous-total connu 153,01 €. | Conserver le sol calculé ; signaler les murs non chiffrés. |
| Corps JSON mal formé ou tableau au lieu d’objet | 400 | `error.code: "invalid_json"`. | Corriger le format de l’appel. |
| Corps supérieur à 64 Kio | 413 | `error.code: "body_too_large"`. | Réduire les données envoyées. |
| Type de contenu autre que JSON | 415 | `error.code: "json_required"`. | Envoyer le bon type de contenu. |
| Champ supplémentaire sur recherche/fiche | 422 | `error.code: "unknown_fields"`. | Respecter le contrat de l’outil. |
| Produit inconnu | 404 | `error.code: "unknown_product"`. | Rechercher une référence exacte. |
| PDF absent ou chemin non conforme | 404 | `error.code: "report_not_found"`. | Ne pas proposer de fichier inexistant. |
| Exception interne imprévue | 500 | `error.code: "internal_error"`, message générique. | Traiter l’incident sans exposer les détails internes. |

Exemple métier complet pour une largeur manquante :

```json
{
  "status": "needs_information",
  "missing_fields": ["width_m"],
  "questions": [
    {
      "field": "width_m",
      "question": "Quelle est la largeur intérieure de la salle de bains, en mètres ?"
    }
  ],
  "report": {
    "status": "not_available",
    "message": "Un calcul de matériaux est nécessaire avant de produire un PDF."
  }
}
```

Exemple d’erreur HTTP 404 sur une référence inconnue :

```json
{
  "error": {
    "code": "unknown_product",
    "message": "Référence absente du catalogue ; rechercher son identifiant exact."
  }
}
```

## 6. Les fonctions du serveur, et pourquoi elles existent

Le fichier [server.mjs](../server.mjs) organise les échanges. Les formules de surface et de quantité restent dans [quantities.mjs](../quantities.mjs).

| Fonction | Ce qu’elle fait exactement | Pourquoi ce choix |
| --- | --- | --- |
| `body(req)` | Vérifie le type JSON, lit le flux en comptant ses octets, arrête au-delà de 64 Kio, analyse le JSON et exige un objet. | Refuser tôt les formats inutilisables et les corps excessifs. |
| `fields(input, allowed)` | Refuse les clés hors de la liste des champs acceptés par recherche/fiche. | Une faute de nom ou un paramètre arbitraire ne doit pas être ignoré silencieusement. |
| `text(value, field, max)` | Exige un texte non vide, de longueur limitée, puis enlève les espaces de début et de fin. | Borner les requêtes et éviter un identifiant vide. `query` : 150 caractères ; `product_id` : 100. |
| `normalize(value)` | Retire les accents et met en minuscules. | Retrouver un même terme malgré des différences de saisie. |
| `validateCatalog(catalog)` | Contrôle le format de date, la liste de produits, les identifiants uniques, les noms et les catégories au démarrage. | Ne pas démarrer avec un catalogue structurellement incohérent. Les contrôles de calcul vérifient ensuite les propriétés réellement utilisées. |
| `exactSourceUrl(product)` | Accepte seulement une URL HTTPS du catalogue sur les domaines autorisés, sans identifiants de connexion dans l’URL ni port non prévu. | Empêcher l’appelant de transformer la fiche produit en outil d’accès à une adresse arbitraire. |
| `extractVerifiedPackPrice(html, product)` | Analyse les données structurées JSON-LD ; exige une identité produit, une offre, des euros et une unité par conditionnement non ambiguës. | Éviter de confondre un prix au m² avec un prix de carton ou de lot. |
| `refreshProduct(product, options)` | Tente la lecture bornée de la source ; conserve la fiche datée et indique séparément le résultat de la vérification. | Une page indisponible ne doit pas produire un prix inventé ni effacer le relevé. |
| `createToolServer(options)` | Charge les données, prépare le stockage PDF, crée les routes et traduit les exceptions en erreurs HTTP contrôlées. | Regrouper les responsabilités réseau ; permettre l’injection de données et de réponses simulées dans les tests. |

Extrait reformatté du contrôle des champs, avec des accolades ajoutées pour la lecture :

```js
const extra = Object.keys(input).filter(key => !allowed.includes(key));
if (extra.length) {
  fail(422, 'unknown_fields', `Champs non acceptés : ${extra.join(', ')}.`);
}
```

`Object.keys` récupère les noms reçus. `filter` garde ceux qui ne figurent pas dans la liste autorisée. `fail` interrompt cet appel avec une erreur connue. Ce contrôle refuse par exemple un champ `url` ajouté à `/tools/product` : la source est choisie dans le catalogue.

## 7. La lecture d’un fournisseur : un contrôle prudent du prix

Le rafraîchissement est facultatif. Il accepte seulement les URLs exactes des produits du catalogue sur `leroymerlin.fr`, `www.leroymerlin.fr`, `www.entrepot-du-bricolage.fr` ou `www.bricorama.fr`.

Le mécanisme applique ces contrôles dans l’ordre :

1. Vérifier l’URL autorisée et utiliser HTTPS.
2. Envoyer une requête GET, **sans suivre de redirection**, avec un délai maximal de **8 secondes**.
3. Exiger une réponse HTTP réussie et de type HTML ou XHTML.
4. Limiter la page à **2 Mio**, y compris si le serveur n’annonce pas sa taille.
5. Analyser les scripts JSON-LD. Une page mal formée ne devient pas une supposition de prix.
6. Identifier un seul produit correspondant à l’URL ou à la référence fournisseur connue, puis une seule offre.
7. Exiger un prix valide en euros, au centime, entre 0 et 1 000 000, avec une quantité de référence de **1 pack/paquet/carton/lot**.

L’HTML brut n’est pas transmis au modèle comme une instruction. Cette lecture structurée reste volontairement restrictive : beaucoup de pages peuvent ne pas fournir toutes les preuves attendues.

| État dans `refresh.status` | Signification |
| --- | --- |
| `not_requested` | Aucune consultation en ligne demandée. |
| `live_verified` | Le code a reconnu un prix par conditionnement satisfaisant ses contrôles. |
| `timeout`, `fetch_failed`, `http_error` | Délai, problème réseau ou réponse HTTP non réussie. |
| `source_not_allowlisted`, `redirect_rejected` | Source ou redirection refusée par les protections. |
| `unsupported_content_type`, `page_too_large`, `empty_page` | Contenu inutilisable par ce lecteur. |
| `unverified_product_identity`, `ambiguous_offer` | Produit ou offre non identifié sans ambiguïté. |
| `unverified_price`, `unverified_price_unit` | Prix, devise ou unité insuffisamment explicites. |

Ces valeurs sont celles prévues par le code ; selon l’erreur réseau, une redirection refusée directement par `fetch` peut aussi aboutir à `fetch_failed`.

Même avec `live_verified`, **le calcul continue d’utiliser le catalogue daté**. L’API renvoie le prix observé dans `live_price`, séparément. Elle ne modifie ni le catalogue en mémoire ni le total de façon cachée. Le stock du magasin, la livraison et le prix final en caisse ne sont pas vérifiés.

> « J’ai choisi une base de prix stable pour rendre la démonstration reproductible. Si je consulte une fiche en ligne, je conserve sa provenance et son état. Je n’assimile jamais un échec de vérification à un prix en direct. »

## 8. Le PDF est un résultat de l’API

Dans [reports.mjs](../reports.mjs), `createReportStore` fournit deux opérations : `create` pour créer un instantané et `read` pour retrouver son PDF.

Après `estimate(...)`, le serveur appelle `reports.create({ input, estimate: result, catalog })`. Le rendu réutilise le résultat calculé, sans nouvel appel au modèle.

| `report.status` | Quand il est retourné | Ce que l’agent doit faire |
| --- | --- | --- |
| `ready` | Un calcul `ok` ou `partial` contient des matériaux, et le fichier a été créé. | Afficher l’URL exacte, avec `filename` et `created_at` disponibles. |
| `not_available` | Aucun résultat calculable avec lignes de matériaux, par exemple une dimension manquante. | Demander l’information ; ne pas afficher de lien. |
| `unavailable` | Le calcul existe mais le dossier, le rendu ou l’écriture n’a pas permis de produire le rapport. | Conserver l’estimation et indiquer que le PDF n’est pas disponible. |

Le serveur génère un identifiant aléatoire de **128 bits**. Ni l’utilisateur ni le modèle ne choisissent un nom de fichier ou un chemin. Il sauvegarde un instantané JSON des entrées, du résultat et du catalogue, puis écrit le PDF temporairement avant de le renommer. Cette écriture empêche de publier un PDF partiellement écrit. Le JSON d’audit n’est pas téléchargeable par cette route.

Le rendu est limité à **deux opérations simultanées**, **8 secondes d’attente** et **5 Mio** par PDF. Un rendu qui dépasse le délai garde son créneau jusqu’à sa fin effective. Le délai n’est pas une isolation du processeur : un traitement synchrone qui bloquerait Node ne serait pas interrompu par ce minuteur. Les écritures disque ne sont pas incluses dans la limite des deux rendus.

Le téléchargement reçoit `Content-Type: application/pdf`, un nom de pièce jointe et les en-têtes `no-store`, `nosniff` et `no-referrer`. Les rapports sont persistés dans le dossier local monté sous `/reports` ; ils ne sont pas versionnés dans Git.

Chaque nouveau calcul peut produire un nouveau PDF. Il n’existe pas encore de déduplication des rapports, de purge automatique, de quota global de stockage ou d’authentification propre au lien. L’identifiant difficile à deviner ne remplace pas un contrôle d’accès. Le lien `localhost` est destiné au navigateur du poste de démonstration.

## 9. Délais, reprises et réponse aux incidents

Les mécanismes se trouvent dans [build-workflow.mjs](../build-workflow.mjs) et [incident-response.js](../incident-response.js).

| Couche | Configuration actuelle | Ce que cela signifie |
| --- | --- | --- |
| Fiche fournisseur | 8 secondes ; 2 Mio. | Échec visible puis fiche datée conservée. |
| Outil HTTP n8n | 15 secondes. | L’appel à l’API métier est borné. |
| Modèle OpenAI | 60 secondes ; `maxRetries: 0`. | Pas de reprise automatique configurée dans le client du modèle. |
| Agent | 8 itérations au maximum par tentative ; `maxTries: 2`, attente de 1 seconde. | Le nœud peut être relancé une fois. Une tentative peut inclure plusieurs appels au modèle et aux outils. |
| Workflow | 300 secondes. | Durée maximale configurée pour l’exécution. |

La reprise du nœud Agent est **non sélective** : elle peut aussi retenter une erreur d’authentification ou de quota. Ce n’est pas encore une politique de production avec reprise seulement sur les erreurs transitoires et attente progressive. Une reprise peut recréer un rapport et consommer davantage d’appels ; il n’y a aucune commande fournisseur ou opération de paiement à répéter.

Si l’agent échoue finalement et que sa sortie d’erreur est atteinte, **Expliquer l’incident** construit une réponse avec du code, sans solliciter à nouveau le modèle. Il lit au maximum 4 096 caractères du diagnostic pour classer l’erreur et n’affiche pas ce diagnostic brut.

| Code final | Interprétation | `retryable` |
| --- | --- | --- |
| `AUTHENTICATION` | Connexion ou clé à vérifier. | `false` |
| `QUOTA_EXCEEDED` | Quota ou compte à vérifier. | `false` |
| `RATE_LIMITED` | Trop de demandes temporaires. | `true` |
| `TIMEOUT` | Service trop lent. | `true` |
| `INVALID_RESPONSE` | Réponse inexploitable, par exemple erreur d’analyse JSON. | `true` |
| `SERVICE_UNAVAILABLE` | Autre indisponibilité. | `true` |

`retryable` informe sur la conduite à tenir après l’incident ; il ne reconfigure pas la reprise n8n qui a déjà eu lieu. La sortie contient `status: "technical_error"`, une référence dérivée de l’identifiant d’exécution et un message indiquant qu’aucun achat n’a été effectué.

Une erreur métier sous HTTP 200, comme `needs_information`, ne doit pas être confondue avec cette panne technique. De même, une exécution n8n peut être marquée réussie parce que la branche d’erreur a répondu correctement. Une future surveillance doit donc regarder aussi le statut métier, pas seulement la couleur verte de l’exécution.

Ces protections ne garantissent pas une réponse de secours si n8n s’arrête ou si l’exécution entière est interrompue. Le contrôle `/health` prouve uniquement que le service métier répond ; il ne prouve pas la disponibilité ni le quota d’OpenAI.

## 10. Ce qui est local et ce qu’il faudrait ajouter en production

Le chat et les outils n’ont pas d’authentification applicative dans cette démonstration. Les ports sont publiés sur l’interface locale du Mac ; les échanges internes utilisent HTTP. La clé OpenAI reste dans une connexion n8n, pas dans le code du calculateur. `store: false` est configuré pour Responses API ; cette option ne constitue pas, à elle seule, une garantie d’absence totale de conservation chez le fournisseur.

Avant un accès client sur Internet, les sujets à traiter seraient l’authentification du chat et des services, les droits d’accès aux PDF, l’isolation des sessions, TLS, les limites de débit et de dépenses, la conservation des exécutions et des rapports, les alertes et les sauvegardes testées. Le prototype n’applique pas de limitation de débit ni de politique de purge et ne prétend pas assurer une haute disponibilité.

> « Pour cet entretien, je démontre un agent fonctionnel avec un périmètre métier explicite, des calculs testables et une gestion d’incidents. La mise en production serait une étape à part, avec les accès, la supervision, la maîtrise des coûts et la conservation des données. »

## 11. Réponses courtes à retenir

**Pourquoi avoir écrit une API alors que n8n possède des nœuds Code ?**

> « Pour centraliser le métier, tester les formules indépendamment du workflow et réutiliser le même calcul depuis d’autres interfaces. n8n orchestre ; l’API contrôle et calcule. »

**Le modèle peut-il envoyer n’importe quoi ?**

> « Il peut se tromper dans un argument, donc je ne considère pas son JSON comme fiable par défaut. Le serveur contrôle les champs, les types, les dimensions, les références et le périmètre métier. »

**Une réponse HTTP 200 suffit-elle ?**

> « Non. Je lis aussi le statut métier. Il peut manquer une dimension, ou seul le sol peut être calculable. Un `total_eur` nul n’est pas égal à zéro euro. »

**Est-ce connecté à tout Leroy Merlin ?**

> « Le prototype consulte une sélection datée de produits sourcés. Il peut tenter une vérification de certaines fiches autorisées, mais ne prétend pas connaître tout le catalogue ni les stocks locaux. »

**Comment gérez-vous une panne ?**

> « Je distingue une donnée à corriger, une fiche fournisseur indisponible et une panne technique. Chaque cas a une réponse adaptée. Une panne finale de l’agent reçoit un message préparé par du code, sans rappeler le modèle indisponible. »

Pour les formules, les contrôles et les exemples chiffrés, lire [Règles métier et fonctions de calcul](REGLES-ET-CALCULS.md). Pour les preuves de tests et la configuration d’exploitation, voir [Exploitation et incidents](EXPLOITATION.md) et [Validation des incidents](INCIDENTS-VALIDATION.md). Pour présenter les autres briques, revenir à [Présenter la configuration des 9 briques](PRESENTER-CONFIGURATION.md).
