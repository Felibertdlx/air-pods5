/**
 * Every word on the page, in both languages.
 *
 * Copy lives here rather than inline so the score and the sections stay
 * structural: a key is a moment in the film or a block on the page, and the
 * language is resolved once, at the point of rendering.
 */

export type Lang = 'fr' | 'en'

export const LANGS: Lang[] = ['fr', 'en']

export interface Copy {
  eyebrow?: string
  title?: string
  body?: string
}

/** Captions on the timeline, keyed by the id the score refers to. */
export const CAPTIONS: Record<string, Record<Lang, Copy>> = {
  hero: {
    fr: { eyebrow: 'AirPods 5', title: 'Le son, révélé.' },
    en: { eyebrow: 'AirPods 5', title: 'Sound, revealed.' },
  },
  surface: {
    fr: {
      eyebrow: '01 — Surface',
      title: 'Une seule pièce.',
      body: 'Polycarbonate poli, 50,1 sur 46,2 millimètres, sans autre jointure que celle du capot.',
    },
    en: {
      eyebrow: '01 — Surface',
      title: 'One piece.',
      body: 'Polished polycarbonate, 50.1 by 46.2 millimetres, with no seam but the lid.',
    },
  },
  form: {
    fr: {
      eyebrow: '02 — Forme',
      title: 'Aucune face plate.',
      body: "La face avant est une superellipse plutôt qu'un rectangle arrondi, et les flancs ne cessent jamais de courber.",
    },
    en: {
      eyebrow: '02 — Form',
      title: 'No flat faces.',
      body: 'The front is a superellipse rather than a rounded rectangle, and the sides never stop curving.',
    },
  },
  hinge: {
    fr: {
      eyebrow: '03 — Charnière',
      title: 'Une seule pièce mobile.',
      body: "Une charnière en acier inoxydable au dos, et rien d'autre qui bouge sur le boîtier.",
    },
    en: {
      eyebrow: '03 — Hinge',
      title: 'One moving part.',
      body: 'A stainless steel hinge across the back, and nothing else on the case that moves.',
    },
  },
  open: {
    fr: {
      eyebrow: '04 — Ouverture',
      title: 'À l’intérieur.',
      body: 'Deux logements, moulés à la forme des écouteurs qu’ils reçoivent.',
    },
    en: {
      eyebrow: '04 — Open',
      title: 'Inside.',
      body: 'Two wells, moulded to the shape of the buds they hold.',
    },
  },
  wells: {
    fr: {
      eyebrow: '05 — Logements',
      body: 'Quatre contacts dorés au fond — une paire sous chaque tige.',
    },
    en: {
      eyebrow: '05 — Wells',
      body: 'Four gold contacts at the floor — a pair under each stem.',
    },
  },
  pair: {
    fr: {
      eyebrow: '06 — La paire',
      title: 'Deux exemplaires.',
      body: 'Réglés individuellement, acoustiquement identiques.',
    },
    en: {
      eyebrow: '06 — Pair',
      title: 'Two of them.',
      body: 'Individually tuned, acoustically identical.',
    },
  },
  mirror: {
    fr: {
      eyebrow: '07 — Symétrie',
      body: "En miroir, pas dupliqués. Le gauche et le droit sont deux pièces distinctes, jusqu'à l'évent.",
    },
    en: {
      eyebrow: '07 — Mirror',
      body: 'Mirrored, not duplicated. Left and right are different parts, down to the vent.',
    },
  },
  study: {
    fr: {
      eyebrow: '08 — Observation',
      title: 'Regardez de plus près.',
      body: 'Faites glisser pour tourner. Continuez à défiler pour la suite.',
    },
    en: {
      eyebrow: '08 — Study',
      title: 'Take a closer look.',
      body: 'Drag to turn it. Scroll to keep going.',
    },
  },
  aperture: {
    fr: {
      eyebrow: '09 — Ouverture acoustique',
      title: 'La grille.',
      body: "Des milliers de perforations, chacune sous le dixième de millimètre, devant le transducteur.",
    },
    en: {
      eyebrow: '09 — Aperture',
      title: 'The mesh.',
      body: 'Thousands of openings, each under a tenth of a millimetre, over the driver.',
    },
  },
  through: {
    fr: {
      eyebrow: '10 — Traversée',
      title: 'Au-delà de la surface.',
      body: "La coque est découpée au niveau de l'objectif à son passage, puis se referme derrière.",
    },
    en: {
      eyebrow: '10 — Through',
      title: 'Past the surface.',
      body: 'The shell is cut away at the lens as it crosses, then closes behind.',
    },
  },
  driver: {
    fr: {
      eyebrow: '11 — Transducteur',
      title: 'Ce qui produit le son.',
      body: 'Un transducteur dynamique : un dôme centré sur une bobine de cuivre, un aimant néodyme derrière.',
    },
    en: {
      eyebrow: '11 — Driver',
      title: 'What makes the sound.',
      body: 'A dynamic driver: a dome centred on a copper voice coil, a neodymium magnet behind it.',
    },
  },
  assembly: {
    fr: {
      eyebrow: '12 — Assemblage',
      title: 'Douze pièces.',
      body: 'Coque, bec, grille, transducteur, aimant, bobine, cellule, carte, puce, antenne, contacts.',
    },
    en: {
      eyebrow: '12 — Assembly',
      title: 'Twelve parts.',
      body: 'Enclosure, spout, mesh, driver, magnet, coil, cell, board, chip, antenna, contacts.',
    },
  },
  output: {
    fr: {
      eyebrow: '13 — Émission',
      title: 'Ce qu’il déplace.',
      body: "De l'air, déplacé devant la grille, quelques millionièmes de mètre à la fois.",
    },
    en: {
      eyebrow: '13 — Output',
      title: 'What it moves.',
      body: 'Air, displaced in front of the mesh, a few millionths of a metre at a time.',
    },
  },
  intake: {
    fr: {
      eyebrow: '14 — Captation',
      title: 'Ce qu’il entend.',
      body: 'Deux microphones. L’un au bec écoute vers l’extérieur, l’autre sur la tige vous écoute.',
    },
    en: {
      eyebrow: '14 — Intake',
      title: 'What it hears.',
      body: 'Two microphones. One at the spout listens outward, one at the stem listens to you.',
    },
  },
  silicon: {
    fr: {
      eyebrow: '15 — Électronique',
      title: 'Trois millimètres de large.',
      body: 'La puce sans fil, sur une carte qui court sur toute la longueur de la tige.',
    },
    en: {
      eyebrow: '15 — Silicon',
      title: 'Three millimetres wide.',
      body: 'The wireless chip, on a board that runs the whole length of the stem.',
    },
  },
  charge: {
    fr: {
      eyebrow: '16 — Énergie',
      title: "D'un bout à l'autre.",
      body: 'De la cellule dans la tête, le long de la tige, jusqu’aux deux contacts de la pointe.',
    },
    en: {
      eyebrow: '16 — Charge',
      title: 'End to end.',
      body: 'From the cell in the head, down the stem, to the two contacts at the tip.',
    },
  },
  reserve: {
    fr: {
      eyebrow: '17 — Réserve',
      title: 'Le boîtier en porte davantage.',
      body: 'Une cellule, une bobine de charge et une carte, dans l’étroite colonne que les deux logements laissent libre.',
    },
    en: {
      eyebrow: '17 — Reserve',
      title: 'The case carries more.',
      body: 'A cell, a charging coil and a board, in the narrow column the two wells leave free.',
    },
  },
  ret: {
    fr: {
      eyebrow: '18 — Retour',
      title: 'Chacun à sa place.',
      body: 'Toutes les pièces reviennent, dans l’ordre inverse du démontage.',
    },
    en: {
      eyebrow: '18 — Return',
      title: 'Back where it belongs.',
      body: 'Every part to its place, in the order it came apart.',
    },
  },
  seated: {
    fr: {
      eyebrow: '19 — En place',
      body: 'Chaque pointe de tige se pose sur sa paire de contacts. Le capot se referme.',
    },
    en: {
      eyebrow: '19 — Seated',
      body: 'Each stem tip lands on its pair of contacts. The lid closes over them.',
    },
  },
}

/** Everything outside the timeline. */
export const UI: Record<Lang, {
  scroll: string
  replay: string
  replayLabel: string
  markLabel: string
  themeToStudio: string
  themeToDark: string
  studio: string
  dark: string
  tier: (t: string) => string
  langLabel: string
  soundOn: string
  soundOff: string
  nav: { design: string; sound: string; inside: string; specs: string }
  outline: { title: string; body: string }
  sections: {
    design: Copy & { note: string; movingTitle: string; movingBody: string; wellsTitle: string; wellsBody: string; altClosed: string; altOpen: string }
    sound: Copy & { altBud: string; facts: [string, string][] }
    inside: Copy & { lead: string; parts: [string, string][] }
    specs: Copy & { rows: [string, string][]; buildTitle: string; build: [string, string][] }
    close: { title: string; body: string; cta: string }
    foot: string
  }
}> = {
  fr: {
    scroll: 'Défiler',
    replay: 'Revoir',
    replayLabel: 'Revoir depuis le début',
    markLabel: 'AirPods 5 — revenir au début',
    themeToStudio: 'Passer en lumière studio',
    themeToDark: 'Passer en ambiance sombre',
    studio: 'Studio',
    dark: 'Sombre',
    tier: (t) => `Qualité réduite à ${t} pour tenir la fluidité`,
    langLabel: 'Changer de langue',
    soundOn: 'Couper le son',
    soundOff: 'Activer le son',
    nav: { design: 'Design', sound: 'Son', inside: 'Intérieur', specs: 'Fiche' },
    outline: {
      title: 'AirPods 5 — Le son, révélé',
      body:
        "Une étude tridimensionnelle des AirPods 5 et de leur boîtier de charge, pilotée au défilement : le boîtier s'ouvre, les écouteurs en sortent, un passage macro sur la grille acoustique, une traversée de la coque jusqu'au transducteur, une vue éclatée des douze pièces, puis le remontage.",
    },
    sections: {
      design: {
        eyebrow: 'Design',
        title: 'Façonné par une\ncourbe continue.',
        body: "Le boîtier n'a aucune face plate. Sa face avant est une superellipse plutôt qu'un rectangle arrondi, et le profil prolonge cette courbe tout autour : aucune arête sur laquelle un reflet puisse se briser.",
        note: 'Cinquante millimètres de large, vingt et un de profondeur. Assez petit pour s’oublier dans une poche, assez dense pour se faire sentir.',
        movingTitle: 'Une seule pièce mobile',
        movingBody: "Une charnière en acier inoxydable traverse le dos. Rien d'autre ne bouge sur le boîtier : ni bouton sur le capot, ni loquet, ni jointure autre que celle de la charnière.",
        wellsTitle: 'Deux logements',
        wellsBody: 'À l’intérieur, un insert moulé retient chaque écouteur à la forme de son propre corps. Quatre contacts dorés au fond, une paire sous chaque tige.',
        altClosed: 'Le boîtier de charge fermé, vue de trois quarts',
        altOpen: 'Le boîtier de charge ouvert, laissant voir les deux logements',
      },
      sound: {
        eyebrow: 'Son',
        title: 'Un transducteur, et tout\nce qui s’organise autour.',
        body: 'Toute la tête est construite autour d’un seul transducteur. Un dôme centré sur une bobine de cuivre, un aimant néodyme derrière, et une grille tissée devant — des milliers de perforations, chacune sous le dixième de millimètre.',
        altBud: 'Un écouteur seul, vue de trois quarts',
        facts: [
          ['Émission', 'Un transducteur dynamique par écouteur, sur un axe dirigé à travers la grille vers le conduit auditif.'],
          ['Captation', 'Deux microphones. L’un au bec, tourné vers l’extérieur ; l’autre bas sur la tige, tourné vers vous.'],
          ['Pression', 'Un évent au dos de la tête, pour que le transducteur ne travaille pas contre un volume scellé.'],
        ],
      },
      inside: {
        eyebrow: 'Intérieur',
        title: 'Douze pièces, en trente millimètres.',
        lead: 'Chaque composant de la vue éclatée est modélisé pour tenir dans la cavité mesurée à l’intérieur de la coque réelle — pas placé à l’œil.',
        parts: [
          ['Coque', 'La coque moulée. Une seule pièce, avec le bec et l’évent qui s’y insèrent.'],
          ['Bec acoustique', 'Le port en relief sur la face interne, orienté vers le conduit auditif.'],
          ['Grille', 'Un écran tissé devant le transducteur, assez dense pour arrêter la poussière et laisser passer l’air.'],
          ['Transducteur', 'Un saladier, une membrane et un dôme anti-poussière, alignés sur un axe.'],
          ['Bobine', 'En cuivre, enroulée autour du col de la membrane.'],
          ['Aimant', 'Néodyme, directement derrière la bobine.'],
          ['Cellule', 'Une pile bouton occupant ce qui reste de la tête derrière l’aimant.'],
          ['Carte logique', 'Une carte étroite sur toute la longueur de la tige.'],
          ['Puce sans fil', 'Montée sur la face externe de la carte, vers le haut.'],
          ['Microphones', 'Deux : l’un au bec, l’autre bas sur la tige.'],
          ['Antenne', 'Une fine bande contre la paroi arrière de la tige.'],
          ['Contacts de charge', 'Deux bandes dorées autour de la pointe de la tige.'],
        ],
      },
      specs: {
        eyebrow: 'Fiche technique',
        title: 'Mesuré, pas estimé.',
        rows: [
          ['Largeur du boîtier', '50,1 mm'],
          ['Profondeur du boîtier', '21,2 mm'],
          ['Hauteur du boîtier', '46,2 mm'],
          ['Hauteur d’un écouteur', '30,2 mm'],
          ['Coque', 'Polycarbonate poli'],
          ['Charnière', 'Acier inoxydable, sur toute la largeur du dos'],
          ['Charge du boîtier', 'USB‑C sur le chant inférieur, bobine sans fil à l’intérieur'],
          ['Contacts', 'Deux bandes dorées par tige, quatre plots dans le boîtier'],
        ],
        buildTitle: 'Comment c’est fait',
        build: [
          ['Géométrie source', 'Blender — une scène d’écouteurs et un boîtier procédural à l’échelle réelle'],
          ['Préparation', 'Scriptée : sections mesurées, pièces de surface plaquées, composants internes construits'],
          ['Export', 'glTF 2.0 — 145 000 triangles pour les deux écouteurs, 72 000 pour le boîtier'],
          ['Exécution', 'React Three Fiber, Three.js, GLSL sur mesure'],
          ['Timeline', '29 images clés, échantillonnées par courbes de Catmull-Rom'],
          ['Transparence', 'Un alpha de Fresnel injecté dans le shader de la coque'],
          ['Traversée', 'Un plan de coupe solidaire de la caméra'],
        ],
      },
      close: {
        title: 'Le son, révélé.',
        body: 'Chaque image de cette page est calculée en direct à partir des deux mêmes modèles. Rien de ce qui précède n’est une vidéo.',
        cta: 'Revoir depuis le début',
      },
      foot: 'Une étude tridimensionnelle. Réalisée par Felibert.',
    },
  },

  en: {
    scroll: 'Scroll',
    replay: 'Replay',
    replayLabel: 'Replay from the beginning',
    markLabel: 'AirPods 5 — back to the beginning',
    themeToStudio: 'Switch to studio light',
    themeToDark: 'Switch to dark room',
    studio: 'Studio',
    dark: 'Dark',
    tier: (t) => `Quality reduced to ${t} to hold the frame rate`,
    langLabel: 'Change language',
    soundOn: 'Mute',
    soundOff: 'Sound on',
    nav: { design: 'Design', sound: 'Sound', inside: 'Inside', specs: 'Specs' },
    outline: {
      title: 'AirPods 5 — Sound, revealed',
      body:
        'A scroll-driven three-dimensional study of AirPods 5 and their charging case: the case opening, the earbuds leaving it, a macro pass over the acoustic mesh, a journey through the shell into the driver, an exploded view of all twelve parts, then reassembly.',
    },
    sections: {
      design: {
        eyebrow: 'Design',
        title: 'Shaped by one\ncontinuous curve.',
        body: 'The case has no flat faces. Its front is a superellipse rather than a rounded rectangle, and the profile carries that curve all the way round, so there is no edge for a highlight to break on.',
        note: 'Fifty millimetres across, twenty-one deep. Small enough to forget in a pocket, heavy enough to feel like something.',
        movingTitle: 'One moving part',
        movingBody: 'A stainless steel hinge spans the back. Nothing else on the case moves — no button on the lid, no catch, no seam other than the one the hinge makes.',
        wellsTitle: 'Two wells',
        wellsBody: 'Inside, a moulded insert holds each earbud in the shape of its own body. Four gold contacts sit at the floor, a pair beneath each stem.',
        altClosed: 'The closed charging case, three-quarter view',
        altOpen: 'The charging case with its lid open, showing the two wells',
      },
      sound: {
        eyebrow: 'Sound',
        title: 'A driver, and everything\narranged around it.',
        body: 'The whole head is built around one transducer. A dome centred on a copper voice coil, a neodymium magnet behind it, and a woven mesh in front — thousands of openings, each under a tenth of a millimetre.',
        altBud: 'A single earbud, three-quarter view',
        facts: [
          ['Output', 'One dynamic driver per earbud, on an axis aimed through the mesh at the ear canal.'],
          ['Intake', 'Two microphones. One at the spout, listening outward; one low on the stem, listening to you.'],
          ['Pressure', 'A vent on the back of the head, so the driver is not working against a sealed volume.'],
        ],
      },
      inside: {
        eyebrow: 'Inside',
        title: 'Twelve parts, in thirty millimetres.',
        lead: 'Every component in the exploded view above is modelled to fit the cavity that was measured inside the real shell — not placed by eye.',
        parts: [
          ['Enclosure', 'The moulded shell. One piece, with the spout and the vent set into it.'],
          ['Acoustic spout', 'The raised port on the inner face, angled towards the ear canal.'],
          ['Speaker mesh', 'A woven screen over the driver, dense enough to stop dust and pass air.'],
          ['Driver', 'A basket, a diaphragm and a dust dome, aligned on one axis.'],
          ['Voice coil', 'Copper, wound around the neck of the diaphragm.'],
          ['Magnet', 'Neodymium, directly behind the coil.'],
          ['Battery cell', 'A coin cell filling what is left of the head behind the magnet.'],
          ['Logic board', 'A narrow board running the length of the stem.'],
          ['Wireless chip', 'Mounted on the outer face of the board, near the top.'],
          ['Microphones', 'Two: one at the spout, one low on the stem.'],
          ['Antenna', 'A thin strip against the back wall of the stem.'],
          ['Charging contacts', 'Two gold bands around the stem tip.'],
        ],
      },
      specs: {
        eyebrow: 'Specifications',
        title: 'Measured, not estimated.',
        rows: [
          ['Case width', '50.1 mm'],
          ['Case depth', '21.2 mm'],
          ['Case height', '46.2 mm'],
          ['Earbud height', '30.2 mm'],
          ['Case shell', 'Polished polycarbonate'],
          ['Hinge', 'Stainless steel, spanning the back'],
          ['Case charging', 'USB-C on the lower edge, wireless coil inside'],
          ['Earbud contacts', 'Two gold bands per stem, four pads in the case'],
        ],
        buildTitle: 'How this was made',
        build: [
          ['Source geometry', 'Blender — an earbud scene and a procedural, real-scale case'],
          ['Preparation', 'Scripted: measured cross-sections, seated surface patches, built internals'],
          ['Export', 'glTF 2.0 — 145,000 triangles across both earbuds, 72,000 for the case'],
          ['Runtime', 'React Three Fiber, Three.js, custom GLSL'],
          ['Timeline', '29 keyframes, sampled with Catmull-Rom camera paths'],
          ['Transparency', 'A Fresnel alpha patched into the shell shader'],
          ['Pass-through', 'A clipping plane pinned to the camera'],
        ],
      },
      close: {
        title: 'Sound, revealed.',
        body: 'Every frame of this page is rendered live from the same two models. Nothing above is a video.',
        cta: 'Watch it again',
      },
      foot: 'A three-dimensional study. Built by Felibert.',
    },
  },
}
