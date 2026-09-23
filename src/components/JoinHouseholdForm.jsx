import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useHousehold } from '../lib/HouseholdContext';
import { useToast } from '../lib/ToastContext';

export default function JoinHouseholdForm({ onSuccess, onCancel }) {
  const { joinHousehold } = useHousehold();
  const { showToast } = useToast();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleJoin() {
    if (!code.trim()) {
      setError('Digite o código de acesso');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await joinHousehold(code.trim());
      showToast('Você entrou no orçamento com sucesso! 🎉', 'success');
      onSuccess();
    } catch (err) {
      setError(err.message || 'Erro ao entrar no orçamento');
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  function handleKeyPress(e) {
    if (e.key === 'Enter' && !loading && code.trim()) {
      handleJoin();
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md"
      >
        <div className="bg-slate-800 rounded-lg shadow-2xl p-8 border border-slate-700">
          <h1 className="text-2xl font-bold text-white mb-2">Entrar no Orçamento</h1>
          <p className="text-slate-400 mb-6">
            Digite o código de acesso compartilhado por outro membro
          </p>

          <div className="mb-6">
            <label className="block text-sm font-semibold text-slate-300 mb-3">
              Código de Acesso
            </label>
            <input
              type="text"
              value={code.toUpperCase()}
              onChange={(e) => {
                setCode(e.target.value);
                setError(null);
              }}
              onKeyPress={handleKeyPress}
              placeholder="Ex: ABC123"
              maxLength="8"
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 text-center text-2xl tracking-widest font-mono focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
              disabled={loading}
              autoFocus
            />
            <p className="text-xs text-slate-500 mt-2 text-center">
              6-8 caracteres alfanuméricos
            </p>
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
              onClick={handleJoin}
              disabled={loading || !code.trim()}
              className="flex-1 py-2.5 px-4 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Entrando...
                </>
              ) : (
                'Entrar'
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
