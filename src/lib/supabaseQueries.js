import { supabase } from '../supabaseClient';

/**
 * Funções de query que já filtram por household_id.
 * Use estas em vez de chamar supabase.from() diretamente.
 */

export async function getCategories(householdId) {
  return supabase
    .from('categories')
    .select('*')
    .eq('household_id', householdId)
    .order('sort_order');
}

export async function getCategoryGroups(householdId) {
  return supabase
    .from('category_groups')
    .select('*')
    .eq('household_id', householdId)
    .order('sort_order');
}

export async function getBudgetEntries(householdId) {
  return supabase
    .from('budget_entries')
    .select('*')
    .eq('household_id', householdId);
}

export async function getTransactions(householdId) {
  return supabase
    .from('transactions')
    .select('*')
    .eq('household_id', householdId);
}

export async function getOverspendMoves(householdId) {
  return supabase
    .from('overspend_moves')
    .select('*')
    .eq('household_id', householdId);
}

export async function insertTransaction(householdId, transaction) {
  return supabase
    .from('transactions')
    .insert({
      ...transaction,
      household_id: householdId,
    });
}

export async function updateTransaction(householdId, transactionId, updates) {
  return supabase
    .from('transactions')
    .update(updates)
    .eq('id', transactionId)
    .eq('household_id', householdId);
}

export async function deleteTransaction(householdId, transactionId) {
  return supabase
    .from('transactions')
    .delete()
    .eq('id', transactionId)
    .eq('household_id', householdId);
}

export async function upsertBudgetEntry(householdId, budgetEntry) {
  return supabase
    .from('budget_entries')
    .upsert({
      ...budgetEntry,
      household_id: householdId,
    });
}

export async function insertCategory(householdId, category) {
  return supabase
    .from('categories')
    .insert({
      ...category,
      household_id: householdId,
    })
    .select();
}

export async function insertOverspendMove(householdId, move) {
  return supabase
    .from('overspend_moves')
    .insert({
      ...move,
      household_id: householdId,
    });
}
