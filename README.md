# n8n sur ton Mac avec Docker

Une installation locale de n8n **2.39.8**, un guide en français et un premier workflow prêt à importer.

## Démarrer

1. Ouvre Docker Desktop.
2. Double-clique sur **Demarrer.command** dans ce dossier.
3. Ton navigateur ouvre **http://localhost:5678**.
4. Au premier accès, crée ton compte propriétaire n8n avec ton adresse e-mail et un mot de passe. Ce compte appartient à ton installation locale ; aucun abonnement n8n Cloud n'est nécessaire pour cet exemple.
5. Suis **[GUIDE-PREMIER-WORKFLOW.md](GUIDE-PREMIER-WORKFLOW.md)**.

Si macOS empêche le double-clic, utilise le Terminal :

```bash
cd ~/Desktop/n8n-docker
bash Demarrer.command
```

## Contenu

- `compose.yaml` : n8n, stockage persistant et contrôle de disponibilité.
- `Demarrer.command` / `Arreter.command` : lancement et arrêt sur macOS.
- `GUIDE-PREMIER-WORKFLOW.md` : import rapide et création pas à pas.
- `workflows/01-bonjour.json` : exemple sans service externe ni clé API.
- `.env.example` : exemple de configuration facultative.

## Commandes utiles

À lancer dans le dossier du projet :

```bash
docker compose up -d --wait     # démarrer
docker compose ps              # vérifier l'état
docker compose logs --tail=80  # consulter les journaux
docker compose stop            # arrêter sans perdre les données
docker compose start           # relancer après un arrêt
```

Le port est lié uniquement à `127.0.0.1` : cette installation est accessible depuis ton Mac. Un webhook appelé par un service Internet nécessite une configuration publique avec HTTPS ; ce projet est un environnement local pour apprendre.

## Données et GitHub

Les workflows enregistrés, le compte, les identifiants de connexion aux services et la clé de chiffrement restent dans le volume Docker `n8n-desktop_n8n_data`. Ils survivent aux arrêts et à la recréation du conteneur.

**Ne lance pas `docker compose down -v` : l'option `-v` supprime le volume et les données.** Réinitialiser Docker Desktop peut aussi supprimer les volumes.

GitHub contient la configuration et l'exemple uniquement. Il n'est pas une sauvegarde de ton instance. Exporte tes workflows en JSON depuis l'éditeur pour les versionner, après vérification des données, URL privées, jetons et références aux identifiants qu'ils pourraient contenir. `.env` et `backups/` sont ignorés par Git.

Pour une sauvegarde complète (incluant la clé de chiffrement), exécute les commandes suivantes, en conservant le même Terminal :

```bash
mkdir -p backups
chmod 700 backups
docker compose stop n8n
(umask 077; docker compose run --rm --no-deps -T --entrypoint tar n8n -czf - -C /home/node/.n8n . > "backups/n8n-$(date +%Y%m%d-%H%M%S).tar.gz")
docker compose start n8n
```

Vérifie que la commande de sauvegarde réussit. Si elle échoue, relance quand même `docker compose start n8n`. Conserve les archives dans un emplacement privé et sauvegardé : elles contiennent des données sensibles. Pour restaurer, arrête n8n, extrais l'archive dans un volume vide monté sur `/home/node/.n8n` en préservant les permissions, puis démarre avec la même version de n8n. Ne restaure pas par-dessus une base existante.

## Changer le port

Copie `.env.example` en `.env`, remplace `5678` par exemple par `5679`, puis relance `Demarrer.command`. Le lanceur ouvrira le bon port.

## Mise à jour

L'image est figée par son empreinte SHA-256 pour retrouver la version testée. Un simple `docker compose pull` ne change donc pas de version. Pour mettre à jour : sauvegarde le volume, consulte les notes de version officielles, remplace l'image de `compose.yaml` par une version stable précise (`docker.n8n.io/n8nio/n8n:VERSION`), puis lance `docker compose pull` et `docker compose up -d --wait`. Une migration de base peut empêcher de revenir à une ancienne version sans restaurer la sauvegarde.

## Dépannage

- **Docker inaccessible** : ouvre Docker Desktop et attends qu'il soit prêt.
- **Port déjà utilisé** : change le port dans `.env` comme indiqué ci-dessus.
- **Page indisponible** : regarde `docker compose ps` puis les journaux ; le premier démarrage applique les migrations.
- **Compte demandé au premier accès** : c'est normal, termine la création du compte propriétaire.
- **Workflow absent après clonage** : importe le JSON. Les workflows de ton instance ne sont pas synchronisés automatiquement avec GitHub.
- **Exécution planifiée interrompue** : ton Mac doit rester allumé, éveillé, et Docker doit tourner.

## Références

- [Documentation officielle Docker Compose](https://github.com/n8n-io/n8n-docs/blob/main/docs/deploy/host-n8n/install-options/install-using-docker-compose.md)
- [Documentation officielle n8n](https://docs.n8n.io/)
- [Versions et notes de publication](https://github.com/n8n-io/n8n/releases)

Le projet utilise l'image officielle n8n. Les conditions de licence de n8n restent celles de son éditeur.
