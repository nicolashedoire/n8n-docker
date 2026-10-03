# Nœuds 10 à 14 — IA, vérifications, règles et brouillon

![Appel HTTP vers le service : seule la demande est envoyée au modèle](https://raw.githubusercontent.com/nicolashedoire/n8n-docker/main/docs/images/tutoriel/10-extraire.png)

### Nœud 10 — Extraire les faits avec IA

**Type :** HTTP Request. **URL :** `http://qualification-api:3000/llm`. **Corps :** seulement le message et le scénario.

```js
{{ {
  message: $('Normaliser la demande').first().json.input.message,
  scenario: $('Normaliser la demande').first().json.input.scenario
} }}
```

Le nœud retrouve le message normalisé par son nom. Il n’ajoute pas les champs prénom, nom ou email au prompt. Un nom ou une adresse déjà présents dans le message libre sont toutefois transmis : ce filtrage de champs n’est pas une anonymisation automatique.

**Réglages :** `retryOnFail: true`, `maxTries: 3`, `waitBetweenTries: 1000`, timeout de 120 000 ms. Cela signifie **trois tentatives au total : un appel initial et au maximum deux reprises**, avec une seconde d’intervalle. Ce n’est pas un appel initial plus trois reprises.

#### Ce qui se passe derrière `/llm`

Le service fabrique un schéma avec exactement `category` et `facts`. Les catégories admises sont `devis`, `rendez_vous`, `support`, `autre`. Les six champs de `facts` sont obligatoires et sont des chaînes de 300 caractères maximum. Une absence doit être représentée par `""`.

Le prompt demande des extraits contigus du message, sans reformulation ni invention. Il définit les catégories, distingue échéance de projet et disponibilité de rendez-vous, et fournit quelques exemples d’extraction. Le texte client est présenté comme une donnée non fiable. Ces consignes orientent le modèle ; les nœuds suivants vérifient ce qu’il a réellement produit.

Avec la configuration OpenAI validée, le service appelle `gpt-5.6-terra` via Responses API avec `text.format` en schéma strict, `reasoning.effort: low`, `max_output_tokens: 2000` et `store: false`. Ce dernier réglage ne doit pas être présenté comme une garantie générale de rétention nulle. Le service refuse les réponses incomplètes, refusées ou sans texte exploitable. Son délai par appel est de 60 secondes par défaut et il n’a pas de boucle de reprises interne : les reprises appartiennent à n8n.

Avec `LLM_PROVIDER=ollama`, l’adaptateur appelle `/api/chat`, avec le schéma dans `format`, sans streaming, température 0, contexte 4096 et plafond de génération de 500 tokens. Il n’y a aucun basculement automatique entre les fournisseurs.

Le résultat normal est une enveloppe :

```json
{
  "text": "{\"category\":\"devis\",\"facts\":{...}}",
  "metrics": {
    "provider": "openai",
    "model": "gpt-5.6-terra",
    "duration_ms": 1950
  }
}
```

L’exemple omet les six faits et certaines métriques pour rester lisible. `text` est une **chaîne contenant du JSON**, pas encore l’objet d’extraction validé. La durée illustre une mesure du modèle ; elle ne représente pas nécessairement toute l’exécution n8n.

Succès HTTP → nœud 11. Erreur après les tentatives configurées → nœud 14. Une erreur HTTP permanente, telle qu’un accès refusé, peut aussi subir ces tentatives : la configuration ne sélectionne pas finement les erreurs qui méritent une reprise.



![Validation des faits et contrôle des citations](https://raw.githubusercontent.com/nicolashedoire/n8n-docker/main/docs/images/tutoriel/11-valider.png)

### Nœud 11 — Valider les faits

**Type :** Code. **Entrée :** enveloppe `{ text, metrics }`. **Sortie :** contexte de tentative, métriques et soit `extraction`, soit `error`.

Le code de la fonction pure `validateExtraction` est intégré directement dans ce nœud par le générateur. Il n’est pas téléchargé pendant l’exécution.

#### A. Conserver le contexte nécessaire

```js
const response = $input.first().json;
const reservation = $('Réserver sans doublon').first().json;
const out = {
  attempt_token: reservation.attempt_token,
  metrics: {
    ...(response.metrics ?? {}),
    qualification_version: 'facts-v2',
    draft_method: 'template'
  }
};
```

Les métriques du fournisseur sont conservées. Les deux marqueurs expliquent la méthode : extraction de faits version 2, puis réponse par gabarit. Le jeton de réservation est réintroduit pour l’écriture ultérieure.

#### B. Parser, puis vérifier

```js
out.extraction = validateExtraction(
  JSON.parse(response.text),
  $('Normaliser la demande').first().json.input.message
);
```

`JSON.parse` transforme le texte en objet. Il peut échouer même si l’appel HTTP a répondu 200. Ensuite, `validateExtraction` exige :

- un objet avec exactement `category` et `facts` ;
- une catégorie autorisée ;
- exactement les six clés `need`, `budget`, `deadline`, `availability`, `product`, `problem` ;
- une chaîne par fait, de 300 caractères maximum ;
- `""` pour un fait vide, et non une chaîne constituée uniquement d’espaces ;
- la présence de chaque extrait non vide dans le message d’origine.

La fonction de comparaison est :

```js
const canonical = value => value
  .normalize('NFC')
  .replace(/[‘’]/gu, "'")
  .replace(/\s+/gu, ' ')
  .trim()
  .toLowerCase();
```

NFC rapproche des écritures Unicode équivalentes d’une même lettre accentuée. Les apostrophes U+2018 et U+2019 deviennent l’apostrophe droite. Les suites d’espaces sont regroupées et la comparaison ignore la casse. Les accents, les mots et les nombres ne sont pas corrigés. Ainsi, un budget `5 000 €` absent d’un message contenant `4 000 €` est refusé. Une paraphrase est refusée même si elle paraît plausible.

Le contrôle décisif est :

```js
if (normalized && !message.includes(canonical(normalized))) {
  throw new Error(`Extraction : fait ${key} non attesté dans le message.`);
}
```

`includes` vérifie la présence d’une sous-chaîne contiguë après cette normalisation. Il n’évalue pas si l’extrait a été placé dans le bon champ. Un passage bien cité peut encore être mal interprété.

#### C. Transformer un refus en donnée d’erreur

Le `catch` remplit `out.error` avec `code: INVALID_LLM_OUTPUT`. Une erreur de syntaxe reçoit le message « Le modèle a produit un JSON invalide. » ; les autres contrôles donnent la raison de validation.

Le nœud **ne stoppe pas brutalement** le workflow : il renvoie l’objet d’erreur pour qu’il soit enregistré. Aucun objet factice n’est fabriqué pour transformer cette erreur en réussite.

**Pourquoi un contrôle après un schéma strict ?** La structure et la provenance sont deux propriétés différentes. Le schéma encadre la forme ; la preuve de source vérifie les citations. Même leurs deux réussites ne suffisent pas à prouver la qualité métier de toute extraction.



![Les règles métier sont explicites dans le code](https://raw.githubusercontent.com/nicolashedoire/n8n-docker/main/docs/images/tutoriel/12-regles.png)

### Nœud 12 — Appliquer les règles de qualification

**Type :** Code. **Entrée :** extraction validée ou erreur. **Sortie :** contexte enrichi de `qualification`, sauf si une erreur existe.

Le petit bloc autour de la fonction dit :

```js
const out = $input.first().json;
if (!out.error) {
  try { out.qualification = applyQualificationRules(out.extraction); }
  catch (error) {
    out.error = { code: 'QUALIFICATION_POLICY_ERROR', message: error.message };
  }
}
return [{ json: out }];
```

`if (!out.error)` empêche de calculer une qualification à partir de faits déjà refusés. Une erreur antérieure continue vers l’enregistrement sans devenir une analyse.

La fonction métier définit les champs requis :

```js
const requiredByCategory = {
  devis: ['need', 'budget', 'deadline'],
  rendez_vous: ['need', 'availability'],
  support: ['product', 'problem'],
  autre: ['need']
};
```

C’est une politique de cette démonstration, pas une règle universelle du commerce. Par exemple, certains clients pourraient accepter une demande de devis sans budget ; cela demanderait une modification discutée de cette table et des tests.

La fonction copie les faits, puis applique une liste courte d’expressions génériques connues : « automatiser mon entreprise », « des renseignements », « des informations », etc. Si `need` correspond exactement à une expression de cette liste, après normalisation limitée de ses espaces, casse et ponctuation finale, il devient vide dans la qualification.

Cette liste traite des régressions identifiées ; ce n’est pas une reconnaissance sémantique générale. L’extraction initiale reste conservée séparément, ce qui permet de voir ce que le modèle avait proposé.

Le calcul des manques est simple :

```js
const missing_fields = required.filter(key => facts[key] === '');
```

Pour Camille, les champs requis sont `need`, `budget`, `deadline`, tous renseignés : `missing_fields: []`. Si seul le budget manque : `missing_fields: ["budget"]`, puis `missing_information: ["Le budget disponible"]`.

La sortie `qualification` contient la catégorie, les faits utilisés, `required_fields`, `missing_fields`, les libellés destinés à la personne et `ignored_generic_need`.

**Pourquoi écrire ces règles ?** Le modèle ne doit pas improviser les conditions de complétude. Une même extraction doit conduire aux mêmes questions et au même statut métier.



![Le brouillon est composé par des gabarits déterministes](https://raw.githubusercontent.com/nicolashedoire/n8n-docker/main/docs/images/tutoriel/13-brouillon.png)

### Nœud 13 — Composer le brouillon

**Type :** Code. **Entrée :** qualification ou erreur. **Sortie :** données prêtes pour `/result`.

Le bloc principal conserve seulement les données nécessaires à l’API : jeton, métriques, extraction, puis `analysis` ou `error`. Il ne transmet pas toute la structure intermédiaire `qualification`.

```js
const input = $input.first().json;
const out = { attempt_token: input.attempt_token, metrics: input.metrics };
if (input.extraction) out.extraction = input.extraction;
if (input.error) out.error = input.error;
else {
  try { out.analysis = composeAnalysis(input.qualification); }
  catch (error) {
    out.error = { code: 'DRAFT_POLICY_ERROR', message: error.message };
  }
}
return [{ json: out }];
```

La fonction `composeAnalysis` fait deux travaux différents.

#### A. Un résumé explicable à partir des faits

```js
const observed = qualification.required_fields
  .filter(key => qualification.facts[key] !== '')
  .map(key => `${labels[key]} : « ${qualification.facts[key]} ».`);
```

Seuls les faits requis pour la catégorie et effectivement renseignés sont repris. Le résumé associe le libellé de catégorie, ces citations et les informations à préciser. Les citations ne sont pas reformulées par un second appel au modèle. Leur présence dans le résumé n’en fait pas des instructions à exécuter.

#### B. Une réponse écrite du point de vue du prestataire

Une table associe à chaque code de manque une question fixe :

| Code | Question |
| --- | --- |
| `need`, devis | Pouvez-vous préciser le besoin et le périmètre attendus ? |
| `need`, rendez-vous | Quel sujet souhaitez-vous aborder lors du rendez-vous ? |
| `need`, autre | Pouvez-vous préciser l’objet de votre demande ? |
| `budget` | Quel budget souhaitez-vous consacrer à ce projet ? |
| `deadline` | À quelle échéance souhaitez-vous aboutir ? |
| `availability` | Quelles sont vos disponibilités pour ce rendez-vous ? |
| `product` | Quel produit ou service est concerné ? |
| `problem` | Quel problème rencontrez-vous ? |

Le cœur de la composition est :

```js
qualification.missing_fields.map(key => '- ' + questions[key]).join('\n')
```

Une question est générée par champ manquant, et uniquement pour ces champs. Si aucun champ requis ne manque, le gabarit donne un accusé de réception sans question :

> Bonjour,
>
> Nous avons bien reçu votre demande de devis. Les éléments transmis permettent d’étudier votre demande. Nous reviendrons vers vous après examen.
>
> Cordialement.

Si des champs manquent, le gabarit remercie la personne, présente la liste des questions et conclut que ces précisions permettront d’examiner la demande. Il ne promet ni devis calculé, ni prix, ni rendez-vous confirmé.

**Pourquoi des gabarits ?** La première version laissait le modèle rédiger librement et pouvait parler comme le client ou recopier une instruction hostile. Ici, aucun texte libre du modèle ou du client n’entre dans le brouillon. L’IA reste utile pour comprendre la demande ; la voix et la cohérence de la réponse sont contrôlées par le code.

Le contrat final contient exactement `category`, `summary`, `missing_information`, `draft_reply`. La catégorie et les faits restent sujets à relecture : un gabarit cohérent peut poser une question inutile si l’extraction était incomplète.



![Settings de l’appel IA : trois tentatives, attente et sortie d’erreur](https://raw.githubusercontent.com/nicolashedoire/n8n-docker/main/docs/images/tutoriel/10-retry.png)

### Nœud 14 — Contenir la panne IA

**Type :** Code. **Branche :** échec HTTP du nœud 10 après les tentatives. **Suite :** nœud 15.

Le code récupère le jeton depuis la réservation et construit :

```js
{
  attempt_token: /* jeton de la réservation courante */,
  error: {
    code: 'LLM_UNAVAILABLE',
    message: 'Appel IA en échec après les tentatives bornées. Revue humaine nécessaire.'
  },
  metrics: { qualification_version: 'facts-v2', draft_method: 'template' }
}
```

Le commentaire dans l’extrait remplace volontairement la valeur du jeton. Le nœud réel le lit par référence au nœud 6.

**Pourquoi cette branche ?** Une indisponibilité ne doit pas faire disparaître la demande. Le workflow va enregistrer une erreur technique sur le dossier réservé. Il ne fabrique aucune catégorie ni aucun brouillon.

Le nœud utilise un code générique : il ne recopie pas dans le dossier les détails du fournisseur, ses compteurs de tokens ou son corps brut d’erreur. Le diagnostic précis se fait dans l’exécution HTTP et le service. Le code `LLM_UNAVAILABLE` englobe donc plus de situations qu’une simple coupure réseau, notamment un appel refusé ou incomplet signalé par l’adaptateur.

## Sources et navigation

[Accueil du tutoriel dans Notion](https://app.notion.com/p/3eece9b72fb781898b1df8126e706fee) · [Générateur du workflow](https://github.com/nicolashedoire/n8n-docker/blob/main/scripts/build-workflows.mjs) · [Politique de qualification](https://github.com/nicolashedoire/n8n-docker/blob/main/demo/qualification-policy.mjs) · [Export JSON](https://github.com/nicolashedoire/n8n-docker/blob/main/workflows/02-qualification-ia.json)
