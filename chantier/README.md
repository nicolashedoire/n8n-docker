# Agent IA achats chantier — n8n

Un artisan décrit son chantier. L’agent clarifie le besoin, consulte des règles sourcées, sélectionne des références et appelle un calculateur pour préparer une liste d’achat estimative. Il peut ensuite adapter son estimation lorsque l’usage de la pièce change.

Ce projet est autonome dans `chantier/`, sur la branche `feat/agent-achats-chantier`. Il utilise un **AI Agent natif n8n**, avec un modèle OpenAI, une mémoire et quatre outils. Le workflow précédent de qualification des demandes reste distinct.

## Ouvrir la démonstration installée

- [Guide actuel dans Notion : salle de bains, code et incidents](https://app.notion.com/p/3efce9b72fb781bfade7c9a625be4ab0)
- [Dossier BTP dans Notion et historique de conception](https://app.notion.com/p/3efce9b72fb78126ac58dabefbad8d47)
- [Workflow dans n8n](http://localhost:5678/workflow/atelierAgentChantier01)
- [Conversation avec l’agent](http://localhost:5678/webhook/atelier-agent-chantier/chat)
- [État du service d’outils](http://localhost:8788/health)

Depuis la racine du dépôt :

```sh
bash chantier/start.sh
```

Le fichier `Start-Agent-Chantier.command` lance la même commande. Docker doit fonctionner. Ces adresses sont locales à la machine qui exécute Docker.

## Scénario d’entretien : une seule demande

> Je refais ma salle de bains de 4 m sur 3 m.

La longueur et la largeur suffisent à une première estimation. L’agent consulte les règles, recherche les références, lit la fiche H1 puis appelle le calculateur. Il annonce les paramètres proposés : hauteur 2,50 m, marge 10 %, doublage des quatre murs, finition légère et isolation. Portes, fenêtres et receveur non mesurés ne sont pas déduits : ce sont des surfaces brutes, pas une affirmation qu’ils n’existent pas.

Le résultat contient le sol carrelé et les matériaux principaux des murs, puis une question courte pour affiner. Le budget est facultatif. Les quantités de la pièce sont calculées dans le code à partir des dimensions ; le modèle ne remplit pas discrètement les valeurs absentes.

Attendre la réponse. Dans **la même conversation**, essayer :

> Il y aura une douche avec un receveur. Garde les dimensions.

L’agent conserve le chiffrage provisoire des lots calculables et distingue les protections à l’eau, le receveur et les autres postes non chiffrés. Il ne refuse pas toute la rénovation parce qu’une douche est présente.

Puis :

> En fait, la hauteur sous plafond est de 2,70 m.

Le moteur recalcule la surface des murs, conserve le sol et indique qu’un autre système de doublage doit être choisi. Il ne présente pas le prix du sol comme celui de toute la pièce.

Voir le [conducteur de démonstration salle de bains](docs/DEMO-SALLE-DE-BAINS.md). Les scénarios historiques de cloison et de carrelage seul restent expliqués dans le [guide nœud par nœud](docs/GUIDE-ENTRETIEN.md).

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

- `workflow.json` : huit nœuds du parcours, une branche de réponse aux incidents et deux notes. Aucune clé ni référence privée de connexion.
- `build-workflow.mjs` : construit l’export et sa copie locale avec la connexion n8n.
- `agent-prompt.txt` : rôle, questions, choix des outils et présentation des résultats.
- `catalog.json` : produits de plusieurs fournisseurs, sourcés, prix du conditionnement entier, dimensions et date du relevé.
- `rules.json` : périmètre, questions, hypothèses et sources fabricants.
- `server.mjs` : expose les quatre outils, valide les requêtes et encadre les lectures des fiches fournisseurs.
- `quantities.mjs` : calculs déterministes, arrondis des conditionnements et totaux monétaires.
- `test/` : tests de calcul et du service, sans appel à OpenAI.
- `test-agent.mjs` : quatre tours historiques de conversation, lancés explicitement avec `--run`.
- `test-agent-room.mjs` : salle de bains depuis les seules dimensions, puis douche et changement de hauteur dans la même session.
- `incident-response.js` : réponse déterministe après incident de l'agent, sans nouveau modèle ni copie du diagnostic brut.
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
node chantier/test-agent-room.mjs --dry-run
# Appels OpenAI réels, facturables sur la connexion existante :
node chantier/test-agent-room.mjs --run
```

Les tests réels enregistrent réponses et appels d’outils sous `work/chantier-validation/`, ignoré par Git. Ils vérifient le choix des outils, les données transmises, les prix et totaux du calculateur. Ils ne certifient pas la conformité d’un ouvrage.

## État vérifié le 4 octobre 2026

La campagne initiale est conservée dans [le rapport de validation](docs/VALIDATION.md). Le conducteur de salle de bains distingue la conception du nouveau parcours et les résultats réellement observés après installation.

## Limites à expliquer honnêtement

La recherche porte sur une **sélection de références de plusieurs fournisseurs**, avec prix datés. Chaque référence conserve son enseigne ; un prix conseillé est distingué d’un prix de vente affiché. Elle ne parcourt pas tout le site. La consultation d’une fiche peut tenter de relire la page : blocage, échec ou unité de prix ambiguë restent signalés. Le calculateur utilise toujours les prix du catalogue daté ; un éventuel prix en ligne est présenté séparément. Aucun stock en magasin n’est vérifié.

Le calcul placo couvre une cloison intérieure simple non porteuse, de hauteur au plus 2,50 m, à finition légère, selon les hypothèses renvoyées par les règles. Le catalogue multimarque ne constitue pas un système fabricant certifié. Le mode `bathroom` ajoute le doublage des quatre murs selon un gabarit Placo distinct, à montants doublés et hauteur au plus 2,50 m. Le doublage isolé sans ce gabarit reste à préciser. Plafonds, systèmes complexes, carrelage mural lourd, performance feu, calcul thermique et garantie acoustique sont exclus.

Pour la pièce complète, une face H1 est comptée par mur doublé. Les matériaux de base ne valident pas la protection à l’eau d’une douche ; ce poste reste distinct. Pour le scénario historique de cloison à deux faces, le choix H1 sur les deux faces reste une hypothèse conservatrice, pas une obligation universelle.

Le total reste partiel : vis, bandes, enduits, fixations, protections à l’eau, colle, joints, outillage, livraison et main-d’œuvre ne sont pas tous chiffrés. L’agent prépare une liste à vérifier, sans commande ni paiement.

Les ports sont liés à `127.0.0.1`. Le chat publié n’a pas d’authentification propre : cette configuration est destinée à une démonstration locale. Une exposition distante demanderait authentification, limitation de débit et de coût, gestion des accès et politique de conservation des conversations.

Voir [le guide d’entretien, nœud par nœud](docs/GUIDE-ENTRETIEN.md), [le code de la salle de bains expliqué](docs/CODE-SALLE-DE-BAINS.md), [l’exploitation et les incidents](docs/EXPLOITATION.md), [les sources](docs/SOURCES.md) et [les décisions de conception](docs/CONCEPTION.md).
