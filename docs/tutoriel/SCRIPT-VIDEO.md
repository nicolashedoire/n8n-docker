# Script intégral de la vidéo commentée

Durée mesurée : **35 min 05 s**. 50 scènes, 16 chapitres. Voix française de synthèse **Higgsfield · Cillian** ; captures réelles et extraits de code agrandis. Les sous-titres sont calés proportionnellement à la durée mesurée de chaque narration, sans alignement mot à mot.

## Trois ouvertures possibles

1. **Retenue :** « Une demande arrive avec un besoin, un budget et une date. Comment préparer une réponse utile, sans inventer les informations qui manquent ? »
2. « Votre modèle produit un JSON valide. Comment savoir si les faits qu’il contient viennent réellement du message ? Suivons une demande dans n8n pour le vérifier. »
3. « Que se passe-t-il si la même demande arrive deux fois, ou si le modèle ne répond plus ? Ce workflow rend ces issues visibles, et nous allons lire le code qui le permet. »

## Présentation et rythme

La présentation reprend les éléments visuels observés sur L’Atelier n8n : fond bleu nuit, accent corail, grands titres, captures de n8n et invitation à mettre en pause. La narration est nouvelle et n’imite pas la voix de la chaîne.

Référence consultée : [Créer un formulaire de contact](https://www.youtube.com/watch?v=_tk1EC0hnTY). Aucun extrait audiovisuel de cette vidéo n’est réutilisé.

## Repères pédagogiques et attention

- 00:00:00 : le résultat arrive avant l’architecture ; la question posée reçoit une réponse concrète.
- 00:03:17 : alternance entre configuration réelle et code agrandi, avec des pauses de 2 secondes entre scènes.
- 00:07:18 : le doublon donne une conséquence concrète à la réservation.
- 00:10:12 : la distinction structure/provenance/pertinence évite de résumer la sécurité à un schéma JSON.
- 00:14:05 : les gabarits répondent au défaut réellement observé dans le premier brouillon.
- 00:15:59 : les erreurs interrompent le parcours nominal et montrent pourquoi les branches existent.
- 00:25:06 : le service est expliqué après les nœuds qui l’appellent ; les détails ont un contexte.
- 00:32:55 : exercices et présentation de quinze minutes transforment la lecture en pratique.

## Chapitres

```text
00:00:00 Le projet et son résultat
00:03:17 Les entrées
00:07:18 Réserver une demande
00:09:09 L’extraction IA
00:10:12 Valider les faits
00:12:10 Les règles métier
00:14:05 Composer la réponse
00:15:59 Contenir les erreurs
00:17:07 Conserver le résultat
00:18:43 Préparer le suivi
00:19:48 Google Sheets facultatif
00:21:21 Suivre la synchronisation
00:23:27 Les résultats de fin
00:24:16 Lire le workflow
00:25:06 Le service et ses garanties
00:32:55 S’entraîner pour l’entretien
```

## Texte parlé et indications de montage

### 00:00:00 — D’une demande à un brouillon vérifiable

**Chapitre :** Le projet et son résultat · **Durée :** 42.52 s

**À l’écran :** capture réelle du projet, sans animation de clic ni simulation d’exécution.

![D’une demande à un brouillon vérifiable](https://raw.githubusercontent.com/nicolashedoire/n8n-docker/main/docs/images/resultat-camille-openai.png)


**Voix :**

Une demande arrive avec un besoin, un budget et une date. Comment préparer une réponse utile, sans inventer les informations qui manquent ? Dans ce tutoriel de L’Atelier enne huit enne, nous allons suivre la demande de Camille à travers le workflow réel. Nous ouvrirons les étapes, lirons le code et expliquerons chaque décision. Le résultat attendu, c’est un dossier enregistré et un brouillon à relire. La personne garde la décision finale. La vidéo est un montage de captures du projet et d’extraits de son code, avec une voix de synthèse. Les captures de configuration servent à retrouver les réglages ; les captures de résultat proviennent de la démonstration enregistrée. Vous pouvez mettre en pause pour reproduire les manipulations. Le guide illustré dans Notion reprend le détail et les exercices corrigés.

### 00:00:42 — Lire le parcours avant de lire le code

**Chapitre :** Le projet et son résultat · **Durée :** 49.52 s

**À l’écran :** capture réelle du projet, sans animation de clic ni simulation d’exécution.

![Lire le parcours avant de lire le code](https://raw.githubusercontent.com/nicolashedoire/n8n-docker/main/docs/images/execution-n8n-openai.png)


**Voix :**

Ouvrez le workflow Qualification IA des demandes dans l’éditeur enne huit enne. Il contient vingt-cinq nœuds exécutables et cinq notes explicatives. Les deux entrées se trouvent à gauche : un formulaire natif et un webhook. Elles rejoignent la normalisation, puis la réservation. Au centre, le modèle extrait des faits. Le code vérifie ces faits, applique les règles métier et compose la réponse. À droite, le résultat est enregistré puis éventuellement copié dans Google Sheets. La branche Sheets est actuellement désactivée, faute de connexion validée. La relecture fonctionne dans le tableau local. Les branches inférieures rendent visibles les refus et les erreurs. Ce projet est un workflow avec une étape d’intelligence artificielle. Le modèle ne choisit pas librement ses outils : le graphe fixe l’ordre des actions. Cette précision vous aidera à expliquer son architecture pendant l’entretien.

### 00:01:32 — Ouvrir les trois vues de travail

**Chapitre :** Le projet et son résultat · **Durée :** 54.80 s

**À l’écran :** carte pédagogique avec les points suivants.

- Docker Desktop → Start-Demo.command
- Éditeur : localhost:5678
- Tableau : localhost:8787
- Parameters · Settings · Executions

**Voix :**

Pour refaire les étapes, commencez par démarrer Docker Desktop, puis lancez le script Start Demo du dépôt. Le script remet en route les services déjà installés ; il ne réimporte pas le workflow et ne remplace pas vos modifications. L’éditeur enne huit enne est accessible sur le port cinq mille six cent soixante-dix-huit. Le tableau de démonstration utilise le port huit mille sept cent quatre-vingt-sept. Dans l’éditeur, un double clic sur un nœud ouvre sa configuration. Parameters décrit ce qu’il fait. Settings présente les reprises et la gestion des erreurs. Dans Executions, ouvrez une exécution terminée pour regarder les entrées et les sorties réellement produites. Les captures de configuration qui suivent ne contiennent pas de sortie de test. Les extraits agrandis montrent le code utile, parfois avec des lignes omises et signalées. Ne confondez donc pas un exemple pédagogique avec une nouvelle preuve d’exécution.

### 00:02:26 — Comprendre un item et une expression

**Chapitre :** Le projet et son résultat · **Durée :** 50.52 s

**À l’écran :** extrait agrandi ; fragment remis en lignes, omissions éventuelles signalées.

```js
const donnees = $input.first().json;
return [{ json: donnees }];

// Champ de configuration n8n
={{ $json.input }}

// Lire un nœud précédent
$("Normaliser la demande").first().json
```

- Un item transporte un objet JSON
- Une exécution = une demande
- Les expressions lisent les données

**Voix :**

Avant le premier nœud, regardons la forme des données. Enne huit enne transmet une liste d’items. Chaque item contient un objet appelé jéson. Notre workflow traite une demande à la fois, ce qui explique l’utilisation du premier item. Dans un nœud Code, la variable input donne accès aux données reçues. Dans un champ de configuration, une expression entre doubles accolades évalue une valeur au moment de l’exécution. Après une requête HTTP, l’item courant contient généralement la réponse du service. Pour retrouver le message initial ou la réservation, le code peut donc référencer un nœud précédent par son nom. Le retour sous forme de tableau, avec une propriété jéson, remet les données au format attendu par le nœud suivant. Cette convention explique les enveloppes que vous allez rencontrer. Comprendre le contenu métier et son enveloppe permet de lire le code sans confondre les deux.

### 00:03:17 — Formulaire : retrouver les champs

**Chapitre :** Les entrées · **Durée :** 18.52 s

**À l’écran :** capture réelle du projet, sans animation de clic ni simulation d’exécution.

![Formulaire : retrouver les champs](https://raw.githubusercontent.com/nicolashedoire/n8n-docker/main/docs/images/tutoriel/01-formulaire.png)


**Voix :**

Dans l’éditeur, ouvrez Formulaire de contact par double clic. Le panneau Parameters contient le titre, les champs, leurs noms techniques et leur caractère obligatoire. Le panneau de droite affiche ici la configuration sans résultat de test. Nous allons maintenant relier ces réglages au comportement du formulaire.

### 00:03:35 — Le formulaire de contact

**Chapitre :** Les entrées · **Durée :** 44.20 s

**À l’écran :** extrait agrandi ; fragment remis en lignes, omissions éventuelles signalées.

```js
"authentication": "none",
"responseMode": "onReceived",
"options": {
  "path": "atelier-qualification-form",
  "buttonLabel": "Transmettre ma demande"
}
```

- Quatre champs métier obligatoires
- Accusé de réception immédiat
- Même traitement que le webhook

**Voix :**

Nous commençons par le besoin de la personne qui remplit le formulaire. Elle veut expliquer sa demande, sans connaître les détails de notre automatisation. Ce premier nœud lui propose donc quatre champs obligatoires : prénom, nom, adresse électronique et message. Les noms techniques des champs stabilisent les données reçues, même si les libellés affichés sont en français. Le chemin configuré dans les options donne l’adresse du formulaire publié. Le mode de réponse accuse réception immédiatement. Il faut bien distinguer cette confirmation de la réussite de l’analyse : à cet instant, le modèle n’a pas forcément terminé son travail. Le formulaire ne propose ni scénario de panne ni identifiant technique. La normalisation ajoutera le scénario normal, puis le service calculera un identifiant à partir du contenu. Cette entrée est volontairement simple. Elle utilise le même traitement que le webhook que nous allons voir, et n’envoie aucun email.

### 00:04:20 — Le webhook de démonstration

**Chapitre :** Les entrées · **Durée :** 48.52 s

**À l’écran :** extrait agrandi ; fragment remis en lignes, omissions éventuelles signalées.

```js
"httpMethod": "POST",
"path": "atelier-qualification",
"responseMode": "lastNode",
"responseData": "firstEntryJson"
```

- Entrée HTTP en jéson
- Réponse à la fin de la branche
- Identifiant fourni pour les essais

**Voix :**

Le deuxième déclencheur reçoit une requête contenant du jéson. Il sert au tableau de démonstration et aux scripts de vérification. Contrairement au formulaire, il attend le dernier nœud de la branche exécutée avant de répondre. L’option de réponse sélectionne le premier objet jéson renvoyé par cette branche. Nous obtenons donc soit un dossier traité, soit un doublon, soit une erreur explicite. Les deux déclencheurs convergent vers le même nœud de normalisation. C’est utile pour éviter deux versions des règles métier selon le canal d’entrée. Une requête peut fournir un identifiant, ce qui rend les tests de doublon reproductibles. Le chemin montré correspond au webhook publié, et non à un lien de test temporaire. Cette route est prévue pour l’installation locale. Son existence ne constitue pas une protection d’accès. Enfin, une réponse HTTP reçue doit toujours être interprétée avec son statut métier, pas seulement avec son code réseau.

### 00:05:08 — Normaliser : lire le nœud Code

**Chapitre :** Les entrées · **Durée :** 20.04 s

**À l’écran :** capture réelle du projet, sans animation de clic ni simulation d’exécution.

![Normaliser : lire le nœud Code](https://raw.githubusercontent.com/nicolashedoire/n8n-docker/main/docs/images/tutoriel/03-normaliser.png)


**Voix :**

Voici le nœud Normaliser la demande. Le langage sélectionné est JavaScript et le mode traite l’ensemble des items. Le code lit cependant le premier item, conformément au contrat d’une seule demande. La prochaine carte agrandit les lignes essentielles et explique les opérateurs.

### 00:05:28 — Normaliser les champs

**Chapitre :** Les entrées · **Durée :** 52.20 s

**À l’écran :** extrait agrandi ; fragment remis en lignes, omissions éventuelles signalées.

```js
const raw = $input.first().json;
const source = raw.body
  && typeof raw.body === 'object'
  && !Array.isArray(raw.body)
  ? raw.body : raw;
const text = value =>
  typeof value === 'string' ? value.trim() : '';
```

- Un seul contrat pour les deux entrées
- Nettoyer sans réécrire le message
- Recopier uniquement les champs prévus

**Voix :**

Le premier nœud de code commence par lire le premier élément reçu. Ici, une exécution représente une seule demande. Le webhook place généralement les champs dans un objet appelé body, tandis que le formulaire les fournit directement. La condition choisit donc le bon emplacement, en vérifiant que body est bien un objet et pas un tableau. Une petite fonction transforme ensuite une valeur texte en texte nettoyé de ses espaces périphériques. Une valeur d’un autre type devient vide, puis sera refusée si elle est obligatoire. Le code accepte plusieurs anciens noms de champs grâce à l’opérateur formé de deux points d’interrogation. Cet opérateur prend la valeur suivante lorsque la précédente est absente ou nulle. L’adresse électronique est mise en minuscules. Le message conserve son contenu. Enfin, seuls les champs prévus sont recopiés : une propriété entrante demandant une approbation ne devient pas une instruction pour la suite.

### 00:06:20 — Valider ou demander une correction

**Chapitre :** Les entrées · **Durée :** 57.52 s

**À l’écran :** extrait agrandi ; fragment remis en lignes, omissions éventuelles signalées.

```js
if (!['normal', 'api_error', 'invalid_json']
  .includes(input.scenario))
  issues.push('Scénario inconnu.');
return [{ json: {
  valid: issues.length === 0,
  input,
  issues
} }];
```

- Valider avant de réserver
- Un booléen pilote la branche
- Aucune inférence pour une saisie invalide

**Voix :**

La normalisation produit aussi une liste d’erreurs. Le prénom et le nom doivent être présents et limités à cent caractères. L’adresse électronique doit avoir une forme plausible. Le message doit être renseigné et ne pas dépasser dix mille caractères. Le scénario doit appartenir à la liste autorisée. Chaque contrôle ajoute une explication dans le tableau des problèmes. Le code calcule ensuite un booléen : il est vrai seulement si cette liste est vide. Le nœud conditionnel utilise ce booléen avec une vérification de type stricte. Si l’entrée est correcte, nous poursuivons vers la réservation. Sinon, un petit nœud de code termine la branche avec un statut de saisie invalide et les problèmes à corriger. Aucun appel au modèle n’est nécessaire pour expliquer une adresse incorrecte. Cette séparation évite des traitements inutiles et distingue clairement une erreur de saisie d’une panne technique du fournisseur.

### 00:07:18 — Réserver : inspecter la requête HTTP

**Chapitre :** Réserver une demande · **Durée :** 19.52 s

**À l’écran :** capture réelle du projet, sans animation de clic ni simulation d’exécution.

![Réserver : inspecter la requête HTTP](https://raw.githubusercontent.com/nicolashedoire/n8n-docker/main/docs/images/tutoriel/06-reserver.png)


**Voix :**

Ouvrez Réserver sans doublon. La méthode est POST. L’adresse qualification API désigne le service sur le réseau Docker, pas un domaine public. Le corps est envoyé en jéson. L’expression fournit les données normalisées. Regardons pourquoi cet appel vient avant le modèle.

### 00:07:37 — Réserver avant de lancer l’IA

**Chapitre :** Réserver une demande · **Durée :** 47.52 s

**À l’écran :** extrait agrandi ; fragment remis en lignes, omissions éventuelles signalées.

```js
"method": "POST",
"url": "http://qualification-api:3000/requests/reserve",
"sendBody": true,
"specifyBody": "json",
"jsonBody": "={{ $json.input }}"
```

- Réserver avant l’inférence
- Route process ou duplicate
- Jeton interne pour les écritures

**Voix :**

Le nœud suivant envoie les champs normalisés au service local pour réserver la demande. Il ne contacte pas encore le modèle. Le corps de la requête reprend uniquement l’objet input préparé précédemment, et l’attente est limitée à quinze secondes. Le service décide si ce dossier doit être traité ou s’il existe déjà. Sa réponse contient une route, l’identifiant du dossier et, pour une nouvelle tentative, un jeton interne. Ce jeton accompagnera les écritures suivantes. Le nœud conditionnel compare ensuite la route au mot process. Si elle correspond, la qualification peut commencer. Sinon, nous rendons le dossier existant. La décision est prise avant l’inférence pour éviter de payer et d’exécuter deux traitements ordinaires du même événement. La base réalise cette réservation de manière atomique. Enne huit enne orchestre la suite, mais il ne remplace pas cette garantie par un simple test visuel d’existence.

### 00:08:25 — Doublon et réservation refusée

**Chapitre :** Réserver une demande · **Durée :** 44.52 s

**À l’écran :** extrait agrandi ; fragment remis en lignes, omissions éventuelles signalées.

```js
const response = $input.first().json;

// Champs du résultat de doublon :
ok: true,
route: 'duplicate',
request_id: response.request_id,
record: response.record,
```

- Un doublon reprend le dossier existant
- Aucun nouvel appel IA ou Sheets
- Une réservation incertaine doit être examinée

**Voix :**

Deux petites branches permettent de comprendre ce que signifie arrêter proprement le traitement. Lorsqu’un doublon est reconnu, le nœud de code renvoie le dossier existant et indique explicitement qu’aucune nouvelle qualification n’a été lancée. Il ne rappelle ni le modèle ni Google Sheets. Le dossier peut déjà être terminé, mais il peut aussi être encore en cours avec une réservation active. Il faut donc lire son véritable statut. Une autre branche traite l’échec de réservation. Elle renvoie un message lisible et une erreur de réservation, sans inventer de dossier réussi. Ce message final est volontairement général : le détail du conflit ou de la panne se trouve dans le nœud HTTP. Si la réponse réseau a été perdue, une réservation peut malgré tout exister côté serveur. C’est pourquoi on examine le dossier avant de multiplier les essais avec de nouveaux identifiants.

### 00:09:09 — Extraction : un appel au service

**Chapitre :** L’extraction IA · **Durée :** 16.52 s

**À l’écran :** capture réelle du projet, sans animation de clic ni simulation d’exécution.

![Extraction : un appel au service](https://raw.githubusercontent.com/nicolashedoire/n8n-docker/main/docs/images/tutoriel/10-extraire.png)


**Voix :**

Cette capture montre le nœud HTTP Extraire les faits avec IA. L’adresse se termine par la route LLM. La clé OpenAI n’apparaît pas dans ce nœud : le service conserve la configuration du fournisseur. Nous expliquons d’abord le contrat de l’appel, puis les contrôles de sa réponse.

### 00:09:26 — Appeler le modèle via le service

**Chapitre :** L’extraction IA · **Durée :** 45.80 s

**À l’écran :** extrait agrandi ; fragment remis en lignes, omissions éventuelles signalées.

```js
"method": "POST",
"url": "http://qualification-api:3000/llm",
"retryOnFail": true,
"maxTries": 3,
"waitBetweenTries": 1000,
"options": {
  "timeout": 120000
}
```

- Message et scénario uniquement
- Trois tentatives au total
- Le texte retourné reste à valider

**Voix :**

Le nœud d’extraction est une requête HTTP vers le service de qualification. Ce service choisit ensuite OpenAI ou Ollama selon sa configuration. Dans le corps envoyé par enne huit enne, nous retrouvons seulement le message normalisé et le scénario. Les champs de nom et d’adresse électronique ne sont pas ajoutés au prompt. Attention, le texte libre peut lui-même contenir ces informations. Le nœud attend au maximum cent vingt secondes par tentative. Il autorise trois tentatives au total : le premier appel et deux reprises, séparées d’une seconde. Il ne faut donc pas annoncer trois reprises supplémentaires. Le service impose aussi son propre délai vers le fournisseur. Une réponse normale contient un texte jéson et des métriques, dont le modèle et la durée. Le texte n’est pas encore considéré comme une extraction valide. C’est précisément le travail des nœuds suivants. Après les échecs HTTP, une branche dédiée enregistrera une panne contrôlée.

### 00:10:12 — Validation : ouvrir la fonction réelle

**Chapitre :** Valider les faits · **Durée :** 19.80 s

**À l’écran :** capture réelle du projet, sans animation de clic ni simulation d’exécution.

![Validation : ouvrir la fonction réelle](https://raw.githubusercontent.com/nicolashedoire/n8n-docker/main/docs/images/tutoriel/11-valider.png)


**Voix :**

Dans Valider les faits, la fonction JavaScript est directement visible. Elle a été copiée automatiquement par le générateur depuis le module de politique du projet. Le service réutilise la même fonction. Cette organisation évite de maintenir à la main deux définitions divergentes des règles.

### 00:10:32 — Parser le JSON et vérifier le contrat

**Chapitre :** Valider les faits · **Durée :** 42.52 s

**À l’écran :** extrait agrandi ; fragment remis en lignes, omissions éventuelles signalées.

```js
out.extraction = validateExtraction(
  JSON.parse(response.text),
  $('Normaliser la demande').first().json.input.message
);
```

- Transformer le texte en objet
- Exiger les six faits et la catégorie
- Conserver une erreur au lieu de simuler un succès

**Voix :**

Nous recevons maintenant une enveloppe contenant le texte du modèle. Le nœud de validation récupère aussi le jeton de réservation, puis recopie les métriques et ajoute les marqueurs de version. L’appel à jéson parse transforme le texte en objet. Cette opération peut échouer même si la requête HTTP a réussi. Une fois l’objet obtenu, la fonction de validation exige exactement une catégorie et un objet de faits. La catégorie doit appartenir aux quatre valeurs admises. L’objet de faits doit contenir exactement six clés : besoin, budget, échéance, disponibilité, produit et problème. Chaque valeur est une chaîne de longueur bornée. Une chaîne vide représente une information absente. Les champs supplémentaires sont refusés. Ce contrat ferme évite qu’une propriété comme approuvé soit ajoutée au résultat métier. Le bloc de gestion d’erreur transforme tout refus en une erreur structurée. Le workflow continue alors pour conserver cette erreur, sans produire une analyse de remplacement.

### 00:11:14 — Vérifier chaque extrait dans la source

**Chapitre :** Valider les faits · **Durée :** 56.20 s

**À l’écran :** extrait agrandi ; fragment remis en lignes, omissions éventuelles signalées.

```js
const canonical = value => value
  .normalize('NFC')
  .replace(/[‘’]/gu, "'")
  .replace(/\s+/gu, ' ')
  .trim()
  .toLowerCase();

if (normalized &&
    !message.includes(canonical(normalized)))
```

- Chaque fait doit citer le message
- Normalisation typographique limitée
- Provenance textuelle ≠ pertinence métier

**Voix :**

La conformité du jéson ne dit pas si le modèle a inventé une information. Pour chaque fait renseigné, nous cherchons donc son extrait dans le message original. Avant cette comparaison, une fonction normalise les écritures Unicode équivalentes, les apostrophes courbes, les espaces et la casse. Elle ne supprime pas les accents et ne transforme pas les nombres. Un montant inventé reste donc refusé. Le code utilise ensuite includes pour vérifier la présence d’une sous-chaîne contiguë. Une paraphrase plausible n’est pas acceptée simplement parce qu’elle veut dire à peu près la même chose. Ce contrôle donne une preuve de provenance textuelle. Il ne donne pas une preuve de pertinence sémantique : le modèle peut citer un passage existant tout en le plaçant dans le mauvais champ. C’est une limite essentielle à expliquer. Nous contrôlons ce qui peut l’être mécaniquement, puis nous évaluons les résultats métier sur des exemples et nous conservons la relecture humaine.

### 00:12:10 — Qualification : rendre les règles visibles

**Chapitre :** Les règles métier · **Durée :** 18.80 s

**À l’écran :** capture réelle du projet, sans animation de clic ni simulation d’exécution.

![Qualification : rendre les règles visibles](https://raw.githubusercontent.com/nicolashedoire/n8n-docker/main/docs/images/tutoriel/12-regles.png)


**Voix :**

Le nœud Appliquer les règles de qualification expose les champs requis par catégorie. Les tableaux au début de la fonction permettent de retrouver les exigences métier. Nous allons expliquer leur rôle, puis le calcul des informations manquantes. Ces règles restent modifiables selon le besoin du client.

### 00:12:29 — Définir les informations nécessaires

**Chapitre :** Les règles métier · **Durée :** 49.20 s

**À l’écran :** extrait agrandi ; fragment remis en lignes, omissions éventuelles signalées.

```js
const requiredByCategory = {
  devis: ['need', 'budget', 'deadline'],
  rendez_vous: ['need', 'availability'],
  support: ['product', 'problem'],
  autre: ['need'],
};
const required = requiredByCategory[extraction?.category];
```

- Une politique explicite par catégorie
- Même extraction, mêmes règles
- Des critères à discuter avec le client

**Voix :**

Une extraction valide arrive maintenant dans une fonction déterministe. La première règle est une table qui définit les informations requises pour chaque catégorie. Un devis demande un besoin concret, un budget et une échéance. Un rendez-vous demande un sujet et une disponibilité. Un problème de support demande le produit concerné et une description du problème. La catégorie autre demande au moins un sujet précis. Ces règles sont un choix de cette démonstration, pas une vérité universelle. Si un client accepte les devis sans budget, nous devrons modifier cette politique avec lui, puis adapter les tests. Le code sélectionne la liste correspondant à la catégorie et vérifie que les faits ont bien la forme attendue. Il travaille ensuite sur une copie des faits. Cette étape montre clairement ce qui relève de l’IA et ce qui relève du produit : le modèle reconnaît les informations, mais il n’improvise pas les conditions de complétude.

### 00:13:18 — Calculer les manques sans les inventer

**Chapitre :** Les règles métier · **Durée :** 47.20 s

**À l’écran :** extrait agrandi ; fragment remis en lignes, omissions éventuelles signalées.

```js
const missing_fields = required.filter(
  key => facts[key] === ''
);

// Libellés exposés dans la qualification :
missing_information:
  missing_fields.map(key => labels[key]),
```

- Traiter quelques formulations vagues connues
- Filtrer les champs requis absents
- Exposer le calcul dans la sortie du nœud

**Voix :**

La fonction prévoit une protection limitée contre certains besoins trop vagues. Une courte liste contient des expressions comme automatiser mon entreprise ou des renseignements. Si le besoin extrait correspond exactement à une expression connue, il est considéré comme non précisé dans la qualification. L’extraction originale reste conservée, ce qui permet de comprendre la décision. Cette liste ne remplace pas un moteur général de compréhension du langage. Ensuite, le calcul des manques tient en une opération de filtrage : parmi les champs requis, garder ceux dont la valeur est vide. Le code transforme ces noms techniques en libellés lisibles. Pour Camille, le besoin, le budget et l’échéance sont présents : la liste des manques est vide. Si le budget seul manque, une seule précision sera demandée. Le résultat expose les champs requis, les champs manquants et les faits utilisés. Cette sortie intermédiaire est particulièrement utile pour expliquer le raisonnement métier dans l’éditeur.

### 00:14:05 — Composition : lire les gabarits

**Chapitre :** Composer la réponse · **Durée :** 20.52 s

**À l’écran :** capture réelle du projet, sans animation de clic ni simulation d’exécution.

![Composition : lire les gabarits](https://raw.githubusercontent.com/nicolashedoire/n8n-docker/main/docs/images/tutoriel/13-brouillon.png)


**Voix :**

Le nœud Composer le brouillon contient les libellés et les formulations utilisés pour produire le résultat. Le texte affiché ici est le code de configuration. La carte suivante agrandit les étapes de composition pour distinguer le résumé, les questions et la réponse au client.

### 00:14:26 — Construire un résumé traçable

**Chapitre :** Composer la réponse · **Durée :** 49.20 s

**À l’écran :** extrait agrandi ; fragment remis en lignes, omissions éventuelles signalées.

```js
const observed = qualification.required_fields
  .filter(key => qualification.facts[key] !== '')
  .map(key =>
    `${labels[key]} : « ${qualification.facts[key]} ».`
  );
```

- Résumé construit depuis les faits
- Filter sélectionne, map met en forme
- Aucune nouvelle génération libre

**Voix :**

Le nœud de composition ne demande pas au modèle de rédiger une deuxième réponse. Il utilise la qualification déjà calculée. Pour le résumé, il prend les champs requis de la catégorie, conserve ceux qui sont renseignés et les associe à des libellés français. La combinaison de filter et map signifie ici : sélectionner les informations présentes, puis transformer chacune en une phrase courte. Les citations sont reprises comme des données, avec leur libellé. Le code ajoute aussi la liste des précisions nécessaires lorsque des champs manquent. Nous obtenons donc un résumé dont on peut retrouver l’origine dans l’extraction. Cette traçabilité a toutefois une limite : si un fait exact a été mal classé, le résumé peut toujours être trompeur. Il faut relire la catégorie et les faits. Le résumé n’est pas non plus un calcul de prix ou une promesse commerciale. Il décrit les éléments connus et ce qui reste à préciser.

### 00:15:15 — Un brouillon au nom du prestataire

**Chapitre :** Composer la réponse · **Durée :** 43.80 s

**À l’écran :** extrait agrandi ; fragment remis en lignes, omissions éventuelles signalées.

```js
qualification.missing_fields
  .map(key => '- ' + questions[key])
  .join('\n')

// Contrat final de la fonction :
return {
  category: qualification.category,
  summary,
  missing_information: [...qualification.missing_information],
  draft_reply
};
```

- Une question par manque calculé
- Accusé de réception si la demande est complète
- Aucun texte libre injecté dans le brouillon

**Voix :**

La réponse destinée au client utilise des gabarits fixes. Une table associe chaque information manquante à une question. Le code parcourt uniquement la liste des manques, puis assemble les questions avec des retours à la ligne. Si aucun manque n’est signalé, il produit un accusé de réception sans question supplémentaire. Cette décision corrige un problème concret rencontré dans la première version : le modèle pouvait parler comme le client ou redemander un périmètre déjà fourni. Ici, aucun texte libre du client ou du modèle n’entre dans le brouillon. La formulation reste celle du prestataire et ne promet ni prix ni rendez-vous confirmé. Le contrat final comporte quatre champs : catégorie, résumé, informations manquantes et brouillon. Si une erreur existe déjà, le nœud la transporte sans composer de réponse. Un gabarit garantit une forme cohérente, mais il ne corrige pas à lui seul une extraction qui aurait oublié un fait réellement présent.

### 00:15:59 — Settings : trois tentatives au total

**Chapitre :** Contenir les erreurs · **Durée :** 17.20 s

**À l’écran :** capture réelle du projet, sans animation de clic ni simulation d’exécution.

![Settings : trois tentatives au total](https://raw.githubusercontent.com/nicolashedoire/n8n-docker/main/docs/images/tutoriel/10-retry.png)


**Voix :**

Dans Settings de l’appel IA, Retry On Fail est activé. Max Tries vaut trois et l’attente vaut mille millisecondes. On Error utilise la sortie d’erreur. Ces paramètres déclenchent la branche de panne lorsque les appels échouent ; nous allons voir comment elle conserve cette issue.

### 00:16:16 — Enregistrer une panne du modèle

**Chapitre :** Contenir les erreurs · **Durée :** 50.80 s

**À l’écran :** extrait agrandi ; fragment remis en lignes, omissions éventuelles signalées.

```js
attempt_token:
  $('Réserver sans doublon').first().json.attempt_token,
error: {
  code: 'LLM_UNAVAILABLE',
  // Message explicatif omis dans cet extrait.
},
metrics: {
  qualification_version: 'facts-v2',
  draft_method: 'template'
}
```

- Transformer la panne en erreur structurée
- Réutiliser la tentative réservée
- Aucune qualification de remplacement

**Voix :**

Revenons à la sortie d’erreur de l’appel IA. Après les tentatives autorisées, ce petit nœud de code construit un objet d’erreur. Il récupère le jeton de réservation pour rattacher le résultat à la bonne tentative. Il ajoute un code de panne et un message expliquant qu’une revue humaine est nécessaire. Il ne fabrique aucune catégorie et aucun brouillon de secours. Cette distinction évite de transformer une indisponibilité en une réponse apparemment réussie. Le code utilisé est volontairement général. Il peut couvrir une coupure réseau, un accès au fournisseur refusé ou une réponse incomplète rejetée par l’adaptateur. Les détails techniques restent à examiner dans l’exécution HTTP et dans le service. Cette branche rejoint directement l’enregistrement du résultat. La demande a déjà été reçue et réservée ; nous voulons donc en conserver l’échec de manière visible, plutôt que laisser la personne croire qu’elle a disparu ou qu’elle a été correctement analysée.

### 00:17:07 — Envoyer l’analyse au stockage

**Chapitre :** Conserver le résultat · **Durée :** 48.20 s

**À l’écran :** extrait agrandi ; fragment remis en lignes, omissions éventuelles signalées.

```js
"method": "POST",
"sendBody": true,
"specifyBody": "json",
"jsonBody": "={{ $json }}"

// Fragment de construction de l’URL :
encodeURIComponent(
  $('Réserver sans doublon').first().json.request_id
)
```

- Une analyse ou une erreur
- Recomposition avant stockage
- SQLite confirmé avant Sheets

**Voix :**

Les branches de succès et d’erreur rejoignent le même nœud HTTP d’enregistrement. L’adresse inclut l’identifiant obtenu lors de la réservation. La fonction qui encode cet identifiant évite de l’interpréter comme un fragment de chemin. Le corps reprend l’objet complet de l’item courant : jeton, métriques et soit une analyse accompagnée de son extraction, soit une erreur. Le service exige précisément l’une de ces deux issues. Avant de stocker une analyse, il vérifie encore les faits contre le message conservé en base et recalcule les mêmes règles et gabarits. Il compare ce résultat à celui envoyé par enne huit enne. Une modification arbitraire du brouillon ne doit donc pas devenir une écriture durable. Le service choisit ensuite l’état à relire, à compléter ou en erreur technique. Le workflow attend sa confirmation avant de préparer Google Sheets. Cette séquence place la conservation du dossier avant l’intégration facultative.

### 00:17:55 — Quand l’écriture n’est pas confirmée

**Chapitre :** Conserver le résultat · **Durée :** 48.20 s

**À l’écran :** extrait agrandi ; fragment remis en lignes, omissions éventuelles signalées.

```js
ok: false,
status: 'persistence_error',
request_id:
  $('Réserver sans doublon').first().json.request_id,
```

- Arrêter avant la copie Sheets
- Écriture non confirmée ≠ résultat perdu
- Inspecter le dossier avant une reprise

**Voix :**

L’enregistrement du résultat peut lui aussi échouer ou dépasser son délai. Dans cette situation, la branche ne continue pas vers Google Sheets. Le nœud de code renvoie un statut de persistance à vérifier, l’identifiant de la demande et une explication. Le choix des mots est important : nous disons que l’écriture n’est pas confirmée, pas que le résultat est forcément perdu. Une requête peut avoir été exécutée par le serveur puis perdre sa réponse sur le réseau. Refaire immédiatement tout le traitement risquerait de masquer ce qui s’est réellement passé. Il faut consulter le dossier et l’exécution avant de décider de la reprise. Ce nœud ne tente pas lui-même une réparation et ne crée pas un second dossier. Il donne au client du webhook une issue explicite. La robustesse consiste aussi à représenter correctement une incertitude, au lieu de présenter un succès sans preuve ou un échec plus définitif qu’il ne l’est.

### 00:18:43 — Suivi : aplatir une copie du dossier

**Chapitre :** Préparer le suivi · **Durée :** 21.68 s

**À l’écran :** capture réelle du projet, sans animation de clic ni simulation d’exécution.

![Suivi : aplatir une copie du dossier](https://raw.githubusercontent.com/nicolashedoire/n8n-docker/main/docs/images/tutoriel/17-suivi.png)


**Voix :**

Le nœud Préparer le suivi construit la ligne destinée au tableur après la confirmation du stockage. Le dossier structuré est conservé à côté de cette ligne. La capture permet de retrouver le mapping ; le code agrandi explique les valeurs de repli pour les dossiers sans analyse.

### 00:19:05 — Transformer le dossier en ligne de tableau

**Chapitre :** Préparer le suivi · **Durée :** 42.80 s

**À l’écran :** extrait agrandi ; fragment remis en lignes, omissions éventuelles signalées.

```js
const response = $input.first().json;
const record = response.record ?? response;
const input = record.input ?? record;
const analysis = record.analysis ?? {};

// Extraits du mapping :
informations_manquantes:
  (analysis.missing_information ?? []).join(' | '),
statut: record.status ?? 'unknown',
erreur: record.error?.code ?? '',
modele: record.metrics?.model ?? '',
```

- Treize colonnes explicites
- Valeurs vides pour une analyse absente
- Conserver aussi le dossier structuré

**Voix :**

Une fois l’écriture confirmée, nous préparons une projection du dossier pour Google Sheets. La réponse de l’API contient un objet record. Le code le récupère, puis utilise des valeurs de repli lorsqu’une propriété est absente. L’opérateur composé d’un point d’interrogation et d’un point permet de lire une propriété sans provoquer une erreur si l’objet intermédiaire manque. C’est utile pour les dossiers techniques qui n’ont pas d’analyse. Le mapping produit treize colonnes : identifiant, date, contact, message, qualification, brouillon, statut, erreur et modèle. La liste des informations manquantes est assemblée avec une barre verticale pour tenir dans une cellule. Le dossier complet reste conservé à côté de cette ligne aplatie. Nous ne remplaçons donc pas les données structurées par un tableau moins riche. Enfin, un booléen indique si les références Sheets ont été fournies lors de la génération. Ce booléen ne vérifie pas encore les droits d’accès à Google.

### 00:19:48 — Choisir la branche configurée

**Chapitre :** Google Sheets facultatif · **Durée :** 52.80 s

**À l’écran :** extrait agrandi ; fragment remis en lignes, omissions éventuelles signalées.

```js
"leftValue": "={{ $json.sheets_enabled }}",
"rightValue": true,
"operator": {
  "type": "boolean",
  "operation": "true",
  "singleValue": true
}
```

- Configuration fournie ≠ accès vérifié
- Branche locale utilisable sans Google
- Le dossier a déjà été enregistré

**Voix :**

Le nœud conditionnel suivant lit le booléen de configuration. S’il est vrai, il dirige la demande vers le nœud Google Sheets. Sinon, il passe par la conservation sans tableur. Ce booléen a été inscrit dans le workflow par le générateur. Il vaut vrai lorsque l’identifiant du document et l’identifiant de la connexion ont tous les deux été fournis. Il ne prouve pas que la connexion OAuth est encore valable ou que le compte dispose des bons droits. L’exécution réelle du nœud Google permettra de le vérifier. Cette distinction évite de confondre configuration et disponibilité. Dans l’export public, les références privées sont absentes et la branche sans Sheets est donc choisie. Le résultat reste disponible dans SQLite et dans le tableau local. L’intégration externe est facultative, tandis que l’enregistrement du dossier fait partie du parcours principal. C’est ce découpage qui permet de démontrer le workflow même lorsque Google n’est pas raccordé.

### 00:20:41 — Ajouter ou mettre à jour par identifiant

**Chapitre :** Google Sheets facultatif · **Durée :** 40.80 s

**À l’écran :** extrait agrandi ; fragment remis en lignes, omissions éventuelles signalées.

```js
"operation": "appendOrUpdate",
"matchingColumns": ["demande_id"],
"attemptToConvertTypes": false,
"convertFieldsToString": false,
"options": {"cellFormat": "RAW"},
"retryOnFail": true,
"maxTries": 3,
"waitBetweenTries": 1000,
"disabled": true
```

- Rapprochement par demande_id
- Mode RAW pour les valeurs
- Nœud désactivé sans références privées

**Voix :**

Le nœud natif Google Sheets reçoit le document, l’onglet et une connexion OAuth enregistrée dans enne huit enne. Son opération ajoute une ligne ou met à jour celle qui correspond à l’identifiant de demande. Le mapping relie explicitement chacune des treize colonnes à la ligne préparée. Le mode RAW conserve les chaînes sans les interpréter comme des formules de tableur. Trois tentatives au total sont autorisées, avec une seconde d’intervalle. Si l’opération réussit, une branche confirme la synchronisation. Sinon, une autre enregistre son échec. Le nœud est désactivé dans l’export public sans références privées. Ce réglage est nécessaire : un document vide pouvait faire échouer la validation globale avant même l’évaluation de la condition. Enfin, ce tableur reste une copie du résultat initial. Il n’est pas la base qui fait autorité, et sa présence dans le graphe ne prouve pas une écriture Google réussie lors des essais actuels.

### 00:21:21 — Confirmer une écriture Sheets réussie

**Chapitre :** Suivre la synchronisation · **Durée :** 44.20 s

**À l’écran :** extrait agrandi ; fragment remis en lignes, omissions éventuelles signalées.

```js
attempt_token:
  $("Réserver sans doublon").first().json.attempt_token,
status: "synced"
```

- Confirmer dans le dossier local
- Rattacher par la réservation
- Un statut distinct du résultat métier

**Voix :**

Après une écriture Google réussie, nous devons encore conserver cette information dans le dossier local. Le nœud de confirmation appelle la route de suivi avec le statut synchronisé et le jeton de la tentative courante. L’identifiant et le jeton sont retrouvés depuis le nœud de réservation. Nous ne dépendons donc pas de ce que Google renvoie dans sa réponse pour rattacher le suivi au bon dossier. Le service vérifie que le résultat métier a déjà été enregistré, puis ajoute l’événement de synchronisation. Si cette confirmation réussit, la branche peut se terminer normalement. Si elle échoue, nous signalerons que l’état de suivi n’est pas confirmé. Cette étape sépare deux événements différents : l’écriture dans le tableur et l’enregistrement local de cette écriture. Le statut synchronisé repose sur le succès du nœud Google et de la confirmation. Il ne remplace pas une lecture indépendante des cellules lorsque l’on veut vérifier le tableur lui-même.

### 00:22:06 — Conserver aussi un échec Sheets

**Chapitre :** Suivre la synchronisation · **Durée :** 35.24 s

**À l’écran :** extrait agrandi ; fragment remis en lignes, omissions éventuelles signalées.

```js
attempt_token:
  $("Réserver sans doublon").first().json.attempt_token,
status: "failed"
```

- Le résultat SQLite reste disponible
- Échec Sheets enregistré séparément
- Pas de reprise automatique différée

**Voix :**

La branche d’erreur de Google Sheets appelle la même route de suivi, mais avec un statut d’échec et un message explicite. Le résultat métier n’est pas supprimé : il a déjà été enregistré dans SQLite. Si cette notification d’échec réussit, nous avons un dossier dont l’état est connu. Le workflow peut alors terminer cette branche, tout en affichant que la copie Google a échoué. Un parcours terminé correctement ne signifie donc pas que tous les systèmes externes ont réussi. Il signifie ici que l’issue réelle a été conservée. Si l’appel de notification échoue lui aussi, le workflow bascule vers le suivi à vérifier. Le message envoyé à la base est volontairement général et ne recopie pas les détails bruts de Google. Pour diagnostiquer la cause, il faut ouvrir l’exécution du nœud Sheets. Le prototype n’ajoute pas automatiquement une nouvelle tâche de synchronisation après cette notification.

### 00:22:41 — Terminer volontairement sans Google Sheets

**Chapitre :** Suivre la synchronisation · **Durée :** 46.00 s

**À l’écran :** extrait agrandi ; fragment remis en lignes, omissions éventuelles signalées.

```js
const response = $input.first().json;

// Champs retournés par la fin de branche :
ok: true,
record: response.record ?? response,
sheets_sync: 'skipped',
```

- Aucun appel Google sur cette branche
- Statut skipped mémorisé
- Lire aussi le statut métier du dossier

**Voix :**

Lorsque Google Sheets n’est pas configuré, le workflow n’essaie pas de le contacter. Il appelle directement le service local pour mémoriser le statut ignoré, nommé skipped dans les données. Ce statut distingue une absence volontaire de configuration d’une erreur ou d’une synchronisation encore en attente. Après confirmation, un petit nœud de code retourne le dossier, le statut de copie ignorée et un message indiquant que le résultat reste dans le suivi local. La propriété ok vaut vrai, car cette branche s’est correctement exécutée. Cela ne garantit pas que l’analyse IA a réussi. Le dossier peut contenir une erreur technique qui a été correctement conservée. Il faut donc lire aussi son statut métier. Cette séparation rend l’interface plus fidèle à la réalité. Pendant la démonstration actuelle, c’est ce chemin qui est utilisé. Nous montrons un dossier enregistré et relisible sans prétendre avoir vérifié une écriture Google qui n’a pas eu lieu.

### 00:23:27 — Rendre le résultat ou une incertitude

**Chapitre :** Les résultats de fin · **Durée :** 49.20 s

**À l’écran :** extrait agrandi ; fragment remis en lignes, omissions éventuelles signalées.

```js
const response = $input.first().json;
const record = response.record ?? response;

// En cas de suivi non confirmé :
ok: false,
status: 'sink_tracking_error',
record: $('Préparer le suivi').first().json.record,
```

- Résultat métier et copie séparés
- Incertitude de suivi rendue visible
- Aucune approbation ni aucun envoi

**Voix :**

Deux dernières sorties expliquent comment lire la fin du workflow. Le résultat prêt pour relecture récupère le dossier et choisit son message selon qu’il contient une analyse ou une erreur technique. Il conserve aussi l’état de synchronisation. Un dossier métier valide peut donc être accompagné d’une copie Sheets échouée. L’autre sortie intervient lorsque la confirmation de synchronisation n’a pas pu être enregistrée. Elle reprend le dernier dossier dont nous connaissons la persistance et indique que le suivi doit être vérifié. Ce dossier peut présenter un statut de copie plus ancien que l’état réel. Il ne faut pas relancer Google à l’aveugle, car son écriture a peut-être réussi avant une perte de réponse. Si la branche concernée était simplement la conservation sans Sheets, c’est uniquement la confirmation locale qui est incertaine. Dans tous les cas, aucun de ces nœuds n’approuve le brouillon ou n’envoie un message : la personne reste responsable de la relecture.

### 00:24:16 — Les notes et la lecture d’une exécution

**Chapitre :** Lire le workflow · **Durée :** 49.80 s

**À l’écran :** extrait agrandi ; fragment remis en lignes, omissions éventuelles signalées.

```js
"type": "n8n-nodes-base.stickyNote",
"typeVersion": 1
```

- Cinq notes pour orienter la lecture
- Observer les données entre les nœuds
- Relier les contrôles au besoin métier

**Voix :**

Les cinq notes visuelles aident à se repérer dans le workflow. Les trois premières décrivent les entrées, la qualification et le suivi humain. Une quatrième explique la configuration facultative de Google Sheets. La dernière distingue les scénarios normaux des pannes injectées. Ces notes n’exécutent aucun code et ne protègent pas les données par elles-mêmes. Pour comprendre le fonctionnement, suivons ensuite une exécution réelle avec un identifiant connu. Nous lisons d’abord les champs normalisés, puis la route de réservation. Nous comparons les faits extraits au message, observons les champs requis et les manques calculés, puis relisons le brouillon. Enfin, nous vérifions le statut enregistré et l’issue de synchronisation. Cette lecture relie le besoin métier aux décisions du code. Les captures et les sorties enregistrées doivent être annoncées comme telles. Le tableau local sert à la relecture humaine ; le graphe explique précisément comment le dossier a été préparé.

### 00:25:06 — Pourquoi un service derrière n8n ?

**Chapitre :** Le service et ses garanties · **Durée :** 47.20 s

**À l’écran :** extrait agrandi ; fragment remis en lignes, omissions éventuelles signalées.

```js
import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
// …
import {
  validateExtraction,
  applyQualificationRules,
  composeAnalysis,
} from './qualification-policy.mjs';
// …
```

- n8n organise les étapes.
- Le service conserve et contrôle.
- Trois fichiers, trois responsabilités.

**Voix :**

Enne huit enne organise les étapes du traitement. Mais pour retrouver une demande après un redémarrage, reconnaître une répétition ou contrôler un résultat avant son enregistrement, nous utilisons aussi un petit service. Son rôle est de conserver un état fiable et de proposer quelques opérations précises. Le premier fichier reçoit les requêtes et gère la base de données. Le deuxième appelle le fournisseur du modèle. Le troisième contient les règles de qualification, également utilisées dans le workflow. Ces responsabilités sont séparées pour pouvoir les expliquer et les tester indépendamment. Le service utilise les fonctions intégrées à Node, sans framework supplémentaire. Ce choix garde la démonstration lisible. Il ne suffit évidemment pas à garantir une application prête pour tous les usages. Ce qui compte, ce sont les contrôles présents dans chaque opération. Nous allons suivre une demande depuis son arrivée jusqu’à son enregistrement et à sa relecture.

### 00:25:53 — Normaliser une demande et reconnaître son contenu

**Chapitre :** Le service et ses garanties · **Durée :** 38.80 s

**À l’écran :** extrait agrandi ; fragment remis en lignes, omissions éventuelles signalées.

```js
const payload = {
  first_name: text(input.first_name, 'Prénom', 100),
  last_name: text(input.last_name, 'Nom', 100),
  email: text(input.email, 'Email', 254).toLowerCase(),
  message: text(input.message, 'Message', 10_000),
  scenario: input.scenario ?? 'normal',
};
// … contrôles de l'email et du scénario
const payloadHash = hash(payload);
```

- Les entrées sont bornées.
- L’empreinte compare les contenus.
- Le hash ne chiffre pas les données.

**Voix :**

Quand une demande arrive, le service commence par contrôler sa forme. Le corps doit être un objet jéson et rester sous la taille autorisée. Chaque champ a ensuite ses propres limites. Les noms et le message sont débarrassés des espaces extérieurs, et l’adresse électronique passe en minuscules. Le code construit un nouvel objet avec les seuls champs prévus. Il calcule ensuite une empreinte de ce contenu. Cette empreinte permet de comparer deux versions d’une demande. Si aucun identifiant n’a été fourni, une partie de l’empreinte sert à en fabriquer un. Avec le même identifiant, un contenu différent est refusé. Avec le même identifiant et le même contenu, on peut reconnaître une répétition. Attention, cette empreinte ne chiffre rien : le message reste conservé dans la base. Elle ne reconnaît pas non plus deux formulations différentes qui auraient le même sens. C’est un contrôle technique du contenu normalisé.

### 00:26:32 — Une transaction pour réserver sans doublon

**Chapitre :** Le service et ses garanties · **Durée :** 52.28 s

**À l’écran :** extrait agrandi ; fragment remis en lignes, omissions éventuelles signalées.

```js
const transaction = callback => {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = callback();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
};
```

- Une demande possède un état durable.
- La transaction valide tout ou rien.
- Le réseau reste hors transaction.

**Voix :**

La base contient deux tables. La première représente l’état actuel de chaque demande. La seconde raconte son histoire, avec les réservations, les résultats et les décisions. Pour créer une demande, le serveur utilise une transaction. Imaginez une enveloppe qui rassemble plusieurs écritures : soit tout est validé, soit tout est annulé. Le code prend le verrou d’écriture avant de vérifier si l’identifiant existe. Il peut ensuite créer la demande et son événement sans laisser une autre réservation s’intercaler entre ces opérations. La clé primaire empêche aussi deux lignes de porter le même identifiant. Les valeurs sont transmises à des requêtes préparées, elles ne sont pas assemblées directement dans du texte de commande. Le modèle est appelé après cette réservation, en dehors de la transaction. Nous ne gardons donc pas la base verrouillée pendant une attente réseau. Cette garantie concerne la base locale, pas une écriture distante dans un autre outil.

### 00:27:24 — Bail et jeton : reprendre un traitement interrompu

**Chapitre :** Le service et ses garanties · **Durée :** 42.52 s

**À l’écran :** extrait agrandi ; fragment remis en lignes, omissions éventuelles signalées.

```js
if (previous) {
  // … contrôle de l'empreinte
  if (previous.status !== 'processing' ||
      previous.lease_until > now()) {
    return { route: 'duplicate', request_id: id,
             record: record(previous) };
  }
  const token = secret();
  // … mise à jour du jeton et du bail en base
  event(id, 'lease_reclaimed');
  // … réponse autorisant la nouvelle tentative
}
```

- Le bail permet une reprise.
- Le nouveau jeton remplace l’ancien.
- Une reprise doit être déclenchée.

**Voix :**

Une nouvelle réservation renvoie une autorisation de traiter, accompagnée d’un jeton aléatoire. Le workflow doit conserver ce jeton pour enregistrer son résultat. La réservation possède aussi un délai de dix minutes. Tant que ce délai court, une répétition de la demande est reconnue comme un doublon. Si le traitement est toujours en cours après le délai, une nouvelle réservation peut reprendre la main et recevoir un nouveau jeton. L’ancien traitement ne peut alors plus écrire avec son ancien jeton. C’est utile lorsqu’une exécution arrêtée reprend tardivement. Il faut être précis sur la limite : le temps écoulé ne suffit pas à invalider le jeton. C’est sa substitution par une nouvelle tentative qui bloque l’ancien propriétaire. Il n’existe pas non plus de relance automatique à l’expiration. Enfin, ce mécanisme empêche un ancien résultat d’écraser le nouveau ; il ne rembourse pas un appel au modèle déjà effectué.

### 00:28:07 — Choisir le fournisseur sans exposer la clé

**Chapitre :** Le service et ses garanties · **Durée :** 45.80 s

**À l’écran :** extrait agrandi ; fragment remis en lignes, omissions éventuelles signalées.

```js
const configuredFile =
  options.keyFile ?? env.OPENAI_API_KEY_FILE;
const file = configuredFile || standardKeyFile;
if (file) {
  try {
    const key = readFileSync(file, 'utf8').trim();
    // … contrôles du format de la clé
    return { key };
  } catch (error) {
    // … erreur explicite ou recours à l'environnement
  }
}
```

- Le fournisseur est choisi explicitement.
- La clé reste côté serveur.
- Une clé présente peut être invalide.

**Voix :**

Le workflow appelle une interface commune. Derrière cette interface, la configuration choisit explicitement OpenAI ou Ollama. La présence d’une clé ne change pas toute seule ce choix. Pour OpenAI, le serveur lit d’abord le fichier de secret configuré. Il peut utiliser une variable d’environnement lorsque le fichier standard n’existe pas. En revanche, si un chemin a été explicitement demandé et qu’il est illisible, le service signale une erreur. Il ne passe pas discrètement à une autre clé. La valeur sert uniquement à construire l’en-tête d’autorisation de la requête. Elle n’entre ni dans le message du modèle, ni dans les demandes consultables. La route de santé affiche seulement si une clé semble configurée localement. Ce booléen ne prouve pas que la clé est valide, que le compte dispose de crédit ou que le modèle est accessible. Ces vérifications nécessitent une réponse réelle du fournisseur.

### 00:28:53 — Demander une structure et contrôler la réponse

**Chapitre :** Le service et ses garanties · **Durée :** 42.52 s

**À l’écran :** extrait agrandi ; fragment remis en lignes, omissions éventuelles signalées.

```js
body = {
  model,
  input: messages,
  store: false,
  reasoning: { effort: 'low' },
  max_output_tokens: 2000,
  text: { format: {
    type: 'json_schema',
    name: 'qualification_facts',
    strict: true, schema
  } }
};
```

- Le schéma ferme la structure.
- Les sorties incomplètes sont refusées.
- La forme ne garantit pas le sens.

**Voix :**

L’appel OpenAI utilise l’interface Responses avec le schéma attendu. Le modèle doit renvoyer une catégorie et six faits, sans ajouter d’autres propriétés. La sortie est limitée et le niveau de raisonnement demandé reste faible. Le paramètre de stockage est désactivé dans la requête ; il ne faut pas en déduire une garantie générale sur toute conservation possible chez le fournisseur. Quand la réponse revient, le serveur ne suppose pas que le premier élément contient le texte. Il recherche les messages puis leurs contenus textuels. Il refuse une génération incomplète, un refus du modèle, un texte vide ou un objet jéson invalide. Même une réponse partielle qui semble déjà correcte n’est pas acceptée. Avec Ollama, l’enveloppe diffère, mais le service renvoie le même contrat au workflow. Le schéma contraint la forme ; les contrôles métier qui suivent restent indispensables pour juger ce que les faits permettent réellement de conclure.

### 00:29:35 — Distinguer une panne, une erreur et une mesure

**Chapitre :** Le service et ses garanties · **Durée :** 49.52 s

**À l’écran :** extrait agrandi ; fragment remis en lignes, omissions éventuelles signalées.

```js
// Extrait de cleanMetrics
const result = {};
// … champs texte autorisés
for (const key of [
  'duration_ms', 'prompt_tokens',
  'completion_tokens', 'attempts'
]) if (typeof input[key] === 'number' &&
       Number.isFinite(input[key]) && input[key] >= 0) {
  result[key] = input[key];
}
return result;
```

- Une tentative par appel fournisseur.
- Des erreurs structurées et sobres.
- Les simulations sont identifiées.

**Voix :**

Chaque appel du service au fournisseur réalise une seule tentative. C’est enne huit enne qui organise les nouvelles tentatives, pour éviter que plusieurs couches multiplient les appels sans qu’on le voie. Une attente trop longue provoque une erreur bornée dans le temps. Une clé refusée, une limite de quota ou une réponse incomplète reçoivent aussi des codes distincts. Le corps brut des erreurs du fournisseur n’est pas recopié : il pourrait reprendre des informations sensibles. Les métriques sont filtrées avant leur conservation. Elles indiquent notamment le fournisseur, le modèle, la durée et les tokens signalés. Elles ne constituent pas un calcul de facture ni forcément le total de toutes les tentatives. Deux scénarios de démonstration provoquent volontairement une panne ou un jéson cassé. Ils sont clairement marqués comme simulations, sans appel au modèle. Ils vérifient les chemins d’erreur, mais ne démontrent pas la qualité sémantique du modèle.

### 00:30:25 — Vérifier le résultat avant de le conserver

**Chapitre :** Le service et ses garanties · **Durée :** 52.52 s

**À l’écran :** extrait agrandi ; fragment remis en lignes, omissions éventuelles signalées.

```js
extraction = validateExtraction(
  input.extraction,
  JSON.parse(row.payload).message
);
// …
const expected = validateAnalysis(
  composeAnalysis(applyQualificationRules(extraction))
);
if (JSON.stringify(analysis) !== JSON.stringify(expected)) {
  // … refus HTTP 422 : analysis_mismatch
}
```

- Le message stocké sert de référence.
- Le serveur recalcule l’analyse.
- L’origine textuelle ne prouve pas le sens.

**Voix :**

Quand le workflow veut enregistrer une réussite, le serveur ne fait pas confiance au seul objet reçu. Il vérifie d’abord le jeton de tentative et les quatre champs de l’analyse. Il exige aussi les faits extraits. Ces faits sont comparés au message original déjà conservé dans la base, et non à une nouvelle version fournie avec le résultat. Le serveur recalcule ensuite la qualification et le brouillon avec les mêmes fonctions métier. Si l’analyse reçue ne correspond pas à ce résultat attendu, l’écriture est refusée. Cette vérification fonctionne même si les métriques sont absentes : on ne peut pas désactiver le contrôle en retirant une étiquette de version. La présence d’un extrait dans le message prouve seulement son origine textuelle. Elle ne prouve pas que le modèle l’a placé dans le bon champ. Le brouillon est cohérent avec les faits retenus, mais une erreur d’interprétation reste possible et justifie la relecture.

### 00:31:17 — Une décision de relecture séparée du modèle

**Chapitre :** Le service et ses garanties · **Durée :** 45.80 s

**À l’écran :** extrait agrandi ; fragment remis en lignes, omissions éventuelles signalées.

```js
checkHuman(req, input);
// … transaction et contrôle du statut courant
const status = match[2] === 'approve'
  ? 'approved' : 'rejected';
// … mise à jour du statut en base
 event(row.id, 'human_decision', {
  decision: status,
  actor: 'local_reviewer',
  delivery: 'none'
});
```

- La décision utilise une route séparée.
- La session protège le parcours local.
- Approuver ne déclenche aucun envoi.

**Voix :**

L’approbation passe par une opération distincte de l’enregistrement du résultat. Une instruction dans le message client ou un champ inventé par le modèle ne peut donc pas approuver une demande. Le serveur vérifie l’origine de la requête, une session locale et un jeton de protection associé. Ces contrôles limitent les demandes provenant d’une autre page web. Il faut cependant appeler les choses correctement : ce n’est pas un système de comptes ni une preuve qu’un humain est présent. L’application est prévue pour cette démonstration locale. Seules les demandes en attente de relecture ou de précisions peuvent recevoir une décision. Une erreur technique ne peut pas être approuvée. Le serveur conserve ensuite un événement indiquant la décision et l’absence de livraison. Approuver signifie ici valider la relecture du brouillon. Cela n’envoie aucun email, ne fixe aucun rendez-vous et ne transforme pas le modèle en acteur autorisé à agir au nom du prestataire.

### 00:32:03 — Ce que les tests prouvent, et ce qui reste à évaluer

**Chapitre :** Le service et ses garanties · **Durée :** 52.52 s

**À l’écran :** carte pédagogique avec les points suivants.

- Les tests isolent les mécanismes.
- La qualité du modèle demande un corpus.
- Les limites sont explicites.

**Voix :**

Les tests vérifient les mécanismes du service avec des situations contrôlées. Plusieurs réservations concurrentes doivent donner un seul traitement. Un ancien jeton doit être rejeté après une reprise. Une analyse incohérente doit être refusée. Une erreur de synchronisation doit laisser le résultat consultable. Les tests du fournisseur simulent des réponses pour contrôler l’adaptateur sans consommer de crédit. Ils ne prouvent pas la qualité du modèle sur toutes les demandes. Cette qualité demande un corpus représentatif et des essais réels. Le service conserve aussi des limites visibles : une synchronisation échouée n’est pas réparée automatiquement, et la route de santé ne teste pas le fournisseur. Un point reste à améliorer dans le relais vers enne huit enne : une réponse réussie au niveau du transport mais sans jéson ne devrait pas laisser croire que le résultat métier est connu. Présenter ces limites avec leurs conséquences permet d’expliquer précisément le niveau de garantie de la démonstration.

### 00:32:55 — Les résultats et leurs limites

**Chapitre :** S’entraîner pour l’entretien · **Durée :** 42.52 s

**À l’écran :** carte pédagogique avec les points suivants.

- Qualité réelle : OpenAI 9/9 · Ollama 5/9
- Scénarios techniques : 7/7
- Tests isolés : 29 réussites
- Google Sheets : écriture non validée

**Voix :**

Le passage à OpenAI a été évalué sur le même petit corpus que le modèle local. Le rapport du trois octobre indique neuf cas de qualité réussis sur neuf pour OpenAI, contre cinq sur neuf pour le modèle local. Les sept scénarios techniques passent aussi, et vingt-neuf tests isolés couvrent des contrats du code avec des réponses simulées. Ces nombres répondent à des questions différentes. Les tests isolés vérifient le programme. Les cas de qualité observent le comportement réel du modèle sur des messages fictifs. Une seule campagne de neuf messages ne prouve pas la fiabilité générale. Il faudrait enrichir le corpus, répéter les mesures et observer des données représentatives avec les autorisations adaptées. L’écriture Google Sheets n’est pas validée dans cette installation. Enfin, remplacer le modèle n’était pas la seule correction : l’extraction, les règles et la composition du brouillon ont été séparées pour rendre la réponse plus contrôlable.

### 00:33:38 — Prédire le résultat, puis le vérifier

**Chapitre :** S’entraîner pour l’entretien · **Durée :** 44.20 s

**À l’écran :** carte pédagogique avec les points suivants.

- Complet → pending_review
- Budget et date absents → needs_info
- Même contenu + même ID → doublon
- Panne simulée → technical_error

**Voix :**

Avant de cliquer sur lancer la qualification, essayez de prédire le parcours. Avec une demande de devis complète, vous attendez les faits présents, aucune information obligatoire manquante et un brouillon en attente de relecture. Retirez le budget et la date dans un deuxième message, avec un nouvel identifiant. La catégorie reste devis, mais les règles doivent demander ces deux précisions. Renvoyez ensuite exactement le même identifiant et le même contenu : la branche doublon doit reprendre le dossier, sans nouvel appel au modèle. Changez le contenu en conservant cet identifiant : le service doit refuser le conflit. Les deux scénarios de panne du tableau sont explicitement simulés. Ils servent à observer le comportement de repli. Pour chaque essai, regardez le statut métier et l’historique du dossier, puis les nœuds parcourus dans Executions. Une exécution verte indique que le chemin s’est terminé ; elle ne suffit pas à prouver que la demande est qualifiée.

### 00:34:22 — Présenter le projet en quinze minutes

**Chapitre :** S’entraîner pour l’entretien · **Durée :** 42.52 s

**À l’écran :** carte pédagogique avec les points suivants.

- 2 min : besoin et résultat
- 3 min : architecture
- 5 min : IA, règles et code
- 3 min : doublon et erreur
- 2 min : limites et évolutions

**Voix :**

Pour l’entretien, préparez un récit de quinze minutes. Deux minutes pour expliquer le besoin et montrer un résultat. Trois minutes pour parcourir le graphe et répartir les responsabilités. Cinq minutes pour expliquer l’extraction, la validation et un morceau de code que vous maîtrisez. Trois minutes pour démontrer un doublon et une erreur contenue. Gardez les deux dernières minutes pour les limites et les évolutions. Dites précisément ce que vous avez construit, ce que vous avez repris de votre atelier et ce que vous avez amélioré avec une assistance. Le critère utile est votre capacité à expliquer, modifier et diagnostiquer le projet. Pour vous entraîner, changez une règle dans une copie, prédisez les conséquences puis vérifiez les tests. Le guide Notion donne le code, les captures et des exercices corrigés. Revenez aux chapitres où vous hésitez jusqu’à pouvoir raconter le parcours sans réciter le tutoriel.
