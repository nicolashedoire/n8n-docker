# Nœuds 15 à 25 — stockage, Sheets, erreurs et parcours

### Nœud 15 — Enregistrer le résultat

**Type :** HTTP Request. **URL :** `/requests/:id/result`. **Corps :** l’item complet `{{ $json }}`. **Timeout :** 15 secondes.

L’URL utilise l’identifiant de réservation encodé :

```js
'http://qualification-api:3000/requests/'
  + encodeURIComponent($('Réserver sans doublon').first().json.request_id)
  + '/result'
```

`encodeURIComponent` évite d’interpréter un identifiant comme une partie de chemin. Le serveur impose déjà un alphabet restreint, mais l’assemblage reste explicite.

Le serveur exige exactement une analyse **ou** une erreur. Il vérifie que le jeton correspond à la tentative courante. Pour une analyse, il refait `validateExtraction`, `applyQualificationRules` et `composeAnalysis` à partir du **message conservé dans SQLite**, puis compare le résultat à celui reçu de n8n. Un brouillon modifié arbitrairement ne passe pas cette comparaison.

Il valide aussi le contrat final : résumé non vide jusqu’à 2 000 caractères, brouillon non vide jusqu’à 5 000 caractères, au maximum 20 libellés de manque de 300 caractères chacun. Une erreur possède un code jusqu’à 100 caractères et un message jusqu’à 500.

Il détermine l’état :

- analyse avec un manque → `needs_info` ;
- analyse sans manque → `pending_review` ;
- erreur → `technical_error`.

La transaction écrit le résultat et un événement `result_stored`. L’extraction est conservée dans cet événement et exposée comme `record.extraction`. Les métriques identifient le fournisseur, le modèle et la méthode lorsqu’elles sont disponibles.

**Pourquoi revérifier côté serveur ?** Le nœud Code peut être modifié ou l’API appelée autrement. Une écriture durable ne doit pas dépendre uniquement de la bonne exécution de l’interface. Le calcul est indépendant de la requête reçue, mais utilise le même module de politique : il protège la cohérence sans être une seconde évaluation sémantique par un autre modèle.

Une répétition identique du résultat peut recevoir `route: duplicate`. Une modification d’un résultat déjà finalisé est refusée. Succès → nœud 17. Erreur ou absence de confirmation → nœud 16. Ce nœud n’a pas de reprises automatiques configurées.

### Nœud 16 — Persistance à vérifier

**Type :** Code. **Branche :** échec de l’écriture du résultat. **Fin de branche.**

La sortie contient :

```js
{
  ok: false,
  status: 'persistence_error',
  request_id: /* identifiant obtenu au nœud 6 */,
  message: 'Le résultat ne peut pas être confirmé. Consulter le service avant une nouvelle tentative.'
}
```

**Pourquoi ne pas dire « résultat perdu » ?** Une requête peut avoir été exécutée côté serveur, puis sa réponse perdue. Le bon diagnostic est « écriture non confirmée ». Le nœud ne part pas vers Sheets et ne prétend pas que le stockage a réussi. Il faut consulter le dossier et l’exécution.



![Préparer une ligne de suivi après avoir conservé le résultat](https://raw.githubusercontent.com/nicolashedoire/n8n-docker/main/docs/images/tutoriel/17-suivi.png)

### Nœud 17 — Préparer le suivi

**Type :** Code. **Entrée :** réponse de `/result`. **Sortie :** `{ record, row, sheets_enabled }` vers le nœud 18.

Le début récupère le dossier et accepte certaines enveloppes alternatives :

```js
const response = $input.first().json;
const record = response.record ?? response;
const input = record.input ?? record;
const analysis = record.analysis ?? {};
```

Le serveur actuel renvoie `record` avec les champs de contact directement à sa racine. Les `??` rendent le mapping tolérant à une enveloppe légèrement différente. Si le dossier est en erreur, `analysis` devient `{}` afin de produire des cellules vides plutôt qu’une exception.

Le nœud construit une ligne plate, car un tableau attend des colonnes, pas des objets imbriqués :

| Colonne Sheets | Source |
| --- | --- |
| `demande_id` | Identifiant du dossier ; repli vers la réservation |
| `date` | Date de création ; repli à l’heure courante si absente |
| `prenom`, `nom`, `email`, `demande` | Champs d’entrée conservés |
| `categorie`, `resume` | Champs de l’analyse, sinon chaînes vides |
| `informations_manquantes` | Liste jointe avec une barre verticale entourée d’espaces |
| `brouillon_reponse` | Brouillon, sinon chaîne vide |
| `statut` | État enregistré, sinon `unknown` |
| `erreur` | Code d’erreur, s’il existe |
| `modele` | Nom du modèle, s’il est disponible |

Extrait du mapping :

```js
informations_manquantes:
  (analysis.missing_information ?? []).join(' | '),
statut: record.status ?? 'unknown',
erreur: record.error?.code ?? ''
```

Le résultat complet `record` reste disponible à côté de `row`. **On ne remplace pas le dossier structuré par sa projection Sheets.** Le booléen `sheets_enabled` est inscrit lors de la génération du workflow ; ce nœud ne teste pas en direct les droits OAuth ni l’existence du document.

### Nœud 18 — Google Sheets configuré ?

**Type :** IF. **Condition :** `{{ $json.sheets_enabled }}` est vrai, avec type strict.

- Vrai → nœud 19.
- Faux → nœud 22.

Le booléen vaut vrai seulement si le générateur a reçu **à la fois** un identifiant de document et un identifiant de connexion n8n. Il indique « références fournies », pas « connexion vérifiée ». L’appel au nœud 19 vérifie l’accès effectif par son exécution.

**Pourquoi garder Sheets facultatif ?** Le résultat durable et la relecture ne doivent pas dépendre du tableur. La démonstration peut fonctionner avec SQLite et l’interface locale.

### Nœud 19 — Synchroniser Google Sheets

**Type :** Google Sheets natif, version 4.7. **Entrée :** `row`. **Opération :** `appendOrUpdate`.

Le nœud reçoit le document configuré, l’onglet `Qualification IA` par défaut et une connexion OAuth stockée dans n8n. Le mapping est défini explicitement pour les 13 colonnes ; par exemple, `resume` reçoit `{{ $json.row.resume }}`.

`matchingColumns: ['demande_id']` signifie que l’identifiant sert à retrouver la ligne à mettre à jour ; sinon une ligne est ajoutée. C’est un mécanisme de rapprochement dans Sheets, pas une transaction distribuée avec SQLite.

Réglages importants :

- `cellFormat: RAW` conserve les chaînes sans les interpréter comme des formules.
- `attemptToConvertTypes: false` et `convertFieldsToString: false` évitent des conversions supplémentaires du mapping.
- Trois tentatives totales, une seconde entre tentatives.
- Sortie normale vers le nœud 20 ; sortie d’erreur vers le nœud 21.
- Aucun timeout personnalisé n’est défini ici : ne pas lui attribuer les 120 secondes du nœud IA.

Dans l’export public, les références privées sont absentes et le nœud est **désactivé**. Le IF seul ne suffisait pas : n8n pouvait invalider l’ensemble du workflow à cause d’un document vide avant même de choisir la branche. Le générateur résout ce problème en désactivant aussi le nœud.

**Pourquoi après SQLite ?** Si Google est indisponible, le résultat métier existe déjà. L’erreur de synchronisation devient un état distinct. Les dossiers `technical_error` peuvent eux aussi être copiés dans Sheets pour leur suivi.

Google Sheets n’a pas été validé en réel dans la session de préparation décrite par les rapports. Sa présence dans le graphe ne constitue pas une preuve d’écriture réussie.

### Nœud 20 — Confirmer la synchronisation

**Type :** HTTP Request. **Entrée :** succès du nœud Sheets. **URL :** `/requests/:id/sink`. **Timeout :** 15 secondes.

Le corps contient le jeton de réservation et `status: synced`. Le nœud récupère l’identifiant et le jeton par référence au nœud 6 : il n’a pas besoin que Google Sheets les renvoie dans sa propre réponse.

Le serveur vérifie la tentative et exige qu’un résultat ait déjà été finalisé. Il enregistre `sink_status: synced` et un événement `sink_updated`.

Succès → nœud 24. Erreur → nœud 25. Aucune reprise automatique spécifique n’est configurée sur cet appel de confirmation.

**Pourquoi confirmer séparément ?** « Le résultat métier est stocké » et « la copie Sheets a été effectuée » sont deux faits différents. `synced` signifie que le nœud Sheets a réussi puis que cette confirmation a été stockée ; ce n’est pas une lecture indépendante des cellules.

### Nœud 21 — Signaler l’échec Sheets

**Type :** HTTP Request. **Entrée :** sortie d’erreur du nœud 19. **URL :** `/requests/:id/sink`. **Timeout :** 15 secondes.

Le corps est le même contrat que le nœud 20, mais avec `status: failed` et un message fixe : « Synchronisation Google Sheets impossible après les tentatives bornées. »

Succès de cette écriture → nœud 24. Échec de cette écriture → nœud 25.

**Pourquoi peut-on aller vers un nœud de fin après un échec Sheets ?** L’API a correctement enregistré que la synchronisation a échoué. Le dossier métier reste disponible, avec `sink_status: failed`. Un chemin correctement terminé n’implique pas que tous les services externes ont réussi.

Le message générique ne recopie pas la réponse brute Google. Le détail de la panne reste à consulter dans l’exécution du nœud Sheets.

### Nœud 22 — Conserver sans Google Sheets

**Type :** HTTP Request. **Entrée :** branche fausse du nœud 18. **URL :** `/requests/:id/sink`. **Timeout :** 15 secondes.

Il envoie le jeton courant et `status: skipped`. Aucune requête Google n’a lieu. Le serveur mémorise que la copie est volontairement absente dans cette configuration.

Succès → nœud 23. Erreur → nœud 25.

**Pourquoi écrire `skipped` ?** Sans ce statut, le lecteur pourrait confondre « pas configuré » et « en attente » ou « oublié ». La décision de ne pas synchroniser devient observable.

### Nœud 23 — Terminer sans Google Sheets

**Type :** Code. **Entrée :** confirmation de `/sink` avec `skipped`. **Fin de branche.**

```js
const response = $input.first().json;
return [{ json: {
  ok: true,
  record: response.record ?? response,
  sheets_sync: 'skipped',
  message: 'Résultat conservé dans le suivi local. Google Sheets non configuré.'
} }];
```

Le nœud renvoie le dossier et annonce l’absence de Sheets. `ok: true` confirme le traitement de cette branche et sa persistance, pas nécessairement la réussite de l’analyse. Le dossier peut être `technical_error` : il faut toujours lire `record.status`.

**Pourquoi ce format ?** Le client reçoit à la fois un message lisible et les données structurées nécessaires pour afficher le véritable état.

### Nœud 24 — Résultat prêt pour relecture

**Type :** Code. **Entrée :** confirmation enregistrée d’une synchronisation réussie ou échouée. **Fin de branche.**

Le code récupère `record`, renvoie `ok: true` et choisit son message selon l’état :

```js
record.status === 'technical_error'
  ? 'Erreur contenue et conservée : revue humaine nécessaire.'
  : 'Résultat conservé. La réponse reste un brouillon à relire.'
```

Le dossier contient toujours son statut de synchronisation séparé. Un résultat métier valide peut donc coexister avec `sink_status: failed`.

**Pourquoi distinguer le message ?** Une erreur technique stockée ne doit pas être présentée comme une qualification réussie. Le nœud ne réalise pas lui-même la relecture humaine et ne déclenche aucune approbation.

### Nœud 25 — Suivi de synchronisation à vérifier

**Type :** Code. **Entrée :** échec HTTP d’un des nœuds 20, 21 ou 22. **Fin de branche.**

Le code renvoie :

```js
{
  ok: false,
  status: 'sink_tracking_error',
  record: $('Préparer le suivi').first().json.record,
  message: 'Résultat conservé, mais état de synchronisation non confirmé. Consulter Google Sheets avant tout rejeu.'
}
```

Il récupère le dernier dossier dont la persistance est confirmée, avant les appels de suivi. Ce dossier peut donc refléter un état de synchronisation plus ancien que l’état réel.

**Pourquoi ne pas relancer immédiatement Sheets ?** L’écriture Google a peut-être réussi mais sa confirmation a été perdue. Une nouvelle action aveugle compliquerait le diagnostic. Examiner le dossier et, si la branche Sheets était configurée, la ligne concernée permet de réconcilier les deux états.

Le message fixe mentionne Google même si l’échec vient de l’enregistrement de `skipped`. Dans ce dernier cas, aucun appel Google n’a été tenté : c’est la confirmation locale qui doit être vérifiée.



## 6. Les cinq notes : ce qu’elles expliquent, sans exécuter de code

Les notes sont de type `stickyNote`, version 1. Elles servent à lire le graphe, n’ont ni entrée ni sortie de données et ne participent pas aux conditions.

| Note | Contenu utile | Pourquoi elle est placée là |
| --- | --- | --- |
| **01 · Entrées** | Formulaire ou webhook, normalisation, validation et réservation persistante ; rejeu sans nouvel appel IA | Donner le sens de la première zone avant d’ouvrir ses paramètres |
| **02 · Qualification** | Catégorie et six faits, preuve source limitée, règles métier, gabarits et recomposition côté serveur | Montrer précisément où s’arrête la responsabilité du modèle |
| **03 · Suivi humain** | Stocker avant Sheets ; distinguer `needs_info` et `technical_error` ; aucun envoi automatique | Lire les résultats et les limites d’action de la dernière zone |
| **Configuration Google Sheets** | Export public sans références privées, variables de génération locale, colonnes, rapprochement par `demande_id`, RAW | Expliquer une branche désactivée sans faire croire qu’elle est cassée |
| **Scénarios contrôlés** | Formulaire en mode normal ; pannes `api_error` et `invalid_json` injectées via webhook | Éviter de présenter une panne de test comme une panne réelle d’OpenAI |

Les couleurs, tailles et positions n’ont aucun effet métier. Une note n’est pas une protection : seule la configuration et le code des nœuds produisent le comportement décrit.

## 7. Quatre parcours à suivre avec des données fictives

### A. Camille : demande complète

Utiliser un nouvel identifiant, par exemple `tuto_camille_001`, et le message complet présenté au début du guide. Les faits attendus comprennent le besoin de qualification vers Sheets, le budget `4 000 €` et l’échéance `avant le 15 novembre 2026`.

Une extraction valide peut prendre cette forme :

```json
{
  "category": "devis",
  "facts": {
    "need": "Bonjour, nous souhaitons automatiser la qualification de nos demandes commerciales et leur enregistrement dans Google Sheets.",
    "budget": "4 000 €",
    "deadline": "avant le 15 novembre 2026",
    "availability": "",
    "product": "",
    "problem": ""
  }
}
```

L’extrait de besoin peut varier tout en restant conforme. Le modèle ne doit pas reprendre un exemple de son prompt à la place du message de Camille.

Parcours sans Sheets : **2 → 3 → 4 vrai → 6 → 7 vrai → 10 → 11 → 12 → 13 → 15 → 17 → 18 faux → 22 → 23**.

À observer : `missing_fields: []`, puis `missing_information: []`, un accusé de réception sans question, `status: pending_review`, `sink_status: skipped` et les métriques OpenAI du nouveau dossier. « À relire » signifie que le brouillon attend une personne, pas qu’un devis a été accepté ou envoyé.

### B. Une demande incomplète

Message fictif : « Bonjour, je demande un devis pour extraire les montants de nos factures PDF vers Google Sheets. Livraison souhaitée sous six semaines. » Utiliser un autre identifiant.

Les faits attendus sont le besoin et l’échéance ; `budget` doit rester vide. Les règles calculent uniquement `missing_fields: ["budget"]`. Le brouillon pose la question du budget et ne redemande ni le périmètre ni la date.

Le parcours est identique à Camille. La différence est dans les données : `status: needs_info`, `missing_information: ["Le budget disponible"]`. Une demande incomplète est un résultat métier normal, pas une exception technique.

Sur le message plus vague « Bonjour, je voudrais automatiser mon entreprise avec de l’IA. Pouvez-vous me faire un devis ? », les attentes sont trois manques : besoin concret, budget et échéance. Le modèle doit laisser les faits incertains vides ; les règles explicites complètent ce contrôle sur certaines expressions génériques connues.

### C. Une erreur, en distinguant HTTP et contenu

**Simulation `api_error` :** `/llm` répond volontairement HTTP 503. Le nœud 10 tente au maximum trois appels avec deux pauses d’une seconde. Aucun fournisseur réel n’est appelé pour cette injection. Après l’échec, le parcours rejoint **14 → 15** et conserve `LLM_UNAVAILABLE` avec `status: technical_error`. Le suivi continue pour signaler l’issue Sheets.

**Simulation `invalid_json` :** `/llm` répond HTTP 200 avec une propriété `text` volontairement incomplète, du type `{"category":"devis","facts":`. L’enveloppe HTTP est valide ; il n’y a pas de reprise HTTP pour cette erreur de contenu. `JSON.parse` échoue au nœud 11, qui produit `INVALID_LLM_OUTPUT`. Les nœuds 12 et 13 transportent cette erreur sans calculer d’analyse ; le nœud 15 la stocke.

**Entrée invalide :** un email mal formé suit **3 → 4 faux → 5**. Ni réservation ni inférence n’ont lieu. C’est encore une autre catégorie d’échec.

En mode réel, l’adaptateur peut lui-même détecter une réponse OpenAI invalide ou incomplète et répondre en erreur HTTP ; ce cas passe alors par la branche du nœud 14. L’injection `invalid_json` existe précisément pour tester la validation n8n avec une enveloppe HTTP réussie.

### D. Renvoyer Camille : doublon, conflit et reprise

Renvoyer **le même identifiant et exactement le même contenu**, scénario compris. Le nœud 6 renvoie `duplicate`. Le parcours s’arrête via **7 faux → 8**. Aucun nouvel appel IA ni nouvelle synchronisation Sheets n’est lancé. Les anciennes métriques du dossier sont conservées.

Changer le budget en gardant cet identifiant provoque un conflit : **6 erreur → 9**. Cette nouvelle demande ne peut pas remplacer silencieusement la précédente.

Après une erreur technique finalisée, réutiliser l’identifiant retrouve cette erreur. Pour évaluer une correction, créer explicitement un nouvel identifiant. Après une interruption restée `processing`, un renvoi du même contenu peut reprendre le dossier lorsque le bail de dix minutes est expiré. L’expiration seule ne lance aucun travail.

## 8. Délais, reprises et bail : trois mécanismes différents

| Mécanisme | Valeur du projet | Ce qu’il borne |
| --- | --- | --- |
| Timeout de l’adaptateur IA | 60 s par défaut | Un appel du service vers le fournisseur |
| Timeout du nœud 10 | 120 s par tentative | Un appel n8n vers `/llm` |
| Tentatives du nœud 10 | 3 au total, attente de 1 s entre tentatives | Les reprises HTTP, pas la correction sémantique du modèle |
| Autres HTTP du workflow | 15 s chacun, sans reprise automatique configurée | Réservation, résultat et suivi de synchronisation |
| Tentatives Google Sheets | 3 au total, attente de 1 s | L’opération Sheets si elle est activée |
| Attente de `/submit` | 390 s | La requête du tableau vers le webhook |
| Bail SQLite | 600 s, soit 10 min | La possibilité de reprendre une demande restée `processing` |

Le timeout limite une attente réseau ; une reprise recommence une requête ; le bail définit quand une tentative abandonnée peut être remplacée. Ces mécanismes ne sont pas interchangeables.

Un appel réussi dont la réponse est perdue peut être exécuté de nouveau. La réservation empêche un doublon métier par le chemin prévu, mais le système ne garantit pas une seule facturation du modèle dans toutes les pannes. Une attente expirée dans le tableau peut coexister avec un workflow encore en cours : inspecter le dossier avant de multiplier les demandes.

Le bail n’est pas un verrou effacé automatiquement à la dixième minute. Après son expiration, une nouvelle réservation du même dossier `processing` peut remplacer le jeton ; l’ancien jeton est alors rejeté lors d’une écriture. Il n’y a ni ordonnanceur de reprise ni file durable dans ce prototype.



![Résultat réel du cas Camille : faits et brouillon présentés à la relecture](https://raw.githubusercontent.com/nicolashedoire/n8n-docker/main/docs/images/resultat-camille-openai.png)

## 9. La relecture humaine se trouve hors des 25 nœuds

Le dernier nœud fournit un résultat ; il ne contient pas de nœud d’attente humaine. La personne relit le dossier dans le tableau local. Les boutons appellent `/requests/:id/approve` ou `/reject` sur le service.

Le service vérifie l’origine de la requête, la session locale et le jeton CSRF. Seuls les états `pending_review` et `needs_info` peuvent passer à `approved` ou `rejected`. La décision est journalisée avec un acteur local générique ; aucun email n’est envoyé. Ces protections ne constituent pas une authentification métier multi-utilisateur.

Approuver un brouillon qui demande un budget ne fournit pas ce budget : cela approuve son texte. Le prototype ne permet pas encore d’éditer le brouillon ou de rouvrir la décision.

La décision modifie SQLite et l’interface. La ligne Sheets éventuelle reste une photographie du résultat avant cette décision. Il n’y a pas de propagation automatique de l’approbation vers Sheets ni de bouton de resynchronisation.

## 10. Comprendre le générateur sans confondre génération et exécution

Le fichier `scripts/build-workflows.mjs` crée le JSON public. Il s’exécute sur le poste lors de la préparation du workflow ; il n’est pas un nœud lancé pour chaque demande.

| Élément du générateur | Rôle |
| --- | --- |
| `add(...)` | Construire un nœud avec nom, type, version, position et paramètres |
| `code(...)` | Créer un Code node version 2 contenant `jsCode` |
| `http(...)` | Standardiser les POST JSON, timeout 15 s et sortie d’erreur ; le nœud IA surcharge son timeout |
| `condition(...)` | Construire les IF avec comparaison et validation de type strictes |
| `connect(from, to, output)` | Construire les connexions ; sortie 0 normale/vraie, sortie 1 erreur/fausse selon le type |
| `note(...)` | Ajouter une annotation visuelle |
| `id(name)` | Dériver un identifiant de nœud stable depuis son nom avec SHA-256 |

Les fonctions pures de `demo/qualification-policy.mjs` sont importées et converties en texte avec `.toString()`. Leur code est intégré aux trois nœuds correspondants. Elles sont écrites pour ne dépendre ni d’un paquet externe ni d’une variable cachée. Le serveur importe ce même module pour recomposer les résultats.

Le workflow conserve l’identifiant `atelierQualificationIA01`. L’export a `active: false`, `pinData: {}`, un ordre d’exécution `v1`, le fuseau Europe/Paris et la sauvegarde des exécutions manuelles. L’export ne contient donc pas de données épinglées de démonstration. La publication est une étape d’installation distincte ; `active: false` dans le fichier ne signifie pas que l’instance locale installée est actuellement arrêtée.

Sans `--local`, le générateur ignore les références privées de l’environnement et écrit `workflows/02-qualification-ia.json`. Avec `--local`, il lit les références de document et de connexion Sheets, exige qu’elles soient fournies ensemble et écrit dans `local-files`, ignoré par Git. Le nom d’onglet est configurable. Il ne crée ni document Google ni autorisation OAuth.

Une modification durable du workflow doit être reportée dans le générateur ou le module de politique avant régénération. Une édition seulement dans l’éditeur n8n peut être écrasée par un réimport futur.

## 11. Comment vérifier sa compréhension dans l’éditeur

Sur une exécution datée avec données fictives, suivre les données plutôt que réciter les noms :

1. Au nœud 3, comparer le message entrant et `input` ; expliquer pourquoi `body` a disparu.
2. Au nœud 6, lire `route` et `record.status` ; expliquer pourquoi le modèle peut être évité.
3. Au nœud 10, distinguer l’appel au service local de l’appel fournisseur ; lire `text` et les métriques.
4. Au nœud 11, développer `extraction.facts` et rapprocher les extraits du message.
5. Au nœud 12, comparer `required_fields` et `missing_fields`.
6. Au nœud 13, vérifier que chaque question correspond à un manque, puis lire le brouillon comme son destinataire.
7. Au nœud 15, vérifier l’état enregistré ; l’absence de manque donne « à relire », jamais « envoyé ».
8. Au nœud 18, expliquer la configuration Sheets ; au dernier nœud, lire aussi `sink_status` et `record.status`, pas seulement `ok`.

Garder les détails internes de tentative repliés pendant une présentation. Le tableau de revue est utile pour le besoin métier ; les nœuds montrent la provenance et les contrôles. Le volet « Demande originale et journal » expose également l’extraction dans l’événement d’enregistrement.

## 12. Ce qui a été vérifié et ce qui reste une limite

La mesure réelle du 3 octobre 2026 avec OpenAI / `gpt-5.6-terra` a réussi **9/9 cas de qualité** et **7/7 contrôles de parcours**, avec les mêmes scripts et attentes que la mesure Ollama / `qwen2.5:3b` à **5/9 en qualité**. Le corpus qualité OpenAI a pris environ 1,5 à 4,1 secondes par cas lors de ce passage. Les rapports des deux fournisseurs conservent séparément leurs résultats ; les erreurs Ollama n’ont pas été effacées.

Cette mesure porte sur neuf messages fictifs, exécutés une fois chacun pour cette comparaison. Elle ne démontre pas une fiabilité générale ni la stabilité de tous les appels futurs. Le respect du schéma, la présence textuelle d’une citation et la qualité métier sont trois contrôles distincts.

Google Sheets était désactivé dans ces essais. Aucun envoi d’email, agent autonome, RAG ou déploiement client n’est implémenté ou revendiqué. Le prototype n’a pas de haute disponibilité, file de reprise durable, authentification multi-utilisateur ou politique complète de conservation. Ces limites n’empêchent pas d’expliquer précisément ce qui fonctionne et les travaux requis pour un autre contexte.

## Sources du tutoriel

Lecture directe du dépôt `n8n-docker` :

- `scripts/build-workflows.mjs` : nœuds, paramètres et connexions ;
- `workflows/02-qualification-ia.json` : export public, 30 nœuds et configuration effective du fichier ;
- `demo/qualification-policy.mjs` : validation de provenance, règles et gabarits ;
- `demo/server.mjs` : contrats API, transactions, bail, statuts et contrôle des décisions ;
- `demo/llm-provider.mjs` : appel OpenAI/Ollama, enveloppes, délais et erreurs ;
- `demo/public/index.html` : exemples du tableau et présentation des dossiers ;
- `scripts/test-quality.mjs` : messages fictifs et critères préétablis ;
- `docs/EXPLOITATION.md`, `docs/QUALITE.md` et les rapports `quality-2026-10-03*.json` : procédures, portée et résultats observés.

Ce tutoriel est une lecture du code. Sa rédaction n’a lancé aucune inférence, aucun workflow, aucun appel API et aucune modification de configuration.

## Sources et navigation

[Accueil du tutoriel dans Notion](https://app.notion.com/p/3eece9b72fb781898b1df8126e706fee) · [Générateur du workflow](https://github.com/nicolashedoire/n8n-docker/blob/main/scripts/build-workflows.mjs) · [Politique de qualification](https://github.com/nicolashedoire/n8n-docker/blob/main/demo/qualification-policy.mjs) · [Export JSON](https://github.com/nicolashedoire/n8n-docker/blob/main/workflows/02-qualification-ia.json)
