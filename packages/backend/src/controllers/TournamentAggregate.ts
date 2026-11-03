export const tournamentAggregation = () => [
    // Strukturiere das Teams Array so um, dass jeder player im team ein object anstatt eines strings ist, das Object hat name und id
    {
      $addFields: {
        teams: {
          $map: {
            input: "$teams",
            as: "team",
            in: {
              _id: "$$team._id",
              name: "$$team.name",
              logo: "$$team.logo",
              players: {
                $map: {
                  input: "$$team.players",
                  as: "player",
                  in: { name: "$$player", id: "$$player" }
                }
              }
            }
          }
        }
      }
    },

    // Gruppenteams mit Team-Details ersetzen
    {
      $addFields: {
        "groupPhase.groups": {
          $map: {
            input: "$groupPhase.groups",
            as: "group",
            in: {
              teams: {
                $map: {
                  input: "$$group.teams",
                  as: "teamEntry",
                  in: {
                    $arrayElemAt: [
                      {
                        $filter: {
                          input: "$teams",
                          as: "team",
                          cond: { $eq: ["$$team._id", "$$teamEntry.teamID"] }
                        }
                      },
                      0
                    ]
                  }
                }
              }
            }
          }
        }
      }
    },
  
    // Spiele in der Gruppenphase mit Team-Details ersetzen
    {
      $addFields: {
        "groupPhase.matches": {
          $map: {
            input: "$groupPhase.matches",
            as: "matchList",
            in: {
              $map: {
                input: "$$matchList",
                as: "match",
                in: {
                  _id: "$$match._id",
                  team1ID: "$$match.team1ID",
                  team2ID: "$$match.team2ID",
                  team1: {
                    $arrayElemAt: [
                      {
                        $filter: {
                          input: "$teams",
                          as: "team",
                          cond: { $eq: ["$$team._id", "$$match.team1ID"] }
                        }
                      },
                      0
                    ]
                  },
                  team2: {
                    $arrayElemAt: [
                      {
                        $filter: {
                          input: "$teams",
                          as: "team",
                          cond: { $eq: ["$$team._id", "$$match.team2ID"] }
                        }
                      },
                      0
                    ]
                  },
                  result: "$$match.result",
                  time: "$$match.time"
                }
              }
            }
          }
        }
      }
    },
  
    // Spiele in der K.O.-Phase mit Team-Details ersetzen
    {
      $addFields: {
        "koPhase.matches": {
          $map: {
            input: "$koPhase.matches",
            as: "matchList",
            in: {
              $map: {
                input: "$$matchList",
                as: "match",
                in: {
                  _id: "$$match._id",
                  team1ID: "$$match.team1ID",
                  team2ID: "$$match.team2ID",
                  team1: {
                    $arrayElemAt: [
                      {
                        $filter: {
                          input: "$teams",
                          as: "team",
                          cond: { $eq: ["$$team._id", "$$match.team1ID"] }
                        }
                      },
                      0
                    ]
                  },
                  team2: {
                    $arrayElemAt: [
                      {
                        $filter: {
                          input: "$teams",
                          as: "team",
                          cond: { $eq: ["$$team._id", "$$match.team2ID"] }
                        }
                      },
                      0
                    ]
                  },
                  result: "$$match.result",
                  time: "$$match.time"
                }
              }
            }
          }
        }
      }
    },
  
    // Unnötige teamID-Felder entfernen
    {
      $project: {
        "groupPhase.groups.teams.teamID": 0
      }
    }
  ];

  