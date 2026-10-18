export type PlanTemplate = {
  id: string;
  title: string;
  description: string;
  tasks: readonly string[];
};

// Practical planning prompts only. These do not prescribe care or equipment.
export const planTemplates: readonly PlanTemplate[] = [
  {
    id: "hospital-bag",
    title: "Hospital bag",
    description:
      "Start a packing list that fits your plans. Check your hospital's own list.",
    tasks: [
      "Check what the hospital provides and what I need to bring",
      "Choose clothes and personal items for my stay",
      "Pack my phone charger and important contact details",
      "Prepare the documents my care team asked me to bring",
      "Agree who will bring the bag and arrange the journey home",
    ],
  },
  {
    id: "birth-preferences",
    title: "Birth preferences",
    description:
      "Write down what matters to you and discuss your options with your care team.",
    tasks: [
      "Write down my questions and priorities for birth",
      "Ask my care team which choices are available to me",
      "Record who I want to support me and how",
      "Discuss how I want information and changes explained",
      "Review my preferences with my care team",
    ],
  },
  {
    id: "home-support",
    title: "Support at home",
    description: "Choose the practical help that would make daily life easier.",
    tasks: [
      "Choose someone I can ask for practical help",
      "Plan help with meals and shopping",
      "Plan help with household tasks or transport",
      "Write down my preferences for visits and quiet time",
      "Save useful contact details in Care",
    ],
  },
  {
    id: "after-birth",
    title: "Support after birth",
    description: "Make room for your appointments, questions, and practical support.",
    tasks: [
      "Record the follow-up plan my care team gave me",
      "Write down questions for my next appointment",
      "Arrange help with meals, household tasks, or transport",
      "Agree how I want to ask for help or quiet time",
      "Keep a private note of what I want to discuss",
    ],
  },
];
