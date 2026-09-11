import { QuickTopic } from './types';

export const KNOWLEDGE_BASE = {
  chatbot: {
    name: "Radius",
    built_by: "IT and Media Club",
    deployed_at_event: "Invenio",
    deployed_at_exhibit: "IT and Media Club exhibit",
    notes: "Radius is stationed at the IT and Media Club's exhibit within Invenio, the school's science exhibition."
  },
  event: {
    name: "Invenio",
    type: "Science Exhibition",
    conducted_by: "Maths and Science Society",
    features: [
      "Robotics displays",
      "Student innovation projects",
      "Posters",
      "Food stalls",
      "Fun games",
      "Quizzes"
    ]
  },
  school: {
    full_name: "Yoshida Shokanji International School",
    abbreviation: "YSIS",
    history: {
      founded_as: "Yoshida Education and Social Services Foundation",
      founding_year: 1979,
      founder: "Venerable Banagala Upatissa Nāyakathero",
      patron: "Madam Takiko Yoshida",
      milestones: [
        {
          date: "1979-06-26",
          event: "Yoshida Nursery Institute established"
        },
        {
          date: "2000-01-05",
          event: "Yoshida Shokanji International School founded"
        }
      ],
      years_of_excellence: "25+"
    },
    academic_structure: [
      "Early Years",
      "Primary Education",
      "Lower Secondary",
      "Upper Secondary"
    ],
    scale: {
      "students": "1000+",
      "teachers": "70+"
    },
    achievements: [
      "Won 3 global awards in Cambridge Advanced Level (specific names/years not yet confirmed)"
    ],
    sports: [
      "Football",
      "Cricket",
      "Swimming",
      "Basketball",
      "Netball",
      "Karate",
      "Chess"
    ],
    clubs_and_societies: [
      "IT and Media Club",
      "Maths and Science Society",
      "Yoshida Shokanji MUN Club",
      "History and Archaeology Club",
      "Japanese Club",
      "Commerce Club",
      "Scouts and Cub Scouts",
      "Girl Guides",
      "English Literacy Association"
    ],
    leadership: {
      principal: "Ms. Buddhini Jayasundara",
      head_boy: "Lasith Wijewardhana",
      head_girl: "Dinugi Senarathna"
    },
    house_system: {
      houses: ["Phoenix", "Unicorn", "Pegasus"],
      most_recent_interhouse_sports_winner: "Phoenix House",
      winning_streak: "3 years in a row"
    }
  }
};

export const MIMO_INFO = {
  name: KNOWLEDGE_BASE.chatbot.name,
  role: 'Official AI Mascot & Junior Ambassador',
  school: KNOWLEDGE_BASE.school.full_name,
  abbreviation: KNOWLEDGE_BASE.school.abbreviation,
  builtBy: KNOWLEDGE_BASE.chatbot.built_by,
  event: KNOWLEDGE_BASE.event.name,
  eventType: KNOWLEDGE_BASE.event.type,
  exhibit: KNOWLEDGE_BASE.chatbot.deployed_at_exhibit,
  conductedBy: KNOWLEDGE_BASE.event.conducted_by,
  location: 'Sapugaskanda / Makola, Sri Lanka',
  tagline: 'Inspiring Young Minds Through Innovation, Science & Technology',
};

export const INITIAL_GREETING = "Hello! I'm Radius, the AI mascot built by our IT and Media Club! Welcome to our exhibit at Invenio, our school's science exhibition! Tap the button and ask me anything about Invenio, our clubs, sports, houses, or tech projects!";

export const QUICK_TOPICS: QuickTopic[] = [
  {
    label: '🔬 What is Invenio?',
    prompt: 'What is Invenio and what can visitors explore here today?',
    category: 'school',
  },
  {
    label: '🤖 Who built Radius?',
    prompt: 'Who created you, Radius, and what is this exhibit about?',
    category: 'clubs',
  },
  {
    label: '🏆 Who won Interhouse Sports?',
    prompt: 'Tell me about the houses at YSIS and who won interhouse sports!',
    category: 'school',
  },
  {
    label: '🏛️ Clubs & Societies',
    prompt: 'What student clubs and societies can students join at YSIS?',
    category: 'clubs',
  },
  {
    label: '📜 History & Founders',
    prompt: 'Can you tell me the history and founders of Yoshida Shokanji International School?',
    category: 'values',
  },
  {
    label: '⚽ Sports & Achievements',
    prompt: 'What sports are played at YSIS, and what are the school achievements?',
    category: 'school',
  },
  {
    label: '👑 School Leadership',
    prompt: 'Who is the principal and head student leadership at YSIS?',
    category: 'school',
  },
];

