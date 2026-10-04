# Agent achats chantier — conception

Objectif : préparer une liste d'achat estimative de matériaux de carrelage ou de plaques de plâtre, fondée sur des références fournisseurs traçables et des calculs reproductibles.

## Parcours

Le chat natif n8n transmet la demande à un véritable nœud AI Agent. Le modèle choisit ses appels à quatre outils : règles du cas d'usage, recherche dans le catalogue sourcé, consultation d'une fiche et calcul des quantités. Une mémoire de conversation permet de modifier une dimension ou un budget sans recommencer.

Une salle de bains accompagnée de sa longueur et de sa largeur déclenche directement une estimation provisoire de la pièce : sol carrelé et doublage de quatre murs. Le moteur propose les paramètres absents (hauteur, marge, ouvertures non déduites, finition et isolation) et indique leur origine. L’agent présente d’abord cette première liste, puis pose une question courte pour l’affiner. Il ne demande pas à l’utilisateur de choisir des identifiants de produits ou un entraxe.

Les demandes ciblées de cloison, de carrelage ou de doublage isolé restent distinctes. Les géométries ne sont pas interchangeables : quatre murs doublés ont une face de parement par mur, contrairement à une cloison à deux faces. Une plaque hydrofuge ne constitue pas à elle seule un système d’étanchéité.

Les quantités sont des estimations d'approvisionnement. Les plafonds, systèmes structurels, résistance au feu, performance thermique/réglementaire et choix complexes d'ossature ne sont pas dimensionnés par ce prototype. Les hypothèses et les compléments non chiffrés accompagnent la liste.

## Séparation

- Branche : `feat/agent-achats-chantier`.
- Dossier autonome : `chantier/`.
- Nouveau workflow et nouvelle URL de chat, sans remplacer la qualification IA existante.
- Le service d'outils ne possède pas de clé de modèle. Le modèle est appelé depuis le nœud natif n8n.
- Aucune commande fournisseur n'est passée.

## Données fournisseurs

Le catalogue contient une sélection datée de fiches fournisseurs et des règles issues de fabricants. La recherche porte sur ce catalogue, pas sur l’intégralité du Web. Chaque ligne conserve son enseigne et la nature du prix relevé. Une consultation en ligne ne doit jamais être présentée comme réussie si l’extraction est impossible : conserver explicitement la date du relevé et son statut.

## Affinage de l’expérience — 4 octobre 2026

Le premier scénario demandait trop d’informations avant d’apporter une estimation, et la note du canvas pouvait être collée comme une seule demande contenant deux tours. Le scénario principal devient une seule phrase : « Je refais ma salle de bains de 4 m sur 3 m. »

Le modèle ne complète pas discrètement les valeurs manquantes. Il transmet les seules données connues ; le calculateur applique une politique d’hypothèses documentée et distingue valeurs fournies, valeurs proposées et postes non chiffrés. La marge de 10 % et la hauteur de 2,50 m sont des choix de préparation modifiables, pas des faits déclarés par l’utilisateur.

Une douche ne bloque pas tous les lots : un approvisionnement provisoire peut rester utile, tandis que le receveur et la protection à l’eau demandent une étude séparée. Si une hauteur ou une finition dépasse le système documenté, le résultat conserve les lots calculables et signale les autres comme incomplets. Aucun sous-total ne doit devenir un prix de rénovation complète.

## Validation prévue

Calculs et contrôles de domaine en tests isolés. Les scénarios historiques restent couverts. La nouvelle campagne part des seules dimensions, ajoute une douche, puis modifie la hauteur dans la même conversation. Elle vérifie l’origine des hypothèses, le calcul des quatre murs et la conservation des lots calculables. Les réponses et appels d’outils réels sont relus ; captures du canvas et guide d’entretien documentent les résultats observés.
