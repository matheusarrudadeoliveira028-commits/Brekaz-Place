import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, Alert, ScrollView, Modal } from 'react-native';
import { supabase } from '../../supabase';

type DespesaPessoal = {
  id: number;
  descricao: string;
  valor: number;
  tipo: 'Gasto' | 'Entrada';
  data_movimento: string;
  parcela_atual: number;
  total_parcelas: number;
  status: string;
};

type Cofrinho = {
  id: number;
  nome: string;
  meta_valor: number;
  valor_guardado: number;
};

export default function PessoalScreen({ navigation }: any) {
  const [abaAtual, setAbaAtual] = useState<'resumo' | 'gastos' | 'cofrinhos'>('resumo');
  
  // Dados
  const [despesas, setDespesas] = useState<DespesaPessoal[]>([]);
  const [cofrinhos, setCofrinhos] = useState<Cofrinho[]>([]);
  const [filtroStatus, setFiltroStatus] = useState<'Todos' | 'Pago' | 'Pendente'>('Todos');

  // Resumo Pessoal
  const [saldoReal, setSaldoReal] = useState(0);
  const [saldoProjetado, setSaldoProjetado] = useState(0);
  const [entradasPagas, setEntradasPagas] = useState(0);
  const [gastosPagos, setGastosPagos] = useState(0);
  const [entradasPendentes, setEntradasPendentes] = useState(0);
  const [gastosPendentes, setGastosPendentes] = useState(0);

  // Form Gastos
  const [descGasto, setDescGasto] = useState('');
  const [valorGasto, setValorGasto] = useState('');
  const [tipoGasto, setTipoGasto] = useState<'Gasto' | 'Entrada'>('Gasto');
  const [dataGasto, setDataGasto] = useState('');
  const [parcelaAtual, setParcelaAtual] = useState('1');
  const [totalParcelas, setTotalParcelas] = useState('1');
  const [statusLancamento, setStatusLancamento] = useState<'Pago' | 'Pendente'>('Pago');

  // Form Cofrinhos
  const [nomeCofre, setNomeCofre] = useState('');
  const [metaCofre, setMetaCofre] = useState('');
  
  // MODAL PARA O ANDROID (Guardar Dinheiro)
  const [modalCofreVisivel, setModalCofreVisivel] = useState(false);
  const [cofreSelecionado, setCofreSelecionado] = useState<Cofrinho | null>(null);
  const [valorAdicionarCofre, setValorAdicionarCofre] = useState('');

  useEffect(() => {
    carregarDados();
  }, []);

  async function carregarDados() {
    const [reqDespesas, reqCofres] = await Promise.all([
      supabase.from('despesas_pessoais').select('*').order('id', { ascending: false }),
      supabase.from('cofrinhos').select('*').order('id', { ascending: false })
    ]);

    if (reqDespesas.data) {
      setDespesas(reqDespesas.data);
      let entPagas = 0; let gasPagas = 0;
      let entPendentes = 0; let gasPendentes = 0;

      reqDespesas.data.forEach(item => {
        const valorItem = Number(item.valor);
        if (item.status === 'Pago') {
          if (item.tipo === 'Entrada') entPagas += valorItem;
          else gasPagas += valorItem;
        } else {
          if (item.tipo === 'Entrada') entPendentes += valorItem;
          else gasPendentes += valorItem;
        }
      });

      const caixaReal = entPagas - gasPagas;
      const caixaFuturo = caixaReal + entPendentes - gasPendentes;

      setEntradasPagas(entPagas);
      setGastosPagos(gasPagas);
      setEntradasPendentes(entPendentes);
      setGastosPendentes(gasPendentes);
      setSaldoReal(caixaReal);
      setSaldoProjetado(caixaFuturo);
    }
    
    if (reqCofres.data) setCofrinhos(reqCofres.data);
  }

  async function salvarGasto() {
    if (!descGasto || !valorGasto || !dataGasto) return Alert.alert('Erro', 'Preencha a descrição, valor e data.');
    const valorNum = parseFloat(valorGasto.replace(',', '.')) || 0;
    
    const { error } = await supabase.from('despesas_pessoais').insert({
      descricao: descGasto, 
      valor: valorNum, 
      tipo: tipoGasto, 
      data_movimento: dataGasto,
      parcela_atual: parseInt(parcelaAtual) || 1, 
      total_parcelas: parseInt(totalParcelas) || 1,
      status: statusLancamento
    });

    if (error) {
      console.log("Erro ao salvar:", error);
      Alert.alert('Erro no Banco', 'Falha ao salvar. Verifique se criou a coluna "status" no Supabase.');
    } else {
      Alert.alert('Sucesso', 'Registrado no seu bolso!');
      setDescGasto(''); setValorGasto(''); setDataGasto(''); setParcelaAtual('1'); setTotalParcelas('1'); setStatusLancamento('Pago');
      carregarDados();
    }
  }

  async function alternarStatus(id: number, statusAtual: string) {
    const novoStatus = statusAtual === 'Pendente' ? 'Pago' : 'Pendente';
    await supabase.from('despesas_pessoais').update({ status: novoStatus }).eq('id', id);
    carregarDados();
  }

  async function avancarParcela(despesa: DespesaPessoal) {
    if (despesa.parcela_atual >= despesa.total_parcelas) return Alert.alert('Aviso', 'Conta já totalmente paga!');
    await supabase.from('despesas_pessoais').update({ parcela_atual: despesa.parcela_atual + 1, status: 'Pendente' }).eq('id', despesa.id);
    carregarDados();
  }

  async function excluirGasto(id: number) {
    Alert.alert('Apagar', 'Excluir este registro?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: async () => { await supabase.from('despesas_pessoais').delete().eq('id', id); carregarDados(); }}
    ]);
  }

  async function criarCofrinho() {
    if (!nomeCofre || !metaCofre) return Alert.alert('Erro', 'Preencha o nome e a meta.');
    const metaNum = parseFloat(metaCofre.replace(',', '.')) || 0;
    await supabase.from('cofrinhos').insert({ nome: nomeCofre, meta_valor: metaNum, valor_guardado: 0 });
    setNomeCofre(''); setMetaCofre(''); carregarDados();
  }

  function abrirModalGuardarDinheiro(cofre: Cofrinho) {
    setCofreSelecionado(cofre);
    setValorAdicionarCofre('');
    setModalCofreVisivel(true);
  }

  async function confirmarGuardarDinheiro() {
    if (!cofreSelecionado || !valorAdicionarCofre) return;
    const valorAAdicionar = parseFloat(valorAdicionarCofre.replace(',', '.')) || 0;
    
    if (valorAAdicionar > 0) {
      await supabase.from('cofrinhos')
        .update({ valor_guardado: cofreSelecionado.valor_guardado + valorAAdicionar })
        .eq('id', cofreSelecionado.id);
      carregarDados();
    }
    setModalCofreVisivel(false);
  }

  async function quebrarCofrinho(id: number) {
    Alert.alert('Quebrar Cofrinho', 'Tem certeza que deseja apagar esta meta?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Quebrar', style: 'destructive', onPress: async () => { await supabase.from('cofrinhos').delete().eq('id', id); carregarDados(); } }
    ]);
  }

  const despesasFiltradas = despesas.filter(d => filtroStatus === 'Todos' || d.status === filtroStatus);

  return (
    <View style={styles.container}>
      <View style={styles.headerPersonalizado}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.textoVoltar}>← Voltar Admin</Text></TouchableOpacity>
        <Text style={{fontSize: 20, fontWeight: '900', color: '#0f172a'}}>Meu Bolso 👤</Text>
      </View>

      <View style={styles.menuAbas}>
        <TouchableOpacity style={[styles.aba, abaAtual === 'resumo' && styles.abaAtiva]} onPress={() => setAbaAtual('resumo')}><Text style={[styles.textoAba, abaAtual === 'resumo' && styles.textoAbaAtiva]}>Resumo Pessoal</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.aba, abaAtual === 'gastos' && styles.abaAtiva]} onPress={() => setAbaAtual('gastos')}><Text style={[styles.textoAba, abaAtual === 'gastos' && styles.textoAbaAtiva]}>Lançamentos</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.aba, abaAtual === 'cofrinhos' && styles.abaAtiva]} onPress={() => setAbaAtual('cofrinhos')}><Text style={[styles.textoAba, abaAtual === 'cofrinhos' && styles.textoAbaAtiva]}>Cofrinhos</Text></TouchableOpacity>
      </View>

      {abaAtual === 'resumo' && (
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <View style={styles.cardResumoPrincipal}>
            <Text style={styles.labelResumo}>Seu Dinheiro Real (Hoje)</Text>
            <Text style={[styles.valorCaixa, { color: saldoReal >= 0 ? '#10b981' : '#ef4444' }]}>R$ {saldoReal.toFixed(2)}</Text>
            <Text style={{color: '#94a3b8', fontSize: 12}}>Dinheiro livre no seu banco agora</Text>
          </View>
          <View style={[styles.cardResumoPrincipal, { backgroundColor: '#1e293b', marginBottom: 25 }]}>
            <Text style={[styles.labelResumo, { color: '#60a5fa' }]}>Previsão (Vai Sobrar)</Text>
            <Text style={[styles.valorCaixa, { color: '#fff' }]}>R$ {saldoProjetado.toFixed(2)}</Text>
            <Text style={{color: '#cbd5e1', fontSize: 12, textAlign: 'center'}}>Saldo após pagar todos os cartões e despesas pendentes.</Text>
          </View>

          <Text style={styles.tituloSecao}>Análise Pessoal</Text>
          <View style={styles.linhaResumo}>
            <View><Text style={styles.textoLinhaResumo}>Receitas (Salários/Lucros)</Text><Text style={{fontSize: 11, color: '#64748b'}}>A Receber (Previsão): R$ {entradasPendentes.toFixed(2)}</Text></View>
            <Text style={[styles.valorLinhaResumo, { color: '#10b981' }]}>Real: + R$ {entradasPagas.toFixed(2)}</Text>
          </View>
          <View style={styles.linhaResumo}>
            <View><Text style={styles.textoLinhaResumo}>Despesas de Casa (Cartões)</Text><Text style={{fontSize: 11, color: '#64748b'}}>A Pagar (Faturas): R$ {gastosPendentes.toFixed(2)}</Text></View>
            <Text style={[styles.valorLinhaResumo, { color: '#ef4444' }]}>Real: - R$ {gastosPagos.toFixed(2)}</Text>
          </View>

          <Text style={[styles.tituloSecao, { marginTop: 15 }]}>Metas em Andamento 🎯</Text>
          {cofrinhos.length === 0 ? (
            <Text style={{ color: '#64748b' }}>Nenhum cofrinho criado.</Text>
          ) : (
            cofrinhos.map(cofre => (
              <View key={cofre.id} style={styles.linhaResumo}>
                <Text style={styles.textoLinhaResumo}>🐷 {cofre.nome}</Text>
                <Text style={styles.valorLinhaResumo}>R$ {cofre.valor_guardado.toFixed(2)}</Text>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {abaAtual === 'gastos' && (
        <View style={{ flex: 1 }}>
          <View style={styles.cardFormulario}>
            <TextInput style={styles.input} placeholder="Descrição (Ex: Celular Novo)" value={descGasto} onChangeText={setDescGasto} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TextInput style={[styles.input, { flex: 1 }]} placeholder="Valor da Parcela" keyboardType="numeric" value={valorGasto} onChangeText={setValorGasto} />
              <TextInput style={[styles.input, { flex: 1 }]} placeholder="Data (Ex: 10/09)" value={dataGasto} onChangeText={setDataGasto} />
            </View>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
              <View style={{ flex: 1 }}><Text style={styles.label}>Parcela Atual</Text><TextInput style={styles.input} keyboardType="numeric" value={parcelaAtual} onChangeText={setParcelaAtual} /></View>
              <View style={{ flex: 1 }}><Text style={styles.label}>Total Parcelas</Text><TextInput style={styles.input} keyboardType="numeric" value={totalParcelas} onChangeText={setTotalParcelas} /></View>
            </View>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
              <TouchableOpacity style={[styles.chipTipo, tipoGasto === 'Entrada' && styles.chipEntrada]} onPress={() => setTipoGasto('Entrada')}><Text style={[styles.textoChip, tipoGasto === 'Entrada' && {color: '#fff'}]}>Recebimento</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.chipTipo, tipoGasto === 'Gasto' && styles.chipSaida]} onPress={() => setTipoGasto('Gasto')}><Text style={[styles.textoChip, tipoGasto === 'Gasto' && {color: '#fff'}]}>Gasto/Compra</Text></TouchableOpacity>
            </View>
            <TouchableOpacity style={[styles.btnStatus, statusLancamento === 'Pendente' && styles.btnStatusPendente]} onPress={() => setStatusLancamento(statusLancamento === 'Pago' ? 'Pendente' : 'Pago')}>
              <Text style={[styles.textoStatus, statusLancamento === 'Pendente' && styles.textoStatusPendente]}>
                {statusLancamento === 'Pago' ? '✅ Situação: Já paguei/recebi' : '⏳ Situação: Lançar como Previsão'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.botaoAcao} onPress={salvarGasto}><Text style={styles.textoBotaoBranco}>Adicionar ao Bolso</Text></TouchableOpacity>
          </View>
          
          <View style={styles.barraFiltros}>
            <TouchableOpacity style={[styles.filtroBtn, filtroStatus === 'Todos' && styles.filtroBtnAtivo]} onPress={() => setFiltroStatus('Todos')}><Text style={[styles.textoFiltro, filtroStatus === 'Todos' && styles.textoFiltroAtivo]}>Tudo</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.filtroBtn, filtroStatus === 'Pago' && styles.filtroBtnAtivo]} onPress={() => setFiltroStatus('Pago')}><Text style={[styles.textoFiltro, filtroStatus === 'Pago' && styles.textoFiltroAtivo]}>✅ Pagos (Real)</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.filtroBtn, filtroStatus === 'Pendente' && styles.filtroBtnAtivo]} onPress={() => setFiltroStatus('Pendente')}><Text style={[styles.textoFiltro, filtroStatus === 'Pendente' && styles.textoFiltroAtivo]}>⏳ Previsões</Text></TouchableOpacity>
          </View>

          <FlatList data={despesasFiltradas} keyExtractor={(item) => item.id.toString()} contentContainerStyle={{ padding: 20, paddingTop: 0 }} renderItem={({ item }) => (
            <View style={[styles.cardLancamento, item.status === 'Pendente' && { borderLeftWidth: 4, borderLeftColor: '#f59e0b' }]}>
              <View style={{ flex: 1 }}>
                <Text style={{fontWeight: 'bold', fontSize: 16, color: '#0f172a'}}>{item.descricao}</Text>
                <Text style={{color: '#64748b', fontSize: 12, marginBottom: 5}}>{item.data_movimento} | {item.tipo}</Text>
                
                <TouchableOpacity onPress={() => alternarStatus(item.id, item.status)} style={[{ padding: 4, borderRadius: 5, alignSelf: 'flex-start', borderWidth: 1, marginBottom: 5 }, item.status === 'Pago' ? { backgroundColor: '#d1fae5', borderColor: '#10b981' } : { backgroundColor: '#fef3c7', borderColor: '#f59e0b' }]}>
                  <Text style={{ fontSize: 11, fontWeight: 'bold', color: item.status === 'Pago' ? '#059669' : '#d97706' }}>
                    {item.status === 'Pago' ? '✅ PAGO (Mudar)' : '⏳ PENDENTE (Pagar)'}
                  </Text>
                </TouchableOpacity>

                {item.total_parcelas > 1 && (
                  <View style={styles.badgeParcela}>
                    <Text style={styles.textoBadgeParcela}>Parcela {item.parcela_atual} de {item.total_parcelas}</Text>
                  </View>
                )}
                {item.total_parcelas > 1 && item.parcela_atual < item.total_parcelas && (
                  <TouchableOpacity onPress={() => avancarParcela(item)} style={{ marginTop: 5 }}>
                    <Text style={{ color: '#0052cc', fontWeight: 'bold', fontSize: 12 }}>+ Avançar Mês (Ir p/ Parcela {item.parcela_atual + 1})</Text>
                  </TouchableOpacity>
                )}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{fontWeight: '900', fontSize: 16, color: item.tipo === 'Entrada' ? '#10b981' : '#ef4444'}}>
                  {item.tipo === 'Entrada' ? '+' : '-'} R$ {item.valor.toFixed(2)}
                </Text>
                <TouchableOpacity onPress={() => excluirGasto(item.id)} style={{marginTop: 10}}><Text style={{ color: '#ef4444', fontSize: 12, fontWeight: 'bold' }}>Excluir</Text></TouchableOpacity>
              </View>
            </View>
          )}/>
        </View>
      )}

      {abaAtual === 'cofrinhos' && (
        <View style={{ flex: 1 }}>
          <View style={styles.cardFormulario}>
            <Text style={styles.tituloSecao}>Criar Nova Meta</Text>
            <TextInput style={styles.input} placeholder="Nome (Ex: Viagem Europa)" value={nomeCofre} onChangeText={setNomeCofre} />
            <TextInput style={styles.input} placeholder="Qual o Valor Alvo? (Ex: 5000)" keyboardType="numeric" value={metaCofre} onChangeText={setMetaCofre} />
            <TouchableOpacity style={[styles.botaoAcao, {backgroundColor: '#3b82f6'}]} onPress={criarCofrinho}><Text style={styles.textoBotaoBranco}>Criar Cofrinho</Text></TouchableOpacity>
          </View>

          <FlatList data={cofrinhos} keyExtractor={(item) => item.id.toString()} contentContainerStyle={{ padding: 20 }} renderItem={({ item }) => {
            const progresso = item.meta_valor > 0 ? (item.valor_guardado / item.meta_valor) * 100 : 0;
            const porcentagem = Math.min(progresso, 100).toFixed(0);

            return (
              <View style={styles.cardCofrinho}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                  <Text style={{fontWeight: 'bold', fontSize: 18, color: '#0f172a'}}>🐷 {item.nome}</Text>
                  <TouchableOpacity onPress={() => quebrarCofrinho(item.id)}><Text style={{ color: '#ef4444', fontWeight: 'bold' }}>Quebrar</Text></TouchableOpacity>
                </View>
                
                <Text style={{color: '#64748b', fontSize: 14, marginBottom: 5}}>
                  Guardado: <Text style={{fontWeight: 'bold', color: '#10b981'}}>R$ {item.valor_guardado.toFixed(2)}</Text> / R$ {item.meta_valor.toFixed(2)}
                </Text>

                <View style={styles.barraFundoCofre}>
                  <View style={[styles.barraPreenchimentoCofre, { width: `${porcentagem}%` }]} />
                </View>
                <Text style={{ textAlign: 'right', fontSize: 12, color: '#3b82f6', fontWeight: 'bold', marginTop: 5 }}>{porcentagem}% Concluído</Text>

                <TouchableOpacity style={styles.botaoGuardarCofre} onPress={() => abrirModalGuardarDinheiro(item)}>
                  <Text style={{ color: '#fff', fontWeight: 'bold' }}>+ Guardar Dinheiro no Cofre</Text>
                </TouchableOpacity>
              </View>
            );
          }}/>
        </View>
      )}

      {/* MODAL NATIVO PARA DIGITAR O VALOR DO COFRINHO */}
      <Modal visible={modalCofreVisivel} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.tituloSecao}>Guardar Dinheiro</Text>
            <Text style={styles.label}>Quanto você quer guardar em "{cofreSelecionado?.nome}"?</Text>
            <TextInput 
              style={styles.input} 
              keyboardType="numeric" 
              placeholder="Ex: 150,00" 
              value={valorAdicionarCofre} 
              onChangeText={setValorAdicionarCofre} 
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <TouchableOpacity style={[styles.botaoAcao, { flex: 1, backgroundColor: '#64748b' }]} onPress={() => setModalCofreVisivel(false)}>
                <Text style={styles.textoBotaoBranco}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.botaoAcao, { flex: 1, backgroundColor: '#10b981' }]} onPress={confirmarGuardarDinheiro}>
                <Text style={styles.textoBotaoBranco}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  headerPersonalizado: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 40, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#e2e8f0' },
  textoVoltar: { color: '#0052cc', fontWeight: 'bold' },
  menuAbas: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#e2e8f0' },
  aba: { flex: 1, paddingVertical: 15, alignItems: 'center' },
  abaAtiva: { borderBottomWidth: 3, borderColor: '#0052cc' },
  textoAba: { color: '#64748b', fontWeight: '600', fontSize: 13 },
  textoAbaAtiva: { color: '#0052cc', fontWeight: 'bold', fontSize: 13 },
  tituloSecao: { fontSize: 20, fontWeight: 'bold', color: '#0f172a', marginBottom: 10 },
  
  cardResumoPrincipal: { backgroundColor: '#0f172a', padding: 25, borderRadius: 16, marginBottom: 15, alignItems: 'center' },
  labelResumo: { color: '#cbd5e1', fontSize: 14, fontWeight: '600' },
  valorCaixa: { fontSize: 38, fontWeight: '900', marginVertical: 5 },
  linhaResumo: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#fff', padding: 15, borderRadius: 10, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' },
  textoLinhaResumo: { fontSize: 15, color: '#475569', fontWeight: '600' },
  valorLinhaResumo: { fontSize: 16, fontWeight: '900', color: '#0f172a' },
  
  cardFormulario: { backgroundColor: '#fff', padding: 20, borderBottomWidth: 1, borderColor: '#e2e8f0' },
  input: { backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 12, fontSize: 15, marginBottom: 10 },
  label: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 5 },
  
  chipTipo: { flex: 1, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e1', alignItems: 'center' },
  textoChip: { fontSize: 12, fontWeight: 'bold', color: '#64748b' },
  chipEntrada: { backgroundColor: '#10b981', borderColor: '#10b981' },
  chipSaida: { backgroundColor: '#ef4444', borderColor: '#ef4444' },

  btnStatus: { backgroundColor: '#d1fae5', padding: 12, borderRadius: 8, alignItems: 'center', marginBottom: 15, borderWidth: 1, borderColor: '#10b981' },
  btnStatusPendente: { backgroundColor: '#fef3c7', borderColor: '#f59e0b' },
  textoStatus: { color: '#059669', fontWeight: 'bold', fontSize: 13 },
  textoStatusPendente: { color: '#d97706' },

  botaoAcao: { backgroundColor: '#0f172a', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  textoBotaoBranco: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  
  barraFiltros: { flexDirection: 'row', padding: 20, paddingBottom: 10, gap: 10 },
  filtroBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, backgroundColor: '#e2e8f0' },
  filtroBtnAtivo: { backgroundColor: '#0f172a' },
  textoFiltro: { fontSize: 13, color: '#475569', fontWeight: '600' },
  textoFiltroAtivo: { color: '#fff' },

  cardLancamento: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 10 },
  badgeParcela: { backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-start', marginTop: 5 },
  textoBadgeParcela: { color: '#475569', fontSize: 11, fontWeight: 'bold' },
  
  cardCofrinho: { backgroundColor: '#ffffff', borderRadius: 16, padding: 20, marginBottom: 15, borderWidth: 1, borderColor: '#e2e8f0', elevation: 2 },
  barraFundoCofre: { height: 10, backgroundColor: '#e2e8f0', borderRadius: 5, overflow: 'hidden', marginTop: 10 },
  barraPreenchimentoCofre: { height: '100%', backgroundColor: '#3b82f6' },
  botaoGuardarCofre: { backgroundColor: '#10b981', borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginTop: 15 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', padding: 20, borderRadius: 16 }
});