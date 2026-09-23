import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useHousehold } from '../lib/HouseholdContext';
import { useToast } from '../lib/ToastContext';

export default function CreateHouseholdForm({ onSuccess, onCancel }) {
  const { createHousehold } = useHousehold();
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showCode, setShowCode] = useState(false);
  const [generatedCode, setGeneratedCode] = useState(null);

  async function handleCreate() {
    if (!name.trim()) {
      setError('Digite um nome para o orçamento');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const result = await createHousehold(name.trim());
      setGeneratedCode(result.accessCode);
      setShowCode(true);
      showToast('Orçamento criado com sucesso! 🎉', 'success');
    } catch (err) {
      setError(err.message || 'Erro ao criar orçamento');
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  function handleContinue() {
    onSuccess();
  }

  // Se gerou código, mostra confirmação
  if (showCode) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md"
        >
          <div className="bg-slate-800 rounded-lg shadow-2xl p-8 border border-slate-700 text-center">
            <div className="mb-6">
              <div className="text-5xl mb-4">✅</div>
              <h1 className="text-2xl font-bold text-white mb-2">Orçamento Criado!</h1>
              <p className="text-slate-400">
                Seu novo orçamento "{name}" foi criado com sucesso.
              </p>
            </div>

            <div className="bg-slate-900 rounded-lg p-6 mb-6 border border-teal-600/30">
              <p className="text-sm text-slate-400 mb-2">Seu código de acesso é:</p>
              <p className="text-2xl font-mono font-bold text-teal-400 tracking-widest mb-3">
                {generatedCode}
              </p>
              <p className="text-xs text-slate-500">
                Compartilhe este código com outras pessoas para que elas possam se juntar ao seu orçamento.
              </p>
            </div>

            <button
              onClick={() => {
                navigator.clipboard.writeText(generatedCode);
                showToast('Código copiado! 📋', 'success');
              }}
              className="w-full py-2 px-4 bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold rounded-lg mb-4 transition-colors"
            >
              Copiar Código
            </button>

            <button
              onClick={handleContinue}
              className="w-full py-2.5 px-4 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg transition-colors"
            >
              Continuar
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Formulário de criar
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md"
      >
        <div className="bg-slate-800 rounded-lg shadow-2xl p-8 border border-slate-700">
          <h1 className="text-2xl font-bold text-white mb-2">Novo Orçamento</h1>
          <p className="text-slate-400 mb-6">
            Dê um nome para este orçamento familiar
          </p>

          <div className="mb-6">
            <label className="block text-sm font-semibold text-slate-300 mb-3">
              Nome do Orçamento
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              placeholder="Ex: Orçamento 2024"
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
              disabled={loading}
            />
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-3 bg-red-900/30 border border-red-600/50 rounded-lg text-red-300 text-sm"
            >
              {error}
            </motion.div>
          )}

          <div className="flex gap-3">
            <button
              onClick={onCancel}
              disabled={loading}
              className="flex-1 py-2.5 px-4 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleCreate}
              disabled={loading || !name.trim()}
              className="flex-1 py-2.5 px-4 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Criando...
                </>
              ) : (
                'Criar'
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
