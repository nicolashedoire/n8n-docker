# Sources et périmètre du catalogue chantier

Ce prototype utilise une sélection de **onze références consultées le 4 octobre 2026**, chez Leroy Merlin, L’Entrepôt du Bricolage et Bricorama. Les caractéristiques et les prix ont été relevés dans les fiches produit, puis structurés dans [catalog.json](../catalog.json). Les questions et limites de calcul sont décrites dans [rules.json](../rules.json), version `chantier-v2-bathroom`.

Il s'agit d'un catalogue daté et limité. Ce relevé ne constitue ni une recherche dans tout le site, ni une comparaison exhaustive du marché, ni une garantie de prix ou de stock en temps réel. Les sept références initiales proviennent de Leroy Merlin. La proposition de salle de bains ajoute des composants PLACO et ISOVER chez deux autres enseignes, pour conserver une ossature et un parement de la même famille fabricant. Le magasin, les disponibilités, les frais et le prix final restent à vérifier avant achat.

## Les sept références initiales et leurs prix relevés

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
| [Placo — Doublage sur rails et montants Stil](https://www.placo.fr/comment-isoler-un-mur-avec-un-doublage-sur-ossature-rails-et-montants-stil) | À une face, sans reprise intermédiaire : M48 simples à 600 mm jusqu'à 2,10 m ; M48 doublés à 600 mm jusqu'à 2,50 m. | Le mode salle de bains utilise un panier dédié PLACO ; les doublages hors de ce scénario restent à qualifier. Diviser seulement le nombre de plaques d’une cloison ne suffit pas. |
| [Placo — Classement des locaux humides](https://www.placo.fr/humidite-reglementation-et-classement-des-locaux-humides) | Qualification de l'usage du local et emploi de plaques H1 pour les parois verticales des locaux EB+ privatifs. | Les autres composants et les zones exposées restent à étudier. Les locaux collectifs, piscines et plafonds ne sont pas dimensionnés par cette V1. |
| [Placo — L'Intégrale, juin 2025, page 194](https://www.placo.fr/documents/integrale-placo/lintegrale-placor-1.pdf) | Pour une cloison à parement simple d'épaisseur au plus 15 mm, un carreau de plus de 1 600 cm² limite l'entraxe des montants à 40 cm. | Un carreau 60 × 60 cm représente 3 600 cm². Le prototype ne valide donc pas sa pose sur l'ossature simple à entraxe 600 mm. |
| [ISOVER — Applications des laines de verre de 45 mm](https://www.isover.fr/laine-de-verre/laine-de-verre-45mm) | Distingue les produits et leurs applications, notamment l'acoustique des cloisons résidentielles. | Une épaisseur de 45 mm ne démontre pas la performance thermique d'un mur extérieur. Le conditionnement exact de Cloison Duo provient de sa fiche Leroy Merlin. |

## Hypothèses de calcul et postes exclus

Les formules géométriques du prototype sont documentées dans `quantity_policy` de [rules.json](../rules.json). Les marges de coupe et les provisions ne sont pas présentées comme des exigences normatives. Le calcul contrôle les unités de vente, distingue deux faces de plaques d'une seule cavité isolée et conserve un minimum de plaques par largeur de pan.

La proposition reste un approvisionnement partiel. Vis, fixations adaptées au support, bandes, enduits, renforts et détails d'huisseries, protections à l'eau, colle et joints de carrelage, préparation, peinture, transport et main-d'œuvre ne sont pas chiffrés. Les ouvertures complexes et le plan de coupe doivent être vérifiés avant achat. Aucun résultat n'atteste la résistance mécanique, une performance acoustique, une tenue au feu ou une conformité thermique de l'ouvrage.

## Présentation pendant l'entretien

Une formulation fidèle au fonctionnement de la démonstration :

> « L’agent cherche dans onze références que j’ai sélectionnées, sourcées et datées. Le fournisseur reste identifiable pour chaque ligne. Le modèle organise la conversation et choisit les outils ; le calculateur utilise les conditionnements du catalogue et applique des règles explicites. »

Pour expliquer le choix technique :

> « J'ai choisi un petit périmètre vérifiable. Une recherche globale et des prix en direct demanderaient un connecteur fournisseur fiable, un mécanisme de mise à jour, des contrôles sur les variations et une politique de repli. Ici, je montre la date du relevé et je distingue une quantité calculée d'une compatibilité technique à valider. »

Trois points concrets à montrer à l'écran :

- La contenance réelle de Verve : **1,06 m² par carton**, conservée malgré le format commercial 60 × 60.
- La qualification d'une salle de bains : **H1 pour les plaques**, vérification séparée des usages et de la glissance pour le carrelage.
- Une distinction utile : chiffrer les matériaux de base de la salle de bains sous hypothèses, puis signaler les protections de douche et finitions qui demandent un choix technique.

La date de relevé et la présence d'un lien rendent l'origine des données traçable. Elles ne prouvent pas que la page n'a pas changé depuis, ni que tous les paramètres d'un chantier réel ont été vérifiés.


## Extension : salle de bains rectangulaire à partir de deux dimensions

La règle `bathroom_private_initial_estimate` ajoute un scénario de budget initial. Pour une demande telle que « Je refais une salle de bains de 4 m sur 3 m », les seules mesures exigées sont la longueur et la largeur. Le calcul affiche ensuite ses hypothèses : hauteur 2,50 m, marge 10 %, quatre murs à doubler, parement H1 d’un seul côté, finition légère et isolant intérieur de 45 mm. Les ouvertures et équipements inconnus ne sont pas déduits des surfaces brutes. Cela n’affirme pas que la pièce n’a pas de porte ou de douche.

Le choix de finition légère est une base de chiffrage à corriger si nécessaire. **Il ne propose pas une peinture ordinaire dans une douche.** Une douche ou une baignoire ne supprime pas les quantités géométriques ; son implantation, ses revêtements et sa protection à l’eau restent à compléter séparément.

### Quatre références ajoutées

| Source fournisseur | Unité de vente retenue | Prix relevé | Particularité |
| --- | --- | ---: | --- |
| [L’Entrepôt — Placomarine H1 BA13, réf. 13895](https://www.entrepot-du-bricolage.fr/p/pr-plaque-de-platre-hydrofuge-ba13-pour-piece-humide-h-250-x-l-60-cm-placo-13895) | 1 plaque de 250 × 60 cm, soit **1,50 m²** | **14,85 €** | Classe H1 explicite ; face du doublage côté salle de bains. |
| [Bricorama — rail Stil R48, EAN 3496250071520](https://www.bricorama.fr/p/rail-placor-stilr-r-48-nf-3m/3496250071520) | 1 rail de **3 m** | **8,10 €** | **Prix conseillé**, à confirmer dans le magasin retenu ; il n’est pas présenté comme une offre locale ferme. |
| [L’Entrepôt — montant Stil M48, réf. 32866](https://www.entrepot-du-bricolage.fr/p/pr-montant-stil-m48-l-2-79-m-l-48-x-ep-35-mm-placo-32866) | 1 montant de **2,79 m** | **5,50 €** | À recouper pour l’ouvrage de 2,50 m ; compté par paires dans le doublage. |
| [Leroy Merlin — Isocoton 45 mm, réf. 91782738](https://www.leroymerlin.fr/produits/13-panneaux-isolants-en-textiles-recycles-isover-isocoton-ep-45mm-1-2x0-6m-r1-25-91782738.html) | **Lot de 13 panneaux** de 120 × 60 cm, soit **9,36 m²** | **64,58 €** | Conditionnement marchand explicite ; on achète des lots entiers. |

Ces prix sont relevés le **04/10/2026**. Aucun stock, délai ou panier de commande n’a été vérifié. Le mode de rafraîchissement d’une fiche ne doit jamais inventer un prix en cas de page inaccessible.

La fiche Leroy Merlin Isocoton annonce explicitement **13 panneaux et 9,36 m² par lot**. Le calcul arrondit donc les lots, pas seulement les panneaux. Pour 35 m² de murs et 10 % de réserve, 38,5 m² demandés conduisent à cinq lots, soit 65 panneaux et 46,8 m² achetés. [La documentation fabricant ISOVER](https://www.isover.fr/guides/materiaux-isolants/comment-choisir-son-isolant/lisolant-biosource-en-textiles-recycles) confirme les dimensions de 120 × 60 cm et l’épaisseur de 45 mm. Cette documentation inclut l’emploi en contre-cloisons sur rails et montants avec Placo. Le prototype n’en déduit aucune performance acoustique, thermique ou de résistance au feu. Les conditions de pose et de gestion de vapeur restent à vérifier ; il ne s’agit pas d’une étude d’isolation extérieure.

### Repère de doublage et exposition à l’eau

La règle `bathroom_lining_placo_m48_double_600` reprend la géométrie du [guide de doublage Placo](https://www.placo.fr/comment-isoler-un-mur-avec-un-doublage-sur-ossature-rails-et-montants-stil) : simple parement, montants M48 doublés, entraxe 600 mm et hauteur limitée à 2,50 m sans reprise intermédiaire. Les nouvelles plaques et ossatures appartiennent à la famille fabricant décrite. Les rails, plaques et isolants ne constituent toutefois qu’une partie d’un ouvrage : joints, fixations, raccords et support ne sont pas dimensionnés.

**Pour un doublage simple parement recevant du carrelage mural, ce même guide indique 400 mm d’entraxe.** La limite n’est donc pas seulement liée aux carreaux de 60 × 60 du précédent scénario de cloison. Une modification vers une finition murale carrelée ne peut pas réutiliser silencieusement l’ossature à 600 mm.

Le [guide Placo des locaux humides](https://www.placo.fr/humidite-reglementation-et-classement-des-locaux-humides) distingue parement H1, traitements des pieds, joints et traversées, ainsi que les systèmes de protection des surfaces exposées. Le prototype garde ces postes dans une liste à compléter. Il ne prétend ni que « H1 suffit », ni qu’un produit de protection unique convient à tous les supports.

Le sol est une provision de carreaux Arcano pour la surface brute de la pièce. Le [carrelage Arcano sélectionné](https://www.leroymerlin.fr/produits/carrelage-sol-interieur-effet-beton-gris-arcano-l-60-x-l-60-cm-stn-1-08m2-95985488.html) a une destination sol intérieur et les classes affichées R9/A ; ces mentions ne valident pas automatiquement son usage au fond d’une douche carrelée. L’emprise d’un receveur est déduite seulement quand elle est fournie, et les produits spécifiques du receveur restent hors budget.

### Pourquoi le premier budget peut avancer

Un achat préparatoire et un dimensionnement d’exécution n’ont pas le même besoin d’information. La longueur et la largeur suffisent à calculer une surface de sol, un périmètre et une provision de matériaux sous une hauteur explicitement supposée. Le résultat est présenté comme un **budget partiel à affiner**, avec les postes inconnus visibles. Une information nouvelle remplace l’hypothèse et déclenche un nouveau calcul ; elle n’est jamais ignorée pour préserver le scénario de démonstration.
