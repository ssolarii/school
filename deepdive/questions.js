/* Editorial seed chart. Bands are designed for play, not measured population rarity.
   Keep the assignment JSON-compatible: serve.py reads this same trusted catalog. */
window.DEEP_DIVE_QUESTIONS = [
  {
    "id": "language",
    "group": "computing",
    "prompt": "Name a programming language.",
    "fact": "Programming languages tell computers what to do.",
    "answers": [
      [
        "python",
        "javascript",
        "java",
        "c++",
        "scratch",
        "c",
        100
      ],
      [
        "ruby",
        "swift",
        "kotlin",
        "typescript",
        "rust",
        "go",
        300
      ],
      [
        "haskell",
        "fortran",
        "cobol",
        "lua",
        "elixir",
        "assembly",
        600
      ],
      [
        "prolog",
        "ocaml",
        "ada",
        "apl",
        "malbolge",
        1000
      ]
    ]
  },
  {
    "id": "organ",
    "group": "science",
    "prompt": "Name an organ in the human body.",
    "fact": "Organs are groups of tissues working together.",
    "answers": [
      [
        "heart",
        "brain",
        "lungs",
        "liver",
        "stomach",
        100
      ],
      [
        "kidney",
        "skin",
        "intestine",
        "bladder",
        "pancreas",
        300
      ],
      [
        "spleen",
        "thyroid",
        "appendix",
        "gallbladder",
        "esophagus",
        600
      ],
      [
        "thymus",
        "pineal gland",
        "pituitary gland",
        "adrenal gland",
        1000
      ]
    ]
  },
  {
    "id": "invertebrate",
    "group": "science",
    "prompt": "Name an animal without a backbone.",
    "fact": "Invertebrates make up most animal species.",
    "answers": [
      [
        "worm",
        "jellyfish",
        "snail",
        "crab",
        "spider",
        100
      ],
      [
        "octopus",
        "starfish",
        "sea star",
        "shrimp",
        "butterfly",
        300
      ],
      [
        "sea cucumber",
        "anemone",
        "squid",
        "sea urchin",
        600
      ],
      [
        "coral",
        "caddisfly",
        "tardigrade",
        "sea squirt",
        1000
      ]
    ]
  },
  {
    "id": "file-transfer",
    "group": "computing",
    "prompt": "Name a way to move a file between laptops without internet.",
    "fact": "A local connection can move data without the internet.",
    "answers": [
      [
        "usb",
        "usb stick",
        "flash drive",
        "thumb drive",
        100
      ],
      [
        "bluetooth",
        "sd card",
        "external hard drive",
        300
      ],
      [
        "local network",
        "ethernet cable",
        "lan cable",
        "wifi direct",
        600
      ],
      [
        "peer to peer wifi",
        "peer-to-peer wi-fi",
        "nfc",
        1000
      ]
    ]
  },
  {
    "id": "reef-measure",
    "group": "belize",
    "prompt": "Name something a reef scientist can measure.",
    "fact": "Scientists monitor reefs to understand how they change.",
    "answers": [
      [
        "water temperature",
        "temperature",
        "water depth",
        "depth",
        100
      ],
      [
        "salinity",
        "water clarity",
        "fish population",
        "fish count",
        300
      ],
      [
        "dissolved oxygen",
        "ph",
        "coral cover",
        "turbidity",
        600
      ],
      [
        "coral recruitment",
        "bleaching prevalence",
        "carbonate chemistry",
        1000
      ]
    ]
  },
  {
    "id": "coast",
    "group": "belize",
    "prompt": "Name a natural feature that helps protect a coast.",
    "fact": "Coastal ecosystems can soften waves and reduce erosion.",
    "answers": [
      [
        "reef",
        "coral reef",
        "trees",
        100
      ],
      [
        "mangrove",
        "mangroves",
        "sand dune",
        "dunes",
        300
      ],
      [
        "seagrass",
        "seagrass bed",
        "wetland",
        "wetlands",
        600
      ],
      [
        "oyster reef",
        "barrier island",
        "salt marsh",
        1000
      ]
    ]
  },
  {
    "id": "float",
    "group": "science",
    "prompt": "Name a material that can float on water.",
    "fact": "Floating depends on density and shape.",
    "answers": [
      [
        "wood",
        "plastic",
        "foam",
        100
      ],
      [
        "cork",
        "ice",
        "bamboo",
        300
      ],
      [
        "wax",
        "aerogel",
        "rubber",
        600
      ],
      [
        "pumice",
        "expanded perlite",
        1000
      ]
    ]
  },
  {
    "id": "communicate",
    "group": "everyday",
    "prompt": "Name a way to communicate without speaking.",
    "fact": "Information can travel through words, symbols, light or movement.",
    "answers": [
      [
        "writing",
        "texting",
        "text message",
        "note",
        "sign language",
        100
      ],
      [
        "gesture",
        "drawing",
        "email",
        "hand signal",
        300
      ],
      [
        "morse code",
        "flag signals",
        "braille",
        "light signal",
        600
      ],
      [
        "semaphore",
        "tactile signing",
        "signal mirror",
        1000
      ]
    ]
  },
  {
    "id": "builder-animal",
    "group": "science",
    "prompt": "Name an animal that builds a structure.",
    "fact": "Animals build for shelter, protection, or raising young.",
    "answers": [
      [
        "bird",
        "beaver",
        "bee",
        "ant",
        100
      ],
      [
        "termite",
        "spider",
        "wasp",
        300
      ],
      [
        "coral",
        "hermit crab",
        "weaver bird",
        600
      ],
      [
        "caddisfly",
        "bowerbird",
        "paper nautilus",
        1000
      ]
    ]
  },
  {
    "id": "home-material",
    "group": "engineering",
    "prompt": "Name a material used to build a home.",
    "fact": "Materials are chosen for strength, climate and availability.",
    "answers": [
      [
        "wood",
        "brick",
        "concrete",
        "cement",
        100
      ],
      [
        "steel",
        "bamboo",
        "stone",
        "glass",
        300
      ],
      [
        "adobe",
        "earth block",
        "straw bale",
        "rammed earth",
        600
      ],
      [
        "hempcrete",
        "cross laminated timber",
        "mycelium",
        1000
      ]
    ]
  },
  {
    "id": "sensor",
    "group": "computing",
    "prompt": "Name a kind of sensor.",
    "fact": "Sensors turn physical changes into information computers can use.",
    "answers": [
      [
        "temperature sensor",
        "motion sensor",
        "light sensor",
        "camera",
        100
      ],
      [
        "microphone",
        "pressure sensor",
        "humidity sensor",
        "proximity sensor",
        300
      ],
      [
        "accelerometer",
        "gyroscope",
        "ultrasonic sensor",
        "infrared sensor",
        600
      ],
      [
        "lidar",
        "hall effect sensor",
        "spectrometer",
        1000
      ]
    ]
  },
  {
    "id": "runs-code",
    "group": "computing",
    "prompt": "Name something that runs computer code.",
    "fact": "Code can control many objects beyond a laptop.",
    "answers": [
      [
        "computer",
        "laptop",
        "phone",
        "smartphone",
        100
      ],
      [
        "tablet",
        "game console",
        "watch",
        "smartwatch",
        300
      ],
      [
        "car",
        "washing machine",
        "drone",
        "robot",
        600
      ],
      [
        "traffic light",
        "pacemaker",
        "satellite",
        "hearing aid",
        1000
      ]
    ]
  },
  {
    "id": "science-tool",
    "group": "science",
    "prompt": "Name a tool a scientist might use.",
    "fact": "Different tools help scientists observe, measure and compare.",
    "answers": [
      [
        "microscope",
        "ruler",
        "thermometer",
        100
      ],
      [
        "telescope",
        "scale",
        "measuring cylinder",
        300
      ],
      [
        "centrifuge",
        "ph meter",
        "spectroscope",
        600
      ],
      [
        "mass spectrometer",
        "electron microscope",
        "chromatograph",
        1000
      ]
    ]
  },
  {
    "id": "renewable",
    "group": "belize",
    "prompt": "Name a renewable source of electricity.",
    "fact": "Renewable power uses sources that can replenish naturally.",
    "answers": [
      [
        "solar",
        "sunlight",
        "wind",
        "water",
        100
      ],
      [
        "hydropower",
        "hydro",
        "geothermal",
        "biomass",
        300
      ],
      [
        "wave power",
        "tidal power",
        "biogas",
        600
      ],
      [
        "tidal movement",
        "ocean thermal energy",
        "salinity gradient",
        1000
      ]
    ]
  },
  {
    "id": "belize-animal",
    "group": "belize",
    "prompt": "Name an animal found in Belize.",
    "fact": "Belize is home to many land and marine species.",
    "answers": [
      [
        "jaguar",
        "toucan",
        "crocodile",
        "monkey",
        100
      ],
      [
        "tapir",
        "manatee",
        "howler monkey",
        "green iguana",
        300
      ],
      [
        "scarlet macaw",
        "whale shark",
        "ocelot",
        "coati",
        600
      ],
      [
        "hicatee",
        "jabiru",
        "harpy eagle",
        "baird tapir",
        1000
      ]
    ]
  },
  {
    "id": "lunch-waste",
    "group": "everyday",
    "prompt": "Name a way to make less rubbish at lunch.",
    "fact": "Reusing things can reduce the materials we throw away.",
    "answers": [
      [
        "reusable bottle",
        "reusable container",
        "lunchbox",
        100
      ],
      [
        "cloth napkin",
        "reusable cutlery",
        "pack lunch",
        300
      ],
      [
        "buy in bulk",
        "compost scraps",
        "avoid single use packaging",
        600
      ],
      [
        "returnable packaging",
        "refill station",
        "deposit container",
        1000
      ]
    ]
  },
  {
    "id": "cool-room",
    "group": "engineering",
    "prompt": "Name a way to cool a classroom without electricity.",
    "fact": "Building design can move heat and air without a motor.",
    "answers": [
      [
        "open windows",
        "shade",
        "fan",
        100
      ],
      [
        "curtains",
        "trees",
        "roof overhang",
        300
      ],
      [
        "cross ventilation",
        "high vents",
        "reflective roof",
        600
      ],
      [
        "stack ventilation",
        "thermal chimney",
        "earth tube",
        1000
      ]
    ]
  },
  {
    "id": "food-waste",
    "group": "everyday",
    "prompt": "Name a way to waste less food.",
    "fact": "Small planning habits can keep good food out of the bin.",
    "answers": [
      [
        "eat leftovers",
        "save leftovers",
        "finish your plate",
        100
      ],
      [
        "freeze food",
        "share food",
        "store food properly",
        300
      ],
      [
        "plan meals",
        "plan portions",
        "check expiry dates",
        600
      ],
      [
        "use vegetable scraps",
        "first in first out",
        "preserve surplus",
        1000
      ]
    ]
  }
];
