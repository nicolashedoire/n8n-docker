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

## Vidéo et sources de montage

La vidéo complète dure **35 min 05 s** : 50 scènes réparties en 16 chapitres. Elle est livrée au format MP4 1080p avec la voix de synthèse **Higgsfield · Cillian**, des chapitres intégrés et des sous-titres français. Le MP4 est fourni séparément ; les médias volumineux ne sont pas suivis par Git. Cette voix de catalogue n’est pas un clonage de la voix de l’auteur de la chaîne.

- [Script intégral minuté, trois propositions d’ouverture et repères pédagogiques](SCRIPT-VIDEO.md)
- [Manifeste des scènes et provenance audio](video-scenes.json)
- [Script de rendu local](../../scripts/render-tutorial.py)

Le calage des sous-titres est estimé à partir de la durée audio de chaque scène. Les extraits de code sont des fragments pédagogiques, et ne sont pas tous des programmes autonomes exécutables.

Les narrations ont été générées avec Higgsfield, voix Cillian. Le manifeste conserve le fournisseur, l’identifiant de voix, les identifiants de jobs et des chemins relatifs vers les fichiers audio préparés dans `work/higgsfield-audio/`, ignoré par Git. Il ne contient aucune URL de téléchargement signée ni clé. Les fichiers audio sont nécessaires pour reproduire ce montage ; le dépôt seul ne les télécharge pas et ne déclenche pas de nouvelle génération.

Avec Python 3, Pillow, `ffmpeg`, `ffprobe` et ces fichiers audio présents, lancer depuis la racine du dépôt :

```sh
python3 scripts/render-tutorial.py --manifest docs/tutoriel/video-scenes.json --require-audio --audio-provider higgsfield --voice-label Cillian --voice-id d8ba9f14-8a24-44db-932b-99e16c45bd32 --check-only
python3 scripts/render-tutorial.py --manifest docs/tutoriel/video-scenes.json --require-audio --audio-provider higgsfield --voice-label Cillian --voice-id d8ba9f14-8a24-44db-932b-99e16c45bd32 --output-dir work/higgsfield-render
```

Cette étape de montage local ne contacte aucun fournisseur d’IA et ne lit aucune clé. La génération préalable de la voix est une étape distincte. Les fichiers intermédiaires restent dans `work/`, ignoré par Git.
