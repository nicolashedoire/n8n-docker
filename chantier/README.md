# Agent IA achats chantier — n8n

Un artisan décrit son chantier. L’agent clarifie le besoin, consulte des règles sourcées, sélectionne des références et appelle un calculateur pour préparer une liste d’achat estimative. Il peut ensuite adapter son estimation lorsque l’usage de la pièce change.

Ce projet est autonome dans `chantier/`, sur la branche `feat/agent-achats-chantier`. Il utilise un **AI Agent natif n8n**, avec un modèle OpenAI, une mémoire et quatre outils. Le workflow précédent de qualification des demandes reste distinct.

## Ouvrir la démonstration installée

- [Workflow dans n8n](http://localhost:5678/workflow/atelierAgentChantier01)
- [Conversation avec l’agent](http://localhost:5678/webhook/atelier-agent-chantier/chat)
- [État du service d’outils](http://localhost:8788/health)

Depuis la racine du dépôt :

```sh
bash chantier/start.sh
```

Le fichier `Start-Agent-Chantier.command` lance la même commande. Docker doit fonctionner. Ces adresses sont locales à la machine qui exécute Docker.

## Scénario d’entretien

Dans le chat, envoyer :

> Je crée une cloison non porteuse de 4 m de long et 2,50 m de haut dans une chambre sèche, sans porte ni fenêtre. Simple parement de chaque côté, finition peinte légère et isolation phonique. Marge de 10 %, budget de 500 euros pour les matériaux de ton catalogue. Propose les références et une estimation en indiquant les hypothèses à valider.

Puis, **dans la même conversation** :

> Finalement, cette même cloison est pour une salle de bains privative, hors projection directe d’eau. La finition reste peinte. Garde les dimensions, l’isolation et la marge. Mon budget passe à 800 euros. Reprends les plaques et recalcule l’estimation.

Montrer dans n8n les appels d’outils de l’exécution. La preuve de l’agent est son choix d’outils et sa réutilisation de leurs résultats. La mémoire conserve les dimensions entre les deux messages. Le calculateur doit être rappelé pour la nouvelle estimation.

Autre exemple très simple :

> Je veux carreler 20 m² au sol dans un salon intérieur sec, en gris, avec 10 % de marge et 350 euros pour les carreaux seuls. Choisis une référence du catalogue et calcule les cartons à acheter.

Exemple volontairement incomplet :

> Je veux refaire une pièce en placo.

L’agent doit poser des questions, notamment cloison, doublage ou plafond. Il ne doit pas inventer la géométrie.

## Architecture et fichiers

```text
Chat → AI Agent → réponse dans le chat
           ├── Modèle OpenAI
           ├── Mémoire de session
           └── Outils HTTP → chantier-api
                ├── /tools/rules
                ├── /tools/search
                ├── /tools/product
                └── /tools/estimate
```

- `workflow.json` : export public des huit nœuds et de deux notes. Aucune clé ni référence privée de connexion.
- `build-workflow.mjs` : construit l’export et sa copie locale avec la connexion n8n.
- `agent-prompt.txt` : rôle, questions, choix des outils et présentation des résultats.
- `catalog.json` : sept produits sourcés, prix du conditionnement entier, dimensions et date du relevé.
- `rules.json` : périmètre, questions, hypothèses et sources fabricants.
- `server.mjs` : expose les quatre outils, valide les requêtes et encadre les lectures des fiches fournisseurs.
- `quantities.mjs` : calculs déterministes, arrondis des conditionnements et totaux monétaires.
- `test/` : tests de calcul et du service, sans appel à OpenAI.
- `test-agent.mjs` : quatre tours réels de conversation, lancés explicitement avec `--run`.
- `extract-execution.mjs` : lecture seule des traces n8n, limitée au nouveau workflow et aux sessions de test fictives.

Le modèle est appelé par le nœud natif n8n. Le service d’outils ne reçoit aucune clé OpenAI. La connexion native est chiffrée dans le stockage n8n. La mémoire est limitée à huit échanges et reste en mémoire : elle n’est pas une base de données métier durable.

## Installer ou réimporter localement

L’installation prévue pour cette machine réutilise la clé déjà présente dans le fichier ignoré `local-files/openai-api-key`. Ne jamais la commiter.

```sh
bash chantier/install.sh
```

Le script construit les exports, lance le service d’outils, sauvegarde la version précédente de ce nouveau workflow, importe la connexion si elle manque, importe et publie le workflow, puis redémarre n8n. **Ce redémarrage interrompt temporairement l’instance locale** : ne pas le lancer pendant une autre exécution. Le script ne réinitialise aucun compte et ne remplace pas les autres workflows.

Pour importer ailleurs : lancer le service `chantier-api` sur le réseau Docker de n8n, importer `workflow.json`, sélectionner une connexion OpenAI autorisée dans le nœud modèle, vérifier le modèle disponible sur le compte, puis publier. Le modèle de cette installation est `gpt-5.6-terra`.

## Vérifier

```sh
node --test chantier/test/*.test.mjs
node chantier/test-agent.mjs --dry-run
# Appels OpenAI réels, facturables sur la connexion existante :
node chantier/test-agent.mjs --run
```

Les tests réels enregistrent réponses et appels d’outils sous `work/chantier-validation/`, ignoré par Git. Ils vérifient le choix des outils, les données transmises, les prix et totaux du calculateur. Ils ne certifient pas la conformité d’un ouvrage.

## État vérifié le 4 octobre 2026

Workflow publié et conversation testée dans n8n : **27 tests de code et 4/4 tours réels réussis**, puis deux essais dans le chat de l’éditeur. Le second essai utilise les quatre outils. Voir [le rapport de validation et les captures](docs/VALIDATION.md).

## Limites à expliquer honnêtement

La recherche porte sur une **sélection de sept références Leroy Merlin**, avec prix relevés le 4 octobre 2026. Elle ne parcourt pas tout le site. La consultation d’une fiche peut tenter de relire la page : blocage, échec ou unité de prix ambiguë restent signalés. Le calculateur utilise toujours les prix du catalogue daté ; un éventuel prix en ligne est présenté séparément. Aucun stock en magasin n’est vérifié.

Le calcul placo couvre une cloison intérieure simple non porteuse, de hauteur au plus 2,50 m, à finition légère, selon les hypothèses renvoyées par les règles. Le catalogue multimarque ne constitue pas un système fabricant certifié. Le doublage est reconnu et documenté, mais **son ossature n’est pas chiffrée dans cette version**. Plafonds, systèmes complexes, carrelage mural lourd, performance feu, calcul thermique et garantie acoustique sont exclus.

En salle de bains privative hors projections directes, les plaques H1 sont proposées avec leurs limites. Une plaque hydrofuge ne remplace pas la protection à l’eau complète. La V1 utilise une seule référence de plaque pour les deux faces : retenir deux faces H1 est un choix conservateur, pas une obligation universelle.

Le total reste partiel : vis, bandes, enduits, fixations, protections à l’eau, colle, joints, outillage, livraison et main-d’œuvre ne sont pas tous chiffrés. L’agent prépare une liste à vérifier, sans commande ni paiement.

Les ports sont liés à `127.0.0.1`. Le chat publié n’a pas d’authentification propre : cette configuration est destinée à une démonstration locale. Une exposition distante demanderait authentification, limitation de débit et de coût, gestion des accès et politique de conservation des conversations.

Voir [le guide d’entretien, nœud par nœud](docs/GUIDE-ENTRETIEN.md), [les sources](docs/SOURCES.md) et [les décisions de conception](docs/CONCEPTION.md).
