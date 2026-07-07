import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, ActivityIndicator, TouchableOpacity, TextInput, FlatList, Alert } from 'react-native';
import { supabase } from '../../supabase';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

type Movimentacao = {
  id: number;
  tipo: string;
  descricao: string;
  valor: number;
  data_movimento: string;
  status: string;
  recorrente: boolean;
};

export default function FinanceiroScreen({ navigation }: any) {
  const [abaAtual, setAbaAtual] = useState<'resumo' | 'lancamentos'>('resumo');
  const [carregando, setCarregando] = useState(true);
  
  // Faturamento Previsto (Das empresas)
  const [faturamentoPrevisto, setFaturamentoPrevisto] = useState(0);
  const [empresasAtivas, setEmpresasAtivas] = useState(0);

  // Totais PAGOS (Realizados)
  const [mensalidadesPagas, setMensalidadesPagas] = useState(0);
  const [extrasPagas, setExtrasPagas] = useState(0);
  const [despesasPagas, setDespesasPagas] = useState(0);
  const [retiradasPagas, setRetiradasPagas] = useState(0);

  // Totais PENDENTES (A pagar / A receber)
  const [mensalidadesPendentes, setMensalidadesPendentes] = useState(0); // <-- CORREÇÃO
  const [extrasPendentes, setExtrasPendentes] = useState(0);             // <-- CORREÇÃO
  const [despesasPendentes, setDespesasPendentes] = useState(0);
  const [retiradasPendentes, setRetiradasPendentes] = useState(0);

  // Lista de Movimentações e Formulário
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([]);
  const [formTipo, setFormTipo] = useState<'Mensalidade' | 'Entrada Extra' | 'Despesa' | 'Retirada'>('Mensalidade');
  const [formDescricao, setFormDescricao] = useState('');
  const [formValor, setFormValor] = useState('');
  const [formData, setFormData] = useState('');
  const [formRecorrente, setFormRecorrente] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    carregarTudo();
  }, []);

  // ==========================================
  // BUSCAR DADOS DO BANCO
  // ==========================================
  async function carregarTudo() {
    setCarregando(true);
    
    // 1. Busca faturamento PREVISTO
    const { data: empData } = await supabase.from('empresas').select('status_conta, valor_mensalidade');
    let somaPrevista = 0;
    let ativas = 0;
    if (empData) {
      empData.forEach(empresa => {
        if (empresa.status_conta !== 'Cancelada' && empresa.status_conta !== 'Inativa') {
          somaPrevista += parseFloat(String(empresa.valor_mensalidade || '0').replace(',', '.')) || 0;
          ativas += 1;
        }
      });
    }
    setFaturamentoPrevisto(somaPrevista);
    setEmpresasAtivas(ativas);

    // 2. Busca histórico de lançamentos separando TUDO
    const { data: movData } = await supabase.from('movimentacoes_financeiras').select('*').order('id', { ascending: false });
    
    if (movData) {
      setMovimentacoes(movData);
      
      let despPagas = 0, retPagas = 0, extPagas = 0, mensPagas = 0;
      let despPend = 0, retPend = 0, extPend = 0, mensPend = 0; // <-- Adicionado mensPend

      movData.forEach(mov => {
        const valorNum = Number(mov.valor);
        if (mov.status === 'Pago') {
          if (mov.tipo === 'Despesa') despPagas += valorNum;
          if (mov.tipo === 'Retirada') retPagas += valorNum;
          if (mov.tipo === 'Entrada Extra') extPagas += valorNum;
          if (mov.tipo === 'Mensalidade') mensPagas += valorNum;
        } else {
          // PENDENTES
          if (mov.tipo === 'Despesa') despPend += valorNum;
          if (mov.tipo === 'Retirada') retPend += valorNum;
          if (mov.tipo === 'Entrada Extra') extPend += valorNum;
          if (mov.tipo === 'Mensalidade') mensPend += valorNum; // <-- CORREÇÃO (Agora soma os pendentes manuais)
        }
      });
      
      setDespesasPagas(despPagas); setRetiradasPagas(retPagas); setExtrasPagas(extPagas); setMensalidadesPagas(mensPagas);
      setDespesasPendentes(despPend); setRetiradasPendentes(retPend); setExtrasPendentes(extPend); setMensalidadesPendentes(mensPend);
    }
    
    setCarregando(false);
  }

  // ==========================================
  // LÓGICA DE SALVAR, EXCLUIR E PDF
  // ==========================================
  async function salvarLancamento() {
    if (!formDescricao || !formValor || !formData) return Alert.alert('Atenção', 'Preencha a descrição, valor e data.');

    setSalvando(true);
    const valorConvertido = parseFloat(formValor.replace(',', '.')) || 0;

    const { error } = await supabase.from('movimentacoes_financeiras').insert({
      tipo: formTipo, descricao: formDescricao, valor: valorConvertido, data_movimento: formData,
      status: 'Pendente',
      recorrente: formRecorrente 
    });

    setSalvando(false);

    if (error) Alert.alert('Erro', 'Falha ao salvar lançamento.');
    else {
      Alert.alert('Sucesso', 'Lançamento registrado como Pendente!');
      setFormDescricao(''); setFormValor(''); setFormData(''); setFormRecorrente(false);
      carregarTudo();
    }
  }

  async function alternarStatus(id: number, statusAtual: string) {
    const novoStatus = statusAtual === 'Pendente' ? 'Pago' : 'Pendente';
    await supabase.from('movimentacoes_financeiras').update({ status: novoStatus }).eq('id', id);
    carregarTudo();
  }

  async function excluirMovimentacao(id: number) {
    Alert.alert('Confirmar', 'Apagar este registro?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Apagar', style: 'destructive', onPress: async () => { await supabase.from('movimentacoes_financeiras').delete().eq('id', id); carregarTudo(); } }
    ]);
  }

  async function gerarComprovantePDF(mov: Movimentacao) {
    try {
      const corTipo = mov.tipo === 'Despesa' || mov.tipo === 'Retirada' ? '#ef4444' : '#10b981';
      const htmlContent = `
        <html>
          <head>
            <style>
              body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #333; }
              .header { text-align: center; margin-bottom: 40px; }
              .logo { font-size: 28px; font-weight: bold; color: #0f172a; }
              .sublogo { font-size: 14px; color: #64748b; }
              .box { border: 2px solid #e2e8f0; border-radius: 12px; padding: 30px; }
              .row { display: flex; justify-content: space-between; margin-bottom: 20px; border-bottom: 1px solid #f1f5f9; padding-bottom: 10px; }
              .label { font-size: 14px; color: #64748b; font-weight: bold; text-transform: uppercase; }
              .value { font-size: 18px; color: #0f172a; font-weight: bold; }
              .valor-destaque { font-size: 24px; color: ${corTipo}; font-weight: bold; }
              .footer { text-align: center; margin-top: 40px; font-size: 12px; color: #94a3b8; }
            </style>
          </head>
          <body>
            <div class="header">
              <div class="logo">Brekaz Place</div>
              <div class="sublogo">Comprovante Oficial de Operação</div>
            </div>
            <div class="box">
              <div class="row"><span class="label">Descrição:</span><span class="value">${mov.descricao}</span></div>
              <div class="row"><span class="label">Categoria:</span><span class="value">${mov.tipo} ${mov.recorrente ? '(Recorrente)' : '(Avulso)'}</span></div>
              <div class="row"><span class="label">Data de Competência:</span><span class="value">${mov.data_movimento}</span></div>
              <div class="row"><span class="label">Status:</span><span class="value">${mov.status}</span></div>
              <div class="row" style="border: none;"><span class="label">Valor Total:</span><span class="valor-destaque">R$ ${mov.valor.toFixed(2)}</span></div>
            </div>
            <div class="footer">Comprovante gerado digitalmente em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}</div>
          </body>
        </html>
      `;
      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      await Sharing.shareAsync(uri);
    } catch (error) { Alert.alert('Erro', 'Não foi possível gerar o PDF.'); }
  }

  // ==========================================
  // CÁLCULOS MATEMÁTICOS CORRIGIDOS
  // ==========================================
  
  // 1. O que você de fato TEM NA CONTA hoje
  const saldoRealAtual = (mensalidadesPagas + extrasPagas) - (despesasPagas + retiradasPagas);

  // 2. O que você TEM A PAGAR E RECEBER (Pendentes)
  const contasAPagarPendentes = despesasPendentes + retiradasPendentes;
  
  // A MÁGICA AQUI: Pega o que for MAIOR entre (A expectativa de faturamento que falta pagar) OU (As mensalidades manuais pendentes). Depois soma com as Entradas Extras Pendentes.
  const expectativaMensalidades = faturamentoPrevisto - mensalidadesPagas;
  const recebimentosPendentesTotais = Math.max(expectativaMensalidades, mensalidadesPendentes) + extrasPendentes;
  
  // 3. A PREVISÃO DO FIM DO MÊS (Caixa Total se tudo for pago e recebido)
  const totalReceitasProjetadas = mensalidadesPagas + extrasPagas + recebimentosPendentesTotais;
  const totalSaidasProjetadas = despesasPagas + retiradasPagas + contasAPagarPendentes;
  const saldoProjetadoSobra = totalReceitasProjetadas - totalSaidasProjetadas;

  // ==========================================
  // RENDERIZAÇÃO
  // ==========================================
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.textoVoltar}>← Voltar pro Admin</Text>
        </TouchableOpacity>
        <Text style={styles.tituloHeader}>Gestão Financeira 💰</Text>
      </View>

      <View style={styles.menuAbas}>
        <TouchableOpacity style={[styles.aba, abaAtual === 'resumo' && styles.abaAtiva]} onPress={() => setAbaAtual('resumo')}>
          <Text style={[styles.textoAba, abaAtual === 'resumo' && styles.textoAbaAtiva]}>Resumo do Mês</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.aba, abaAtual === 'lancamentos' && styles.abaAtiva]} onPress={() => setAbaAtual('lancamentos')}>
          <Text style={[styles.textoAba, abaAtual === 'lancamentos' && styles.textoAbaAtiva]}>Lançamentos</Text>
        </TouchableOpacity>
      </View>

      {carregando ? (
        <ActivityIndicator size="large" color="#10b981" style={{ marginTop: 50 }} />
      ) : (
        <>
          {/* ================================================== */}
          {/* ABA 1: RESUMO (AGORA COM PREVISÃO E SALDO REAL)    */}
          {/* ================================================== */}
          {abaAtual === 'resumo' && (
            <ScrollView contentContainerStyle={{ padding: 20 }}>
              
              <View style={styles.cardResumoPrincipal}>
                <Text style={styles.labelResumo}>Saldo Real (Dinheiro em Caixa Hoje)</Text>
                <Text style={[styles.valorCaixa, { color: saldoRealAtual >= 0 ? '#10b981' : '#ef4444' }]}>
                  R$ {saldoRealAtual.toFixed(2)}
                </Text>
                <Text style={{color: '#94a3b8', fontSize: 12}}>Apenas transações concluídas (Pagas)</Text>
              </View>

              <View style={[styles.cardResumoPrincipal, { backgroundColor: '#1e293b', marginBottom: 25 }]}>
                <Text style={[styles.labelResumo, { color: '#38bdf8' }]}>Previsão de Sobra (Caixa Projetado)</Text>
                <Text style={[styles.valorCaixa, { color: '#fff' }]}>
                  R$ {saldoProjetadoSobra.toFixed(2)}
                </Text>
                <Text style={{color: '#cbd5e1', fontSize: 12, textAlign: 'center'}}>
                  O que sobrará se você quitar todas as contas e receber de todos os clientes.
                </Text>
              </View>

              <Text style={styles.tituloSecao}>O que falta acontecer no mês?</Text>
              
              {/* CORREÇÃO VISUAL AQUI */}
              <View style={styles.linhaResumo}>
                <Text style={styles.textoLinhaResumo}>Recebimentos Pendentes</Text>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.valorLinhaResumo, { color: '#f59e0b' }]}>+ R$ {recebimentosPendentesTotais.toFixed(2)}</Text>
                  <Text style={{ fontSize: 11, color: '#64748b' }}>Clientes e Extras a receber</Text>
                </View>
              </View>

              <View style={styles.linhaResumo}>
                <Text style={styles.textoLinhaResumo}>Contas a Pagar (Pendentes)</Text>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.valorLinhaResumo, { color: '#ef4444' }]}>- R$ {contasAPagarPendentes.toFixed(2)}</Text>
                  <Text style={{ fontSize: 11, color: '#64748b' }}>Despesas aguardando pagamento</Text>
                </View>
              </View>

              <View style={styles.divisoria} />

              <Text style={styles.tituloSecao}>Histórico Realizado (Já Pago)</Text>
              <View style={styles.linhaMini}>
                <Text style={styles.textoMini}>Entradas de Clientes e Extras</Text>
                <Text style={styles.valorMiniVerde}>+ R$ {(mensalidadesPagas + extrasPagas).toFixed(2)}</Text>
              </View>
              <View style={styles.linhaMini}>
                <Text style={styles.textoMini}>Despesas Operacionais Pagas</Text>
                <Text style={styles.valorMiniVermelho}>- R$ {despesasPagas.toFixed(2)}</Text>
              </View>
              <View style={styles.linhaMini}>
                <Text style={styles.textoMini}>Retiradas (Pró-Labore) Pagas</Text>
                <Text style={styles.valorMiniAmarelo}>- R$ {retiradasPagas.toFixed(2)}</Text>
              </View>

            </ScrollView>
          )}

          {/* ================================================== */}
          {/* ABA 2: LANÇAMENTOS E RECORRÊNCIA                   */}
          {/* ================================================== */}
          {abaAtual === 'lancamentos' && (
            <View style={{ flex: 1 }}>
              <View style={styles.cardFormulario}>
                <Text style={styles.tituloFormulario}>Novo Registro</Text>
                
                <View style={styles.containerBotoesTipo}>
                  <TouchableOpacity style={[styles.btnTipo, formTipo === 'Mensalidade' && { backgroundColor: '#eff6ff', borderColor: '#3b82f6' }]} onPress={() => setFormTipo('Mensalidade')}><Text style={[styles.textoBtnTipo, formTipo === 'Mensalidade' && { color: '#2563eb' }]}>🔵 Cliente</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.btnTipo, formTipo === 'Entrada Extra' && { backgroundColor: '#d1fae5', borderColor: '#10b981' }]} onPress={() => setFormTipo('Entrada Extra')}><Text style={[styles.textoBtnTipo, formTipo === 'Entrada Extra' && { color: '#059669' }]}>🟢 Extra</Text></TouchableOpacity>
                </View>

                <View style={styles.containerBotoesTipo}>
                  <TouchableOpacity style={[styles.btnTipo, formTipo === 'Despesa' && { backgroundColor: '#fee2e2', borderColor: '#ef4444' }]} onPress={() => setFormTipo('Despesa')}><Text style={[styles.textoBtnTipo, formTipo === 'Despesa' && { color: '#ef4444' }]}>🔴 Despesa</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.btnTipo, formTipo === 'Retirada' && { backgroundColor: '#fef3c7', borderColor: '#f59e0b' }]} onPress={() => setFormTipo('Retirada')}><Text style={[styles.textoBtnTipo, formTipo === 'Retirada' && { color: '#d97706' }]}>🟡 Retirada</Text></TouchableOpacity>
                </View>

                <TextInput style={styles.input} placeholder="Descrição" value={formDescricao} onChangeText={setFormDescricao} />
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TextInput style={[styles.input, { flex: 1 }]} placeholder="Valor (R$)" keyboardType="numeric" value={formValor} onChangeText={setFormValor} />
                  <TextInput style={[styles.input, { flex: 1 }]} placeholder="Data (DD/MM)" value={formData} onChangeText={setFormData} />
                </View>

                <TouchableOpacity style={[styles.btnRecorrente, formRecorrente && styles.btnRecorrenteAtivo]} onPress={() => setFormRecorrente(!formRecorrente)}>
                  <Text style={[styles.textoRecorrente, formRecorrente && styles.textoRecorrenteAtivo]}>{formRecorrente ? '🔄 Sim, é Recorrente (Fixo)' : '⚪ Não, é Avulso (Único)'}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.botaoSalvarLancamento} onPress={salvarLancamento} disabled={salvando}>
                  <Text style={styles.textoBotaoBranco}>{salvando ? 'Salvando...' : 'Adicionar como PENDENTE'}</Text>
                </TouchableOpacity>
              </View>

              <FlatList
                data={movimentacoes}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={{ padding: 20 }}
                renderItem={({ item }) => (
                  <View style={styles.cardLancamento}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.textoDescricaoLancamento}>
                        {item.descricao} {item.recorrente && <Text style={{fontSize: 12}}>🔄</Text>}
                      </Text>
                      <Text style={styles.textoDataLancamento}>Data: {item.data_movimento} • 
                        <Text style={{fontWeight: 'bold', color: item.tipo === 'Retirada' ? '#d97706' : item.tipo === 'Despesa' ? '#ef4444' : item.tipo === 'Mensalidade' ? '#2563eb' : '#059669'}}> {item.tipo}</Text>
                      </Text>
                      
                      <TouchableOpacity onPress={() => alternarStatus(item.id, item.status)} style={[{ marginTop: 8, padding: 5, borderRadius: 5, alignSelf: 'flex-start', borderWidth: 1 }, item.status === 'Pago' ? { backgroundColor: '#d1fae5', borderColor: '#10b981' } : { backgroundColor: '#fef3c7', borderColor: '#f59e0b' }]}>
                        <Text style={{ fontSize: 12, fontWeight: 'bold', color: item.status === 'Pago' ? '#059669' : '#d97706' }}>
                          Status: {item.status} (Mudar)
                        </Text>
                      </TouchableOpacity>
                    </View>
                    
                    <View style={{ alignItems: 'flex-end', justifyContent: 'space-between' }}>
                      <Text style={[styles.textoValorLancamento, { color: (item.tipo === 'Entrada Extra' || item.tipo === 'Mensalidade') ? '#10b981' : '#0f172a' }]}>
                        {(item.tipo === 'Entrada Extra' || item.tipo === 'Mensalidade') ? '+' : '-'} R$ {item.valor.toFixed(2)}
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 15, marginTop: 10 }}>
                        <TouchableOpacity onPress={() => gerarComprovantePDF(item)}><Text style={{ color: '#0052cc', fontSize: 12, fontWeight: 'bold' }}>📄 Recibo</Text></TouchableOpacity>
                        <TouchableOpacity onPress={() => excluirMovimentacao(item.id)}><Text style={{ color: '#ef4444', fontSize: 12, fontWeight: 'bold' }}>Excluir</Text></TouchableOpacity>
                      </View>
                    </View>
                  </View>
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
  header: { padding: 20, paddingTop: 40, backgroundColor: '#fff' },
  textoVoltar: { color: '#0052cc', fontWeight: 'bold', marginBottom: 10 },
  tituloHeader: { fontSize: 24, fontWeight: '900', color: '#0f172a' },
  menuAbas: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#e2e8f0' },
  aba: { flex: 1, paddingVertical: 15, alignItems: 'center' },
  abaAtiva: { borderBottomWidth: 3, borderColor: '#0052cc' },
  textoAba: { color: '#64748b', fontWeight: '600', fontSize: 14 },
  textoAbaAtiva: { color: '#0052cc', fontWeight: 'bold', fontSize: 14 },

  cardResumoPrincipal: { backgroundColor: '#0f172a', padding: 25, borderRadius: 16, elevation: 4, marginBottom: 10, alignItems: 'center' },
  labelResumo: { color: '#94a3b8', fontSize: 14, fontWeight: '600' },
  valorCaixa: { fontSize: 38, fontWeight: '900', marginVertical: 5 },
  
  tituloSecao: { fontSize: 16, fontWeight: 'bold', color: '#0f172a', marginBottom: 10, marginTop: 10 },
  linhaResumo: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#fff', padding: 15, borderRadius: 10, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' },
  textoLinhaResumo: { fontSize: 15, color: '#475569', fontWeight: '600' },
  valorLinhaResumo: { fontSize: 16, fontWeight: '900' },
  
  linhaMini: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  textoMini: { fontSize: 13, color: '#64748b', fontWeight: '500' },
  valorMiniVerde: { fontSize: 13, color: '#10b981', fontWeight: 'bold' },
  valorMiniVermelho: { fontSize: 13, color: '#ef4444', fontWeight: 'bold' },
  valorMiniAmarelo: { fontSize: 13, color: '#f59e0b', fontWeight: 'bold' },
  
  divisoria: { height: 1, backgroundColor: '#cbd5e1', marginVertical: 15 },

  cardFormulario: { backgroundColor: '#fff', padding: 20, borderBottomWidth: 1, borderColor: '#e2e8f0', elevation: 2 },
  tituloFormulario: { fontSize: 16, fontWeight: 'bold', color: '#0f172a', marginBottom: 15 },
  containerBotoesTipo: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  btnTipo: { flex: 1, paddingVertical: 12, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, alignItems: 'center' },
  textoBtnTipo: { fontSize: 13, fontWeight: 'bold', color: '#64748b' },
  input: { backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 12, fontSize: 14, marginBottom: 10 },
  btnRecorrente: { backgroundColor: '#f1f5f9', padding: 12, borderRadius: 8, alignItems: 'center', marginBottom: 10, borderWidth: 1, borderColor: '#cbd5e1' },
  btnRecorrenteAtivo: { backgroundColor: '#eff6ff', borderColor: '#3b82f6' },
  textoRecorrente: { color: '#64748b', fontWeight: '600', fontSize: 13 },
  textoRecorrenteAtivo: { color: '#2563eb', fontWeight: 'bold', fontSize: 13 },
  botaoSalvarLancamento: { backgroundColor: '#0f172a', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 5 },
  textoBotaoBranco: { color: '#fff', fontWeight: 'bold', fontSize: 15 },

  cardLancamento: { flexDirection: 'row', backgroundColor: '#fff', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 10 },
  textoDescricaoLancamento: { fontSize: 15, fontWeight: 'bold', color: '#1e293b', marginBottom: 3 },
  textoDataLancamento: { fontSize: 12, color: '#64748b' },
  textoValorLancamento: { fontSize: 16, fontWeight: '900' }
});