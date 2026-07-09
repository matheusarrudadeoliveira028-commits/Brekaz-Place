import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, Alert, ScrollView } from 'react-native';
import { supabase } from '../../supabase';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

type Movimentacao = {
  id: number;
  descricao: string;
  valor: number;
  tipo: 'Entrada' | 'Saida' | 'Retirada';
  data_movimento: string;
  status: string; // 'Pago' ou 'Pendente'
};

export default function FinanceiroScreen({ navigation }: any) {
  const [abaAtual, setAbaAtual] = useState<'resumo' | 'lancamentos' | 'cobranca'>('resumo');
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([]);
  
  const [filtroStatus, setFiltroStatus] = useState<'Todos' | 'Pago' | 'Pendente'>('Todos');
  
  const [saldoReal, setSaldoReal] = useState(0);
  const [saldoProjetado, setSaldoProjetado] = useState(0);
  const [entradasPagas, setEntradasPagas] = useState(0);
  const [saidasPagas, setSaidasPagas] = useState(0);
  const [entradasPendentes, setEntradasPendentes] = useState(0);
  const [saidasPendentes, setSaidasPendentes] = useState(0);

  const [desc, setDesc] = useState('');
  const [valor, setValor] = useState('');
  const [tipo, setTipo] = useState<'Entrada' | 'Saida' | 'Retirada'>('Entrada');
  const [dataMov, setDataMov] = useState('');
  const [statusLancamento, setStatusLancamento] = useState<'Pago' | 'Pendente'>('Pago');

  const [fatCliente, setFatCliente] = useState('');
  const [fatDescricao, setFatDescricao] = useState('Mensalidade do Sistema');
  const [fatPeriodo, setFatPeriodo] = useState('');
  const [fatValor, setFatValor] = useState('');
  const [fatPix, setFatPix] = useState('sua-chave-pix-aqui'); 

  const opcoesFaturamento = ['Mensalidade do Sistema', 'Desenvolvimento', 'Taxa de Implantação', 'Manutenção'];

  useEffect(() => {
    carregarMovimentacoes();
  }, []);

  async function carregarMovimentacoes() {
    const { data, error } = await supabase.from('movimentacoes_financeiras').select('*').order('id', { ascending: false });
    
    if (!error && data) {
      setMovimentacoes(data);
      
      let entPagas = 0; let saiPagas = 0;
      let entPendentes = 0; let saiPendentes = 0;

      data.forEach(item => {
        const valorItem = Number(item.valor);
        if (item.status === 'Pago') {
          if (item.tipo === 'Entrada') entPagas += valorItem;
          else saiPagas += valorItem;
        } else {
          if (item.tipo === 'Entrada') entPendentes += valorItem;
          else saiPendentes += valorItem;
        }
      });

      const caixaReal = entPagas - saiPagas;
      const caixaFuturo = caixaReal + entPendentes - saiPendentes;

      setEntradasPagas(entPagas);
      setSaidasPagas(saiPagas);
      setEntradasPendentes(entPendentes);
      setSaidasPendentes(saiPendentes);
      setSaldoReal(caixaReal);
      setSaldoProjetado(caixaFuturo);
    }
  }

  // ==========================================
  // MAGIA ERP: SINCRONIZAÇÃO ENTRE EMPRESA E BOLSO
  // ==========================================
  async function salvarLancamento() {
    if (!desc || !valor || !dataMov) return Alert.alert('Erro', 'Preencha a descrição, valor e data.');
    const valorNum = parseFloat(valor.replace(',', '.')) || 0;
    
    // 1. Salva o registro normal no Caixa da Empresa
    const { error } = await supabase.from('movimentacoes_financeiras').insert({ 
      descricao: desc, valor: valorNum, tipo, data_movimento: dataMov, status: statusLancamento 
    });
    
    if (!error) {
      
      // 2. O GRANDE TRUQUE: Se for Retirada, joga direto pro "Meu Bolso"
      if (tipo === 'Retirada') {
        await supabase.from('despesas_pessoais').insert({
          descricao: `💼 Retirada: ${desc}`, // Colocamos um ícone pra você saber que veio da empresa
          valor: valorNum, 
          tipo: 'Entrada', // É uma saída na empresa, mas é uma ENTRADA no seu bolso!
          data_movimento: dataMov,
          parcela_atual: 1, 
          total_parcelas: 1,
          status: statusLancamento // Se você lançou como previsão, entra como previsão lá também!
        });
      }

      Alert.alert('Sucesso', tipo === 'Retirada' ? 'Retirada salva e enviada automaticamente para o Meu Bolso!' : 'Lançamento registrado!');
      setDesc(''); setValor(''); setDataMov(''); setStatusLancamento('Pago');
      carregarMovimentacoes();
    } else {
      Alert.alert('Erro', 'Falha ao registrar.');
    }
  }

  async function alternarStatus(id: number, statusAtual: string) {
    const novoStatus = statusAtual === 'Pendente' ? 'Pago' : 'Pendente';
    await supabase.from('movimentacoes_financeiras').update({ status: novoStatus }).eq('id', id);
    carregarMovimentacoes();
  }

  async function excluirMovimentacao(id: number) {
    Alert.alert('Apagar', 'Excluir este registro?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: async () => { 
        await supabase.from('movimentacoes_financeiras').delete().eq('id', id); 
        carregarMovimentacoes(); 
      }}
    ]);
  }

  async function gerarFaturaPDF() {
    if (!fatCliente || !fatPeriodo || !fatValor || !fatPix) {
      return Alert.alert('Atenção', 'Preencha todos os dados da cobrança.');
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
          <meta charset="UTF-8">
          <style>
              body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 40px; color: #1e293b; background: #fff; }
              .header { border-bottom: 3px solid #0052cc; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-end; }
              .logo-text { font-size: 34px; font-weight: 900; color: #0052cc; letter-spacing: -1px; margin: 0; }
              .fatura-title { font-size: 22px; font-weight: 700; color: #64748b; margin: 0; text-transform: uppercase; }
              .box { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 30px; margin-bottom: 30px; }
              .row { display: flex; justify-content: space-between; margin-bottom: 15px; border-bottom: 1px dashed #cbd5e1; padding-bottom: 10px; }
              .row:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
              .label { font-size: 16px; color: #64748b; font-weight: 600; }
              .value { font-size: 18px; color: #0f172a; font-weight: 700; }
              .highlight { color: #0052cc; font-size: 28px; font-weight: 900; }
              .pix-box { background-color: #ecfdf5; border: 2px dashed #10b981; border-radius: 12px; padding: 30px; text-align: center; }
              .pix-title { font-size: 20px; color: #059669; font-weight: 800; margin-bottom: 15px; }
              .pix-key { font-size: 22px; color: #0f172a; font-weight: 900; background: #fff; padding: 15px; border-radius: 8px; border: 1px solid #a7f3d0; display: inline-block; letter-spacing: 1px; word-break: break-all; }
              .footer { text-align: center; margin-top: 60px; font-size: 13px; color: #94a3b8; font-weight: 500; }
          </style>
      </head>
      <body>
          <div class="header"><h1 class="logo-text">BREKAZ PLACE</h1><h2 class="fatura-title">Fatura de Serviço</h2></div>
          <div class="box">
              <div class="row"><span class="label">Faturado para:</span> <span class="value">${fatCliente}</span></div>
              <div class="row"><span class="label">Descrição do Serviço:</span> <span class="value">${fatDescricao}</span></div>
              <div class="row"><span class="label">Período de Referência:</span> <span class="value">${fatPeriodo}</span></div>
              <div class="row" style="margin-top: 25px; border-bottom: none;"><span class="label" style="font-size: 20px;">Valor Total:</span> <span class="highlight">R$ ${fatValor}</span></div>
          </div>
          <div class="pix-box">
              <div class="pix-title">Opção de Pagamento via PIX</div>
              <p style="color: #475569; font-size: 16px; margin-bottom: 15px;">Utilize a chave abaixo para realizar a transferência:</p>
              <div class="pix-key">${fatPix}</div>
          </div>
          <div class="footer">Documento gerado eletronicamente pelo Sistema de Gestão Brekaz Place.</div>
      </body>
      </html>
    `;

    try {
      const { uri } = await Print.printToFileAsync({ html: htmlContent, base64: false });
      await Sharing.shareAsync(uri, { dialogTitle: 'Enviar Fatura', mimeType: 'application/pdf', UTI: '.pdf' });
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível gerar o PDF da fatura.');
    }
  }

  const movimentacoesFiltradas = movimentacoes.filter(m => filtroStatus === 'Todos' || m.status === filtroStatus);

  return (
    <View style={styles.container}>
      <View style={styles.headerPersonalizado}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.textoVoltar}>← Voltar Admin</Text></TouchableOpacity>
        <Text style={{fontSize: 20, fontWeight: '900', color: '#0f172a'}}>Caixa Empresa 🏢</Text>
      </View>

      <View style={styles.menuAbas}>
        <TouchableOpacity style={[styles.aba, abaAtual === 'resumo' && styles.abaAtiva]} onPress={() => setAbaAtual('resumo')}><Text style={[styles.textoAba, abaAtual === 'resumo' && styles.textoAbaAtiva]}>Resumo</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.aba, abaAtual === 'lancamentos' && styles.abaAtiva]} onPress={() => setAbaAtual('lancamentos')}><Text style={[styles.textoAba, abaAtual === 'lancamentos' && styles.textoAbaAtiva]}>Lançamentos</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.aba, abaAtual === 'cobranca' && styles.abaAtiva]} onPress={() => setAbaAtual('cobranca')}><Text style={[styles.textoAba, abaAtual === 'cobranca' && styles.textoAbaAtiva]}>Faturas</Text></TouchableOpacity>
      </View>

      {abaAtual === 'resumo' && (
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <View style={styles.cardResumoPrincipal}>
            <Text style={styles.labelResumo}>Caixa Real (Hoje)</Text>
            <Text style={[styles.valorCaixa, { color: saldoReal >= 0 ? '#3b82f6' : '#ef4444' }]}>R$ {saldoReal.toFixed(2)}</Text>
            <Text style={{color: '#94a3b8', fontSize: 12}}>Apenas valores marcados como "Pagos"</Text>
          </View>
          <View style={[styles.cardResumoPrincipal, { backgroundColor: '#1e293b', marginBottom: 25 }]}>
            <Text style={[styles.labelResumo, { color: '#60a5fa' }]}>Previsão Futura (Projetado)</Text>
            <Text style={[styles.valorCaixa, { color: '#fff' }]}>R$ {saldoProjetado.toFixed(2)}</Text>
            <Text style={{color: '#cbd5e1', fontSize: 12, textAlign: 'center'}}>Saldo da empresa se todas as contas a pagar e receber pendentes se confirmarem.</Text>
          </View>

          <Text style={styles.tituloSecao}>Análise de Caixa</Text>
          <View style={styles.linhaResumo}>
            <View><Text style={styles.textoLinhaResumo}>Entradas (Faturamento)</Text><Text style={{fontSize: 11, color: '#64748b'}}>A Receber (Previsão): R$ {entradasPendentes.toFixed(2)}</Text></View>
            <Text style={[styles.valorLinhaResumo, { color: '#10b981' }]}>Real: + R$ {entradasPagas.toFixed(2)}</Text>
          </View>
          <View style={styles.linhaResumo}>
            <View><Text style={styles.textoLinhaResumo}>Saídas (Custos/Retiradas)</Text><Text style={{fontSize: 11, color: '#64748b'}}>A Pagar (Previsão): R$ {saidasPendentes.toFixed(2)}</Text></View>
            <Text style={[styles.valorLinhaResumo, { color: '#ef4444' }]}>Real: - R$ {saidasPagas.toFixed(2)}</Text>
          </View>
        </ScrollView>
      )}

      {abaAtual === 'lancamentos' && (
        <View style={{ flex: 1 }}>
          <View style={styles.cardFormulario}>
            <TextInput style={styles.input} placeholder="Descrição (Ex: Pgto Servidor, Pró Labore)" value={desc} onChangeText={setDesc} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TextInput style={[styles.input, { flex: 1 }]} placeholder="Valor (R$)" keyboardType="numeric" value={valor} onChangeText={setValor} />
              <TextInput style={[styles.input, { flex: 1 }]} placeholder="Data Venc/Pgto" value={dataMov} onChangeText={setDataMov} />
            </View>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
              <TouchableOpacity style={[styles.chipTipo, tipo === 'Entrada' && styles.chipEntrada]} onPress={() => setTipo('Entrada')}><Text style={[styles.textoChip, tipo === 'Entrada' && {color: '#fff'}]}>Faturamento</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.chipTipo, tipo === 'Saida' && styles.chipSaida]} onPress={() => setTipo('Saida')}><Text style={[styles.textoChip, tipo === 'Saida' && {color: '#fff'}]}>Custo/Despesa</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.chipTipo, tipo === 'Retirada' && styles.chipRetirada]} onPress={() => setTipo('Retirada')}><Text style={[styles.textoChip, tipo === 'Retirada' && {color: '#fff'}]}>Retirada Sócio</Text></TouchableOpacity>
            </View>
            <TouchableOpacity style={[styles.btnStatus, statusLancamento === 'Pendente' && styles.btnStatusPendente]} onPress={() => setStatusLancamento(statusLancamento === 'Pago' ? 'Pendente' : 'Pago')}>
              <Text style={[styles.textoStatus, statusLancamento === 'Pendente' && styles.textoStatusPendente]}>{statusLancamento === 'Pago' ? '✅ Status Inicial: Já está Pago' : '⏳ Status Inicial: Previsão (Pendente)'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.botaoAcao} onPress={salvarLancamento}><Text style={styles.textoBotaoBranco}>Adicionar ao Caixa</Text></TouchableOpacity>
          </View>
          
          <View style={styles.barraFiltros}>
            <TouchableOpacity style={[styles.filtroBtn, filtroStatus === 'Todos' && styles.filtroBtnAtivo]} onPress={() => setFiltroStatus('Todos')}><Text style={[styles.textoFiltro, filtroStatus === 'Todos' && styles.textoFiltroAtivo]}>Tudo</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.filtroBtn, filtroStatus === 'Pago' && styles.filtroBtnAtivo]} onPress={() => setFiltroStatus('Pago')}><Text style={[styles.textoFiltro, filtroStatus === 'Pago' && styles.textoFiltroAtivo]}>✅ Pagos (Real)</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.filtroBtn, filtroStatus === 'Pendente' && styles.filtroBtnAtivo]} onPress={() => setFiltroStatus('Pendente')}><Text style={[styles.textoFiltro, filtroStatus === 'Pendente' && styles.textoFiltroAtivo]}>⏳ Previsões</Text></TouchableOpacity>
          </View>

          <FlatList data={movimentacoesFiltradas} keyExtractor={(item) => item.id.toString()} contentContainerStyle={{ padding: 20, paddingTop: 0 }} renderItem={({ item }) => (
            <View style={[styles.cardLancamento, item.status === 'Pendente' && { borderLeftWidth: 4, borderLeftColor: '#f59e0b' }]}>
              <View style={{ flex: 1 }}>
                <Text style={{fontWeight: 'bold', fontSize: 16, color: '#0f172a'}}>{item.descricao}</Text>
                <Text style={{color: '#64748b', fontSize: 12, marginBottom: 5}}>{item.data_movimento} | {item.tipo}</Text>
                <TouchableOpacity onPress={() => alternarStatus(item.id, item.status)} style={[{ padding: 4, borderRadius: 5, alignSelf: 'flex-start', borderWidth: 1 }, item.status === 'Pago' ? { backgroundColor: '#d1fae5', borderColor: '#10b981' } : { backgroundColor: '#fef3c7', borderColor: '#f59e0b' }]}>
                  <Text style={{ fontSize: 11, fontWeight: 'bold', color: item.status === 'Pago' ? '#059669' : '#d97706' }}>{item.status === 'Pago' ? '✅ PAGO (Mudar)' : '⏳ PENDENTE (Pagar)'}</Text>
                </TouchableOpacity>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{fontWeight: '900', fontSize: 16, color: item.tipo === 'Entrada' ? '#10b981' : '#ef4444'}}>
                  {item.tipo === 'Entrada' ? '+' : '-'} R$ {item.valor.toFixed(2)}
                </Text>
                <TouchableOpacity onPress={() => excluirMovimentacao(item.id)} style={{marginTop: 10}}><Text style={{ color: '#ef4444', fontSize: 12, fontWeight: 'bold' }}>Excluir</Text></TouchableOpacity>
              </View>
            </View>
          )}/>
        </View>
      )}

      {abaAtual === 'cobranca' && (
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <Text style={styles.tituloSecao}>Gerador de Fatura em PDF</Text>
          <View style={styles.cardAdmin}>
            <Text style={styles.label}>Nome do Cliente / Empresa</Text>
            <TextInput style={styles.input} placeholder="Ex: Padaria do João" value={fatCliente} onChangeText={setFatCliente} />
            <Text style={styles.label}>Motivo da Cobrança</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 15 }}>
              {opcoesFaturamento.map((op, idx) => (
                <TouchableOpacity key={idx} onPress={() => setFatDescricao(op)} style={[styles.chipDescricao, fatDescricao === op && styles.chipDescricaoAtivo]}><Text style={[styles.textoChipDescricao, fatDescricao === op && {color: '#fff', fontWeight: 'bold'}]}>{op}</Text></TouchableOpacity>
              ))}
            </ScrollView>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}><Text style={styles.label}>Período (Ref)</Text><TextInput style={styles.input} placeholder="Ex: Agosto/2026" value={fatPeriodo} onChangeText={setFatPeriodo} /></View>
              <View style={{ flex: 1 }}><Text style={styles.label}>Valor (R$)</Text><TextInput style={styles.input} placeholder="350,00" keyboardType="numeric" value={fatValor} onChangeText={setFatValor} /></View>
            </View>
            <Text style={styles.label}>Sua Chave PIX (Para pagamento)</Text>
            <TextInput style={styles.input} placeholder="E-mail, CPF, CNPJ..." value={fatPix} onChangeText={setFatPix} />
            <TouchableOpacity style={[styles.botaoAcao, {backgroundColor: '#10b981', marginTop: 10}]} onPress={gerarFaturaPDF}><Text style={styles.textoBotaoBranco}>📄 Gerar PDF e Enviar</Text></TouchableOpacity>
          </View>
        </ScrollView>
      )}
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
  cardAdmin: { backgroundColor: '#ffffff', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#e2e8f0' },
  chipTipo: { flex: 1, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e1', alignItems: 'center' },
  textoChip: { fontSize: 12, fontWeight: 'bold', color: '#64748b' },
  chipEntrada: { backgroundColor: '#10b981', borderColor: '#10b981' },
  chipSaida: { backgroundColor: '#ef4444', borderColor: '#ef4444' },
  chipRetirada: { backgroundColor: '#f59e0b', borderColor: '#f59e0b' },
  btnStatus: { backgroundColor: '#d1fae5', padding: 12, borderRadius: 8, alignItems: 'center', marginBottom: 15, borderWidth: 1, borderColor: '#10b981' },
  btnStatusPendente: { backgroundColor: '#fef3c7', borderColor: '#f59e0b' },
  textoStatus: { color: '#059669', fontWeight: 'bold', fontSize: 13 },
  textoStatusPendente: { color: '#d97706' },
  botaoAcao: { backgroundColor: '#0052cc', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  textoBotaoBranco: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  barraFiltros: { flexDirection: 'row', padding: 20, paddingBottom: 10, gap: 10 },
  filtroBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, backgroundColor: '#e2e8f0' },
  filtroBtnAtivo: { backgroundColor: '#0f172a' },
  textoFiltro: { fontSize: 13, color: '#475569', fontWeight: '600' },
  textoFiltroAtivo: { color: '#fff' },
  cardLancamento: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 10 },
  chipDescricao: { paddingHorizontal: 15, paddingVertical: 10, backgroundColor: '#f1f5f9', borderRadius: 20, marginRight: 10, borderWidth: 1, borderColor: '#cbd5e1' },
  chipDescricaoAtivo: { backgroundColor: '#0052cc', borderColor: '#0052cc' },
  textoChipDescricao: { color: '#475569', fontSize: 13 }
});