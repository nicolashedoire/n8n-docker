# Présenter et expliquer la configuration de l’Agent achats chantier

Préparation du **5 octobre 2026** pour l’entretien IALTER du **mardi 6 octobre 2026**. Ce guide décrit le code actuellement présent dans le dépôt, y compris le PDF. Les paramètres ont aussi été vérifiés dans l’éditeur n8n le 5 octobre ; les captures ci-dessous proviennent du workflow réel. Les noms des nœuds sont ceux du workflow ; les noms de paramètres entre accents graves sont ceux de son export. L’emplacement exact d’un libellé dans l’éditeur peut varier avec la version de n8n.

**La phrase à retenir : « Le modèle comprend et organise ; les outils apportent les données et effectuent les calculs. »**

L’objectif n’est pas de réciter tous les champs. Il faut montrer que tu sais ce qui entre dans chaque brique, ce qui en sort, pourquoi elle existe et ce qui se passe lorsqu’elle échoue.

## Ton introduction, prête à dire

> « J’ai préparé un agent d’aide à l’achat de matériaux pour un chantier. L’utilisateur commence avec une phrase très courte : “Je refais ma salle de bains de 4 m sur 3 m.” L’agent propose une première liste, précise ses hypothèses et produit une étude PDF.
>
> Il fonctionne dans n8n avec un modèle, une mémoire de session et quatre outils. Les règles, le catalogue et les calculs sont dans une API dédiée. Le modèle choisit les appels utiles et explique les résultats ; il ne réalise pas lui-même les métrés ou les totaux.
>
> C’est un prototype fonctionnel validé en local. Son périmètre est volontairement explicite : matériaux principaux, références sourcées et datées, aucune commande automatique. »

Concernant la réalisation, sois précis sur ta contribution réelle. Une formulation honnête est : « J’ai travaillé sur ce prototype avec une assistance IA. Je vais vous montrer les choix que je comprends, les vérifications réalisées et ce que je saurais faire évoluer. » Si une partie a été produite avec assistance et que tu ne sais pas encore la modifier seul, dis-le. La préparation sert à acquérir cette compréhension, pas à attribuer une expérience que tu n’as pas.

## Les trois questions auxquelles répondre

### Pourquoi confier les calculs au code ?

**Réponse courte à dire :**

> « Pour rendre les quantités reproductibles et vérifiables. Le modèle interprète la demande, mais les surfaces, les arrondis de conditionnement et les euros sont calculés par des fonctions testées. »

Un modèle peut comprendre « quatre mètres sur trois », puis proposer d’appeler le calculateur. Le programme vérifie qu’il reçoit bien des nombres en mètres, calcule les surfaces, applique les hypothèses autorisées et arrondit au conditionnement supérieur. Avec les mêmes paramètres, le même catalogue et les mêmes règles, il retourne les mêmes quantités et prix. Le PDF peut avoir une autre date et une autre référence : son contenu chiffré reste issu du même calcul.

Exemple à montrer :

```text
Sol :                    4 × 3 = 12 m²
Avec 10 % de marge :     12 × 1,10 = 13,20 m²
Couverture d’un carton : 1,08 m²
Cartons à acheter :      arrondi supérieur de 13,20 / 1,08 = 13
Prix relevé par carton : 11,77 €
Sous-total :             13 × 11,77 = 153,01 €
```

Le code travaille en centimes pour multiplier et additionner les prix. Il distingue un prix absent de zéro euro. Les rails et montants sont comptés par pan ; ils ne sont pas déduits d’une simple surface. Les tests vérifient ces comportements.

**Nuance importante :** le calculateur ne prouve pas que le modèle a bien compris toute la demande. Une mauvaise interprétation peut fournir de mauvais paramètres. C’est pourquoi on affiche les dimensions et hypothèses, conserve les traces d’appels et demande une confirmation avant achat. Il faut tester à la fois le calculateur et la conversation complète.

### Pourquoi un catalogue daté plutôt que promettre des prix en direct ?

**Réponse courte à dire :**

> « Cela me donne une base vérifiable et reproductible, avec l’unité de vente, la source et la date de chaque prix. Une fiche Web peut changer, être bloquée ou afficher un prix au mètre carré alors que l’achat se fait au carton. Je préfère annoncer clairement un relevé daté. »

Le catalogue contient actuellement **onze références**, relevées au **4 octobre 2026**, provenant de plusieurs fournisseurs. Une recherche parcourt cette sélection ; elle ne parcourt pas tout Leroy Merlin ou tout Internet. Elle n’utilise ni base vectorielle ni embeddings : c’est une recherche lexicale dans les noms, catégories, identifiants et tags.

La fiche produit peut tenter une vérification en ligne avec `refresh: true`. Le serveur accepte uniquement les URL exactes inscrites dans le catalogue et contrôle la réponse. Il exige notamment une identité produit et une unité de prix non ambiguës. En cas de blocage ou de doute, il conserve le relevé daté et indique la raison. Même lorsqu’un prix récent est vérifié, il est présenté séparément : le calculateur utilise toujours le catalogue daté.

**Évolution à proposer pour un client :** un connecteur fournisseur autorisé, une fréquence de mise à jour, une gestion de la provenance et des tests de normalisation des unités. Le stock local, la livraison et le prix en caisse seraient des informations distinctes à vérifier.

### Que se passe-t-il lorsqu’une donnée manque ou qu’une API échoue ?

**Réponse courte à dire :**

> « Je distingue un besoin de précision d’une panne technique. Si une information peut être remplacée par une hypothèse prévue, elle est annoncée. Sinon, l’outil demande une précision ou retourne un résultat partiel. Si un service tombe en panne, les délais et les reprises sont bornés, puis une branche indépendante du modèle produit un message explicite. »

| Situation | Comportement actuel |
| --- | --- |
| Longueur ou largeur absente | Le calculateur retourne `needs_information` : les dimensions indispensables sont demandées. |
| Hauteur ou marge absente dans le scénario salle de bains | Le moteur utilise 2,50 m et 10 %, en les identifiant comme hypothèses. |
| Ouvertures inconnues | Aucune déduction. Cela ne signifie pas qu’il n’y a pas de porte ou fenêtre. |
| Hauteur de 2,70 m | Le sol reste chiffrable, les murs dépassent le système retenu : résultat `partial`, total global inconnu. |
| Donnée impossible ou champ inattendu | Refus ou demande de correction, selon le contrat de l’outil. |
| Fiche fournisseur inaccessible | Relevé daté conservé avec un état explicite d’échec d’actualisation. |
| Panne du modèle ou d’un outil empêchant la réponse | Deux tentatives au niveau du nœud Agent, puis sortie d’erreur vers le Code d’incident. |
| Export PDF indisponible | Le calcul reste disponible ; l’outil annonce que le PDF n’a pas été créé. Aucun lien inventé. |

Un HTTP 200 signifie qu’une réponse a été reçue ; il ne signifie pas automatiquement que l’estimation est complète. Il faut lire l’état métier dans le JSON.

## Comprendre le dessin dans n8n avant d’ouvrir les briques

Il y a **neuf nœuds fonctionnels et deux notes**. Les huit nœuds du parcours normal sont le Chat, l’Agent, le Modèle, la Mémoire et les quatre outils. Le neuvième produit la réponse d’incident.

Le lien principal va du Chat à l’Agent. Les connexions de modèle, mémoire et outils sont des ressources de l’Agent : leur disposition de gauche à droite n’impose pas un ordre d’exécution. L’Agent possède aussi une sortie d’erreur reliée au Code.

```text
Message utilisateur → Agent → réponse finale du chat
                       │
                       ├─ Modèle : interpréter et choisir les appels
                       ├─ Mémoire : conserver le contexte de la session
                       ├─ Règles : connaître le périmètre autorisé
                       ├─ Recherche : trouver les références du catalogue
                       ├─ Fiche : vérifier une référence précise
                       └─ Calcul : produire métrés, prix et PDF

Échec de l’Agent après ses tentatives → Code « Expliquer l’incident »
```

Pour le cas salle de bains, les consignes orientent l’Agent vers règles → recherche → fiche H1 → calcul. Lors d’une modification, certains appels peuvent être inutiles et ne seront pas répétés. Un outil peut être appelé plusieurs fois. Une brique grise peut simplement ne pas avoir été nécessaire. La brique d’incident reste grise lorsque la demande réussit.

![Workflow à neuf nœuds, avec la branche d’incident](images/configuration/00-workflow.png)

## Brique 1 — Décrire mon chantier

![Déclencheur du chat : message, session et réponse](images/configuration/01-chat.png)

**Ouvre le nœud, puis ses paramètres.** C’est un Chat Trigger, version de nœud 1.5 dans l’export.

| Configuration actuelle | Explication |
| --- | --- |
| `mode: hostedChat`, `public: true` | n8n fournit l’interface de chat. Le service est limité au poste local dans cette installation ; « public » ne constitue pas une authentification. |
| `authentication: none` | Le chat n’a pas d’authentification propre. Ce point doit évoluer pour un service client. |
| `responseMode: lastNode` | Le chat affiche la réponse du dernier nœud principal exécuté : l’Agent en cas normal, le Code en cas d’incident. |
| `allowFileUploads: false` | La démo accepte du texte, sans fichiers joints. |
| `loadPreviousSession: notSupported` | Aucun chargement d’historique précédent n’est configuré ici. |
| Message d’accueil et exemple 4 × 3 m | Aident l’utilisateur à démarrer sans connaître les paramètres techniques. |

**Entrée/sortie à expliquer :** un message de chat contient notamment `chatInput`, le texte, et `sessionId`, l’identifiant de conversation utilisé par la mémoire.

**Phrase orale :** « Cette brique reçoit la demande. L’utilisateur parle normalement ; il n’a pas à remplir un JSON ou connaître un identifiant de produit. »

**Piège :** l’authentification de l’éditeur n8n et celle du chat sont deux choses différentes. Ne dis pas que le chat est protégé parce que tu t’es connecté à l’éditeur.

## Brique 2 — Agent achats chantier

![Agent : demande utilisateur et consignes système](images/configuration/02-agent-prompt.png)

**Ouvre les paramètres, puis les réglages d’erreur.** C’est le nœud AI Agent, version 3.1.

| Configuration actuelle | Pourquoi elle est présente |
| --- | --- |
| `promptType: auto` | Le texte utilisateur vient du Chat Trigger connecté. |
| `systemMessage` | Contient les consignes de rôle, périmètre, outils, hypothèses, erreurs et présentation du PDF. |
| `maxIterations: 8` | Limite les tours de la boucle de l’Agent. Cela ne veut pas dire huit outils différents, huit appels d’outils exactement ou huit messages conservés. |
| `returnIntermediateSteps: true` | Permet de retrouver les appels et observations intermédiaires pour examiner ce que l’Agent a fait. Ce ne sont pas les pensées privées du modèle. |
| `enableStreaming: false` | Attend une réponse complète au lieu d’afficher le texte progressivement. |
| `hasOutputParser: false` | Aucun parseur de sortie structurée n’est branché à l’Agent. Sa réponse finale est du texte, généralement en Markdown. |
| `retryOnFail: true`, `maxTries: 2` | Deux tentatives au total au niveau du nœud Agent. |
| `waitBetweenTries: 1000` | Une seconde d’attente entre les tentatives. |
| `onError: continueErrorOutput` | Après échec, dirige le traitement vers la sortie d’erreur et le Code dédié. |

Les valeurs d’erreur se trouvent dans les réglages du nœud, généralement l’onglet **Settings**. Les consignes et options de l’Agent se trouvent dans ses paramètres. Ouvre les champs en lecture sans les modifier pendant la présentation.

![Huit itérations, traces intermédiaires et streaming désactivé](images/configuration/03-agent-options.png)

![Deux tentatives puis sortie d’erreur](images/configuration/04-agent-incidents.png)

### Comment expliquer le prompt système

Ne lis pas tout le prompt. Montre trois passages :

1. **La mission :** transformer une demande courte en liste sourcée avec hypothèses visibles.
2. **L’obligation d’utiliser les outils :** règles avant estimation, quantités et totaux provenant du calculateur, aucune donnée ou action inventée.
3. **Le traitement des limites :** conserver les résultats partiels, distinguer hydrofuge et étanchéité, afficher uniquement l’URL de PDF renvoyée par le dernier calcul.

**Phrase orale :** « Le prompt définit le comportement attendu. Les descriptions d’outils indiquent leurs usages et paramètres. Les contraintes importantes sont aussi vérifiées côté API : une consigne au modèle ne remplace pas un contrôle dans le code. »

L’Agent peut faire plusieurs appels au modèle pendant une seule réponse : décider d’un outil, lire son résultat, décider de la suite, puis rédiger. **Deux tentatives de l’Agent ne signifient donc pas deux requêtes OpenAI maximum.** Une reprise peut refaire des appels et créer un nouveau PDF.

La politique de reprise actuelle n’est pas sélective : même une erreur de clé ou de quota est retentée une fois. Une politique ciblée avec attente progressive serait une amélioration de production.

## Brique 3 — Modèle OpenAI

![Modèle : identifiant, Responses API, délai et reprises](images/configuration/05-modele.png)

**Ouvre ses paramètres.** Le nœud est `lmChatOpenAi`, version 1.3.

| Configuration actuelle | Explication |
| --- | --- |
| Modèle `gpt-5.6-terra` | Identifiant configuré dans ce projet. Présente ce choix comme un choix de la démo, sans prétendre qu’il est optimal pour tout client. |
| `responsesApiEnabled: true` | Utilise la Responses API par l’intégration native n8n. |
| `reasoningEffort: low` | Effort configuré pour des décisions bornées et une réponse assez rapide ; la qualité doit rester évaluée sur nos scénarios. |
| `timeout: 60000` | Délai configuré de 60 secondes pour un appel au modèle ; d’autres erreurs réseau peuvent survenir plus tôt. |
| `maxRetries: 0` | Désactive les reprises du client modèle. La reprise est gérée à un seul niveau, celui de l’Agent. |
| `extraBody: {"store":false}` | Transmet `store: false` à l’API. Cela n’est pas une garantie d’absence de toute conservation chez le fournisseur. |
| Connexion OpenAI dédiée | La clé est gérée dans les credentials de n8n, pas dans le prompt ni l’export public du workflow. |

**Phrase orale :** « Le modèle interprète la demande et prépare les appels d’outils. Le nœud Agent gère la boucle. Je pourrais évaluer un autre modèle sans réécrire mes formules métier. »

**Sur les données :** la démo envoie la conversation et les résultats utiles des outils à un service externe. Les traces n8n et les rapports locaux sont également conservés. Ne dis pas que tout reste sur le Mac. Lors du partage d’écran, montre le nom de la connexion, pas son secret.

**Si l’on demande pourquoi ce modèle :** « Il a été validé sur les scénarios de ce prototype. Pour un client, je comparerais précision des appels, latence et coût sur un jeu d’exemples représentatif. » Ne prétends pas avoir effectué un benchmark comparatif s’il n’existe pas.

## Brique 4 — Mémoire de la conversation

![Mémoire : clé de session et fenêtre de contexte](images/configuration/06-memoire.png)

**Ouvre ses paramètres.** C’est une Simple Memory / mémoire à fenêtre, version 1.4.

| Configuration actuelle | Explication |
| --- | --- |
| `sessionIdType: customKey` | La clé de session est fournie par une expression. |
| `sessionKey: ={{ $json.sessionId }}` | Réutilise l’identifiant produit par le chat pour rattacher les échanges à la même conversation. |
| `contextWindowLength: 8` | Conserve une fenêtre limitée de contexte. Ce nombre concerne la mémoire ; il est indépendant des huit itérations de l’Agent. |

**Phrase orale :** « Si je dis ensuite “la hauteur est de 2,70 m”, la mémoire permet de retrouver la salle de bains de 4 × 3 m. Mais l’Agent doit rappeler le calculateur : il ne recycle pas un ancien total. »

Cette mémoire ne constitue ni une base clients, ni une mémoire durable garantie après redémarrage. Une clé de session n’est pas un contrôle d’autorisation entre clients. Pour une application partagée, il faudrait lier les sessions à des utilisateurs authentifiés et définir durée de vie, suppression et stockage.

## Comprendre les quatre outils et `$fromAI`

Les quatre briques suivantes sont des **HTTP Request Tools**, version 4.5. Elles ont la même structure :

| Champ commun | Valeur |
| --- | --- |
| Méthode | `POST` |
| Hôte interne | `http://chantier-api:3000` dans le réseau Docker |
| Description | Écrite à la main pour expliquer à l’Agent quand utiliser l’outil |
| Corps | JSON ; `sendBody: true`, `contentType: json`, `specifyBody: json` |
| Format de réponse | JSON |
| Délai HTTP | `15000` ms, soit 15 secondes |

`chantier-api` est le nom du service Docker. Depuis le navigateur du Mac, le service est accessible sur `localhost:8788`. Ce sont deux points d’accès au même service depuis des environnements différents.

### La fonction `$fromAI`, en langage simple

```javascript
$fromAI("project_type", "Description de la valeur attendue", "string")
```

Les trois arguments indiquent **le nom du paramètre**, **son sens**, puis **son type**. n8n permet à l’Agent de fournir cette valeur lors de l’appel. `string` signifie texte, `boolean` signifie vrai/faux et `json` signifie objet structuré.

Cela n’exécute pas un deuxième assistant caché et ne donne pas au modèle le droit de changer l’adresse du serveur. Dans notre workflow, la méthode et l’URL restent fixes ; seules les valeurs prévues dans le corps sont proposées. L’API les valide ensuite.

`={{ ... }}` est la notation d’une expression n8n. `$json.sessionId` lit une donnée déjà reçue ; `$fromAI(...)` expose un paramètre que le modèle remplit. Il faut bien distinguer ces deux usages.

**À dire :** « Ici, le modèle remplit les arguments de l’outil. Ensuite, le serveur vérifie ces arguments avant de travailler. »

## Brique 5 — Consulter les règles

![Règles : paramètres construits avec $fromAI et réponse JSON](images/configuration/08-regles-json.png)

**À montrer :** la description de l’outil, l’URL `/tools/rules`, puis le corps JSON.

Le corps emploie deux expressions `$fromAI` de type `string`, pour `project_type` et `room_type`. Dans notre première demande, l’appel attendu est :

```json
{
  "project_type": "bathroom",
  "room_type": "wet"
}
```

`bathroom` désigne une pièce salle de bains entière. `wet` indique une pièce humide. D’autres catégories existent, comme `tiling` pour le carrelage seul et `partition` pour une cloison. Il ne faut pas transformer une pièce rectangulaire en une seule cloison.

Le serveur lit les règles documentées, leurs sources, les dimensions indispensables, les hypothèses prévues et les produits recommandés. Ce n’est pas une recherche Web à chaque appel. Le calculateur consulte également ces règles, même si le modèle a déjà utilisé cet outil : les limites ne dépendent donc pas uniquement de la lecture faite par l’Agent.

**Phrase orale :** « Je commence par cadrer le besoin. Cet outil indique les cas autorisés et les limites. Pour la salle de bains, il propose une première estimation à partir de longueur et largeur, sans faire croire que nous connaissons déjà tous les détails. »

**Point métier à connaître :** le scénario retenu est un doublage des quatre murs à une face, finition légère, système M48 doublés à entraxe 600 mm et hauteur maximale 2,50 m. Une finition carrelée des murs ou une hauteur différente réclame un autre système : le prototype n’en invente pas un. L’emploi de plaques H1 ne valide pas l’étanchéité complète.

## Brique 6 — Rechercher les matériaux

![Recherche : texte proposé par le modèle et contrat HTTP](images/configuration/10-recherche-json.png)

**À montrer :** la description, l’URL `/tools/search` et le paramètre `query` construit avec `$fromAI(..., "string")`.

Exemple de corps :

```json
{
  "query": "carrelage plaque hydrofuge Placomarine rail montant Isocoton"
}
```

Le serveur enlève les différences d’accents et de casse, découpe la recherche en mots, compte les correspondances dans les références, puis classe les résultats. Il retourne au maximum dix produits, leurs identifiants exacts, dimensions, conditionnements, prix, fournisseurs et liens. Le champ `total_matches` peut indiquer davantage de correspondances que le nombre affiché.

**Phrase orale :** « L’Agent cherche ici des références dans une sélection connue. Le résultat contient les informations nécessaires aux calculs, notamment la surface couverte par un carton ou un lot. »

**Piège :** ne parle pas de navigation générale sur le Web, de recherche sémantique ou de RAG vectoriel. La recherche actuelle est lexicale et le catalogue est petit. C’est une limite assumée, qui permet une démonstration vérifiable.

## Brique 7 — Consulter une fiche fournisseur

![Fiche : identifiant de produit et option refresh](images/configuration/12-fiche-json.png)

**À montrer :** la description, l’URL `/tools/product`, puis `product_id` de type texte et `refresh` de type booléen.

Exemple pour notre plaque :

```json
{
  "product_id": "board_placomarine_h1_2500x600",
  "refresh": false
}
```

L’identifiant vient du catalogue. Il ne s’agit pas d’une URL libre inventée par le modèle. Avec `refresh: false`, l’outil fournit le relevé daté. Cela permet de vérifier la classe H1, les dimensions 2,50 × 0,60 m et les caractéristiques enregistrées.

Avec `refresh: true`, le serveur tente une lecture de la source autorisée pendant huit secondes maximum. Il refuse les redirections, limite la page à 2 Mio et examine les données structurées JSON-LD. Un prix n’est accepté comme récent que si le produit et le prix par conditionnement sont non ambigus. Un prix simplement affiché dans le HTML ne suffit pas.

**Phrase orale :** « Cette brique approfondit une référence précise. Elle sépare ce qui provient du relevé connu de ce qui a éventuellement pu être vérifié en ligne. »

**Piège :** `status: ok` peut accompagner `refresh.status: http_error` : la fiche datée est bien disponible, même si sa vérification en ligne a échoué. Le prix du calcul reste celui du relevé. Aucune disponibilité locale ou livraison n’est vérifiée.

## Brique 8 — Calculer les quantités

![Calculateur : objet JSON et dimensions réellement transmises](images/configuration/14-calcul-json.png)

**À montrer :** la description détaillée, l’URL `/tools/estimate`, puis le corps :

```javascript
={{ $fromAI("calculation", "Objet JSON du calcul…", "json") }}
```

Le modèle fournit un objet conforme au contrat. Pour démarrer, les seuls paramètres nécessaires sont :

```json
{
  "project_type": "bathroom",
  "length_m": 4,
  "width_m": 3
}
```

Il peut aussi transmettre les identifiants de matériaux sélectionnés. En revanche, il doit laisser absentes les valeurs non fournies ou confirmées : hauteur, marge, ouvertures, budget. Le moteur applique lui-même les hypothèses autorisées et les étiquette.

### Ce qui se passe dans le code

1. `estimate()` reconnaît le type de projet et appelle le calcul salle de bains.
2. Le programme refuse les champs inattendus et les valeurs invalides. Longueur et largeur doivent être des nombres compris entre 0,10 et 100 m.
3. Il consulte la règle, complète les paramètres absents et conserve leur origine dans `assumption_origins`.
4. Il calcule le sol et les quatre pans `[longueur, largeur, longueur, largeur]`.
5. Il appelle séparément les calculs du sol et des doublages, puis assemble les lignes.
6. Si un lot sort du périmètre, il retourne `partial` avec les lignes calculées et les lots non chiffrés. Le total global devient `null` : inconnu, pas zéro.
7. Le serveur transmet ce résultat au générateur PDF et ajoute le champ `report`.

Les origines `provided`, `default` et `derived` signifient respectivement « reçu par le calculateur », « hypothèse du moteur » et « calculé ». **`provided` ne prouve pas que l’utilisateur a dit ou validé cette valeur** : elle peut avoir été transmise par l’Agent, par exemple une référence produit sélectionnée.

### Les quantités du cas 4 × 3 m

Avec la hauteur supposée 2,50 m et les autres hypothèses du catalogue :

| Ligne | Achat calculé | Sous-total du relevé |
| --- | ---: | ---: |
| Carrelage de sol | 13 cartons | 153,01 € |
| Placomarine H1 | 26 plaques | 386,10 € |
| Rails | 14 pièces | 113,40 € |
| Montants | 62 pièces | 341,00 € |
| Isocoton | 5 lots de 13 panneaux | 322,90 € |
| **Matériaux sélectionnés** | | **1 316,41 €** |

Ces nombres sont des repères pour contrôler la démo, pas une promesse de budget total de rénovation. Le rail possède un prix conseillé à confirmer. Les surfaces brutes ne déduisent aucune ouverture ni aucun receveur non mesuré.

Si l’intervieweur demande un exemple plus technique : les plaques sont calculées avec le maximum entre le besoin de surface et un minimum par largeur de pan ; les rails sont comptés en haut et en bas de chaque pan, arrondis à leur longueur de vente ; les montants suivent l’entraxe et le multiplicateur du système ; l’isolant couvre une seule cavité. Le plan de découpe optimal et les performances de l’ouvrage ne sont pas garantis.

### Pourquoi le PDF ne nécessite pas une dixième brique

Il est produit dans l’API après le calcul. PDFKit reçoit les données structurées du moteur ; il ne rappelle pas le modèle, ne visite pas les fournisseurs et ne recalcule pas les prix.

Si l’export réussit, la sortie contient :

```json
{
  "report": {
    "status": "ready",
    "url": "http://localhost:8788/reports/<identifiant-serveur>.pdf",
    "filename": "etude-materiaux-<identifiant-serveur>.pdf",
    "created_at": "<date de création>"
  }
}
```

Cet extrait illustre la structure ; l’URL réellement cliquable est celle retournée dans l’exécution. Le prompt demande de recopier cette URL exacte. Une nouvelle estimation produit une nouvelle référence. Les anciens PDF restent des instantanés ; ils ne sont pas modifiés silencieusement.

Le PDF et un instantané JSON sont sauvegardés localement. Seul le PDF est servi en téléchargement. Une panne du rendu donne `report.status: unavailable` sans annuler un calcul déjà réussi. Le lien `localhost` sert sur le Mac de la démo : pour partager le résultat, on transmet le fichier téléchargé.

**Phrase orale :** « Cette brique produit le résultat de référence. La réponse du chat et le document s’appuient sur les mêmes données. Si le PDF échoue, je conserve les chiffres et annonce le problème d’export. »

![La réponse du chat contient le lien vers le PDF de l’étude](images/salle-de-bains/05-etude-pdf-chat.png)

## Brique 9 — Expliquer l’incident

![Code d’incident : classement et messages contrôlés](images/configuration/15-incidents-code.png)

**À montrer :** le lien depuis la deuxième sortie de l’Agent et le Code, en mode `runOnceForAllItems`. Ce code ne se lance que si cette sortie est utilisée.

Le code se comprend en quatre étapes :

1. `$input.first()?.json` lit le premier résultat d’erreur reçu. Il accepte une erreur sous forme de texte ou d’objet.
2. Il extrait au maximum 4 096 caractères pour classer le diagnostic : authentification, quota, débit, délai, réponse invalide ou indisponibilité générale.
3. Il choisit un message prédéfini. Il ne réaffiche pas le diagnostic brut : une clé, une adresse interne ou une pile d’appels ne doivent pas apparaître dans le chat.
4. Il crée une référence à partir de `$execution.id`, puis retourne un item n8n contenant `output`, `status`, `incident` et `no_order_placed`.

Le format de retour ressemble à :

```javascript
return [{ json: {
  output: "Message contrôlé pour l’utilisateur…",
  status: "technical_error",
  incident: {
    code: "TIMEOUT",
    retryable: true,
    reference: "chantier-<exécution>"
  },
  no_order_placed: true
} }];
```

`output` est la réponse que le chat peut afficher. `status` et `incident` donnent des informations à l’exploitation. `retryable` conseille une action après l’échec ; ce champ ne pilote pas les deux tentatives déjà configurées dans l’Agent.

**Phrase orale :** « Si le service qui rédige les réponses est indisponible, je ne peux pas lui demander d’expliquer sa propre panne. Cette branche produit donc un texte contrôlé sans appel supplémentaire au modèle. »

Le classement repose sur les informations effectivement reçues de n8n. Une erreur inconnue reste une indisponibilité générique. La branche peut terminer l’exécution avec un statut n8n de succès parce qu’un message a été produit, alors que le résultat métier reste `technical_error`. Une surveillance doit regarder les deux.

## Les réglages globaux à connaître

Le workflow utilise `executionTimeout: 300`, soit cinq minutes au maximum, et le fuseau `Europe/Paris`. Les exécutions manuelles et les données des exécutions réussies ou échouées sont sauvegardées. Cela permet d’examiner les paramètres et résultats, mais implique une politique de conservation avant un usage client.

| Couche | Délai configuré | Reprise actuelle |
| --- | ---: | --- |
| Lecture d’une fiche fournisseur | 8 s | Pas de boucle automatique ; repli explicite sur le relevé daté |
| Appel d’un outil HTTP par n8n | 15 s | Pas de politique supplémentaire propre à chaque outil |
| Appel au modèle | 60 s | Reprises du client modèle désactivées |
| Nœud Agent | Dans la limite du workflow | Deux tentatives au total, espacées d’une seconde |
| Exécution complète | 300 s | Aucune file durable de reprise |
| Rendu PDF | 8 s | Export indisponible si échec ; calcul conservé |

La limite de durée d’un appel n’est pas une garantie de réponse de secours si n8n lui-même est arrêté. Le PDF est limité à 5 Mio avec au maximum deux rendus simultanés. Ces bornes ne remplacent pas un quota global de stockage ni une purge automatique.

## Ton déroulé de démonstration en 15 minutes

| Temps | Manipulation à l’écran | Ce que tu expliques |
| --- | --- | --- |
| 0:00–1:00 | Montrer le canvas complet | Problème métier, résultat attendu et prototype local. |
| 1:00–2:30 | Ouvrir le chat et saisir la demande 4 × 3 m | Une demande minimale, des hypothèses visibles, des outils appelés selon le besoin. Pendant l’attente, présenter l’architecture générale. |
| 2:30–4:00 | Montrer réponse et PDF | Dimensions, total des seuls matériaux sélectionnés, prix datés et exclusions. |
| 4:00–6:00 | Ouvrir l’Agent puis le Modèle | Prompt système, huit itérations, traces, modèle, délai et politique de reprise. |
| 6:00–9:00 | Ouvrir les quatre outils | Même mécanisme HTTP, descriptions et `$fromAI` ; insister sur règles et calculateur. Pour recherche et fiche, montrer surtout la différence de rôle. |
| 9:00–10:30 | Ouvrir une exécution et la sortie du calculateur | Paramètres réels, état métier, hypothèses, lignes et URL du PDF. |
| 10:30–12:00 | Ouvrir Mémoire puis envoyer « En fait, la hauteur est de 2,70 m. » | Contexte conservé, nouveau calcul obligatoire, sol conservé et murs non chiffrés. |
| 12:00–13:30 | Ouvrir Expliquer l’incident et les réglages Agent | Erreurs traitées sans modèle ; deux tentatives non sélectives ; preuve des tests isolés. |
| 13:30–15:00 | Revenir au canvas | Validation, limites et étapes de déploiement client. Laisser la place à une question. |

N’essaie pas de lire tout le code en quinze minutes. Garde ce guide ouvert pour les questions techniques et montre le fichier ou le champ demandé. Les trois passages importants du prompt et le JSON d’un calcul valent mieux qu’une lecture complète de toutes les options.

La première estimation peut prendre une quinzaine de secondes ou davantage selon le fournisseur. Attends sa fin avant d’envoyer le deuxième message. Pour que la modification utilise le contexte, reste dans la même conversation.

## Questions de relance probables

**« Pourquoi est-ce un agent, alors que vous avez écrit son parcours ? »**

« Les consignes orientent un cas connu, mais le système n’exécute pas simplement quatre nœuds en chaîne. Le modèle propose les appels, observe leurs résultats et adapte la suite. C’est une autonomie bornée, pas un agent autorisé à agir partout. »

**« Avez-vous supprimé les hallucinations ? »**

« Non. J’ai réduit leur impact en sortant les chiffres et les règles du texte généré, en contrôlant les paramètres et en conservant les preuves. La restitution et l’interprétation restent à évaluer. »

**« Pourquoi deux tentatives, et pas davantage ? »**

« Pour récupérer certaines pannes transitoires sans provoquer une longue boucle ni cumuler des reprises dans plusieurs couches. Cette version réessaie aussi les erreurs de clé et de quota ; je rendrais cette politique sélective en production. »

**« Que prouvent vos tests ? »**

« La validation documentée du 4 octobre compte 62 tests de code avec l’export PDF, huit scénarios d’incident dans une instance n8n isolée, et des conversations réelles sur le scénario de démo. Les pannes simulées vérifient le comportement ; elles ne garantissent pas la disponibilité du fournisseur demain. »

**« Est-ce sécurisé pour plusieurs clients ? »**

« Cette version est locale. Les credentials sont séparés du workflow public, les URL fournisseurs sont bornées et les entrées sont validées. Pour plusieurs clients, il reste à ajouter authentification, autorisations sur les sessions et documents, quotas, rétention, supervision et sauvegardes vérifiées. »

**« Pourquoi un PDF généré en code ? »**

« Pour réutiliser exactement le résultat chiffré de l’outil, sans une deuxième rédaction libre ou un nouveau calcul par le modèle. Le document conserve aussi les hypothèses et les sources. »

**« Pouvez-vous acheter automatiquement ? »**

« Aucun outil du projet ne commande ou ne paie. Pour ajouter cette fonction, je séparerais préparation et engagement, avec validation humaine, contrôle d’autorisation et protection contre les doublons lors des reprises. »

**« Quelle amélioration prioritaire pour un client ? »**

« Je commencerais par préciser le périmètre utile et les critères d’acceptation, puis sécuriserais l’accès, la traçabilité et les sources de prix. J’évaluerais les conversations sur des cas client avant d’étendre le catalogue ou l’autonomie. »

## Ce qu’il faut éviter de revendiquer

| À éviter | Formulation exacte |
| --- | --- |
| « Il recherche tous les produits Leroy Merlin. » | « Il recherche dans onze références sélectionnées et sourcées. » |
| « Les prix sont en direct. » | « Le calcul utilise le relevé du 4 octobre ; une vérification en ligne séparée est possible. » |
| « Tout reste local. » | « Le calcul et le PDF sont locaux ; le modèle est appelé chez un fournisseur externe. » |
| « `store: false` garantit qu’aucune donnée n’est conservée. » | « Cette option est envoyée à l’API ; les politiques du fournisseur et les traces locales restent à traiter. » |
| « Huit itérations, donc huit appels maximum. » | « Huit tours de boucle Agent ; ce n’est pas un compteur d’appels total pour toute la conversation. » |
| « Les erreurs 401 ne sont jamais réessayées. » | « Notre reprise actuelle est non sélective, puis le message demande de vérifier le compte. » |
| « La mémoire garantit l’isolation des clients. » | « Elle rattache le contexte à une session ; l’authentification et les autorisations restent à ajouter. » |
| « La réponse Agent est validée par un parseur JSON. » | « Les outils échangent du JSON ; la réponse finale de l’Agent est du texte sans parseur structuré branché. » |
| « Ce montant est le devis complet de la salle de bains. » | « C’est un budget partiel des matériaux sélectionnés, avec exclusions. » |
| « L’ouvrage est conforme parce que la plaque est H1. » | « H1 est une caractéristique du parement ; le système complet reste à vérifier. » |
| « Le PDF est une nouvelle réponse rédigée par l’IA. » | « Le PDF est rendu en code à partir du résultat du calculateur. » |
| « C’est prêt pour la production. » | « Le prototype est validé localement ; les exigences d’exploitation client restent à mettre en place. » |

## Préparation pratique avant l’entretien

- Ouvrir l’éditeur n8n et la bonne version publiée du workflow, puis ajuster le canvas pour voir les neuf briques.
- Vérifier le fonctionnement de Docker, du service d’outils et du compte modèle ; faire une répétition complète du scénario avant l’appel.
- Préparer une conversation neuve pour le premier message. Ne pas importer d’anciennes hypothèses d’une session précédente.
- Garder une exécution réussie, le PDF déjà téléchargé et le rapport des incidents accessibles pour un éventuel problème réseau.
- Fermer les onglets contenant des informations personnelles. Ne pas ouvrir la valeur d’un credential pendant le partage d’écran.
- Garder les deux messages exacts à copier : « Je refais ma salle de bains de 4 m sur 3 m. » puis « En fait, la hauteur est de 2,70 m. »
- Ne pas provoquer une panne sur l’instance principale en supprimant une clé ou en arrêtant Docker. Présenter les essais isolés documentés.
- Répéter l’explication de `$fromAI`, d’un arrondi au carton et de la différence entre `partial` et `technical_error`.

## Où retrouver les détails techniques

- [Générateur du workflow : nœuds, paramètres et connexions](../build-workflow.mjs)
- [Prompt complet de l’Agent](../agent-prompt.txt)
- [API : contrats, recherche, contrôle des fiches et routes PDF](../server.mjs)
- [Calculs, validations et hypothèses](../quantities.mjs)
- [Catalogue daté](../catalog.json) et [règles sourcées](../rules.json)
- [Code de la réponse d’incident](../incident-response.js)
- [Stockage et publication des rapports](../reports.mjs), [rendu PDF](../pdf-report.mjs)
- [Rapport des huit scénarios d’incident](INCIDENTS-VALIDATION.md)
- [Exploitation, sécurité et validations datées](EXPLOITATION.md)
- [Explication du code salle de bains](CODE-SALLE-DE-BAINS.md) et [guide PDF](GUIDE-PDF.md)
