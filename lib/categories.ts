// Predefined categories for transactions and budgets

export const EXPENSE_CATEGORIES = [
  'Food & Dining',
  'Transportation',
  'Shopping',
  'Entertainment',
  'Bills & Utilities',
  'Healthcare',
  'Education',
  'Travel',
  'Groceries',
  'Rent',
  'Insurance',
  'Fitness',
  'Gifts',
  'Other', // Special option - allows custom input
];

export const INCOME_CATEGORIES = [
  'Salary',
  'Freelance',
  'Business',
  'Investments',
  'Rental Income',
  'Bonus',
  'Gift',
  'Refund',
  'Other', // Special option - allows custom input
];

export function getCategoriesByType(type: 'income' | 'expense'): string[] {
  return type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
}
