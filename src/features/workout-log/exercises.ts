import type { Exercise } from "./types"

export const PRESET_EXERCISES: Exercise[] = [
  // Chest
  { id: "bench-press",       name: "Barbell Bench Press",    muscleGroups: ["Chest", "Arms"] },
  { id: "incline-db-press",  name: "Incline Dumbbell Press", muscleGroups: ["Chest", "Shoulders"] },
  { id: "cable-fly",         name: "Cable Fly",              muscleGroups: ["Chest"] },
  { id: "push-up",           name: "Push-Up",                muscleGroups: ["Chest", "Arms"] },
  { id: "dips",              name: "Chest Dips",             muscleGroups: ["Chest", "Arms"] },
  { id: "pec-deck",          name: "Pec Deck Machine",       muscleGroups: ["Chest"] },
  // Back
  { id: "deadlift",          name: "Deadlift",               muscleGroups: ["Back", "Legs"] },
  { id: "pull-up",           name: "Pull-Up",                muscleGroups: ["Back", "Arms"] },
  { id: "bb-row",            name: "Barbell Row",            muscleGroups: ["Back"] },
  { id: "lat-pulldown",      name: "Lat Pulldown",           muscleGroups: ["Back"] },
  { id: "seated-cable-row",  name: "Seated Cable Row",       muscleGroups: ["Back"] },
  { id: "single-arm-row",    name: "Single Arm DB Row",      muscleGroups: ["Back"] },
  { id: "face-pull",         name: "Face Pull",              muscleGroups: ["Back", "Shoulders"] },
  // Shoulders
  { id: "ohp",               name: "Overhead Press",         muscleGroups: ["Shoulders", "Arms"] },
  { id: "lateral-raise",     name: "Lateral Raise",          muscleGroups: ["Shoulders"] },
  { id: "front-raise",       name: "Front Raise",            muscleGroups: ["Shoulders"] },
  { id: "rear-delt-fly",     name: "Rear Delt Fly",          muscleGroups: ["Shoulders", "Back"] },
  { id: "arnold-press",      name: "Arnold Press",           muscleGroups: ["Shoulders"] },
  // Arms
  { id: "barbell-curl",      name: "Barbell Curl",           muscleGroups: ["Arms"] },
  { id: "hammer-curl",       name: "Hammer Curl",            muscleGroups: ["Arms"] },
  { id: "tricep-pushdown",   name: "Tricep Pushdown",        muscleGroups: ["Arms"] },
  { id: "skull-crusher",     name: "Skull Crusher",          muscleGroups: ["Arms"] },
  { id: "preacher-curl",     name: "Preacher Curl",          muscleGroups: ["Arms"] },
  { id: "overhead-tricep",   name: "Overhead Tricep Ext.",   muscleGroups: ["Arms"] },
  // Legs
  { id: "squat",             name: "Barbell Squat",          muscleGroups: ["Legs"] },
  { id: "rdl",               name: "Romanian Deadlift",      muscleGroups: ["Legs", "Back"] },
  { id: "leg-press",         name: "Leg Press",              muscleGroups: ["Legs"] },
  { id: "lunges",            name: "Lunges",                 muscleGroups: ["Legs"] },
  { id: "leg-curl",          name: "Leg Curl",               muscleGroups: ["Legs"] },
  { id: "leg-extension",     name: "Leg Extension",          muscleGroups: ["Legs"] },
  { id: "calf-raise",        name: "Calf Raise",             muscleGroups: ["Legs"] },
  { id: "hip-thrust",        name: "Hip Thrust",             muscleGroups: ["Legs"] },
  { id: "goblet-squat",      name: "Goblet Squat",           muscleGroups: ["Legs"] },
  // Core
  { id: "plank",             name: "Plank",                  muscleGroups: ["Core"] },
  { id: "crunches",          name: "Crunches",               muscleGroups: ["Core"] },
  { id: "russian-twist",     name: "Russian Twist",          muscleGroups: ["Core"] },
  { id: "leg-raise",         name: "Leg Raise",              muscleGroups: ["Core"] },
  { id: "cable-crunch",      name: "Cable Crunch",           muscleGroups: ["Core"] },
  { id: "ab-wheel",          name: "Ab Wheel Rollout",       muscleGroups: ["Core"] },
  { id: "side-plank",        name: "Side Plank",             muscleGroups: ["Core"] },
  // Cardio
  { id: "treadmill-run",     name: "Treadmill Run",          muscleGroups: ["Cardio", "Legs"] },
  { id: "cycling",           name: "Cycling",                muscleGroups: ["Cardio", "Legs"] },
  { id: "rowing",            name: "Rowing Machine",         muscleGroups: ["Cardio", "Back"] },
  { id: "elliptical",        name: "Elliptical",             muscleGroups: ["Cardio"] },
  { id: "jump-rope",         name: "Jump Rope",              muscleGroups: ["Cardio", "Legs"] },
  { id: "burpees",           name: "Burpees",                muscleGroups: ["Cardio", "Full Body"] },
  { id: "box-jump",          name: "Box Jump",               muscleGroups: ["Cardio", "Legs"] },
  { id: "battle-rope",       name: "Battle Rope",            muscleGroups: ["Cardio", "Arms"] },
  // Full body
  { id: "clean-and-jerk",    name: "Clean & Jerk",           muscleGroups: ["Full Body"] },
  { id: "kettlebell-swing",  name: "Kettlebell Swing",       muscleGroups: ["Full Body", "Legs"] },
]
