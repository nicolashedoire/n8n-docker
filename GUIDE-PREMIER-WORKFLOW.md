# Ton premier workflow n8n

Objectif : cliquer sur un bouton et produire un message personnalisé. Aucun abonnement, identifiant de service externe ou accès réseau n'est requis pour exécuter cet exemple.

```text
Déclenchement manuel → Mes informations → Mon message
```

Un **nœud** est une étape. Les **connexions** transmettent les données entre les étapes. Les données circulent sous forme d'éléments (*items*) contenant du JSON. Une **expression** calcule une valeur à partir des données reçues.

## 1. Ouvrir n8n

Double-clique sur `Demarrer.command`, puis termine la création du compte propriétaire si n8n la demande. Ouvre un nouveau workflow dans l'éditeur. Les libellés peuvent être en anglais selon la version de l'interface.

## 2. Essayer l'exemple fourni (2 minutes)

1. Dans le menu `…` du workflow, choisis **Import from File**.
2. Sélectionne `workflows/01-bonjour.json` dans ce dossier.
3. Trois nœuds apparaissent. Le workflow s'appelle **Mon premier workflow — Bonjour**.
4. Enregistre avec **Save** si nécessaire (certaines versions enregistrent automatiquement).
5. Clique sur **Execute Workflow**.
6. Ouvre le dernier nœud **Mon message**, puis son onglet de sortie **Output / JSON**.

Résultat attendu :

```json
{
  "message": "Bonjour Nicolas ! Mon premier workflow n8n fonctionne.",
  "statut": "Réussi"
}
```

Ouvre **Mes informations**, remplace `Nicolas` par un autre prénom, puis exécute de nouveau le workflow pour voir le résultat changer.

## 3. Le recréer toi-même (5 à 10 minutes)

### A. Ajouter le départ

Crée un nouveau workflow, nomme-le **Mon test personnel**, puis ajoute **Manual Trigger** (parfois proposé comme **Trigger manually** ou **When clicking Execute Workflow**). Il lance le workflow uniquement quand tu cliques sur le bouton d'exécution.

### B. Ajouter les données

Clique sur le `+` après ce nœud et cherche **Edit Fields (Set)**. Renomme-le **Mes informations**.

Dans le mode **Manual Mapping**, ajoute deux champs de type **String** :

| Nom du champ | Valeur fixe |
| --- | --- |
| `prenom` | `Nicolas` |
| `texte` | `Mon premier workflow n8n fonctionne.` |

Exécute ce nœud avec **Execute step** (ou le workflow entier). La sortie doit contenir ces deux champs.

### C. Composer le message

Ajoute un second **Edit Fields (Set)**, renomme-le **Mon message** et connecte-le à **Mes informations**.

Ajoute un champ String nommé `message`. Passe sa valeur en mode **Expression** puis saisis :

```javascript
{{ 'Bonjour ' + $json.prenom + ' ! ' + $json.texte }}
```

`$json.prenom` lit le champ `prenom` de l'élément reçu du nœud précédent. Le signe `+` assemble les morceaux de texte. Dans le fichier JSON exporté, n8n ajoute un `=` avant l'expression : dans l'éditeur, utilise simplement le mode Expression.

Ajoute un second champ String nommé `statut`, en mode valeur fixe, contenant `Réussi`. Désactive **Include Other Input Fields** si cette option apparaît, pour ne garder que les deux champs de sortie.

### D. Tester

Enregistre puis clique sur **Execute Workflow**. Les trois étapes doivent réussir. Clique sur **Mon message** et vérifie la sortie indiquée plus haut.

Si tu vois `undefined`, vérifie l'orthographe et la casse de `prenom` et `texte`, ainsi que la connexion entre les nœuds. Si le texte `{{ ... }}` s'affiche tel quel, vérifie que la valeur est bien en mode Expression.

## 4. Aller un peu plus loin

- Change `prenom` et `texte` pour comprendre comment les données circulent.
- Ajoute un nœud **If** après **Mes informations** pour tester si `prenom` est égal à `Nicolas`, puis connecte **Mon message** à la sortie vraie.
- Pour exécuter à intervalle régulier, remplace le déclencheur manuel par **Schedule Trigger**, règle un intervalle, puis **publie/active** le workflow selon le bouton de ta version. Le fuseau de cette installation est `Europe/Paris`. Ton Mac et Docker doivent rester actifs.

Le workflow manuel n'a pas besoin d'être publié ou activé. Son résultat reste dans n8n : rien n'est envoyé par e-mail ou à un autre service.

## 5. Sauvegarder ton travail

Dans le menu `…`, choisis **Download / Export** pour obtenir le JSON du workflow. Un JSON décrit les étapes, mais ne remplace pas la sauvegarde du volume Docker décrite dans le README. Vérifie les données exportées avant de les ajouter à GitHub.
