# Tutoriel illustré — L’Atelier n8n

Comprendre le workflow de qualification IA **facts-v2** : chaque nœud, le code qui le compose et la raison des choix. Support relevé le 3 octobre 2026 sur le projet réel.

[Ouvrir le guide dans Notion](https://app.notion.com/p/3eece9b72fb781898b1df8126e706fee)

## Parcours de lecture

1. [Lire le workflow et comprendre les données](01-lire-le-workflow.md)
2. [Nœuds 1 à 9 — entrées, validation et doublons](02-entrees-et-doublons.md)
3. [Nœuds 10 à 14 — IA, vérifications, règles et brouillon](03-ia-regles-brouillon.md)
4. [Nœuds 15 à 25 — stockage, Sheets, erreurs et parcours](04-stockage-suivi-parcours.md)
5. [Service et fournisseur](05-service-et-fournisseur.md)
6. [Persistance, relecture et tests](06-persistance-relecture-tests.md)
7. [Exercices corrigés et répétition d’entretien](07-exercices-entretien.md)

Les captures de configuration sont prises dans l’éditeur n8n, sans données d’exécution. La vue d’ensemble et le résultat Camille montrent une exécution OpenAI déjà vérifiée. Les extraits du code peuvent être remis en lignes ou réduits ; les omissions sont signalées. Les exemples de contrats sont pédagogiques, pas des résultats supplémentaires.

Le tutoriel vidéo accompagne ces chapitres avec des captures commentées, des cartes de code agrandi, une voix française de synthèse, des chapitres et des sous-titres. La vidéo est un montage pédagogique, pas un enregistrement continu de nouvelles manipulations. Aucun clonage de voix n’est utilisé.

## État du projet présenté

- 25 nœuds exécutables et 5 notes.
- OpenAI configuré ; 9/9 cas qualité et 7/7 scénarios techniques sur le corpus conservé.
- 29 tests isolés ; cette vérification du code est distincte de l’évaluation du modèle.
- Branche Google Sheets désactivée sans connexion validée ; aucune écriture Google revendiquée.
- Aucun envoi d’email, même après approbation.

Ces documents expliquent le prototype existant. Ils ne prétendent pas démontrer sa fiabilité sur tous les messages ni constituer une mise en production chez un client.
