# Export PDF de l’étude matériaux

Demande du 4 octobre 2026 : permettre à l’utilisateur de récupérer le résultat de son étude dans un PDF.

Le PDF est produit par le service métier après un calcul réussi ou partiel. Il reprend le résultat structuré du calculateur, sans demander au modèle de recalculer ou de réécrire les prix. Le résultat de l’outil contient un lien de téléchargement que l’agent présente dans le chat. Le workflow conserve ses quatre outils et sa branche d’incident.

Le document contient les dimensions, les hypothèses et leur origine, les quantités achetables, les prix datés, les sources, les exclusions et les points à confirmer. Un résultat partiel conserve un total global inconnu ; son sous-total connu ne devient pas le prix d’une étude complète. Le rapport reste une étude préliminaire de matériaux, sans commande ni devis fournisseur.

Chaque calcul exporté reçoit un identifiant aléatoire de 128 bits. PDF et données sources sont conservés dans un dossier local ignoré par Git, monté dans le conteneur. Les fichiers PDF restent disponibles après redémarrage ; les données JSON internes ne sont pas proposées au téléchargement. Une nouvelle estimation produit un nouveau document et ne remplace pas silencieusement l’ancien.

L’accès reste local au Mac. Les liens ne constituent pas une authentification utilisateur ; une publication client demanderait des droits d’accès et une politique de conservation. Aucun service PDF externe ne reçoit l’étude.

Un échec de génération n’efface pas les calculs : l’outil indique que l’export est indisponible et ne retourne aucun lien inventé. Les tests doivent couvrir le cas normal, le résultat partiel, la persistance, les chemins non autorisés et les pannes d’export. Le PDF final est extrait et rendu en images pour contrôler chiffres et mise en page.

PDFKit est retenu dans le service Node déjà présent, avec une version exacte et un fichier de verrouillage. L’image de l’API embarque son code et ses dépendances ; le répertoire des rapports est le seul volume persistant ajouté. Documentation primaire : [création des documents](https://pdfkit.org/docs/getting_started.html) et [texte et liens](https://pdfkit.org/docs/text.html).
