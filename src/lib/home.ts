// The homepage's content, as data: how Nahuel thinks about product, his
// experience, the work list and the ways to reach him. The live homepage
// (src/pages/index.astro) and every layout in the lab (src/lab/home/) read
// it from here, so a layout changes only how it's shown, never what it says.
import { SECTION_LABELS, entryHref, entryNumber, entryYears, homepageEntries } from './entries';

export const STEPS = [
  { title: 'Be curious', line: "Have conversations with the people you're building for. Consider every potential customer's perspective." },
  { title: 'Understand the problem', line: 'Fall in love with the problem, not the solution.' },
  { title: 'Map the journey', line: 'Map out the product journey for each user.' },
  { title: 'Know what the build needs', line: 'Understand every requirement. Work end to end, and know when to pull others in.' },
  { title: 'Mindless when it works', line: 'When it works, people move through the product without thinking about it.' },
];

export const STATEMENT =
  "As a builder in today's world, I'm responsible for all sides of a product. It has to be visually clean, and seamless enough that people forget they're on it, but still memorable and identifiable.";
export const CLOSER = "Anybody can have an idea. Not everybody can think through an entire product. That's what I do.";

export const EXPERIENCE: { when: string; role: string; where: string; line: string; href?: string }[] = [
  { when: '2025 – now', role: 'Founding Product Engineer', where: 'vers1ons', line: 'Product, design and code for music licensing and distribution.', href: '/work/vers1ons/' },
  { when: '2025', role: 'Software Engineering Intern', where: 'vers1ons', line: 'Built the landing page and messaging UI, then moved into backend and API work.' },
  { when: '2025', role: 'Design Strategist', where: 'EY', line: 'Client experience strategy for EY wavespace, a contract through USC Iovine and Young.' },
  { when: '2025', role: 'Product Designer and UX Researcher', where: 'VideoDraft', line: 'Designed the flow and agent experience for an AI text-to-video app, at a Techstars startup.' },
  { when: '2024', role: 'AI/LLM Evaluation', where: 'Outlier AI', line: 'Contract work refining prompts and flagging hallucinations.' },
];

export const EDUCATION = { role: 'M.S. Integrated Design, Business, and Computer Science', where: 'USC Iovine and Young Academy' };
export const LEADERSHIP = {
  when: '2024 – now',
  role: 'Founder and Mentor',
  where: 'Ignite',
  line: 'A mentorship program that has helped 50+ high school students apply to college and careers.',
};

// My work: every listed project, in the order /work shows them.
export const work = () =>
  homepageEntries().map((entry) => ({
    entry,
    href: entryHref(entry),
    kicker: [entryNumber(entry), SECTION_LABELS[entry.collection], entryYears(entry)].join(' · '),
  }));

export const RESUME = '/nahuel-delias-resume.pdf';
export const LINKS = [
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/nahuel-d-elias' },
  { label: 'Email', href: 'mailto:njdelias@gmail.com' },
  { label: 'GitHub', href: 'https://github.com/ndelias' },
];
