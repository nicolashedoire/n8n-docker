# Comprendre le code du scénario salle de bains

Ce complément suit le code de `build-workflow.mjs`, `server.mjs` et `quantities.mjs`. Les petits extraits ci-dessous illustrent le mécanisme ; le dépôt contient les fonctions complètes et leurs contrôles.

## 1. Le message entre dans n8n

Le Chat Trigger produit notamment `chatInput` et `sessionId`. Le nœud Agent utilise automatiquement le message, et la mémoire utilise `={{ $json.sessionId }}` comme clé. Deux conversations possédant des identifiants différents ne partagent donc pas volontairement le même historique. La mémoire reste locale au processus et ne constitue pas un dossier persistant.

## 2. Le modèle prépare les paramètres des outils

Les expressions `$fromAI(...)` décrivent les paramètres que le modèle doit renseigner. Pour le calculateur, le champ `calculation` contient un objet JSON. Pour le premier message, longueur et largeur sont connues ; hauteur et marge ne le sont pas.

```javascript
$fromAI("calculation", "Objet JSON du calcul…", "json")
```

Cette expression donne au modèle un contrat d'appel. Elle ne valide pas à elle seule le métier. Le serveur vérifie ensuite les valeurs reçues. Les identifiants de produits proviennent des règles et de la recherche : l'utilisateur n'a pas à les connaître.

## 3. Le serveur distingue une information d'une hypothèse

`estimate` reconnaît `project_type: "bathroom"` et appelle `estimateBathroom`. La fonction accepte seulement les champs prévus. Elle refuse par exemple une surface fournie à la place des dimensions : le modèle ne doit pas calculer la géométrie en amont.

Le mécanisme `parameter` choisit une valeur fournie ou un défaut, puis en conserve l'origine :

```javascript
const provided = input[field] !== undefined
  && input[field] !== null && input[field] !== '';
effective[field] = provided ? input[field] : fallback;
assumptionOrigins.push({
  field, value: effective[field],
  origin: provided ? 'provided' : 'default'
});
```

La hauteur 2,50 m et la marge 10 % restent ainsi des propositions. `provided` signifie « transmis au calculateur », pas « vérité vérifiée sur place ». Les produits sélectionnés par l'agent sont également transmis : cela ne veut pas dire que le client les a personnellement choisis.

## 4. Le code construit les quatre murs

```javascript
const floorArea = input.length_m * input.width_m;
const wallLengths = [input.length_m, input.width_m,
  input.length_m, input.width_m];
const perimeter = 2 * (input.length_m + input.width_m);
```

Avec 4 × 3 m : le sol fait 12 m² ; les pans sont `[4, 3, 4, 3]` ; le périmètre fait 14 m ; à 2,50 m de hauteur, la surface des murs vaut 35 m². Une seule face visible est comptée pour chaque mur doublé. Une cloison indépendante aurait deux faces : ce serait un autre projet.

Les ouvertures réellement transmises sont contrôlées par pan, puis leur surface est soustraite. Sans mesure de porte, fenêtre ou receveur, aucune dimension n'est inventée. La surface est conservée brute, à affiner.

## 5. Le calcul utilise les conditionnements achetables

Le coefficient de marge vaut `1 + 10 / 100`, soit 1,10. La fonction `ceil` arrondit au supérieur, avec une très petite tolérance pour éviter qu'une erreur de représentation décimale ajoute une unité à une valeur déjà entière.

| Poste | Calcul de l'exemple | Pourquoi |
| --- | --- | --- |
| Carrelage | `ceil(12 × 1,10 / 1,08) = 13` cartons | Un carton couvre 1,08 m² ; on achète des cartons entiers, soit 14,04 m². |
| Plaques | Surface : `ceil(35 × 1,10 / 1,50) = 26` ; minimum par largeur des pans : 24 ; retenir 26 | On conserve le maximum entre le besoin surfacique et le minimum géométrique par pan, sans supposer un réemploi parfait des chutes. |
| Rails | Par pan, haut + bas : `2 × ceil(longueur / 3)` ; total 12 avant marge ; `ceil(12 × 1,10) = 14` | Les rails sont comptés pour chaque mur. Ce calcul est une provision, pas une optimisation des coupes. |
| Montants | Chaque pan : `(ceil(longueur / 0,60) + 1) × 2` ; `[16,12,16,12]`, soit 56 ; `ceil(56 × 1,10) = 62` | Le gabarit de doublage retenu utilise des montants doublés. Les profils de rive sont comptés par pan. |
| Isolation | `ceil(35 × 1,10 / 9,36) = 5` lots | Chaque lot contient 13 panneaux ; 5 lots couvrent 46,80 m². Une cavité n'est pas comptée deux fois. |

Ces formules ne constituent ni un plan de pose, ni une validation mécanique. Les découpes, angles, fixations et détails d'ouvertures demandent une vérification de chantier.

## 6. Les prix sont additionnés en centimes

La ligne d'achat associe un nombre de paquets au prix daté du paquet, à son fournisseur et à sa source. Les sous-totaux sont calculés en centimes entiers pour éviter les artefacts d'addition décimale. Le total des cinq lignes de cet exemple est 1 316,41 €.

Le rail est proposé au prix conseillé affiché dans le relevé. Cette nuance reste présente dans `price_per_pack.basis` et `notice`. Un prix manquant n'est jamais remplacé par zéro.

## 7. Un lot impossible à chiffrer n'efface pas les autres

Le programme calcule séparément `components.floor` et `components.walls`. Si la hauteur devient 2,70 m, le système de murs actuellement documenté ne convient plus. Le sol reste chiffrable.

```javascript
if (!fullScope) {
  total.total_eur = null;
  total.pricing_status = 'scope_partial';
}
```

La réponse indique alors `partial`, le sous-total connu du sol (153,01 €), la surface brute des murs (37,80 m²) et le motif du lot non chiffré. Le programme évite ainsi de présenter 153,01 € comme le prix de tous les matériaux de la pièce.

Le mode salle de bains couvre un approvisionnement provisoire des matériaux de base. Ses sous-calculs réutilisent les fonctions de métré ; cela ne classe pas toute la salle de bains comme étant hors projections. L'exposition réelle et les postes de douche restent consignés au niveau de la pièce, sans validation de protection à l'eau ni prescription de carrelage dans le receveur.

## 8. L'agent explique le résultat et propose la suite

Le modèle lit le résultat structuré et rédige le tableau. C'est aussi lui qui pose une courte question pour corriger une hypothèse. Lorsqu'une donnée change, il appelle de nouveau le calculateur : la mémoire ne remplace jamais ce recalcul.

Les paramètres, résultats et étapes intermédiaires sont visibles dans les journaux n8n. Ils permettent de distinguer une erreur de compréhension du modèle, une règle métier qui refuse un cas, un problème de données fournisseur et une panne réseau. Les tests de conversation vérifient ces appels réels ; les tests de code vérifient les calculs indépendamment du modèle.

À dire en entretien : « J'ai séparé la conversation et les opérations vérifiables. L'agent organise le travail ; les outils portent les sources, les contrôles et les calculs. »

## 9. Répondre même lorsque le modèle échoue

Le nœud `Expliquer l’incident` exécute [incident-response.js](../incident-response.js) dans le contexte Code de n8n. Ce fichier contient un `return` au niveau du corps du nœud : il est chargé comme code n8n, pas exécuté comme programme Node autonome. Les tests le compilent avec ses paramètres `$input` et `$execution`.

Le code lit l'erreur reçue, la classe dans quelques catégories connues, puis construit une phrase prédéfinie. Il ne copie jamais le diagnostic brut dans le chat. Cela évite d'afficher par accident une clé, une pile d'appels ou des détails de requête. Si une formulation inconnue arrive, il utilise la catégorie générique `SERVICE_UNAVAILABLE`.

`retryable` indique si l'utilisateur peut raisonnablement retenter ou s'il faut d'abord vérifier le compte. Une référence `chantier-<identifiant d’exécution>` relie le message aux journaux locaux. `status: technical_error` permet de distinguer une panne traitée d'une estimation réussie, même si n8n termine proprement le workflow.

Cette réponse ne dépend pas du modèle en panne. La politique de reprise et les essais réels de ce branchement sont documentés dans [EXPLOITATION.md](EXPLOITATION.md).
