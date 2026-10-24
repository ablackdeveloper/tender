export const questionPromptGroups = [
  {
    id: "first-visit",
    label: "First visit",
    questions: [
      "What would be useful to discuss at this visit?",
      "Who should I contact with questions between visits?",
      "What should I bring or prepare for my next appointment?",
    ],
  },
  {
    id: "follow-up",
    label: "Follow-up",
    questions: [
      "Can we review the questions I saved since our last visit?",
      "Can you explain the next steps in my care plan?",
      "What would you like me to record before we meet again?",
    ],
  },
  {
    id: "birth-preferences",
    label: "Birth preferences",
    questions: [
      "Can we discuss my preferences and the choices available to me?",
      "How can my support person take part?",
      "How will changes to the plan be explained to me?",
    ],
  },
  {
    id: "after-birth",
    label: "After birth",
    questions: [
      "Can we review my recovery questions and follow-up plan?",
      "What support is available for the concerns I want to discuss?",
      "Who can I contact before my next appointment?",
    ],
  },
] as const;

// These are communication prompts, not clinical advice or a prescribed visit schedule.
