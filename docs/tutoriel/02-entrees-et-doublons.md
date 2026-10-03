# Nœuds 1 à 9 — entrées, validation et doublons

## 5. Les 25 nœuds, expliqués un à un



![Formulaire : quatre champs métier et un accusé de réception](https://raw.githubusercontent.com/nicolashedoire/n8n-docker/main/docs/images/tutoriel/01-formulaire.png)

### Nœud 1 — Formulaire de contact

**Type :** Form Trigger, version 2.6. **Entrée :** saisie d’une personne. **Sortie :** champs du formulaire vers le nœud 3.

Le formulaire possède quatre champs obligatoires : `first_name`, `last_name`, `email`, `message`. Les libellés affichés sont Prénom, Nom, E-mail et Votre demande. Le champ email bénéficie d’un contrôle de saisie du navigateur, complété ensuite par la validation du workflow et du serveur.

Réglages importants :

- `authentication: none` : pas d’authentification sur ce formulaire de démonstration. Le contexte prévu est local.
- `options.path: atelier-qualification-form` : chemin du formulaire publié, soit `http://localhost:5678/form/atelier-qualification-form` sur l’installation fournie.
- `responseMode: onReceived` : la personne reçoit immédiatement un accusé de réception.
- Aucun champ scénario ni identifiant n’est exposé : le scénario deviendra `normal`, et le service dérivera un identifiant du contenu.

**Pourquoi ce choix ?** L’entrée métier reste simple. Une personne n’a pas à comprendre les paramètres de test ou l’API. L’accusé de réception signifie seulement « demande reçue » ; il ne prouve ni la réussite du modèle ni l’écriture Sheets. Le résultat doit être consulté dans le tableau ou l’exécution n8n.

Le chemin est rangé dans `options.path` pour cette version du nœud. Le mettre dans un autre champ du JSON ne configure pas nécessairement le formulaire. Le chemin du formulaire est différent de celui du webhook.

### Nœud 2 — Webhook de démonstration

**Type :** Webhook, version 2.1. **Entrée :** requête HTTP JSON. **Sortie :** corps de la requête et métadonnées n8n vers le nœud 3.

Il écoute `POST /webhook/atelier-qualification` après publication. Le tableau local appelle d’abord `/submit` sur le service, qui transmet ensuite la demande à ce webhook.

Les réglages `responseMode: lastNode` et `responseData: firstEntryJson` signifient : attendre le dernier nœud de la branche exécutée, puis renvoyer son premier item JSON. Ce webhook attend donc le résultat, contrairement au formulaire.

**Pourquoi deux entrées ?** Le formulaire démontre un parcours utilisateur natif n8n ; le webhook permet au tableau et aux scripts de tests d’utiliser le même traitement. Les deux entrées rejoignent la même normalisation pour éviter deux logiques métier divergentes.

Le workflow n’ajoute pas ici d’authentification au webhook. Les ports publiés sont locaux ; exposer cette route publiquement demanderait un autre dispositif. Le mode `lastNode` ne transforme pas automatiquement chaque statut métier en code HTTP distinct : le corps final contient aussi `ok`, `status` ou `record.status`, qu’il faut lire.



![Code de normalisation dans l’éditeur, sans données d’exécution](https://raw.githubusercontent.com/nicolashedoire/n8n-docker/main/docs/images/tutoriel/03-normaliser.png)

### Nœud 3 — Normaliser la demande

**Type :** Code. **Entrée :** résultat du formulaire ou du webhook. **Sortie :** `{ valid, input, issues }` vers le nœud 4.

Première partie : retrouver les champs utiles.

```js
const raw = $input.first().json;
const source = raw.body && typeof raw.body === 'object'
  && !Array.isArray(raw.body) ? raw.body : raw;
const text = value => typeof value === 'string' ? value.trim() : '';
```

Le webhook place habituellement les données dans `body`, tandis que le formulaire fournit directement ses champs. La condition choisit le bon objet. `text` enlève les espaces autour d’un texte ; une valeur de mauvais type devient une chaîne vide et sera rejetée si elle est obligatoire.

Deuxième partie : construire un contrat unique. Exemple réel du mapping :

```js
first_name: text(source.first_name ?? source['Prénom'] ?? source.Name),
email: text(source.email ?? source['E-mail'] ?? source.Email).toLowerCase(),
scenario: text(source.scenario) || 'normal'
```

Les noms de champs anglais actuels et certains anciens libellés sont acceptés. L’email est mis en minuscules ; le message conserve sa casse et son contenu, hormis les espaces périphériques. Seuls les champs prévus sont recopiés dans `input`. Un champ entrant tel que `approved: true` n’entre pas dans ce contrat.

Troisième partie : ajouter `request_id` seulement s’il est renseigné, puis accumuler des erreurs dans `issues`.

| Champ | Contrôle dans ce nœud |
| --- | --- |
| Prénom, nom | Non vides, 100 caractères maximum chacun |
| Email | Forme simple `texte@domaine.extension`, 254 caractères maximum |
| Message | Non vide, 10 000 caractères maximum |
| Scénario | Exactement `normal`, `api_error` ou `invalid_json` |

Enfin :

```js
return [{ json: { valid: issues.length === 0, input, issues } }];
```

`valid` est un booléen. `input` contient les données harmonisées. `issues` fournit les raisons d’un refus. Le contrôle d’email vérifie une forme, pas l’existence de la boîte. Le format et la longueur de `request_id` seront contrôlés par le serveur, pas par ce nœud.

**Pourquoi ici ?** Rejeter tôt une saisie incorrecte évite une réservation et un appel IA inutile. La normalisation rend les branches suivantes indépendantes du canal d’entrée.

### Nœud 4 — Entrée valide ?

**Type :** IF, version 2.2. **Entrée :** résultat du nœud 3. **Condition :** `{{ $json.valid }}` est vrai, avec validation de type stricte.

- Sortie vraie → **6 — Réserver sans doublon**.
- Sortie fausse → **5 — Entrée à corriger**.

**Pourquoi un booléen strict ?** Le code précédent calcule explicitement `true` ou `false`. On évite de traiter une chaîne comme `"false"` comme une valeur ambiguë. Ce nœud ne refait pas les contrôles ; il utilise leur résultat.

### Nœud 5 — Entrée à corriger

**Type :** Code. **Branche :** entrée invalide. **Fin de branche.**

```js
return [{ json: {
  ok: false,
  status: 'invalid_input',
  issues: $input.first().json.issues
} }];
```

Le nœud conserve la liste des erreurs et ajoute un contrat simple pour le demandeur. Il n’écrit pas de dossier et ne contacte pas le modèle. Par exemple, un email sans `@` produit une erreur de saisie, pas une demande classée `autre` par l’IA.

**Pourquoi une sortie explicite ?** Le tableau ou un client API peut distinguer une saisie à corriger d’une panne d’infrastructure. Pour l’entrée formulaire, l’accusé de réception a déjà été envoyé ; cette sortie se voit surtout dans l’exécution n8n.



![Réservation : le workflow appelle le service local](https://raw.githubusercontent.com/nicolashedoire/n8n-docker/main/docs/images/tutoriel/06-reserver.png)

### Nœud 6 — Réserver sans doublon

**Type :** HTTP Request, version 4.4. **Méthode :** POST. **URL :** `http://qualification-api:3000/requests/reserve`. **Corps :** `{{ $json.input }}`. **Timeout :** 15 secondes.

Le serveur valide à nouveau les données, même si n8n les a contrôlées. Il limite aussi le corps à 64 Kio et impose à `request_id` au maximum 100 caractères, composés de lettres, chiffres, tirets et underscores.

Dans une transaction SQLite `BEGIN IMMEDIATE`, il choisit l’une des issues suivantes :

| Situation | Réponse et effet |
| --- | --- |
| Nouvel identifiant | Créer un dossier `processing`, réserver dix minutes, renvoyer `route: process` |
| Même identifiant, même contenu, résultat final | Renvoyer `route: duplicate` et le dossier existant |
| Même identifiant, même contenu, traitement encore réservé | Renvoyer aussi `duplicate`, avec le dossier encore `processing` |
| Même identifiant, contenu différent | Refuser avec un conflit HTTP 409 ; l’ancien dossier est conservé |
| Ancien dossier encore `processing`, bail expiré | Créer un nouveau jeton de tentative, prolonger le bail, renvoyer `process` |

Si l’identifiant est absent, le serveur calcule un SHA-256 du contenu normalisé et construit `req_` suivi d’une partie de cette empreinte. Cela rend un renvoi du formulaire reconnaissable. En contrepartie, deux demandes exactement identiques sont considérées comme le même événement.

Une réservation `process` renvoie `request_id`, `attempt_token` et `record`. Le jeton de tentative autorise les écritures de cette tentative ; il n’est pas une clé OpenAI. Il doit rester interne au traitement. Les dossiers publics renvoyés par l’API ne contiennent pas ce jeton.

**Pourquoi réserver avant l’IA ?** Deux soumissions concurrentes du même événement ne doivent pas déclencher deux qualifications par le chemin normal. La transaction rend le choix atomique. Un simple IF « existe déjà ? » suivi plus tard d’un INSERT aurait une fenêtre où deux exécutions pourraient toutes deux conclure que la demande est nouvelle.

Succès HTTP → nœud 7. Erreur HTTP ou réseau → nœud 9. Aucune reprise automatique n’est configurée sur ce nœud HTTP.

### Nœud 7 — Nouvelle tentative ?

**Type :** IF. **Condition :** `{{ $json.route }}` est exactement égal à `process`.

- Vrai → **10 — Extraire les faits avec IA**.
- Faux → **8 — Résultat déjà disponible**.

**Pourquoi ce branchement ?** La base a déjà décidé s’il faut travailler. Le workflow respecte cette décision avant toute inférence. Le nom « nouvelle tentative » inclut une première demande et la reprise explicite d’une réservation abandonnée après expiration du bail.

Le service garantit actuellement seulement les valeurs `process` et `duplicate` en réponse réussie. Le IF n’est pas un validateur exhaustif d’une éventuelle nouvelle version de l’API ; si ce contrat évolue, son branchement doit être adapté.

### Nœud 8 — Résultat déjà disponible

**Type :** Code. **Branche :** doublon. **Fin de branche.**

```js
const response = $input.first().json;
return [{ json: {
  ok: true,
  route: 'duplicate',
  request_id: response.request_id,
  record: response.record,
  message: 'Demande déjà reçue : résultat existant, sans nouvel appel IA.'
} }];
```

Le code ne modifie pas le dossier. Il rend l’absence de nouveau travail visible avec `route: duplicate`. Il n’appelle ni le modèle ni Google Sheets.

**Nuance :** le nom du nœud peut évoquer un résultat terminé, mais le serveur peut aussi renvoyer un dossier `processing` dont le bail est toujours actif. Il faut lire `record.status`. Un doublon d’un dossier `technical_error` reste cette erreur ; ce n’est pas une nouvelle tentative IA automatique.

### Nœud 9 — Réservation refusée

**Type :** Code. **Branche :** erreur du nœud 6. **Fin de branche.**

Le code renvoie un objet fixe :

```js
{ ok: false, status: 'reservation_error', message: '…' }
```

Le message invite à vérifier les données et le service et précise qu’aucune qualification n’a été lancée. Le nœud remplace les détails bruts de l’erreur par un résultat lisible ; il ne différencie pas, dans cette sortie finale, un conflit d’identifiant d’une panne réseau. Le détail initial reste à examiner dans l’exécution HTTP.

**Pourquoi s’arrêter ?** Sans réservation confirmée, le workflow n’a pas de tentative autorisée pour stocker son résultat. Si une réponse réseau a été perdue, le dossier peut néanmoins avoir été réservé côté serveur ; il faut l’inspecter avant de supposer que rien n’a été écrit.

## Sources et navigation

[Accueil du tutoriel dans Notion](https://app.notion.com/p/3eece9b72fb781898b1df8126e706fee) · [Générateur du workflow](https://github.com/nicolashedoire/n8n-docker/blob/main/scripts/build-workflows.mjs) · [Politique de qualification](https://github.com/nicolashedoire/n8n-docker/blob/main/demo/qualification-policy.mjs) · [Export JSON](https://github.com/nicolashedoire/n8n-docker/blob/main/workflows/02-qualification-ia.json)
