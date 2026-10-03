# L’Atelier n8n — qualification des demandes

## Objectif

Transformer l’atelier formulaire → Google Sheets en un démonstrateur de qualification IA explicable en quinze minutes. Une demande fictive est contrôlée, analysée par le fournisseur configuré, enregistrée, puis soumise à une personne. Aucun e-mail n’est envoyé automatiquement. Le savoir-faire présenté est l’orchestration n8n : intégrations, règles, reprises et contrôle humain.

## Parcours prévu

1. Formulaire n8n ou webhook JSON.
2. Normalisation et validation des champs.
3. Réservation atomique dans SQLite : même identifiant + même contenu = doublon ; même identifiant + contenu différent = conflit.
4. Nœud **Extraire les faits avec IA** → service local → OpenAI ou Ollama : extraire une catégorie et des faits, avec un contrat JSON et un temps maximal.
5. Validation des extraits contre le message original ; règles n8n pour calculer les manques et composer un brouillon au nom du prestataire.
6. Enregistrement durable avant synchronisation Google Sheets.
7. Revue humaine du brouillon, avec décision et historique.

n8n reste l’orchestrateur visible. Un petit service Node.js fournit la persistance transactionnelle, l’adaptateur de fournisseur et la page de revue. Les règles de validation sont aussi appliquées côté service : contourner un nœud ne doit pas permettre de stocker une sortie incohérente. Le modèle ne choisit pas les étapes et ne possède aucun outil d’action : c’est un workflow déterministe avec une étape d’interprétation IA.

## Choix du fournisseur

`LLM_PROVIDER=openai` sélectionne l’API Responses d’OpenAI avec `OPENAI_MODEL=gpt-5.6-terra` par défaut. Le service utilise `text.format` avec un schéma strict, `store: false`, et lit la clé depuis le secret local. Le modèle est configurable. Voir la [fiche officielle](https://developers.openai.com/api/docs/models/gpt-5.6-terra) et le [contrat Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs).

`LLM_PROVIDER=ollama` sélectionne Ollama sur le Mac ; Compose fournit `qwen2.5:3b`. Sans configuration, ce mode reste la valeur par défaut. Il n’y a aucun repli automatique entre fournisseurs. Le choix ne change ni les règles métier ni les gabarits ; les métriques conservent le fournisseur et le modèle réellement employés.

Au 3 octobre 2026, le code OpenAI est préparé et testé avec des réponses simulées. Aucune exécution réelle OpenAI n’est validée en l’absence de clé. Le [rapport de validation](VALIDATION.md) est la référence pour les résultats observés, distincts des comportements attendus.

## Contrat IA

Le modèle reçoit uniquement le texte de la demande, sans ajout du nom ni de l’adresse e-mail. Sa sortie contient `category` (`devis`, `rendez_vous`, `support`, `autre`) et `facts` avec six extraits ou chaînes vides : `need`, `budget`, `deadline`, `availability`, `product`, `problem`. n8n contrôle les extraits, applique les règles métier puis construit le résultat final `category`, `summary`, `missing_information`, `draft_reply`. Le serveur vérifie à nouveau ce calcul avant stockage. Le modèle ne peut ni approuver un dossier, ni envoyer un message. Une preuve textuelle ne garantit pas la pertinence de l’extraction : la revue humaine reste nécessaire. Cette séparation a été introduite après un défaut de brouillon observé dans la première version ; voir [Qualité des réponses](QUALITE.md).

La recherche de chaque extrait dans le message normalise uniquement Unicode NFC, la casse, les espaces et les apostrophes `‘`/`’` vers `'`. Elle ne supprime pas les accents, ne reformate pas les nombres et n’accepte pas les paraphrases. Le marqueur `facts-v2` distingue ce contrat de la génération libre des anciens brouillons. Les anciens dossiers sont conservés ; leur rejeu ne les transforme pas en résultats facts-v2.

## Erreurs et reprises

- Entrée invalide : rejet explicite, sans appel au modèle.
- Doublon : résultat existant, sans nouvelle inférence.
- Réservation interrompue : bail borné et nouveau jeton de tentative après expiration.
- Panne du modèle : tentatives limitées, puis dossier en erreur technique.
- JSON invalide : erreur technique visible, jamais présenté comme une qualification réussie.
- Google Sheets indisponible : conserver le résultat local et afficher l’échec de synchronisation. Ne pas affirmer une livraison dans le tableur si elle n’a pas été vérifiée.

Les scénarios de panne injectés sont explicitement nommés comme simulations ; les scénarios nominaux appellent réellement le fournisseur choisi lorsqu’il est configuré. Une clé absente ou une API indisponible produit une erreur, pas un résultat de secours présenté comme réel.

## Périmètre et sécurité

Interface et service locaux sur ports liés à `127.0.0.1`, données fictives, compte Google existant seulement pour le tableur de démonstration. En mode OpenAI, le texte de la demande sort du Mac vers l’API ; ce texte peut contenir des données personnelles même si les champs nom et e-mail ne sont pas ajoutés. Pas d’authentification métier multi-utilisateur ni de déploiement client revendiqué. L’approbation nécessite une action dans l’interface humaine ; les appels du modèle ne peuvent pas l’effectuer. Les secrets, références privées Google et données d’exécution sont exclus de Git. Le workflow historique est conservé.

## Étapes de livraison dans Git

1. `docs`: conception, contrats, limites et critères de réussite.
2. `feat`: persistance, adaptateur de modèle, revue et tests des règles métier.
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
