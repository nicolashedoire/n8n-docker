# Télécharger l’étude de matériaux en PDF

L’agent peut joindre à son estimation un **PDF téléchargeable**. Ce document reprend les données du calculateur : dimensions, hypothèses, quantités à acheter, montants, sources et exclusions. C’est une étude préliminaire de matériaux, pas un devis d’entreprise ni une validation technique du chantier.

## Pendant la démonstration

1. Ouvrir le [chat local](http://localhost:5678/webhook/atelier-agent-chantier/chat).
2. Envoyer : **« Je refais ma salle de bains de 4 m sur 3 m. »**
3. Attendre le résultat puis cliquer sur **Télécharger l’étude PDF** dans la réponse.
4. Montrer les hypothèses annoncées, la liste des matériaux et les sources cliquables du document.
5. Envoyer ensuite : **« En fait, la hauteur est de 2,70 m. »** Le calcul suivant produit un nouveau PDF. Il indique le sous-total connu du sol et les murs non chiffrés ; il ne présente pas ce sous-total comme le montant de toute l’étude.

Chaque lien correspond à un instantané. Un ancien PDF reste inchangé lorsque les dimensions évoluent : utiliser le lien de la réponse la plus récente. Le lien `localhost` fonctionne sur le Mac qui exécute la démonstration. Pour remettre le résultat à une autre personne, transmettre le fichier téléchargé, pas cette adresse locale.

## Ce que contient le fichier

| Partie | Contenu |
| --- | --- |
| Cadrage | Type de projet, référence du rapport, date et heure de génération, mesures principales. |
| Données et hypothèses | Valeurs transmises au calculateur, défauts retenus et valeurs calculées, distingués explicitement. Une valeur transmise n’est pas un relevé vérifié sur place. |
| Matériaux | Références, cartons/lots/pièces à acheter, conditionnements, prix unitaires et sous-totaux. |
| Budget | Total des matériaux sélectionnés, ou seulement sous-total connu lorsque le résultat est partiel. |
| Limites | Postes exclus, contrôles restant à effectuer et distinction entre plaque hydrofuge et système d’étanchéité. |
| Sources | Liens fournisseurs, dates des prix et références documentaires du calcul. |

Le PDF utilise les prix datés du résultat, sans nouvelle recherche fournisseur. Son montant ne couvre pas la main-d’œuvre ni l’ensemble d’une rénovation de salle de bains.

## Où cela se passe dans n8n

Le workflow conserve **neuf nœuds et quatre outils**. Il n’y a pas de nœud supplémentaire à expliquer : l’export prolonge le travail de **Calculer les quantités**.

```text
Agent → Calculer les quantités → API locale
                                  ├─ Calcul et contrôles métier
                                  ├─ Création du PDF et sauvegarde de l’instantané
                                  └─ Résultat JSON avec lien du PDF
Agent ← résultats et lien ←────────┘
  └─ Présentation de l’estimation et du lien dans le chat
```

L’API crée un rapport après un résultat `ok` ou `partial` contenant des lignes de matériaux. Elle renvoie un champ `report` avec l’état `ready`, l’URL, le nom de fichier et la date. La consigne de l’agent lui demande de reprendre **l’URL exacte du dernier calcul**. Il ne doit pas inventer un lien ni réutiliser celui d’un calcul devenu obsolète.

Le rendu est réalisé avec PDFKit dans le service Node local. **Aucun nouvel appel au modèle ni service extérieur de génération de document n’est nécessaire.** Le modèle rédige la réponse du chat ; le document est construit directement à partir du résultat structuré, ce qui évite de recalculer ou de réinterpréter les montants.

## Si l’export échoue

Une erreur de création du fichier ne supprime pas l’estimation : l’API conserve les quantités et renvoie `report.status: unavailable`. L’agent indique que le PDF n’a pas pu être créé, sans proposer de faux lien.

Une demande qui ne permet pas encore de calculer des matériaux ne produit pas de rapport. Il faut compléter les informations nécessaires, puis relancer le calcul. Un lien inexistant ou mal formé renvoie une erreur 404.

## Conservation et accès

Les PDF et leurs instantanés JSON sont conservés dans `local-files/chantier-reports/`, ignoré par Git et monté dans le conteneur sous `/reports`. Le service ne publie que les fichiers PDF correspondant au format de lien prévu ; les instantanés JSON ne disposent pas de route de téléchargement.

Les identifiants de liens sont aléatoires sur 128 bits. Ils rendent les adresses difficiles à deviner, **mais ne constituent pas une authentification**. Le service reste accessible uniquement par son port local. Aucune purge automatique des rapports n’est encore configurée ; une exposition à des clients demanderait des droits d’accès, une durée de conservation et une politique de suppression.

## Comment le présenter en entretien

> « Une fois les quantités calculées, mon API génère un PDF à partir du même résultat structuré. L’agent reçoit le lien et le présente à l’utilisateur. Je n’utilise pas un second appel au modèle pour refaire le document : les quantités, les prix et les hypothèses restent ceux du calculateur. Si le PDF échoue, l’estimation reste disponible. Et si l’utilisateur change une dimension, je génère un nouvel instantané. »

Code associé : [calcul et route HTTP](../server.mjs), [rendu PDF](../pdf-report.mjs), [stockage et liens](../reports.mjs), [consignes du chat](../agent-prompt.txt).

## État de vérification de l’export

Le 4 octobre 2026, la suite complète a réussi **62 tests** : les 48 tests existants, 11 tests de l’API et du stockage des rapports, et 3 tests du rendu PDF. Après une correction du nettoyage des fichiers en cas d’écriture interrompue, les 11 tests API ont de nouveau réussi.

Les documents normal et partiel comportent chacun **trois pages** ; leur rendu a été inspecté. Le téléchargement HTTP a été vérifié avec une réponse 200 et un contenu PDF. Le cas 4 × 3 m présente **1 316,41 €** pour les matériaux sélectionnés ; le cas à 2,70 m conserve **153,01 €** de sous-total connu et un total global indéterminé.

La version avec export a été publiée dans n8n à **18 h 24, heure de Paris**. À **18 h 25**, une conversation réelle lancée avec la phrase 4 × 3 m a réussi en **16,215 secondes**, avec quatre outils et le lien **Télécharger l’étude PDF** dans la réponse. L’adresse affichée correspond au rapport retourné par le calculateur.

Le téléchargement de cette adresse a été vérifié par HTTP : réponse 200, type `application/pdf`, pièce jointe de **11 927 octets**. Le PDF contient trois pages, les cinq sous-totaux attendus, **1 316,41 €** et huit liens documentaires. Les trois pages de ce fichier et les trois pages du résultat partiel ont été inspectées visuellement. Le clic dans le chat a été effectué ; la confirmation du téléchargement dans l’interface de Chrome n’a pas été capturée. La preuve du fichier repose sur la réponse HTTP et le document inspecté. Les données de démonstration sont fictives.

![Réponse du chat avec le lien vers l’étude PDF](images/salle-de-bains/05-etude-pdf-chat.png)
