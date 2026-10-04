# Agent achats chantier — conception

Objectif : préparer une liste d'achat estimative de matériaux de carrelage ou de plaques de plâtre, fondée sur des références fournisseurs traçables et des calculs reproductibles.

## Parcours

Le chat natif n8n transmet la demande à un véritable nœud AI Agent. Le modèle choisit ses appels à quatre outils : règles du cas d'usage, recherche dans le catalogue sourcé, consultation d'une fiche et calcul des quantités. Une mémoire de conversation permet de modifier une dimension ou un budget sans recommencer.

Le premier échange doit distinguer carrelage, cloison non porteuse, doublage et plafond. Pour les plaques : type de pièce et exposition à l'eau, dimensions des pans, hauteur, ouvertures, parement et isolation. Une plaque hydrofuge ne constitue pas à elle seule un système d'étanchéité.

Les quantités sont des estimations d'approvisionnement. Les plafonds, systèmes structurels, résistance au feu, performance thermique/réglementaire et choix complexes d'ossature ne sont pas dimensionnés par ce prototype. Les hypothèses et les compléments non chiffrés accompagnent la liste.

## Séparation

- Branche : `feat/agent-achats-chantier`.
- Dossier autonome : `chantier/`.
- Nouveau workflow et nouvelle URL de chat, sans remplacer la qualification IA existante.
- Le service d'outils ne possède pas de clé de modèle. Le modèle est appelé depuis le nœud natif n8n.
- Aucune commande fournisseur n'est passée.

## Données fournisseurs

Le catalogue contient une sélection datée de fiches Leroy Merlin et des règles issues de fabricants. La recherche porte sur ce catalogue, pas sur l'intégralité du Web. Une consultation en ligne ne doit jamais être présentée comme réussie si l'extraction est impossible : conserver explicitement la date du relevé et son statut.

## Validation prévue

Calculs et contrôles de domaine en tests isolés. Exécutions réelles de l'agent pour une demande incomplète, un cas de carrelage, une cloison et un cas de pièce humide. Inspection des appels d'outils dans n8n. Captures du canvas et explications simples pour l'entretien.
