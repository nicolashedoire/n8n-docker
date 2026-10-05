# Tutoriel vidéo — Agent achats chantier

Vidéo pédagogique en français construite avec des **captures réelles de n8n**, des détails agrandis et une **voix de synthèse Cillian générée par Higgsfield**. Ce montage n’est pas un enregistrement continu des manipulations.

La vidéo suit la configuration des neuf nœuds, distingue le rôle du modèle de celui du moteur métier, puis propose une séquence de présentation en entretien. Le [guide détaillé](../PRESENTER-CONFIGURATION.md) complète les captures avec les expressions et les choix de conception.

**[Regarder le tutoriel — 11 min 31](https://d2ol7oe51mr4n9.cloudfront.net/user_3JJEctyDO8koki9zVbPVvhFpp8B/45535594-f93c-4859-afa0-24f73a93513f.mp4)** · MP4 1080p, voix française, treize chapitres intégrés. [Affiche](https://d2ol7oe51mr4n9.cloudfront.net/user_3JJEctyDO8koki9zVbPVvhFpp8B/770f3619-4dfb-4ef0-bded-87cca5fe61cd.jpg).

Le fichier final mesure 17,18 Mo. La présence de l’image, du son et des treize chapitres a été vérifiée ; son décodage complet n’a signalé aucune erreur. Les planches et plusieurs gros plans ont été contrôlés visuellement. Cinq extraits de voix ont été contrôlés par transcription automatique ; cela ne remplace pas une écoute humaine intégrale.

Les [repères temporels](chapitres.txt) permettent de retrouver directement une brique. La vidéo a été produite le 5 octobre 2026, sur la configuration capturée dans le commit `1fcf737`.

## Sources de production

- `narration.json` : texte intégral des treize chapitres, points à retenir et provenance de la voix.
- `manifest.json` : durées, captures Git immuables, recadrages et audio de chaque chapitre.
- `prepare.py` : préparation des captures et du son dans le sandbox Higgsfield.
- `build.jsx` : composition native Higgsedit, sans reconstitution de l’interface.
- `encode.py` : assemblage des compositions, de la voix et des chapitres du MP4.

Les journaux de génération et de contrôle sont conservés localement dans `work/tutoriel-agent-higgsfield`, ignoré par Git. Les captures ne contiennent aucune clé API. Le workflow n’a pas été modifié pour produire cette documentation.

## Ordre des chapitres

1. Le problème métier et le rôle de l’agent.
2. Décrire mon chantier : déclencheur et session.
3. Agent achats chantier : instructions.
4. Agent achats chantier : limites, traces et incidents.
5. Modèle OpenAI : modèle, délais et credentials.
6. Mémoire : clé de session et contexte limité.
7. Consulter les règles : paramètres et limites métier.
8. Rechercher les matériaux : catalogue sourcé et daté.
9. Consulter une fiche fournisseur : relevé et actualisation.
10. Calculer les quantités : validation, hypothèses et code.
11. PDF : mêmes données que l’estimation.
12. Expliquer l’incident : erreur technique et résultat métier.
13. Démonstration et réponses en entretien.
