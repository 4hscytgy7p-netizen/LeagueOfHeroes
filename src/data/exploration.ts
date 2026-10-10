import { books, getBookSection } from './books';
import { glossary } from './glossary';
import { explorationTopicDefinitions } from './explorationTopics';
import { resolveExplorationTopics } from '../utils/exploration';

export const explorationTopics = resolveExplorationTopics(explorationTopicDefinitions, getBookSection, books, glossary);
