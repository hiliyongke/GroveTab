export { DailyQuote } from './DailyQuote';
export {
  getTodayQuote,
  getRandomQuote,
  findQuoteById,
  getFavoriteQuotes,
  isFavorite,
  toggleFavorite,
  clearFavorites,
} from './quote-service';
export { QUOTES, QUOTE_CATEGORIES, filterByCategories } from './quotes-data';
export type { Quote, QuoteCategory } from './quotes-data';
