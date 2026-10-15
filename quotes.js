export const quotes = [
    {
        text: 'Some things are in our control, while others are not.',
        author: 'Epictetus',
        source: 'Enchiridion, 1',
        application: 'Put your attention on the next action you can take, not on the result you cannot command.'
    },
    {
        text: 'The happiness of your life depends upon the quality of your thoughts.',
        author: 'Marcus Aurelius',
        source: 'Meditations, 3.9',
        application: 'Choose one useful, honest thought to guide the way you meet today.'
    },
    {
        text: 'We suffer more often in imagination than in reality.',
        author: 'Seneca',
        source: 'Letters, 13.4',
        application: 'Separate what has happened from what you fear might happen; respond to the facts.'
    },
    {
        text: 'First say to yourself what you would be; and then do what you have to do.',
        author: 'Epictetus',
        source: 'Discourses, 3.23',
        application: 'Name the quality you want to practice, then make it visible in one concrete action.'
    },
    {
        text: 'Waste no more time arguing what a good person should be. Be one.',
        author: 'Marcus Aurelius',
        source: 'Meditations, 10.16',
        application: 'Turn a value into a small act of craft, fairness, or self-restraint.'
    }
];

const quoteSituations = [
    'When your plans change',
    'When the outcome is uncertain',
    'When criticism arrives',
    'When a task feels difficult',
    'When someone disagrees with you',
    'When progress seems slow',
    'When you make a mistake',
    'When praise comes your way',
    'When you feel pulled in many directions',
    'When another person acts unfairly',
    'When the day does not go as expected',
    'When you are tempted to give up'
];

const stoicPrinciples = [
    'return to the next action within your control',
    'let your judgment be careful and your response deliberate',
    'measure success by honest effort, not applause',
    'meet difficulty with patience and practical courage',
    'listen fully before choosing what to say',
    'separate what happened from the story you add to it',
    'own the mistake, learn from it, and begin again',
    'receive recognition without making it your aim',
    'give your attention to one worthy task at a time',
    'answer injustice with fairness rather than imitation',
    'adapt your plan while keeping faith with your values',
    'make the next small step before judging the whole path',
    'choose what is useful over what is merely comfortable',
    'remember that another person’s opinion is not your character',
    'pause long enough to choose a response you respect',
    'practice the virtue this moment asks of you',
    'prepare well, then accept what preparation cannot decide',
    'treat your time as a resource for what matters',
    'keep your standards high and your self-talk humane',
    'look for the part you can improve, however small',
    'let reason guide you when emotion urges haste',
    'do your share without demanding control of the whole',
    'use restraint where impulse promises easy relief',
    'make room for another person’s needs alongside your own',
    'prefer a truthful answer to a flattering one',
    'bring steady attention to the work directly before you',
    'allow discomfort without letting it choose your conduct',
    'leave room for uncertainty while acting with care',
    'turn frustration into information for your next attempt',
    'choose a response that serves your principles',
    'begin again with the resources and clarity you have now'
];

export const DAILY_QUOTE_COUNT = 366;

export function dailyQuoteForIndex(index) {
    const normalizedIndex = ((Math.floor(index) % DAILY_QUOTE_COUNT) + DAILY_QUOTE_COUNT) % DAILY_QUOTE_COUNT;
    if (normalizedIndex < quotes.length) return quotes[normalizedIndex];

    const generatedIndex = normalizedIndex - quotes.length;
    const situation = quoteSituations[Math.floor(generatedIndex / stoicPrinciples.length)];
    const principle = stoicPrinciples[generatedIndex % stoicPrinciples.length];
    return {
        text: `${situation}, ${principle}.`,
        author: 'Stoic practice',
        source: 'Daily reflection',
        application: `Today, put this into practice: ${principle}.`
    };
}

export function dailyQuoteIndex(date = new Date()) {
    const calendarDay = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000;
    return ((calendarDay % DAILY_QUOTE_COUNT) + DAILY_QUOTE_COUNT) % DAILY_QUOTE_COUNT;
}

export function dailyQuoteDocumentId(date = new Date()) {
    return `day-${String(dailyQuoteIndex(date) + 1).padStart(3, '0')}`;
}
