# L’Atelier n8n — qualification des demandes

## Objectif

Transformer l’atelier formulaire → Google Sheets en un démonstrateur de qualification IA explicable en quinze minutes. Une demande fictive est contrôlée, analysée par un modèle local, enregistrée, puis soumise à une personne. Aucun e-mail n’est envoyé automatiquement.

## Parcours prévu

1. Formulaire n8n ou webhook JSON.
2. Normalisation et validation des champs.
3. Réservation atomique dans SQLite : même identifiant + même contenu = doublon ; même identifiant + contenu différent = conflit.
4. Appel réel à Ollama, avec un contrat JSON et un temps maximal.
5. Validation du résultat, sans faire confiance au texte du modèle.
6. Enregistrement durable avant synchronisation Google Sheets.
7. Revue humaine du brouillon, avec décision et historique.

n8n reste l’orchestrateur visible. Un petit service Node.js fournit la persistance transactionnelle, l’adaptateur Ollama et la page de revue. Les règles de validation sont aussi appliquées côté service : contourner un nœud ne doit pas permettre de stocker une sortie incohérente.

## Contrat IA

Le modèle reçoit uniquement la demande, sans nom ni adresse e-mail. Sa sortie contient `category` (`devis`, `rendez_vous`, `support`, `autre`), `summary`, `missing_information` et `draft_reply`. Il ne peut ni approuver un dossier, ni envoyer un message. Un JSON conforme ne prouve pas que son contenu est exact : la revue humaine reste nécessaire.

## Erreurs et reprises

- Entrée invalide : rejet explicite, sans appel au modèle.
- Doublon : résultat existant, sans nouvelle inférence.
- Réservation interrompue : bail borné et nouveau jeton de tentative après expiration.
- Panne du modèle : tentatives limitées, puis dossier en erreur technique.
- JSON invalide : erreur technique visible, jamais présenté comme une qualification réussie.
- Google Sheets indisponible : conserver le résultat local et afficher l’échec de synchronisation. Ne pas affirmer une livraison dans le tableur si elle n’a pas été vérifiée.

Les scénarios de panne injectés sont explicitement nommés comme simulations ; les scénarios nominaux utilisent le vrai modèle local.

## Périmètre et sécurité

Démo locale sur ports liés à `127.0.0.1`, données fictives, compte Google existant seulement pour le tableur de démonstration. Pas d’authentification métier multi-utilisateur ni de déploiement client revendiqué. L’approbation nécessite une action dans l’interface humaine ; les appels du modèle ne peuvent pas l’effectuer. Les identifiants, références privées Google et données d’exécution sont exclus de Git. Le workflow historique est conservé.

## Étapes de livraison dans Git

1. `docs`: conception, contrats, limites et critères de réussite.
2. `feat`: persistance, modèle local, revue et tests des règles métier.
3. `feat`: workflow n8n, installation et raccordement Google Sheets.
4. `test/docs`: résultats des essais, mode d’emploi et script d’entretien.

## Critères de réussite

- Une demande complète donne une catégorie, un résumé et un brouillon à revoir.
- Une demande ambiguë signale les informations manquantes.
- Une entrée invalide ne consomme aucune inférence.
- Une panne et une sortie mal formée produisent un état d’erreur contrôlé.
- Deux demandes simultanées de même identifiant n’obtiennent pas deux réservations.
- Une relance ne crée pas de doublon métier.
- Une approbation humaine apparaît dans l’historique et ne déclenche aucun envoi.
- Le dépôt public ne contient aucun secret ni contenu client.
