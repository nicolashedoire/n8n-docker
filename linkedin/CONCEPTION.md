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
