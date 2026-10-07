# Atelier LinkedIn : de la page publique au CSV

## Étape 1 — Périmètre et choix

Demande du 7 octobre 2026 : ajouter un exemple de scraping compréhensible et visible dans n8n. Le scénario retenu par défaut est une veille d'annonces pour les compétences n8n et automatisation, en France.

Une requête HTTP anonyme à la page publique de recherche LinkedIn a renvoyé un document HTML contenant des cartes d'annonces. La collecte ne nécessite donc, pour cet exemple testé, ni clé payante ni connexion LinkedIn. Cette accessibilité peut varier : un refus, une redirection ou un changement de structure doit être signalé, jamais remplacé silencieusement par de fausses données.

## Architecture — 8 nœuds

1. Déclenchement manuel.
2. Critères modifiables : mots-clés, lieu, plafond d'export et mots prioritaires.
3. HTTP Request : une seule page publique, délai limité, aucune relance automatique.
4. Code : contrôle HTTP, contenu HTML et présence de cartes.
5. HTML : extraction du tableau de cartes.
6. HTML : lecture du titre, de l'entreprise, du lieu, du lien et de la date de chaque carte.
7. Code : nettoyage, dédoublonnage par annonce, tri indicatif par mots du titre et plafond.
8. Convert to File : fichier CSV téléchargeable.

Le second nœud HTML traite directement un tableau de fragments HTML. Chaque annonce reste un bloc cohérent : les champs d'annonces différentes ne sont pas alignés artificiellement à partir de tableaux séparés.

## Ce que cet atelier démontre

C'est un scraping déterministe, pas un agent IA. La recherche est effectuée par LinkedIn ; le tri local est une règle de mots-clés dans le titre, pas une analyse du descriptif ni une évaluation de candidature. L'export concerne uniquement les annonces présentes dans la première page reçue. Le plafond limite l'export, pas la taille de la page téléchargée.

## Validation prévue

Tests des liens, doublons, champs manquants, cellules CSV et erreurs HTTP ; exécution réelle dans l'éditeur n8n ; inspection du CSV. L'HTML collecté et les sorties d'exécution restent dans les dossiers locaux ignorés par Git.

## Étape 2 — Construction et tests

Huit nœuds natifs, plus deux notes sur le canvas. Les fonctions `verifyPage` et `prepareJobs` sont testables isolément puis intégrées directement dans les nœuds Code. Les 13 tests couvrent les refus HTTP, pages inattendues, absence de cartes, doublons, liens trompeurs, dates, cellules de tableur et plafond d'export.

## Étape 3 — Exécution réelle et correction

Le premier essai n8n (exécution 93) a parcouru l'ensemble du workflow. L'inspection a révélé que HTML v1.2 ajoutait les adresses des liens aux noms d'entreprises. Le nœud de lecture des champs a été configuré en v1.1, qui utilise le texte brut.

Nouvel essai le 7 octobre 2026 à 08 h 24 (Paris), n8n 2.39.8, exécution **94** : succès en **2,027 secondes**, **60** cartes lues et **10** annonces uniques exportées. Le CSV de **1 914 octets** a été téléchargé depuis le nœud final et contrôlé : neuf colonnes, dix lignes, URL uniques sans suivi et noms d'entreprises propres. Les captures du workflow et de l'export sont dans le guide. Les données complètes collectées restent locales.
