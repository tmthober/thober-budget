import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const HouseholdContext = createContext();

export function HouseholdProvider({ children }) {
  const [selectedHousehold, setSelectedHousehold] = useState(null);
  const [households, setHouseholds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Carrega households do usuário ao montar ou quando o usuário muda
  useEffect(() => {
    loadHouseholds();
  }, []);

  async function loadHouseholds() {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setHouseholds([]);
        setSelectedHousehold(null);
        return;
      }

      // Busca households que o usuário criou ou é membro
      const { data, error: err } = await supabase
        .from('household_members')
        .select('households(id, name, created_by, access_code, created_at)')
        .eq('user_id', user.id);

      if (err) throw err;

      const householdList = data?.map(m => m.households).filter(Boolean) || [];
      setHouseholds(householdList);

      // Se tem exatamente 1 household, seleciona automaticamente
      if (householdList.length === 1) {
        setSelectedHousehold(householdList[0]);
        localStorage.setItem('selectedHouseholdId', householdList[0].id);
      } else if (householdList.length > 1) {
        // Se tem múltiplos, tenta recuperar da localStorage
        const savedId = localStorage.getItem('selectedHouseholdId');
        const saved = householdList.find(h => h.id === savedId);
        if (saved) {
          setSelectedHousehold(saved);
        }
      }
    } catch (err) {
      console.error('Erro ao carregar households:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function selectHousehold(household) {
    setSelectedHousehold(household);
    localStorage.setItem('selectedHouseholdId', household.id);
  }

  async function createHousehold(name) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Gera access code aleatório (6 caracteres)
      const accessCode = Math.random().toString(36).substring(2, 8).toUpperCase();

      // Cria household
      const { data: newHH, error: createErr } = await supabase
        .from('households')
        .insert({
          name,
          access_code: accessCode,
          created_by: user.id,
        })
        .select()
        .single();

      if (createErr) throw createErr;

      // Adiciona criador como membro (admin)
      const { error: memberErr } = await supabase
        .from('household_members')
        .insert({
          household_id: newHH.id,
          user_id: user.id,
          role: 'admin',
        });

      if (memberErr) throw memberErr;

      // Cria seed de categorias e grupos para o novo household
      await createDefaultCategories(newHH.id);

      // Recarrega e seleciona
      await loadHouseholds();
      selectHousehold(newHH);

      return { success: true, household: newHH, accessCode };
    } catch (err) {
      console.error('Erro ao criar household:', err);
      throw err;
    }
  }

  async function joinHousehold(accessCode) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Busca household pelo access code
      const { data: households, error: searchErr } = await supabase
        .from('households')
        .select('id')
        .eq('access_code', accessCode.toUpperCase())
        .single();

      if (searchErr) throw new Error('Código de acesso inválido');
      if (!households) throw new Error('Household não encontrado');

      // Checa se já é membro
      const { data: existing } = await supabase
        .from('household_members')
        .select('id')
        .eq('household_id', households.id)
        .eq('user_id', user.id)
        .single();

      if (existing) throw new Error('Você já é membro deste household');

      // Adiciona como membro
      const { error: joinErr } = await supabase
        .from('household_members')
        .insert({
          household_id: households.id,
          user_id: user.id,
          role: 'member',
        });

      if (joinErr) throw joinErr;

      // Recarrega e seleciona
      await loadHouseholds();
      const joined = households;
      selectHousehold(joined);

      return { success: true, household: joined };
    } catch (err) {
      console.error('Erro ao entrar em household:', err);
      throw err;
    }
  }

  async function leaveHousehold(householdId) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { error: err } = await supabase
        .from('household_members')
        .delete()
        .eq('household_id', householdId)
        .eq('user_id', user.id);

      if (err) throw err;

      // Se era o selecionado, limpa
      if (selectedHousehold?.id === householdId) {
        setSelectedHousehold(null);
        localStorage.removeItem('selectedHouseholdId');
      }

      await loadHouseholds();
      return { success: true };
    } catch (err) {
      console.error('Erro ao sair de household:', err);
      throw err;
    }
  }

  return (
    <HouseholdContext.Provider
      value={{
        selectedHousehold,
        households,
        loading,
        error,
        selectHousehold,
        createHousehold,
        joinHousehold,
        leaveHousehold,
        loadHouseholds,
      }}
    >
      {children}
    </HouseholdContext.Provider>
  );
}

export function useHousehold() {
  const context = useContext(HouseholdContext);
  if (!context) {
    throw new Error('useHousehold deve ser usado dentro de HouseholdProvider');
  }
  return context;
}

// =====================================================================
// Helper: cria seed de categorias e grupos padrão para novo household
// =====================================================================

async function createDefaultCategories(householdId) {
  try {
    // Insere grupos
    const groupsData = [
      { name: 'Income', sort_order: 0 },
      { name: 'Immediate Obligations', sort_order: 1 },
      { name: 'Variable Expenses', sort_order: 2 },
      { name: 'True Expenses', sort_order: 3 },
      { name: 'Long-term Savings', sort_order: 4 },
      { name: 'Wish Farm', sort_order: 5 },
    ].map(g => ({ ...g, household_id: householdId }));

    const { data: groups, error: groupErr } = await supabase
      .from('category_groups')
      .insert(groupsData)
      .select();

    if (groupErr) throw groupErr;

    // Mapeia nome do grupo → id
    const groupMap = {};
    groups.forEach(g => {
      groupMap[g.name] = g.id;
    });

    // Categorias padrão (sem valores, tudo em 0)
    const categoriesData = [
      // Income
      { group_id: groupMap['Income'], name: '💰 Renda', sort_order: 0, is_income: true },

      // Immediate Obligations
      { group_id: groupMap['Immediate Obligations'], name: '🏠 Condomínio', sort_order: 0 },
      { group_id: groupMap['Immediate Obligations'], name: '💡 Energia', sort_order: 1 },
      { group_id: groupMap['Immediate Obligations'], name: '🏛️ INSS', sort_order: 2 },
      { group_id: groupMap['Immediate Obligations'], name: '🏛️ MEI', sort_order: 3 },
      { group_id: groupMap['Immediate Obligations'], name: '🌐 Internet', sort_order: 4 },
      { group_id: groupMap['Immediate Obligations'], name: '📱 Celular', sort_order: 5 },
      { group_id: groupMap['Immediate Obligations'], name: '🛒 Supermercado - Need', sort_order: 6 },
      { group_id: groupMap['Immediate Obligations'], name: '🛒 Supermercado - Want', sort_order: 7 },
      { group_id: groupMap['Immediate Obligations'], name: '💊 Farmácia - Remédios fixos', sort_order: 8 },
      { group_id: groupMap['Immediate Obligations'], name: '🧳 Gás', sort_order: 9 },
      { group_id: groupMap['Immediate Obligations'], name: '🗺️ Transporte - Ônibus', sort_order: 10 },
      { group_id: groupMap['Immediate Obligations'], name: '🗺️ Transporte - Uber', sort_order: 11 },
      { group_id: groupMap['Immediate Obligations'], name: '🗺️ Transporte - Gasolina', sort_order: 12 },
      { group_id: groupMap['Immediate Obligations'], name: '🗺️ Transporte - Seguro carro', sort_order: 13 },
      { group_id: groupMap['Immediate Obligations'], name: '🤲 Generosidade', sort_order: 14 },
      { group_id: groupMap['Immediate Obligations'], name: '♻️ Assinaturas', sort_order: 15 },

      // Variable Expenses
      { group_id: groupMap['Variable Expenses'], name: '🍔 Alimentação - Restaurante', sort_order: 0 },
      { group_id: groupMap['Variable Expenses'], name: '🍔 Alimentação - Ifood', sort_order: 1 },
      { group_id: groupMap['Variable Expenses'], name: '💰 Spending Money', sort_order: 2 },
      { group_id: groupMap['Variable Expenses'], name: '💖 Dates', sort_order: 3 },
      { group_id: groupMap['Variable Expenses'], name: '🛋️ Decoração/Casa', sort_order: 4 },
      { group_id: groupMap['Variable Expenses'], name: '☕ Diversão', sort_order: 5 },

      // True Expenses
      { group_id: groupMap['True Expenses'], name: '🗺️ Transporte - Manutenção', sort_order: 0 },
      { group_id: groupMap['True Expenses'], name: '💊 Farmácia - Remédio', sort_order: 1 },
      { group_id: groupMap['True Expenses'], name: '🎁 Presentes', sort_order: 2 },
      { group_id: groupMap['True Expenses'], name: '🎄 Eventos', sort_order: 3 },
      { group_id: groupMap['True Expenses'], name: '📚 Educação', sort_order: 4 },
      { group_id: groupMap['True Expenses'], name: '👕 Vestuário', sort_order: 5 },
      { group_id: groupMap['True Expenses'], name: '💉 Contas médicas', sort_order: 6 },
      { group_id: groupMap['True Expenses'], name: '🏠 Casa - Manutenção', sort_order: 7 },
      { group_id: groupMap['True Expenses'], name: '💸 Assinaturas anuais', sort_order: 8 },

      // Long-term Savings
      { group_id: groupMap['Long-term Savings'], name: '🚨 Fundo de emergência', sort_order: 0 },
      { group_id: groupMap['Long-term Savings'], name: '✈️ Viagem', sort_order: 1 },
      { group_id: groupMap['Long-term Savings'], name: '💰 Poupança', sort_order: 2 },

      // Wish Farm
      { group_id: groupMap['Wish Farm'], name: '🚙 Carro', sort_order: 0 },
      { group_id: groupMap['Wish Farm'], name: '💻 Eletrônicos', sort_order: 1 },
      { group_id: groupMap['Wish Farm'], name: '🎮 Outros desejos', sort_order: 2 },
    ].map(c => ({ ...c, household_id: householdId, is_income: c.is_income || false }));

    const { error: catErr } = await supabase
      .from('categories')
      .insert(categoriesData);

    if (catErr) throw catErr;
  } catch (err) {
    console.error('Erro ao criar categorias padrão:', err);
    // Não joga erro, é só seed
  }
}
