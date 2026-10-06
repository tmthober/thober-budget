-- Script para migrar dados existentes de setembro/2026 para o novo sistema de households.
-- Execute DEPOIS de rodar migration_households.sql
-- 
-- O que faz:
-- 1. Cria um household inicial chamado "Meu Orçamento"
-- 2. Adiciona o seu UID (auth.uid()) como creator/admin
-- 3. Adiciona household_id a todas as linhas existentes nas 5 tabelas

-- =====================================================================
-- 1. Obter seu UID (substitua YOUR_UID_HERE pelo valor real de auth.uid())
-- =====================================================================
-- Dica: rode este SELECT primeiro pra descobrir seu UID:
-- SELECT auth.uid();

-- Ou use este bloco (funciona sem substituir nada):
DO $$
DECLARE
  v_household_id uuid;
  v_user_id uuid;
BEGIN
  -- Pega o UID do usuário atual
  v_user_id := auth.uid();
  
  -- Cria household inicial se não existir
  INSERT INTO households (name, access_code, created_by)
  VALUES ('Meu Orçamento', 'INITIAL', v_user_id)
  ON CONFLICT (access_code) DO NOTHING
  RETURNING id INTO v_household_id;
  
  -- Se não retornou (porque já existe), busca o ID
  IF v_household_id IS NULL THEN
    SELECT id INTO v_household_id FROM households WHERE access_code = 'INITIAL' LIMIT 1;
  END IF;
  
  -- Se ainda não temos household_id, algo deu errado
  IF v_household_id IS NULL THEN
    RAISE EXCEPTION 'Não foi possível criar ou encontrar household inicial';
  END IF;
  
  -- =====================================================================
  -- 2. Adiciona household_id a todas as linhas existentes
  -- =====================================================================
  
  -- category_groups
  UPDATE category_groups SET household_id = v_household_id WHERE household_id IS NULL;
  
  -- categories
  UPDATE categories SET household_id = v_household_id WHERE household_id IS NULL;
  
  -- budget_entries
  UPDATE budget_entries SET household_id = v_household_id WHERE household_id IS NULL;
  
  -- transactions
  UPDATE transactions SET household_id = v_household_id WHERE household_id IS NULL;
  
  -- overspend_moves
  UPDATE overspend_moves SET household_id = v_household_id WHERE household_id IS NULL;
  
  -- =====================================================================
  -- 3. Adiciona você como membro do household (se não for criador)
  -- =====================================================================
  
  INSERT INTO household_members (household_id, user_id, role)
  VALUES (v_household_id, v_user_id, 'admin')
  ON CONFLICT (household_id, user_id) DO NOTHING;
  
  RAISE NOTICE 'Migração concluída! Household ID: %', v_household_id;
END $$;

-- =====================================================================
-- 4. Verificação (opcional — descomente pra ver o resultado)
-- =====================================================================

-- SELECT COUNT(*) as "Category Groups com household_id" FROM category_groups WHERE household_id IS NOT NULL;
-- SELECT COUNT(*) as "Categories com household_id" FROM categories WHERE household_id IS NOT NULL;
-- SELECT COUNT(*) as "Budget Entries com household_id" FROM budget_entries WHERE household_id IS NOT NULL;
-- SELECT COUNT(*) as "Transactions com household_id" FROM transactions WHERE household_id IS NOT NULL;
-- SELECT COUNT(*) as "Overspend Moves com household_id" FROM overspend_moves WHERE household_id IS NOT NULL;
-- 
-- SELECT * FROM households;
-- SELECT * FROM household_members;
