# Sources et périmètre du catalogue chantier

Ce prototype utilise une sélection de **sept références Leroy Merlin consultées le 4 octobre 2026**. Les caractéristiques et les prix ont été relevés dans les fiches produit, puis structurés dans [catalog.json](../catalog.json). Les questions et limites de calcul sont décrites dans [rules.json](../rules.json), version `chantier-v1`.

Il s'agit d'un catalogue daté et limité. Ce relevé ne constitue ni une recherche dans tout le site, ni une comparaison exhaustive du marché, ni une garantie de prix ou de stock en temps réel. Les références choisies sont annoncées comme vendues par Leroy Merlin dans les pages consultées. Le magasin, les disponibilités, les frais et le prix final restent à vérifier avant achat.

## Les sept références et leurs prix relevés

Tous les prix ci-dessous sont en euros, relevés le **04/10/2026**, pour le **conditionnement entier**. Les éco-participations affichées sont comprises dans ces montants ; elles ne sont pas ajoutées une seconde fois. Livraison, main-d'œuvre et accessoires non sélectionnés ne sont pas inclus.

| Référence fournisseur et fiche source | Conditionnement retenu | Prix du conditionnement | Prix indicatif affiché par unité de mesure |
| --- | --- | ---: | ---: |
| [95985488 — Arcano gris STN, 60 × 60 cm](https://www.leroymerlin.fr/produits/carrelage-sol-interieur-effet-beton-gris-arcano-l-60-x-l-60-cm-stn-1-08m2-95985488.html) | Carton de 3 carreaux, **1,08 m²** | **11,77 €** | 10,90 €/m² |
| [83275585 — Verve gris STN, 60 × 60 cm](https://www.leroymerlin.fr/produits/carrelage-sol-interieur-mur-interieur-effet-beton-gris-verve-l-60-x-l-60-cm-83275585.html) | Carton de 3 carreaux, **1,06 m²** | **14,73 €** | 13,90 €/m² |
| [69051871 — BA13 standard CE HOME PRATIK, 250 × 120 cm](https://www.leroymerlin.fr/produits/plaque-de-platre-ba-13-standard-ce-l-250-x-l-120-cm-69051871.html) | 1 plaque de **3 m²**, épaisseur 12,5 mm | **8,19 €** | 2,73 €/m² |
| [82369805 — BA13 Panelplac hydrofuge H1 NF HOME PRATIK, 250 × 120 cm](https://www.leroymerlin.fr/produits/plaque-de-platre-ba-13-panelplac-hydrofuge-h1-l-250-x-120-cm-nf-82369805.html) | 1 plaque de **3 m²**, épaisseur 12,5 mm | **20,91 €** | 6,97 €/m² |
| [82709661 — Rail ISOLPRO R48](https://www.leroymerlin.fr/produits/rail-de-48-l-3-m-82709661.html) | 1 rail de **3 m** | **3,80 €** | 1,27 €/m |
| [82709664 — Montant ISOLPRO M48](https://www.leroymerlin.fr/produits/montant-de-48-l-2-5-m-82709664.html) | 1 montant de **2,5 m** | **3,80 €** | 1,52 €/m |
| [82115946 — ISOVER Cloison Duo nu, 45 mm](https://www.leroymerlin.fr/produits/lot-de-2x2-rouleaux-laine-de-verre-cloison-duo-isover-nu-ep-45mm-6-5x0-6m-r1-1-82115946.html) | Lot de 4 rouleaux de 6,5 × 0,6 m, soit **15,6 m²** | **51,79 €** | 3,32 €/m² |

Le calcul utilise le prix du paquet et arrondit le nombre de paquets au supérieur. Les prix par mètre ou mètre carré servent à la lecture de la fiche ; leur arrondi peut différer légèrement du prix du conditionnement. Pour Verve, la contenance annoncée de **1,06 m²** prime sur un calcul utilisant les dimensions nominales des carreaux.

## Pièce humide : carrelage et plaque de plâtre sont deux sujets différents

**Le catalogue contient explicitement `metadata.room_types: ["dry", "wet"]` pour les deux carrelages.** Cette métadonnée permet leur sélection pour un métré de carreaux dans le périmètre de salle de bains privative retenu. Elle ne signifie pas que toute pose en zone humide est validée.

Les fiches Arcano et Verve indiquent une destination sol intérieur et mur intérieur, ainsi que les classes de glissance **R9** et **A**. Elles excluent l'utilisation dans ou autour d'une piscine. Ces informations ne constituent pas, seules, une validation de receveur de douche, de sol public humide, de support, de colle ou de système d'étanchéité. Les notes `wet_use_note` et `pool_compatible: false` conservent cette distinction dans les données. Les conditions du projet et de la zone doivent être vérifiées séparément.

Pour les **plaques de plâtre**, le filtre est différent : la plaque standard est limitée à `dry` ; la plaque hydrofuge sélectionnée porte explicitement `moisture_resistance: "H1"` et accepte `dry` ou `wet`. La seule mention commerciale « hydrofuge », ou la couleur verte, ne remplace pas la vérification de la classe H1.

Une plaque H1 n'est pas une étanchéité complète. La face exposée, le pied de cloison, les joints, les traversées et la finition participent au système. La V1 peut chiffrer une même référence H1 sur les deux faces d'une cloison : c'est une **hypothèse conservatrice annoncée**, pas l'affirmation que les deux faces doivent toujours être hydrofuges.

## Sources fabricants utilisées pour les règles

Les pages suivantes ont été consultées le **04/10/2026**. Elles donnent des repères de systèmes fabricants ; elles ne certifient pas automatiquement l'assemblage multimarque de la sélection commerciale.

| Source primaire | Apport au prototype | Limite d'interprétation |
| --- | --- | --- |
| [Placo — Monter une cloison sur ossature Placostil](https://www.placo.fr/comment-monter-une-cloison-sur-ossature-placostil) | Distingue simple et double parement, entraxe, montants simples ou doublés. Repère retenu : M48 simples à 600 mm, une plaque par face, hauteur de 2,50 m. | La cloison simple parement possède **deux faces**. Les limites du système décrit ne sont pas une certification de composants de marques différentes. |
| [Placo — Doublage sur rails et montants Stil](https://www.placo.fr/comment-isoler-un-mur-avec-un-doublage-sur-ossature-rails-et-montants-stil) | À une face, sans reprise intermédiaire : M48 simples à 600 mm jusqu'à 2,10 m ; M48 doublés à 600 mm jusqu'à 2,50 m. | Le prototype demande un système de doublage validé avant son métré d'ossature. Diviser seulement le nombre de plaques d'une cloison ne suffit pas. |
| [Placo — Classement des locaux humides](https://www.placo.fr/humidite-reglementation-et-classement-des-locaux-humides) | Qualification de l'usage du local et emploi de plaques H1 pour les parois verticales des locaux EB+ privatifs. | Les autres composants et les zones exposées restent à étudier. Les locaux collectifs, piscines et plafonds ne sont pas dimensionnés par cette V1. |
| [Placo — L'Intégrale, juin 2025, page 194](https://www.placo.fr/documents/integrale-placo/lintegrale-placor-1.pdf) | Pour une cloison à parement simple d'épaisseur au plus 15 mm, un carreau de plus de 1 600 cm² limite l'entraxe des montants à 40 cm. | Un carreau 60 × 60 cm représente 3 600 cm². Le prototype ne valide donc pas sa pose sur l'ossature simple à entraxe 600 mm. |
| [ISOVER — Applications des laines de verre de 45 mm](https://www.isover.fr/laine-de-verre/laine-de-verre-45mm) | Distingue les produits et leurs applications, notamment l'acoustique des cloisons résidentielles. | Une épaisseur de 45 mm ne démontre pas la performance thermique d'un mur extérieur. Le conditionnement exact de Cloison Duo provient de sa fiche Leroy Merlin. |

## Hypothèses de calcul et postes exclus

Les formules géométriques du prototype sont documentées dans `quantity_policy` de [rules.json](../rules.json). Les marges de coupe et les provisions ne sont pas présentées comme des exigences normatives. Le calcul contrôle les unités de vente, distingue deux faces de plaques d'une seule cavité isolée et conserve un minimum de plaques par largeur de pan.

La proposition reste un approvisionnement partiel. Vis, fixations adaptées au support, bandes, enduits, renforts et détails d'huisseries, protections à l'eau, colle et joints de carrelage, préparation, peinture, transport et main-d'œuvre ne sont pas chiffrés. Les ouvertures complexes et le plan de coupe doivent être vérifiés avant achat. Aucun résultat n'atteste la résistance mécanique, une performance acoustique, une tenue au feu ou une conformité thermique de l'ouvrage.

## Présentation pendant l'entretien

Une formulation fidèle au fonctionnement de la démonstration :

> « L'agent cherche dans sept références que j'ai sélectionnées, sourcées et datées. Le fournisseur reste identifiable pour chaque ligne. Le modèle organise la conversation et choisit les outils ; le calculateur utilise les conditionnements du catalogue et applique des règles explicites. »

Pour expliquer le choix technique :

> « J'ai choisi un petit périmètre vérifiable. Une recherche globale et des prix en direct demanderaient un connecteur fournisseur fiable, un mécanisme de mise à jour, des contrôles sur les variations et une politique de repli. Ici, je montre la date du relevé et je distingue une quantité calculée d'une compatibilité technique à valider. »

Trois points concrets à montrer à l'écran :

- La contenance réelle de Verve : **1,06 m² par carton**, conservée malgré le format commercial 60 × 60.
- La qualification d'une salle de bains : **H1 pour les plaques**, vérification séparée des usages et de la glissance pour le carrelage.
- Une limite assumée : demander le système de doublage ou la finition carrelée au lieu d'inventer une ossature et une conformité.

La date de relevé et la présence d'un lien rendent l'origine des données traçable. Elles ne prouvent pas que la page n'a pas changé depuis, ni que tous les paramètres d'un chantier réel ont été vérifiés.
