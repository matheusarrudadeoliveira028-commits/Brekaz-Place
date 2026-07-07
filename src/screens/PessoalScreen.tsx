import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, ActivityIndicator, TouchableOpacity, TextInput, FlatList, Alert } from 'react-native';
import { supabase } from '../../supabase';

type DespesaPessoal = {
  id: number;
  descricao: string;
  valor: number;
  data_movimento: string;
  status: string;
  recorrente: boolean;
};

export default function PessoalScreen({ navigation }: any) {
  const [abaAtual, setAbaAtual] = useState<'resumo' | 'lancamentos'>('resumo');
  const [carregando, setCarregando] = useState(true);
  
  // Resumo
  const [totalRetiradasEmpresa, setTotalRetiradasEmpresa] = useState(0); 
  const [gastosPagos, setGastosPagos] = useState(0);
  const [gastosPendentes, setGastosPendentes] = useState(0);
  
  // Lista e Formulário
  const [despesas, setDespesas] = useState<DespesaPessoal[]>([]);
  const [formDescricao, setFormDescricao] = useState('');
  const [formValor, setFormValor] = useState('');
  const [formData, setFormData] = useState('');
  const [formRecorrente, setFormRecorrente] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    carregarCaixaPessoal();
  }, []);

  // ==========================================
  // BUSCA DE DADOS
  // ==========================================
  async function carregarCaixaPessoal() {
    setCarregando(true);
    
    // 1. Busca automaticamente todas as RETIRADAS PAGAS da empresa
    const { data: retiradasData } = await supabase
      .from('movimentacoes_financeiras')
      .select('valor')
      .eq('tipo', 'Retirada')
      .eq('status', 'Pago');
      
    let somaRetiradas = 0;
    if (retiradasData) {
      retiradasData.forEach(item => somaRetiradas += Number(item.valor));
    }
    setTotalRetiradasEmpresa(somaRetiradas);

    // 2. Busca os gastos pessoais e separa os Pagos dos Pendentes
    const { data: gastosData } = await supabase
      .from('despesas_pessoais')
      .select('*')
      .order('id', { ascending: false });
      
    let somaPagos = 0;
    let somaPendentes = 0;

    if (gastosData) {
      setDespesas(gastosData);
      gastosData.forEach(item => {
        if (item.status === 'Pago') {
          somaPagos += Number(item.valor);
        } else {
          somaPendentes += Number(item.valor);
        }
      });
    }
    setGastosPagos(somaPagos);
    setGastosPendentes(somaPendentes);
    
    setCarregando(false);
  }

  // ==========================================
  // LÓGICA DE SALVAR, EXCLUIR E ALTERAR
  // ==========================================
  async function salvarGastoPessoal() {
    if (!formDescricao || !formValor || !formData) return Alert.alert('Atenção', 'Preencha a descrição, valor e data.');

    setSalvando(true);
    const valorConvertido = parseFloat(formValor.replace(',', '.')) || 0;

    const { error } = await supabase.from('despesas_pessoais').insert({
      descricao: formDescricao,
      valor: valorConvertido,
      data_movimento: formData,
      status: 'Pendente', // Nasce pendente para prever o futuro
      recorrente: formRecorrente
    });

    setSalvando(false);

    if (error) Alert.alert('Erro', 'Falha ao salvar despesa pessoal.');
    else {
      Alert.alert('Sucesso', 'Gasto registrado como PENDENTE.');
      setFormDescricao(''); setFormValor(''); setFormData(''); setFormRecorrente(false);
      carregarCaixaPessoal();
    }
  }

  async function alternarStatus(id: number, statusAtual: string) {
    const novoStatus = statusAtual === 'Pendente' ? 'Pago' : 'Pendente';
    await supabase.from('despesas_pessoais').update({ status: novoStatus }).eq('id', id);
    carregarCaixaPessoal();
  }

  async function excluirGasto(id: number) {
    Alert.alert('Confirmar', 'Apagar este registro?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Apagar', style: 'destructive', onPress: async () => { 
          await supabase.from('despesas_pessoais').delete().eq('id', id); 
          carregarCaixaPessoal(); 
        } 
      }
    ]);
  }

  // ==========================================
  // CÁLCULOS MATEMÁTICOS DE PREVISÃO
  // ==========================================
  
  // 1. Dinheiro real no seu bolso hoje
  const saldoLivreAtual = totalRetiradasEmpresa - gastosPagos;
  
  // 2. Previsão de sobra após pagar os boletos/cartões pendentes
  const saldoProjetado = saldoLivreAtual - gastosPendentes;

  return (
    <View style={styles.container}>
      {/* CABEÇALHO */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.textoVoltar}>← Voltar pro Admin</Text>
        </TouchableOpacity>
        <Text style={styles.tituloHeader}>Meu Bolso (PF) 👤</Text>
      </View>

      {/* ABAS */}
      <View style={styles.menuAbas}>
        <TouchableOpacity style={[styles.aba, abaAtual === 'resumo' && styles.abaAtiva]} onPress={() => setAbaAtual('resumo')}>
          <Text style={[styles.textoAba, abaAtual === 'resumo' && styles.textoAbaAtiva]}>Resumo Pessoal</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.aba, abaAtual === 'lancamentos' && styles.abaAtiva]} onPress={() => setAbaAtual('lancamentos')}>
          <Text style={[styles.textoAba, abaAtual === 'lancamentos' && styles.textoAbaAtiva]}>Lançamentos</Text>
        </TouchableOpacity>
      </View>

      {carregando ? (
        <ActivityIndicator size="large" color="#3b82f6" style={{ marginTop: 50 }} />
      ) : (
        <>
          {/* ================================================== */}
          {/* ABA 1: RESUMO                                      */}
          {/* ================================================== */}
          {abaAtual === 'resumo' && (
            <ScrollView contentContainerStyle={{ padding: 20 }}>
              
              {/* SALDO REAL */}
              <View style={styles.cardResumoPrincipal}>
                <Text style={styles.labelResumo}>Saldo Real (No Bolso Hoje)</Text>
                <Text style={[styles.valorCaixa, { color: saldoLivreAtual >= 0 ? '#3b82f6' : '#ef4444' }]}>
                  R$ {saldoLivreAtual.toFixed(2)}
                </Text>
                <Text style={{color: '#94a3b8', fontSize: 12}}>Lucro recebido da PJ menos os gastos pagos</Text>
              </View>

              {/* PREVISÃO FUTURA */}
              <View style={[styles.cardResumoPrincipal, { backgroundColor: '#1e293b', marginBottom: 25 }]}>
                <Text style={[styles.labelResumo, { color: '#60a5fa' }]}>Previsão de Sobra (Mês)</Text>
                <Text style={[styles.valorCaixa, { color: '#fff' }]}>
                  R$ {saldoProjetado.toFixed(2)}
                </Text>
                <Text style={{color: '#cbd5e1', fontSize: 12, textAlign: 'center'}}>
                  O que sobrará para você após pagar as contas de casa pendentes.
                </Text>
              </View>

              <Text style={styles.tituloSecao}>Seu Fluxo de Caixa</Text>
              
              <View style={styles.linhaResumo}>
                <Text style={styles.textoLinhaResumo}>Recebido da Empresa</Text>
                <Text style={[styles.valorLinhaResumo, { color: '#10b981' }]}>+ R$ {totalRetiradasEmpresa.toFixed(2)}</Text>
              </View>
              
              <View style={styles.linhaResumo}>
                <View>
                  <Text style={styles.textoLinhaResumo}>Contas de Casa (Pagas)</Text>
                  <Text style={{ fontSize: 11, color: '#64748b' }}>Gastos que já saíram do bolso</Text>
                </View>
                <Text style={[styles.valorLinhaResumo, { color: '#ef4444' }]}>- R$ {gastosPagos.toFixed(2)}</Text>
              </View>

              <View style={styles.linhaResumo}>
                <View>
                  <Text style={styles.textoLinhaResumo}>Contas de Casa (Pendentes)</Text>
                  <Text style={{ fontSize: 11, color: '#64748b' }}>Fatura do cartão, boletos previstos</Text>
                </View>
                <Text style={[styles.valorLinhaResumo, { color: '#f59e0b' }]}>- R$ {gastosPendentes.toFixed(2)}</Text>
              </View>

            </ScrollView>
          )}

          {/* ================================================== */}
          {/* ABA 2: LANÇAMENTOS E HISTÓRICO                     */}
          {/* ================================================== */}
          {abaAtual === 'lancamentos' && (
            <View style={{ flex: 1 }}>
              
              {/* FORMULÁRIO */}
              <View style={styles.cardFormulario}>
                <Text style={styles.tituloFormulario}>Registrar Despesa Pessoal</Text>
                <TextInput style={styles.input} placeholder="Ex: Conta de Luz, Fatura Cartão..." value={formDescricao} onChangeText={setFormDescricao} />
                
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TextInput style={[styles.input, { flex: 1 }]} placeholder="Valor (R$)" keyboardType="numeric" value={formValor} onChangeText={setFormValor} />
                  <TextInput style={[styles.input, { flex: 1 }]} placeholder="Data Vencimento" value={formData} onChangeText={setFormData} />
                </View>

                {/* BOTÃO DE RECORRÊNCIA */}
                <TouchableOpacity 
                  style={[styles.btnRecorrente, formRecorrente && styles.btnRecorrenteAtivo]} 
                  onPress={() => setFormRecorrente(!formRecorrente)}
                >
                  <Text style={[styles.textoRecorrente, formRecorrente && styles.textoRecorrenteAtivo]}>
                    {formRecorrente ? '🔄 Conta Fixa de Casa (Recorrente)' : '⚪ Gasto Avulso (Ex: Jantar, Lazer)'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.botaoSalvar} onPress={salvarGastoPessoal} disabled={salvando}>
                  <Text style={styles.textoBotaoBranco}>{salvando ? 'Salvando...' : 'Adicionar como PENDENTE'}</Text>
                </TouchableOpacity>
              </View>

              {/* LISTA */}
              <FlatList
                data={despesas}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={{ padding: 20 }}
                renderItem={({ item }) => (
                  <View style={styles.cardLancamento}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.textoDescricaoLancamento}>
                        {item.descricao} {item.recorrente && <Text style={{fontSize: 12}}>🔄</Text>}
                      </Text>
                      <Text style={styles.textoDataLancamento}>Vencimento: {item.data_movimento}</Text>

                      <TouchableOpacity onPress={() => alternarStatus(item.id, item.status)} style={[{ marginTop: 8, padding: 5, borderRadius: 5, alignSelf: 'flex-start', borderWidth: 1 }, item.status === 'Pago' ? { backgroundColor: '#d1fae5', borderColor: '#10b981' } : { backgroundColor: '#fef3c7', borderColor: '#f59e0b' }]}>
                        <Text style={{ fontSize: 12, fontWeight: 'bold', color: item.status === 'Pago' ? '#059669' : '#d97706' }}>
                          Status: {item.status} (Mudar)
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <View style={{ alignItems: 'flex-end', justifyContent: 'space-between' }}>
                      <Text style={styles.textoValorLancamento}>- R$ {item.valor.toFixed(2)}</Text>
                      <TouchableOpacity onPress={() => excluirGasto(item.id)} style={{marginTop: 5}}>
                        <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: 'bold' }}>Excluir</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
                ListEmptyComponent={() => (
                  <Text style={{textAlign: 'center', color: '#94a3b8', marginTop: 20}}>Nenhum gasto pessoal registrado.</Text>
                )}
              />
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { padding: 20, paddingTop: 40, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#e2e8f0' },
  textoVoltar: { color: '#3b82f6', fontWeight: 'bold', marginBottom: 10 },
  tituloHeader: { fontSize: 24, fontWeight: '900', color: '#0f172a' },
  
  menuAbas: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#e2e8f0' },
  aba: { flex: 1, paddingVertical: 15, alignItems: 'center' },
  abaAtiva: { borderBottomWidth: 3, borderColor: '#3b82f6' },
  textoAba: { color: '#64748b', fontWeight: '600', fontSize: 14 },
  textoAbaAtiva: { color: '#3b82f6', fontWeight: 'bold', fontSize: 14 },

  cardResumoPrincipal: { backgroundColor: '#0f172a', padding: 25, borderRadius: 16, elevation: 4, marginBottom: 15, alignItems: 'center' },
  labelResumo: { color: '#cbd5e1', fontSize: 14, fontWeight: '600' },
  valorCaixa: { fontSize: 38, fontWeight: '900', marginVertical: 5 },
  
  tituloSecao: { fontSize: 16, fontWeight: 'bold', color: '#0f172a', marginBottom: 15 },
  linhaResumo: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#fff', padding: 15, borderRadius: 10, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' },
  textoLinhaResumo: { fontSize: 15, color: '#475569', fontWeight: '600' },
  valorLinhaResumo: { fontSize: 16, fontWeight: '900' },

  cardFormulario: { backgroundColor: '#fff', padding: 20, borderBottomWidth: 1, borderColor: '#e2e8f0', elevation: 2 },
  tituloFormulario: { fontSize: 16, fontWeight: 'bold', color: '#0f172a', marginBottom: 15 },
  input: { backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 12, fontSize: 14, marginBottom: 10 },
  
  btnRecorrente: { backgroundColor: '#f1f5f9', padding: 12, borderRadius: 8, alignItems: 'center', marginBottom: 10, borderWidth: 1, borderColor: '#cbd5e1' },
  btnRecorrenteAtivo: { backgroundColor: '#eff6ff', borderColor: '#3b82f6' },
  textoRecorrente: { color: '#64748b', fontWeight: '600', fontSize: 13 },
  textoRecorrenteAtivo: { color: '#2563eb', fontWeight: 'bold', fontSize: 13 },

  botaoSalvar: { backgroundColor: '#3b82f6', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 5 },
  textoBotaoBranco: { color: '#fff', fontWeight: 'bold', fontSize: 15 },

  cardLancamento: { flexDirection: 'row', backgroundColor: '#fff', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 10 },
  textoDescricaoLancamento: { fontSize: 15, fontWeight: 'bold', color: '#1e293b', marginBottom: 3 },
  textoDataLancamento: { fontSize: 12, color: '#64748b' },
  textoValorLancamento: { fontSize: 16, fontWeight: '900', color: '#ef4444' }
});