/** Captured from frozen simulator study commit 8523e634; original randomBattle SHA256 d4d863b05c613ad2f9e030b07f8e6aa0e0ea27751702a50f3b1001dbe9409ad1. */
import type { DefenderStack, JointAttackerStack } from '../../src/combat.js';
interface ReferenceBattle { name: string; attackers: readonly JointAttackerStack[]; defenders: readonly DefenderStack[]; shield: number; seed: string | number; precise: boolean; maintenance: boolean; expected: unknown }
export const distributedCombatReference: readonly ReferenceBattle[] = [
  {
    "name": "corsair20",
    "attackers": [
      {
        "contributionId": "a",
        "playerId": "a",
        "fleet": {
          "CORSAIR": 20
        },
        "tech": {
          "tech": {}
        }
      }
    ],
    "defenders": [
      {
        "stackId": "host",
        "playerId": "d",
        "fleet": {
          "CORSAIR": 20
        },
        "tech": {
          "tech": {}
        }
      }
    ],
    "shield": 0,
    "seed": 11,
    "precise": true,
    "maintenance": false,
    "expected": {
      "grade": "DECISIVE",
      "lossRatio": 1,
      "rounds": [
        {
          "round": 1,
          "attackerRoll": 1.0172989702597262,
          "defenderRoll": 1.0144252217561007,
          "attackerDamage": 8301,
          "defenderDamage": 8278,
          "shieldBefore": 0,
          "shieldAfter": 0,
          "shieldAbsorbed": 0,
          "shieldBreakerDamage": 0,
          "attackerShipShieldAbsorbed": 7235,
          "defenderShipShieldAbsorbed": 7435,
          "attackerHullDamage": 866,
          "attackerLosses": {},
          "defenderLosses": {},
          "retreats": [],
          "casualties": []
        },
        {
          "round": 2,
          "attackerRoll": 1.056124271377921,
          "defenderRoll": 1.0060835675895214,
          "attackerDamage": 8618,
          "defenderDamage": 8210,
          "shieldBefore": 0,
          "shieldAfter": 0,
          "shieldAbsorbed": 0,
          "shieldBreakerDamage": 0,
          "attackerShipShieldAbsorbed": 305,
          "defenderShipShieldAbsorbed": 105,
          "attackerHullDamage": 8513,
          "attackerLosses": {},
          "defenderLosses": {},
          "retreats": [],
          "casualties": []
        },
        {
          "round": 3,
          "attackerRoll": 0.9328041858226062,
          "defenderRoll": 1.0048808818683028,
          "attackerDamage": 7612,
          "defenderDamage": 8200,
          "shieldBefore": 0,
          "shieldAfter": 0,
          "shieldAbsorbed": 0,
          "shieldBreakerDamage": 0,
          "attackerShipShieldAbsorbed": 0,
          "defenderShipShieldAbsorbed": 0,
          "attackerHullDamage": 7612,
          "attackerLosses": {},
          "defenderLosses": {},
          "retreats": [],
          "casualties": []
        },
        {
          "round": 4,
          "attackerRoll": 1.0172378534078599,
          "defenderRoll": 0.9920519825071097,
          "attackerDamage": 8301,
          "defenderDamage": 8095,
          "shieldBefore": 0,
          "shieldAfter": 0,
          "shieldAbsorbed": 0,
          "shieldBreakerDamage": 0,
          "attackerShipShieldAbsorbed": 0,
          "defenderShipShieldAbsorbed": 0,
          "attackerHullDamage": 8301,
          "attackerLosses": {},
          "defenderLosses": {},
          "retreats": [
            {
              "side": "ATTACK",
              "playerId": "a",
              "stackId": "a",
              "fleet": {
                "CORSAIR": 1
              }
            },
            {
              "side": "DEFENCE",
              "playerId": "d",
              "stackId": "host",
              "fleet": {
                "CORSAIR": 3
              }
            }
          ],
          "casualties": []
        },
        {
          "round": 5,
          "attackerRoll": 0.9968067951872945,
          "defenderRoll": 1.054963307529688,
          "attackerDamage": 4001,
          "defenderDamage": 4531,
          "shieldBefore": 0,
          "shieldAfter": 0,
          "shieldAbsorbed": 0,
          "shieldBreakerDamage": 0,
          "attackerShipShieldAbsorbed": 0,
          "defenderShipShieldAbsorbed": 0,
          "attackerHullDamage": 4001,
          "attackerLosses": {
            "CORSAIR": 19
          },
          "defenderLosses": {
            "CORSAIR": 17
          },
          "retreats": [],
          "casualties": [
            {
              "side": "ATTACK",
              "playerId": "a",
              "stackId": "a",
              "fleet": {
                "CORSAIR": 19
              }
            },
            {
              "side": "DEFENCE",
              "playerId": "d",
              "stackId": "host",
              "fleet": {
                "CORSAIR": 17
              }
            }
          ]
        }
      ],
      "shieldLeft": 0,
      "shieldProtectedArmed": 0,
      "attackerSurvivors": {
        "CORSAIR": 1
      },
      "defenderSurvivors": {
        "CORSAIR": 3
      },
      "attackerRetreated": {
        "CORSAIR": 1
      },
      "defenderRetreated": {
        "CORSAIR": 3
      },
      "attackerCombatSurvivors": {},
      "attackerRetreatDamage": [
        {
          "hull": "CORSAIR",
          "count": 1,
          "damageBp": 7435,
          "remainderBp": 0.8790454143572788
        }
      ],
      "defenderRetreatDamage": [
        {
          "hull": "CORSAIR",
          "count": 1,
          "damageBp": 8879,
          "remainderBp": 0.9660981694614748
        },
        {
          "hull": "CORSAIR",
          "count": 1,
          "damageBp": 8006,
          "remainderBp": 0.5031391500151585
        },
        {
          "hull": "CORSAIR",
          "count": 1,
          "damageBp": 7362,
          "remainderBp": 0.14887434602951544
        }
      ],
      "attackerLosses": {
        "CORSAIR": 19
      },
      "defenderLosses": {
        "CORSAIR": 17
      },
      "attackerLossValue": 133760,
      "defenderLossValue": 119680,
      "defenceSalvage": {},
      "attackerDamage": [
        {
          "hull": "CORSAIR",
          "count": 1,
          "damageBp": 7435,
          "remainderBp": 0.8790454143572788
        }
      ],
      "defenderDamage": [
        {
          "hull": "CORSAIR",
          "count": 1,
          "damageBp": 8879,
          "remainderBp": 0.9660981694614748
        },
        {
          "hull": "CORSAIR",
          "count": 1,
          "damageBp": 8006,
          "remainderBp": 0.5031391500151585
        },
        {
          "hull": "CORSAIR",
          "count": 1,
          "damageBp": 7362,
          "remainderBp": 0.14887434602951544
        }
      ],
      "contributions": [
        {
          "contributionId": "a",
          "playerId": "a",
          "sent": {
            "CORSAIR": 20
          },
          "survivors": {
            "CORSAIR": 1
          },
          "retreated": {
            "CORSAIR": 1
          },
          "losses": {
            "CORSAIR": 19
          },
          "lossValue": 133760,
          "hullDamage": 29292.69161123915,
          "survivorDamage": [
            {
              "hull": "CORSAIR",
              "count": 1,
              "damageBp": 7435,
              "remainderBp": 0.8790454143572788
            }
          ]
        }
      ],
      "defenders": [
        {
          "stackId": "host",
          "playerId": "d",
          "sent": {
            "CORSAIR": 20
          },
          "survivors": {
            "CORSAIR": 3
          },
          "retreated": {
            "CORSAIR": 3
          },
          "losses": {
            "CORSAIR": 17
          },
          "lossValue": 119680,
          "survivorDamage": [
            {
              "hull": "CORSAIR",
              "count": 1,
              "damageBp": 8879,
              "remainderBp": 0.9660981694614748
            },
            {
              "hull": "CORSAIR",
              "count": 1,
              "damageBp": 8006,
              "remainderBp": 0.5031391500151585
            },
            {
              "hull": "CORSAIR",
              "count": 1,
              "damageBp": 7362,
              "remainderBp": 0.14887434602951544
            }
          ]
        }
      ]
    }
  },
  {
    "name": "citadel-shields4",
    "attackers": [
      {
        "contributionId": "a",
        "playerId": "a",
        "fleet": {
          "CITADEL": 10
        },
        "tech": {
          "tech": {
            "SHIP_SHIELDS": 4
          }
        }
      }
    ],
    "defenders": [
      {
        "stackId": "host",
        "playerId": "d",
        "fleet": {
          "CITADEL": 10
        },
        "tech": {
          "tech": {
            "SHIP_SHIELDS": 4
          }
        }
      }
    ],
    "shield": 0,
    "seed": 22,
    "precise": true,
    "maintenance": false,
    "expected": {
      "grade": "REPELLED",
      "lossRatio": 0,
      "rounds": [
        {
          "round": 1,
          "attackerRoll": 0.9560287889838219,
          "defenderRoll": 0.9528508147597313,
          "attackerDamage": 4254,
          "defenderDamage": 4240,
          "shieldBefore": 0,
          "shieldAfter": 0,
          "shieldAbsorbed": 0,
          "shieldBreakerDamage": 0,
          "attackerShipShieldAbsorbed": 4240,
          "defenderShipShieldAbsorbed": 4254,
          "attackerHullDamage": 0,
          "attackerLosses": {},
          "defenderLosses": {},
          "retreats": [],
          "casualties": []
        },
        {
          "round": 2,
          "attackerRoll": 0.978331548832357,
          "defenderRoll": 1.0635408866778016,
          "attackerDamage": 4354,
          "defenderDamage": 4733,
          "shieldBefore": 0,
          "shieldAfter": 0,
          "shieldAbsorbed": 0,
          "shieldBreakerDamage": 0,
          "attackerShipShieldAbsorbed": 4733,
          "defenderShipShieldAbsorbed": 4330,
          "attackerHullDamage": 23,
          "attackerLosses": {},
          "defenderLosses": {},
          "retreats": [],
          "casualties": []
        },
        {
          "round": 3,
          "attackerRoll": 0.9912594808638097,
          "defenderRoll": 1.0277198810875416,
          "attackerDamage": 4411,
          "defenderDamage": 4573,
          "shieldBefore": 0,
          "shieldAfter": 0,
          "shieldAbsorbed": 0,
          "shieldBreakerDamage": 0,
          "attackerShipShieldAbsorbed": 1817,
          "defenderShipShieldAbsorbed": 2205,
          "attackerHullDamage": 2206,
          "attackerLosses": {},
          "defenderLosses": {},
          "retreats": [],
          "casualties": []
        },
        {
          "round": 4,
          "attackerRoll": 1.0391595402359963,
          "defenderRoll": 0.9226435302197934,
          "attackerDamage": 4624,
          "defenderDamage": 4106,
          "shieldBefore": 0,
          "shieldAfter": 0,
          "shieldAbsorbed": 0,
          "shieldBreakerDamage": 0,
          "attackerShipShieldAbsorbed": 0,
          "defenderShipShieldAbsorbed": 0,
          "attackerHullDamage": 4624,
          "attackerLosses": {},
          "defenderLosses": {},
          "retreats": [],
          "casualties": []
        },
        {
          "round": 5,
          "attackerRoll": 0.9371686144545675,
          "defenderRoll": 0.9415019089356065,
          "attackerDamage": 4170,
          "defenderDamage": 4190,
          "shieldBefore": 0,
          "shieldAfter": 0,
          "shieldAbsorbed": 0,
          "shieldBreakerDamage": 0,
          "attackerShipShieldAbsorbed": 0,
          "defenderShipShieldAbsorbed": 0,
          "attackerHullDamage": 4170,
          "attackerLosses": {},
          "defenderLosses": {},
          "retreats": [],
          "casualties": []
        },
        {
          "round": 6,
          "attackerRoll": 0.949261011518538,
          "defenderRoll": 0.9996492599323392,
          "attackerDamage": 4224,
          "defenderDamage": 4448,
          "shieldBefore": 0,
          "shieldAfter": 0,
          "shieldAbsorbed": 0,
          "shieldBreakerDamage": 0,
          "attackerShipShieldAbsorbed": 0,
          "defenderShipShieldAbsorbed": 0,
          "attackerHullDamage": 4224,
          "attackerLosses": {},
          "defenderLosses": {},
          "retreats": [],
          "casualties": []
        }
      ],
      "shieldLeft": 0,
      "shieldProtectedArmed": 0,
      "attackerSurvivors": {
        "CITADEL": 10
      },
      "defenderSurvivors": {
        "CITADEL": 10
      },
      "attackerRetreated": {},
      "defenderRetreated": {},
      "attackerCombatSurvivors": {
        "CITADEL": 10
      },
      "attackerRetreatDamage": [],
      "defenderRetreatDamage": [],
      "attackerLosses": {},
      "defenderLosses": {},
      "attackerLossValue": 0,
      "defenderLossValue": 0,
      "defenceSalvage": {},
      "attackerDamage": [
        {
          "hull": "CITADEL",
          "count": 1,
          "damageBp": 8612,
          "remainderBp": 0.10739775683759945
        },
        {
          "hull": "CITADEL",
          "count": 1,
          "damageBp": 8076,
          "remainderBp": 0.8955379255139633
        },
        {
          "hull": "CITADEL",
          "count": 1,
          "damageBp": 8030,
          "remainderBp": 0.6360901161324364
        },
        {
          "hull": "CITADEL",
          "count": 1,
          "damageBp": 7869,
          "remainderBp": 0.8703494550381947
        },
        {
          "hull": "CITADEL",
          "count": 1,
          "damageBp": 7650,
          "remainderBp": 0.33943324899246363
        },
        {
          "hull": "CITADEL",
          "count": 1,
          "damageBp": 7200,
          "remainderBp": 0.7820854517531188
        },
        {
          "hull": "CITADEL",
          "count": 1,
          "damageBp": 7142,
          "remainderBp": 0.03027864699561178
        },
        {
          "hull": "CITADEL",
          "count": 1,
          "damageBp": 6700,
          "remainderBp": 0.5189750554709462
        },
        {
          "hull": "CITADEL",
          "count": 1,
          "damageBp": 5403,
          "remainderBp": 0.741216164636171
        },
        {
          "hull": "CITADEL",
          "count": 1,
          "damageBp": 5139,
          "remainderBp": 0.6910234678798588
        }
      ],
      "defenderDamage": [
        {
          "hull": "CITADEL",
          "count": 1,
          "damageBp": 7952,
          "remainderBp": 0.5957780602011553
        },
        {
          "hull": "CITADEL",
          "count": 1,
          "damageBp": 7912,
          "remainderBp": 0.42144582989567425
        },
        {
          "hull": "CITADEL",
          "count": 1,
          "damageBp": 7555,
          "remainderBp": 0.8794936448621229
        },
        {
          "hull": "CITADEL",
          "count": 1,
          "damageBp": 7452,
          "remainderBp": 0.5973979184600466
        },
        {
          "hull": "CITADEL",
          "count": 1,
          "damageBp": 7259,
          "remainderBp": 0.22491492105837096
        },
        {
          "hull": "CITADEL",
          "count": 1,
          "damageBp": 7138,
          "remainderBp": 0.7789068948241038
        },
        {
          "hull": "CITADEL",
          "count": 1,
          "damageBp": 6671,
          "remainderBp": 0.4546881832893632
        },
        {
          "hull": "CITADEL",
          "count": 1,
          "damageBp": 6638,
          "remainderBp": 0.6477019587482573
        },
        {
          "hull": "CITADEL",
          "count": 1,
          "damageBp": 6100,
          "remainderBp": 0.7767081775728002
        },
        {
          "hull": "CITADEL",
          "count": 1,
          "damageBp": 5975,
          "remainderBp": 0.08349618334341358
        }
      ],
      "contributions": [
        {
          "contributionId": "a",
          "playerId": "a",
          "sent": {
            "CITADEL": 10
          },
          "survivors": {
            "CITADEL": 10
          },
          "retreated": {},
          "losses": {},
          "lossValue": 0,
          "hullDamage": 15247.87998275645,
          "survivorDamage": [
            {
              "hull": "CITADEL",
              "count": 1,
              "damageBp": 8612,
              "remainderBp": 0.10739775683759945
            },
            {
              "hull": "CITADEL",
              "count": 1,
              "damageBp": 8076,
              "remainderBp": 0.8955379255139633
            },
            {
              "hull": "CITADEL",
              "count": 1,
              "damageBp": 8030,
              "remainderBp": 0.6360901161324364
            },
            {
              "hull": "CITADEL",
              "count": 1,
              "damageBp": 7869,
              "remainderBp": 0.8703494550381947
            },
            {
              "hull": "CITADEL",
              "count": 1,
              "damageBp": 7650,
              "remainderBp": 0.33943324899246363
            },
            {
              "hull": "CITADEL",
              "count": 1,
              "damageBp": 7200,
              "remainderBp": 0.7820854517531188
            },
            {
              "hull": "CITADEL",
              "count": 1,
              "damageBp": 7142,
              "remainderBp": 0.03027864699561178
            },
            {
              "hull": "CITADEL",
              "count": 1,
              "damageBp": 6700,
              "remainderBp": 0.5189750554709462
            },
            {
              "hull": "CITADEL",
              "count": 1,
              "damageBp": 5403,
              "remainderBp": 0.741216164636171
            },
            {
              "hull": "CITADEL",
              "count": 1,
              "damageBp": 5139,
              "remainderBp": 0.6910234678798588
            }
          ]
        }
      ],
      "defenders": [
        {
          "stackId": "host",
          "playerId": "d",
          "sent": {
            "CITADEL": 10
          },
          "survivors": {
            "CITADEL": 10
          },
          "retreated": {},
          "losses": {},
          "lossValue": 0,
          "survivorDamage": [
            {
              "hull": "CITADEL",
              "count": 1,
              "damageBp": 7952,
              "remainderBp": 0.5957780602011553
            },
            {
              "hull": "CITADEL",
              "count": 1,
              "damageBp": 7912,
              "remainderBp": 0.42144582989567425
            },
            {
              "hull": "CITADEL",
              "count": 1,
              "damageBp": 7555,
              "remainderBp": 0.8794936448621229
            },
            {
              "hull": "CITADEL",
              "count": 1,
              "damageBp": 7452,
              "remainderBp": 0.5973979184600466
            },
            {
              "hull": "CITADEL",
              "count": 1,
              "damageBp": 7259,
              "remainderBp": 0.22491492105837096
            },
            {
              "hull": "CITADEL",
              "count": 1,
              "damageBp": 7138,
              "remainderBp": 0.7789068948241038
            },
            {
              "hull": "CITADEL",
              "count": 1,
              "damageBp": 6671,
              "remainderBp": 0.4546881832893632
            },
            {
              "hull": "CITADEL",
              "count": 1,
              "damageBp": 6638,
              "remainderBp": 0.6477019587482573
            },
            {
              "hull": "CITADEL",
              "count": 1,
              "damageBp": 6100,
              "remainderBp": 0.7767081775728002
            },
            {
              "hull": "CITADEL",
              "count": 1,
              "damageBp": 5975,
              "remainderBp": 0.08349618334341358
            }
          ]
        }
      ]
    }
  },
  {
    "name": "vantasia-real-shape",
    "attackers": [
      {
        "contributionId": "a",
        "playerId": "a",
        "fleet": {
          "ATLAS": 1,
          "CITADEL": 3,
          "CORSAIR": 5,
          "PALADIN": 5,
          "CATACLYSM": 11
        },
        "tech": {
          "tech": {
            "SHIP_POWER": 5,
            "SHIP_ARMOR": 5,
            "SHIP_SHIELDS": 4
          }
        }
      }
    ],
    "defenders": [
      {
        "stackId": "host",
        "playerId": "d",
        "fleet": {
          "DART": 235,
          "THORN": 15,
          "COURIER": 2
        },
        "tech": {
          "tech": {
            "SHIP_POWER": 2
          }
        }
      }
    ],
    "shield": 150,
    "seed": "9865571b-fda2-4af5-86e7-a051712410d2",
    "precise": true,
    "maintenance": false,
    "expected": {
      "grade": "DECISIVE",
      "lossRatio": 1,
      "rounds": [
        {
          "round": 1,
          "attackerRoll": 0.9585855862498284,
          "defenderRoll": 1.0759640852734447,
          "attackerDamage": 22836,
          "defenderDamage": 6694,
          "shieldBefore": 150,
          "shieldAfter": 0,
          "shieldAbsorbed": 150,
          "shieldBreakerDamage": 0,
          "attackerShipShieldAbsorbed": 6694,
          "defenderShipShieldAbsorbed": 4524,
          "attackerHullDamage": 18162,
          "attackerLosses": {},
          "defenderLosses": {
            "DART": 106
          },
          "retreats": [
            {
              "side": "DEFENCE",
              "playerId": "d",
              "stackId": "host",
              "fleet": {
                "DART": 26
              }
            }
          ],
          "casualties": [
            {
              "side": "DEFENCE",
              "playerId": "d",
              "stackId": "host",
              "fleet": {
                "DART": 106
              }
            }
          ]
        },
        {
          "round": 2,
          "attackerRoll": 0.9224906150251627,
          "defenderRoll": 0.9221744252741337,
          "attackerDamage": 3109,
          "defenderDamage": 2877,
          "shieldBefore": 0,
          "shieldAfter": 0,
          "shieldAbsorbed": 0,
          "shieldBreakerDamage": 0,
          "attackerShipShieldAbsorbed": 2877,
          "defenderShipShieldAbsorbed": 45,
          "attackerHullDamage": 3064,
          "attackerLosses": {},
          "defenderLosses": {
            "DART": 103,
            "COURIER": 2,
            "THORN": 15
          },
          "retreats": [],
          "casualties": [
            {
              "side": "DEFENCE",
              "playerId": "d",
              "stackId": "host",
              "fleet": {
                "DART": 103,
                "COURIER": 2,
                "THORN": 15
              }
            }
          ]
        }
      ],
      "shieldLeft": 0,
      "shieldProtectedArmed": 149.99999999999994,
      "attackerSurvivors": {
        "ATLAS": 1,
        "CATACLYSM": 11,
        "CORSAIR": 5,
        "CITADEL": 3,
        "PALADIN": 5
      },
      "defenderSurvivors": {
        "DART": 26
      },
      "attackerRetreated": {},
      "defenderRetreated": {
        "DART": 26
      },
      "attackerCombatSurvivors": {
        "CATACLYSM": 11,
        "CORSAIR": 5,
        "CITADEL": 3,
        "PALADIN": 5
      },
      "attackerRetreatDamage": [],
      "defenderRetreatDamage": [
        {
          "hull": "DART",
          "count": 1,
          "damageBp": 9903,
          "remainderBp": 0.6950979548910254
        },
        {
          "hull": "DART",
          "count": 1,
          "damageBp": 9864,
          "remainderBp": 0.40430185524928675
        },
        {
          "hull": "DART",
          "count": 1,
          "damageBp": 9657,
          "remainderBp": 0.5141172386774997
        },
        {
          "hull": "DART",
          "count": 1,
          "damageBp": 9622,
          "remainderBp": 0.667138564891502
        },
        {
          "hull": "DART",
          "count": 1,
          "damageBp": 9615,
          "remainderBp": 0.9172485106209933
        },
        {
          "hull": "DART",
          "count": 1,
          "damageBp": 9544,
          "remainderBp": 0.8850371086809901
        },
        {
          "hull": "DART",
          "count": 1,
          "damageBp": 9374,
          "remainderBp": 0.9769392341877392
        },
        {
          "hull": "DART",
          "count": 1,
          "damageBp": 9367,
          "remainderBp": 0.95571115974235
        },
        {
          "hull": "DART",
          "count": 1,
          "damageBp": 9361,
          "remainderBp": 0.501897566664411
        },
        {
          "hull": "DART",
          "count": 1,
          "damageBp": 9138,
          "remainderBp": 0.6837481922430015
        },
        {
          "hull": "DART",
          "count": 1,
          "damageBp": 9070,
          "remainderBp": 0.2158176615848788
        },
        {
          "hull": "DART",
          "count": 1,
          "damageBp": 8936,
          "remainderBp": 0.34246103459554433
        },
        {
          "hull": "DART",
          "count": 1,
          "damageBp": 8727,
          "remainderBp": 0.3258257962716016
        },
        {
          "hull": "DART",
          "count": 1,
          "damageBp": 8677,
          "remainderBp": 0.6066481656380347
        },
        {
          "hull": "DART",
          "count": 1,
          "damageBp": 8493,
          "remainderBp": 0.8134390167160745
        },
        {
          "hull": "DART",
          "count": 1,
          "damageBp": 8471,
          "remainderBp": 0.7177291010539193
        },
        {
          "hull": "DART",
          "count": 1,
          "damageBp": 8439,
          "remainderBp": 0.6265113852623472
        },
        {
          "hull": "DART",
          "count": 1,
          "damageBp": 8384,
          "remainderBp": 0.2378542428068613
        },
        {
          "hull": "DART",
          "count": 1,
          "damageBp": 8274,
          "remainderBp": 0.06647919501665456
        },
        {
          "hull": "DART",
          "count": 1,
          "damageBp": 8213,
          "remainderBp": 0.26622212830989156
        },
        {
          "hull": "DART",
          "count": 1,
          "damageBp": 8203,
          "remainderBp": 0.49900277549022576
        },
        {
          "hull": "DART",
          "count": 1,
          "damageBp": 7867,
          "remainderBp": 0.26589419529409497
        },
        {
          "hull": "DART",
          "count": 1,
          "damageBp": 7707,
          "remainderBp": 0.2340146149172142
        },
        {
          "hull": "DART",
          "count": 1,
          "damageBp": 7520,
          "remainderBp": 0.09407124582321558
        },
        {
          "hull": "DART",
          "count": 1,
          "damageBp": 6165,
          "remainderBp": 0.8171736099920963
        },
        {
          "hull": "DART",
          "count": 1,
          "damageBp": 5765,
          "remainderBp": 0.893402004508971
        }
      ],
      "attackerLosses": {},
      "defenderLosses": {
        "DART": 209,
        "COURIER": 2,
        "THORN": 15
      },
      "attackerLossValue": 0,
      "defenderLossValue": 95061,
      "defenceSalvage": {
        "THORN": 9
      },
      "attackerDamage": [],
      "defenderDamage": [
        {
          "hull": "DART",
          "count": 1,
          "damageBp": 9903,
          "remainderBp": 0.6950979548910254
        },
        {
          "hull": "DART",
          "count": 1,
          "damageBp": 9864,
          "remainderBp": 0.40430185524928675
        },
        {
          "hull": "DART",
          "count": 1,
          "damageBp": 9657,
          "remainderBp": 0.5141172386774997
        },
        {
          "hull": "DART",
          "count": 1,
          "damageBp": 9622,
          "remainderBp": 0.667138564891502
        },
        {
          "hull": "DART",
          "count": 1,
          "damageBp": 9615,
          "remainderBp": 0.9172485106209933
        },
        {
          "hull": "DART",
          "count": 1,
          "damageBp": 9544,
          "remainderBp": 0.8850371086809901
        },
        {
          "hull": "DART",
          "count": 1,
          "damageBp": 9374,
          "remainderBp": 0.9769392341877392
        },
        {
          "hull": "DART",
          "count": 1,
          "damageBp": 9367,
          "remainderBp": 0.95571115974235
        },
        {
          "hull": "DART",
          "count": 1,
          "damageBp": 9361,
          "remainderBp": 0.501897566664411
        },
        {
          "hull": "DART",
          "count": 1,
          "damageBp": 9138,
          "remainderBp": 0.6837481922430015
        },
        {
          "hull": "DART",
          "count": 1,
          "damageBp": 9070,
          "remainderBp": 0.2158176615848788
        },
        {
          "hull": "DART",
          "count": 1,
          "damageBp": 8936,
          "remainderBp": 0.34246103459554433
        },
        {
          "hull": "DART",
          "count": 1,
          "damageBp": 8727,
          "remainderBp": 0.3258257962716016
        },
        {
          "hull": "DART",
          "count": 1,
          "damageBp": 8677,
          "remainderBp": 0.6066481656380347
        },
        {
          "hull": "DART",
          "count": 1,
          "damageBp": 8493,
          "remainderBp": 0.8134390167160745
        },
        {
          "hull": "DART",
          "count": 1,
          "damageBp": 8471,
          "remainderBp": 0.7177291010539193
        },
        {
          "hull": "DART",
          "count": 1,
          "damageBp": 8439,
          "remainderBp": 0.6265113852623472
        },
        {
          "hull": "DART",
          "count": 1,
          "damageBp": 8384,
          "remainderBp": 0.2378542428068613
        },
        {
          "hull": "DART",
          "count": 1,
          "damageBp": 8274,
          "remainderBp": 0.06647919501665456
        },
        {
          "hull": "DART",
          "count": 1,
          "damageBp": 8213,
          "remainderBp": 0.26622212830989156
        },
        {
          "hull": "DART",
          "count": 1,
          "damageBp": 8203,
          "remainderBp": 0.49900277549022576
        },
        {
          "hull": "DART",
          "count": 1,
          "damageBp": 7867,
          "remainderBp": 0.26589419529409497
        },
        {
          "hull": "DART",
          "count": 1,
          "damageBp": 7707,
          "remainderBp": 0.2340146149172142
        },
        {
          "hull": "DART",
          "count": 1,
          "damageBp": 7520,
          "remainderBp": 0.09407124582321558
        },
        {
          "hull": "DART",
          "count": 1,
          "damageBp": 6165,
          "remainderBp": 0.8171736099920963
        },
        {
          "hull": "DART",
          "count": 1,
          "damageBp": 5765,
          "remainderBp": 0.893402004508971
        }
      ],
      "contributions": [
        {
          "contributionId": "a",
          "playerId": "a",
          "sent": {
            "ATLAS": 1,
            "CITADEL": 3,
            "CORSAIR": 5,
            "PALADIN": 5,
            "CATACLYSM": 11
          },
          "survivors": {
            "ATLAS": 1,
            "CATACLYSM": 11,
            "CORSAIR": 5,
            "CITADEL": 3,
            "PALADIN": 5
          },
          "retreated": {},
          "losses": {},
          "lossValue": 0,
          "hullDamage": 21225.650723133433,
          "survivorDamage": []
        }
      ],
      "defenders": [
        {
          "stackId": "host",
          "playerId": "d",
          "sent": {
            "DART": 235,
            "THORN": 15,
            "COURIER": 2
          },
          "survivors": {
            "DART": 26
          },
          "retreated": {
            "DART": 26
          },
          "losses": {
            "DART": 209,
            "COURIER": 2,
            "THORN": 15
          },
          "lossValue": 95061,
          "survivorDamage": [
            {
              "hull": "DART",
              "count": 1,
              "damageBp": 9903,
              "remainderBp": 0.6950979548910254
            },
            {
              "hull": "DART",
              "count": 1,
              "damageBp": 9864,
              "remainderBp": 0.40430185524928675
            },
            {
              "hull": "DART",
              "count": 1,
              "damageBp": 9657,
              "remainderBp": 0.5141172386774997
            },
            {
              "hull": "DART",
              "count": 1,
              "damageBp": 9622,
              "remainderBp": 0.667138564891502
            },
            {
              "hull": "DART",
              "count": 1,
              "damageBp": 9615,
              "remainderBp": 0.9172485106209933
            },
            {
              "hull": "DART",
              "count": 1,
              "damageBp": 9544,
              "remainderBp": 0.8850371086809901
            },
            {
              "hull": "DART",
              "count": 1,
              "damageBp": 9374,
              "remainderBp": 0.9769392341877392
            },
            {
              "hull": "DART",
              "count": 1,
              "damageBp": 9367,
              "remainderBp": 0.95571115974235
            },
            {
              "hull": "DART",
              "count": 1,
              "damageBp": 9361,
              "remainderBp": 0.501897566664411
            },
            {
              "hull": "DART",
              "count": 1,
              "damageBp": 9138,
              "remainderBp": 0.6837481922430015
            },
            {
              "hull": "DART",
              "count": 1,
              "damageBp": 9070,
              "remainderBp": 0.2158176615848788
            },
            {
              "hull": "DART",
              "count": 1,
              "damageBp": 8936,
              "remainderBp": 0.34246103459554433
            },
            {
              "hull": "DART",
              "count": 1,
              "damageBp": 8727,
              "remainderBp": 0.3258257962716016
            },
            {
              "hull": "DART",
              "count": 1,
              "damageBp": 8677,
              "remainderBp": 0.6066481656380347
            },
            {
              "hull": "DART",
              "count": 1,
              "damageBp": 8493,
              "remainderBp": 0.8134390167160745
            },
            {
              "hull": "DART",
              "count": 1,
              "damageBp": 8471,
              "remainderBp": 0.7177291010539193
            },
            {
              "hull": "DART",
              "count": 1,
              "damageBp": 8439,
              "remainderBp": 0.6265113852623472
            },
            {
              "hull": "DART",
              "count": 1,
              "damageBp": 8384,
              "remainderBp": 0.2378542428068613
            },
            {
              "hull": "DART",
              "count": 1,
              "damageBp": 8274,
              "remainderBp": 0.06647919501665456
            },
            {
              "hull": "DART",
              "count": 1,
              "damageBp": 8213,
              "remainderBp": 0.26622212830989156
            },
            {
              "hull": "DART",
              "count": 1,
              "damageBp": 8203,
              "remainderBp": 0.49900277549022576
            },
            {
              "hull": "DART",
              "count": 1,
              "damageBp": 7867,
              "remainderBp": 0.26589419529409497
            },
            {
              "hull": "DART",
              "count": 1,
              "damageBp": 7707,
              "remainderBp": 0.2340146149172142
            },
            {
              "hull": "DART",
              "count": 1,
              "damageBp": 7520,
              "remainderBp": 0.09407124582321558
            },
            {
              "hull": "DART",
              "count": 1,
              "damageBp": 6165,
              "remainderBp": 0.8171736099920963
            },
            {
              "hull": "DART",
              "count": 1,
              "damageBp": 5765,
              "remainderBp": 0.893402004508971
            }
          ]
        }
      ]
    }
  },
  {
    "name": "joint-supported-ground",
    "attackers": [
      {
        "contributionId": "a",
        "playerId": "a",
        "fleet": {
          "CORSAIR": 5,
          "CATACLYSM": 2
        },
        "tech": {
          "tech": {}
        }
      },
      {
        "contributionId": "b",
        "playerId": "b",
        "fleet": {
          "CITADEL": 4,
          "COURIER": 1
        },
        "tech": {
          "tech": {
            "SHIP_POWER": 3,
            "SHIP_ARMOR": 2
          }
        }
      }
    ],
    "defenders": [
      {
        "stackId": "host",
        "playerId": "d",
        "fleet": {
          "DART": 25,
          "THORN": 4,
          "COURIER": 1
        },
        "tech": {
          "tech": {}
        }
      },
      {
        "stackId": "support",
        "playerId": "s",
        "fleet": {
          "PALADIN": 3,
          "GARBAGE_COLLECTOR": 1
        },
        "tech": {
          "tech": {
            "SHIP_POWER": 2,
            "SHIP_SHIELDS": 4
          }
        }
      }
    ],
    "shield": 600,
    "seed": 33,
    "precise": true,
    "maintenance": false,
    "expected": {
      "grade": "DECISIVE",
      "lossRatio": 1,
      "rounds": [
        {
          "round": 1,
          "attackerRoll": 1.01921329587698,
          "defenderRoll": 0.9226236095651985,
          "attackerDamage": 6356,
          "defenderDamage": 2591,
          "shieldBefore": 600,
          "shieldAfter": 0,
          "shieldAbsorbed": 600,
          "shieldBreakerDamage": 0,
          "attackerShipShieldAbsorbed": 2208,
          "defenderShipShieldAbsorbed": 2801,
          "attackerHullDamage": 2954,
          "attackerLosses": {},
          "defenderLosses": {
            "DART": 25,
            "THORN": 4
          },
          "retreats": [],
          "casualties": [
            {
              "side": "DEFENCE",
              "playerId": "d",
              "stackId": "host",
              "fleet": {
                "DART": 25,
                "THORN": 4
              }
            }
          ]
        },
        {
          "round": 2,
          "attackerRoll": 0.9914445361495019,
          "defenderRoll": 1.0510277385264635,
          "attackerDamage": 5845,
          "defenderDamage": 1843,
          "shieldBefore": 0,
          "shieldAfter": 0,
          "shieldAbsorbed": 0,
          "shieldBreakerDamage": 0,
          "attackerShipShieldAbsorbed": 1261,
          "defenderShipShieldAbsorbed": 443,
          "attackerHullDamage": 5402,
          "attackerLosses": {},
          "defenderLosses": {
            "COURIER": 1,
            "GARBAGE_COLLECTOR": 1,
            "PALADIN": 3
          },
          "retreats": [],
          "casualties": [
            {
              "side": "DEFENCE",
              "playerId": "d",
              "stackId": "host",
              "fleet": {
                "COURIER": 1
              }
            },
            {
              "side": "DEFENCE",
              "playerId": "s",
              "stackId": "support",
              "fleet": {
                "GARBAGE_COLLECTOR": 1,
                "PALADIN": 3
              }
            }
          ]
        }
      ],
      "shieldLeft": 0,
      "shieldProtectedArmed": 600,
      "attackerSurvivors": {
        "COURIER": 1,
        "CATACLYSM": 2,
        "CORSAIR": 5,
        "CITADEL": 4
      },
      "defenderSurvivors": {},
      "attackerRetreated": {},
      "defenderRetreated": {},
      "attackerCombatSurvivors": {
        "CATACLYSM": 2,
        "CORSAIR": 5,
        "CITADEL": 4
      },
      "attackerRetreatDamage": [],
      "defenderRetreatDamage": [],
      "attackerLosses": {},
      "defenderLosses": {
        "DART": 25,
        "COURIER": 1,
        "GARBAGE_COLLECTOR": 1,
        "PALADIN": 3,
        "THORN": 4
      },
      "attackerLossValue": 0,
      "defenderLossValue": 58893,
      "defenceSalvage": {
        "THORN": 2
      },
      "attackerDamage": [
        {
          "hull": "CATACLYSM",
          "count": 1,
          "damageBp": 8215,
          "remainderBp": 0.1333215118611406
        },
        {
          "hull": "CATACLYSM",
          "count": 1,
          "damageBp": 4591,
          "remainderBp": 0.6711866463601837
        }
      ],
      "defenderDamage": [],
      "contributions": [
        {
          "contributionId": "a",
          "playerId": "a",
          "sent": {
            "CORSAIR": 5,
            "CATACLYSM": 2
          },
          "survivors": {
            "CATACLYSM": 2,
            "CORSAIR": 5
          },
          "retreated": {},
          "losses": {},
          "lossValue": 0,
          "hullDamage": 6347.068164793266,
          "survivorDamage": [
            {
              "hull": "CATACLYSM",
              "count": 1,
              "damageBp": 8215,
              "remainderBp": 0.1333215118611406
            },
            {
              "hull": "CATACLYSM",
              "count": 1,
              "damageBp": 4591,
              "remainderBp": 0.6711866463601837
            }
          ]
        },
        {
          "contributionId": "b",
          "playerId": "b",
          "sent": {
            "CITADEL": 4,
            "COURIER": 1
          },
          "survivors": {
            "COURIER": 1,
            "CITADEL": 4
          },
          "retreated": {},
          "losses": {},
          "lossValue": 0,
          "hullDamage": 2008.931835206734,
          "survivorDamage": []
        }
      ],
      "defenders": [
        {
          "stackId": "host",
          "playerId": "d",
          "sent": {
            "DART": 25,
            "THORN": 4,
            "COURIER": 1
          },
          "survivors": {},
          "retreated": {},
          "losses": {
            "DART": 25,
            "COURIER": 1,
            "THORN": 4
          },
          "lossValue": 12993,
          "survivorDamage": []
        },
        {
          "stackId": "support",
          "playerId": "s",
          "sent": {
            "PALADIN": 3,
            "GARBAGE_COLLECTOR": 1
          },
          "survivors": {},
          "retreated": {},
          "losses": {
            "GARBAGE_COLLECTOR": 1,
            "PALADIN": 3
          },
          "lossValue": 45900,
          "survivorDamage": []
        }
      ]
    }
  },
  {
    "name": "wounds-and-fractions",
    "attackers": [
      {
        "contributionId": "a",
        "playerId": "a",
        "fleet": {
          "CORSAIR": 4
        },
        "tech": {
          "tech": {
            "SHIP_ARMOR": 3
          }
        },
        "damage": [
          {
            "hull": "CORSAIR",
            "count": 2,
            "damageBp": 1000,
            "remainderBp": 0.314
          }
        ]
      }
    ],
    "defenders": [
      {
        "stackId": "host",
        "playerId": "d",
        "fleet": {
          "CORSAIR": 2
        },
        "tech": {
          "tech": {
            "SHIP_POWER": 2
          }
        },
        "damage": [
          {
            "hull": "CORSAIR",
            "count": 1,
            "damageBp": 2000,
            "remainderBp": 0.719
          }
        ]
      }
    ],
    "shield": 0,
    "seed": 44,
    "precise": true,
    "maintenance": false,
    "expected": {
      "grade": "DECISIVE",
      "lossRatio": 1,
      "rounds": [
        {
          "round": 1,
          "attackerRoll": 0.9333008366450668,
          "defenderRoll": 1.048153546266258,
          "attackerDamage": 1523,
          "defenderDamage": 941,
          "shieldBefore": 0,
          "shieldAfter": 0,
          "shieldAbsorbed": 0,
          "shieldBreakerDamage": 0,
          "attackerShipShieldAbsorbed": 941,
          "defenderShipShieldAbsorbed": 754,
          "attackerHullDamage": 769,
          "attackerLosses": {},
          "defenderLosses": {},
          "retreats": [],
          "casualties": []
        },
        {
          "round": 2,
          "attackerRoll": 1.02181259367615,
          "defenderRoll": 0.9992832029238343,
          "attackerDamage": 1668,
          "defenderDamage": 897,
          "shieldBefore": 0,
          "shieldAfter": 0,
          "shieldAbsorbed": 0,
          "shieldBreakerDamage": 0,
          "attackerShipShieldAbsorbed": 605,
          "defenderShipShieldAbsorbed": 0,
          "attackerHullDamage": 1668,
          "attackerLosses": {},
          "defenderLosses": {},
          "retreats": [],
          "casualties": []
        },
        {
          "round": 3,
          "attackerRoll": 1.0041134749352933,
          "defenderRoll": 0.9800382318720222,
          "attackerDamage": 278,
          "defenderDamage": 880,
          "shieldBefore": 0,
          "shieldAfter": 0,
          "shieldAbsorbed": 0,
          "shieldBreakerDamage": 0,
          "attackerShipShieldAbsorbed": 139,
          "defenderShipShieldAbsorbed": 0,
          "attackerHullDamage": 278,
          "attackerLosses": {},
          "defenderLosses": {
            "CORSAIR": 2
          },
          "retreats": [],
          "casualties": [
            {
              "side": "DEFENCE",
              "playerId": "d",
              "stackId": "host",
              "fleet": {
                "CORSAIR": 2
              }
            }
          ]
        }
      ],
      "shieldLeft": 0,
      "shieldProtectedArmed": 0,
      "attackerSurvivors": {
        "CORSAIR": 4
      },
      "defenderSurvivors": {},
      "attackerRetreated": {},
      "defenderRetreated": {},
      "attackerCombatSurvivors": {
        "CORSAIR": 4
      },
      "attackerRetreatDamage": [],
      "defenderRetreatDamage": [],
      "attackerLosses": {},
      "defenderLosses": {
        "CORSAIR": 2
      },
      "attackerLossValue": 0,
      "defenderLossValue": 14080,
      "defenceSalvage": {},
      "attackerDamage": [
        {
          "hull": "CORSAIR",
          "count": 1,
          "damageBp": 2495,
          "remainderBp": 0.9407055589126685
        },
        {
          "hull": "CORSAIR",
          "count": 1,
          "damageBp": 2492,
          "remainderBp": 0.729406469109108
        },
        {
          "hull": "CORSAIR",
          "count": 1,
          "damageBp": 1961,
          "remainderBp": 0.8633893352268842
        },
        {
          "hull": "CORSAIR",
          "count": 1,
          "damageBp": 1000,
          "remainderBp": 0.314
        }
      ],
      "defenderDamage": [],
      "contributions": [
        {
          "contributionId": "a",
          "playerId": "a",
          "sent": {
            "CORSAIR": 4
          },
          "survivors": {
            "CORSAIR": 4
          },
          "retreated": {},
          "losses": {},
          "lossValue": 0,
          "hullDamage": 2714.2915748000005,
          "survivorDamage": [
            {
              "hull": "CORSAIR",
              "count": 1,
              "damageBp": 2495,
              "remainderBp": 0.9407055589126685
            },
            {
              "hull": "CORSAIR",
              "count": 1,
              "damageBp": 2492,
              "remainderBp": 0.729406469109108
            },
            {
              "hull": "CORSAIR",
              "count": 1,
              "damageBp": 1961,
              "remainderBp": 0.8633893352268842
            },
            {
              "hull": "CORSAIR",
              "count": 1,
              "damageBp": 1000,
              "remainderBp": 0.314
            }
          ]
        }
      ],
      "defenders": [
        {
          "stackId": "host",
          "playerId": "d",
          "sent": {
            "CORSAIR": 2
          },
          "survivors": {},
          "retreated": {},
          "losses": {
            "CORSAIR": 2
          },
          "lossValue": 14080,
          "survivorDamage": []
        }
      ]
    }
  },
  {
    "name": "overflow-support-collectors",
    "attackers": [
      {
        "contributionId": "a",
        "playerId": "a",
        "fleet": {
          "CATACLYSM": 3
        },
        "tech": {
          "tech": {}
        }
      }
    ],
    "defenders": [
      {
        "stackId": "host",
        "playerId": "d",
        "fleet": {
          "DART": 2,
          "COURIER": 2,
          "GARBAGE_COLLECTOR": 2
        },
        "tech": {
          "tech": {}
        }
      }
    ],
    "shield": 0,
    "seed": 55,
    "precise": true,
    "maintenance": false,
    "expected": {
      "grade": "DECISIVE",
      "lossRatio": 1,
      "rounds": [
        {
          "round": 1,
          "attackerRoll": 1.0331716036051513,
          "defenderRoll": 1.039848445057869,
          "attackerDamage": 1768,
          "defenderDamage": 27,
          "shieldBefore": 0,
          "shieldAfter": 0,
          "shieldAbsorbed": 0,
          "shieldBreakerDamage": 0,
          "attackerShipShieldAbsorbed": 27,
          "defenderShipShieldAbsorbed": 354,
          "attackerHullDamage": 1414,
          "attackerLosses": {},
          "defenderLosses": {
            "DART": 2,
            "COURIER": 2,
            "GARBAGE_COLLECTOR": 2
          },
          "retreats": [],
          "casualties": [
            {
              "side": "DEFENCE",
              "playerId": "d",
              "stackId": "host",
              "fleet": {
                "DART": 2,
                "COURIER": 2,
                "GARBAGE_COLLECTOR": 2
              }
            }
          ]
        }
      ],
      "shieldLeft": 0,
      "shieldProtectedArmed": 0,
      "attackerSurvivors": {
        "CATACLYSM": 3
      },
      "defenderSurvivors": {},
      "attackerRetreated": {},
      "defenderRetreated": {},
      "attackerCombatSurvivors": {
        "CATACLYSM": 3
      },
      "attackerRetreatDamage": [],
      "defenderRetreatDamage": [],
      "attackerLosses": {},
      "defenderLosses": {
        "DART": 2,
        "COURIER": 2,
        "GARBAGE_COLLECTOR": 2
      },
      "attackerLossValue": 0,
      "defenderLossValue": 41586,
      "defenceSalvage": {},
      "attackerDamage": [],
      "defenderDamage": [],
      "contributions": [
        {
          "contributionId": "a",
          "playerId": "a",
          "sent": {
            "CATACLYSM": 3
          },
          "survivors": {
            "CATACLYSM": 3
          },
          "retreated": {},
          "losses": {},
          "lossValue": 0,
          "hullDamage": 1414.0000000000002,
          "survivorDamage": []
        }
      ],
      "defenders": [
        {
          "stackId": "host",
          "playerId": "d",
          "sent": {
            "DART": 2,
            "COURIER": 2,
            "GARBAGE_COLLECTOR": 2
          },
          "survivors": {},
          "retreated": {},
          "losses": {
            "DART": 2,
            "COURIER": 2,
            "GARBAGE_COLLECTOR": 2
          },
          "lossValue": 41586,
          "survivorDamage": []
        }
      ]
    }
  },
  {
    "name": "nullifier-aegis",
    "attackers": [
      {
        "contributionId": "a",
        "playerId": "a",
        "fleet": {
          "NULLIFIER": 6,
          "CORSAIR": 2
        },
        "tech": {
          "tech": {}
        }
      }
    ],
    "defenders": [
      {
        "stackId": "host",
        "playerId": "d",
        "fleet": {
          "DART": 20,
          "THORN": 3
        },
        "tech": {
          "tech": {}
        }
      }
    ],
    "shield": 5000,
    "seed": 66,
    "precise": true,
    "maintenance": false,
    "expected": {
      "grade": "DECISIVE",
      "lossRatio": 1,
      "rounds": [
        {
          "round": 1,
          "attackerRoll": 0.955837698765099,
          "defenderRoll": 1.0373647120967509,
          "attackerDamage": 3579,
          "defenderDamage": 414,
          "shieldBefore": 5000,
          "shieldAfter": 0,
          "shieldAbsorbed": 5000,
          "shieldBreakerDamage": 3732,
          "attackerShipShieldAbsorbed": 414,
          "defenderShipShieldAbsorbed": 385,
          "attackerHullDamage": 1925,
          "attackerLosses": {},
          "defenderLosses": {
            "DART": 20
          },
          "retreats": [],
          "casualties": [
            {
              "side": "DEFENCE",
              "playerId": "d",
              "stackId": "host",
              "fleet": {
                "DART": 20
              }
            }
          ]
        },
        {
          "round": 2,
          "attackerRoll": 1.0140742546319963,
          "defenderRoll": 1.0582476868852972,
          "attackerDamage": 260,
          "defenderDamage": 97,
          "shieldBefore": 0,
          "shieldAfter": 0,
          "shieldAbsorbed": 0,
          "shieldBreakerDamage": 0,
          "attackerShipShieldAbsorbed": 97,
          "defenderShipShieldAbsorbed": 0,
          "attackerHullDamage": 260,
          "attackerLosses": {},
          "defenderLosses": {
            "THORN": 3
          },
          "retreats": [],
          "casualties": [
            {
              "side": "DEFENCE",
              "playerId": "d",
              "stackId": "host",
              "fleet": {
                "THORN": 3
              }
            }
          ]
        }
      ],
      "shieldLeft": 0,
      "shieldProtectedArmed": 1268.409624021053,
      "attackerSurvivors": {
        "NULLIFIER": 6,
        "CORSAIR": 2
      },
      "defenderSurvivors": {},
      "attackerRetreated": {},
      "defenderRetreated": {},
      "attackerCombatSurvivors": {
        "NULLIFIER": 6,
        "CORSAIR": 2
      },
      "attackerRetreatDamage": [],
      "defenderRetreatDamage": [],
      "attackerLosses": {},
      "defenderLosses": {
        "DART": 20,
        "THORN": 3
      },
      "attackerLossValue": 0,
      "defenderLossValue": 10000,
      "defenceSalvage": {
        "THORN": 1
      },
      "attackerDamage": [],
      "defenderDamage": [],
      "contributions": [
        {
          "contributionId": "a",
          "playerId": "a",
          "sent": {
            "NULLIFIER": 6,
            "CORSAIR": 2
          },
          "survivors": {
            "NULLIFIER": 6,
            "CORSAIR": 2
          },
          "retreated": {},
          "losses": {},
          "lossValue": 0,
          "hullDamage": 2185.0000000000005,
          "survivorDamage": []
        }
      ],
      "defenders": [
        {
          "stackId": "host",
          "playerId": "d",
          "sent": {
            "DART": 20,
            "THORN": 3
          },
          "survivors": {},
          "retreated": {},
          "losses": {
            "DART": 20,
            "THORN": 3
          },
          "lossValue": 10000,
          "survivorDamage": []
        }
      ]
    }
  },
  {
    "name": "inactive-and-ready-same-hull",
    "attackers": [
      {
        "contributionId": "a",
        "playerId": "a",
        "fleet": {
          "DART": 2
        },
        "tech": {
          "tech": {}
        },
        "damage": [
          {
            "hull": "DART",
            "count": 1,
            "damageBp": 6000
          },
          {
            "hull": "DART",
            "count": 1,
            "damageBp": 9500
          }
        ]
      }
    ],
    "defenders": [
      {
        "stackId": "host",
        "playerId": "d",
        "fleet": {
          "PIKE": 1,
          "ARGOSY": 1
        },
        "tech": {
          "tech": {}
        },
        "damage": [
          {
            "hull": "PIKE",
            "count": 1,
            "damageBp": 9900
          }
        ]
      }
    ],
    "shield": 0,
    "seed": 77,
    "maintenance": true,
    "precise": true,
    "expected": {
      "grade": "REPELLED",
      "lossRatio": 0.028735632183908066,
      "rounds": [
        {
          "round": 1,
          "attackerRoll": 1.0313610767573118,
          "defenderRoll": 0.997743716724217,
          "attackerDamage": 19,
          "defenderDamage": 0,
          "shieldBefore": 0,
          "shieldAfter": 0,
          "shieldAbsorbed": 0,
          "shieldBreakerDamage": 0,
          "attackerShipShieldAbsorbed": 0,
          "defenderShipShieldAbsorbed": 19,
          "attackerHullDamage": 0,
          "attackerLosses": {},
          "defenderLosses": {
            "PIKE": 1
          },
          "retreats": [],
          "casualties": [
            {
              "side": "DEFENCE",
              "playerId": "d",
              "stackId": "host",
              "fleet": {
                "PIKE": 1
              }
            }
          ]
        },
        {
          "round": 2,
          "attackerRoll": 0.9385220211744308,
          "defenderRoll": 1.052177309691906,
          "attackerDamage": 32,
          "defenderDamage": 0,
          "shieldBefore": 0,
          "shieldAfter": 0,
          "shieldAbsorbed": 0,
          "shieldBreakerDamage": 0,
          "attackerShipShieldAbsorbed": 0,
          "defenderShipShieldAbsorbed": 32,
          "attackerHullDamage": 0,
          "attackerLosses": {},
          "defenderLosses": {},
          "retreats": [],
          "casualties": []
        },
        {
          "round": 3,
          "attackerRoll": 1.0613037595897914,
          "defenderRoll": 1.0454392241314054,
          "attackerDamage": 36,
          "defenderDamage": 0,
          "shieldBefore": 0,
          "shieldAfter": 0,
          "shieldAbsorbed": 0,
          "shieldBreakerDamage": 0,
          "attackerShipShieldAbsorbed": 0,
          "defenderShipShieldAbsorbed": 36,
          "attackerHullDamage": 0,
          "attackerLosses": {},
          "defenderLosses": {},
          "retreats": [],
          "casualties": []
        },
        {
          "round": 4,
          "attackerRoll": 0.9289545929804445,
          "defenderRoll": 0.9489195010438561,
          "attackerDamage": 31,
          "defenderDamage": 0,
          "shieldBefore": 0,
          "shieldAfter": 0,
          "shieldAbsorbed": 0,
          "shieldBreakerDamage": 0,
          "attackerShipShieldAbsorbed": 0,
          "defenderShipShieldAbsorbed": 31,
          "attackerHullDamage": 0,
          "attackerLosses": {},
          "defenderLosses": {},
          "retreats": [],
          "casualties": []
        },
        {
          "round": 5,
          "attackerRoll": 1.0654766772314908,
          "defenderRoll": 1.0134269382432104,
          "attackerDamage": 36,
          "defenderDamage": 0,
          "shieldBefore": 0,
          "shieldAfter": 0,
          "shieldAbsorbed": 0,
          "shieldBreakerDamage": 0,
          "attackerShipShieldAbsorbed": 0,
          "defenderShipShieldAbsorbed": 36,
          "attackerHullDamage": 0,
          "attackerLosses": {},
          "defenderLosses": {},
          "retreats": [],
          "casualties": []
        },
        {
          "round": 6,
          "attackerRoll": 0.9993461849167944,
          "defenderRoll": 1.0302984720095993,
          "attackerDamage": 34,
          "defenderDamage": 0,
          "shieldBefore": 0,
          "shieldAfter": 0,
          "shieldAbsorbed": 0,
          "shieldBreakerDamage": 0,
          "attackerShipShieldAbsorbed": 0,
          "defenderShipShieldAbsorbed": 34,
          "attackerHullDamage": 0,
          "attackerLosses": {},
          "defenderLosses": {},
          "retreats": [],
          "casualties": []
        }
      ],
      "shieldLeft": 0,
      "shieldProtectedArmed": 0,
      "attackerSurvivors": {
        "DART": 2
      },
      "defenderSurvivors": {
        "ARGOSY": 1
      },
      "attackerRetreated": {},
      "defenderRetreated": {},
      "attackerCombatSurvivors": {
        "DART": 1
      },
      "attackerRetreatDamage": [],
      "defenderRetreatDamage": [],
      "attackerLosses": {},
      "defenderLosses": {
        "PIKE": 1
      },
      "attackerLossValue": 0,
      "defenderLossValue": 425,
      "defenceSalvage": {},
      "attackerDamage": [
        {
          "hull": "DART",
          "count": 1,
          "damageBp": 9500,
          "remainderBp": 0
        },
        {
          "hull": "DART",
          "count": 1,
          "damageBp": 6000,
          "remainderBp": 0
        }
      ],
      "defenderDamage": [],
      "contributions": [
        {
          "contributionId": "a",
          "playerId": "a",
          "sent": {
            "DART": 2
          },
          "survivors": {
            "DART": 2
          },
          "retreated": {},
          "losses": {},
          "lossValue": 0,
          "hullDamage": 0.38,
          "survivorDamage": [
            {
              "hull": "DART",
              "count": 1,
              "damageBp": 9500,
              "remainderBp": 0
            },
            {
              "hull": "DART",
              "count": 1,
              "damageBp": 6000,
              "remainderBp": 0
            }
          ]
        }
      ],
      "defenders": [
        {
          "stackId": "host",
          "playerId": "d",
          "sent": {
            "PIKE": 1,
            "ARGOSY": 1
          },
          "survivors": {
            "ARGOSY": 1
          },
          "retreated": {},
          "losses": {
            "PIKE": 1
          },
          "lossValue": 425,
          "survivorDamage": []
        }
      ]
    }
  },
  {
    "name": "support-only",
    "attackers": [
      {
        "contributionId": "a",
        "playerId": "a",
        "fleet": {
          "COURIER": 2,
          "GARBAGE_COLLECTOR": 1
        },
        "tech": {
          "tech": {}
        }
      }
    ],
    "defenders": [
      {
        "stackId": "host",
        "playerId": "d",
        "fleet": {
          "ATLAS": 1,
          "GARBAGE_COLLECTOR": 2
        },
        "tech": {
          "tech": {}
        }
      }
    ],
    "shield": 0,
    "seed": 88,
    "precise": true,
    "maintenance": false,
    "expected": {
      "grade": "REPELLED",
      "lossRatio": 0,
      "rounds": [],
      "shieldLeft": 0,
      "shieldProtectedArmed": 0,
      "attackerSurvivors": {
        "COURIER": 2,
        "GARBAGE_COLLECTOR": 1
      },
      "defenderSurvivors": {
        "ATLAS": 1,
        "GARBAGE_COLLECTOR": 2
      },
      "attackerRetreated": {},
      "defenderRetreated": {},
      "attackerCombatSurvivors": {},
      "attackerRetreatDamage": [],
      "defenderRetreatDamage": [],
      "attackerLosses": {},
      "defenderLosses": {},
      "attackerLossValue": 0,
      "defenderLossValue": 0,
      "defenceSalvage": {},
      "attackerDamage": [],
      "defenderDamage": [],
      "contributions": [
        {
          "contributionId": "a",
          "playerId": "a",
          "sent": {
            "COURIER": 2,
            "GARBAGE_COLLECTOR": 1
          },
          "survivors": {
            "COURIER": 2,
            "GARBAGE_COLLECTOR": 1
          },
          "retreated": {},
          "losses": {},
          "lossValue": 0,
          "hullDamage": 0,
          "survivorDamage": []
        }
      ],
      "defenders": [
        {
          "stackId": "host",
          "playerId": "d",
          "sent": {
            "ATLAS": 1,
            "GARBAGE_COLLECTOR": 2
          },
          "survivors": {
            "ATLAS": 1,
            "GARBAGE_COLLECTOR": 2
          },
          "retreated": {},
          "losses": {},
          "lossValue": 0,
          "survivorDamage": []
        }
      ]
    }
  },
  {
    "name": "rounded-wound-output",
    "attackers": [
      {
        "contributionId": "a",
        "playerId": "a",
        "fleet": {
          "CORSAIR": 1
        },
        "tech": {
          "tech": {
            "SHIP_SHIELDS": 4
          }
        }
      }
    ],
    "defenders": [
      {
        "stackId": "host",
        "playerId": "d",
        "fleet": {
          "CORSAIR": 1
        },
        "tech": {
          "tech": {
            "SHIP_SHIELDS": 4
          }
        }
      }
    ],
    "shield": 0,
    "seed": 99,
    "precise": false,
    "maintenance": false,
    "expected": {
      "grade": "DECISIVE",
      "lossRatio": 1,
      "rounds": [
        {
          "round": 1,
          "attackerRoll": 1.0065394455939531,
          "defenderRoll": 1.0304389481246472,
          "attackerDamage": 411,
          "defenderDamage": 420,
          "shieldBefore": 0,
          "shieldAfter": 0,
          "shieldAbsorbed": 0,
          "shieldBreakerDamage": 0,
          "attackerShipShieldAbsorbed": 420,
          "defenderShipShieldAbsorbed": 411,
          "attackerHullDamage": 0,
          "attackerLosses": {},
          "defenderLosses": {},
          "retreats": [],
          "casualties": []
        },
        {
          "round": 2,
          "attackerRoll": 0.9201821933314205,
          "defenderRoll": 1.050806894041598,
          "attackerDamage": 375,
          "defenderDamage": 429,
          "shieldBefore": 0,
          "shieldAfter": 0,
          "shieldAbsorbed": 0,
          "shieldBreakerDamage": 0,
          "attackerShipShieldAbsorbed": 334,
          "defenderShipShieldAbsorbed": 343,
          "attackerHullDamage": 32,
          "attackerLosses": {},
          "defenderLosses": {},
          "retreats": [],
          "casualties": []
        },
        {
          "round": 3,
          "attackerRoll": 0.9218161354213953,
          "defenderRoll": 0.9368698405474425,
          "attackerDamage": 376,
          "defenderDamage": 382,
          "shieldBefore": 0,
          "shieldAfter": 0,
          "shieldAbsorbed": 0,
          "shieldBreakerDamage": 0,
          "attackerShipShieldAbsorbed": 0,
          "defenderShipShieldAbsorbed": 0,
          "attackerHullDamage": 376,
          "attackerLosses": {},
          "defenderLosses": {},
          "retreats": [],
          "casualties": []
        },
        {
          "round": 4,
          "attackerRoll": 0.9834525605291129,
          "defenderRoll": 1.0273506473749876,
          "attackerDamage": 401,
          "defenderDamage": 419,
          "shieldBefore": 0,
          "shieldAfter": 0,
          "shieldAbsorbed": 0,
          "shieldBreakerDamage": 0,
          "attackerShipShieldAbsorbed": 0,
          "defenderShipShieldAbsorbed": 0,
          "attackerHullDamage": 401,
          "attackerLosses": {},
          "defenderLosses": {},
          "retreats": [],
          "casualties": []
        },
        {
          "round": 5,
          "attackerRoll": 0.9785907120630145,
          "defenderRoll": 0.9303020445257426,
          "attackerDamage": 399,
          "defenderDamage": 380,
          "shieldBefore": 0,
          "shieldAfter": 0,
          "shieldAbsorbed": 0,
          "shieldBreakerDamage": 0,
          "attackerShipShieldAbsorbed": 0,
          "defenderShipShieldAbsorbed": 0,
          "attackerHullDamage": 399,
          "attackerLosses": {},
          "defenderLosses": {},
          "retreats": [],
          "casualties": []
        },
        {
          "round": 6,
          "attackerRoll": 0.9742172300815582,
          "defenderRoll": 1.0362267976999284,
          "attackerDamage": 299,
          "defenderDamage": 232,
          "shieldBefore": 0,
          "shieldAfter": 0,
          "shieldAbsorbed": 0,
          "shieldBreakerDamage": 0,
          "attackerShipShieldAbsorbed": 0,
          "defenderShipShieldAbsorbed": 0,
          "attackerHullDamage": 299,
          "attackerLosses": {
            "CORSAIR": 1
          },
          "defenderLosses": {
            "CORSAIR": 1
          },
          "retreats": [],
          "casualties": [
            {
              "side": "ATTACK",
              "playerId": "a",
              "stackId": "a",
              "fleet": {
                "CORSAIR": 1
              }
            },
            {
              "side": "DEFENCE",
              "playerId": "d",
              "stackId": "host",
              "fleet": {
                "CORSAIR": 1
              }
            }
          ]
        }
      ],
      "shieldLeft": 0,
      "shieldProtectedArmed": 0,
      "attackerSurvivors": {},
      "defenderSurvivors": {},
      "attackerRetreated": {},
      "defenderRetreated": {},
      "attackerCombatSurvivors": {},
      "attackerRetreatDamage": [],
      "defenderRetreatDamage": [],
      "attackerLosses": {
        "CORSAIR": 1
      },
      "defenderLosses": {
        "CORSAIR": 1
      },
      "attackerLossValue": 7040,
      "defenderLossValue": 7040,
      "defenceSalvage": {},
      "attackerDamage": [],
      "defenderDamage": [],
      "contributions": [
        {
          "contributionId": "a",
          "playerId": "a",
          "sent": {
            "CORSAIR": 1
          },
          "survivors": {},
          "retreated": {},
          "losses": {
            "CORSAIR": 1
          },
          "lossValue": 7040,
          "hullDamage": 1508,
          "survivorDamage": []
        }
      ],
      "defenders": [
        {
          "stackId": "host",
          "playerId": "d",
          "sent": {
            "CORSAIR": 1
          },
          "survivors": {},
          "retreated": {},
          "losses": {
            "CORSAIR": 1
          },
          "lossValue": 7040,
          "survivorDamage": []
        }
      ]
    }
  }
];
