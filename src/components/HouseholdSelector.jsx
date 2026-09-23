import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useHousehold } from '../lib/HouseholdContext';
import CreateHouseholdForm from './CreateHouseholdForm';
import JoinHouseholdForm from './JoinHouseholdForm';

export default function HouseholdSelector() {
  const { households, selectHousehold, loading } = useHousehold();
  const [mode, setMode] = useState(null); // null | 'create' | 'join' | null

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="text-center">
          <div className="mb-4 inline-block">
            <div className="w-12 h-12 border-4 border-slate-600 border-t-teal-500 rounded-full animate-spin"></div>
          </div>
          <p className="text-slate-400">Carregando...</p>
        </div>
      </div>
    );
  }

  // Se tem households, mostra lista
  if (households.length > 0 && mode === null) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="w-full max-w-md"
        >
          <div className="bg-slate-800 rounded-lg shadow-2xl p-8 border border-slate-700">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-white mb-2">Seus Orçamentos</h1>
              <p className="text-slate-400">Escolha qual orçamento gerenciar</p>
            </div>

            <div className="space-y-3 mb-8">
              {households.map((hh) => (
                <motion.button
                  key={hh.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => selectHousehold(hh)}
                  className="w-full text-left p-4 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors border border-slate-600 hover:border-teal-500"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-white">{hh.name}</p>
                      <p className="text-sm text-slate-400">
                        Criado em {new Date(hh.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <span className="text-2xl">→</span>
                  </div>
                </motion.button>
              ))}
            </div>

            <div className="space-y-3">
              <button
                onClick={() => setMode('create')}
                className="w-full py-2.5 px-4 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg transition-colors"
              >
                + Criar Novo Orçamento
              </button>
              <button
                onClick={() => setMode('join')}
                className="w-full py-2.5 px-4 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg border border-slate-600 transition-colors"
              >
                Entrar com Código
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // Se não tem households, mostra opções de criar ou entrar
  if (mode === null) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md"
        >
          <div className="bg-slate-800 rounded-lg shadow-2xl p-8 border border-slate-700 text-center">
            <h1 className="text-3xl font-bold text-white mb-2">Bem-vindo! 👋</h1>
            <p className="text-slate-400 mb-8">
              Você ainda não tem um orçamento. Crie um novo ou entre em um existente.
            </p>

            <div className="space-y-3">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setMode('create')}
                className="w-full py-3 px-4 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg transition-colors text-lg"
              >
                Criar Novo Orçamento
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setMode('join')}
                className="w-full py-3 px-4 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg border border-slate-600 transition-colors text-lg"
              >
                Entrar com Código
              </motion.button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // Modo criar
  if (mode === 'create') {
    return (
      <CreateHouseholdForm
        onSuccess={() => setMode(null)}
        onCancel={() => setMode(null)}
      />
    );
  }

  // Modo entrar
  if (mode === 'join') {
    return (
      <JoinHouseholdForm
        onSuccess={() => setMode(null)}
        onCancel={() => setMode(null)}
      />
    );
  }
}
